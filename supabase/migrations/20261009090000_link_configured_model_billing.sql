-- ADELPHOS-SESSION 2026-10-09/codex-model-billing/74d61b2e
-- Complete configured text/vision model rates. Preserve all existing rate rows.
-- Prices verified against official OpenAI model pages and Claude pricing, 2026-10-09.
-- Existing standard-context contract and 4x/20x/1.10x factors are unchanged.
begin;
do $configured_models$
declare
  definition text;
  old_gate text := $old$if p_model not in ('claude-opus-5','claude-opus-4-6','claude-haiku-4-5-20251001','gpt-5.6-sol')
    and not (coalesce(p_metadata->>'factor_code','standard')='helper'
      and p_model in ('claude-opus-4-7','claude-opus-4-8','claude-sonnet-4-6','claude-sonnet-5'))$old$;
  extended_gate text := $old$if p_model not in ('claude-opus-5','claude-opus-4-6','claude-haiku-4-5-20251001','gpt-5.6-sol','gpt-6-sol','gpt-6-astra')
    and not (coalesce(p_metadata->>'factor_code','standard')='helper'
      and p_model in ('claude-opus-4-7','claude-opus-4-8','claude-sonnet-4-6','claude-sonnet-5'))$old$;
  new_gate text := $new$if not exists (
    select 1 from public.adelphos_provider_rate_card
    where model=p_model and context_class='standard'
      and factor_code=coalesce(p_metadata->>'factor_code','standard')
      and component='uncached_input' and active
      and effective_from<=clock_timestamp()
      and (effective_until is null or effective_until>clock_timestamp())
  )$new$;
  item record;
  cutover timestamptz := clock_timestamp();
begin
  select pg_get_functiondef('public.adelphos_reserve_credits(text,text,text,text,text,numeric,jsonb)'::regprocedure) into definition;
  -- Accept the published September migration or an already-applied October repair.
  if position(extended_gate in definition)>0 then old_gate:=extended_gate;
  elsif position(new_gate in definition)>0 then old_gate:=new_gate;
  end if;
  if (length(definition)-length(replace(definition,old_gate,'')))/length(old_gate) <> 1 then
    raise exception 'Reservation model gate changed; inspect before applying';
  end if;
  for item in
    select m.model,c.component,c.base_rate*f.multiplier rate,f.factor_code,m.source
    from (values
      ('gpt-5.6-luna',0.20::numeric,0.02::numeric,0.25::numeric,0.25::numeric,1.20::numeric,'https://developers.openai.com/api/docs/models/gpt-5.6-luna'),
      ('gpt-5.6-sol',4,0.4,5,5,20,'https://developers.openai.com/api/docs/models/gpt-5.6-sol'),
      ('gpt-6-sol',2,0.2,2.5,2.5,10,'https://developers.openai.com/api/docs/models/gpt-6-sol'),
      ('gpt-6-astra',10,1,12.5,12.5,50,'https://developers.openai.com/api/docs/models/gpt-6-astra'),
      ('claude-haiku-4-5-20251001',1,0.1,1.25,2,5,'https://platform.claude.com/docs/en/about-claude/pricing'),
      ('claude-haiku-4-5',1,0.1,1.25,2,5,'https://platform.claude.com/docs/en/about-claude/pricing'),
      ('claude-opus-4-6',5,0.5,6.25,10,25,'https://platform.claude.com/docs/en/about-claude/pricing'),
      ('claude-opus-4-7',5,0.5,6.25,10,25,'https://platform.claude.com/docs/en/about-claude/pricing'),
      ('claude-opus-4-8',5,0.5,6.25,10,25,'https://platform.claude.com/docs/en/about-claude/pricing'),
      ('claude-opus-5',5,0.5,6.25,10,25,'https://platform.claude.com/docs/en/about-claude/pricing'),
      ('claude-sonnet-4-6',3,0.3,3.75,6,15,'https://platform.claude.com/docs/en/about-claude/pricing'),
      ('claude-sonnet-4-5',3,0.3,3.75,6,15,'https://platform.claude.com/docs/en/about-claude/pricing'),
      ('claude-sonnet-4-20250514',3,0.3,3.75,6,15,'https://platform.claude.com/docs/en/about-claude/pricing'),
      ('claude-sonnet-5',2,0.2,2.5,4,10,'https://platform.claude.com/docs/en/about-claude/pricing')
    ) m(model,input,cache,write5,write1,output,source)
    cross join lateral (values
      ('uncached_input',m.input),('cache_read',m.cache),('cache_write_5m',m.write5),
      ('cache_write_1h',m.write1),('billable_output',m.output),('reasoning_output',m.output)
    ) c(component,base_rate)
    cross join (values ('standard',4::numeric),('schematic',20::numeric),('helper',1.10::numeric)) f(factor_code,multiplier)
  loop
    if not exists (select 1 from public.adelphos_provider_rate_card
      where model=item.model and component=item.component and context_class='standard'
      and factor_code=item.factor_code and active and effective_from<=cutover
      and (effective_until is null or effective_until>cutover)) then
      insert into public.adelphos_provider_rate_card
        (rate_code,model,component,usd_per_million_units,context_class,factor_code,effective_from,source_url,source_effective_date,active)
      values ('configured-20261009-'||item.model||'-'||item.factor_code||'-'||item.component,
        item.model,item.component,item.rate,'standard',item.factor_code,cutover,item.source,'2026-10-09',true);
    end if;
  end loop;
  -- Transcription reports input/output tokens, with no cache-write/read components.
  for item in
    select c.component,c.base_rate*f.multiplier rate,f.factor_code
    from (values ('uncached_input',2.5::numeric),('billable_output',10::numeric)) c(component,base_rate)
    cross join (values ('standard',4::numeric),('schematic',20::numeric),('helper',1.10::numeric)) f(factor_code,multiplier)
  loop
    if not exists (select 1 from public.adelphos_provider_rate_card
      where model='gpt-4o-transcribe' and component=item.component and context_class='standard'
      and factor_code=item.factor_code and active and effective_from<=cutover
      and (effective_until is null or effective_until>cutover)) then
      insert into public.adelphos_provider_rate_card
        (rate_code,model,component,usd_per_million_units,context_class,factor_code,effective_from,source_url,source_effective_date,active)
      values ('configured-20261009-gpt-4o-transcribe-'||item.factor_code||'-'||item.component,
        'gpt-4o-transcribe',item.component,item.rate,'standard',item.factor_code,cutover,
        'https://developers.openai.com/api/docs/models/gpt-4o-transcribe','2026-10-09',true);
    end if;
  end loop;
  execute replace(definition,old_gate,new_gate);
end $configured_models$;
commit;
