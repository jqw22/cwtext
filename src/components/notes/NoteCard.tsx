import { Link, useLocation } from 'react-router-dom';
import { nip19 } from 'nostr-tools';
import type { StructuredNote } from '@/hooks/useStructuredNotes';

interface NoteCardProps {
  note: StructuredNote;
}

function NoteCard({ note }: NoteCardProps) {
  const location = useLocation();
  const naddr = nip19.naddrEncode({
    kind: 30023,
    pubkey: note.pubkey,
    identifier: note.id,
  });

  return (
    <Link to={`/${naddr}`} state={{ from: location.search }} className="block group">
      <article className="flex gap-4 py-5 border-b border-border/40 last:border-b-0 group-hover:bg-muted/20 -mx-4 px-4 rounded-lg transition-colors">
        <h2 className="w-12 shrink-0 text-right text-sm font-bold text-muted-foreground tabular-nums leading-relaxed">
          {note.title}
        </h2>
        <div className="max-w-prose text-sm text-foreground/80 whitespace-pre-line leading-relaxed">
          {note.content}
        </div>
      </article>
    </Link>
  );
}

export { NoteCard };
