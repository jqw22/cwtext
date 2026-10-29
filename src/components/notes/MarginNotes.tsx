import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useAnnotationActions } from '@/hooks/useAnnotations';
import { useToast } from '@/hooks/useToast';
import type { Annotation, NoteRange } from '@/lib/annotations';
import { cn } from '@/lib/utils';

interface MarginNotesProps {
  noteSlug: string;
  annotations: Annotation[];
  /** Whether the reader may add notes (signed in) */
  canAnnotate: boolean;
  /** Words the reader has just selected in the paragraph */
  selection: NoteRange | null;
  onSelectionUsed: () => void;
}

function shorten(text: string, max = 80) {
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
}

/** A form for a note's text */
function NoteEditor({ initial = '', label, onSave, onCancel, saving }: {
  initial?: string;
  label: string;
  onSave: (body: string) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [body, setBody] = useState(initial);
  return (
    <form
      className="space-y-1.5"
      onSubmit={(e) => { e.preventDefault(); if (body.trim()) onSave(body); }}
    >
      <p className="text-muted-foreground italic">{label}</p>
      <Textarea
        autoFocus
        value={body}
        maxLength={5000}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Escape') onCancel(); }}
        placeholder="Your note…"
        className="min-h-20 text-xs md:text-xs"
      />
      <div className="flex gap-1.5">
        <Button type="submit" size="sm" className="h-7 text-xs" disabled={!body.trim() || saving}>Save</Button>
        <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}

/** A reader's own notes beside a paragraph, and adding new ones */
export function MarginNotes({ noteSlug, annotations, canAnnotate, selection, onSelectionUsed }: MarginNotesProps) {
  const { add, update, remove } = useAnnotationActions();
  const { toast } = useToast();
  // A new note: on the selected words, or on the whole paragraph (null range)
  const [adding, setAdding] = useState<{ range: NoteRange | null } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const fail = (title: string) => (err: unknown) =>
    toast({ title, description: err instanceof Error ? err.message : 'An error occurred.', variant: 'destructive' });

  const save = (body: string) => {
    if (!adding) return;
    add.mutate({ noteSlug, range: adding.range, body }, {
      onSuccess: () => { setAdding(null); onSelectionUsed(); },
      onError: fail('Couldn’t save the note'),
    });
  };

  return (
    // Clicks here mustn't open the paragraph's page
    <aside
      data-margin
      onClick={(e) => e.stopPropagation()}
      className={cn(
        'text-xs leading-relaxed space-y-3 cursor-auto',
        'mt-3 border-l-2 border-amber-300 pl-3 dark:border-amber-500/50',
        'lg:mt-0 lg:w-60 lg:shrink-0',
        annotations.length === 0 && !adding && !selection && 'border-transparent dark:border-transparent',
      )}
    >
      {annotations.map((a) => (
        <div key={a.id} className="space-y-1">
          {editingId === a.id ? (
            <NoteEditor
              initial={a.body}
              label={a.quote ? `On “${shorten(a.quote)}”` : 'On the whole paragraph'}
              saving={update.isPending}
              onCancel={() => setEditingId(null)}
              onSave={(body) => update.mutate({ id: a.id, body }, {
                onSuccess: () => setEditingId(null),
                onError: fail('Couldn’t save the note'),
              })}
            />
          ) : (
            <>
              {a.quote && <p className="text-muted-foreground italic">“{shorten(a.quote)}”</p>}
              <p className="whitespace-pre-line text-foreground">{a.body}</p>
              <div className="flex gap-3 text-muted-foreground">
                <button className="hover:text-foreground hover:underline" onClick={() => setEditingId(a.id)}>Edit</button>
                <button
                  className="hover:text-destructive hover:underline"
                  onClick={() => remove.mutate(a.id, { onError: fail('Couldn’t delete the note') })}
                >
                  Delete
                </button>
              </div>
            </>
          )}
        </div>
      ))}

      {canAnnotate && (adding ? (
        <NoteEditor
          label={adding.range ? `On “${shorten(adding.range.quote)}”` : 'On the whole paragraph'}
          saving={add.isPending}
          onSave={save}
          onCancel={() => { setAdding(null); onSelectionUsed(); }}
        />
      ) : selection ? (
        <Button size="sm" variant="secondary" className="h-7 text-xs" onClick={() => setAdding({ range: selection })}>
          <Plus className="mr-1 h-3.5 w-3.5" />
          Add note on “{shorten(selection.quote, 30)}”
        </Button>
      ) : (
        <button
          onClick={() => setAdding({ range: null })}
          className="flex items-center gap-1 text-muted-foreground hover:text-foreground lg:opacity-0 lg:group-hover:opacity-100 focus:opacity-100 transition-opacity"
        >
          <Plus className="h-3.5 w-3.5" />
          Note
        </button>
      ))}
    </aside>
  );
}
