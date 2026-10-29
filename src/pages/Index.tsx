import { useState, useMemo, useCallback, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useSeoMeta } from '@unhead/react';
import { AccountMenu } from '@/components/auth/AccountMenu';
import { NoteForm, type NoteFormData } from '@/components/notes/NoteForm';
import { NoteImport } from '@/components/notes/NoteImport';
import { NoteCard } from '@/components/notes/NoteCard';
import { SearchFilters } from '@/components/notes/SearchFilters';
import { AskPanel } from '@/components/notes/AskPanel';
import { TextPicker, type TextSelection } from '@/components/notes/TextPicker';
import { ExportODTButton } from '@/components/notes/ExportODTButton';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, PenLine, Search, Upload, BookOpen } from 'lucide-react';
import { useCurator } from '@/hooks/useCurator';
import {
  useStructuredNotes,
  useSaveNote,
  useDbNoteCount,
  normalizeTag,
  type StructuredNote,
} from '@/hooks/useStructuredNotes';
import { useToast } from '@/hooks/useToast';
import { useAnnotations } from '@/hooks/useAnnotations';
import { useNoteWorks } from '@/hooks/useWorks';
import { WorkSummary } from '@/components/works/WorkSummary';
import { sourceLine, volumeLabel } from '@/lib/works';
import { matchesAll, searchTerms } from '@/lib/highlight';

