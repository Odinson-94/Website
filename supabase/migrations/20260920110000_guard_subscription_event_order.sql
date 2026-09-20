-- Compare the licence read before the Stripe request with the version locked
-- here. Stale snapshots retry; replaced subscription IDs cannot revoke access.
alter table public.adelphos_user_licenses
  add column if not exists stripe_state_version bigint not null default 0;

create or replace function public.adelphos_apply_subscription_event(
  p_email text, p_expected_subscription_id text, p_expected_state_version bigint,
  p_subscription_id text, p_customer_id text, p_plan_code text, p_status text,
  p_current_period_start timestamptz, p_current_period_end timestamptz,
  p_cancel_at_period_end boolean, p_allow_binding boolean default false,
  p_invoice_id text default null
) returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_email text:=lower(trim(p_email));
  v_licence public.adelphos_user_licenses;
  v_grant jsonb;
begin
  if coalesce(v_email,'')='' or coalesce(p_subscription_id,'')='' or coalesce(p_customer_id,'')=''
    or p_expected_state_version is null or p_status is null
    or p_status not in ('active','trialing','past_due','canceled','incomplete')
    or p_current_period_start is null or p_current_period_end is null
    or p_current_period_end<=p_current_period_start then raise exception 'Invalid subscription state.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_email,0));
  select * into v_licence from public.adelphos_user_licenses where email=v_email for update;
  if not found then raise exception 'Subscription licence is not bound yet; retry after Checkout.'; end if;
  if v_licence.stripe_subscription_id is distinct from p_expected_subscription_id
    or v_licence.stripe_state_version<>p_expected_state_version then
    raise exception 'Subscription state changed; retry with a fresh Stripe snapshot.';
  end if;
  if v_licence.stripe_subscription_id is distinct from p_subscription_id and not coalesce(p_allow_binding,false) then
    raise exception 'Subscription does not own the current entitlement.';
  end if;
  if v_licence.stripe_customer_id is not null and v_licence.stripe_customer_id<>p_customer_id then
    raise exception 'Subscription customer does not own this licence.';
  end if;
  if not exists(select 1 from public.adelphos_billing_plans where code=p_plan_code and plan_kind='subscription' and active and is_active) then
    raise exception 'Subscription plan is unavailable.';
  end if;
  if p_invoice_id is not null and p_status<>'active' then raise exception 'Only an active paid subscription can grant credits.'; end if;
  if p_status='canceled' then
    perform public.adelphos_revert_to_free_entitlement(v_email,jsonb_build_object('stripe_subscription_id',p_subscription_id));
  else
    update public.adelphos_user_licenses set plan_code=p_plan_code,status=p_status,
      current_period_start=p_current_period_start,current_period_end=p_current_period_end,
      cancel_at_period_end=coalesce(p_cancel_at_period_end,false),updated_at=now() where email=v_email;
  end if;
  update public.adelphos_user_licenses set stripe_subscription_id=p_subscription_id,
    stripe_customer_id=p_customer_id,stripe_state_version=stripe_state_version+1,updated_at=now() where email=v_email;
  if p_invoice_id is not null then
    v_grant:=public.adelphos_grant_subscription_period_credits(v_email,p_plan_code,p_invoice_id,
      jsonb_build_object('stripe_invoice_id',p_invoice_id,'stripe_subscription_id',p_subscription_id));
  end if;
  return jsonb_build_object('applied',true,'state_version',p_expected_state_version+1,'grant',v_grant);
end $$;
revoke all on function public.adelphos_apply_subscription_event(text,text,bigint,text,text,text,text,timestamptz,timestamptz,boolean,boolean,text) from public,anon,authenticated;
grant execute on function public.adelphos_apply_subscription_event(text,text,bigint,text,text,text,text,timestamptz,timestamptz,boolean,boolean,text) to service_role;
