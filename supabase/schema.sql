-- Lumo web: database voor Supabase.
-- Plak dit hele bestand in Supabase > SQL Editor > New query > Run. Eén keer uitvoeren.
-- Elk team is volledig gescheiden van andere teams (rij-beveiliging per team).

create extension if not exists pgcrypto;

-- ---------- tabellen ----------
create table if not exists public.teams (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 2 and 80),
  invite_code text not null unique default encode(gen_random_bytes(5), 'hex'),
  created_at  timestamptz not null default now()
);

create table if not exists public.members (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  team_id      uuid not null references public.teams (id) on delete cascade,
  role         text not null default 'member' check (role in ('admin', 'member')),
  display_name text not null default '',
  created_at   timestamptz not null default now()
);
create index if not exists members_team on public.members (team_id);

-- Eén tabel voor alle app-gegevens: path = collectie, id = document.
create table if not exists public.docs (
  team_id    uuid not null references public.teams (id) on delete cascade,
  path       text not null,
  id         text not null,
  data       jsonb not null default '{}'::jsonb check (pg_column_size(data) < 400000),
  updated_at timestamptz not null default now(),
  primary key (team_id, path, id)
);
create index if not exists docs_path on public.docs (team_id, path);

create table if not exists public.ai_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  month   text not null,
  calls   int  not null default 0,
  primary key (user_id, month)
);

create or replace function public.touch_updated() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists docs_touch on public.docs;
create trigger docs_touch before insert or update on public.docs for each row execute function public.touch_updated();

-- ---------- hulpfuncties ----------
create or replace function public.my_team() returns uuid
language sql stable security definer set search_path = public as $$
  select team_id from public.members where user_id = auth.uid()
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'admin' from public.members where user_id = auth.uid()), false)
$$;

-- Wie mag welk document lezen of schrijven? Dit zijn dezelfde regels als in de claude.ai-versie.
--   eigen privé-gegevens ........ alleen jijzelf
--   library, training, playbook, agenda, challenge, kudos, campaigns ... iedereen leest, beheerder schrijft
--   board, mentors .............. iedereen leest, ieder schrijft alleen het eigen document
--   shares, campshares, help .... beheerder leest alles, ieder leest en schrijft alleen het eigen document
create or replace function public.doc_can(p_path text, p_id text, p_write boolean) returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when auth.uid() is null then false
    when p_path = 'data/users/' || auth.uid()::text then true
    when p_path in ('library', 'training', 'playbook', 'agenda', 'challenge', 'kudos', 'campaigns')
      then (not p_write) or public.is_admin()
    when p_path in ('board', 'mentors')
      then (not p_write) or p_id = auth.uid()::text
    when p_path in ('shares', 'campshares', 'help')
      then case when p_write then p_id = auth.uid()::text else (public.is_admin() or p_id = auth.uid()::text) end
    else false
  end
$$;

-- ---------- rij-beveiliging ----------
alter table public.teams    enable row level security;
alter table public.members  enable row level security;
alter table public.docs     enable row level security;
alter table public.ai_usage enable row level security;

drop policy if exists teams_admin on public.teams;
create policy teams_admin on public.teams for select using (id = public.my_team() and public.is_admin());

drop policy if exists members_read on public.members;
create policy members_read on public.members for select
  using (user_id = auth.uid() or (team_id = public.my_team() and public.is_admin()));

drop policy if exists docs_select on public.docs;
create policy docs_select on public.docs for select
  using (team_id = public.my_team() and public.doc_can(path, id, false));
drop policy if exists docs_insert on public.docs;
create policy docs_insert on public.docs for insert
  with check (team_id = public.my_team() and public.doc_can(path, id, true));
drop policy if exists docs_update on public.docs;
create policy docs_update on public.docs for update
  using (team_id = public.my_team() and public.doc_can(path, id, true))
  with check (team_id = public.my_team() and public.doc_can(path, id, true));
drop policy if exists docs_delete on public.docs;
create policy docs_delete on public.docs for delete
  using (team_id = public.my_team() and public.doc_can(path, id, true));

drop policy if exists usage_own on public.ai_usage;
create policy usage_own on public.ai_usage for select using (user_id = auth.uid());

-- ---------- teams maken, deelnemen, beheren ----------
create or replace function public.team_info() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare m public.members; t public.teams; list jsonb;
begin
  select * into m from public.members where user_id = auth.uid();
  if not found then return null; end if;
  select * into t from public.teams where id = m.team_id;
  if m.role = 'admin' then
    select coalesce(jsonb_agg(jsonb_build_object('user_id', x.user_id, 'name', x.display_name, 'role', x.role) order by x.created_at), '[]'::jsonb)
      into list from public.members x where x.team_id = m.team_id;
  end if;
  return jsonb_build_object('team_id', t.id, 'team_name', t.name, 'role', m.role, 'display_name', m.display_name,
    'invite_code', case when m.role = 'admin' then t.invite_code end, 'members', list);
end $$;

