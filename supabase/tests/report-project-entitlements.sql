-- Database integration regression. Operator MUST wrap migration + this file in
-- BEGIN/ROLLBACK. Fixture credits never survive and are not live UI acceptance.
do $$
declare
 e text := 'report-rollback-'||gen_random_uuid()::text||'@example.invalid';
 u text := gen_random_uuid()::text;
 t text := 'report-rollback-'||gen_random_uuid()::text;
 rid text := 'report:'||gen_random_uuid()::text;
 q jsonb; r jsonb; v bigint; b numeric; n integer;
begin
 insert into public.adelphos_user_licenses(email,plan_code,status,auth_user_id,tenant_id)
 values(e,'free','free',u,t);
 insert into public.adelphos_credit_contracts(email,rolling_usage_credit_cap,max_projects,approved_by)
 values(e,10000,100,'rollback regression');
 insert into public.adelphos_usage_credit_accounts(email,available_usage_credits,included_available_usage_credits,
  lifetime_granted_usage_credits,introductory_grant_at,included_period_id)
 values(e,100,100,100,now(),'report-regression');
 update public.adelphos_report_price_catalogue set published=jsonb_set(published,'{cable,usageCredits}','20') where id;
 q:=public.adelphos_quote_report_export(e,t,u,'cable','scope-1');
 v:=(q->>'priceVersion')::bigint;
 if q->>'usageCredits'<>'20' or (q->>'alreadyPurchased')::boolean then raise exception 'Initial quote invalid'; end if;
 if exists(select 1 from public.adelphos_credit_ledger where lower(email::text)=e) then raise exception 'Quote charged'; end if;
 begin
  perform public.adelphos_quote_report_export(e,t||'-foreign',u,'cable','scope-1');
  raise exception 'Foreign tenant accepted';
 exception when others then if sqlerrm<>'Report billing identity is unavailable' then raise; end if; end;
 begin
  perform public.adelphos_quote_report_export(e,t,u||'-foreign','cable','scope-1');
  raise exception 'Foreign user accepted';
 exception when others then if sqlerrm<>'Report billing identity is unavailable' then raise; end if; end;
 r:=public.adelphos_purchase_report_export(e,t,u,'cable','scope-1',v-1,rid,repeat('a',64));
 if r->>'reason'<>'report_price_changed' then raise exception 'Stale quote accepted'; end if;
 r:=public.adelphos_purchase_report_export(e,t,u,'cable','scope-1',v,rid,repeat('a',64));
 if not (r->>'allowed')::boolean or r->>'usageCredits'<>'20' then raise exception 'Purchase failed: %',r; end if;
 select available_usage_credits into b from public.adelphos_usage_credit_accounts where email=e;
 if b<>80 then raise exception 'Wrong wallet debit: %',b; end if;
 if not exists(select 1 from public.adelphos_credit_reservations where request_id=rid and status='settled'
  and model='manual-report' and actual_usage_credits=20 and reserved_included_credits=20) then raise exception 'Missing settled receipt'; end if;
 if not exists(select 1 from public.adelphos_billing_projects where project_id='report-project:'||md5(t||':'||u||':scope-1')
  and reserved_usage_credits=0 and spent_usage_credits=20) then raise exception 'Project totals mismatch'; end if;
 -- Retry, another run and a revised report all use the same project entitlement.
 r:=public.adelphos_purchase_report_export(e,t,u,'cable','scope-1',v,rid,repeat('a',64));
 if not (r->>'idempotent')::boolean or r->>'usageCredits'<>'0' then raise exception 'Retry charged'; end if;
 update public.adelphos_report_price_catalogue set published_revision=published_revision+1,
  published=jsonb_set(published,'{cable,usageCredits}','21') where id;
 r:=public.adelphos_purchase_report_export(e,t,u,'cable','scope-1',v,'report:'||gen_random_uuid(),repeat('b',64));
 if r->>'usageCredits'<>'0' or r->>'receiptId'<>rid then raise exception 'Revision/price change lost entitlement'; end if;
 select count(*) into n from public.adelphos_credit_ledger where request_id=rid and event_type='settle';
 if n<>1 then raise exception 'Duplicate debit receipt'; end if;
 q:=public.adelphos_quote_report_export(e,t,u,'cable','scope-2');
 v:=(q->>'priceVersion')::bigint;
 if q->>'usageCredits'<>'21' then raise exception 'New project did not receive current price'; end if;
 begin
  perform public.adelphos_purchase_report_export(e,t,u,'cable','scope-2',v,rid,repeat('a',64));
  raise exception 'Cross-project request replay accepted';
 exception when others then if sqlerrm<>'Report request identity conflict' then raise; end if; end;
 -- Denial writes no entitlement or reservation and spends nothing.
 update public.adelphos_usage_credit_accounts set available_usage_credits=0,included_available_usage_credits=0 where email=e;
 rid:='report:'||gen_random_uuid();
 r:=public.adelphos_purchase_report_export(e,t,u,'cable','scope-2',v,rid,repeat('c',64));
 if r->>'reason'<>'insufficient_usage_credits' then raise exception 'Zero balance did not refuse: %',r; end if;
 if exists(select 1 from public.adelphos_report_entitlements where request_id=rid)
  or exists(select 1 from public.adelphos_credit_reservations where request_id=rid) then raise exception 'Denial created purchase'; end if;
 -- Mixed included/top-up allocation follows the existing wallet's FIFO lots.
 insert into public.adelphos_usage_credit_lots(email,granted_usage_credits,remaining_usage_credits,stripe_checkout_session_id)
 values(e,30,30,'cs_rollback_fixture_'||gen_random_uuid());
 update public.adelphos_usage_credit_accounts set available_usage_credits=35,included_available_usage_credits=5,
  top_up_available_usage_credits=30 where email=e;
 r:=public.adelphos_purchase_report_export(e,t,u,'cable','scope-2',v,rid,repeat('c',64));
 if not (r->>'allowed')::boolean then raise exception 'Funded retry failed'; end if;
 if not exists(select 1 from public.adelphos_credit_reservations where request_id=rid
  and reserved_included_credits=5 and reserved_top_up_credits=16) then raise exception 'Credit source allocation incorrect'; end if;
 if (select remaining_usage_credits from public.adelphos_usage_credit_lots where email=e)<>14 then raise exception 'Top-up lot not consumed'; end if;
 if (select lifetime_spent_usage_credits from public.adelphos_usage_credit_accounts where email=e)<>41 then raise exception 'Lifetime total mismatch'; end if;
 if has_function_privilege('authenticated','public.adelphos_purchase_report_export(text,text,text,text,text,bigint,text,text)','execute')
  or has_function_privilege('anon','public.adelphos_quote_report_export(text,text,text,text,text)','execute')
  or has_table_privilege('authenticated','public.adelphos_report_entitlements','select') then raise exception 'Browser permission leak'; end if;
end $$;
select 'PASS: quote isolation, identity boundaries, current publication, atomic receipt, retry/revision entitlement, zero-credit denial, funded retry, included/top-up allocation, role permissions' as proof;
