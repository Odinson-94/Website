-- Activate the existing commercial policy prospectively. Never rewrite past rates.
-- Requires 20260917060000 and the factor-aware gateway to be deployed first.
begin;
do $activation$
declare
  cutover timestamptz := clock_timestamp();
  item record;
  factor record;
  row_count integer;
begin
  if exists(select 1 from public.adelphos_provider_rate_card where rate_code like 'policy-20260917-%') then
    raise exception 'Usage factor policy has already been activated';
  end if;
  select count(*) into row_count from public.adelphos_provider_rate_card
    where model='claude-opus-5' and context_class='standard' and factor_code='standard'
      and active and effective_from<=cutover and (effective_until is null or effective_until>cutover);
  if row_count<>6 then raise exception 'Expected exactly six current provider component rates'; end if;
  for item in select * from public.adelphos_provider_rate_card
    where model='claude-opus-5' and context_class='standard' and factor_code='standard'
      and active and effective_from<=cutover and (effective_until is null or effective_until>cutover)
  loop
    if item.usd_per_million_units <> (case item.component
      when 'uncached_input' then 5 when 'cache_write_5m' then 6.25
      when 'cache_write_1h' then 10 when 'cache_read' then 0.5
      when 'billable_output' then 25 when 'reasoning_output' then 25 end)
    then raise exception 'Provider rate changed; inspect before activating policy'; end if;
    for factor in select * from (values ('standard',4),('schematic',20)) as f(code,multiplier)
    loop
      update public.adelphos_provider_rate_card set effective_until=cutover
        where model=item.model and component=item.component and context_class=item.context_class
          and factor_code=factor.code and active and effective_from<=cutover
          and (effective_until is null or effective_until>cutover);
      insert into public.adelphos_provider_rate_card
        (rate_code,model,component,usd_per_million_units,context_class,factor_code,effective_from,source_url,source_effective_date,active)
      values ('policy-20260917-'||factor.code||'-'||item.component,item.model,item.component,
        item.usd_per_million_units*factor.multiplier,item.context_class,factor.code,cutover,item.source_url,item.source_effective_date,true);
    end loop;
  end loop;
end $activation$;
commit;
