-- Run against an isolated PostgreSQL database after the report-price migration.
-- All test state is rolled back; never use this as a live publication operation.
begin;
do $$
declare draft jsonb; changed jsonb; result jsonb; original jsonb; replay jsonb;
begin
 select c.draft into draft from public.adelphos_report_price_catalogue c where id;
 if public.adelphos_published_report_prices() is not null then raise exception 'Expected unpublished fixture'; end if;
 if public.adelphos_validate_report_prices(draft) is distinct from true then raise exception 'Draft seed invalid'; end if;
 if public.adelphos_validate_report_prices(draft-'sap') then raise exception 'Missing product accepted'; end if;
 if public.adelphos_validate_report_prices(jsonb_set(draft,'{cable,usageCredits}','-1')) then raise exception 'Negative accepted'; end if;
 if public.adelphos_validate_report_prices(jsonb_set(draft,'{cable,usageCredits}','0.001')) then raise exception 'Fractional precision accepted'; end if;
 if public.adelphos_validate_report_prices(jsonb_set(draft,'{cable,batches}','[{"quantity":3,"usageCredits":18},{"quantity":2,"usageCredits":17}]')) then raise exception 'Unordered batches accepted'; end if;
 if public.adelphos_validate_report_prices(jsonb_set(draft,'{cable,batches}','[{"quantity":3,"usageCredits":21}]')) then raise exception 'Non-discount accepted'; end if;
 changed:=jsonb_set(draft,'{cable,usageCredits}','25');
 changed:=jsonb_set(changed,'{cable,batches}','[{"quantity":5,"usageCredits":18}]');
 result:=public.adelphos_change_report_prices('11111111-1111-4111-8111-111111111111','tester@adelphos.ai','save','Acceptance draft',0,changed);
 if (result->>'revision')::int<>1 or public.adelphos_published_report_prices() is not null then raise exception 'Saving a draft published it'; end if;
 replay:=public.adelphos_change_report_prices('11111111-1111-4111-8111-111111111111','tester@adelphos.ai','save','Acceptance draft',0,changed);
 if result<>replay or (select count(*) from public.adelphos_report_price_actions)<>1 then raise exception 'Retry duplicated save'; end if;
 begin
  perform public.adelphos_change_report_prices('11111111-1111-4111-8111-111111111111','tester@adelphos.ai','save','Changed reason',0,changed);
  raise exception 'Expected action ID conflict';
 exception when others then if sqlerrm not like 'Pricing action ID conflict%' then raise; end if; end;
 begin
  perform public.adelphos_change_report_prices('22222222-2222-4222-8222-222222222222','tester@adelphos.ai','publish','Stale publish',0,null);
  raise exception 'Expected stale publish conflict';
 exception when others then if sqlerrm not like 'Pricing revision conflict%' then raise; end if; end;
 result:=public.adelphos_change_report_prices('22222222-2222-4222-8222-222222222222','tester@adelphos.ai','publish','Publish reviewed prices',1,null);
 original:=public.adelphos_published_report_prices();
 if original->'products'<>changed or original->>'version'<>'1' or original ? 'draft' or original ? 'actor' or (result->>'revision')::int<>2 then raise exception 'Publication contract failed'; end if;
 perform public.adelphos_change_report_prices('33333333-3333-4333-8333-333333333333','tester@adelphos.ai','save','Prepare later draft',2,draft);
 if public.adelphos_published_report_prices()<>original then raise exception 'Later draft leaked publicly'; end if;
 replay:=public.adelphos_change_report_prices('22222222-2222-4222-8222-222222222222','tester@adelphos.ai','publish','Publish reviewed prices',1,null);
 if replay<>result or (select revision from public.adelphos_report_price_catalogue)<>3 then raise exception 'Publish retry changed newer draft'; end if;
 if (select count(*) from public.adelphos_report_price_actions)<>3 then raise exception 'Audit count mismatch'; end if;
 if has_table_privilege('anon','public.adelphos_report_price_catalogue','select') or has_table_privilege('authenticated','public.adelphos_report_price_actions','select') then raise exception 'Private catalogue exposed'; end if;
 if has_function_privilege('authenticated','public.adelphos_change_report_prices(uuid,text,text,text,integer,jsonb)','execute') then raise exception 'Untrusted role can publish'; end if;
 if has_table_privilege('service_role','public.adelphos_report_price_actions','update') then raise exception 'Audit is mutable through REST'; end if;
 if not has_function_privilege('service_role','public.adelphos_change_report_prices(uuid,text,text,text,integer,jsonb)','execute') then raise exception 'Service cannot publish'; end if;
 raise notice 'PASS: validation, draft privacy, atomic publication, stale revisions, idempotent retry, immutable audit and privileges';
end $$;
rollback;
