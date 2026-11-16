-- Centrale bibliotheek voor alle teams. Voer dit eenmalig uit in de SQL Editor. Mag opnieuw uitgevoerd worden.
create table if not exists public.app_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.app_admins enable row level security;
drop policy if exists app_admins_self on public.app_admins;
create policy app_admins_self on public.app_admins for select to authenticated using (user_id = auth.uid());

create or replace function public.is_app_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.app_admins where user_id = auth.uid());
$$;
revoke all on function public.is_app_admin() from public;
grant execute on function public.is_app_admin() to authenticated;

create table if not exists public.global_docs (
  path       text not null,
  id         text not null,
  data       jsonb not null default '{}'::jsonb check (pg_column_size(data) < 400000),
  updated_at timestamptz not null default now(),
  primary key (path, id)
);
alter table public.global_docs enable row level security;
drop policy if exists global_read on public.global_docs;
drop policy if exists global_ins on public.global_docs;
drop policy if exists global_upd on public.global_docs;
drop policy if exists global_del on public.global_docs;
create policy global_read on public.global_docs for select to authenticated using (true);
create policy global_ins on public.global_docs for insert to authenticated with check (public.is_app_admin());
create policy global_upd on public.global_docs for update to authenticated using (public.is_app_admin()) with check (public.is_app_admin());
create policy global_del on public.global_docs for delete to authenticated using (public.is_app_admin());

create or replace function public.touch_global() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists global_touch on public.global_docs;
create trigger global_touch before update on public.global_docs for each row execute function public.touch_global();

do $$ begin
  alter publication supabase_realtime add table public.global_docs;
exception when duplicate_object then null; when undefined_object then null; end $$;

-- App-beheerder worden (alleen jij): vul hieronder je e-mailadres in en voer deze regel uit.
-- insert into public.app_admins select id from auth.users where email = 'JOUW-EMAIL';
