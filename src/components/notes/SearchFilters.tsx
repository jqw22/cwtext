import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, X, Filter } from 'lucide-react';

interface SearchFiltersProps {
  /** Only signed-in readers get the search box; visitors just see the filters */
  canSearch: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  /** The chosen volume and text, shown as removable filters */
  filters: { label: string; onRemove: () => void }[];
  /** Clear the search text and every filter at once */
  onClearAll: () => void;
}

/** The search box and the row of active filters */
export function SearchFilters({ canSearch, search, onSearchChange, filters, onClearAll }: SearchFiltersProps) {
  const hasActiveFilters = filters.length > 0 || search.trim().length > 0;

  return (
    <div className="space-y-4">
      {/* Search input */}
      {canSearch && (
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
      )}

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
          {filters.map((filter) => (
            <Badge
              key={filter.label}
              variant="default"
              className="cursor-pointer gap-1 text-xs max-w-full whitespace-normal text-left"
              onClick={filter.onRemove}
            >
              {filter.label}
              <X className="h-3 w-3" />
            </Badge>
          ))}
          <button
            onClick={onClearAll}
            className="text-xs text-muted-foreground hover:text-foreground underline ml-1"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}
