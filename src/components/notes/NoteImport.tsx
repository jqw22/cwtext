import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Upload } from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import { useSaveNote, type StructuredNote } from '@/hooks/useStructuredNotes';
import { WorkSelect } from '@/components/works/WorkSelect';
import type { VolumeRow, WorkRow } from '@/lib/dbWorks';
import { parseNotesFile, noteContent, type ParsedDocument } from '@/lib/parseNotesDocument';

interface NoteImportProps {
  /** Notes already saved, so ones with the same para. and text are skipped */
  existingNotes: StructuredNote[];
  volumes: VolumeRow[];
  works: WorkRow[];
  /** A note's work id (see workOfNote) */
  workOf: (note: StructuredNote) => string | null;
  /** The text chosen to start with */
  initialWorkId?: string;
  onClose: () => void;
}

/** Save many notes at once from a Word or plain-text document */
export function NoteImport({ existingNotes, volumes, works, workOf, initialWorkId = '', onClose }: NoteImportProps) {
  const { toast } = useToast();
  const { mutateAsync: saveNote } = useSaveNote();
  const [fileName, setFileName] = useState('');
  const [parsed, setParsed] = useState<ParsedDocument>();
  const [workId, setWorkId] = useState(initialWorkId);
  const [includeFootnotes, setIncludeFootnotes] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [done, setDone] = useState(0);
  // Paras saved in this session, before the note list has caught up
  const [published, setPublished] = useState<Set<string>>(new Set());

  const work = works.find((w) => w.id === workId);

  // Paras already saved under this text
  const existingTitles = useMemo(() => {
    const titles = new Set<string>();
    for (const note of existingNotes) {
      if (workId && workOf(note) === workId) titles.add(note.title);
    }
    for (const key of published) {
      const [id, title] = key.split('\n');
      if (id === workId) titles.add(title);
    }
    return titles;
  }, [existingNotes, published, workId, workOf]);

  const notes = parsed?.notes ?? [];
  const toPublish = notes.filter((n) => !existingTitles.has(n.title));

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const result = await parseNotesFile(file);
      setFileName(file.name);
      setParsed(result);
      setDone(0);
      if (result.notes.length === 0) {
        toast({ title: 'No notes found', description: 'Each note should start with its para. number on its own line.', variant: 'destructive' });
      }
    } catch (err) {
      toast({ title: 'Could not read the file', description: err instanceof Error ? err.message : 'An error occurred.', variant: 'destructive' });
    }
  };

  const handlePublish = async () => {
    if (!work) {
      toast({ title: 'Text required', description: 'Choose the text these notes belong to.', variant: 'destructive' });
      return;
    }
    setPublishing(true);
    setDone(0);
    let count = 0;
    try {
      // One at a time, so a failure stops the run and the rest can be retried
      for (const note of toPublish) {
        await saveNote({
          title: note.title,
          content: noteContent(note, includeFootnotes),
          tags: work.tag ? [work.tag] : [],
          workId: work.id,
          order: note.order,
        });
        count++;
        setDone(count);
        setPublished((prev) => new Set(prev).add(`${work.id}\n${note.title}`));
      }
      toast({ title: 'Notes saved', description: `${count} note${count !== 1 ? 's' : ''} saved under "${work.title}".` });
    } catch (err) {
      toast({
        title: `Stopped after ${count} note${count !== 1 ? 's' : ''}`,
        description: `${err instanceof Error ? err.message : 'An error occurred.'} Press Save again to carry on.`,
        variant: 'destructive',
      });
    } finally {
      setPublishing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Import Notes</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Choose a PDF of the text, with each paragraph numbered "[1]", "[2]"… in the margin and any
          notes at the end (each note goes under the paragraph that refers to it), or a
          Word (.docx) or text file in which each note starts with its para. number on its own line,
          followed by the paragraph and any footnotes beginning "(1)", "(2)"…
        </p>

        {/* File */}
        <div className="flex items-center gap-3">
          <Button asChild variant="outline" disabled={publishing}>
            <label className="cursor-pointer">
              <Upload className="mr-2 h-4 w-4" />
              Choose file
              <input
                type="file"
                accept=".pdf,.docx,.txt,application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                className="sr-only"
                disabled={publishing}
                onChange={(e) => {
                  handleFile(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
            </label>
          </Button>
          {fileName && <span className="text-sm text-muted-foreground truncate">{fileName}</span>}
        </div>

        {/* Text */}
        <div className="space-y-2">
          <label htmlFor="import-text" className="text-sm font-medium">Text</label>
          <WorkSelect
            id="import-text"
            volumes={volumes}
            works={works}
            value={workId}
            onChange={setWorkId}
            disabled={publishing}
          />
        </div>

        {/* Footnotes */}
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={includeFootnotes}
            onCheckedChange={(v) => setIncludeFootnotes(v === true)}
            disabled={publishing}
          />
          Add footnotes to the end of their paragraph
        </label>

        {/* Preview */}
        {notes.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              {notes.length} note{notes.length !== 1 ? 's' : ''} found
              {notes.length !== toPublish.length && `, ${notes.length - toPublish.length} already saved under this text and will be skipped`}
              {parsed && parsed.skipped.length > 0 && `. ${parsed.skipped.length} line${parsed.skipped.length !== 1 ? 's' : ''} before the first para. number left out`}
              .
            </p>
            {parsed?.warnings && parsed.warnings.length > 0 && (
              <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 text-sm space-y-1">
                <p className="font-medium">Check before saving</p>
                <ul className="list-disc pl-5 text-muted-foreground">
                  {parsed.warnings.map((w) => <li key={w}>{w}</li>)}
                </ul>
              </div>
            )}
            <div className="max-h-96 overflow-y-auto rounded-lg border divide-y">
              {notes.map((note) => {
                const skip = existingTitles.has(note.title);
                return (
                  <div key={note.title} className={`flex gap-4 p-3 ${skip ? 'opacity-40' : ''}`}>
                    <span className="w-12 shrink-0 text-right text-sm font-bold text-muted-foreground tabular-nums">
                      {note.title}
                    </span>
                    <p className="text-sm text-foreground/80 whitespace-pre-line line-clamp-4">
                      {noteContent(note, includeFootnotes)}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {publishing && <Progress value={(done / Math.max(toPublish.length, 1)) * 100} />}

        {/* Actions */}
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onClose} disabled={publishing}>
            Close
          </Button>
          <Button onClick={handlePublish} disabled={publishing || toPublish.length === 0}>
            {publishing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {publishing
              ? `Saving ${done + 1} of ${toPublish.length}…`
              : `Save ${toPublish.length} note${toPublish.length !== 1 ? 's' : ''}`}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
