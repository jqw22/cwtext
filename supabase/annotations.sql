-- Readers' margin notes. Paste into the Supabase SQL editor once, after profiles.sql.
-- Each note belongs to one reader and only that reader can see or change it.
-- A note marks some words of a paragraph (by character position, with the
-- words kept in `quote` in case the paragraph is edited), or the whole
-- paragraph when the positions are empty.

create table public.annotations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  note_slug text not null references public.notes (slug) on update cascade on delete cascade,
  quote text not null default '',
  start_offset int,
  end_offset int,
  body text not null check (char_length(body) between 1 and 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint annotations_range check (
    (start_offset is null) = (end_offset is null)
    and (start_offset is null or (start_offset >= 0 and start_offset < end_offset))
  )
);

create index annotations_user_note_idx on public.annotations (user_id, note_slug);

create trigger annotations_touch_updated_at
before update on public.annotations
for each row execute function public.touch_updated_at();

alter table public.annotations enable row level security;

create policy "Readers can see their own notes"
on public.annotations for select
to authenticated
using (user_id = auth.uid());

create policy "Readers can add their own notes"
on public.annotations for insert
to authenticated
with check (user_id = auth.uid());

create policy "Readers can edit their own notes"
on public.annotations for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "Readers can delete their own notes"
on public.annotations for delete
to authenticated
using (user_id = auth.uid());
