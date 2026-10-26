import { describe, it, expect } from 'vitest';
import type { VolumeRow, WorkRow } from './dbWorks';
import { cwReference, sortWorks } from './works';

const volumes = [
  { number: '5', sort_order: 5 },
  { number: '9.1', sort_order: '9.1' },
  { number: '11', sort_order: 11 },
] as VolumeRow[];

function work(title: string, fields: Partial<WorkRow>): WorkRow {
  return {
    id: title, title, original_title: null, original_language: null, kind: 'essay', volume: null,
    para_from: null, para_to: null, year_written: null, year_written_note: null,
    year_first_published: null, year_first_published_note: null, first_published_in: null,
    revisions: null, notes: '', tag: null, ...fields,
  };
}

const works = [
  work('Job', { volume: '11', para_from: 553, year_written: 1951, year_first_published: 1952 }),
  work('Kore', { volume: '9.1', para_from: 306, year_first_published: 1941 }),
  work('Two Kinds', { volume: '5', para_from: 4, year_first_published: 1911 }),
  work('Intro', { volume: '5', para_from: 1, year_first_published: 1911 }),
  work('Undated', { volume: '11', para_from: 1 }),
];

const titles = (list: WorkRow[]) => list.map((w) => w.title);

describe('sortWorks', () => {
  it('orders by volume, with 9.1 between 5 and 11, then by paragraph', () => {
    expect(titles(sortWorks(works, volumes, 'volume'))).toEqual(['Intro', 'Two Kinds', 'Kore', 'Undated', 'Job']);
  });

  it('orders by date written, falling back to first published, unknown last', () => {
    expect(titles(sortWorks(works, volumes, 'written'))).toEqual(['Intro', 'Two Kinds', 'Kore', 'Job', 'Undated']);
  });

  it('orders by date first published', () => {
    const late = work('Late', { year_written: 1900, year_first_published: 1960 });
    expect(titles(sortWorks([...works, late], volumes, 'published')).slice(0, 5))
      .toEqual(['Intro', 'Two Kinds', 'Kore', 'Job', 'Late']);
  });
});

describe('cwReference', () => {
  it('names the volume and paragraph range', () => {
    expect(cwReference({ volume: '9.1', para_from: 306, para_to: 383 })).toBe('CW 9.1, ¶306–383');
    expect(cwReference({ volume: '5', para_from: 4, para_to: 4 })).toBe('CW 5, ¶4');
    expect(cwReference({ volume: '5', para_from: null, para_to: null })).toBe('CW 5');
    expect(cwReference({ volume: null, para_from: 1, para_to: 2 })).toBe('');
  });
});
