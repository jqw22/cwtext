import type { SupabaseClient } from '@supabase/supabase-js';

/** A row of the `volumes` table (see supabase/works.sql) */
export interface VolumeRow {
  /** As written on the spine: '5', '9.1' */
  number: string;
  sort_order: number | string;
  title: string;
  year_published: number | null;
  notes: string;
}

/** A row of the `works` table: one essay or book */
export interface WorkRow {
  id: string;
  title: string;
  original_title: string | null;
  original_language: string | null;
  kind: string;
  volume: string | null;
  para_from: number | null;
  para_to: number | null;
  year_written: number | null;
  year_written_note: string | null;
  year_first_published: number | null;
  year_first_published_note: string | null;
  first_published_in: string | null;
  revisions: string | null;
  notes: string;
  /** The text (tag) its notes carry */
  tag: string | null;
}

// One literal, so supabase-js can check the selected columns
const WORK_COLUMNS = 'id, title, original_title, original_language, kind, volume, para_from, para_to, year_written, year_written_note, year_first_published, year_first_published_note, first_published_in, revisions, notes, tag';

const VOLUME_COLUMNS = 'number, sort_order, title, year_published, notes';

export interface WorksData {
  volumes: VolumeRow[];
  works: WorkRow[];
}

/** Every volume and work. A few hundred rows at most, so one request each. */
export async function fetchDbWorks(client: SupabaseClient, signal: AbortSignal): Promise<WorksData> {
  const [volumes, works] = await Promise.all([
    client.from('volumes').select(VOLUME_COLUMNS).order('sort_order').abortSignal(signal),
    client.from('works').select(WORK_COLUMNS).order('title').limit(5000).abortSignal(signal),
  ]);

  if (volumes.error) throw volumes.error;
  if (works.error) throw works.error;
  return { volumes: volumes.data as VolumeRow[], works: works.data as WorkRow[] };
}

/** The fields written when saving a work; a new work has no id yet */
export type WorkInput = Omit<WorkRow, 'id'> & { id?: string };

/** Add a work, or replace the one with the same id */
export async function saveDbWork(client: SupabaseClient, work: WorkInput): Promise<WorkRow> {
  const { data, error } = await client
    .from('works')
    .upsert(work)
    .select(WORK_COLUMNS)
    .single();

  if (error) throw error;
  return data as WorkRow;
}

export async function deleteDbWork(client: SupabaseClient, id: string): Promise<void> {
  const { error } = await client.from('works').delete().eq('id', id);
  if (error) throw error;
}