const Index = () => {
  const { userId, isCurator } = useCurator();
  // Visitors can read by volume and text; searching needs an account
  const signedIn = !!userId;
  // The reader's own margin notes
  const { byNote: annotationsByNote } = useAnnotations(userId);
  const { toast } = useToast();
  const [showCuratedForm, setShowCuratedForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  // Search text (?q=), volume (?vol=) and text (?text=, a work id) live in the URL,
  // so Back from a paragraph returns to the same results and a view can be shared
  const [searchParams, setSearchParams] = useSearchParams();
  const search = signedIn ? searchParams.get('q') ?? '' : '';
  // Upper and lower case must match unless switched off (?case=0), so Self and self stay apart
  const matchCase = searchParams.get('case') !== '0';
  const setMatchCase = useCallback((value: boolean) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) next.delete('case');
      else next.set('case', '0');
      return next;
    }, { replace: true });
  }, [setSearchParams]);
  const selection: TextSelection = useMemo(
    () => ({ volume: searchParams.get('vol') ?? '', text: searchParams.get('text') ?? '' }),
    [searchParams],
  );

  const setSearch = useCallback((value: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) next.set('q', value);
      else next.delete('q');
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const setSelection = useCallback(({ volume, text }: TextSelection) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('tag');
      if (volume) next.set('vol', volume);
      else next.delete('vol');
      if (text) next.set('text', text);
      else next.delete('text');
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const hasSearched = search.trim().length > 0 || !!selection.volume || !!selection.text;

  // All curated notes load once; search and the chosen text filter them in the browser
  const { data: notes, isLoading, error, refetch } = useStructuredNotes();

  const { mutateAsync: saveNote, isPending: isSaving } = useSaveNote();

  const { volumes, works, workById, workOf, notesPerWork, notesPerVolume } = useNoteWorks(notes);
  const selectedWork = selection.text ? workById.get(selection.text) : undefined;
  const selectedVolume = volumes.find((v) => v.number === selection.volume);

  // Older links filter by text name (?tag=); turn them into the same text's work
  useEffect(() => {
    const tags = searchParams.getAll('tag').map(normalizeTag);
    if (tags.length === 0 || works.length === 0) return;
    const work = works.find((w) => w.tag && tags.includes(w.tag));
    setSelection({ volume: work?.volume ?? '', text: work?.id ?? '' });
  }, [searchParams, works, setSelection]);

  // Editing needs the database itself; while only the backup can be read, it waits
  const { data: dbCount } = useDbNoteCount(isCurator);
  const canEdit = isCurator && !!dbCount;

  useSeoMeta({
    title: 'Selected Texts of C.G. Jung',
    description: 'Browse by text, search, and export selected paragraphs from the texts of C. G. Jung.',
  });

  // Filter curated notes (already sorted by order)
  const filteredNotes = useMemo(() => {
    if (!notes || !hasSearched) return [];

    let result = notes;

    if (selection.text) {
      result = result.filter((note) => workOf(note) === selection.text);
    } else if (selection.volume) {
      result = result.filter((note) => {
        const id = workOf(note);
        return !!id && workById.get(id)?.volume === selection.volume;
      });
    }

    // Every word, or "quoted phrase", must appear in the paragraph, its number or its text's title
    const terms = searchTerms(search, matchCase);
    if (terms.length > 0) {
      result = result.filter((note) => {
        const id = workOf(note);
        const work = id ? workById.get(id) : undefined;
        return matchesAll(`${note.title}\n${note.content}\n${work?.title ?? ''}`, terms, matchCase);
      });
    }

    return result;
  }, [notes, selection, search, matchCase, hasSearched, workOf, workById]);

  // The chosen volume and text, for the filter row and the export's header
  const filterLabels = [
    selectedVolume && { label: volumeLabel(selectedVolume), onRemove: () => setSelection({ volume: '', text: '' }) },
    selectedWork && { label: selectedWork.title, onRemove: () => setSelection({ volume: selection.volume, text: '' }) },
  ].filter((f) => !!f);

  /** Where a note comes from, e.g. 'CW 5 · Introduction · written 1911' */
  const sourceOf = useCallback((note: StructuredNote) => {
    const id = workOf(note);
    const work = id ? workById.get(id) : undefined;
    return work ? sourceLine(work) : undefined;
  }, [workOf, workById]);

  /** A note's text name follows its work, so search and older copies still match */
  const withTags = useCallback((data: NoteFormData) => {
    const tag = data.workId ? workById.get(data.workId)?.tag : undefined;
    return { ...data, tags: tag ? [tag] : [] };
  }, [workById]);

  const handleCreateNote = useCallback(
    async (data: NoteFormData) => {
      try {
        await saveNote(withTags(data));
        setShowCuratedForm(false);
        toast({ title: 'Note saved', description: `"${data.title}" has been added.` });
      } catch (err) {
        toast({ title: 'Failed to save', description: err instanceof Error ? err.message : 'An error occurred.', variant: 'destructive' });
      }
    },
    [saveNote, toast, withTags],
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex items-center justify-between gap-2 h-16">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <img src={`${import.meta.env.BASE_URL}icon-192.png`} alt="" className="h-6 w-6 shrink-0 max-[359px]:hidden" />
            {/* Two fixed lines on phones so the title never breaks mid-phrase */}
            <h1 className="text-sm max-[359px]:text-[13px] sm:text-lg md:text-xl font-bold leading-tight">
              <span className="block sm:inline whitespace-nowrap">Selected Texts</span>{' '}
              <span className="block sm:inline whitespace-nowrap">of C.G. Jung</span>
            </h1>
          </div>
          <div className="flex items-center gap-1 sm:gap-3">
            <Button asChild variant="ghost" size="sm">
              <Link to="/works" aria-label="Works"><BookOpen className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">Works</span></Link>
            </Button>
            <ExportODTButton notes={filteredNotes} title="cwtext_export" filterTags={filterLabels.map((f) => f.label)} />
            <AccountMenu />
          </div>
        </div>
      </header>

      <main className="container py-6">
        {/* Volume and text, then search — full width */}
        <div className="space-y-4">
          <TextPicker
            volumes={volumes}
            works={works}
            notesPerWork={notesPerWork}
            notesPerVolume={notesPerVolume}
            value={selection}
            onChange={setSelection}
            isLoading={isLoading}
            onRetry={error ? () => refetch() : undefined}
          />
          <SearchFilters
            canSearch={signedIn}
            search={search}
            onSearchChange={setSearch}
            matchCase={matchCase}
            onMatchCaseChange={setMatchCase}
            filters={filterLabels}
            onClearAll={() => setSearchParams({}, { replace: true })}
          />
          {signedIn && <AskPanel notes={notes ?? []} sourceOf={sourceOf} annotationsByNote={annotationsByNote} />}
        </div>

        <div className="mt-6 space-y-6">
            {/* Action bar */}
            <div className="flex items-center justify-between pt-2">
              {hasSearched ? (
                <p className="text-sm text-muted-foreground">
                  {filteredNotes.length > 0
                    ? `Showing ${filteredNotes.length} note${filteredNotes.length !== 1 ? 's' : ''}`
                    : 'No notes found'}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {signedIn ? 'Choose a volume or text, or search, to find passages' : 'Choose a volume or text to read its passages'}
                </p>
              )}
              {isCurator && (
                <div className="flex items-center gap-2">
                  {dbCount !== undefined && (
                    <span className="text-xs text-muted-foreground">
                      {dbCount} in database
                    </span>
                  )}
                  <Button
                    disabled={!canEdit}
                    onClick={() => setShowImport(!showImport)}
                    variant={showImport ? 'secondary' : 'outline'}
                    size="sm"
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    {showImport ? 'Close Import' : 'Import'}
                  </Button>
                  <Button
                    disabled={!canEdit}
                    onClick={() => setShowCuratedForm(!showCuratedForm)}
                    variant={showCuratedForm ? 'secondary' : 'default'}
                    size="sm"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    {showCuratedForm ? 'Close Form' : 'New Note'}
                  </Button>
                </div>
              )}
            </div>

            {/* Curated note form */}
            {showCuratedForm && canEdit && (
              <NoteForm
                onSubmit={handleCreateNote}
                onCancel={() => setShowCuratedForm(false)}
                isSubmitting={isSaving}
                volumes={volumes}
                works={works}
                initialWorkId={selection.text || undefined}
              />
            )}

            {/* Import many notes from a document */}
            {showImport && canEdit && (
              <NoteImport
                existingNotes={notes ?? []}
                volumes={volumes}
                works={works}
                workOf={workOf}
                initialWorkId={selection.text || undefined}
                onClose={() => setShowImport(false)}
              />
            )}

            {/* Welcome state */}
            {!hasSearched && !showCuratedForm && !showImport && (
              <div className="text-center py-24 border-2 border-dashed rounded-xl">
                <Search className="h-16 w-16 mx-auto mb-6 text-muted-foreground/20" />
                <h2 className="text-2xl font-semibold mb-3">Find a passage</h2>
                <p className="text-muted-foreground max-w-md mx-auto text-lg">
                  {signedIn
                    ? 'Choose a volume or text above, or search by keyword, to browse passages.'
                    : 'Choose a volume or text above to read its passages. Sign in to search.'}
                </p>
              </div>
            )}

            {/* Loading */}
            {hasSearched && isLoading && (
              <div className="space-y-5">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="space-y-2 py-4 border-b border-border/40">
                    <Skeleton className="h-5 w-48" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-5/6" />
                    <Skeleton className="h-4 w-3/4" />
                  </div>
                ))}
              </div>
            )}

            {/* Error */}
            {hasSearched && error && (
              <div className="text-center py-12">
                <p className="text-destructive text-lg font-medium mb-2">Failed to load notes</p>
                <p className="text-muted-foreground text-sm">Check your connection and try again.</p>
              </div>
            )}

            {/* Empty */}
            {hasSearched && !isLoading && !error && filteredNotes.length === 0 && (
              <div className="text-center py-16 border-2 border-dashed rounded-xl">
                <PenLine className="h-12 w-12 mx-auto mb-4 text-muted-foreground/40" />
                <h2 className="text-xl font-semibold mb-2">No results</h2>
                <p className="text-muted-foreground max-w-md mx-auto mb-6">
                  {signedIn ? 'Try adjusting your search or filter criteria.' : 'Try another volume or text.'}
                </p>
              </div>
            )}

            {/* The chosen text's dates and place in the Collected Works */}
            {selectedWork && (
              <div className="mx-auto w-fit max-w-full">
                <WorkSummary work={selectedWork} />
              </div>
            )}

            {/* Notes list, centred on the page */}
            {hasSearched && !isLoading && filteredNotes.length > 0 && (
              <div className="mx-auto w-fit max-w-full">
                {filteredNotes.map((note) => (
                  // With one text chosen, its summary above already says where the paragraphs come from
                  <NoteCard
                    key={note.id}
                    note={note}
                    highlight={search}
                    matchCase={matchCase}
                    source={selectedWork ? undefined : sourceOf(note)}
                    annotations={annotationsByNote.get(note.id)}
                    canAnnotate={signedIn}
                  />
                ))}
              </div>
            )}

        </div>
      </main>
    </div>
  );
};

export default Index;
