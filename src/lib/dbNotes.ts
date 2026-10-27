import type { SupabaseClient } from '@supabase/supabase-js';

/** A row of the `notes` table (see supabase/schema.sql) */
export interface NoteRow {
  id: string;
  slug: string;
  para: string;
  sort_order: number | string | null;
  body: string;
  tags: string[];
  /** The work (essay or book) the paragraph belongs to */
  work_id: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

const COLUMNS = 'id, slug, para, sort_order, body, tags, work_id, published_at, created_at, updated_at';

/** Rows per request; Supabase caps a response at 1000 by default */
const PAGE_SIZE = 1000;

/** Every note in the database, in sort order */
export async function fetchDbNotes(client: SupabaseClient, signal: AbortSignal): Promise<NoteRow[]> {
  const rows: NoteRow[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await client
      .from('notes')
      .select(COLUMNS)
      .order('sort_order', { ascending: true, nullsFirst: false })
      .order('slug')
      .range(from, from + PAGE_SIZE - 1)
      .abortSignal(signal);

    if (error) throw error;
    rows.push(...(data as NoteRow[]));
    if (data.length < PAGE_SIZE) return rows;
  }
}

/** One note by its slug, or null if the database doesn't have it */
export async function fetchDbNote(
  client: SupabaseClient,
  slug: string,
  signal: AbortSignal,
): Promise<NoteRow | null> {
  const { data, error } = await client
    .from('notes')
    .select(COLUMNS)
    .eq('slug', slug)
    .abortSignal(signal)
    .maybeSingle();

  if (error) throw error;
  return data as NoteRow | null;
}

/** The fields written when saving a note; the database fills in the rest */
export type NoteInput = Pick<NoteRow, 'slug' | 'para' | 'sort_order' | 'body' | 'tags' | 'work_id'> & {
  published_at?: string | null;
};

/** Add a note, or replace the one with the same slug */
export async function saveDbNote(client: SupabaseClient, note: NoteInput): Promise<NoteRow> {
  const { data, error } = await client
    .from('notes')
    .upsert(note, { onConflict: 'slug' })
    .select(COLUMNS)
    .single();

  if (error) throw error;
  return data as NoteRow;
}

/** How many notes the database holds */
export async function countDbNotes(client: SupabaseClient, signal: AbortSignal): Promise<number> {
  const { count, error } = await client
    .from('notes')
    .select('id', { count: 'exact', head: true })
    .abortSignal(signal);

  if (error) throw error;
  return count ?? 0;
}
