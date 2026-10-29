import { describe, it, expect } from 'vitest';
import { locate, segments } from './annotations';

const text = 'The shadow is the dark side of the personality.';

describe('locate', () => {
  it('uses the stored place while it still holds the words', () => {
    expect(locate({ quote: 'shadow', start_offset: 4, end_offset: 10 }, text)).toEqual({ start: 4, end: 10, quote: 'shadow' });
  });

  it('finds the words again after the paragraph changed', () => {
    expect(locate({ quote: 'dark side', start_offset: 0, end_offset: 9 }, text)).toEqual({ start: 18, end: 27, quote: 'dark side' });
  });

  it('gives null for a whole-paragraph note or words that are gone', () => {
    expect(locate({ quote: '', start_offset: null, end_offset: null }, text)).toBeNull();
    expect(locate({ quote: 'anima', start_offset: 0, end_offset: 5 }, text)).toBeNull();
  });
});

describe('segments', () => {
  it('combines search matches with noted words', () => {
    expect(segments(text, 'dark', false, [{ start: 18, end: 27, quote: 'dark side' }])).toEqual([
      { text: 'The shadow is the ', match: false, noted: false },
      { text: 'dark', match: true, noted: true },
      { text: ' side', match: false, noted: true },
      { text: ' of the personality.', match: false, noted: false },
    ]);
  });

  it('gives the plain text as one part when nothing is marked', () => {
    expect(segments('abc', '', false, [])).toEqual([{ text: 'abc', match: false, noted: false }]);
  });
});
