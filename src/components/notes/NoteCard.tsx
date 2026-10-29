import { Link, useLocation } from 'react-router-dom';
import type { StructuredNote } from '@/hooks/useStructuredNotes';
import { splitMatches } from '@/lib/highlight';

interface NoteCardProps {
  note: StructuredNote;
  /** Search text to highlight in the paragraph */
  highlight?: string;
  /** Highlight only where upper and lower case match the search */
  matchCase?: boolean;
  /** Where the paragraph comes from, shown above it when results mix texts */
  source?: string;
}

/** `text` with each occurrence of `query` marked */
function Highlighted({ text, query, matchCase }: { text: string; query: string; matchCase?: boolean }) {
  return (
    <>
      {splitMatches(text, query, matchCase).map((part, i) =>
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

function NoteCard({ note, highlight = '', matchCase, source }: NoteCardProps) {
  const location = useLocation();
  return (
    <Link to={`/note/${encodeURIComponent(note.id)}`} state={{ from: location.search }} className="block group">
      <article className="flex gap-4 py-5 border-b border-border/40 last:border-b-0 group-hover:bg-muted/20 -mx-4 px-4 rounded-lg transition-colors">
        <h2 className="w-12 shrink-0 text-right text-sm font-bold text-muted-foreground tabular-nums leading-relaxed">
          <Highlighted text={note.title} query={highlight} matchCase={matchCase} />
        </h2>
        <div className="max-w-prose text-sm text-foreground/80 leading-relaxed">
          {source && <p className="mb-1 text-xs font-medium text-muted-foreground">{source}</p>}
          <div className="whitespace-pre-line">
            <Highlighted text={note.content} query={highlight} matchCase={matchCase} />
          </div>
        </div>
      </article>
    </Link>
  );
}

export { NoteCard };
