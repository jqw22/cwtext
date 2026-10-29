-- Reader accounts. Paste into the Supabase SQL editor once, after schema.sql.
-- Anyone can sign in with an email link; each account gets a private profile
-- row that only its owner can see or change. Curators stay in `curators`.

create table public.profiles (
  user_id uuid primary key references auth.users on delete cascade,
  -- The name shown to the reader in place of their email, if they set one
  display_name text check (char_length(display_name) <= 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_touch_updated_at
before update on public.profiles
for each row execute function public.touch_updated_at();

alter table public.profiles enable row level security;

create policy "Readers can see their own profile"
on public.profiles for select
to authenticated
using (user_id = auth.uid());

create policy "Readers can edit their own profile"
on public.profiles for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- Give every new account a profile row
create function public.create_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (user_id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.create_profile();

-- Accounts that signed in before this script ran
insert into public.profiles (user_id)
select id from auth.users
on conflict do nothing;

-- Lets a reader close their own account; everything they own goes with it.
-- Curators can't, so the site is never left without an editor by accident.
create function public.delete_my_account() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if public.is_curator() then
    raise exception 'Curator accounts can only be removed in the Supabase dashboard';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
