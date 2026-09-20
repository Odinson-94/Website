set local search_path=cycle_acceptance,public;
insert into adelphos_billing_plans select * from public.adelphos_billing_plans where code in ('free','everyday','standard','business');
-- Tests use public plan sizes (15/40/160 UC), marked as test-mode in this rolled-back copy.
update adelphos_billing_plans set metadata=jsonb_set(coalesce(metadata,'{}'),'{stripe_mode}'::text[],'"test"'::jsonb);
insert into adelphos_usage_credit_accounts(email,available_usage_credits,top_up_available_usage_credits) values('cycle@example.invalid',5,5);
do $$ declare invoices jsonb; r jsonb; begin
 invoices:='[{"invoice_id":"base","plan_code":"everyday","kind":"base","start":100,"end":200}]';
 r:=adelphos_grant_subscription_cycle_credits('cycle@example.invalid','sub_cycle',to_timestamp(100),to_timestamp(200),invoices);
 assert (r->>'granted_usage_credits')::numeric=15,'initial cycle';
 update adelphos_usage_credit_accounts set included_available_usage_credits=10,available_usage_credits=15,lifetime_spent_usage_credits=5 where email='cycle@example.invalid';
 invoices:=invoices||'[{"invoice_id":"upgrade","plan_code":"standard","kind":"update","start":150,"end":200}]';
 r:=adelphos_grant_subscription_cycle_credits('cycle@example.invalid','sub_cycle',to_timestamp(100),to_timestamp(200),invoices);
 assert (r->>'granted_usage_credits')::numeric=12.5,'half-cycle upgrade grants only half the 25 UC increase';
 assert (select included_available_usage_credits=22.5 from adelphos_usage_credit_accounts where email='cycle@example.invalid'),'consumption retained';
 invoices:=invoices||'[{"invoice_id":"down","plan_code":"everyday","kind":"update","start":160,"end":200},{"invoice_id":"repeat","plan_code":"standard","kind":"update","start":170,"end":200}]';
 r:=adelphos_grant_subscription_cycle_credits('cycle@example.invalid','sub_cycle',to_timestamp(100),to_timestamp(200),invoices);
 assert (r->>'granted_usage_credits')::numeric=0,'downgrade and repeat cannot farm credits';
 invoices:=invoices||'[{"invoice_id":"business","plan_code":"business","kind":"update","start":180,"end":200}]';
 r:=adelphos_grant_subscription_cycle_credits('cycle@example.invalid','sub_cycle',to_timestamp(100),to_timestamp(200),invoices);
 assert (r->>'granted_usage_credits')::numeric=24,'later upgrade adds only 120 UC times remaining fifth';
 assert (select included_available_usage_credits=46.5 and top_up_available_usage_credits=5 from adelphos_usage_credit_accounts where email='cycle@example.invalid'),'correct pooled balance';
 r:=adelphos_grant_subscription_cycle_credits('cycle@example.invalid','sub_cycle',to_timestamp(100),to_timestamp(200),invoices);
 assert (r->>'granted_usage_credits')::numeric=0,'whole cycle replay idempotent';
 assert (select count(*)=3 from adelphos_usage_credit_grants where email='cycle@example.invalid'),'only positive allocations recorded as grants';
 insert into adelphos_credit_reservations(request_id,email,project_id,request_kind,model,reserved_usage_credits,reserved_included_credits,reserved_top_up_credits,included_period_id,status)
  values('cycle-held','cycle@example.invalid','test-project','chat','test',1,1,0,'base','reserved');
 begin
  perform adelphos_apply_payment_refund('ch_upgrade','pi_upgrade','upgrade',1500,750,'gbp',false);
  raise exception 'Expected pooled reservation refusal';
 exception when others then assert sqlerrm='Refund awaits active credit reservations; retry.','upgrade refund sees reservations against shared base pool'; end;
 update adelphos_credit_reservations set status='released' where request_id='cycle-held';
 -- The upgrade refund cannot revoke credits funded by the later Business invoice.
 r:=adelphos_apply_payment_refund('ch_upgrade','pi_upgrade','upgrade',1500,750,'gbp',false);
 assert (r->>'revoked_usage_credits')::numeric=6.25,'partial upgrade refund';
 r:=adelphos_apply_payment_refund('ch_base','pi_base','base',2000,2000,'gbp',false);
 assert (r->>'revoked_usage_credits')::numeric=10 and (r->>'absorbed_usage_credits')::numeric=5,'base refund accounts for its spent credits';
 r:=adelphos_apply_payment_refund('ch_upgrade','pi_upgrade','upgrade',1500,1500,'gbp',false);
 assert (r->>'revoked_usage_credits')::numeric=6.25,'remaining upgrade refund';
 assert (select included_available_usage_credits=24 and available_usage_credits=29 from adelphos_usage_credit_accounts where email='cycle@example.invalid'),'unrelated funded Business credits and top-up preserved';
 r:=adelphos_apply_payment_refund('ch_repeat','pi_repeat','repeat',1000,1000,'gbp',false);
 assert (r->>'revoked_usage_credits')::numeric=0,'refund of zero-credit repeat takes nothing';
 r:=adelphos_grant_subscription_cycle_credits('cycle@example.invalid','sub_cycle',to_timestamp(100),to_timestamp(200),invoices);
 assert (r->>'granted_usage_credits')::numeric=0,'refunded credit cannot be regranted by replay';
 -- Even if subscription.updated has already moved the licence period, a new
 -- base invoice must expire the old pool rather than adopt its allowance.
 invoices:='[{"invoice_id":"renewal","plan_code":"standard","kind":"base","start":200,"end":300}]';
 r:=adelphos_grant_subscription_cycle_credits('cycle@example.invalid','sub_cycle',to_timestamp(200),to_timestamp(300),invoices,true);
 assert (r->>'granted_usage_credits')::numeric=40,'renewal grants correct current tier';
 assert (select included_available_usage_credits=40 and available_usage_credits=45 and included_period_id='renewal' from adelphos_usage_credit_accounts where email='cycle@example.invalid'),'renewal does not roll over included credits';
 r:=adelphos_apply_payment_refund('ch_business','pi_business','business',3000,3000,'gbp',false);
 assert (r->>'revoked_usage_credits')::numeric=0 and (r->>'absorbed_usage_credits')::numeric=24,'expired pool refund preserves renewal';
 assert (select included_available_usage_credits=40 from adelphos_usage_credit_accounts where email='cycle@example.invalid'),'new allowance preserved';
