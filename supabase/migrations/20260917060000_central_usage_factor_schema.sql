-- Existing central licensing database: add factor lookup without repricing history.
-- Apply schema first, deploy factor-aware credit-meter, then activate new rates.
begin;
alter table public.adelphos_provider_rate_card
  add column if not exists factor_code text not null default 'standard';
alter table public.adelphos_provider_rate_card
  drop constraint if exists adelphos_provider_rate_card_model_component_context_class_e_key;
create unique index if not exists adelphos_provider_rate_card_dimension_key
  on public.adelphos_provider_rate_card(model,component,context_class,factor_code,effective_from);

insert into public.adelphos_provider_rate_card
 (rate_code,model,component,usd_per_million_units,context_class,effective_from,effective_until,source_url,source_effective_date,active,factor_code)
select 'factor-bridge-'||rate_code,model,component,usd_per_million_units,context_class,effective_from,effective_until,source_url,source_effective_date,active,'schematic'
from public.adelphos_provider_rate_card where factor_code='standard' and model='claude-opus-5'
on conflict do nothing;
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
        and factor_code=case when v_res.metadata->>'factor_code'='schematic' then 'schematic' else 'standard' end
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
