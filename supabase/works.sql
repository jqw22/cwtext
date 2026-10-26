-- Jung's works, for chronology. Paste into the Supabase SQL editor once, after schema.sql.
-- Anyone may read volumes and works; only curators may change them.

-- The volumes of the Collected Works (English edition), e.g. 9.1 for 9 Part I
create table public.volumes (
  -- As written on the spine: '5', '9.1', '9.2'
  number text primary key,
  -- Numeric order, so 9.1 and 9.2 sort between 8 and 10
  sort_order numeric(4, 1) not null unique,
  title text not null,
  -- Year the English volume first appeared
  year_published int,
  notes text not null default ''
);

-- One row per essay or book. Each text a note can belong to is a work.
create table public.works (
  id uuid primary key default gen_random_uuid(),
  -- English title as used in the Collected Works
  title text not null,
  -- Title in the language Jung wrote it in
  original_title text,
  -- Language Jung wrote it in, e.g. German, English, French
  original_language text,
  -- Kind of text: essay, book, lecture, seminar, letter, foreword, …
  kind text not null default 'essay',
  volume text references public.volumes (number) on update cascade,
  -- First and last paragraph numbers in the volume
  para_from int,
  para_to int,
  -- Years written and first published, in any language. A range or an
  -- uncertain date goes in the *_note column, e.g. 'begun 1909, finished 1911'
  year_written int,
  year_written_note text,
  year_first_published int,
  year_first_published_note text,
  -- Where it first appeared, e.g. a journal or book
  first_published_in text,
  -- Later revisions, e.g. '1952: rewritten as Symbole der Wandlung'
  revisions text,
  notes text not null default '',
  -- The text (tag) its notes carry, so works and notes match up
  tag text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint works_para_range check (para_from is null or para_to is null or para_from <= para_to)
);

create index works_volume_idx on public.works (volume, para_from);

create trigger works_touch_updated_at
before update on public.works
for each row execute function public.touch_updated_at();

alter table public.volumes enable row level security;
alter table public.works enable row level security;

create policy "Anyone can read volumes" on public.volumes for select to anon, authenticated using (true);
create policy "Curators can add volumes" on public.volumes for insert to authenticated with check (public.is_curator());
create policy "Curators can edit volumes" on public.volumes for update to authenticated
  using (public.is_curator()) with check (public.is_curator());
create policy "Curators can delete volumes" on public.volumes for delete to authenticated using (public.is_curator());

create policy "Anyone can read works" on public.works for select to anon, authenticated using (true);
create policy "Curators can add works" on public.works for insert to authenticated with check (public.is_curator());
create policy "Curators can edit works" on public.works for update to authenticated
  using (public.is_curator()) with check (public.is_curator());
create policy "Curators can delete works" on public.works for delete to authenticated using (public.is_curator());

-- The Collected Works volumes, with the year each first appeared in English
insert into public.volumes (number, sort_order, title, year_published) values
  ('1', 1, 'Psychiatric Studies', 1957),
  ('2', 2, 'Experimental Researches', 1973),
  ('3', 3, 'The Psychogenesis of Mental Disease', 1960),
  ('4', 4, 'Freud and Psychoanalysis', 1961),
  ('5', 5, 'Symbols of Transformation', 1956),
  ('6', 6, 'Psychological Types', 1971),
  ('7', 7, 'Two Essays on Analytical Psychology', 1953),
  ('8', 8, 'The Structure and Dynamics of the Psyche', 1960),
  ('9.1', 9.1, 'The Archetypes and the Collective Unconscious', 1959),
  ('9.2', 9.2, 'Aion: Researches into the Phenomenology of the Self', 1959),
  ('10', 10, 'Civilization in Transition', 1964),
  ('11', 11, 'Psychology and Religion: West and East', 1958),
  ('12', 12, 'Psychology and Alchemy', 1953),
  ('13', 13, 'Alchemical Studies', 1967),
  ('14', 14, 'Mysterium Coniunctionis', 1963),
  ('15', 15, 'The Spirit in Man, Art, and Literature', 1966),
  ('16', 16, 'The Practice of Psychotherapy', 1954),
  ('17', 17, 'The Development of Personality', 1954),
  ('18', 18, 'The Symbolic Life', 1976),
  ('19', 19, 'General Bibliography', 1979),
  ('20', 20, 'General Index', 1979);

-- The texts that already have notes. Check and correct these on the Works page.
insert into public.works (
  title, original_title, original_language, kind, volume, para_from, para_to,
  year_written, year_first_published, first_published_in, revisions, tag
) values
  ('Symbols of Transformation: Introduction', 'Wandlungen und Symbole der Libido: Einleitung', 'German',
   'essay', '5', 1, 3, null, 1911, 'Jahrbuch für psychoanalytische und psychopathologische Forschungen',
   '1952: revised as Symbole der Wandlung', '05 - symbols of transformation - introduction'),
  ('Two Kinds of Thinking', 'Über die zwei Arten des Denkens', 'German',
   'essay', '5', 4, 46, null, 1911, 'Jahrbuch für psychoanalytische und psychopathologische Forschungen',
   '1952: revised as Symbole der Wandlung', '05 - two kinds of thinking'),
  ('The Psychological Aspects of the Kore', 'Zum psychologischen Aspekt der Korefigur', 'German',
   'essay', '9.1', 306, 383, null, 1941, 'C. G. Jung and K. Kerényi, Das göttliche Mädchen',
   null, '09.1 - the psychological aspects of the kore'),
  ('Answer to Job', 'Antwort auf Hiob', 'German',
   'book', '11', 553, 758, 1951, 1952, 'Rascher, Zurich',
   null, '11 - answer to job');
