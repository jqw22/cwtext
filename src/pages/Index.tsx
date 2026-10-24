import { useState, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSeoMeta } from '@unhead/react';
import { LoginArea } from '@/components/auth/LoginArea';
import { NoteForm } from '@/components/notes/NoteForm';
import { NoteImport } from '@/components/notes/NoteImport';
import { NoteCard } from '@/components/notes/NoteCard';
import { SearchFilters } from '@/components/notes/SearchFilters';
import { ExportODTButton } from '@/components/notes/ExportODTButton';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, PenLine, Search, Upload } from 'lucide-react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useStructuredNotes, usePublishNote, normalizeTag } from '@/hooks/useStructuredNotes';
import { useToast } from '@/hooks/useToast';
import { APP_AUTHOR_PUBKEY } from '@/lib/appAuthor';

const Index = () => {
  const { user } = useCurrentUser();
  const { toast } = useToast();
  const [showCuratedForm, setShowCuratedForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  // Search text (?q=) and tags (?tag=, repeatable) live in the URL, so Back
  // from a paragraph returns to the same results and a filtered view can be shared
  const [searchParams, setSearchParams] = useSearchParams();
  const search = searchParams.get('q') ?? '';
  const selectedTags = useMemo(() => searchParams.getAll('tag').map(normalizeTag), [searchParams]);

  const setSearch = useCallback((value: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) next.set('q', value);
      else next.delete('q');
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const setSelectedTags = useCallback((update: (prev: string[]) => string[]) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('tag');
      for (const tag of update(prev.getAll('tag'))) next.append('tag', tag);
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const hasSearched = search.trim().length > 0 || selectedTags.length > 0;
  const isAppAuthor = user?.pubkey === APP_AUTHOR_PUBKEY;

  // All curated notes load once; search and tags filter them in the browser
  const { data: notes, isLoading, error, refetch } = useStructuredNotes();

  const { mutateAsync: publishNote, isPending: isPublishing } = usePublishNote();

  useSeoMeta({
    title: 'Selected Texts of C.G. Jung',
    description: 'Search, browse by text, and export selected paragraphs from the texts of C. G. Jung.',
  });

  // Tag counts across the whole collection
  const tagCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const note of notes ?? []) {
      for (const tag of note.tags) {
        counts.set(tag, (counts.get(tag) || 0) + 1);
      }
    }
    return counts;
  }, [notes]);

  // Filter curated notes (already sorted by order)
  const filteredNotes = useMemo(() => {
    if (!notes || !hasSearched) return [];

    let result = notes;

    if (selectedTags.length > 0) {
      result = result.filter((note) =>
        selectedTags.some((tag) => note.tags.includes(tag)),
      );
    }

    const q = search.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (note) =>
          note.title.toLowerCase().includes(q) ||
          note.content.toLowerCase().includes(q) ||
          note.tags.some((t) => t.toLowerCase().includes(q)),
      );
    }

    return result;
  }, [notes, selectedTags, search, hasSearched]);

  const handleAddTag = useCallback((tag: string) => {
    setSelectedTags((prev) => (prev.includes(tag) ? prev : [...prev, tag]));
  }, [setSelectedTags]);

  const handleRemoveTag = useCallback((tag: string) => {
    setSelectedTags((prev) => prev.filter((t) => t !== tag));
  }, [setSelectedTags]);

  const handleCreateNote = useCallback(
    async (data: { title: string; content: string; tags: string[]; order?: string }) => {
      if (!user) return;
      try {
        await publishNote(data);
        setShowCuratedForm(false);
        toast({ title: 'Note published!', description: `"${data.title}" has been published to Nostr.` });
      } catch (err) {
        toast({ title: 'Failed to publish', description: err instanceof Error ? err.message : 'An error occurred.', variant: 'destructive' });
      }
    },
    [user, publishNote, toast],
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <img src={`${import.meta.env.BASE_URL}icon-192.png`} alt="" className="h-6 w-6" />
            <h1 className="text-xl font-bold">Selected Texts of C.G. Jung</h1>
          </div>
          <div className="flex items-center gap-3">
            <ExportODTButton notes={filteredNotes} title="cwtext_export" filterTags={selectedTags} />
            <LoginArea className="w-auto" />
          </div>
        </div>
      </header>

      <main className="container py-6">
        {/* Search & Tags — full width */}
        <SearchFilters
          search={search}
          onSearchChange={setSearch}
          selectedTags={selectedTags}
          onRemoveTag={handleRemoveTag}
          availableTags={tagCounts}
          onAddTag={handleAddTag}
          onClearAll={() => setSearchParams({}, { replace: true })}
          isLoading={isLoading}
          onRetry={error ? () => refetch() : undefined}
        />

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
                  Use the search bar above or click a text to find passages
                </p>
              )}
              {isAppAuthor && (
                <div className="flex gap-2">
                  <Button
                    onClick={() => setShowImport(!showImport)}
                    variant={showImport ? 'secondary' : 'outline'}
                    size="sm"
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    {showImport ? 'Close Import' : 'Import'}
                  </Button>
                  <Button
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
            {showCuratedForm && isAppAuthor && (
              <NoteForm
                onSubmit={handleCreateNote}
                onCancel={() => setShowCuratedForm(false)}
                isSubmitting={isPublishing}
                availableTags={tagCounts}
              />
            )}

            {/* Import many notes from a document */}
            {showImport && isAppAuthor && (
              <NoteImport
                existingNotes={notes ?? []}
                availableTags={tagCounts}
                onClose={() => setShowImport(false)}
              />
            )}

            {/* Welcome state */}
            {!hasSearched && !showCuratedForm && !showImport && (
              <div className="text-center py-24 border-2 border-dashed rounded-xl">
                <Search className="h-16 w-16 mx-auto mb-6 text-muted-foreground/20" />
                <h2 className="text-2xl font-semibold mb-3">Find a passage</h2>
                <p className="text-muted-foreground max-w-md mx-auto text-lg">
                  Click a text or search by keyword above to browse passages.
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
                <p className="text-muted-foreground text-sm">Check your relay connections and try again.</p>
              </div>
            )}

            {/* Empty */}
            {hasSearched && !isLoading && !error && filteredNotes.length === 0 && (
              <div className="text-center py-16 border-2 border-dashed rounded-xl">
                <PenLine className="h-12 w-12 mx-auto mb-4 text-muted-foreground/40" />
                <h2 className="text-xl font-semibold mb-2">No results</h2>
                <p className="text-muted-foreground max-w-md mx-auto mb-6">
                  Try adjusting your search or filter criteria.
                </p>
              </div>
            )}

            {/* Notes list, centred on the page */}
            {hasSearched && !isLoading && filteredNotes.length > 0 && (
              <div className="mx-auto w-fit max-w-full">
                {filteredNotes.map((note) => (
                  <NoteCard key={note.id} note={note} highlight={search} />
                ))}
              </div>
            )}

            {hasSearched && !isLoading && !error && filteredNotes.length > 0 && (
              <p className="text-center text-xs text-muted-foreground pb-8">
                Powered by Nostr
              </p>
            )}
        </div>
      </main>
    </div>
  );
};

export default Index;
