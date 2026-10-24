import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Upload } from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import { usePublishNote, normalizeTag, type StructuredNote } from '@/hooks/useStructuredNotes';
import { parseNotesFile, noteContent, type ParsedDocument } from '@/lib/parseNotesDocument';

interface NoteImportProps {
  /** Notes already published, so ones with the same para. and text are skipped */
  existingNotes: StructuredNote[];
  /** Existing texts from all notes, with counts — shown as suggestions */
  availableTags?: Map<string, number>;
  onClose: () => void;
}

/** Publish many notes at once from a Word or plain-text document */
export function NoteImport({ existingNotes, availableTags, onClose }: NoteImportProps) {
  const { toast } = useToast();
  const { mutateAsync: publishNote } = usePublishNote();
  const [fileName, setFileName] = useState('');
  const [parsed, setParsed] = useState<ParsedDocument>();
  const [text, setText] = useState('');
  const [includeFootnotes, setIncludeFootnotes] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [done, setDone] = useState(0);
  // Paras published in this session, before the note list has caught up
  const [published, setPublished] = useState<Set<string>>(new Set());

  const tag = normalizeTag(text);

  // Paras already published under this text
  const existingTitles = useMemo(() => {
    const titles = new Set<string>();
    for (const note of existingNotes) {
      if (note.tags.includes(tag)) titles.add(note.title);
    }
    for (const key of published) {
      const [t, title] = key.split('\n');
      if (t === tag) titles.add(title);
    }
    return titles;
  }, [existingNotes, published, tag]);

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
    if (!tag) {
      toast({ title: 'Text required', description: 'Enter the text these notes belong to.', variant: 'destructive' });
      return;
    }
    setPublishing(true);
    setDone(0);
    let count = 0;
    try {
      // One at a time, so a failure stops the run and the rest can be retried
      for (const note of toPublish) {
        await publishNote({
          title: note.title,
          content: noteContent(note, includeFootnotes),
          tags: [tag],
          order: note.order,
        });
        count++;
        setDone(count);
        setPublished((prev) => new Set(prev).add(`${tag}\n${note.title}`));
      }
      toast({ title: 'Notes published!', description: `${count} note${count !== 1 ? 's' : ''} published under "${tag}".` });
    } catch (err) {
      toast({
        title: `Stopped after ${count} note${count !== 1 ? 's' : ''}`,
        description: `${err instanceof Error ? err.message : 'An error occurred.'} Press Publish again to carry on.`,
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
          Choose a Word (.docx) or text file. Each note starts with its para. number on its own line,
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
                accept=".docx,.txt,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
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
          <Input
            id="import-text"
            list="import-text-options"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="e.g. 09.1 - the psychological aspects of the kore"
            disabled={publishing}
          />
          <datalist id="import-text-options">
            {[...(availableTags?.keys() ?? [])].sort().map((t) => <option key={t} value={t} />)}
          </datalist>
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
              {notes.length !== toPublish.length && `, ${notes.length - toPublish.length} already published under this text and will be skipped`}
              {parsed && parsed.skipped.length > 0 && `. ${parsed.skipped.length} line${parsed.skipped.length !== 1 ? 's' : ''} before the first para. number left out`}
              .
            </p>
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
              ? `Publishing ${done + 1} of ${toPublish.length}…`
              : `Publish ${toPublish.length} note${toPublish.length !== 1 ? 's' : ''}`}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
