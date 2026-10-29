import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useSeoMeta } from '@unhead/react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AccountMenu } from '@/components/auth/AccountMenu';
import { useCurator } from '@/hooks/useCurator';
import { useAnnotations } from '@/hooks/useAnnotations';
import { useStructuredNotes, type StructuredNote } from '@/hooks/useStructuredNotes';
import { useNoteWorks } from '@/hooks/useWorks';
import { sourceLine } from '@/lib/works';
import type { Annotation } from '@/lib/annotations';

/** Every margin note the signed-in reader has made, grouped by paragraph in reading order */
export function MyNotesPage() {
  const { userId } = useCurator();
  const { data: annotations, isLoading, error } = useAnnotations(userId);
  const { data: notes } = useStructuredNotes();
  const { workById, workOf } = useNoteWorks(notes);

  useSeoMeta({ title: 'My notes — Selected Texts of C.G. Jung' });

  const groups = useMemo(() => {
    const bySlug = new Map((notes ?? []).map((n, i) => [n.id, { note: n, index: i }]));
    const map = new Map<string, Annotation[]>();
    for (const a of annotations ?? []) map.set(a.note_slug, [...(map.get(a.note_slug) ?? []), a]);
    return [...map.entries()]
      .map(([slug, items]) => ({ slug, items, ...bySlug.get(slug) }))
      .sort((a, b) => (a.index ?? Infinity) - (b.index ?? Infinity));
  }, [annotations, notes]);

  const sourceOf = (note: StructuredNote) => {
    const id = workOf(note);
    const work = id ? workById.get(id) : undefined;
    return work ? sourceLine(work) : undefined;
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex items-center justify-between gap-3 h-16">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm">
              <Link to="/"><ArrowLeft className="mr-2 h-4 w-4" />Texts</Link>
            </Button>
            <h1 className="text-xl font-bold">My notes</h1>
          </div>
          <AccountMenu />
        </div>
      </header>

      <main className="container py-6 max-w-3xl">
        {!userId ? (
          <p className="text-muted-foreground">Sign in to see your notes.</p>
        ) : isLoading ? (
          <div className="space-y-3"><Skeleton className="h-5 w-1/2" /><Skeleton className="h-4 w-full" /></div>
        ) : error ? (
          <p className="text-destructive">Couldn’t load your notes: {error.message}</p>
        ) : groups.length === 0 ? (
          <p className="text-muted-foreground">
            You haven’t made any notes yet. Select some words in a paragraph and choose <strong>Add note</strong>,
            or use <strong>+ Note</strong> beside a paragraph.
          </p>
        ) : (
          <div className="space-y-8">
            <p className="text-sm text-muted-foreground">
              {annotations!.length} note{annotations!.length !== 1 ? 's' : ''}, visible only to you.
            </p>
            {groups.map(({ slug, items, note }) => (
              <section key={slug} className="space-y-2">
                <h2 className="text-sm">
                  <Link to={`/note/${encodeURIComponent(slug)}`} className="font-semibold hover:underline">
                    {note ? `¶ ${note.title}` : 'A paragraph that has since been removed'}
                  </Link>
                  {note && sourceOf(note) && <span className="text-muted-foreground"> · {sourceOf(note)}</span>}
                </h2>
                {items.map((a) => (
                  <div key={a.id} className="border-l-2 border-amber-300 pl-3 text-sm dark:border-amber-500/50">
                    {a.quote && <p className="italic text-muted-foreground">“{a.quote}”</p>}
                    <p className="whitespace-pre-line">{a.body}</p>
                  </div>
                ))}
              </section>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
