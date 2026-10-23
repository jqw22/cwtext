/**
 * Split `text` into parts, flagging each case-insensitive occurrence of
 * `query` so it can be highlighted. An empty query gives the whole text
 * as one unmatched part.
 */
export function splitMatches(text: string, query: string): { text: string; match: boolean }[] {
  const q = query.trim();
  if (!q) return [{ text, match: false }];

  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return text
    .split(new RegExp(`(${escaped})`, 'gi'))
    .filter(Boolean)
    .map((part) => ({ text: part, match: part.toLowerCase() === q.toLowerCase() }));
}
