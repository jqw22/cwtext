/** A run of text on a PDF page, or a picture (str is PICTURE) */
export interface PdfItem {
  str: string;
  /** Left edge and baseline, in points from the bottom-left of the page */
  x: number;
  y: number;
  width: number;
  /** Font size; 0 for spaces */
  height: number;
}

/** Stands in for a picture on the page, such as a Greek word printed as an image */
export const PICTURE = '￼';
/** What a picture becomes in the note text, so it can be found and typed in */
export const PICTURE_TEXT = '[?]';

export interface PdfParagraphs {
  /** In the layout splitIntoNotes reads: para. numbers on their own, then text, then "(1) " footnotes */
  paragraphs: string[];
  /** Things to check by hand */
  warnings: string[];
}

interface Line {
  y: number;
  items: PdfItem[];
  x0: number;
  x1: number;
  /** Size of the line's own text, leaving out footnote markers */
  size: number;
}

const PARA_MARK = /^\[(\d+)\]\s*/;
/** Footnote markers are kept as REF_OPEN n REF_CLOSE until the end, so a "(1)" in the text itself isn't taken for one */
const REF_OPEN = '\uE000';
const REF_CLOSE = '\uE001';
const REF = /\uE000(\d+)\uE001/g;

const isDigits = (it: PdfItem) => /^\s*\d+\s*$/.test(it.str);

/** The font size most of the text is in */
function bodySize(pages: PdfItem[][]): number {
  const counts = new Map<number, number>();
  for (const item of pages.flat()) {
    if (!item.height || item.str === PICTURE) continue;
    const size = Math.round(item.height * 2) / 2;
    counts.set(size, (counts.get(size) ?? 0) + item.str.length);
  }
  let best = 0;
  let most = -1;
  for (const [size, n] of counts) {
    if (n > most) {
      best = size;
      most = n;
    }
  }
  return best;
}

/** Group a page's items into lines, top to bottom. Raised digits join the line they sit on. */
function pageLines(items: PdfItem[], body: number): Line[] {
  const lines: Line[] = [];
  // Spaces are left out: words a gap apart are separated again in lineText
  const words = items.filter((it) => it.str.trim() && !isDigits(it)).sort((a, b) => b.y - a.y || a.x - b.x);
  for (const item of words) {
    const line = lines.find((l) => Math.abs(l.y - item.y) < body * 0.4);
    if (line) line.items.push(item);
    else lines.push({ y: item.y, items: [item], x0: 0, x1: 0, size: 0 });
  }
  for (const item of items.filter(isDigits)) {
    let best: Line | undefined;
    for (const line of lines) {
      if (!best || Math.abs(line.y - item.y) < Math.abs(best.y - item.y)) best = line;
    }
    if (best && Math.abs(best.y - item.y) < body * 0.7) best.items.push(item);
    else lines.push({ y: item.y, items: [item], x0: 0, x1: 0, size: 0 });
  }
  lines.sort((a, b) => b.y - a.y);
  for (const line of lines) {
    line.items.sort((a, b) => a.x - b.x);
    const text = line.items.filter((it) => it.str.trim());
    line.x0 = text.length ? text[0].x : 0;
    line.x1 = Math.max(0, ...text.map((it) => it.x + it.width));
    line.size = Math.max(0, ...line.items.filter((it) => !isDigits(it) && it.str !== PICTURE).map((it) => it.height));
    if (!line.size) line.size = Math.max(0, ...line.items.map((it) => it.height));
    // The baseline of the line's main text, below any raised marker
    line.y = line.items.find((it) => it.height === line.size)?.y ?? line.y;
  }
  return lines;
}

/** Whether an item is a footnote marker: digits smaller than the line's text and raised above it */
const isRef = (item: PdfItem, line: Line) =>
  isDigits(item) && item.height < line.size * 0.85 && item.y > line.y + line.size * 0.1;

/** A line's text, with footnote markers kept as REF_OPEN n REF_CLOSE */
function lineText(line: Line, body: number): string {
  let text = '';
  let prev: PdfItem | undefined;
  for (const item of line.items) {
    const str = item.str === PICTURE ? PICTURE_TEXT : item.str;
    if (isRef(item, line)) {
      text = `${text.trimEnd()} ${REF_OPEN}${str.trim()}${REF_CLOSE} `;
    } else {
      // Items a visible gap apart are separate words even with no space between them
      const gap = prev && item.x - (prev.x + prev.width) > body * 0.15;
      if (gap && text && !/\s$/.test(text) && !/^\s/.test(str)) text += ' ';
      text += str;
    }
    prev = item;
  }
  return text.replace(/\s+/g, ' ').trim();
}

