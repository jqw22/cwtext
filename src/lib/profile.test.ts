import { describe, it, expect } from 'vitest';
import type { NostrEvent } from '@nostrify/nostrify';
import { getDisplayName, newestEvent, shortNpub } from './profile';

const pubkey = 'a'.repeat(64);

function kind0(created_at: number, author = pubkey): NostrEvent {
  return { id: String(created_at), pubkey: author, created_at, kind: 0, tags: [], content: '{}', sig: '' };
}

describe('getDisplayName', () => {
  it('prefers display_name, then name, then the npub', () => {
    expect(getDisplayName({ display_name: 'Display', name: 'name' }, pubkey)).toBe('Display');
    expect(getDisplayName({ name: 'name' }, pubkey)).toBe('name');
    expect(getDisplayName({}, pubkey)).toBe(shortNpub(pubkey));
  });
});

describe('newestEvent', () => {
  it('picks the newest event for the pubkey, whatever the order', () => {
    const events = [kind0(10), kind0(30), kind0(20), kind0(99, 'b'.repeat(64))];
    expect(newestEvent(events, pubkey)?.created_at).toBe(30);
  });

  it('returns undefined when the pubkey has no events', () => {
    expect(newestEvent([kind0(1, 'b'.repeat(64))], pubkey)).toBeUndefined();
  });
});
