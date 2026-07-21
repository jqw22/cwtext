import { Link } from 'react-router-dom';
import { nip19 } from 'nostr-tools';
import type { StructuredNote } from '@/hooks/useStructuredNotes';

interface NoteCardProps {
  note: StructuredNote;
}

function NoteCard({ note }: NoteCardProps) {
  const naddr = nip19.naddrEncode({
    kind: 30023,
    pubkey: note.pubkey,
    identifier: note.id,
  });

  return (
    <Link to={`/${naddr}`} className="block group">
      <article className="py-5 border-b border-border/40 last:border-b-0 group-hover:bg-muted/20 -mx-4 px-4 rounded-lg transition-colors">
        <h2 className="text-base font-bold text-foreground mb-3">
          <span className="text-muted-foreground font-normal">Para. </span>
          {note.title}
        </h2>
        <div className="text-sm text-foreground/80 whitespace-pre-line leading-relaxed">
          {note.content}
        </div>
      </article>
    </Link>
  );
}

export { NoteCard };