/** Add a line to a paragraph, joining words split across lines with a dash */
const joinLine = (last: string, text: string) => (/[-—]$/.test(last) ? last + text : `${last} ${text}`);

/**
 * Turn the text of a book-style PDF into notes: each paragraph starts with
 * its number in brackets ("[12]"), footnote markers are small raised
 * digits, and a heading before the first paragraph becomes the title.
 * A heading between paragraphs (e.g. "1. Definition") becomes a note of
 * its own numbered just before the next paragraph ("87.9"). Short lines
 * end a paragraph within a note, and indented lines (verse) are kept on
 * their own. Notes printed in smaller type, each starting with its number
 * ("1 [Originally given…"), go under the paragraph that refers to them.
 */
export function pdfToParagraphs(pages: PdfItem[][]): PdfParagraphs {
  const body = bodySize(pages);
  const warnings: string[] = [];
  const titleParts: string[] = [];
  /** [para number, paragraphs of text]; a heading's number is left blank until the next para. */
  const notes: [string, string[]][] = [];
  const footnotes = new Map<number, string>();
  let lastFootnote = 0;
  let inFootnotes = false;
  let open = false; // whether the last paragraph of the current note can be continued

  const add = (text: string, ownParagraph: boolean) => {
    const parts = notes[notes.length - 1][1];
    if (open && !ownParagraph && parts.length) parts[parts.length - 1] = joinLine(parts[parts.length - 1], text);
    else parts.push(text);
  };

  // The usual gap between lines, to tell headings (set apart by extra space) from verse
  const gaps: number[] = [];
  const pageLineSets = pages.map((items) => pageLines(items, body));
  for (const lines of pageLineSets) {
    for (let i = 1; i < lines.length; i++) gaps.push(lines[i - 1].y - lines[i].y);
  }
  gaps.sort((a, b) => a - b);
  const lineGap = gaps.length ? gaps[Math.floor(gaps.length / 2)] : body * 1.3;

  for (const lines of pageLineSets) {
    let textLines = lines.filter((l) => Math.abs(l.size - body) < body * 0.1);
    if (textLines.length === 0) textLines = lines;
    if (textLines.length === 0) continue;
    const left = Math.min(...textLines.map((l) => l.x0));
    const right = Math.max(...textLines.map((l) => l.x1));
    const width = right - left;

    lines.forEach((line, i) => {
      let text = lineText(line, body);
      if (!text) return;

      // Notes in smaller type, numbered from 1, once the paragraphs have started
      const numbered = text.match(/^(\d+)\s+(\S.*)$/);
      const smaller = line.size < body * 0.9;
      if (notes.length && smaller && numbered && Number(numbered[1]) === lastFootnote + 1 && (inFootnotes || lastFootnote === 0)) {
        inFootnotes = true;
        lastFootnote++;
        footnotes.set(lastFootnote, numbered[2]);
        return;
      }
      if (inFootnotes) {
        if (smaller) footnotes.set(lastFootnote, joinLine(footnotes.get(lastFootnote) ?? '', text));
        return;
      }

      const mark = text.match(PARA_MARK);
      if (mark) {
        if (notes.length && notes[notes.length - 1][0] === '') {
          // The heading just before takes its number from this paragraph
          notes[notes.length - 1][0] = (Number(mark[1]) - 0.1).toFixed(1);
        }
        notes.push([mark[1], []]);
        open = false;
        text = text.slice(mark[0].length);
        if (!text) return;
      } else if (notes.length === 0) {
        // Before the first paragraph: a large heading is the title, anything else is left out
        if (line.size > body * 1.05) titleParts.push(text);
        return;
      }

      if (!mark) {
        const above = i > 0 ? lines[i - 1].y - line.y : Infinity;
        const below = i < lines.length - 1 ? line.y - lines[i + 1].y : Infinity;
        const indent = line.x0 - left;
        const centred = indent > width * 0.02 && Math.abs(indent - (right - line.x1)) < width * 0.1;
        if (centred && above > lineGap * 1.4 && below > lineGap * 1.4) {
          notes.push(['', [text]]);
          open = false;
          return;
        }
      }

      const verse = !mark && line.x0 - left > width * 0.1;
      add(text, verse);
      // A line stopping well short of the margin ends its paragraph; verse lines stand alone
      open = !verse && right - line.x1 < width * 0.1;
    });
  }

  const blocks: [string, string[]][] = [];
  if (titleParts.length && notes.length) {
    blocks.push([(Number(notes[0][0] || notes[1]?.[0]) - 0.1).toFixed(1), [titleParts.join(' ')]]);
  }
  let expected = 0;
  for (const [label, parts] of notes) {
    if (!label) {
      warnings.push(`A heading after the last paragraph was left out: "${parts[0]}".`);
      continue;
    }
    if (!label.includes('.')) {
      if (expected && Number(label) !== expected) warnings.push(`Para. ${expected} was expected but ${label} came next.`);
      expected = Number(label) + 1;
    }
    blocks.push([label, parts]);
    if (parts.some((p) => p.includes(PICTURE_TEXT))) {
      warnings.push(`Para. ${label} has a picture in place of some text, shown as ${PICTURE_TEXT}.`);
    }
  }

  // Footnote markers should run 1, 2, 3… through the text, each with its note if the PDF has them
  const refs = blocks.flatMap(([, parts]) => parts.flatMap((p) => [...p.matchAll(REF)].map((m) => Number(m[1]))));
  refs.forEach((n, i) => {
    if (i > 0 && n !== refs[i - 1] + 1) warnings.push(`Footnote ${refs[i - 1]} is followed by ${n}.`);
    if (footnotes.size && !footnotes.has(n)) warnings.push(`Footnote ${n} has no note text.`);
  });
  for (const n of footnotes.keys()) {
    if (!refs.includes(n)) warnings.push(`Note ${n} has no marker in the text and was left out.`);
  }

  const paragraphs: string[] = [];
  for (const [label, parts] of blocks) {
    const text = parts.map((p) => p.replace(REF, '($1)'));
    const own = parts.flatMap((p) => [...p.matchAll(REF)].map((m) => Number(m[1])));
    const notesHere = own.filter((n) => footnotes.has(n)).map((n) => `(${n}) ${footnotes.get(n)}`);
    paragraphs.push(label, ...text, ...notesHere);
  }

  return { paragraphs, warnings };
}

