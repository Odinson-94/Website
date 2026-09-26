-- A paid cycle starts with one allowance. Upgrades add the prorated increase
-- above the highest already-funded tier; downgrades and repeats never refill it.
create table public.adelphos_subscription_credit_cycles (
  email text not null, stripe_subscription_id text not null,
  period_start timestamptz not null, period_end timestamptz not null,
  credit_period_id text not null,
  highest_monthly_allowance numeric(20,9) not null default 0,
  granted_usage_credits numeric(20,9) not null default 0,
  next_grant_sequence integer not null default 0,
  processed_invoice_ids jsonb not null default '[]'::jsonb,
  invoice_allocations jsonb not null default '{}'::jsonb,
  primary key(email,stripe_subscription_id,period_start),
  check(period_end>period_start), check(highest_monthly_allowance>=0), check(granted_usage_credits>=0)
);
alter table public.adelphos_subscription_credit_cycles enable row level security;
revoke all on public.adelphos_subscription_credit_cycles from public,anon,authenticated;
grant all on public.adelphos_subscription_credit_cycles to service_role;

create or replace function public.adelphos_grant_subscription_cycle_credits(
  p_email text,p_subscription_id text,p_start timestamptz,p_end timestamptz,
  p_paid_invoices jsonb,p_adopt_legacy boolean default false
) returns jsonb language plpgsql security definer set search_path=public as $$
declare
 v_email text:=lower(trim(p_email)); v_cycle public.adelphos_subscription_credit_cycles;
 v_account public.adelphos_usage_credit_accounts; v_legacy public.adelphos_usage_credit_grants;
 v_plan public.adelphos_billing_plans; v_item jsonb; v_id text; v_root text;
 v_fraction numeric; v_delta numeric(20,9); v_granted numeric(20,9):=0;
begin
 if coalesce(v_email,'')='' or coalesce(p_subscription_id,'')='' or p_start is null or p_end is null or p_end<=p_start
   or jsonb_typeof(p_paid_invoices) is distinct from 'array' or jsonb_array_length(p_paid_invoices)=0
   or p_paid_invoices->0->>'kind' is distinct from 'base' then raise exception 'Verified paid cycle invoices are required.'; end if;
 if (select count(*) from jsonb_array_elements(p_paid_invoices) item where item->>'kind'='base')<>1 then raise exception 'One paid base invoice is required.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(v_email,0));
 select * into v_cycle from public.adelphos_subscription_credit_cycles
   where email=v_email and stripe_subscription_id=p_subscription_id and period_start=p_start for update;
 if not found then
  insert into public.adelphos_usage_credit_accounts(email) values(v_email) on conflict(email) do nothing;
  select * into v_account from public.adelphos_usage_credit_accounts where email=v_email for update;
  if p_adopt_legacy and v_account.included_period_id is not null
    and exists(select 1 from jsonb_array_elements(p_paid_invoices) item where item->>'invoice_id'=v_account.included_period_id) then
   select * into v_legacy from public.adelphos_usage_credit_grants
    where grant_id='period:'||v_account.included_period_id and email=v_email and grant_kind='subscription_period';
   if not found then raise exception 'Legacy subscription allowance needs reconciliation.'; end if;
   v_root:=v_account.included_period_id;
   update public.adelphos_usage_credit_grants set metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('credit_cycle_id',v_root,'credit_cycle_sequence',0)
    where grant_id=v_legacy.grant_id;
  else
   v_root:=p_paid_invoices->0->>'invoice_id';
   update public.adelphos_usage_credit_accounts set included_available_usage_credits=0,
    included_period_id=v_root,available_usage_credits=top_up_available_usage_credits,updated_at=now() where email=v_email;
  end if;
  insert into public.adelphos_subscription_credit_cycles(email,stripe_subscription_id,period_start,period_end,credit_period_id,
    highest_monthly_allowance,granted_usage_credits,next_grant_sequence)
   values(v_email,p_subscription_id,p_start,p_end,v_root,coalesce(v_legacy.usage_credits,0),coalesce(v_legacy.usage_credits,0),case when v_legacy.grant_id is null then 0 else 1 end)
   returning * into v_cycle;
 end if;
 if v_cycle.period_end<>p_end then raise exception 'Subscription cycle boundary changed.'; end if;
 if not exists(select 1 from public.adelphos_usage_credit_accounts where email=v_email and included_period_id=v_cycle.credit_period_id) then
  raise exception 'Subscription cycle no longer owns the included balance.';
 end if;
 for v_item in select value from jsonb_array_elements(p_paid_invoices) loop
  v_id:=v_item->>'invoice_id';
  if not (v_item ?& array['invoice_id','plan_code','kind','start','end'])
   or jsonb_typeof(v_item->'start') is distinct from 'number' or jsonb_typeof(v_item->'end') is distinct from 'number'
   or coalesce(v_id,'')='' or v_item->>'kind' not in ('base','update')
   or (v_item->>'start')::numeric<extract(epoch from p_start)
   or (v_item->>'start')::numeric>extract(epoch from p_end)
   or (v_item->>'end')::numeric<>extract(epoch from p_end)
   or (v_item->>'kind'='base' and (v_item->>'start')::numeric<>extract(epoch from p_start)) then
    raise exception 'Invoice cycle boundaries are invalid.';
  end if;
  if v_cycle.processed_invoice_ids ? v_id then continue; end if;
  select * into v_plan from public.adelphos_billing_plans where code=v_item->>'plan_code' and plan_kind='subscription';
  if not found or v_plan.monthly_usage_credit_grant<=0 then raise exception 'Paid invoice allowance is unavailable.'; end if;
  v_fraction:=(extract(epoch from p_end)-(v_item->>'start')::numeric)/(extract(epoch from p_end)-extract(epoch from p_start));
  v_delta:=round(greatest(0,v_plan.monthly_usage_credit_grant-v_cycle.highest_monthly_allowance)*v_fraction,9);
  -- Existing grants were already applied before rollout. Never refill or
  -- rewrite them; preserve the current balance and learn the funded tier.
  if exists(select 1 from public.adelphos_usage_credit_grants where grant_id='period:'||v_id and email<>v_email) then raise exception 'Invoice belongs to another credit account.'; end if;
  if exists(select 1 from public.adelphos_usage_credit_grants where grant_id='period:'||v_id) then v_delta:=0; end if;
  if v_delta>0 then
   insert into public.adelphos_usage_credit_grants(grant_id,email,grant_kind,usage_credits,metadata)
    values('period:'||v_id,v_email,'subscription_period',v_delta,jsonb_build_object('plan_code',v_plan.code,
      'stripe_invoice_id',v_id,'stripe_subscription_id',p_subscription_id,'credit_cycle_id',v_cycle.credit_period_id,
      'credit_cycle_sequence',v_cycle.next_grant_sequence,'proration_fraction',v_fraction));
   update public.adelphos_usage_credit_accounts set included_available_usage_credits=included_available_usage_credits+v_delta,
    available_usage_credits=available_usage_credits+v_delta,lifetime_granted_usage_credits=lifetime_granted_usage_credits+v_delta,
    updated_at=now() where email=v_email;
   v_cycle.granted_usage_credits:=v_cycle.granted_usage_credits+v_delta;
   v_cycle.next_grant_sequence:=v_cycle.next_grant_sequence+1;v_granted:=v_granted+v_delta;
  end if;
  v_cycle.highest_monthly_allowance:=greatest(v_cycle.highest_monthly_allowance,v_plan.monthly_usage_credit_grant);
  v_cycle.processed_invoice_ids:=v_cycle.processed_invoice_ids||jsonb_build_array(v_id);
  v_cycle.invoice_allocations:=v_cycle.invoice_allocations||jsonb_build_object(v_id,jsonb_build_object('plan_code',v_plan.code,'usage_credits',v_delta));
 end loop;
 update public.adelphos_subscription_credit_cycles set highest_monthly_allowance=v_cycle.highest_monthly_allowance,
  granted_usage_credits=v_cycle.granted_usage_credits,next_grant_sequence=v_cycle.next_grant_sequence,
  processed_invoice_ids=v_cycle.processed_invoice_ids,invoice_allocations=v_cycle.invoice_allocations
  where email=v_email and stripe_subscription_id=p_subscription_id and period_start=p_start;
 return jsonb_build_object('granted_usage_credits',v_granted,'credit_period_id',v_cycle.credit_period_id,'highest_monthly_allowance',v_cycle.highest_monthly_allowance);
