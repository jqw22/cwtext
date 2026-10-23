import { describe, it, expect } from 'vitest';
import { splitMatches } from './highlight';

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
