-- Real database assertions; every test mutation rolls back.
begin;
do $$
declare c public.adelphos_report_price_catalogue; result jsonb; published jsonb; changed jsonb; request_id uuid := '019a0190-0000-4000-8000-000000000011';
begin
 select * into c from public.adelphos_report_price_catalogue where id;
 assert (select count(*)=34 from public.adelphos_app_price_products), 'All registered apps required';
 assert (select count(*)=22 from public.adelphos_app_price_products where mode='report'), '22 editable report prices';
 assert public.adelphos_validate_report_prices(c.draft), 'Complete draft valid';
 assert not public.adelphos_validate_report_prices(c.draft-'roomplanner'), 'Missing app rejected';
 assert not public.adelphos_validate_report_prices(c.draft||'{"unknown":{"usageCredits":20,"batches":[]}}'), 'Unknown app rejected';
 assert not public.adelphos_validate_report_prices(jsonb_set(c.draft,'{browser,usageCredits}','20')), 'Included app cannot acquire a flat fee';
 assert not public.adelphos_validate_report_prices(jsonb_set(c.draft,'{roomplanner,usageCredits}','-1')), 'Invalid new app price rejected';
 assert not public.adelphos_validate_report_prices(jsonb_set(c.draft,'{roomplanner,batches}','[{"quantity":5,"usageCredits":21}]')), 'Non-discounted batch rejected';
 changed := jsonb_set(c.draft,'{roomplanner}','{"usageCredits":32,"batches":[{"quantity":5,"usageCredits":25}]}');
 result := public.adelphos_change_report_prices(request_id,'test@adelphos.ai','save','Test additional app editing',c.revision,changed);
 assert result->'draft'->'roomplanner'->>'usageCredits'='32', 'Additional app saved';
 assert result->'published' is not distinct from coalesce(to_jsonb(c.published),'null'::jsonb), 'Save does not publish';
 assert public.adelphos_change_report_prices(request_id,'test@adelphos.ai','save','Test additional app editing',c.revision,changed)=result,'Idempotent save';
 begin
  perform public.adelphos_change_report_prices('019a0190-0000-4000-8000-000000000012','test@adelphos.ai','publish','Reject stale publish',c.revision,null);
  raise exception 'Stale publish accepted';
 exception when others then if sqlerrm not like 'Pricing revision conflict%' then raise; end if;
 end;
 result := public.adelphos_change_report_prices('019a0190-0000-4000-8000-000000000013','test@adelphos.ai','publish','Test expanded website publication',(result->>'revision')::integer,null);
 published := public.adelphos_published_report_prices();
 assert (select count(*)=28 from jsonb_object_keys(published->'products')), 'Every public app published';
 assert not (published->'products' ? 'usersales'), 'Internal apps private';
 assert published->'products'->'roomplanner'->>'usageCredits'='32', 'Website sees edited price';
 assert published->'products'->'roomplanner'->'batches'->0->>'usageCredits'='25', 'Website sees edited batches';
 assert published->'products'->'browser'->>'mode'='included', 'Included apps explicit';
 assert not (published ? 'draft') and not (published ? 'actor'), 'Draft and audit private';
 assert not has_table_privilege('authenticated','public.adelphos_app_price_products','SELECT'), 'No authenticated metadata access';
 assert not has_table_privilege('service_role','public.adelphos_app_price_products','UPDATE'), 'Metadata not client editable';
end $$;
rollback;
