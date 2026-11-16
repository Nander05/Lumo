-- Pushmeldingen: voer dit eenmalig uit in de SQL Editor (na schema.sql). Mag opnieuw uitgevoerd worden.
create table if not exists public.push_subs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  tz         text not null default 'Europe/Brussels',
  hour       int  not null default 8 check (hour between 0 and 23),
  last_sent  date,
  created_at timestamptz not null default now()
);
create index if not exists push_subs_user on public.push_subs (user_id);
alter table public.push_subs enable row level security;

drop policy if exists push_own_select on public.push_subs;
drop policy if exists push_own_insert on public.push_subs;
drop policy if exists push_own_update on public.push_subs;
drop policy if exists push_own_delete on public.push_subs;
create policy push_own_select on public.push_subs for select to authenticated using (user_id = auth.uid());
create policy push_own_insert on public.push_subs for insert to authenticated with check (user_id = auth.uid());
create policy push_own_update on public.push_subs for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy push_own_delete on public.push_subs for delete to authenticated using (user_id = auth.uid());

create extension if not exists pg_cron;
create extension if not exists pg_net;
