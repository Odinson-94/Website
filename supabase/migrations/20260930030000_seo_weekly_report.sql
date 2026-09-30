-- Private send ledger. Concurrent cron invocations cannot send the same week twice.
create table if not exists public.seo_report_deliveries (
  period date not null,
  recipient text not null,
  status text not null check (status in ('preparing','dispatching','accepted','unconfirmed')),
  subject text,
  data_through date,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  error text,
  primary key (period, recipient)
);
alter table public.seo_report_deliveries enable row level security;
revoke all on public.seo_report_deliveries from anon, authenticated;
grant all on public.seo_report_deliveries to service_role;
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

-- The deployment supplies seo_weekly_report_token through Vault, never source.
-- 01:00 UTC Sunday is 09:00 Australia/Perth (no daylight saving).
select cron.schedule('adelphos-seo-weekly-report','0 1 * * 0', $job$
  select net.http_post(
    url := 'https://owebjrorrthysyeodkku.supabase.co/functions/v1/seo-weekly-report',
    headers := jsonb_build_object('Content-Type','application/json','Authorization',
      'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name='seo_weekly_report_token')),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
$job$);
