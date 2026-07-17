import { NKinds, NostrEvent, NostrFilter } from '@nostrify/nostrify';
import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';
import { APP_AUTHOR_PUBKEY } from '@/lib/appAuthor';

/** Batch-fetch comment counts for all notes by the app author.
 *  Returns a Map of note d-tag → count. */
export function useCommentCounts() {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['nostr', 'commentCounts', APP_AUTHOR_PUBKEY],
    queryFn: async () => {
      const filter: NostrFilter = {
        kinds: [1111],
        authors: [APP_AUTHOR_PUBKEY],
        limit: 500,
      };

      const events = await nostr.query([filter], {
        signal: AbortSignal.timeout(5000),
      });

      const counts = new Map<string, number>();
      for (const event of events) {
        // Find the 'a' tag (kind:pubkey:d-tag) or 'e' tag (event id) reference
        const aTag = event.tags.find(([n]) => n === 'a')?.[1];
        if (aTag) {
          const parts = aTag.split(':');
          const d = parts[2]; // kind:pubkey:d-tag
          if (d) {
            counts.set(d, (counts.get(d) || 0) + 1);
          }
        }
      }
      return counts;
    },
    staleTime: 2 * 60 * 1000, // Refresh every 2 minutes
  });
}

export function useComments(root: NostrEvent | URL | `#${string}`, limit?: number) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['nostr', 'comments', root instanceof URL ? root.toString() : typeof root === 'string' ? root : root.id, limit],
    queryFn: async () => {
      const filter: NostrFilter = { kinds: [1111] };

      if (typeof root === 'string') {
        filter['#I'] = [root];
      } else if (root instanceof URL) {
        filter['#I'] = [root.toString()];
      } else if (NKinds.addressable(root.kind)) {
        const d = root.tags.find(([name]) => name === 'd')?.[1] ?? '';
        filter['#A'] = [`${root.kind}:${root.pubkey}:${d}`];
      } else if (NKinds.replaceable(root.kind)) {
        filter['#A'] = [`${root.kind}:${root.pubkey}:`];
      } else {
        filter['#E'] = [root.id];
      }

      if (typeof limit === 'number') {
        filter.limit = limit;
      }

      // Query for all kind 1111 comments that reference this event
      const signal = AbortSignal.timeout(5000);
      const events = await nostr.query([filter], { signal });

      // Helper function to get tag value
      const getTagValue = (event: NostrEvent, tagName: string): string | undefined => {
        const tag = event.tags.find(([name]) => name === tagName);
        return tag?.[1];
      };

      // Build parent→children adjacency map (O(n) instead of O(n²))
      const childrenMap = new Map<string, NostrEvent[]>();
      for (const event of events) {
        const parentId = getTagValue(event, 'e');
        if (parentId) {
          const children = childrenMap.get(parentId) ?? [];
          children.push(event);
          childrenMap.set(parentId, children);
        }
      }

      // Sort children by creation time (oldest first)
      for (const children of childrenMap.values()) {
        children.sort((a, b) => a.created_at - b.created_at);
      }

      // Filter top-level comments
      const topLevelComments = events.filter(comment => {
        if (typeof root === 'string') {
          return getTagValue(comment, 'i') === root;
        } else if (root instanceof URL) {
          return getTagValue(comment, 'i') === root.toString();
        } else if (NKinds.addressable(root.kind)) {
          const d = getTagValue(root, 'd') ?? '';
          return getTagValue(comment, 'a') === `${root.kind}:${root.pubkey}:${d}`;
        } else if (NKinds.replaceable(root.kind)) {
          return getTagValue(comment, 'a') === `${root.kind}:${root.pubkey}:`;
        } else {
          return getTagValue(comment, 'e') === root.id;
        }
      });

      // Sort top-level comments by creation time (newest first)
      const sortedTopLevel = topLevelComments.sort((a, b) => b.created_at - a.created_at);

      // O(n) descendant lookup using the adjacency map
      const getDescendantsRecursive = (parentId: string, result: NostrEvent[] = []): NostrEvent[] => {
        const children = childrenMap.get(parentId);
        if (!children) return result;
        for (const child of children) {
          result.push(child);
          getDescendantsRecursive(child.id, result);
        }
        return result;
      };

      // Cache descendant results
      const descendantCache = new Map<string, NostrEvent[]>();

      return {
        allComments: events,
        topLevelComments: sortedTopLevel,
        getDescendants: (commentId: string) => {
          const cached = descendantCache.get(commentId);
          if (cached) return cached;
          const descendants = getDescendantsRecursive(commentId);
          descendantCache.set(commentId, descendants);
          return descendants;
        },
        getDirectReplies: (commentId: string) => {
          return childrenMap.get(commentId) ?? [];
        },
      };
    },
    enabled: !!root,
  });
}
