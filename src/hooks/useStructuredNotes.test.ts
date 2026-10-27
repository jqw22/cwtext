import { describe, it, expect } from 'vitest';
import { normalizeTag, rowToNote } from './useStructuredNotes';

describe('normalizeTag', () => {
  it('treats tags that differ only in case or spacing as the same', () => {
    const want = '9.1 the psychological aspects of the kore';
    expect(normalizeTag('9.1 The Psychological Aspects of the Kore')).toBe(want);
    expect(normalizeTag(' 9.1 the psychological  aspects of the kore ')).toBe(want);
    expect(normalizeTag('9.1\u00a0the psychological aspects of the kore')).toBe(want);
  });
});

describe('rowToNote', () => {
  const row = {
    id: 'uuid',
    slug: 'abc',
    para: '456n',
    sort_order: '12.5',
    body: 'Text',
    tags: ['Aion ', 'aion', 'Answer  to Job'],
    work_id: 'work',
    published_at: '2026-10-01T00:00:00Z',
    created_at: '2026-10-01T00:00:00Z',
    updated_at: '2026-10-02T00:00:00Z',
  };

  it('converts every field', () => {
    expect(rowToNote(row)).toEqual({
      title: '456n',
      content: 'Text',
      tags: ['aion', 'answer to job'],
      workId: 'work',
      publishedAt: 1790812800,
      id: 'abc',
      createdAt: 1790899200,
      order: 12.5,
    });
  });

  it('sorts notes without an order last', () => {
    expect(rowToNote({ ...row, sort_order: null }).order).toBe(Infinity);
  });
});
