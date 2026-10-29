import { describe, it, expect } from 'vitest';
import { matchesAll, searchTerms, splitMatches } from './highlight';

describe('splitMatches', () => {
  it('flags every case-insensitive match', () => {
    expect(splitMatches('The Self and the self', 'self')).toEqual([
      { text: 'The ', match: false },
      { text: 'Self', match: true },
      { text: ' and the ', match: false },
      { text: 'self', match: true },
    ]);
  });

  it('treats regex characters in the query literally', () => {
    expect(splitMatches('a (b) c', '(b)')).toEqual([
      { text: 'a ', match: false },
      { text: '(b)', match: true },
      { text: ' c', match: false },
    ]);
  });

  it('returns the whole text when the query is empty', () => {
    expect(splitMatches('text', '  ')).toEqual([{ text: 'text', match: false }]);
  });
});

describe('searchTerms', () => {
  it('splits words and keeps quoted phrases whole', () => {
    expect(searchTerms('Anima  "the  Mother" self anima')).toEqual(['anima', 'the mother', 'self']);
  });

  it('reads an unclosed quote to the end', () => {
    expect(searchTerms('"great mother')).toEqual(['great mother']);
  });
});

describe('matchesAll', () => {
  it('needs every term, in any order', () => {
    expect(matchesAll('The mother is the first anima figure', ['anima', 'mother'])).toBe(true);
    expect(matchesAll('The mother is the first anima figure', ['anima', 'shadow'])).toBe(false);
    expect(matchesAll('the anima and the mother', ['anima mother'])).toBe(false);
  });
});

describe('splitMatches with several terms', () => {
  it('highlights each word, and a phrase as one piece', () => {
    expect(splitMatches('The Great Mother and the anima', '"great mother" anima')).toEqual([
      { text: 'The ', match: false },
      { text: 'Great Mother', match: true },
      { text: ' and the ', match: false },
      { text: 'anima', match: true },
    ]);
  });
});

describe('matching case', () => {
  it('keeps Self and self apart when case must match', () => {
    const terms = searchTerms('Self', true);
    expect(terms).toEqual(['Self']);
    expect(matchesAll('the Self is the whole', terms, true)).toBe(true);
    expect(matchesAll('the ego and the self', terms, true)).toBe(false);
    expect(splitMatches('Self and self', 'Self', true)).toEqual([
      { text: 'Self', match: true },
      { text: ' and self', match: false },
    ]);
  });
});
