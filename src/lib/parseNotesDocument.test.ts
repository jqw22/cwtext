import { describe, it, expect } from 'vitest';
import { zipSync, strToU8 } from 'fflate';
import { splitIntoNotes, docxParagraphs, noteContent } from './parseNotesDocument';

describe('splitIntoNotes', () => {
  it('starts a note at each para. number and collects footnotes', () => {
    const { notes, skipped } = splitIntoNotes([
      'Answer to Job',
      '574.9',
      'II',
      '575',
      'Since the Omniscient looks into all hearts, (1) it were better…',
      '(1) Zechariah 4 : 10 (AV).',
      '',
      '577',
      'The special providence…',
      '578 In spite of these precautions…',
      '(2) The 89th Psalm…',
    ]);

    expect(skipped).toEqual(['Answer to Job']);
    expect(notes.map((n) => [n.title, n.order])).toEqual([
      ['574.9', '574.9'],
      ['575', '575.0'],
      ['577', '577.0'],
      ['578', '578.0'],
    ]);
    expect(notes[0].body).toBe('II');
    expect(notes[1].footnotes).toEqual(['(1) Zechariah 4 : 10 (AV).']);
    expect(notes[3].body).toBe('In spite of these precautions…');
    expect(noteContent(notes[3], true)).toBe('In spite of these precautions…\n\n(2) The 89th Psalm…');
    expect(noteContent(notes[3], false)).toBe('In spite of these precautions…');
  });

  it('keeps a paragraph that merely starts with a far-off number as text', () => {
    const { notes } = splitIntoNotes(['575', 'First part.', '1914 was the year…']);
    expect(notes).toHaveLength(1);
    expect(notes[0].body).toBe('First part.\n\n1914 was the year…');
  });

  it('takes diary dates as labels, in date order, and keeps a first paragraph that starts with a marker', () => {
    const { notes } = splitIntoNotes([
      '0.9',
      'A huge task lay before me.',
      '281113',
      '(61) With inner resistance I approach this book.',
      '(61) Sunday.',
      '111213',
      '(75) After a hard struggle…',
    ]);

    expect(notes.map((n) => [n.title, n.order])).toEqual([
      ['0.9', '0.9'],
      ['281113', '131128.0'],
      ['111213', '131211.0'],
    ]);
    expect(notes[1].body).toBe('(61) With inner resistance I approach this book.');
    expect(notes[1].footnotes).toEqual(['(61) Sunday.']);
  });
});

describe('docxParagraphs', () => {
  it('reads paragraph text from a .docx', () => {
    const xml = `<?xml version="1.0"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>
<w:p><w:r><w:t>575</w:t></w:r></w:p>
<w:p><w:r><w:t xml:space="preserve">Since the </w:t></w:r><w:r><w:t>Omniscient</w:t></w:r><w:del><w:r><w:delText>gone</w:delText></w:r></w:del></w:p>
</w:body></w:document>`;
    const docx = zipSync({ 'word/document.xml': strToU8(xml) });
    expect(docxParagraphs(docx)).toEqual(['575', 'Since the Omniscient']);
  });
});
