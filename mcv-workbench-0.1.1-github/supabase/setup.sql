-- MCV Workbench: cloud table for phone <-> laptop sync (Supabase, free plan).
-- Run once in Supabase → SQL Editor. Every app document is one row; "space" is a long secret code
-- that the app sends in the x-space header, so only devices that know it can read or write.
create table if not exists public.docs (
  space     text not null,
  path      text not null,
  body      jsonb not null default '{}'::jsonb,
  updated   timestamptz not null,
  deleted   boolean not null default false,
  synced_at timestamptz not null default clock_timestamp(),
  primary key (space, path)
);
create index if not exists docs_space_synced on public.docs (space, synced_at);

create or replace function public.docs_touch() returns trigger language plpgsql as $$
begin
  -- last edit wins: never let an older edit overwrite a newer one
  if tg_op = 'UPDATE' and new.updated < old.updated then return old; end if;
  new.synced_at := clock_timestamp();
  return new;
end $$;
drop trigger if exists docs_touch on public.docs;
create trigger docs_touch before insert or update on public.docs for each row execute function public.docs_touch();

alter table public.docs enable row level security;
create or replace function public.req_space() returns text language sql stable as
$$ select coalesce(current_setting('request.headers', true)::json->>'x-space', '') $$;
drop policy if exists docs_rw on public.docs;
create policy docs_rw on public.docs for all to anon, authenticated
  using (space = public.req_space() and length(space) >= 24)
  with check (space = public.req_space() and length(space) >= 24);
grant select, insert, update on public.docs to anon, authenticated;
