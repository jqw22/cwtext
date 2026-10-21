import type { NostrEvent, NostrFilter } from '@nostrify/nostrify';
import { useNostr } from '@nostrify/react';
import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNostrPublish } from './useNostrPublish';
import { APP_AUTHOR_PUBKEY } from '@/lib/appAuthor';
import { APP_RELAYS } from '@/lib/appRelays';

const NOTE_KIND = 30023;

/** Consistent relay group for curated notes — unaffected by who logs in */
const CURATED_RELAYS = APP_RELAYS.relays.map(r => r.url);

/** Data extracted from a kind 30023 (NIP-23) long-form content note */
export interface StructuredNote {
  /** The Nostr event */
  event: NostrEvent;
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

/** Parse a NostrEvent into a StructuredNote */
function parseNote(event: NostrEvent): StructuredNote {
  const getTag = (name: string): string | undefined =>
    event.tags.find(([n]) => n === name)?.[1];

  const getAllTags = (name: string): string[] =>
    event.tags.filter(([n]) => n === name).map(([, v]) => v);

  const publishedAtTag = getTag('published_at');

  return {
    event,
    title: getTag('title') ?? 'Untitled',
    content: event.content ?? '',
    tags: getAllTags('t'),
    publishedAt: publishedAtTag ? Number(publishedAtTag) : undefined,
    id: getTag('d') ?? event.id,
    pubkey: event.pubkey,
    createdAt: event.created_at,
    order: getTag('order') ? Number(getTag('order')) : Infinity,
  };
}

/** Events requested per page. Relays may cap responses lower than this. */
const PAGE_SIZE = 500;

/** Safety cap on pages fetched, so a misbehaving relay can't loop forever */
const MAX_PAGES = 50;

/**
 * Fetch every curated note by the app author, paging back in time with
 * `until` so collections larger than one relay response are complete.
 * Superseded versions of the same `d` tag are collapsed to the newest.
 */
export async function fetchAllNotes(
  queryNostr: { query: (filters: NostrFilter[], opts?: { signal?: AbortSignal }) => Promise<NostrEvent[]> },
  signal: AbortSignal,
): Promise<NostrEvent[]> {
  const seen = new Set<string>();
  const latest = new Map<string, NostrEvent>();
  let until: number | undefined;

  for (let page = 0; page < MAX_PAGES; page++) {
    const filter: NostrFilter = {
      kinds: [NOTE_KIND],
      authors: [APP_AUTHOR_PUBKEY],
      limit: PAGE_SIZE,
    };
    if (until !== undefined) filter.until = until;

    const events = await queryNostr.query([filter], { signal });

    let added = 0;
    let oldest = Infinity;
    for (const event of events) {
      oldest = Math.min(oldest, event.created_at);
      if (seen.has(event.id)) continue;
      seen.add(event.id);
      added++;

      const d = event.tags.find(([n]) => n === 'd')?.[1] ?? event.id;
      const current = latest.get(d);
      if (!current || event.created_at > current.created_at) {
        latest.set(d, event);
      }
    }

    // `until` is inclusive, so a page with nothing new means we've reached the end
    if (added === 0) break;
    until = oldest;
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

/**
 * Fetch all curated notes once, sorted by order. Search and tag filtering
 * happen in the browser, so typing never triggers a relay query.
 */
export function useStructuredNotes() {
  const { nostr } = useNostr();

  // Use fixed relay group so curated notes are consistent regardless of login
  const queryNostr = useMemo(() => nostr.group(CURATED_RELAYS), [nostr]);

  return useQuery({
    queryKey: ['nostr', 'notes', APP_AUTHOR_PUBKEY],
    queryFn: async ({ signal }) => {
      const events = await fetchAllNotes(
        queryNostr,
        AbortSignal.any([signal, AbortSignal.timeout(60000)]),
      );
      return events.map(parseNote).sort(byOrder);
    },
    staleTime: 10 * 60 * 1000,
  });
}

/** Fetch a single structured note by its d-tag identifier (always scoped to the app author) */
export function useStructuredNote(id: string) {
  const { nostr } = useNostr();
  const queryClient = useQueryClient();
  const queryNostr = useMemo(() => nostr.group(CURATED_RELAYS), [nostr]);

  return useQuery<StructuredNote | null>({
    queryKey: ['nostr', 'note', APP_AUTHOR_PUBKEY, id],
    queryFn: async ({ signal }) => {
      const filter: NostrFilter = {
        kinds: [NOTE_KIND],
        authors: [APP_AUTHOR_PUBKEY],
        '#d': [id],
        limit: 1,
      };

      const events = await queryNostr.query([filter], {
        signal: AbortSignal.any([signal, AbortSignal.timeout(10000)]),
      });

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

interface CreateNoteParams {
  title: string;
  content: string;
  tags?: string[];
  /** Numeric order for sequencing (to 1dp) */
  order?: string;
  /** Optional d-tag for editing an existing note */
  dtag?: string;
}

/** Create or update a structured text note */
export function usePublishNote() {
  const { mutateAsync: publishEvent } = useNostrPublish();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: CreateNoteParams) => {
      const { title, content, tags = [], order, dtag } = params;
      const noteTags: string[][] = [];

      // d-tag (unique identifier)
      noteTags.push(['d', dtag ?? crypto.randomUUID()]);

      // Para. label
      noteTags.push(['title', title]);

      // Category tags
      for (const tag of tags) {
        if (tag.trim()) {
          noteTags.push(['t', tag.trim().toLowerCase()]);
        }
      }

      // Order for sequencing (optional)
      if (order) {
        noteTags.push(['order', order]);
      }

      // Published at
      noteTags.push(['published_at', String(Math.floor(Date.now() / 1000))]);

      // NIP-31 alt tag
      noteTags.push(['alt', 'Long-form Content']);

      const event = await publishEvent({
        kind: NOTE_KIND,
        content,
        tags: noteTags,
      });

      return parseNote(event);
    },
    onSuccess: (note) => {
      queryClient.invalidateQueries({ queryKey: ['nostr', 'notes'] });
      queryClient.invalidateQueries({ queryKey: ['nostr', 'note', APP_AUTHOR_PUBKEY, note.id] });
    },
  });
}