end $$;

insert into adelphos_usage_credit_accounts(email,available_usage_credits,included_available_usage_credits,included_period_id,lifetime_granted_usage_credits)
 values('legacy@example.invalid',12,12,'legacy_base',15);
insert into adelphos_usage_credit_grants(grant_id,email,grant_kind,usage_credits,metadata)
 values('period:legacy_base','legacy@example.invalid','subscription_period',15,'{"plan_code":"everyday"}');
do $$ declare r jsonb; begin
 r:=adelphos_grant_subscription_cycle_credits('legacy@example.invalid','sub_legacy',to_timestamp(100),to_timestamp(200),
 '[{"invoice_id":"legacy_base","plan_code":"everyday","kind":"base","start":100,"end":200},{"invoice_id":"legacy_upgrade","plan_code":"standard","kind":"update","start":150,"end":200}]',true);
 assert (r->>'granted_usage_credits')::numeric=12.5,'legacy adoption only adds upgrade delta';
 assert (select included_available_usage_credits=24.5 and lifetime_granted_usage_credits=27.5 from adelphos_usage_credit_accounts where email='legacy@example.invalid'),'legacy consumption and history preserved';
 r:=adelphos_apply_payment_refund('ch_legacy','pi_legacy','legacy_base',2000,2000,'gbp',false);
 assert (r->>'revoked_usage_credits')::numeric=12 and (r->>'absorbed_usage_credits')::numeric=3,'legacy source refund after adoption';
 assert (select included_available_usage_credits=12.5 from adelphos_usage_credit_accounts where email='legacy@example.invalid'),'legacy upgrade funding preserved';
end $$;

insert into adelphos_user_licenses(email,plan_code,status,stripe_customer_id,stripe_subscription_id)
 values('atomic@example.invalid','everyday','active','cus_atomic','sub_atomic');
do $$ declare r jsonb; begin
 r:=adelphos_apply_subscription_event_v2('atomic@example.invalid','sub_atomic',0,'sub_atomic','cus_atomic','standard','active',to_timestamp(100),to_timestamp(200),false,false,'late',
 '[{"invoice_id":"atomic_base","plan_code":"everyday","kind":"base","start":100,"end":200},{"invoice_id":"late","plan_code":"standard","kind":"update","start":199,"end":200}]');
 assert (select included_available_usage_credits=15.25 from adelphos_usage_credit_accounts where email='atomic@example.invalid'),'last-minute upgrade cannot buy a whole monthly refill';
 assert (select stripe_state_version=1 from adelphos_user_licenses where email='atomic@example.invalid'),'state and allocation commit together';
 assert not has_function_privilege('authenticated','cycle_acceptance.adelphos_grant_subscription_cycle_credits(text,text,timestamptz,timestamptz,jsonb,boolean)','EXECUTE'),'browser cannot allocate credits';
 assert not has_function_privilege('anon','cycle_acceptance.adelphos_apply_subscription_event_v2(text,text,bigint,text,text,text,text,timestamptz,timestamptz,boolean,boolean,text,jsonb)','EXECUTE'),'anonymous state update denied';
end $$;
select 'PASS: paid-cycle ceiling, consumption, proration, downgrade/repeat, renewal, legacy adoption, source-scoped refunds, atomic state and role guards' as verdict;
