import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TestApp } from '@/test/TestApp';
import type { Annotation } from '@/lib/annotations';
import { AnnotatedText } from './AnnotatedText';

const insert = vi.fn().mockResolvedValue({ error: null });
vi.mock('@/lib/supabase', () => ({ supabase: { from: () => ({ insert }) } }));

const annotation: Annotation = {
  id: '1', note_slug: 'p1', quote: 'dark side', start_offset: 18, end_offset: 27,
  body: 'Compare the anima.', created_at: '', updated_at: '',
};

describe('AnnotatedText', () => {
  it('shows a note in the margin and marks its words', () => {
    render(
      <TestApp>
        <AnnotatedText noteSlug="p1" text="The shadow is the dark side of the personality." annotations={[annotation]} canAnnotate />
      </TestApp>,
    );
    expect(screen.getByText('Compare the anima.')).toBeInTheDocument();
    expect(screen.getByText('dark side', { selector: 'span' })).toHaveClass('underline');
  });

  it('adds a note on the whole paragraph', async () => {
    render(
      <TestApp>
        <AnnotatedText noteSlug="p1" text="Some text." canAnnotate />
      </TestApp>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Note' }));
    fireEvent.change(screen.getByPlaceholderText('Your note…'), { target: { value: '  My thought  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(insert).toHaveBeenCalledWith({
      note_slug: 'p1', quote: '', start_offset: null, end_offset: null, body: 'My thought',
    }));
  });
});
