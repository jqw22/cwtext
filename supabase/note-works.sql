-- Link each note to its work. Paste into the Supabase SQL editor once, after works.sql.
-- Notes are matched to works by the text (tag) they carry; a note whose text
-- has no work is left unlinked.

alter table public.notes
  add column work_id uuid references public.works (id) on delete set null;

create index notes_work_id_idx on public.notes (work_id, sort_order);

update public.notes n
set work_id = w.id
from public.works w
where n.work_id is null and w.tag = any (n.tags);

-- Notes still without a work, if any: add a work for their text and run the update again
select para, tags from public.notes where work_id is null order by sort_order;