create or replace function public.create_team(p_team text, p_name text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare tid uuid;
begin
  if auth.uid() is null then raise exception 'Niet ingelogd'; end if;
  if exists (select 1 from public.members where user_id = auth.uid()) then raise exception 'Je zit al in een team'; end if;
  if char_length(trim(coalesce(p_team, ''))) < 2 then raise exception 'Geef je team een naam'; end if;
  insert into public.teams (name) values (left(trim(p_team), 80)) returning id into tid;
  insert into public.members (user_id, team_id, role, display_name) values (auth.uid(), tid, 'admin', left(trim(coalesce(p_name, '')), 60));
  return public.team_info();
end $$;

create or replace function public.join_team(p_code text, p_name text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare tid uuid;
begin
  if auth.uid() is null then raise exception 'Niet ingelogd'; end if;
  if exists (select 1 from public.members where user_id = auth.uid()) then raise exception 'Je zit al in een team'; end if;
  select id into tid from public.teams where invite_code = lower(trim(coalesce(p_code, '')));
  if tid is null then raise exception 'Deze uitnodigingscode kennen we niet'; end if;
  insert into public.members (user_id, team_id, role, display_name) values (auth.uid(), tid, 'member', left(trim(coalesce(p_name, '')), 60));
  return public.team_info();
end $$;

create or replace function public.regenerate_invite() returns text
language plpgsql security definer set search_path = public as $$
declare c text;
begin
  if not public.is_admin() then raise exception 'Alleen de beheerder kan dit'; end if;
  c := encode(gen_random_bytes(5), 'hex');
  update public.teams set invite_code = c where id = public.my_team();
  return c;
end $$;

create or replace function public.set_member_role(p_user uuid, p_role text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Alleen de beheerder kan dit'; end if;
  if p_role not in ('admin', 'member') then raise exception 'Onbekende rol'; end if;
  if p_role = 'member' and (select count(*) from public.members where team_id = public.my_team() and role = 'admin') <= 1
     and exists (select 1 from public.members where user_id = p_user and role = 'admin') then
    raise exception 'Er moet minstens één beheerder blijven';
  end if;
  update public.members set role = p_role where user_id = p_user and team_id = public.my_team();
end $$;

-- Gegevens van één lid in het team opruimen (privé-documenten en eigen documenten).
create or replace function public.purge_member_docs(p_team uuid, p_user uuid) returns void
language sql security definer set search_path = public as $$
  delete from public.docs where team_id = p_team
    and (path = 'data/users/' || p_user::text
         or (path in ('board', 'mentors', 'shares', 'campshares', 'help') and id = p_user::text));
$$;
revoke all on function public.purge_member_docs(uuid, uuid) from public, anon, authenticated;

create or replace function public.remove_member(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Alleen de beheerder kan dit'; end if;
  if p_user = auth.uid() then raise exception 'Gebruik "account verwijderen" voor jezelf'; end if;
  if not exists (select 1 from public.members where user_id = p_user and team_id = public.my_team()) then raise exception 'Dit lid zit niet in jouw team'; end if;
  perform public.purge_member_docs(public.my_team(), p_user);
  delete from public.members where user_id = p_user and team_id = public.my_team();
end $$;

-- Eigen account en alle eigen gegevens definitief verwijderen (AVG: recht op vergetelheid).
create or replace function public.delete_me() returns void
language plpgsql security definer set search_path = public, auth as $$
declare m public.members;
begin
  if auth.uid() is null then raise exception 'Niet ingelogd'; end if;
  select * into m from public.members where user_id = auth.uid();
  if found then
    if m.role = 'admin' and (select count(*) from public.members where team_id = m.team_id and role = 'admin') <= 1
       and (select count(*) from public.members where team_id = m.team_id) > 1 then
      raise exception 'Maak eerst een ander lid beheerder, of verwijder de andere leden';
    end if;
    perform public.purge_member_docs(m.team_id, auth.uid());
    delete from public.members where user_id = auth.uid();
    if not exists (select 1 from public.members where team_id = m.team_id) then delete from public.teams where id = m.team_id; end if;
  end if;
  delete from auth.users where id = auth.uid();
end $$;

-- AI-gebruik tellen en begrenzen (alleen de server-functie mag dit aanroepen).
create or replace function public.ai_use(p_user uuid, p_limit int) returns boolean
language plpgsql security definer set search_path = public as $$
declare n int; mk text := to_char(now() at time zone 'utc', 'YYYY-MM');
begin
  insert into public.ai_usage (user_id, month, calls) values (p_user, mk, 0) on conflict do nothing;
  update public.ai_usage set calls = calls + 1 where user_id = p_user and month = mk and calls < p_limit returning calls into n;
  return n is not null;
end $$;
revoke all on function public.ai_use(uuid, int) from public, anon, authenticated;

-- ---------- rechten voor de ingelogde app ----------
revoke all on public.teams, public.members, public.docs, public.ai_usage from anon, authenticated;
grant select on public.teams, public.members, public.ai_usage to authenticated;
grant select, insert, update, delete on public.docs to authenticated;
grant execute on function public.team_info(), public.create_team(text, text), public.join_team(text, text),
  public.regenerate_invite(), public.set_member_role(uuid, text), public.remove_member(uuid), public.delete_me() to authenticated;
grant execute on function public.my_team(), public.is_admin(), public.doc_can(text, text, boolean) to authenticated;

-- Live bijwerken (zodat een nieuwe campagne meteen bij leden verschijnt).
do $$ begin
  alter publication supabase_realtime add table public.docs;
exception when others then null;
end $$;
