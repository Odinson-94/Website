-- Keep refunds scoped to the original invoice inside a shared subscription cycle.
create or replace function public.adelphos_apply_payment_refund(
  p_charge_id text, p_payment_intent_id text, p_invoice_id text,
  p_original_amount bigint, p_refunded_amount bigint, p_currency text, p_livemode boolean
) returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_lot public.adelphos_usage_credit_lots;
  v_grant public.adelphos_usage_credit_grants;
  v_account public.adelphos_usage_credit_accounts;
  v_prior public.adelphos_payment_refund_state;
  v_email text; v_source text; v_plan_code text; v_plan public.adelphos_billing_plans;
  v_total numeric(20,9); v_target numeric(20,9); v_delta numeric(20,9);
  v_unused numeric(20,9); v_revoke numeric(20,9); v_absorb numeric(20,9);
  v_topup boolean:=false;
  v_pool text; v_cycle public.adelphos_subscription_credit_cycles;
  v_total_pool numeric(20,9); v_pool_revoked numeric(20,9); v_source_revoked numeric(20,9);
  v_spent numeric(20,9); v_before numeric(20,9); v_capacity numeric(20,9);
begin
  if coalesce(p_charge_id,'')='' or coalesce(p_payment_intent_id,'')=''
     or p_original_amount is null or p_original_amount<=0
     or p_refunded_amount is null or p_refunded_amount<=0 or p_refunded_amount>p_original_amount
     or p_livemode is null or coalesce(p_currency,'')='' then
    raise exception 'Invalid confirmed refund.';
  end if;
  select * into v_lot from public.adelphos_usage_credit_lots
    where stripe_payment_intent_id=p_payment_intent_id and source_kind='top_up';
  if found then
    v_email:=lower(v_lot.email::text); v_source:='topup:'||v_lot.stripe_checkout_session_id;
    v_plan_code:=v_lot.metadata->>'plan_code'; v_total:=v_lot.granted_usage_credits; v_topup:=true;
  else
    select * into v_grant from public.adelphos_usage_credit_grants
      where grant_id='period:'||p_invoice_id and grant_kind='subscription_period';
    if found then
      v_email:=lower(v_grant.email::text); v_source:=v_grant.grant_id;
      v_plan_code:=v_grant.metadata->>'plan_code'; v_total:=v_grant.usage_credits;
      v_pool:=coalesce(v_grant.metadata->>'credit_cycle_id',p_invoice_id);
    else
      select * into v_cycle from public.adelphos_subscription_credit_cycles where invoice_allocations ? p_invoice_id;
      if not found then raise exception 'Original payment grant is not available; retry after payment delivery.'; end if;
      v_email:=v_cycle.email;v_source:='period:'||p_invoice_id;v_total:=0;
      v_plan_code:=v_cycle.invoice_allocations->p_invoice_id->>'plan_code';v_pool:=v_cycle.credit_period_id;
    end if;
  end if;
  perform pg_advisory_xact_lock(hashtextextended(v_email,0));
  select * into v_plan from public.adelphos_billing_plans where code=v_plan_code;
  if v_plan.code is null or lower(v_plan.currency)<>lower(p_currency)
    or (v_plan.metadata->>'stripe_mode') is distinct from (case when p_livemode then 'live' else 'test' end) then
    raise exception 'Refund does not match the original payment mode or currency.';
  end if;
  select * into v_prior from public.adelphos_payment_refund_state where stripe_charge_id=p_charge_id for update;
  if found then
    if v_prior.source_grant_id<>v_source or v_prior.stripe_payment_intent_id<>p_payment_intent_id
      or v_prior.original_amount<>p_original_amount or v_prior.currency<>lower(p_currency)
      or v_prior.livemode<>p_livemode then raise exception 'Refund identity changed.'; end if;
    if p_refunded_amount<=v_prior.refunded_amount then
      return jsonb_build_object('idempotent',true,'revoked_usage_credits',v_prior.revoked_usage_credits,
        'absorbed_usage_credits',v_prior.absorbed_usage_credits);
    end if;
  end if;
  select * into v_account from public.adelphos_usage_credit_accounts where lower(email::text)=v_email for update;
  if not found then raise exception 'Refund account is missing.'; end if;
  if v_topup then
    select * into v_lot from public.adelphos_usage_credit_lots where id=v_lot.id for update;
    if exists (select 1 from public.adelphos_credit_reservations r,
      lateral jsonb_array_elements(r.top_up_lot_allocations) a
      where lower(r.email::text)=v_email and r.status='reserved' and a->>'lot_id'=v_lot.id::text) then
      raise exception 'Refund awaits active credit reservations; retry.';
    end if;
    v_unused:=v_lot.remaining_usage_credits;
  else
    if v_total>0 and exists (select 1 from public.adelphos_credit_reservations
      where lower(email::text)=v_email and status='reserved' and included_period_id=v_pool
        and reserved_included_credits>0) then raise exception 'Refund awaits active credit reservations; retry.'; end if;
    v_unused:=0;
    if v_total>0 and v_account.included_period_id=v_pool then
      -- Included credits are one pool, consumed oldest funding first. Attribute
      -- the remaining pool to its original grants before revoking one invoice.
      with sources as (
        select g.grant_id,g.usage_credits,coalesce((g.metadata->>'credit_cycle_sequence')::integer,0) as sequence,
          coalesce((select sum(r.revoked_usage_credits) from public.adelphos_payment_refund_state r where r.source_grant_id=g.grant_id),0) as revoked
        from public.adelphos_usage_credit_grants g where g.email=v_email and g.grant_kind='subscription_period'
          and (g.metadata->>'credit_cycle_id'=v_pool or g.grant_id='period:'||v_pool)
      ) select sum(usage_credits),sum(revoked),
          coalesce(sum(usage_credits-revoked) filter(where sequence<coalesce((v_grant.metadata->>'credit_cycle_sequence')::integer,0)),0),
          coalesce(sum(revoked) filter(where grant_id=v_source),0)
        into v_total_pool,v_pool_revoked,v_before,v_source_revoked from sources;
      v_spent:=v_total_pool-v_pool_revoked-v_account.included_available_usage_credits;
      if v_spent<0 then raise exception 'Subscription refund pool needs reconciliation.'; end if;
      v_capacity:=v_total-v_source_revoked;
      v_unused:=greatest(0,v_capacity-greatest(0,v_spent-v_before));
    end if;
  end if;
  v_target:=round(v_total*p_refunded_amount/p_original_amount,9);
  v_delta:=v_target-coalesce(v_prior.refunded_usage_credits,0);
  v_revoke:=least(v_delta,v_unused); v_absorb:=v_delta-v_revoke;
  if v_revoke<0 or v_account.available_usage_credits<v_revoke
    or (v_topup and v_account.top_up_available_usage_credits<v_revoke) then raise exception 'Refund balance reconciliation failed.'; end if;
  if v_topup then
    update public.adelphos_usage_credit_lots set remaining_usage_credits=remaining_usage_credits-v_revoke where id=v_lot.id;
  end if;
  update public.adelphos_usage_credit_accounts set
    available_usage_credits=available_usage_credits-v_revoke,
    top_up_available_usage_credits=top_up_available_usage_credits-case when v_topup then v_revoke else 0 end,
    included_available_usage_credits=included_available_usage_credits-case when v_topup then 0 else v_revoke end,
    updated_at=now() where lower(email::text)=v_email;
  insert into public.adelphos_payment_refund_state values (
    p_charge_id,p_payment_intent_id,v_source,v_email,lower(p_currency),p_livemode,p_original_amount,p_refunded_amount,
    v_target,coalesce(v_prior.revoked_usage_credits,0)+v_revoke,coalesce(v_prior.absorbed_usage_credits,0)+v_absorb,now()
  ) on conflict(stripe_charge_id) do update set
    refunded_amount=excluded.refunded_amount,refunded_usage_credits=excluded.refunded_usage_credits,
    revoked_usage_credits=excluded.revoked_usage_credits,absorbed_usage_credits=excluded.absorbed_usage_credits,updated_at=now();
  insert into public.adelphos_credit_ledger(request_id,email,project_id,event_type,component,usage_credits,metadata)
    values('stripe-refund:'||p_charge_id||':'||p_refunded_amount,v_email,'account','adjustment','payment_refund',-v_revoke,
      jsonb_build_object('source_grant_id',v_source,'stripe_payment_intent_id',p_payment_intent_id,
        'refunded_amount',p_refunded_amount,'currency',lower(p_currency),'absorbed_usage_credits',v_absorb,'livemode',p_livemode));
  return jsonb_build_object('idempotent',false,'revoked_usage_credits',v_revoke,'absorbed_usage_credits',v_absorb);
end $$;
revoke all on function public.adelphos_apply_payment_refund(text,text,text,bigint,bigint,text,boolean) from public,anon,authenticated;
grant execute on function public.adelphos_apply_payment_refund(text,text,text,bigint,bigint,text,boolean) to service_role;
