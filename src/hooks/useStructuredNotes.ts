import type { NostrEvent, NostrFilter } from '@nostrify/nostrify';
import { useNostr } from '@nostrify/react';
import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { APP_AUTHOR_PUBKEY } from '@/lib/appAuthor';
import { APP_RELAYS } from '@/lib/appRelays';
import { supabase } from '@/lib/supabase';
import {
  addMissingDbNotes,
  countDbNotes,
  fetchDbNote,
  fetchDbNotes,
  saveDbNote,
  type NoteInput,
  type NoteRow,
} from '@/lib/dbNotes';

const NOTE_KIND = 30023;

/** Consistent relay group for curated notes — unaffected by who logs in */
const CURATED_RELAYS = APP_RELAYS.relays.map(r => r.url);

/** A curated note, loaded from the database or a kind 30023 (NIP-23) Nostr event */
export interface StructuredNote {
  /** The Nostr event, when the note came from a relay */
  event?: NostrEvent;
  /** Para. label from the `title` tag */
  title: string;
  /** Main text body from `content` */
  content: string;
  /** Category tags from `t` tags */
  tags: string[];
  /** Original publish timestamp */
  publishedAt?: number;
  /** The `d` tag identifier */
  id: string;
  /** Author pubkey */
  pubkey: string;
  /** Event created_at */
  createdAt: number;
  /** Numeric order for sequencing (from `order` tag) */
  order: number;
}

/**
 * Normalise a `t` tag so copies that differ only in case or spacing
 * (stray, doubled or non-breaking spaces) count as the same tag.
 */
export function normalizeTag(tag: string): string {
  return tag.replace(/\s+/g, ' ').trim().toLowerCase();
}

/** Parse a NostrEvent into a StructuredNote */
export function parseNote(event: NostrEvent): StructuredNote {
  const getTag = (name: string): string | undefined =>
    event.tags.find(([n]) => n === name)?.[1];

  const getAllTags = (name: string): string[] =>
    event.tags.filter(([n]) => n === name).map(([, v]) => v);

  const publishedAtTag = getTag('published_at');

  return {
    event,
    title: getTag('title') ?? 'Untitled',
    content: event.content ?? '',
    tags: [...new Set(getAllTags('t').map(normalizeTag).filter(Boolean))],
    publishedAt: publishedAtTag ? Number(publishedAtTag) : undefined,
    id: getTag('d') ?? event.id,
    pubkey: event.pubkey,
    createdAt: event.created_at,
    order: getTag('order') ? Number(getTag('order')) : Infinity,
  };
}

/** Convert a database row to the same shape as a note parsed from Nostr */
export function rowToNote(row: NoteRow): StructuredNote {
  const order = row.sort_order === null ? NaN : Number(row.sort_order);
  return {
    title: row.para || 'Untitled',
    content: row.body ?? '',
    tags: [...new Set((row.tags ?? []).map(normalizeTag).filter(Boolean))],
    publishedAt: row.published_at ? Math.floor(Date.parse(row.published_at) / 1000) : undefined,
    id: row.slug,
    // Database notes are the curator's, so links to them stay valid naddrs
    pubkey: APP_AUTHOR_PUBKEY,
    createdAt: Math.floor(Date.parse(row.updated_at) / 1000),
    order: Number.isFinite(order) ? order : Infinity,
  };
}

/** The database row for a note, e.g. one loaded from Nostr */
export function noteToRow(note: StructuredNote): NoteInput {
  return {
    slug: note.id,
    para: note.title,
    sort_order: Number.isFinite(note.order) ? note.order : null,
    body: note.content,
    tags: note.tags,
    published_at: new Date((note.publishedAt ?? note.createdAt) * 1000).toISOString(),
  };
}

/**
 * All notes from the database, or undefined if there is no database, it
 * can't be reached, or it holds no notes yet; the caller then uses Nostr.
 */
async function fetchNotesFromDb(signal: AbortSignal): Promise<StructuredNote[] | undefined> {
  if (!supabase) return undefined;
  try {
    const rows = await fetchDbNotes(supabase, signal);
    return rows.length > 0 ? rows.map(rowToNote) : undefined;
  } catch (error) {
    if (signal.aborted) throw error;
    console.warn('Note database unavailable, loading from Nostr', error);
    return undefined;
  }
}

/**
 * The nightly copy of the database that ships with the site, or undefined if
 * it can't be loaded or is empty (before the first backup has run).
 */
