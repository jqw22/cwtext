import { Link } from 'react-router-dom';
import { nip19 } from 'nostr-tools';
import { cn } from '@/lib/utils';
import { MessageSquare } from 'lucide-react';
import type { StructuredNote } from '@/hooks/useStructuredNotes';

interface NoteCardProps {
  note: StructuredNote;
  /** Number of comments on this note (0 = no badge shown) */
  commentCount?: number;
}

function NoteCard({ note, commentCount }: NoteCardProps) {
  const naddr = nip19.naddrEncode({
    kind: 30023,
    pubkey: note.pubkey,
    identifier: note.id,
  });

  return (
    <Link to={`/${naddr}`} className="block group">
      <article className="py-5 border-b border-border/40 last:border-b-0 group-hover:bg-muted/20 -mx-4 px-4 rounded-lg transition-colors">
        {/* Para. heading */}
        <h2 className="text-base font-bold text-foreground mb-3 flex items-center gap-2">
          <span className="text-muted-foreground font-normal">Para. </span>
          {note.title}
          {commentCount !== undefined && commentCount > 0 && (
            <span className="inline-flex items-center gap-1 text-xs font-normal text-muted-foreground ml-1">
              <MessageSquare className="h-3 w-3" />
              {commentCount}
            </span>
          )}
        </h2>

        {/* Full content */}
        <div className="text-sm text-foreground/80 whitespace-pre-line leading-relaxed">
          {note.content}
        </div>
      </article>
    </Link>
  );
}

export { NoteCard };
