import { Link } from 'react-router-dom';
import type { WorkRow } from '@/lib/dbWorks';
import { cwReference } from '@/lib/works';

/** One line on a work: title, dates and place in the Collected Works */
export function WorkSummary({ work }: { work: WorkRow }) {
  const parts = [
    work.year_written !== null && `written ${work.year_written}`,
    work.year_first_published !== null && `first published ${work.year_first_published}`,
    work.original_language,
    cwReference(work),
  ].filter(Boolean);

  return (
    <p className="text-sm text-muted-foreground">
      <Link to="/works" className="font-medium text-foreground hover:underline">{work.title}</Link>
      {work.original_title && <span className="italic"> ({work.original_title})</span>}
      {parts.length > 0 && <> · {parts.join(' · ')}</>}
    </p>
  );
}
