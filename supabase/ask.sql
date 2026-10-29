-- AI search ("Ask"). Paste into the Supabase SQL editor once, after profiles.sql.
-- Counts each reader's questions per day, so the Claude bill stays small.

create table public.ask_usage (
  user_id uuid not null references auth.users on delete cascade,
  day date not null default current_date,
  questions int not null default 0,
  primary key (user_id, day)
);

alter table public.ask_usage enable row level security;

create policy "Readers can see their own questions count"
on public.ask_usage for select
to authenticated
using (user_id = auth.uid());

-- Called by the "ask" Edge Function before each question. Counts the question
-- and returns how many are left today, or -1 once the reader is over the limit.
create function public.use_ask_quota(daily_limit int) returns int
language plpgsql security definer set search_path = '' as $$
declare
  used int;
begin
  if auth.uid() is null then
    return -1;
  end if;
  insert into public.ask_usage (user_id, day, questions)
  values (auth.uid(), current_date, 1)
  on conflict (user_id, day) do update set questions = public.ask_usage.questions + 1
  returning questions into used;
  return case when used > daily_limit then -1 else daily_limit - used end;
end;
$$;

revoke execute on function public.use_ask_quota(int) from public, anon;
grant execute on function public.use_ask_quota(int) to authenticated;
