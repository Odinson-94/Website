-- Approved helper pricing: actual model provider rates plus 10%, once.
-- Existing standard/schematic rates and historical reservations stay unchanged.
begin;
do $helper_rates$
declare item record; cutover timestamptz := clock_timestamp();
begin
  if exists(select 1 from public.adelphos_provider_rate_card where factor_code='helper') then
    raise exception 'Helper policy already exists; inspect instead of overwriting';
  end if;
  for item in select m.model, c.component, c.base_rate*m.multiplier as base_rate
    from (values ('claude-haiku-4-5-20251001',1::numeric),('claude-opus-5',5::numeric)) m(model,multiplier)
    cross join (values ('uncached_input',1::numeric),('cache_write_5m',1.25::numeric),
      ('cache_write_1h',2::numeric),('cache_read',0.1::numeric),
      ('billable_output',5::numeric),('reasoning_output',5::numeric)) c(component,base_rate)
  loop
    insert into public.adelphos_provider_rate_card
      (rate_code,model,component,usd_per_million_units,context_class,factor_code,effective_from,source_url,source_effective_date,active)
    values ('helper-110-20260917-'||item.model||'-'||item.component,item.model,item.component,
      item.base_rate*1.10,'standard','helper',cutover,
      'https://platform.claude.com/docs/en/about-claude/pricing','2026-09-17',true);
  end loop;
