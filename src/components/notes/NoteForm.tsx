import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import { WorkSelect } from '@/components/works/WorkSelect';
import type { VolumeRow, WorkRow } from '@/lib/dbWorks';

export interface NoteFormData {
  title: string;
  content: string;
  /** The text (work) the paragraph belongs to */
  workId: string | null;
  order?: string;
}

interface NoteFormProps {
  /** Initial values for editing */
  initialTitle?: string;
  initialContent?: string;
  initialWorkId?: string;
  initialOrder?: string;
  /** The volumes and works to choose the note's text from */
  volumes: VolumeRow[];
  works: WorkRow[];
  onSubmit: (data: NoteFormData) => Promise<void>;
  onCancel?: () => void;
  isSubmitting?: boolean;
}

export function NoteForm({
  initialTitle = '',
  initialContent = '',
  initialWorkId = '',
  initialOrder = '',
  volumes,
  works,
  onSubmit,
  onCancel,
  isSubmitting = false,
}: NoteFormProps) {
  const [title, setTitle] = useState(initialTitle);
  const [order, setOrder] = useState(initialOrder);
  const [content, setContent] = useState(initialContent);
  const [workId, setWorkId] = useState(initialWorkId);
  const { toast } = useToast();

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
      workId: workId || null,
      order: orderValue,
    });
  };

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

          {/* Text */}
          <div className="space-y-2">
            <label htmlFor="note-work" className="text-sm font-medium">Text</label>
            <WorkSelect
              id="note-work"
              volumes={volumes}
              works={works}
              value={workId}
              onChange={setWorkId}
              disabled={isSubmitting}
            />
            <p className="text-xs text-muted-foreground">
              A text that isn't listed can be added on the Works page.
            </p>
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