end $$;
revoke all on function public.adelphos_grant_subscription_cycle_credits(text,text,timestamptz,timestamptz,jsonb,boolean) from public,anon,authenticated;
grant execute on function public.adelphos_grant_subscription_cycle_credits(text,text,timestamptz,timestamptz,jsonb,boolean) to service_role;

create or replace function public.adelphos_apply_subscription_event_v2(
  p_email text, p_expected_subscription_id text, p_expected_state_version bigint,
  p_subscription_id text, p_customer_id text, p_plan_code text, p_status text,
  p_current_period_start timestamptz, p_current_period_end timestamptz,
  p_cancel_at_period_end boolean, p_allow_binding boolean default false,
  p_invoice_id text default null, p_paid_invoices jsonb default '[]'::jsonb
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
    if not exists(select 1 from jsonb_array_elements(p_paid_invoices) item where item->>'invoice_id'=p_invoice_id) then
      raise exception 'Latest paid invoice is absent from cycle reconciliation.';
    end if;
    v_grant:=public.adelphos_grant_subscription_cycle_credits(v_email,p_subscription_id,p_current_period_start,p_current_period_end,p_paid_invoices,
      v_licence.stripe_subscription_id=p_subscription_id and v_licence.current_period_start=p_current_period_start and v_licence.current_period_end=p_current_period_end);
  end if;
  return jsonb_build_object('applied',true,'state_version',p_expected_state_version+1,'grant',v_grant);
end $$;
revoke all on function public.adelphos_apply_subscription_event_v2(text,text,bigint,text,text,text,text,timestamptz,timestamptz,boolean,boolean,text,jsonb) from public,anon,authenticated;
grant execute on function public.adelphos_apply_subscription_event_v2(text,text,bigint,text,text,text,text,timestamptz,timestamptz,boolean,boolean,text,jsonb) to service_role;
