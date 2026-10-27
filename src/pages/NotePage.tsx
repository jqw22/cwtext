import { useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useSeoMeta } from '@unhead/react';
import { useStructuredNote, useSaveNote, useDbNoteCount } from '@/hooks/useStructuredNotes';
import { useCurator } from '@/hooks/useCurator';
import { useToast } from '@/hooks/useToast';
import { NoteForm, type NoteFormData } from '@/components/notes/NoteForm';
import { WorkSummary } from '@/components/works/WorkSummary';
import { useWorks } from '@/hooks/useWorks';
import { workOfNote } from '@/lib/works';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Clock, Pencil } from 'lucide-react';

/** One paragraph, with editing for the curator */
export function NotePage() {
  const { slug: id = '' } = useParams<{ slug: string }>();
  const { data: note, isLoading, error } = useStructuredNote(id);
  const { isCurator } = useCurator();
  const { mutateAsync: saveNote, isPending: isSaving } = useSaveNote();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const { data: worksData } = useWorks();
  const works = worksData?.works ?? [];
  const workId = note ? workOfNote(works)(note) : null;
  const work = works.find((w) => w.id === workId);

  // Editing needs the database itself (see Index)
  const { data: dbCount } = useDbNoteCount(isCurator);
  const isOwner = isCurator && !!dbCount;

  // Back returns to the search results the note was opened from
  const location = useLocation();
  const backTo = `/${(location.state as { from?: string } | null)?.from ?? ''}`;

  useSeoMeta({
    title: note ? `${note.title} — cwtext` : 'Loading... — cwtext',
    description: note?.content.slice(0, 160) ?? 'A paragraph from the texts of C. G. Jung',
  });

  const handleEdit = async (data: NoteFormData) => {
    if (!note) return;
    // A note's text name follows its work, so search and older copies still match
    const tag = works.find((w) => w.id === data.workId)?.tag;
    try {
      await saveNote({ ...data, tags: tag ? [tag] : [], dtag: note.id });
      setEditing(false);
      toast({ title: 'Note updated', description: 'Text and content saved.' });
    } catch (err) {
      toast({
        title: 'Update failed',
        description: err instanceof Error ? err.message : 'An error occurred.',
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container py-8 max-w-3xl mx-auto space-y-6">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-3 w-1/4" />
          <div className="space-y-3 mt-6">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !note) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container py-8 max-w-3xl mx-auto text-center">
          <p className="text-destructive text-lg">Note not found</p>
          <Button asChild variant="link" className="mt-4">
            <Link to={backTo}>Back to all notes</Link>
          </Button>
        </div>
      </div>
    );
  }

  const formattedDate = new Date((note.publishedAt ?? note.createdAt) * 1000).toLocaleDateString(
    undefined,
    { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' },
  );

  // Editing mode — show the form
  if (editing) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container max-w-3xl mx-auto flex items-center h-16">
            <Button asChild variant="ghost" size="sm">
              <Link to={backTo} className="flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to notes
              </Link>
            </Button>
          </div>
        </header>
        <div className="container max-w-3xl mx-auto py-8 px-4">
          <NoteForm
            initialTitle={note.title}
            initialContent={note.content}
            initialWorkId={workId ?? undefined}
            volumes={worksData?.volumes ?? []}
            works={works}
            initialOrder={note.order !== Infinity ? String(note.order) : ''}
            onSubmit={handleEdit}
            onCancel={() => setEditing(false)}
            isSubmitting={isSaving}
          />
        </div>
      </div>
    );
  }

  // Viewing mode
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container max-w-3xl mx-auto flex items-center justify-between h-16">
          <Button asChild variant="ghost" size="sm">
            <Link to={backTo} className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to notes
            </Link>
          </Button>
          {isOwner && (
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              <Pencil className="h-4 w-4 mr-1.5" />
              Edit
            </Button>
          )}
        </div>
      </header>

      <article className="container max-w-3xl mx-auto py-8 px-4">
        <h1 className="text-3xl font-bold leading-tight mb-4">
          {note.title}
        </h1>

        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground mb-6">
          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            <time>{formattedDate}</time>
          </div>
        </div>

        {work && (
          <div className="mb-6">
            <WorkSummary work={work} />
          </div>
        )}

        <div className="mb-12 max-w-prose">
          {note.content.split('\n').map((line, i) => (
            <p key={i} className="mb-3 leading-relaxed">{line || '\u00A0'}</p>
          ))}
        </div>
      </article>
    </div>
  );
}
