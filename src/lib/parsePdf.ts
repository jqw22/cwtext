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
}

const PARA_MARK = /^\[(\d+)\]\s*/;

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

/** Group a page's items into lines, top to bottom. Small raised digits join the line they sit on. */
function pageLines(items: PdfItem[], body: number): Line[] {
  const isSmall = (it: PdfItem) => it.height > 0 && it.height < body * 0.8;
  const lines: Line[] = [];
  const main = items.filter((it) => !isSmall(it)).sort((a, b) => b.y - a.y || a.x - b.x);
  for (const item of main) {
    const line = lines.find((l) => Math.abs(l.y - item.y) < body * 0.4);
    if (line) line.items.push(item);
    else lines.push({ y: item.y, items: [item], x0: 0, x1: 0 });
  }
  for (const item of items.filter(isSmall)) {
    let best: Line | undefined;
    for (const line of lines) {
      if (!best || Math.abs(line.y - item.y) < Math.abs(best.y - item.y)) best = line;
    }
    if (best && Math.abs(best.y - item.y) < body) best.items.push(item);
    else lines.push({ y: item.y, items: [item], x0: 0, x1: 0 });
  }
  lines.sort((a, b) => b.y - a.y);
  for (const line of lines) {
    line.items.sort((a, b) => a.x - b.x);
    const text = line.items.filter((it) => it.str.trim());
    line.x0 = text.length ? text[0].x : 0;
    line.x1 = Math.max(0, ...text.map((it) => it.x + it.width));
  }
  return lines;
}

/** A line's text, with footnote markers written " (n)" */
function lineText(line: Line, body: number): string {
  let text = '';
  let prev: PdfItem | undefined;
  for (const item of line.items) {
    const small = item.height > 0 && item.height < body * 0.8;
    const str = item.str === PICTURE ? PICTURE_TEXT : item.str;
    if (small && /^\s*\d+\s*$/.test(str)) {
      text = `${text.trimEnd()} (${str.trim()}) `;
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

/**
 * Turn the text of a book-style PDF into notes: each paragraph starts with
 * its number in brackets ("[12]"), footnote markers are small raised
 * digits, and a heading before the first paragraph becomes the title.
 * Short lines end a paragraph within a note, and indented lines (verse)
 * are kept on their own.
 */
export function pdfToParagraphs(pages: PdfItem[][]): PdfParagraphs {
  const body = bodySize(pages);
  const warnings: string[] = [];
  const titleParts: string[] = [];
  /** [para number, paragraphs of text] */
  const notes: [string, string[]][] = [];
  let open = false; // whether the last paragraph of the current note can be continued

  const add = (text: string, ownParagraph: boolean) => {
    const parts = notes[notes.length - 1][1];
    if (open && !ownParagraph && parts.length) {
      const last = parts[parts.length - 1];
      parts[parts.length - 1] = /[-—]$/.test(last) ? last + text : `${last} ${text}`;
    } else {
      parts.push(text);
    }
  };

  for (const items of pages) {
    const lines = pageLines(items, body);
    const textLines = lines.filter((l) => l.items.some((it) => it.height >= body * 0.8 && it.str.trim()));
    if (textLines.length === 0) continue;
    const left = Math.min(...textLines.map((l) => l.x0));
    const right = Math.max(...textLines.map((l) => l.x1));
    const width = right - left;

    for (const line of lines) {
      let text = lineText(line, body);
      if (!text) continue;

      const mark = text.match(PARA_MARK);
      if (mark) {
        notes.push([mark[1], []]);
        open = false;
        text = text.slice(mark[0].length);
        if (!text) continue;
      } else if (notes.length === 0) {
        // Before the first paragraph: a large heading is the title, anything else is left out
        if (line.items.some((it) => it.height > body * 1.05)) {
          titleParts.push(text.replace(/\s*\(\d+\)$/, ''));
          const ref = text.match(/\((\d+)\)$/);
          if (ref) titleParts.push(`(${ref[1]})`);
        }
        continue;
      }

      const verse = !mark && line.x0 - left > width * 0.1;
      add(text, verse);
      // A line stopping well short of the margin ends its paragraph; verse lines stand alone
      open = !verse && right - line.x1 < width * 0.1;
    }
  }

  const paragraphs: string[] = [];
  if (titleParts.length && notes.length) {
    const first = Number(notes[0][0]);
    paragraphs.push((first - 0.1).toFixed(1), titleParts.join(' ').replace(/\s+\(/g, ' ('));
  }
  let expected = notes.length ? Number(notes[0][0]) : 0;
  for (const [label, parts] of notes) {
    if (Number(label) !== expected) warnings.push(`Para. ${expected} was expected but ${label} came next.`);
    expected = Number(label) + 1;
    paragraphs.push(label, ...parts);
    if (parts.some((p) => p.includes(PICTURE_TEXT))) {
      warnings.push(`Para. ${label} has a picture in place of some text, shown as ${PICTURE_TEXT}.`);
    }
  }

  // Footnote markers should run 1, 2, 3… through the text
  const refs = paragraphs.flatMap((p) => [...p.matchAll(/\((\d+)\)/g)].map((m) => Number(m[1])));
  refs.forEach((n, i) => {
    if (i > 0 && n !== refs[i - 1] + 1) warnings.push(`Footnote ${refs[i - 1]} is followed by ${n}.`);
  });

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
