import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, X, Tag, Hash, Filter, Loader2, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SearchFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  selectedTags: string[];
  onRemoveTag: (tag: string) => void;
  /** Map of tag → count of notes with that tag */
  availableTags: Map<string, number>;
  onAddTag: (tag: string) => void;
  /** Clear the search text and every selected tag at once */
  onClearAll: () => void;
  /** Notes (and so tags) are still loading from the relays */
  isLoading?: boolean;
  /** Loading failed; offer a retry */
  onRetry?: () => void;
}

export function SearchFilters({
  search,
  onSearchChange,
  selectedTags,
  onRemoveTag,
  availableTags,
  onAddTag,
  onClearAll,
  isLoading,
  onRetry,
}: SearchFiltersProps) {
  const [tagSearch, setTagSearch] = useState('');

  // Sort tags alphabetically, filter by tag search
  const sortedTags = useMemo(() => {
    const entries = Array.from(availableTags.entries());

    // Filter by tag search
    const filtered = tagSearch.trim()
      ? entries.filter(([tag]) => tag.includes(tagSearch.toLowerCase()))
      : entries;

    // Sort alphabetically (A–Z); selected tags are shown in their own group
    return filtered.sort((a, b) => a[0].localeCompare(b[0]));
  }, [availableTags, tagSearch]);

  const totalTags = availableTags.size;
  const hasActiveFilters = selectedTags.length > 0 || search.trim().length > 0;

  return (
    <div className="space-y-4">
      {/* Shown until the first notes arrive, or if none could be loaded.
          Tags are displayed to readers as "texts". */}
      {totalTags === 0 && (isLoading || onRetry) && (
        <div className="bg-muted/30 border rounded-xl p-4 flex items-center gap-2 text-sm text-muted-foreground">
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading texts from the relays…
            </>
          ) : (
            <>
              Couldn't load the texts.
              <button onClick={onRetry} className="inline-flex items-center gap-1 underline hover:text-foreground">
                <RefreshCw className="h-3.5 w-3.5" />
                Try again
              </button>
            </>
          )}
        </div>
      )}

      {/* Tag browser section */}
      {totalTags > 0 && (
        <div className="bg-muted/30 border rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Tag className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-medium">Browse by Texts</h3>
              <span className="text-xs text-muted-foreground">
                ({totalTags} text{totalTags !== 1 ? 's' : ''})
              </span>
            </div>
            {/* Tag search */}
            {totalTags > 15 && (
              <div className="relative w-48">
                <Hash className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                <Input
                  value={tagSearch}
                  onChange={(e) => setTagSearch(e.target.value)}
                  placeholder="Filter texts..."
                  className="h-7 text-xs pl-6"
                />
              </div>
            )}
          </div>

          {/* Selected tags always shown at top */}
          {selectedTags.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground/60 mb-1.5 text-center">
                Selected
              </p>
              <div className="flex flex-wrap justify-center gap-1.5">
                {sortedTags
                  .filter(([t]) => selectedTags.includes(t))
                  .map(([tag, count]) => (
                    <Badge
                      key={tag}
                      variant="default"
                      className="cursor-pointer gap-1 text-xs"
                      onClick={() => onRemoveTag(tag)}
                    >
                      #{tag}
                      <span className="opacity-70">({count})</span>
                      <X className="h-3 w-3 ml-0.5" />
                    </Badge>
                  ))}
              </div>
            </div>
          )}

          {/* All tags */}
          <div>
            {selectedTags.length > 0 && (
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground/60 mb-1.5 text-center">
                All Texts
              </p>
            )}
            {sortedTags.filter(([t]) => !selectedTags.includes(t)).length === 0 ? (
              <p className="text-xs text-muted-foreground/60 italic text-center">No other texts</p>
            ) : (
              <div className="flex flex-wrap justify-center gap-1.5 max-h-48 overflow-y-auto">
                {sortedTags
                  .filter(([t]) => !selectedTags.includes(t))
                  .map(([tag, count]) => (
                    <Badge
                      key={tag}
                      variant="outline"
                      className={cn(
                        "cursor-pointer text-xs hover:bg-primary/10 hover:text-primary transition-colors",
                        count >= 5 && "border-primary/30",
                        count >= 10 && "border-primary/50 font-medium",
                      )}
                      onClick={() => onAddTag(tag)}
                    >
                      #{tag}
                      <span className="ml-1 opacity-60 text-[10px]">({count})</span>
                    </Badge>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search notes by title, content, or text..."
          className="pl-10"
        />
        {search && (
          <button
            onClick={() => onSearchChange('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Active filters indicator */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-1.5 px-1">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground mr-1">Active filters:</span>
          {search && (
            <Badge variant="secondary" className="gap-1 text-xs">
              Search: "{search}"
              <button onClick={() => onSearchChange('')}>
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {selectedTags.map((tag) => (
            <Badge
              key={tag}
              variant="default"
              className="cursor-pointer gap-1 text-xs"
              onClick={() => onRemoveTag(tag)}
            >
              #{tag}
              <X className="h-3 w-3" />
            </Badge>
          ))}
          {hasActiveFilters && (
            <button
              onClick={onClearAll}
              className="text-xs text-muted-foreground hover:text-foreground underline ml-1"
            >
              Clear all
            </button>
          )}
        </div>
      )}
    </div>
  );
}
