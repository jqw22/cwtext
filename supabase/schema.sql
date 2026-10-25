-- cwtext note storage. Paste into the Supabase SQL editor once, on a new project.
-- Anyone may read notes; only accounts listed in `curators` may change them.

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  -- The note's Nostr `d` identifier, kept so existing links keep working
  slug text not null unique,
  -- The Para. label, e.g. 456n
  para text not null,
  -- Order within the list, to 1dp
  sort_order numeric(8, 1),
  -- Paragraph text in Markdown
  body text not null default '',
  -- The texts the paragraph belongs to, normalised to lower case
  tags text[] not null default '{}',
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Id of the last copy published to Nostr, if any
  nostr_event_id text
);

create index notes_sort_order_idx on public.notes (sort_order);
create index notes_tags_idx on public.notes using gin (tags);

create function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger notes_touch_updated_at
before update on public.notes
for each row execute function public.touch_updated_at();

-- Accounts allowed to edit notes. Add a row with your user id after signing in once:
--   insert into public.curators (user_id) select id from auth.users where email = 'you@example.com';
create table public.curators (
  user_id uuid primary key references auth.users on delete cascade
);

alter table public.curators enable row level security;
-- No policies: the table is invisible to the site and only checked through is_curator()

create function public.is_curator() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.curators where user_id = auth.uid());
$$;

alter table public.notes enable row level security;

create policy "Anyone can read notes"
on public.notes for select
to anon, authenticated
using (true);

create policy "Curators can add notes"
on public.notes for insert
to authenticated
with check (public.is_curator());

create policy "Curators can edit notes"
on public.notes for update
to authenticated
using (public.is_curator())
with check (public.is_curator());

create policy "Curators can delete notes"
on public.notes for delete
to authenticated
using (public.is_curator());
