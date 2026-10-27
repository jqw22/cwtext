import { Fragment, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useSeoMeta } from '@unhead/react';
import { ArrowLeft, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { WorkForm } from '@/components/works/WorkForm';
import { useCurator } from '@/hooks/useCurator';
import { useStructuredNotes } from '@/hooks/useStructuredNotes';
import { useDeleteWork, useNoteWorks, useSaveWork, useWorks } from '@/hooks/useWorks';
import { useToast } from '@/hooks/useToast';
import { cwReference, sortWorks, type WorkOrder } from '@/lib/works';
import type { WorkInput, WorkRow } from '@/lib/dbWorks';

const ORDERS: { value: WorkOrder; label: string }[] = [
  { value: 'volume', label: 'Volume' },
  { value: 'written', label: 'Written' },
  { value: 'published', label: 'Published' },
];

/** A year with its qualifying note, e.g. '1911 (revised 1952)' */
function Year({ year, note }: { year: number | null; note: string | null }) {
  if (year === null && !note) return <span className="text-muted-foreground/50">—</span>;
  return (
    <span>
      {year}
      {note && <span className="block text-xs text-muted-foreground">{note}</span>}
    </span>
  );
}

/** Jung's works with their dates, in Collected Works order or by chronology */
export function WorksPage() {
  const { data, isLoading, error } = useWorks();
  const { data: notes } = useStructuredNotes();
  const { isCurator } = useCurator();
  const { toast } = useToast();
  const { mutateAsync: saveWork, isPending: isSaving } = useSaveWork();
  const { mutateAsync: deleteWork } = useDeleteWork();
  const [editing, setEditing] = useState<WorkRow | 'new' | null>(null);
  // Editing needs the database itself, not the backup copy
  const canEdit = isCurator && data?.fromBackup === false;

  // The order lives in the URL so a chronological view can be shared
  const [searchParams, setSearchParams] = useSearchParams();
  const order = (ORDERS.find((o) => o.value === searchParams.get('order'))?.value ?? 'volume');

  useSeoMeta({
    title: 'Works — Selected Texts of C.G. Jung',
    description: "Jung's essays and books with the dates they were written and first published.",
  });

  const { notesPerWork } = useNoteWorks(notes);
  // Text names notes still carry, offered when filling in a work's old text name
  const tags = useMemo(() => [...new Set((notes ?? []).flatMap((n) => n.tags))].sort(), [notes]);

  const volumes = useMemo(() => data?.volumes ?? [], [data]);
  const volumeTitles = useMemo(() => new Map(volumes.map((v) => [v.number, v])), [volumes]);
  const works = useMemo(() => sortWorks(data?.works ?? [], volumes, order), [data, volumes, order]);

  const handleSave = async (work: WorkInput) => {
    try {
      await saveWork(work);
      setEditing(null);
      toast({ title: 'Work saved', description: `"${work.title}" has been saved.` });
    } catch (err) {
      toast({ title: 'Failed to save', description: err instanceof Error ? err.message : 'An error occurred.', variant: 'destructive' });
    }
  };

  const handleDelete = async (work: WorkRow) => {
    if (!window.confirm(`Delete "${work.title}"? Its notes are kept.`)) return;
    try {
      await deleteWork(work.id);
      setEditing(null);
      toast({ title: 'Work deleted', description: `"${work.title}" has been removed. Its notes are kept.` });
    } catch (err) {
      toast({ title: 'Failed to delete', description: err instanceof Error ? err.message : 'An error occurred.', variant: 'destructive' });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex items-center gap-3 h-16">
          <Button asChild variant="ghost" size="sm">
            <Link to="/"><ArrowLeft className="mr-2 h-4 w-4" />Texts</Link>
          </Button>
          <h1 className="text-xl font-bold">Works</h1>
        </div>
      </header>

      <main className="container py-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Order by</span>
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={order}
            onValueChange={(value) => value && setSearchParams(value === 'volume' ? {} : { order: value }, { replace: true })}
            aria-label="Order works by"
          >
            {ORDERS.map((o) => (
              <ToggleGroupItem key={o.value} value={o.value}>{o.label}</ToggleGroupItem>
            ))}
          </ToggleGroup>
          </div>
          {canEdit && (
            <Button size="sm" onClick={() => setEditing('new')}>
              <Plus className="mr-2 h-4 w-4" />Add work
            </Button>
          )}
        </div>

        {isLoading && (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        )}

        {error && (
          <p className="text-center py-12 text-muted-foreground">The works couldn't be loaded. Check your connection and try again.</p>
        )}

        {data && works.length === 0 && (
          <p className="text-center py-12 text-muted-foreground">No works have been added yet.</p>
        )}

        {works.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground border-b">
                <tr>
                  <th className="py-2 pr-4 font-medium">Title</th>
                  <th className="py-2 pr-4 font-medium hidden sm:table-cell">Written</th>
                  <th className="py-2 pr-4 font-medium hidden sm:table-cell">First published</th>
                  <th className="py-2 pr-4 font-medium hidden sm:table-cell">Collected Works</th>
                  <th className="py-2 pr-4 font-medium hidden md:table-cell">Language</th>
                  <th className="py-2 font-medium text-right">Notes</th>
                  {canEdit && <th className="py-2"><span className="sr-only">Edit</span></th>}
                </tr>
              </thead>
              <tbody>
                {works.map((work, i) => {
                  const count = notesPerWork.get(work.id) ?? 0;
                  const volume = work.volume ? volumeTitles.get(work.volume) : undefined;
                  // In volume order, a heading starts each volume
                  const newVolume = order === 'volume' && (i === 0 || works[i - 1].volume !== work.volume);
                  return (
                    <Fragment key={work.id}>
                      {newVolume && (
                        <tr>
                          <th colSpan={canEdit ? 7 : 6} className="pt-6 pb-2 text-left font-semibold">
                            {volume
                              ? <>CW {volume.number}: {volume.title}{volume.year_published && <span className="font-normal text-muted-foreground"> ({volume.year_published})</span>}</>
                              : 'Outside the Collected Works'}
                          </th>
                        </tr>
                      )}
                      <tr className="border-b border-border/40 align-top">
                        <td className="py-2 pr-4">
                          <span className="font-medium">{work.title}</span>
                          {work.kind !== 'essay' && <span className="ml-2 text-xs text-muted-foreground">{work.kind}</span>}
                          {work.original_title && <span className="block text-xs italic text-muted-foreground">{work.original_title}</span>}
                          {work.first_published_in && <span className="block text-xs text-muted-foreground">First in {work.first_published_in}</span>}
                          {work.revisions && <span className="block text-xs text-muted-foreground">{work.revisions}</span>}
                          {work.notes && <span className="block text-xs text-muted-foreground whitespace-pre-line">{work.notes}</span>}
                          {/* On a phone the dates and volume share the title's cell */}
                          <span className="block text-xs sm:hidden">
                            {[
                              work.year_written !== null && `Written ${work.year_written}`,
                              work.year_first_published !== null && `First published ${work.year_first_published}`,
                              cwReference(work),
                            ].filter(Boolean).join(' · ')}
                          </span>
                        </td>
                        <td className="py-2 pr-4 hidden sm:table-cell"><Year year={work.year_written} note={work.year_written_note} /></td>
                        <td className="py-2 pr-4 hidden sm:table-cell"><Year year={work.year_first_published} note={work.year_first_published_note} /></td>
                        <td className="py-2 pr-4 hidden sm:table-cell whitespace-nowrap">{cwReference(work)}</td>
                        <td className="py-2 pr-4 hidden md:table-cell">{work.original_language}</td>
                        <td className="py-2 text-right">
                          {count > 0
                            ? <Link to={`/?${new URLSearchParams({ ...(work.volume ? { vol: work.volume } : {}), text: work.id })}`} className="underline hover:text-primary">{count}</Link>
                            : <span className="text-muted-foreground/50">—</span>}
                        </td>
                        {canEdit && (
                          <td className="py-2 pl-2 text-right">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditing(work)} aria-label={`Edit ${work.title}`}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          </td>
                        )}
                      </tr>
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing === 'new' ? 'Add work' : 'Edit work'}</DialogTitle>
          </DialogHeader>
          {editing !== null && (
            <>
              <WorkForm
                work={editing === 'new' ? undefined : editing}
                volumes={volumes}
                tags={tags}
                onSubmit={handleSave}
                onCancel={() => setEditing(null)}
                isSubmitting={isSaving}
              />
              {editing !== 'new' && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="justify-self-start text-destructive"
                  onClick={() => handleDelete(editing)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />Delete work
                </Button>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
