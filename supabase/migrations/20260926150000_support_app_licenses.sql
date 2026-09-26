-- Independent paid app entitlements. A Support subscription never changes the base plan.
create table if not exists public.adelphos_app_licenses (
  stripe_subscription_id text primary key,
  user_id text not null,
  email text not null,
  app_key text not null check (app_key = 'support'),
  plan_code text not null,
  livemode boolean not null,
  status text not null,
  paid_through timestamptz,
  cancel_at_period_end boolean not null default false,
  observed_at timestamptz not null,
  updated_at timestamptz not null default now()
);
create index if not exists adelphos_app_licenses_owner on public.adelphos_app_licenses(user_id, app_key, livemode);
alter table public.adelphos_app_licenses enable row level security;
revoke all on public.adelphos_app_licenses from anon, authenticated;
grant select, insert, update on public.adelphos_app_licenses to service_role;
create or replace function public.adelphos_record_support_license(p_record jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into adelphos_app_licenses(stripe_subscription_id,user_id,email,app_key,plan_code,livemode,status,paid_through,cancel_at_period_end,observed_at)
  values(p_record->>'stripe_subscription_id',p_record->>'user_id',p_record->>'email','support',p_record->>'plan_code',(p_record->>'livemode')::boolean,p_record->>'status',(p_record->>'paid_through')::timestamptz,(p_record->>'cancel_at_period_end')::boolean,(p_record->>'observed_at')::timestamptz)
  on conflict(stripe_subscription_id) do update set status=excluded.status,paid_through=excluded.paid_through,cancel_at_period_end=excluded.cancel_at_period_end,observed_at=excluded.observed_at,updated_at=now()
  where adelphos_app_licenses.observed_at <= excluded.observed_at
    and adelphos_app_licenses.user_id = excluded.user_id
    and adelphos_app_licenses.livemode = excluded.livemode;
end $$;
revoke all on function public.adelphos_record_support_license(jsonb) from public, anon, authenticated;
grant execute on function public.adelphos_record_support_license(jsonb) to service_role;
-- Publish exactly one approved, positive-price monthly billing-plan row per Stripe mode,
-- with metadata {"app_addon":"support","stripe_mode":"live"} and its verified Stripe Price.
-- Price and currency are commercial decisions; this migration creates no arbitrary price.
