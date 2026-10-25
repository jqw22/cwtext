import { nip19 } from 'nostr-tools';
import { Navigate, useLocation, useParams } from 'react-router-dom';
import NotFound from './NotFound';

/** The note identifier in an old /naddr1… link, if it is one */
function slugFromNaddr(identifier: string): string | undefined {
  try {
    const decoded = nip19.decode(identifier);
    if (decoded.type === 'naddr' && decoded.data.kind === 30023) return decoded.data.identifier;
  } catch {
    // Not a Nostr address
  }
  return undefined;
}

/**
 * Notes used to live at /naddr1…, their Nostr address. Send those links to
 * the note's new address, which uses the same identifier.
 */
export function LegacyNoteRedirect() {
  const { nip19: identifier = '' } = useParams<{ nip19: string }>();
  const location = useLocation();
  const slug = slugFromNaddr(identifier);

  if (!slug) return <NotFound />;
  return <Navigate to={`/note/${encodeURIComponent(slug)}`} state={location.state} replace />;
}
