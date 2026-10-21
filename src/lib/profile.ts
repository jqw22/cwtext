import type { NostrEvent, NostrMetadata } from '@nostrify/nostrify';
import { nip19 } from 'nostr-tools';

/** Shortened npub, e.g. `npub1abcd…wxyz`, for showing which account is in use. */
export function shortNpub(pubkey: string): string {
  try {
    const npub = nip19.npubEncode(pubkey);
    return `${npub.slice(0, 10)}…${npub.slice(-4)}`;
  } catch {
    return 'Nostr user';
  }
}

/**
 * The name to show for an account. Used everywhere a user's name appears so
 * the login dialog and the account menu always agree.
 */
export function getDisplayName(metadata: NostrMetadata | undefined, pubkey: string): string {
  return metadata?.display_name || metadata?.name || shortNpub(pubkey);
}

/**
 * The newest event for a pubkey. Relays can return an outdated kind 0, and
 * a pool returns events in arrival order, so the first one isn't always the
 * current profile.
 */
export function newestEvent(events: NostrEvent[], pubkey: string): NostrEvent | undefined {
  let newest: NostrEvent | undefined;
  for (const event of events) {
    if (event.pubkey !== pubkey) continue;
    if (!newest || event.created_at > newest.created_at) newest = event;
  }
  return newest;
}