/**
 * Read a PDF's text items page by page, with pictures as PICTURE items.
 * pdf.js is loaded only when a PDF is chosen.
 */
export async function readPdfItems(data: Uint8Array): Promise<PdfItem[][]> {
  const pdfjs = await import('pdfjs-dist');
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  }
  const doc = await pdfjs.getDocument({ data }).promise;
  const pages: PdfItem[][] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    pages.push(await pageItems(await doc.getPage(n), pdfjs.OPS));
  }
  return pages;
}

interface PdfPage {
  getTextContent: () => Promise<{ items: object[] }>;
  getOperatorList: () => Promise<{ fnArray: number[]; argsArray: unknown[] }>;
}

/** One page's text items and pictures */
export async function pageItems(page: PdfPage, OPS: Record<string, number>): Promise<PdfItem[]> {
  const content = await page.getTextContent();
  const items: PdfItem[] = [];
  for (const item of content.items as { str?: string; transform: number[]; width: number; height: number }[]) {
    if (item.str === undefined) continue;
    items.push({ str: item.str, x: item.transform[4], y: item.transform[5], width: item.width, height: item.height });
  }
  items.push(...(await pagePictures(page, OPS)));
  return items;
}

type Matrix = [number, number, number, number, number, number];

function multiply(m: Matrix, n: Matrix): Matrix {
  return [
    m[0] * n[0] + m[2] * n[1],
    m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4],
    m[1] * n[4] + m[3] * n[5] + m[5],
  ];
}

/** Where each picture is drawn on a page, worked out from the page's drawing steps */
async function pagePictures(
  page: PdfPage,
  OPS: Record<string, number>,
): Promise<PdfItem[]> {
  const { fnArray, argsArray } = await page.getOperatorList();
  const pictures: PdfItem[] = [];
  let ctm: Matrix = [1, 0, 0, 1, 0, 0];
  const stack: Matrix[] = [];
  fnArray.forEach((fn, i) => {
    if (fn === OPS.save) stack.push(ctm);
    else if (fn === OPS.restore) ctm = stack.pop() ?? ctm;
    else if (fn === OPS.transform) ctm = multiply(ctm, argsArray[i] as Matrix);
    else if (fn === OPS.paintImageXObject || fn === OPS.paintInlineImageXObject || fn === OPS.paintImageMaskXObject) {
      const [a, , , d, x, y] = ctm;
      // Only pictures about the size of a line of text stand in for words
      if (Math.abs(d) < 40) pictures.push({ str: PICTURE, x, y, width: Math.abs(a), height: Math.abs(d) });
    }
  });
  return pictures;
}
