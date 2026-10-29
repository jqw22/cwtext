import { splitMatches } from '@/lib/highlight';

/** A reader's margin note (a row of `annotations`, see supabase/annotations.sql) */
export interface Annotation {
  id: string;
  note_slug: string;
  /** The words the note marks; empty for a note on the whole paragraph */
  quote: string;
  start_offset: number | null;
  end_offset: number | null;
  body: string;
  created_at: string;
  updated_at: string;
}

/** The words a new note will mark, by character position in the paragraph */
export interface NoteRange {
  start: number;
  end: number;
  quote: string;
}

/**
 * Where a note's words are in the paragraph now. The stored positions are
 * used while they still hold the quoted words; after the paragraph is edited
 * the words are looked for again. A whole-paragraph note, or words that are
 * gone, give null.
 */
export function locate(annotation: Pick<Annotation, 'quote' | 'start_offset' | 'end_offset'>, text: string): NoteRange | null {
  const { quote, start_offset: start, end_offset: end } = annotation;
  if (!quote || start === null || end === null) return null;
  if (text.slice(start, end) === quote) return { start, end, quote };
  const found = text.indexOf(quote);
  return found >= 0 ? { start: found, end: found + quote.length, quote } : null;
}

/** A run of text that is all a search match or not, and all marked by notes or not */
export interface Segment {
  text: string;
  match: boolean;
  noted: boolean;
}

/** Split `text` by both the search highlight and the words marked by notes */
export function segments(text: string, query: string, matchCase: boolean, ranges: NoteRange[]): Segment[] {
  const match = new Array<boolean>(text.length).fill(false);
  let at = 0;
  for (const part of splitMatches(text, query, matchCase)) {
    if (part.match) match.fill(true, at, at + part.text.length);
    at += part.text.length;
  }
  const noted = new Array<boolean>(text.length).fill(false);
  for (const r of ranges) noted.fill(true, r.start, r.end);

  const out: Segment[] = [];
  for (let i = 0; i < text.length; i++) {
    const last = out[out.length - 1];
    if (last && last.match === match[i] && last.noted === noted[i]) last.text += text[i];
    else out.push({ text: text[i], match: match[i], noted: noted[i] });
  }
  return out;
}

/** The selected words inside `container`, by character position in its text, or null */
export function selectionIn(container: HTMLElement): NoteRange | null {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  if (!container.contains(range.startContainer) || !container.contains(range.endContainer)) return null;

  const before = document.createRange();
  before.selectNodeContents(container);
  before.setEnd(range.startContainer, range.startOffset);
  let start = before.toString().length;
  let end = start + range.toString().length;

  // Leave out spaces caught at either edge of the selection
  const text = container.textContent ?? '';
  while (start < end && /\s/.test(text[start])) start++;
  while (end > start && /\s/.test(text[end - 1])) end--;
  if (start === end) return null;
  return { start, end, quote: text.slice(start, end) };
}
