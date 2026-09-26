-- Jason chat and drawing helpers keep their actual provider billing identities.
-- Standard-processing, short-context list prices checked 2026-09-26:
-- https://developers.openai.com/api/docs/pricing
-- Preserve existing standard 4x / schematic 20x / helper 1.10x policies.
-- No provider secrets belong in the rate card. Historical receipts are unchanged.
begin;
do $jason_rates$
declare
  item record;
  cutover timestamptz := clock_timestamp();
  definition text;
  additions jsonb;
  old_gate text := $gate$if p_model not in ('claude-opus-5','claude-opus-4-6','claude-haiku-4-5-20251001')
    and not (coalesce(p_metadata->>'factor_code','standard')='helper'
      and p_model in ('claude-opus-4-7','claude-opus-4-8','claude-sonnet-4-6','claude-sonnet-5'))
    then raise exception 'Provider billing model is not configured.'; end if;$gate$;
  new_gate text := $gate$if p_model not in ('claude-opus-5','claude-opus-4-6','claude-haiku-4-5-20251001','gpt-5.6-sol','gpt-6-sol','gpt-6-astra')
    and not (coalesce(p_metadata->>'factor_code','standard')='helper'
      and p_model in ('claude-opus-4-7','claude-opus-4-8','claude-sonnet-4-6','claude-sonnet-5'))
    then raise exception 'Provider billing model is not configured.'; end if;$gate$;
begin
  -- The Sales editor must not silently lose an independently published price.
  perform 1 from public.adelphos_report_price_catalogue where id for update;
  if exists(select 1 from public.adelphos_report_price_catalogue
    where token_price_baseline is distinct from public.adelphos_current_token_prices()) then
    raise exception 'Pricing baseline changed; reconcile before adding Jason models';
  end if;
  if exists(select 1 from public.adelphos_provider_rate_card
    where model in ('gpt-5.6-sol','gpt-6-sol','gpt-6-astra')) then
    raise exception 'Jason rates already exist; inspect instead of repricing';
  end if;
  select pg_get_functiondef('public.adelphos_reserve_credits(text,text,text,text,text,numeric,jsonb)'::regprocedure) into definition;
  if position(old_gate in definition)=0 then
    raise exception 'Reservation model gate changed; inspect before applying';
  end if;
  for item in
    select m.model, c.component, c.base_rate, f.code as factor_code, f.multiplier
    from (values ('gpt-5.6-sol',4::numeric,0.4::numeric,5::numeric,20::numeric),
      ('gpt-6-sol',2::numeric,0.2::numeric,2.5::numeric,10::numeric),
      ('gpt-6-astra',10::numeric,1::numeric,12.5::numeric,50::numeric))
      m(model,input_rate,read_rate,write_rate,output_rate)
    cross join lateral (values ('uncached_input',m.input_rate),('cache_read',m.read_rate),
      ('cache_write_5m',m.write_rate),('billable_output',m.output_rate)) c(component,base_rate)
    cross join (values ('standard',4::numeric),('schematic',20::numeric),('helper',1.10::numeric)) f(code,multiplier)
  loop
    insert into public.adelphos_provider_rate_card
      (rate_code,model,component,usd_per_million_units,context_class,factor_code,effective_from,source_url,source_effective_date,active)
    values ('jason-20260926-'||item.model||'-'||item.factor_code||'-'||item.component,
      item.model,item.component,item.base_rate*item.multiplier,'standard',item.factor_code,cutover,
      'https://developers.openai.com/api/docs/pricing','2026-09-26',true);
    insert into public.adelphos_token_price_products(code,model,factor_code,component,context_class)
    values (md5(item.model||':'||item.factor_code||':'||item.component||':standard'),
      item.model,item.factor_code,item.component,'standard');
  end loop;
  -- Extend only the new keys. Retain unsaved/unpublished changes to older prices.
  select jsonb_object_agg(p.code,r.usd_per_million_units) into additions
    from public.adelphos_token_price_products p
    join public.adelphos_provider_rate_card r using(model,factor_code,component,context_class)
    where r.model in ('gpt-5.6-sol','gpt-6-sol','gpt-6-astra');
  update public.adelphos_report_price_catalogue set
    economics_draft=jsonb_set(economics_draft,'{tokenRates}',(economics_draft->'tokenRates')||additions),
    economics_published=case when economics_published is null then null
      else jsonb_set(economics_published,'{tokenRates}',(economics_published->'tokenRates')||additions) end,
    token_price_baseline=token_price_baseline||additions,
    revision=revision+1, updated_at=cutover;
  execute replace(definition,old_gate,new_gate);
end $jason_rates$;
notify pgrst,'reload schema';
commit;
