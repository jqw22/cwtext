import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import {
  countDbNotes,
  fetchDbNote,
  fetchDbNotes,
  saveDbNote,
  type NoteRow,
} from '@/lib/dbNotes';

/** A paragraph from the texts, as stored in the database */
export interface StructuredNote {
  /** Para. label */
  title: string;
  /** Main text body */
  content: string;
  /** The texts the paragraph belongs to */
  tags: string[];
  /** Original publish timestamp (Unix seconds) */
  publishedAt?: number;
  /** Slug, used in the note's link */
  id: string;
  /** Last change (Unix seconds) */
  createdAt: number;
  /** Numeric order for sequencing */
  order: number;
}

/**
 * Normalise a tag so copies that differ only in case or spacing
 * (stray, doubled or non-breaking spaces) count as the same tag.
 */
export function normalizeTag(tag: string): string {
  return tag.replace(/\s+/g, ' ').trim().toLowerCase();
}

/** Convert a database row to a note */
export function rowToNote(row: NoteRow): StructuredNote {
  const order = row.sort_order === null ? NaN : Number(row.sort_order);
  return {
    title: row.para || 'Untitled',
    content: row.body ?? '',
    tags: [...new Set((row.tags ?? []).map(normalizeTag).filter(Boolean))],
    publishedAt: row.published_at ? Math.floor(Date.parse(row.published_at) / 1000) : undefined,
    id: row.slug,
    createdAt: Math.floor(Date.parse(row.updated_at) / 1000),
    order: Number.isFinite(order) ? order : Infinity,
  };
}

/** All notes from the database, or undefined if it can't be reached or is empty */
async function fetchNotesFromDb(signal: AbortSignal): Promise<StructuredNote[] | undefined> {
  if (!supabase) return undefined;
  try {
    const rows = await fetchDbNotes(supabase, signal);
    return rows.length > 0 ? rows.map(rowToNote) : undefined;
  } catch (error) {
    if (signal.aborted) throw error;
    console.warn('Note database unavailable, loading the backup', error);
    return undefined;
  }
}

/**
 * The nightly copy of the database that ships with the site, or undefined if
 * it can't be loaded or is empty.
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

/** Sort by order, notes without one last */
function byOrder(a: StructuredNote, b: StructuredNote): number {
  if (a.order === Infinity && b.order === Infinity) return 0;
  if (a.order === Infinity) return 1;
  if (b.order === Infinity) return -1;
  return a.order - b.order;
}

const NOTES_KEY = ['notes'];

/** localStorage key for the last full set of notes */
const CACHE_KEY = 'cwtext:notes:v2';

function readCache(): { notes: StructuredNote[]; savedAt: number } | undefined {
  try {
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
    localStorage.setItem(CACHE_KEY, JSON.stringify({ notes, savedAt: Date.now() }));
  } catch {
    // Storage full or blocked: the next visit just loads afresh
  }
}

/**
 * Fetch all notes once, sorted by order: from the database, or from the
 * nightly backup that ships with the site if the database can't be reached.
 * Search and tag filtering happen in the browser, so typing never triggers
 * a query. The last full result is kept in localStorage and shown straight
 * away on the next visit while the notes are fetched again in the background.
 */
export function useStructuredNotes() {
  const [cached] = useState(readCache);

  return useQuery({
    queryKey: NOTES_KEY,
    queryFn: async ({ signal }) => {
      const notes = await fetchNotesFromDb(AbortSignal.any([signal, AbortSignal.timeout(15000)]))
        ?? await fetchNotesFromBackup(signal);
      // Throwing rather than returning [] means an empty result is retried, not cached
      if (!notes) throw new Error('Notes could not be loaded');
      notes.sort(byOrder);
      writeCache(notes);
      return notes;
    },
    initialData: cached?.notes,
    initialDataUpdatedAt: cached?.savedAt,
    staleTime: 10 * 60 * 1000,
  });
}

/** Fetch a single note by its slug: from the database, then the nightly backup */
export function useStructuredNote(id: string) {
  const queryClient = useQueryClient();

  return useQuery<StructuredNote | null>({
    queryKey: ['note', id],
    queryFn: async ({ signal }) => {
      if (supabase) {
        try {
          const row = await fetchDbNote(supabase, id, AbortSignal.any([signal, AbortSignal.timeout(10000)]));
          if (row) return rowToNote(row);
        } catch (error) {
          if (signal.aborted) throw error;
          console.warn('Note database unavailable, loading the backup', error);
        }
      }

      return (await fetchNotesFromBackup(signal))?.find((n) => n.id === id) ?? null;
    },
    // Show the copy from the loaded list instantly while the fresh one loads
    placeholderData: () => queryClient
      .getQueryData<StructuredNote[]>(NOTES_KEY)
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
  queryClient.invalidateQueries({ queryKey: NOTES_KEY });
  queryClient.invalidateQueries({ queryKey: ['note'] });
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
