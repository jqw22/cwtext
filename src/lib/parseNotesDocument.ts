import { unzipSync, strFromU8 } from 'fflate';

/** One note found in an imported document */
export interface ImportedNote {
  /** Para. label, e.g. "575" or "574.9" */
  title: string;
  /** Numeric order to 1dp, e.g. "575.0" */
  order: string;
  /** The paragraph text */
  body: string;
  /** Footnotes that follow the paragraph, e.g. "(1) Job 38 : 2 (ZB)." */
  footnotes: string[];
}

export interface ParsedDocument {
  notes: ImportedNote[];
  /** Paragraphs that came before the first para. number and were left out */
  skipped: string[];
  /** Things to check by hand before saving */
  warnings?: string[];
}

const LABEL = /^\d+(?:\.\d+)?$/;
const LABEL_WITH_TEXT = /^(\d+(?:\.\d+)?)\s+(\S[\s\S]*)$/;
const FOOTNOTE = /^\(\d+\)\s/;

/** How far ahead of the last para. number a number at the start of a paragraph may be and still count as a label */
const MAX_INLINE_GAP = 10;

/**
 * Split a document's paragraphs into notes. A paragraph that is just a
 * number ("575", "574.9") starts a new note; so does a paragraph that
 * starts with the next para. number ("578 In spite of…"). Paragraphs
 * beginning "(1) " are footnotes of the current note, and anything else
 * is more text for it.
 */
export function splitIntoNotes(paragraphs: string[]): ParsedDocument {
  const notes: ImportedNote[] = [];
  const skipped: string[] = [];
  let current: ImportedNote | undefined;
  let bodyParts: string[] = [];

  const finish = () => {
    if (current) {
      current.body = bodyParts.join('\n\n');
      notes.push(current);
    }
    bodyParts = [];
  };

  const start = (label: string) => {
    finish();
    current = { title: label, order: Number(label).toFixed(1), body: '', footnotes: [] };
  };

  for (const raw of paragraphs) {
    const text = raw.replace(/\s+/g, ' ').trim();
    if (!text) continue;

    if (LABEL.test(text)) {
      start(text);
      continue;
    }

    const inline = text.match(LABEL_WITH_TEXT);
    if (inline) {
      const n = Number(inline[1]);
      const last = current ? Number(current.title) : undefined;
      if (last === undefined || (n > last && n <= last + MAX_INLINE_GAP)) {
        start(inline[1]);
        bodyParts.push(inline[2]);
        continue;
      }
    }

    if (!current) {
      skipped.push(text);
    } else if (FOOTNOTE.test(text)) {
      current.footnotes.push(text);
    } else {
      bodyParts.push(text);
    }
  }
  finish();

  return { notes, skipped };
}

/** The text of each paragraph in a .docx file */
export function docxParagraphs(data: Uint8Array): string[] {
  const files = unzipSync(data, { filter: (f) => f.name === 'word/document.xml' });
  const xml = files['word/document.xml'];
  if (!xml) throw new Error('This does not look like a Word document.');

  const doc = new DOMParser().parseFromString(strFromU8(xml), 'application/xml');
  const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const body = doc.getElementsByTagNameNS(W, 'body')[0];
  if (!body) throw new Error('Could not read the Word document.');

  const paragraphs: string[] = [];
  for (const p of Array.from(body.getElementsByTagNameNS(W, 'p'))) {
    let text = '';
    const walk = (node: Element) => {
      for (const child of Array.from(node.children)) {
        if (child.namespaceURI === W) {
          if (child.localName === 't') text += child.textContent ?? '';
          else if (child.localName === 'tab') text += ' ';
          else if (child.localName === 'br' || child.localName === 'cr') text += '\n';
          // Deleted text from tracked changes isn't part of the document
          else if (child.localName === 'del') continue;
        }
        walk(child);
      }
    };
    walk(p);
    paragraphs.push(text);
  }
  return paragraphs;
}

/** The note's content, with its footnotes after the paragraph if wanted */
export function noteContent(note: ImportedNote, includeFootnotes: boolean): string {
  if (!includeFootnotes || note.footnotes.length === 0) return note.body;
  return `${note.body}\n\n${note.footnotes.join('\n')}`;
}

/** Read a .pdf, .docx or plain-text file and split it into notes */
export async function parseNotesFile(file: File): Promise<ParsedDocument> {
  if (/\.pdf$/i.test(file.name)) {
    const { readPdfItems, pdfToParagraphs } = await import('./parsePdf');
    const { paragraphs, warnings } = pdfToParagraphs(await readPdfItems(new Uint8Array(await file.arrayBuffer())));
    return { ...splitIntoNotes(paragraphs), warnings };
  }
  if (/\.docx$/i.test(file.name)) {
    return splitIntoNotes(docxParagraphs(new Uint8Array(await file.arrayBuffer())));
  }
  return splitIntoNotes((await file.text()).split(/\r?\n/));
}
