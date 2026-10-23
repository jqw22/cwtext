import { describe, it, expect } from 'vitest';
import type { NostrEvent, NostrFilter } from '@nostrify/nostrify';
import { fetchAllNotes, normalizeTag } from './useStructuredNotes';
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
