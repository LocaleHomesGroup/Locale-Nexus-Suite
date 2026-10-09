-- OPTIONAL. Schedules the mirror from Supabase instead of Vercel cron, for a host without
-- frequent crons (Vercel Hobby allows one run a day). Run as the project owner in the SQL
-- editor after enabling the pg_cron and pg_net extensions (Database > Extensions). In Jerry's
-- production project that's his call: ask first.
--
-- 1. Keep the cron secret in Vault (the same value as the app's CRON_SECRET):
--      select vault.create_secret('<CRON_SECRET>', 'launchpad_cron_secret');
-- 2. Replace every https://<app-host> below with the app's address, then run the rest.
--    Running it again replaces the jobs of the same name.
-- All times are UTC: 18:30 UTC is 02:30 in Perth.
--
-- Afterwards:
--   our jobs:      select jobname, schedule, active from cron.job where jobname like 'launchpad-%';
--   the replies:   select created, status_code, left(content, 200) from net._http_response order by created desc limit 20;
--   stop one:      select cron.unschedule('launchpad-monday-files');
--
-- Behind Vercel Deployment Protection? Then Vercel answers these calls itself (a 401 page) and
-- they never reach our routes. Keep the project's Protection Bypass for Automation secret in
-- Vault the same way, and add 'x-vercel-protection-bypass', <that secret> to each job's headers.

select cron.schedule('launchpad-monday-changes', '*/5 * * * *', $$
  select net.http_get(
    url := 'https://<app-host>/api/mirror/monday?mode=changes',
    headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'launchpad_cron_secret')),
    timeout_milliseconds := 300000)
$$);

select cron.schedule('launchpad-monday-files', '*/15 * * * *', $$
  select net.http_get(
    url := 'https://<app-host>/api/mirror/monday?mode=files',
    headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'launchpad_cron_secret')),
    timeout_milliseconds := 300000)
$$);

select cron.schedule('launchpad-monday-safety', '30 18 * * *', $$
  select net.http_get(
    url := 'https://<app-host>/api/mirror/monday?mode=safety',
    headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'launchpad_cron_secret')),
    timeout_milliseconds := 300000)
$$);

select cron.schedule('launchpad-monday-sweep', '0 19 * * 0', $$
  select net.http_get(
    url := 'https://<app-host>/api/mirror/monday?mode=sweep',
    headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'launchpad_cron_secret')),
    timeout_milliseconds := 300000)
$$);

select cron.schedule('launchpad-hubspot-changes', '*/10 * * * *', $$
  select net.http_get(
    url := 'https://<app-host>/api/mirror/hubspot?mode=changes',
    headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'launchpad_cron_secret')),
    timeout_milliseconds := 300000)
$$);

select cron.schedule('launchpad-land-settle', '*/5 * * * *', $$
  select net.http_get(
    url := 'https://<app-host>/api/land/settle',
    headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'launchpad_cron_secret')),
    timeout_milliseconds := 60000)
$$);
