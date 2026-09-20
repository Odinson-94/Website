-- Run inside BEGIN/ROLLBACK. No fixture wallets or purchases survive.
do $$
declare
 e text := 'reports-owner-'||gen_random_uuid()||'@example.invalid';
 e2 text := 'reports-member-'||gen_random_uuid()||'@example.invalid';
 u text := gen_random_uuid()::text; u2 text := gen_random_uuid()::text;
 t text := 'reports-'||gen_random_uuid(); t2 text := 'member-'||gen_random_uuid();
 product text; q jsonb; r jsonb; receipt text; version bigint;
begin
 insert into public.adelphos_user_licenses(email,plan_code,status,auth_user_id,tenant_id) values
 (e,'free','free',u,t),(e2,'free','free',u2,t2);
 insert into public.adelphos_credit_contracts(email,rolling_usage_credit_cap,max_projects,approved_by)
 values(e,10000,100,'rollback test'),(e2,10000,100,'rollback test');
 insert into public.adelphos_usage_credit_accounts(email,available_usage_credits,included_available_usage_credits,lifetime_granted_usage_credits,introductory_grant_at,included_period_id)
 values(e,200,200,200,now(),'report-test'),(e2,0,0,0,now(),'report-test');
 foreach product in array array['sap','roomplanner','lighting','thermal','estimating','programme','cable'] loop
  update public.adelphos_report_price_catalogue set published=jsonb_set(published,array[product,'usageCredits'],'20') where id;
  q:=public.adelphos_quote_project_report(e,t,u,product,'saved-project',t);
  version:=(q->>'priceVersion')::bigint;
  if (q->>'alreadyPurchased')::boolean or q->>'usageCredits'<>'20' then raise exception 'Bad initial quote %', product; end if;
  r:=public.adelphos_purchase_project_report(e2,t2,u2,product,'saved-project',version,'report:'||gen_random_uuid(),null,t);
  if r->>'reason'<>'insufficient_usage_credits' then raise exception 'Zero wallet accepted %',product; end if;
  r:=public.adelphos_purchase_project_report(e,t,u,product,'saved-project',version,'report:'||gen_random_uuid(),null,t);
  if not (r->>'allowed')::boolean then raise exception 'Purchase refused %: %',product,r; end if;
  receipt:=r->>'receiptId';
  -- The service has authorised this second company member; the payer is preserved.
  q:=public.adelphos_quote_project_report(e2,t2,u2,product,'saved-project',t);
  if not (q->>'alreadyPurchased')::boolean or q->>'paidByUserId'<>u or q->>'receiptId'<>receipt or q->>'usageCredits'<>'0' then raise exception 'Member purchase coverage missing %',product; end if;
  r:=public.adelphos_purchase_project_report(e2,t2,u2,product,'saved-project',version-1,'report:'||gen_random_uuid(),null,t);
  if not (r->>'idempotent')::boolean or r->>'receiptId'<>receipt then raise exception 'Repeated edited project charged %',product; end if;
  q:=public.adelphos_quote_project_report(e2,t2,u2,product,'another-project',t);
  if (q->>'alreadyPurchased')::boolean then raise exception 'Another project incorrectly covered'; end if;
 end loop;
 if (select available_usage_credits from public.adelphos_usage_credit_accounts where email=e)<>60 then raise exception 'Expected seven purchases only'; end if;
 if (select available_usage_credits from public.adelphos_usage_credit_accounts where email=e2)<>0 then raise exception 'Member wallet changed'; end if;
 if (select count(*) from public.adelphos_report_entitlements where owner_tenant_id=t)<>7 then raise exception 'Durable receipt count wrong'; end if;
 if has_function_privilege('authenticated','public.adelphos_purchase_project_report(text,text,text,text,text,bigint,text,text,text)','execute') then raise exception 'Browser can debit directly'; end if;
end $$;
select 'PASS: all seven apps, one purchase per project, payer preserved, authorised-member replay, edits, zero wallet, separate projects, role isolation' as proof;