end $helper_rates$;
CREATE OR REPLACE FUNCTION public.adelphos_reserve_credits(p_email text, p_project_id text, p_request_id text, p_request_kind text, p_model text, p_reserve_usage_credits numeric, p_metadata jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_email text := lower(trim(p_email));
  v_lic public.adelphos_user_licenses;
  v_plan public.adelphos_billing_plans;
  v_project public.adelphos_billing_projects;
  v_contract public.adelphos_credit_contracts;
  v_usage_cap numeric;
  v_window interval;
  v_window_usage numeric;
  v_existing public.adelphos_credit_reservations;
  v_account public.adelphos_usage_credit_accounts;
  v_expired public.adelphos_credit_reservations;
  v_lot record;
  v_allocation record;
  v_allocations jsonb := '[]'::jsonb;
  v_included_take numeric := 0;
  v_top_up_take numeric := 0;
  v_remaining numeric := 0;
  v_take numeric := 0;
begin
  if p_request_kind not in ('chat','tool') or trim(coalesce(p_request_id,''))='' or p_reserve_usage_credits<=0 then
    raise exception 'Valid request identity, kind and positive reservation are required.';
  end if;
  if p_model not in ('claude-opus-5','claude-opus-4-6','claude-haiku-4-5-20251001') then raise exception 'Provider billing model is not configured.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_email, 0));
  select * into v_existing from public.adelphos_credit_reservations where request_id=p_request_id;
  if v_existing.request_id is not null then
    if lower(v_existing.email::text)<>v_email or v_existing.project_id<>p_project_id then raise exception 'Idempotency key collision.'; end if;
    return jsonb_build_object('allowed',v_existing.status='reserved','request_id',p_request_id,'status',v_existing.status,'reserved_usage_credits',v_existing.reserved_usage_credits);
  end if;
  select * into v_lic from public.adelphos_ensure_billing_license(v_email);
  select * into v_plan from public.adelphos_billing_plans where code=v_lic.plan_code and is_active and active;
  if v_plan.code is null or (v_plan.code<>'free' and v_lic.status not in ('active','trialing')) then
    return jsonb_build_object('allowed',false,'reason','subscription_inactive');
  end if;
  if v_plan.ai_access='tool_only' and p_request_kind<>'tool' then
    return jsonb_build_object('allowed',false,'reason','free_tool_only','plan',v_plan.code);
  end if;
  if p_request_kind='chat' and (
    coalesce(p_metadata->>'reservation_basis','')<>'provider_worst_case'
    or coalesce(p_metadata->>'max_output_units','') !~ '^[1-9][0-9]*$'
  ) then
    return jsonb_build_object('allowed',false,'reason','bounded_reservation_required');
  end if;
  select * into v_account from public.adelphos_ensure_introductory_credits(v_email);
  select * into v_project from public.adelphos_billing_projects
    where project_id=p_project_id and lower(email::text)=v_email for update;
  if v_project.project_id is null or v_project.status<>'active' then
    return jsonb_build_object('allowed',false,'reason','project_unavailable');
  end if;
  -- Expired holds are returned to the same credit source. An included-credit
  -- refund only returns when its billing period is still current.
  for v_expired in
    select * from public.adelphos_credit_reservations
    where lower(email::text)=v_email and status='reserved' and expires_at<=now()
    for update
  loop
    update public.adelphos_credit_reservations set status='released',
      metadata=metadata||jsonb_build_object('release_reason','reservation_expired')
      where request_id=v_expired.request_id;
    update public.adelphos_billing_projects set
      reserved_usage_credits=greatest(reserved_usage_credits-v_expired.reserved_usage_credits,0),updated_at=now()
      where project_id=v_expired.project_id;
    update public.adelphos_usage_credit_accounts set
      included_available_usage_credits=included_available_usage_credits+
        case when included_period_id=v_expired.included_period_id then v_expired.reserved_included_credits else 0 end,
      top_up_available_usage_credits=top_up_available_usage_credits+v_expired.reserved_top_up_credits,
      updated_at=now() where lower(email::text)=v_email;
    for v_allocation in select * from jsonb_to_recordset(v_expired.top_up_lot_allocations) as x(lot_id uuid,amount numeric) loop
      update public.adelphos_usage_credit_lots set remaining_usage_credits=remaining_usage_credits+v_allocation.amount
        where id=v_allocation.lot_id and lower(email::text)=v_email;
    end loop;
    insert into public.adelphos_credit_ledger(request_id,email,project_id,event_type,component,usage_credits,metadata)
    values(v_expired.request_id,v_expired.email,v_expired.project_id,'release','reservation',-v_expired.reserved_usage_credits,jsonb_build_object('reason','reservation_expired'))
    on conflict(request_id,event_type,component) do nothing;
  end loop;
  update public.adelphos_usage_credit_accounts set
    available_usage_credits=included_available_usage_credits+top_up_available_usage_credits
    where lower(email::text)=v_email returning * into v_account;
  select * into v_contract from public.adelphos_credit_contracts
    where lower(email::text)=v_email and effective_from<=now()
      and (effective_until is null or effective_until>now());
  v_usage_cap := coalesce(v_contract.rolling_usage_credit_cap,v_plan.rolling_usage_credit_cap);
  v_window := v_plan.rolling_window;
  -- A null cap is NO rolling limit. Only an explicit zero still refuses, which is
  -- the one way an operator can say "this plan may not spend at all".
  if v_usage_cap is not null and v_usage_cap<=0 then
    return jsonb_build_object('allowed',false,'reason',case when v_plan.code='free' then 'free_credit_required' else 'contract_cap_required' end);
  end if;
  -- Still measured on every reservation: the window total is what the dashboard
  -- and the reserve receipt report. It only refuses when a cap is set.
  select coalesce(sum(case when status='settled' then actual_usage_credits else reserved_usage_credits end),0)
    into v_window_usage
  from public.adelphos_credit_reservations
  where lower(email::text)=v_email and reserved_at>now()-v_window and status in ('reserved','settled','overrun');
  if v_usage_cap is not null and v_window_usage+p_reserve_usage_credits>v_usage_cap then
    return jsonb_build_object('allowed',false,'reason','rolling_usage_cap','used',v_window_usage,'limit',v_usage_cap);
  end if;
  if v_account.included_available_usage_credits+v_account.top_up_available_usage_credits<p_reserve_usage_credits then
    return jsonb_build_object('allowed',false,'reason','insufficient_usage_credits','available',v_account.available_usage_credits,'required',p_reserve_usage_credits);
  end if;
  v_included_take:=least(v_account.included_available_usage_credits,p_reserve_usage_credits);
  v_top_up_take:=p_reserve_usage_credits-v_included_take;
  v_remaining:=v_top_up_take;
  for v_lot in
    select id,remaining_usage_credits from public.adelphos_usage_credit_lots
    where lower(email::text)=v_email and remaining_usage_credits>0
      and (expires_at is null or expires_at>now())
    order by granted_at,id for update
  loop
    exit when v_remaining<=0;
    v_take:=least(v_lot.remaining_usage_credits,v_remaining);
    update public.adelphos_usage_credit_lots set remaining_usage_credits=remaining_usage_credits-v_take where id=v_lot.id;
    v_allocations:=v_allocations||jsonb_build_array(jsonb_build_object('lot_id',v_lot.id,'amount',v_take));
    v_remaining:=v_remaining-v_take;
  end loop;
  if v_remaining>0 then raise exception 'Top-up credit lot reconciliation failed.'; end if;
  insert into public.adelphos_credit_reservations(
    request_id,email,project_id,request_kind,model,reserved_usage_credits,
    reserved_included_credits,reserved_top_up_credits,included_period_id,top_up_lot_allocations,metadata
  ) values(
    p_request_id,v_email,p_project_id,p_request_kind,p_model,p_reserve_usage_credits,
    v_included_take,v_top_up_take,v_account.included_period_id,v_allocations,coalesce(p_metadata,'{}'::jsonb)
  );
  update public.adelphos_billing_projects set reserved_usage_credits=reserved_usage_credits+p_reserve_usage_credits,last_activity_at=now(),updated_at=now()
    where project_id=p_project_id;
  update public.adelphos_usage_credit_accounts set
    included_available_usage_credits=included_available_usage_credits-v_included_take,
    top_up_available_usage_credits=top_up_available_usage_credits-v_top_up_take,
    available_usage_credits=available_usage_credits-p_reserve_usage_credits,updated_at=now()
    where lower(email::text)=v_email;
  insert into public.adelphos_credit_ledger(request_id,email,project_id,event_type,component,usage_credits,metadata)
  values(p_request_id,v_email,p_project_id,'reserve','reservation',p_reserve_usage_credits,coalesce(p_metadata,'{}'::jsonb));
  return jsonb_build_object('allowed',true,'request_id',p_request_id,'reserved_usage_credits',p_reserve_usage_credits,'available_usage_credits',v_account.available_usage_credits-p_reserve_usage_credits,'rolling_used',v_window_usage,'rolling_limit',v_usage_cap);
end $function$;

CREATE OR REPLACE FUNCTION public.adelphos_settle_credits(p_request_id text, p_uncached_input bigint DEFAULT 0, p_cache_write_5m bigint DEFAULT 0, p_cache_write_1h bigint DEFAULT 0, p_cache_read bigint DEFAULT 0, p_billable_output bigint DEFAULT 0, p_reasoning_output bigint DEFAULT 0, p_tool_calls jsonb DEFAULT '[]'::jsonb, p_metadata jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_res public.adelphos_credit_reservations;
  v_total numeric := 0;
  v_component record;
  v_rate record;
  v_tool record;
  v_tool_rate record;
  v_amount numeric;
  v_charge numeric;
  v_included_consumed numeric;
  v_top_up_consumed numeric;
  v_included_refund numeric;
  v_top_up_refund numeric;
  v_remaining_to_consume numeric;
  v_allocation record;
  v_allocation_consumed numeric;
begin
  if least(p_uncached_input,p_cache_write_5m,p_cache_write_1h,p_cache_read,p_billable_output,p_reasoning_output)<0 then
    raise exception 'Provider usage units cannot be negative.';
  end if;
  select * into v_res from public.adelphos_credit_reservations where request_id=p_request_id for update;
  if v_res.request_id is null then raise exception 'Reservation not found.'; end if;
  if v_res.status in ('settled','overrun') then
    return jsonb_build_object('request_id',p_request_id,'status',v_res.status,'usage_credits',least(v_res.actual_usage_credits,v_res.reserved_usage_credits),'actual_provider_usage_credits',v_res.actual_usage_credits,'idempotent',true);
  end if;
  if v_res.status<>'reserved' then raise exception 'Reservation is not active.'; end if;
  for v_component in select * from (values
    ('uncached_input',p_uncached_input),('cache_write_5m',p_cache_write_5m),
    ('cache_write_1h',p_cache_write_1h),('cache_read',p_cache_read),
    ('billable_output',p_billable_output)
  ) as c(component,units) where units>0 loop
    select * into v_rate from public.adelphos_provider_rate_card
      where model=v_res.model and component=v_component.component
        and context_class='standard'
        and factor_code=case when v_res.metadata->>'factor_code'='helper' then 'helper' when v_res.metadata->>'factor_code'='schematic' then 'schematic' else 'standard' end
        and active and effective_from<=v_res.reserved_at
        and (effective_until is null or effective_until>v_res.reserved_at)
      order by effective_from desc limit 1;
    if v_rate.rate_code is null then raise exception 'No active provider rate for %.',v_component.component; end if;
    v_amount:=round((v_component.units::numeric*v_rate.usd_per_million_units)/1000000,9);
    v_total:=v_total+v_amount;
    insert into public.adelphos_credit_ledger(request_id,email,project_id,event_type,component,provider_units,rate_usd_per_million,usage_credits,rate_code,metadata)
    values(p_request_id,v_res.email,v_res.project_id,'settle',v_component.component,v_component.units,v_rate.usd_per_million_units,v_amount,v_rate.rate_code,coalesce(p_metadata,'{}'::jsonb));
  end loop;
  for v_tool in select value from jsonb_array_elements(coalesce(p_tool_calls,'[]'::jsonb)) loop
    select rate_code,usage_credit_per_call into v_tool_rate from public.adelphos_tool_rate_card
      where tool_code=v_tool.value->>'tool_code' and active and effective_from<=v_res.reserved_at
        and (effective_until is null or effective_until>v_res.reserved_at)
      order by effective_from desc limit 1;
    if v_tool_rate.rate_code is null then
      select rate_code,usage_credit_per_call into v_tool_rate from public.adelphos_tool_rate_card
        where tool_code='__default_agent_tool__' and active and effective_from<=v_res.reserved_at
          and (effective_until is null or effective_until>v_res.reserved_at)
        order by effective_from desc limit 1;
    end if;
    if v_tool_rate.rate_code is null then raise exception 'No active tool rate for %.',v_tool.value->>'tool_code'; end if;
    v_amount:=round(v_tool_rate.usage_credit_per_call*greatest(coalesce((v_tool.value->>'quantity')::integer,1),1),9);
    v_total:=v_total+v_amount;
    insert into public.adelphos_credit_ledger(request_id,email,project_id,event_type,component,provider_units,rate_usd_per_million,usage_credits,rate_code,metadata)
    values(p_request_id,v_res.email,v_res.project_id,'settle','tool:'||(v_tool.value->>'tool_code'),coalesce((v_tool.value->>'quantity')::bigint,1),null,v_amount,v_tool_rate.rate_code,coalesce(p_metadata,'{}'::jsonb));
  end loop;
  -- A reservation is a hard customer charge ceiling. Provider usage above the
  -- bound is an internal fault/debt: it is recorded, but never creates a
  -- negative customer balance or an automatic overage.
  v_charge:=least(v_total,v_res.reserved_usage_credits);
  v_included_consumed:=least(v_charge,v_res.reserved_included_credits);
  v_top_up_consumed:=greatest(v_charge-v_included_consumed,0);
  v_included_refund:=v_res.reserved_included_credits-v_included_consumed;
  v_top_up_refund:=v_res.reserved_top_up_credits-v_top_up_consumed;
  v_remaining_to_consume:=v_top_up_consumed;
  for v_allocation in select * from jsonb_to_recordset(v_res.top_up_lot_allocations) as x(lot_id uuid,amount numeric) loop
    v_allocation_consumed:=least(v_allocation.amount,v_remaining_to_consume);
    v_remaining_to_consume:=v_remaining_to_consume-v_allocation_consumed;
    update public.adelphos_usage_credit_lots set
      remaining_usage_credits=remaining_usage_credits+(v_allocation.amount-v_allocation_consumed)
      where id=v_allocation.lot_id and lower(email::text)=lower(v_res.email::text);
  end loop;
  update public.adelphos_credit_reservations set
    status=case when v_total>reserved_usage_credits then 'overrun' else 'settled' end,
    actual_usage_credits=v_total,overrun_usage_credits=greatest(v_total-reserved_usage_credits,0),settled_at=now(),
    cap_overrun=v_total>reserved_usage_credits,metadata=metadata||coalesce(p_metadata,'{}'::jsonb)
    where request_id=p_request_id;
  update public.adelphos_billing_projects set
    reserved_usage_credits=greatest(reserved_usage_credits-v_res.reserved_usage_credits,0),
    spent_usage_credits=spent_usage_credits+v_charge,updated_at=now()
    where project_id=v_res.project_id;
  update public.adelphos_usage_credit_accounts set
    included_available_usage_credits=included_available_usage_credits+
      case when included_period_id=v_res.included_period_id then v_included_refund else 0 end,
    top_up_available_usage_credits=top_up_available_usage_credits+v_top_up_refund,
    available_usage_credits=(included_available_usage_credits+
      case when included_period_id=v_res.included_period_id then v_included_refund else 0 end)+
      (top_up_available_usage_credits+v_top_up_refund),
    lifetime_spent_usage_credits=lifetime_spent_usage_credits+v_charge,updated_at=now()
    where lower(email::text)=lower(v_res.email::text);
  if v_total>v_res.reserved_usage_credits then
    insert into public.adelphos_credit_ledger(request_id,email,project_id,event_type,component,usage_credits,metadata)
    values(p_request_id,v_res.email,v_res.project_id,'overrun','internal_overrun_debt',v_total-v_res.reserved_usage_credits,
      jsonb_build_object('customer_charged_usage_credits',v_charge,'execution_fault','reservation_bound_exceeded'))
    on conflict(request_id,event_type,component) do nothing;
  end if;
  return jsonb_build_object(
    'request_id',p_request_id,
    'status',case when v_total>v_res.reserved_usage_credits then 'overrun' else 'settled' end,
    'usage_credits',v_charge,
    'actual_provider_usage_credits',v_total,
    'cap_overrun',v_total>v_res.reserved_usage_credits
  );
end $function$;

commit;
