-- Run inside a transaction, always rolled back by the operator/test runner.
do $$
declare c public.adelphos_report_price_catalogue; e jsonb; prices jsonb; result jsonb; pub jsonb; token text; before_rate numeric; cutover timestamptz; metadata public.adelphos_token_price_products;
begin
 select * into c from public.adelphos_report_price_catalogue where id;
 if not public.adelphos_validate_commercial_prices(c.economics_draft) then raise exception 'Seed failed validation'; end if;
 if public.adelphos_validate_commercial_prices(c.economics_draft||'{"injected":true}') then raise exception 'Unexpected field accepted'; end if;
 if public.adelphos_validate_commercial_prices(jsonb_set(c.economics_draft,'{retail,packPriceMinor}','20.001')) then raise exception 'Fractional penny accepted'; end if;
 select * into metadata from public.adelphos_token_price_products where component='uncached_input' and factor_code='standard' order by model limit 1;
 token:=metadata.code; before_rate:=(c.economics_draft->'tokenRates'->>token)::numeric;
 e:=jsonb_set(c.economics_draft,array['tokenRates',token],to_jsonb(before_rate+1));
 e:=jsonb_set(e,'{retail,packPriceMinor}','2100');
 prices:=jsonb_set(c.draft,'{cable,usageCredits}','21');
 result:=public.adelphos_change_commercial_prices('019a0190-0000-4000-8000-000000000050','test@adelphos.ai','save','Transactional publish regression',c.revision,prices,e);
 if public.adelphos_current_token_prices()->token<>to_jsonb(before_rate) then raise exception 'Draft changed billing'; end if;
 if result<>public.adelphos_change_commercial_prices('019a0190-0000-4000-8000-000000000050','test@adelphos.ai','save','Transactional publish regression',c.revision,prices,e) then raise exception 'Save retry changed result'; end if;
 begin
  perform public.adelphos_change_commercial_prices(gen_random_uuid(),'test@adelphos.ai','save','Stale revision regression',c.revision,prices,e);
  raise exception 'Stale revision accepted';
 exception when others then if sqlerrm not like 'Pricing revision conflict%' then raise; end if; end;
 select * into c from public.adelphos_report_price_catalogue where id;
 cutover:=clock_timestamp();
 result:=public.adelphos_change_commercial_prices('019a0190-0000-4000-8000-000000000051','test@adelphos.ai','publish','Transactional publish regression',c.revision,null,null,
  jsonb_build_object('id','price_transactionalTestOnly','currency','gbp','unit_amount',2100,'livemode',(select bp.metadata->>'stripe_mode'='live' from public.adelphos_billing_plans bp where bp.code=c.published_credit_plan),'lookup_key','transactional-test-only'));
 pub:=public.adelphos_published_report_prices();
 if pub#>>'{products,cable,usageCredits}'<>'21' or pub#>>'{retail,packPriceMinor}'<>'2100' then raise exception 'Publication did not reach public reader'; end if;
 if not exists(select 1 from public.adelphos_provider_rate_card r where r.model=metadata.model and r.factor_code=metadata.factor_code and r.component=metadata.component and r.context_class=metadata.context_class and r.effective_until is null and usd_per_million_units=before_rate+1) then raise exception 'Billing rate not updated'; end if;
 if not exists(select 1 from public.adelphos_provider_rate_card r where r.model=metadata.model and r.factor_code=metadata.factor_code and r.component=metadata.component and r.context_class=metadata.context_class and r.active and r.effective_from<=cutover and r.effective_until>cutover and r.usd_per_million_units=before_rate) then raise exception 'Historical quote rate not preserved'; end if;
 if not exists(select 1 from public.adelphos_billing_plans where code='payg-20' and price_cents=2000 and active and is_active) then raise exception 'Old checkout plan changed'; end if;
 if not exists(select 1 from public.adelphos_billing_plans where code=result->>'published_credit_plan' and price_cents=2100 and top_up_usage_credits=15) then raise exception 'New checkout price not connected'; end if;
 if has_function_privilege('authenticated','public.adelphos_change_commercial_prices(uuid,text,text,text,integer,jsonb,jsonb,jsonb)','execute') then raise exception 'Browser can publish'; end if;
end $$;
select 'PASS: draft isolation, validation, stale revision, idempotency, publication, billing rate, historical quote, checkout versioning, browser authorization' as proof;
