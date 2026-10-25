import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { nip19 } from 'nostr-tools';
import { LegacyNoteRedirect } from './LegacyNoteRedirect';

function NoteSlug() {
  return <p>note page</p>;
}

describe('LegacyNoteRedirect', () => {
  it('sends an old naddr link to the note with the same identifier', () => {
    const naddr = nip19.naddrEncode({ kind: 30023, pubkey: 'a'.repeat(64), identifier: 'abc-123' });
    render(
      <MemoryRouter initialEntries={[`/${naddr}`]}>
        <Routes>
          <Route path="/note/abc-123" element={<NoteSlug />} />
          <Route path="/:nip19" element={<LegacyNoteRedirect />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText('note page')).toBeInTheDocument();
  });
});
