import { describe, it, expect } from 'vitest';
import type { NostrEvent, NostrFilter } from '@nostrify/nostrify';
import { fetchAllNotes } from './useStructuredNotes';
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
    const result = await fetchAllNotes(fakeRelay(events, 5), AbortSignal.timeout(1000));
    expect(result.map((e) => e.id).sort()).toEqual(events.map((e) => e.id).sort());
  });

  it('keeps only the newest version of each d tag', async () => {
    const events = [note(1, 100, 'same'), note(2, 200, 'same'), note(3, 150)];
    const result = await fetchAllNotes(fakeRelay(events, 10), AbortSignal.timeout(1000));
    expect(result.map((e) => e.id).sort()).toEqual(['id2', 'id3']);
  });
});
