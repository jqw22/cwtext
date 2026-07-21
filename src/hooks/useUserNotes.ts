import { type NostrEvent } from '@nostrify/nostrify';
import { useNostr } from '@nostrify/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNostrPublish } from './useNostrPublish';
import { useCurrentUser } from './useCurrentUser';

const NOTE_KIND = 30023;

interface StructuredNote {
  event: NostrEvent;
  title: string;
  content: string;
  tags: string[];
  publishedAt?: number;
  id: string;
  pubkey: string;
  createdAt: number;
  order: number;
}

/** Parse a NostrEvent into a StructuredNote (content is already decrypted) */
function parseNote(event: NostrEvent, decryptedContent: string): StructuredNote {
  const getTag = (name: string): string | undefined =>
    event.tags.find(([n]) => n === name)?.[1];

  const publishedAtTag = getTag('published_at');

  return {
    event,
    title: getTag('title') ?? 'Untitled',
    content: decryptedContent,
    tags: event.tags.filter(([n]) => n === 't').map(([, v]) => v),
    publishedAt: publishedAtTag ? Number(publishedAtTag) : undefined,
    id: getTag('d') ?? event.id,
    pubkey: event.pubkey,
    createdAt: event.created_at,
    order: getTag('order') ? Number(getTag('order')) : Infinity,
  };
}

/**
 * Fetch the logged-in user's encrypted notes.
 * Queries kind 30023 events from the user's pubkey, decrypts content via NIP-44.
 */
export function useUserNotes() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();

  return useQuery({
    queryKey: ['nostr', 'user-notes', user?.pubkey],
    queryFn: async () => {
      if (!user) return [];

      const filter: Record<string, unknown> = {
        kinds: [NOTE_KIND],
        authors: [user.pubkey],
        limit: 200,
      };

      const events = await nostr.query([filter], {
        signal: AbortSignal.timeout(8000),
      });

      // Decrypt each note's content via NIP-44 (self-encrypt)
      const notes: StructuredNote[] = [];
      for (const event of events) {
        try {
          const plaintext = await user.signer.nip44.decrypt(user.pubkey, event.content);
          notes.push(parseNote(event, plaintext));
        } catch {
          // Skip notes that can't be decrypted (old format, wrong key, etc.)
        }
      }

      // Sort by order ascending
      notes.sort((a, b) => {
        if (a.order === Infinity && b.order === Infinity) return 0;
        if (a.order === Infinity) return 1;
        if (b.order === Infinity) return -1;
        return a.order - b.order;
      });

      return notes;
    },
    enabled: !!user,
  });
}

interface CreateUserNoteParams {
  title: string;
  content: string;
  tags?: string[];
  order?: string;
  /** Optional d-tag for editing an existing note */
  dtag?: string;
}

/** Publish an encrypted user note (NIP-44 self-encrypt) */
export function usePublishUserNote() {
  const { mutateAsync: publishEvent } = useNostrPublish();
  const queryClient = useQueryClient();
  const { user } = useCurrentUser();

  return useMutation({
    mutationFn: async (params: CreateUserNoteParams) => {
      if (!user) throw new Error('Must be logged in');
      if (!user.signer.nip44) throw new Error('Signer does not support NIP-44 encryption');

      const { title, content, tags = [], order, dtag } = params;
      const noteTags: string[][] = [];

      noteTags.push(['d', dtag ?? crypto.randomUUID()]);
      noteTags.push(['title', title]);

      for (const tag of tags) {
        if (tag.trim()) {
          noteTags.push(['t', tag.trim().toLowerCase()]);
        }
      }

      if (order) {
        noteTags.push(['order', order]);
      }

      noteTags.push(['published_at', String(Math.floor(Date.now() / 1000))]);
      noteTags.push(['alt', 'Long-form Content']);

      // Encrypt content via NIP-44 (self-encrypt)
      const ciphertext = await user.signer.nip44.encrypt(user.pubkey, content);

      await publishEvent({
        kind: NOTE_KIND,
        content: ciphertext,
        tags: noteTags,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nostr', 'user-notes'] });
    },
  });
}
