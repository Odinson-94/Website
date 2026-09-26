-- Existing helper policy: actual provider component price + 10%, once.
-- Source checked 2026-09-18: https://platform.claude.com/docs/en/about-claude/pricing
-- Sonnet 5's $2/$10 price is now standard, not the superseded planned $3/$15.
-- Only add missing effective-dated helper rows. Existing rates/history unchanged.
begin;
do $extend_helper_rates$
declare
  item record;
  cutover timestamptz := clock_timestamp();
  definition text;
  old_gate text := $gate$if p_model not in ('claude-opus-5','claude-opus-4-6','claude-haiku-4-5-20251001') then raise exception 'Provider billing model is not configured.'; end if;$gate$;
  new_gate text := $gate$if p_model not in ('claude-opus-5','claude-opus-4-6','claude-haiku-4-5-20251001')
    and not (coalesce(p_metadata->>'factor_code','standard')='helper'
      and p_model in ('claude-opus-4-7','claude-opus-4-8','claude-sonnet-4-6','claude-sonnet-5'))
    then raise exception 'Provider billing model is not configured.'; end if;$gate$;
begin
  if exists(select 1 from public.adelphos_provider_rate_card where factor_code='helper'
    and model in ('claude-opus-4-6','claude-opus-4-7','claude-opus-4-8','claude-sonnet-4-6','claude-sonnet-5')) then
    raise exception 'Extended helper rates already exist; inspect instead of repricing';
  end if;
  for item in select m.model, c.component, c.base_rate*m.multiplier as base_rate
    from (values ('claude-opus-4-6',5::numeric),('claude-opus-4-7',5::numeric),
      ('claude-opus-4-8',5::numeric),('claude-sonnet-4-6',3::numeric),
      ('claude-sonnet-5',2::numeric)) m(model,multiplier)
    cross join (values ('uncached_input',1::numeric),('cache_write_5m',1.25::numeric),
      ('cache_write_1h',2::numeric),('cache_read',0.1::numeric),
      ('billable_output',5::numeric),('reasoning_output',5::numeric)) c(component,base_rate)
  loop
    insert into public.adelphos_provider_rate_card
      (rate_code,model,component,usd_per_million_units,context_class,factor_code,effective_from,source_url,source_effective_date,active)
    values ('helper-110-20260918-'||item.model||'-'||item.component,item.model,item.component,
      item.base_rate*1.10,'standard','helper',cutover,
      'https://platform.claude.com/docs/en/about-claude/pricing','2026-09-18',true);
  end loop;
  select pg_get_functiondef('public.adelphos_reserve_credits(text,text,text,text,text,numeric,jsonb)'::regprocedure) into definition;
  if position(old_gate in definition)=0 then
    raise exception 'Reservation model gate changed concurrently; inspect before applying';
  end if;
  execute replace(definition,old_gate,new_gate);
end $extend_helper_rates$;
commit;
