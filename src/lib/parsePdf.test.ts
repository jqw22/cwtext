import { describe, it, expect } from 'vitest';
import { pdfToParagraphs, PICTURE, type PdfItem } from './parsePdf';

/** A line of body text at the given height on the page */
const line = (str: string, y: number, x = 92, width = 440): PdfItem => ({ str, x, y, width, height: 15 });

describe('pdfToParagraphs', () => {
  it('reads para. numbers, footnote markers, the title and verse', () => {
    const page: PdfItem[] = [
      { str: 'ARCHETYPES OF THE COLLECTIVE UNCONSCIOUS', x: 100, y: 700, width: 400, height: 17 },
      { str: '1', x: 504, y: 706, width: 6, height: 11 },
      { str: '[1]', x: 81, y: 650, width: 13, height: 11 },
      line('The hypothesis of a collective unconscious belongs to the', 649, 125, 407),
      line('class of ideas that people at first find strange.', 630, 92, 300),
      { str: '[2]', x: 81, y: 600, width: 13, height: 11 },
      line('For Freud the unconscious is of an exclusively personal', 599, 125, 407),
      line('nature,', 580, 92, 40),
      { str: '2 ', x: 133, y: 585, width: 9, height: 8.7 },
      line('although he was aware of its archaic thought-', 580, 142, 390),
      line('forms. In the words of the Völuspa we may ask:', 561, 92, 300),
      line('What murmurs Wotan over Mimir’s head?', 542, 250, 250),
      line('Already the spring boils …', 523, 250, 170),
      { str: '[3]', x: 81, y: 500, width: 13, height: 11 },
      line('“Archetype” is a paraphrase of the Platonic', 499, 125, 300),
      { str: PICTURE, x: 430, y: 497, width: 26, height: 12 },
      line('.', 499, 456, 4),
    ];

    const { paragraphs, warnings } = pdfToParagraphs([page]);

    expect(paragraphs).toEqual([
      '0.9',
      'ARCHETYPES OF THE COLLECTIVE UNCONSCIOUS (1)',
      '1',
      'The hypothesis of a collective unconscious belongs to the class of ideas that people at first find strange.',
      '2',
      'For Freud the unconscious is of an exclusively personal nature, (2) although he was aware of its archaic thought-forms. In the words of the Völuspa we may ask:',
      'What murmurs Wotan over Mimir’s head?',
      'Already the spring boils …',
      '3',
      '“Archetype” is a paraphrase of the Platonic [?].',
    ]);
    expect(warnings).toEqual(['Para. 3 has a picture in place of some text, shown as [?].']);
  });

  it('continues a paragraph onto the next page and warns of a missing para. number', () => {
    const page1 = [{ str: '[7]', x: 81, y: 120, width: 13, height: 11 }, line('Primitive man impresses us so strongly with his', 119, 125, 407)];
    const page2 = [line('subjectivity that we should have guessed.', 700, 92, 300), { str: '[9]', x: 81, y: 670, width: 13, height: 11 }, line('Next.', 669, 125, 40)];

    const { paragraphs, warnings } = pdfToParagraphs([page1, page2]);

    expect(paragraphs).toEqual(['7', 'Primitive man impresses us so strongly with his subjectivity that we should have guessed.', '9', 'Next.']);
    expect(warnings).toEqual(['Para. 8 was expected but 9 came next.']);
  });

  it('numbers headings between paragraphs and puts notes from the end under their paragraphs', () => {
    const marker = (n: number, y: number): PdfItem => ({ str: `[${n}]`, x: 81, y, width: 18, height: 11 });
    const text: PdfItem[] = [
      { str: 'THE CONCEPT OF THE COLLECTIVE UNCONSCIOUS', x: 188, y: 700, width: 230, height: 17 },
      { str: '1', x: 418, y: 706, width: 6, height: 11 },
      marker(87, 650),
      line('In what follows I shall try to give (1) a definition and', 649, 135, 400),
      line('(2) an example.', 630, 92, 100),
      line('1. Definition', 595, 266, 80),
      marker(88, 560),
      line('The collective unconscious is a part of the psyche which', 559, 133, 402),
      line('is not personal.', 540, 92, 100),
      { str: '2', x: 192, y: 545, width: 4, height: 8.7 },
    ];
    const notesPage: PdfItem[] = [
      { str: '1 [Originally given as a lecture in London, and later', x: 77, y: 700, width: 457, height: 11.3 },
      { str: 'revised.—E', x: 77, y: 680, width: 60, height: 11.3 },
      { str: 'DITORS', x: 137, y: 680, width: 40, height: 8.7 },
      { str: '.]', x: 177, y: 680, width: 6, height: 11.3 },
      { str: '2 Psychology and Alchemy.', x: 77, y: 660, width: 200, height: 11.3 },
    ];

    const { paragraphs, warnings } = pdfToParagraphs([text, notesPage]);

    expect(paragraphs).toEqual([
      '86.9',
      'THE CONCEPT OF THE COLLECTIVE UNCONSCIOUS (1)',
      '(1) [Originally given as a lecture in London, and later revised.—EDITORS.]',
      '87',
      'In what follows I shall try to give (1) a definition and (2) an example.',
      '87.9',
      '1. Definition',
      '88',
      'The collective unconscious is a part of the psyche which is not personal. (2)',
      '(2) Psychology and Alchemy.',
    ]);
    expect(warnings).toEqual([]);
  });
});
