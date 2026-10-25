import { describe, it, expect } from 'vitest';
import type { NostrEvent, NostrFilter } from '@nostrify/nostrify';
import { fetchAllNotes, normalizeTag, noteToRow, parseNote, rowToNote } from './useStructuredNotes';
import { APP_AUTHOR_PUBKEY } from '@/lib/appAuthor';

function note(i: number, createdAt: number, d = `d${i}`): NostrEvent {
  return {
    id: `id${i}`,
    pubkey: APP_AUTHOR_PUBKEY,
    created_at: createdAt,
    kind: 30023,
    tags: [['d', d]],
    content: '',
    sig: '',
  };
}

/** A fake relay that honours `until` but caps every response at `cap` events */
function fakeRelay(events: NostrEvent[], cap: number) {
  return {
    async query([filter]: NostrFilter[]) {
      return events
        .filter((e) => filter.until === undefined || e.created_at <= filter.until)
        .sort((a, b) => b.created_at - a.created_at)
        .slice(0, Math.min(cap, filter.limit ?? Infinity));
    },
  };
}

describe('fetchAllNotes', () => {
  it('pages past a relay response cap to load every note', async () => {
    const events = Array.from({ length: 12 }, (_, i) => note(i, 1000 + i));
    const result = await fetchAllNotes([fakeRelay(events, 5)], AbortSignal.timeout(1000));
    expect(result.map((e) => e.id).sort()).toEqual(events.map((e) => e.id).sort());
  });

  it('keeps only the newest version of each d tag', async () => {
    const events = [note(1, 100, 'same'), note(2, 200, 'same'), note(3, 150)];
    const result = await fetchAllNotes([fakeRelay(events, 10)], AbortSignal.timeout(1000));
    expect(result.map((e) => e.id).sort()).toEqual(['id2', 'id3']);
  });

  it('is not cut off by a fast relay that has none of the notes', async () => {
    const events = Array.from({ length: 12 }, (_, i) => note(i, 1000 + i));
    const slow = fakeRelay(events, 5);
    const slowRelay = {
      async query(filters: NostrFilter[]) {
        await new Promise((r) => setTimeout(r, 50));
        return slow.query(filters);
      },
    };
    const result = await fetchAllNotes([fakeRelay([], 500), slowRelay], AbortSignal.timeout(1000));
    expect(result).toHaveLength(12);
  });

  it('reports notes as they arrive, before a slow relay finishes', async () => {
    const events = [note(1, 100), note(2, 200)];
    // Never answers until the fetch is aborted, like an unreachable relay
    const hanging = {
      query: (_: NostrFilter[], opts?: { signal?: AbortSignal }) =>
        new Promise<NostrEvent[]>((_, reject) => opts?.signal?.addEventListener('abort', reject)),
    };
    const controller = new AbortController();
    let first: NostrEvent[] | undefined;
    const done = fetchAllNotes(
      [hanging, fakeRelay(events, 10)],
      controller.signal,
      (partial) => { first ??= partial; },
    );
    await new Promise((r) => setTimeout(r, 20));
    expect(first).toHaveLength(2);
    controller.abort();
    expect(await done).toHaveLength(2);
  });

  it('keeps notes from other relays when one relay fails', async () => {
    const events = [note(1, 100), note(2, 200)];
    const broken = { query: () => Promise.reject(new Error('Subscription closed')) };
    const result = await fetchAllNotes([broken, fakeRelay(events, 10)], AbortSignal.timeout(1000));
    expect(result).toHaveLength(2);
  });

  it('throws when no relay returns any notes, so the empty result is retried', async () => {
    await expect(fetchAllNotes([fakeRelay([], 10)], AbortSignal.timeout(1000))).rejects.toThrow();
  });
});

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
    published_at: '2026-10-01T00:00:00Z',
    created_at: '2026-10-01T00:00:00Z',
    updated_at: '2026-10-02T00:00:00Z',
  };

  it('matches the shape of a note parsed from Nostr', () => {
    expect(rowToNote(row)).toEqual({
      title: '456n',
      content: 'Text',
      tags: ['aion', 'answer to job'],
      publishedAt: 1790812800,
      id: 'abc',
      pubkey: APP_AUTHOR_PUBKEY,
      createdAt: 1790899200,
      order: 12.5,
    });
  });

  it('sorts notes without an order last', () => {
    expect(rowToNote({ ...row, sort_order: null }).order).toBe(Infinity);
  });
});

describe('noteToRow', () => {
  it('keeps every field of a Nostr note', () => {
    const event = {
      ...note(1, 1790899200, 'slug-1'),
      content: 'Body',
      tags: [['d', 'slug-1'], ['title', '307'], ['order', '307.0'], ['t', 'Kore'], ['published_at', '1790812800']],
    };
    expect(noteToRow(parseNote(event))).toEqual({
      slug: 'slug-1',
      para: '307',
      sort_order: 307,
      body: 'Body',
      tags: ['kore'],
      published_at: '2026-10-01T00:00:00.000Z',
    });
  });

  it('leaves out a missing order and falls back to created_at', () => {
    const row = noteToRow(parseNote(note(2, 1790899200)));
    expect(row.sort_order).toBeNull();
    expect(row.published_at).toBe('2026-10-02T00:00:00.000Z');
  });
});
