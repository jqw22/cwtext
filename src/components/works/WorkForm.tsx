import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';
import type { VolumeRow, WorkInput, WorkRow } from '@/lib/dbWorks';

const KINDS = ['essay', 'book', 'lecture', 'seminar', 'letter', 'foreword', 'review', 'interview'];

interface WorkFormProps {
  /** The work to edit; a new work when left out */
  work?: WorkRow;
  volumes: VolumeRow[];
  /** Texts the notes already carry, offered for the work's text */
  tags: string[];
  onSubmit: (work: WorkInput) => Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
}

type Fields = Record<Exclude<keyof WorkInput, 'id'>, string>;

function toFields(work?: WorkRow): Fields {
  const text = (value: string | number | null | undefined) => (value === null || value === undefined ? '' : String(value));
  return {
    title: text(work?.title),
    original_title: text(work?.original_title),
    original_language: text(work?.original_language ?? 'German'),
    kind: text(work?.kind ?? 'essay'),
    volume: text(work?.volume),
    para_from: text(work?.para_from),
    para_to: text(work?.para_to),
    year_written: text(work?.year_written),
    year_written_note: text(work?.year_written_note),
    year_first_published: text(work?.year_first_published),
    year_first_published_note: text(work?.year_first_published_note),
    first_published_in: text(work?.first_published_in),
    revisions: text(work?.revisions),
    notes: text(work?.notes),
    tag: text(work?.tag),
  };
}

/** A whole number, or null when blank. Anything else is caught by the input's pattern. */
function toInt(value: string): number | null {
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : null;
}

const orNull = (value: string) => value.trim() || null;

/** Add or edit one of Jung's works */
export function WorkForm({ work, volumes, tags, onSubmit, onCancel, isSubmitting }: WorkFormProps) {
  const [fields, setFields] = useState(() => toFields(work));
  const set = (key: keyof Fields) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setFields((prev) => ({ ...prev, [key]: e.target.value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      ...(work ? { id: work.id } : {}),
      title: fields.title.trim(),
      original_title: orNull(fields.original_title),
      original_language: orNull(fields.original_language),
      kind: fields.kind.trim().toLowerCase() || 'essay',
      volume: orNull(fields.volume),
      para_from: toInt(fields.para_from),
      para_to: toInt(fields.para_to),
      year_written: toInt(fields.year_written),
      year_written_note: orNull(fields.year_written_note),
      year_first_published: toInt(fields.year_first_published),
      year_first_published_note: orNull(fields.year_first_published_note),
      first_published_in: orNull(fields.first_published_in),
      revisions: orNull(fields.revisions),
      notes: fields.notes.trim(),
      tag: orNull(fields.tag.replace(/\s+/g, ' ').toLowerCase()),
    });
  };

  const number = { inputMode: 'numeric' as const, pattern: '\\d*' };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="work-title">Title (English)</Label>
          <Input id="work-title" value={fields.title} onChange={set('title')} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="work-original-title">Original title</Label>
          <Input id="work-original-title" value={fields.original_title} onChange={set('original_title')} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="work-language">Original language</Label>
          <Input id="work-language" value={fields.original_language} onChange={set('original_language')} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="work-kind">Kind</Label>
          <Input id="work-kind" value={fields.kind} onChange={set('kind')} list="work-kinds" />
          <datalist id="work-kinds">
            {KINDS.map((kind) => <option key={kind} value={kind} />)}
          </datalist>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="work-volume">Collected Works volume</Label>
          <select
            id="work-volume"
            value={fields.volume}
            onChange={set('volume')}
            className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
          >
            <option value="">Not in the Collected Works</option>
            {volumes.map((v) => (
              <option key={v.number} value={v.number}>CW {v.number}: {v.title}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="work-para-from">First paragraph</Label>
          <Input id="work-para-from" value={fields.para_from} onChange={set('para_from')} {...number} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="work-para-to">Last paragraph</Label>
          <Input id="work-para-to" value={fields.para_to} onChange={set('para_to')} {...number} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="work-year-written">Year written</Label>
          <Input id="work-year-written" value={fields.year_written} onChange={set('year_written')} {...number} />
          <Input
            aria-label="Note on when it was written"
            value={fields.year_written_note}
            onChange={set('year_written_note')}
            placeholder="e.g. begun 1909, finished 1911"
            className="text-xs"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="work-year-published">Year first published</Label>
          <Input id="work-year-published" value={fields.year_first_published} onChange={set('year_first_published')} {...number} />
          <Input
            aria-label="Note on first publication"
            value={fields.year_first_published_note}
            onChange={set('year_first_published_note')}
            placeholder="e.g. as a lecture, printed 1934"
            className="text-xs"
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="work-first-published-in">First published in</Label>
          <Input id="work-first-published-in" value={fields.first_published_in} onChange={set('first_published_in')} />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="work-revisions">Revisions</Label>
          <Input
            id="work-revisions"
            value={fields.revisions}
            onChange={set('revisions')}
            placeholder="e.g. 1952: revised as Symbole der Wandlung"
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="work-notes">Notes</Label>
          <Textarea id="work-notes" value={fields.notes} onChange={set('notes')} rows={3} />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="work-tag">Old text name <span className="font-normal text-muted-foreground">(optional, links notes saved before texts were chosen from this list)</span></Label>
          <Input id="work-tag" value={fields.tag} onChange={set('tag')} list="work-tags" placeholder="e.g. 11 - answer to job" />
          <datalist id="work-tags">
            {tags.map((tag) => <option key={tag} value={tag} />)}
          </datalist>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={isSubmitting || !fields.title.trim()}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {work ? 'Save' : 'Add work'}
        </Button>
      </div>
    </form>
  );
}