async function fetchNotesFromBackup(signal: AbortSignal): Promise<StructuredNote[] | undefined> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}notes.json`, { signal });
    if (!res.ok) return undefined;
    const rows: NoteRow[] = await res.json();
    return Array.isArray(rows) && rows.length > 0 ? rows.map(rowToNote) : undefined;
  } catch (error) {
    if (signal.aborted) throw error;
    return undefined;
  }
}

/** Events requested per page. Relays may cap responses lower than this. */
const PAGE_SIZE = 500;

/** Safety cap on pages fetched, so a misbehaving relay can't loop forever */
const MAX_PAGES = 50;

/** How long one page may take before that relay is given up on */
const PAGE_TIMEOUT = 15000;

interface Queryable {
  query: (filters: NostrFilter[], opts?: { signal?: AbortSignal }) => Promise<NostrEvent[]>;
}

/**
 * Page back through one relay with `until` until it has nothing older.
 * A relay that errors, closes the subscription or times out just stops
 * contributing; whatever it already sent is kept.
 */
async function fetchFromRelay(
  relay: Queryable,
  signal: AbortSignal,
  onEvent: (event: NostrEvent) => void,
  onPage: () => void,
): Promise<void> {
  const seen = new Set<string>();
  let until: number | undefined;

  for (let page = 0; page < MAX_PAGES && !signal.aborted; page++) {
    const filter: NostrFilter = {
      kinds: [NOTE_KIND],
      authors: [APP_AUTHOR_PUBKEY],
      limit: PAGE_SIZE,
    };
    if (until !== undefined) filter.until = until;

    let events: NostrEvent[];
    try {
      events = await relay.query([filter], {
        signal: AbortSignal.any([signal, AbortSignal.timeout(PAGE_TIMEOUT)]),
      });
    } catch {
      return;
    }

    let added = 0;
    let oldest = Infinity;
    for (const event of events) {
      oldest = Math.min(oldest, event.created_at);
      if (seen.has(event.id)) continue;
      seen.add(event.id);
      added++;
      onEvent(event);
    }

    // `until` is inclusive, so a page with nothing new means we've reached the end
    if (added === 0) return;
    onPage();
    until = oldest;
  }
}

/**
 * Fetch every curated note by the app author from each relay on its own,
 * paging back in time with `until` so collections larger than one relay
 * response are complete. Relays are not raced against each other: a fast
 * relay that holds none of the notes can't cut the others off.
 * Superseded versions of the same `d` tag are collapsed to the newest.
 * `onProgress` gets the notes so far after every page, so the page can show
 * them without waiting for slow or unreachable relays to time out.
 * Throws if no relay returned anything, so an empty result is retried
 * rather than cached.
 */
export async function fetchAllNotes(
  relays: Queryable[],
  signal: AbortSignal,
  onProgress?: (events: NostrEvent[]) => void,
): Promise<NostrEvent[]> {
  const latest = new Map<string, NostrEvent>();

  const keep = (event: NostrEvent) => {
    const d = event.tags.find(([n]) => n === 'd')?.[1] ?? event.id;
    const current = latest.get(d);
    if (!current || event.created_at > current.created_at) {
      latest.set(d, event);
    }
  };

  const progress = () => onProgress?.([...latest.values()]);

  await Promise.all(relays.map((relay) => fetchFromRelay(relay, signal, keep, progress)));

  if (latest.size === 0) {
    throw new Error('No notes received from any relay');
  }

  return [...latest.values()];
}

/** Sort by the `order` tag, notes without one last */
function byOrder(a: StructuredNote, b: StructuredNote): number {
  if (a.order === Infinity && b.order === Infinity) return 0;
  if (a.order === Infinity) return 1;
  if (b.order === Infinity) return -1;
  return a.order - b.order;
}

const NOTES_KEY = ['nostr', 'notes', APP_AUTHOR_PUBKEY];

/** localStorage key for the last full set of curated notes */
const CACHE_KEY = 'cwtext:notes:v2';

/** Where earlier versions kept raw Nostr events */
const OLD_CACHE_KEY = 'cwtext:notes';

function readCache(): { notes: StructuredNote[]; savedAt: number } | undefined {
  try {
    localStorage.removeItem(OLD_CACHE_KEY);
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) ?? 'null');
    if (Array.isArray(cached?.notes) && typeof cached.savedAt === 'number') {
      // JSON turns an Infinity order into null
      const notes = cached.notes.map((n: StructuredNote) => ({ ...n, order: n.order ?? Infinity }));
      return { notes, savedAt: cached.savedAt };
    }
  } catch {
    // Unreadable cache: load as if there were none
  }
  return undefined;
}

function writeCache(notes: StructuredNote[]): void {
  try {
    // Without the raw events, which roughly double the size
    const stripped = notes.map(({ event: _event, ...note }) => note);
    localStorage.setItem(CACHE_KEY, JSON.stringify({ notes: stripped, savedAt: Date.now() }));
  } catch {
    // Storage full or blocked: the next visit just loads afresh
  }
}

/**
 * Fetch all curated notes once, sorted by order: from the database when one
 * is configured and holds notes, then the nightly backup that ships with the
 * site, and only then the Nostr relays. Search and
 * tag filtering happen in the browser, so typing never triggers a query.
 * The last full result is kept in localStorage and shown straight away on
 * the next visit while the notes are fetched again in the background.
 */
export function useStructuredNotes() {
  const { nostr } = useNostr();
  const queryClient = useQueryClient();

  // Fixed relays so curated notes are consistent regardless of login. Each is
  // queried on its own; the shared connections come from the pool.
  const relays = useMemo(() => CURATED_RELAYS.map((url) => nostr.relay(url)), [nostr]);

  const [cached] = useState(readCache);

  return useQuery({
    queryKey: NOTES_KEY,
    queryFn: async ({ signal }) => {
      const fromDb = await fetchNotesFromDb(AbortSignal.any([signal, AbortSignal.timeout(15000)]))
        ?? await fetchNotesFromBackup(signal);
      if (fromDb) {
        const notes = fromDb.sort(byOrder);
        writeCache(notes);
        return notes;
      }

      const events = await fetchAllNotes(
        relays,
        AbortSignal.any([signal, AbortSignal.timeout(60000)]),
        // Show notes as each page arrives. Not on a refresh of a full list,
        // which would briefly shrink to whatever the first relay sent.
        (partial) => {
          const current = queryClient.getQueryData<StructuredNote[]>(NOTES_KEY);
          if (!current || partial.length > current.length) {
            queryClient.setQueryData(NOTES_KEY, partial.map(parseNote).sort(byOrder));
          }
        },
      );
      const notes = events.map(parseNote).sort(byOrder);
      writeCache(notes);
      return notes;
    },
    initialData: cached?.notes,
    initialDataUpdatedAt: cached?.savedAt,
    staleTime: 10 * 60 * 1000,
  });
}

/** Fetch a single note by its slug (the Nostr d tag): from the database, then the nightly backup, then the relays */
export function useStructuredNote(id: string) {
  const { nostr } = useNostr();
  const queryClient = useQueryClient();
  const relays = useMemo(() => CURATED_RELAYS.map((url) => nostr.relay(url)), [nostr]);

  return useQuery<StructuredNote | null>({
    queryKey: ['nostr', 'note', APP_AUTHOR_PUBKEY, id],
    queryFn: async ({ signal }) => {
      if (supabase) {
        try {
          const row = await fetchDbNote(supabase, id, AbortSignal.any([signal, AbortSignal.timeout(10000)]));
          if (row) return rowToNote(row);
        } catch (error) {
          if (signal.aborted) throw error;
          console.warn('Note database unavailable, loading from Nostr', error);
        }
      }

      const fromBackup = (await fetchNotesFromBackup(signal))?.find((n) => n.id === id);
      if (fromBackup) return fromBackup;

      const filter: NostrFilter = {
        kinds: [NOTE_KIND],
        authors: [APP_AUTHOR_PUBKEY],
        '#d': [id],
        limit: 1,
      };

      // Ask every relay and wait for each, so a relay without it can't answer first
      const opts = { signal: AbortSignal.any([signal, AbortSignal.timeout(10000)]) };
      const events = (await Promise.all(
        relays.map((relay) => relay.query([filter], opts).catch(() => [])),
      )).flat();

      if (events.length === 0) return null;
      const newest = events.reduce((a, b) => (b.created_at > a.created_at ? b : a));
      return parseNote(newest);
    },
    // Show the copy from the loaded list instantly while the fresh one loads
    placeholderData: () => queryClient
      .getQueryData<StructuredNote[]>(['nostr', 'notes', APP_AUTHOR_PUBKEY])
      ?.find((n) => n.id === id),
    enabled: !!id,
  });
}

interface SaveNoteParams {
  title: string;
  content: string;
  tags?: string[];
  /** Numeric order for sequencing (to 1dp) */
  order?: string;
  /** Slug of an existing note to replace */
  dtag?: string;
}

/** Refresh everything that shows notes after the database changes */
function invalidateNotes(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ['nostr', 'notes'] });
  queryClient.invalidateQueries({ queryKey: ['nostr', 'note'] });
  queryClient.invalidateQueries({ queryKey: DB_COUNT_KEY });
}

/** Create or update a note in the database. Only works for a signed-in curator. */
export function useSaveNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: SaveNoteParams) => {
      if (!supabase) throw new Error('No note database is configured');
      const { title, content, tags = [], order, dtag } = params;

      const row = await saveDbNote(supabase, {
        slug: dtag ?? crypto.randomUUID(),
        para: title,
        sort_order: order ? Number(order) : null,
        body: content,
        tags: [...new Set(tags.map(normalizeTag).filter(Boolean))],
        // An edit keeps the note's original date
        ...(dtag ? {} : { published_at: new Date().toISOString() }),
      });

      return rowToNote(row);
    },
    onSuccess: () => invalidateNotes(queryClient),
  });
}

const DB_COUNT_KEY = ['db', 'count'];

/** How many notes the database holds, for the curator's tools */
export function useDbNoteCount(enabled: boolean) {
  return useQuery({
    queryKey: DB_COUNT_KEY,
    queryFn: ({ signal }) => countDbNotes(supabase!, signal),
    enabled: enabled && !!supabase,
  });
}

/**
 * Copy every curated note on the relays into the database, skipping any the
 * database already has so edits made there are kept.
 */
export function useCopyNotesFromNostr() {
  const { nostr } = useNostr();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!supabase) throw new Error('No note database is configured');
      const relays = CURATED_RELAYS.map((url) => nostr.relay(url));
      const events = await fetchAllNotes(relays, AbortSignal.timeout(60000));
      const added = await addMissingDbNotes(supabase, events.map(parseNote).map(noteToRow));
      return { found: events.length, added };
    },
    onSuccess: () => invalidateNotes(queryClient),
  });
}
