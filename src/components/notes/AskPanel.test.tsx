import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TestApp } from '@/test/TestApp';
import type { StructuredNote } from '@/hooks/useStructuredNotes';
import { AskPanel } from './AskPanel';

const invoke = vi.fn();
vi.mock('@/lib/supabase', () => ({ supabase: { functions: { invoke: (...args: unknown[]) => invoke(...args) } } }));

const note = (id: string, title: string, content: string): StructuredNote =>
  ({ id, title, content, tags: [], workId: null, createdAt: 0, order: 0 });

describe('AskPanel', () => {
  it('shows the paragraphs Claude picks, with why each fits', async () => {
    invoke.mockResolvedValue({
      data: {
        summary: 'Jung ties the anima to the mother image.',
        passages: [{ id: 'b', why: 'Names the mother as the first carrier of the anima.' }, { id: 'gone', why: 'Missing.' }],
        remaining: 19,
      },
      error: null,
    });
    render(
      <TestApp>
        <AskPanel notes={[note('a', '1', 'Unrelated.'), note('b', '2', 'The mother is the first anima figure.')]} />
      </TestApp>,
    );

    fireEvent.change(screen.getByPlaceholderText(/Ask a question/), { target: { value: 'anima and mother' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ask' }));

    await waitFor(() => expect(screen.getByText('Jung ties the anima to the mother image.')).toBeInTheDocument());
    expect(invoke).toHaveBeenCalledWith('ask', { body: { question: 'anima and mother' } });
    expect(screen.getByText('The mother is the first anima figure.')).toBeInTheDocument();
    expect(screen.getByText('Names the mother as the first carrier of the anima.')).toBeInTheDocument();
    expect(screen.queryByText('Unrelated.')).not.toBeInTheDocument();
    expect(screen.queryByText('Missing.')).not.toBeInTheDocument();
    expect(screen.getByText('19 questions left today')).toBeInTheDocument();
  });
});
