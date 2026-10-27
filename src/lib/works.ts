import type { VolumeRow, WorkRow } from './dbWorks';

/** How the works list is ordered */
export type WorkOrder = 'volume' | 'written' | 'published';

/** Nulls (unknown) sort after every known value */
function compareNullable(a: number | null, b: number | null): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a - b;
}

/**
 * Sort works for the list. By volume follows the Collected Works (volume, then
 * first paragraph). By date written falls back to first published when the
 * writing date is unknown, since a text can't be written after it appeared.
 */
export function sortWorks(works: WorkRow[], volumes: VolumeRow[], order: WorkOrder): WorkRow[] {
  const volumeOrder = new Map(volumes.map((v) => [v.number, Number(v.sort_order)]));
  const byVolume = (a: WorkRow, b: WorkRow) =>
    compareNullable(a.volume ? volumeOrder.get(a.volume) ?? null : null, b.volume ? volumeOrder.get(b.volume) ?? null : null)
    || compareNullable(a.para_from, b.para_from)
    || a.title.localeCompare(b.title);

  const year = (w: WorkRow) =>
    order === 'written' ? w.year_written ?? w.year_first_published : w.year_first_published;

  return [...works].sort((a, b) =>
    order === 'volume' ? byVolume(a, b) : compareNullable(year(a), year(b)) || byVolume(a, b),
  );
}

/** A work's place in the Collected Works, e.g. 'CW 9.1, ¶306–383' */
export function cwReference(work: Pick<WorkRow, 'volume' | 'para_from' | 'para_to'>): string {
  if (!work.volume) return '';
  const { para_from: from, para_to: to } = work;
  const paras = from !== null && to !== null && to !== from
    ? `${from}–${to}`
    : from ?? to;
  return paras !== null ? `CW ${work.volume}, ¶${paras}` : `CW ${work.volume}`;
}

/**
 * A function giving a note's work id: its link to a work, or for a note
 * saved before notes were linked, the work whose text (tag) it carries.
 */
export function workOfNote(works: WorkRow[]): (note: { workId: string | null; tags: string[] }) => string | null {
  const byTag = new Map(works.filter((w) => w.tag).map((w) => [w.tag!, w.id]));
  return (note) => note.workId ?? note.tags.map((t) => byTag.get(t)).find((id) => id !== undefined) ?? null;
}

/** A volume label, e.g. 'CW 9.1: The Archetypes and the Collective Unconscious' */
export function volumeLabel(volume: Pick<VolumeRow, 'number' | 'title'>): string {
  return `CW ${volume.number}: ${volume.title}`;
}
