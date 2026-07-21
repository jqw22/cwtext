import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { X, Plus, Loader2, Hash, Check, Globe } from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import { cn } from '@/lib/utils';

interface NoteFormProps {
  /** Initial values for editing */
  initialTitle?: string;
  initialContent?: string;
  initialTags?: string[];
  initialOrder?: string;
  /** Existing tags from all notes, with counts — shown as suggestions */
  availableTags?: Map<string, number>;
  onSubmit: (data: {
    title: string;
    content: string;
    tags: string[];
    order?: string;
  }) => Promise<void>;
  onCancel?: () => void;
  isSubmitting?: boolean;
}

export function NoteForm({
  initialTitle = '',
  initialContent = '',
  initialTags = [],
  initialOrder = '',
  availableTags,
  onSubmit,
  onCancel,
  isSubmitting = false,
}: NoteFormProps) {
  const [title, setTitle] = useState(initialTitle);
  const [order, setOrder] = useState(initialOrder);
  const [content, setContent] = useState(initialContent);
  const [tags, setTags] = useState<string[]>(initialTags);
  const [tagInput, setTagInput] = useState('');
  const [tagSearch, setTagSearch] = useState('');
  const { toast } = useToast();

  const handleAddTag = (tag?: string) => {
    const trimmed = (tag ?? tagInput).trim().toLowerCase();
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
      setTagInput('');
    }
  };

  const handleTagKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  };

  const removeTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      toast({
        title: 'Para. required',
        description: 'Please enter a paragraph label.',
        variant: 'destructive',
      });
      return;
    }

    if (!content.trim()) {
      toast({
        title: 'Content required',
        description: 'Please enter the text content for your note.',
        variant: 'destructive',
      });
      return;
    }

    let orderValue: string | undefined;
    if (order.trim()) {
      const parsed = parseFloat(order);
      if (isNaN(parsed)) {
        toast({
          title: 'Invalid order',
          description: 'Order must be a number to one decimal place, e.g. 1.0',
          variant: 'destructive',
        });
        return;
      }
      orderValue = parsed.toFixed(1);
    }

    await onSubmit({
      title: title.trim(),
      content: content.trim(),
      tags,
      order: orderValue,
    });
  };

  // Filter and sort available tags for suggestions
  const suggestedTags = useMemo(() => {
    if (!availableTags || availableTags.size === 0) return [];

    const entries = Array.from(availableTags.entries());

    // Filter by tag search
    const filtered = tagSearch.trim()
      ? entries.filter(([t]) => t.includes(tagSearch.toLowerCase()))
      : entries;

    // Sort: selected first, then by count desc, then alpha
    return filtered
      .sort((a, b) => {
        const aSel = tags.includes(a[0]) ? -1 : 1;
        const bSel = tags.includes(b[0]) ? -1 : 1;
        if (aSel !== bSel) return aSel - bSel;
        if (b[1] !== a[1]) return b[1] - a[1];
        return a[0].localeCompare(b[0]);
      })
      .slice(0, 50); // cap at 50
  }, [availableTags, tagSearch, tags]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{initialTitle ? 'Edit Note' : 'New Note'}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Para. label */}
          <div className="space-y-2">
            <label htmlFor="note-title" className="text-sm font-medium">
              Para.
            </label>
            <Input
              id="note-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Introduction, 0 - Notes, 456n"
              disabled={isSubmitting}
            />
          </div>

          {/* Order number (for sequencing) */}
          <div className="space-y-2">
            <label htmlFor="note-order" className="text-sm font-medium text-muted-foreground">
              Order <span className="text-xs font-normal">(use para. for correct sorting)</span>
            </label>
            <Input
              id="note-order"
              type="number"
              step="0.1"
              min="0"
              value={order}
              onChange={(e) => setOrder(e.target.value)}
              placeholder="e.g. 1.0"
              disabled={isSubmitting}
            />
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Tags</label>

            {/* Type a new tag */}
            <div className="flex gap-2">
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                placeholder="Type a new tag and press Enter..."
                disabled={isSubmitting}
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => handleAddTag()}
                disabled={isSubmitting || !tagInput.trim()}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {/* Selected tags */}
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary text-primary-foreground"
                  >
                    #{tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="hover:opacity-70 transition-opacity"
                      disabled={isSubmitting}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Existing tags to pick from */}
            {availableTags && availableTags.size > 0 && (
              <div className="mt-3 bg-muted/30 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Globe className="h-3 w-3" />
                    <span>Existing tags from all notes</span>
                  </div>
                  {availableTags.size > 15 && (
                    <div className="relative w-36">
                      <Hash className="absolute left-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                      <Input
                        value={tagSearch}
                        onChange={(e) => setTagSearch(e.target.value)}
                        placeholder="Search tags..."
                        className="h-6 text-[11px] pl-5"
                      />
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                  {suggestedTags.map(([tag, count]) => {
                    const isSelected = tags.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() =>
                          isSelected ? removeTag(tag) : handleAddTag(tag)
                        }
                        disabled={isSubmitting}
                        className={cn(
                          'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-all border',
                          isSelected
                            ? 'bg-primary/15 text-primary border-primary/40'
                            : 'bg-background text-muted-foreground border-border hover:border-primary/30 hover:text-foreground',
                        )}
                      >
                        {isSelected && <Check className="h-3 w-3" />}
                        #{tag}
                        <span className={cn(
                          'text-[10px]',
                          isSelected ? 'opacity-70' : 'opacity-50',
                        )}>
                          {count}
                        </span>
                      </button>
                    );
                  })}
                  {suggestedTags.length === 0 && tagSearch.trim() && (
                    <p className="text-xs text-muted-foreground italic">
                      No tags match "{tagSearch}"
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Content */}
          <div className="space-y-2">
            <label htmlFor="note-content" className="text-sm font-medium">
              Content
            </label>
            <Textarea
              id="note-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write your note content here..."
              rows={12}
              disabled={isSubmitting}
              className="min-h-[200px]"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2 justify-end">
            {onCancel && (
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
            )}
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {initialTitle ? 'Update Note' : 'Publish Note'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
