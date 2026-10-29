/**
 * The words and "quoted phrases" in a search. A paragraph matches when it
 * contains every one of them, anywhere and in any order. Unless the case
 * must match, they are lower-cased.
 */
export function searchTerms(query: string, matchCase = false): string[] {
  const terms: string[] = [];
  for (const [, phrase, word] of query.matchAll(/"([^"]*)"?|(\S+)/g)) {
    const spaced = (phrase ?? word).replace(/\s+/g, ' ').trim();
    const term = matchCase ? spaced : spaced.toLowerCase();
    if (term && !terms.includes(term)) terms.push(term);
  }
  return terms;
}

/** Whether `text` contains every term of the search (terms from `searchTerms` with the same `matchCase`) */
export function matchesAll(text: string, terms: string[], matchCase = false): boolean {
  const haystack = matchCase ? text : text.toLowerCase();
  return terms.every((term) => haystack.includes(term));
}

/**
 * Split `text` into parts, flagging each occurrence of a search term so it
 * can be highlighted. An empty query gives the whole text as one unmatched part.
 */
export function splitMatches(text: string, query: string, matchCase = false): { text: string; match: boolean }[] {
  // Longest first, so a phrase wins over a word inside it
  const terms = searchTerms(query, matchCase).sort((a, b) => b.length - a.length);
  if (terms.length === 0) return [{ text, match: false }];

  const pattern = terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  return text
    .split(new RegExp(`(${pattern})`, matchCase ? 'g' : 'gi'))
    .filter(Boolean)
    .map((part) => ({ text: part, match: terms.includes(matchCase ? part : part.toLowerCase()) }));
}
