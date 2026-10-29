/**
 * The words and "quoted phrases" in a search, lower-cased. A paragraph
 * matches when it contains every one of them, anywhere and in any order.
 */
export function searchTerms(query: string): string[] {
  const terms: string[] = [];
  for (const [, phrase, word] of query.matchAll(/"([^"]*)"?|(\S+)/g)) {
    const term = (phrase ?? word).replace(/\s+/g, ' ').trim().toLowerCase();
    if (term && !terms.includes(term)) terms.push(term);
  }
  return terms;
}

/** Whether `text` contains every term of the search */
export function matchesAll(text: string, terms: string[]): boolean {
  const haystack = text.toLowerCase();
  return terms.every((term) => haystack.includes(term));
}

/**
 * Split `text` into parts, flagging each case-insensitive occurrence of a
 * search term so it can be highlighted. An empty query gives the whole text
 * as one unmatched part.
 */
export function splitMatches(text: string, query: string): { text: string; match: boolean }[] {
  // Longest first, so a phrase wins over a word inside it
  const terms = searchTerms(query).sort((a, b) => b.length - a.length);
  if (terms.length === 0) return [{ text, match: false }];

  const pattern = terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  return text
    .split(new RegExp(`(${pattern})`, 'gi'))
    .filter(Boolean)
    .map((part) => ({ text: part, match: terms.includes(part.toLowerCase()) }));
}
