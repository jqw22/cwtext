import { useState } from 'react';
import { Sparkles, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NoteCard } from '@/components/notes/NoteCard';
import { useAsk } from '@/hooks/useAsk';
import type { StructuredNote } from '@/hooks/useStructuredNotes';

interface AskPanelProps {
  /** All notes, to show the paragraphs Claude picks */
  notes: StructuredNote[];
}

/** Ask a question in plain words; Claude picks the paragraphs that answer it */
export function AskPanel({ notes }: AskPanelProps) {
  const [question, setQuestion] = useState('');
  const { mutate: ask, data: answer, error, isPending, reset } = useAsk();
  const byId = new Map(notes.map((n) => [n.id, n]));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (question.trim() && !isPending) ask(question.trim());
  };

  return (
    <div className="space-y-4">
      <form onSubmit={submit} className="flex gap-2">
        <div className="relative flex-1">
          <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            maxLength={500}
            placeholder="Ask a question, e.g. where does Jung link the anima to the mother?"
            className="pl-10"
          />
        </div>
        <Button type="submit" disabled={!question.trim() || isPending}>
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Ask'}
        </Button>
      </form>

      {isPending && <p className="text-sm text-muted-foreground px-1">Claude is reading the texts…</p>}

      {error && <p className="text-sm text-destructive px-1">{error.message}</p>}

      {answer && !isPending && (
        <section className="rounded-xl border bg-muted/20 p-4 space-y-2">
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm leading-relaxed">{answer.summary}</p>
            <button
              onClick={() => { reset(); setQuestion(''); }}
              aria-label="Close answer"
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mx-auto w-fit max-w-full">
            {answer.passages.map((p) => {
              const note = byId.get(p.id);
              return note && (
                <div key={p.id}>
                  <p className="pt-4 -mb-3 text-xs italic text-muted-foreground max-w-prose ml-16">{p.why}</p>
                  <NoteCard note={note} />
                </div>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground text-right">
            {answer.remaining} question{answer.remaining !== 1 ? 's' : ''} left today
          </p>
        </section>
      )}
    </div>
  );
}
