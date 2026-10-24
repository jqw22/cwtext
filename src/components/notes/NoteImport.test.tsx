import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TestApp } from '@/test/TestApp';
import { NoteImport } from './NoteImport';

describe('NoteImport', () => {
  it('previews the notes in a file', async () => {
    render(
      <TestApp>
        <NoteImport existingNotes={[]} onClose={() => {}} />
      </TestApp>,
    );

    const file = new File(['575\nFirst paragraph.\n(1) A footnote.\n576\nSecond paragraph.'], 'notes.txt', { type: 'text/plain' });
    await screen.findByText('Import Notes');
    fireEvent.change(document.querySelector('input[type="file"]')!, { target: { files: [file] } });

    await waitFor(() => expect(screen.getByText('Publish 2 notes')).toBeInTheDocument());
    expect(screen.getByText(/First paragraph\.\s+\(1\) A footnote\./)).toBeInTheDocument();
  });
});
