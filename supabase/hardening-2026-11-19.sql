-- Aangescherpt op 19 nov 2026 na de beveiligingscontrole van Supabase.
-- De app roept deze functies alleen aan als iemand is ingelogd. Anoniem hoeft niet meer.
revoke execute on function public.create_team(text,text), public.delete_me(), public.doc_can(text,text,boolean), public.inbox_has_key(), public.inbox_set_key(text), public.is_admin(), public.is_app_admin(), public.join_team(text,text), public.my_team(), public.regenerate_invite(), public.remove_member(uuid), public.set_member_role(uuid,text), public.team_info() from public, anon;
grant execute on function public.create_team(text,text), public.delete_me(), public.doc_can(text,text,boolean), public.inbox_has_key(), public.inbox_set_key(text), public.is_admin(), public.is_app_admin(), public.join_team(text,text), public.my_team(), public.regenerate_invite(), public.remove_member(uuid), public.set_member_role(uuid,text), public.team_info() to authenticated, service_role;
alter function public.touch_updated() set search_path = public;
alter function public.touch_global() set search_path = public;
