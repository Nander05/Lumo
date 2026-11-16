-- Rapporten via e-mail: elk lid krijgt een eigen geheime sleutel en een eigen postvak voor binnenkomende CSV-rapporten.
-- Voer dit eenmalig uit in de SQL Editor. Mag opnieuw uitgevoerd worden.
create table if not exists public.inbox_keys (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  key_hash   text not null,
  created_at timestamptz not null default now()
);
alter table public.inbox_keys enable row level security;  -- geen policies: alleen de functie en onderstaande rpc kunnen erbij

create table if not exists public.report_inbox (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  filename     text not null default '',
  subject      text not null default '',
  body         text not null check (length(body) < 1500000),
  content_hash text not null,
  created_at   timestamptz not null default now(),
  unique (user_id, content_hash)
);
create index if not exists report_inbox_user on public.report_inbox (user_id, created_at desc);
alter table public.report_inbox enable row level security;
drop policy if exists inbox_sel on public.report_inbox;
drop policy if exists inbox_del on public.report_inbox;
create policy inbox_sel on public.report_inbox for select to authenticated using (user_id = auth.uid());
create policy inbox_del on public.report_inbox for delete to authenticated using (user_id = auth.uid());

create or replace function public.inbox_set_key(p_hash text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'niet ingelogd'; end if;
  if p_hash is null or p_hash !~ '^[0-9a-f]{64}$' then raise exception 'ongeldige sleutel'; end if;
  insert into public.inbox_keys (user_id, key_hash) values (auth.uid(), p_hash)
  on conflict (user_id) do update set key_hash = excluded.key_hash, created_at = now();
end $$;
revoke all on function public.inbox_set_key(text) from public;
grant execute on function public.inbox_set_key(text) to authenticated;

create or replace function public.inbox_has_key() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.inbox_keys where user_id = auth.uid());
$$;
revoke all on function public.inbox_has_key() from public;
grant execute on function public.inbox_has_key() to authenticated;
