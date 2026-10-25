import { Link, useLocation } from 'react-router-dom';
import type { StructuredNote } from '@/hooks/useStructuredNotes';
import { splitMatches } from '@/lib/highlight';

interface NoteCardProps {
  note: StructuredNote;
  /** Search text to highlight in the paragraph */
  highlight?: string;
}

/** `text` with each occurrence of `query` marked */
function Highlighted({ text, query }: { text: string; query: string }) {
  return (
    <>
      {splitMatches(text, query).map((part, i) =>
        part.match ? (
          <mark key={i} className="bg-yellow-200 text-foreground rounded-sm px-0.5 -mx-0.5 dark:bg-yellow-500/40">
            {part.text}
          </mark>
        ) : (
          part.text
        ),
      )}
    </>
  );
}

function NoteCard({ note, highlight = '' }: NoteCardProps) {
  const location = useLocation();
  return (
    <Link to={`/note/${encodeURIComponent(note.id)}`} state={{ from: location.search }} className="block group">
      <article className="flex gap-4 py-5 border-b border-border/40 last:border-b-0 group-hover:bg-muted/20 -mx-4 px-4 rounded-lg transition-colors">
        <h2 className="w-12 shrink-0 text-right text-sm font-bold text-muted-foreground tabular-nums leading-relaxed">
          <Highlighted text={note.title} query={highlight} />
        </h2>
        <div className="max-w-prose text-sm text-foreground/80 whitespace-pre-line leading-relaxed">
          <Highlighted text={note.content} query={highlight} />
        </div>
      </article>
    </Link>
  );
}

export { NoteCard };
