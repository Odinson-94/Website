-- ADELPHOS-SESSION 2026-10-09/codex-model-billing/74d61b2e
-- Link the effective model rate records to the existing Sales pricing catalogue.
-- Preserve every existing draft/published value and the provider rate records.
begin;
do $model_catalogue$
declare
  additions jsonb;
  added_codes text[];
begin
  perform 1 from public.adelphos_report_price_catalogue where id for update;
  if exists (select 1 from public.adelphos_report_price_catalogue
    where token_price_baseline is distinct from public.adelphos_current_token_prices()) then
    raise exception 'Existing pricing baseline drifted; reconcile before linking models';
  end if;
  with added as (
    insert into public.adelphos_token_price_products (code,model,factor_code,component,context_class)
    select distinct md5(r.model||':'||r.factor_code||':'||r.component||':'||r.context_class),
      r.model,r.factor_code,r.component,r.context_class
    from public.adelphos_provider_rate_card r
    where r.model in ('claude-haiku-4-5-20251001','claude-haiku-4-5','claude-opus-4-6',
      'claude-opus-4-7','claude-opus-4-8','claude-opus-5','claude-sonnet-4-20250514',
      'claude-sonnet-4-5','claude-sonnet-4-6','claude-sonnet-5','gpt-5.6-luna',
      'gpt-5.6-sol','gpt-6-sol','gpt-6-astra','gpt-4o-transcribe')
      and r.context_class='standard' and r.factor_code in ('standard','schematic','helper')
      and r.active and r.effective_from<=now() and (r.effective_until is null or r.effective_until>now())
    on conflict (model,factor_code,component,context_class) do nothing
    returning *
  )
  select array_agg(code) into added_codes from added;
  if added_codes is null then return; end if;
  -- Reuse the existing effective-price owner after the product insert completes.
  select jsonb_object_agg(key,value) into additions
    from jsonb_each(public.adelphos_current_token_prices()) where key=any(added_codes);
  update public.adelphos_report_price_catalogue set
    economics_draft=jsonb_set(coalesce(economics_draft,'{}'),'{tokenRates}',
      additions||coalesce(economics_draft->'tokenRates','{}')),
    economics_published=case when economics_published is null then null else
      jsonb_set(economics_published,'{tokenRates}',additions||coalesce(economics_published->'tokenRates','{}')) end,
    token_price_baseline=additions||coalesce(token_price_baseline,'{}'),
    revision=revision+1,updated_at=clock_timestamp();
end $model_catalogue$;
notify pgrst,'reload schema';
commit;
