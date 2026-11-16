-- Elk uur wordt de push-functie aangeroepen; die stuurt alleen op de ingestelde tijd van elk lid.
-- Vervang JOUW-GEHEIM door dezelfde waarde als PUSH_CRON_SECRET in de Edge Function secrets.
select cron.unschedule('lumo-push') where exists (select 1 from cron.job where jobname = 'lumo-push');
select cron.schedule('lumo-push', '0 * * * *', $$
  select net.http_post(
    url := 'https://wedefceaglmsvtewnzkj.supabase.co/functions/v1/push',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', 'JOUW-GEHEIM'),
    body := '{"action":"cron"}'::jsonb
  );
$$);
