-- Run in one transaction after creating refund_acceptance and cloning the six
-- referenced billing tables with LIKE INCLUDING ALL, then applying the migration
-- with public. replaced by refund_acceptance. Always ROLLBACK.
set local search_path=refund_acceptance,public;
insert into adelphos_billing_plans
select (jsonb_populate_record(null::refund_acceptance.adelphos_billing_plans,
 to_jsonb(p)||jsonb_build_object('code','refund-test-payg','metadata',jsonb_build_object('stripe_mode','test')))).*
from public.adelphos_billing_plans p where code='payg-20';
insert into adelphos_billing_plans
select (jsonb_populate_record(null::refund_acceptance.adelphos_billing_plans,
 to_jsonb(p)||jsonb_build_object('code','refund-test-sub','metadata',jsonb_build_object('stripe_mode','test')))).*
from public.adelphos_billing_plans p where code='business';

insert into adelphos_usage_credit_accounts(email,available_usage_credits,included_available_usage_credits,top_up_available_usage_credits,included_period_id,lifetime_granted_usage_credits)
 values('refund-fixture@example.invalid',47,12,35,'current-period',47);
insert into adelphos_usage_credit_lots(id,email,granted_usage_credits,remaining_usage_credits,stripe_checkout_session_id,stripe_payment_intent_id,metadata)
 values('00000000-0000-0000-0000-000000000001','refund-fixture@example.invalid',15,15,'cs_refund','pi_refund','{"plan_code":"refund-test-payg"}'),
 ('00000000-0000-0000-0000-000000000002','refund-fixture@example.invalid',20,20,'cs_other','pi_other','{"plan_code":"refund-test-payg"}');
do $$ declare r jsonb; begin
 r:=adelphos_apply_payment_refund('ch_refund','pi_refund',null,2000,1000,'gbp',false);
 assert (r->>'revoked_usage_credits')::numeric=7.5, 'partial refund';
 assert (select available_usage_credits=39.5 from adelphos_usage_credit_accounts), 'partial wallet';
 r:=adelphos_apply_payment_refund('ch_refund','pi_refund',null,2000,1000,'gbp',false);
 assert (r->>'idempotent')::boolean, 'duplicate refund';
 r:=adelphos_apply_payment_refund('ch_refund','pi_refund',null,2000,500,'gbp',false);
 assert (r->>'idempotent')::boolean, 'older cumulative event';
 assert (select count(*)=1 from adelphos_credit_ledger), 'one adjustment';
 r:=adelphos_apply_payment_refund('ch_refund','pi_refund',null,2000,2000,'gbp',false);
 assert (r->>'revoked_usage_credits')::numeric=7.5, 'remaining refund';
 assert (select available_usage_credits=32 and included_available_usage_credits=12 and top_up_available_usage_credits=20 and lifetime_granted_usage_credits=47 from adelphos_usage_credit_accounts), 'other buckets preserved';
 assert (select remaining_usage_credits=20 from adelphos_usage_credit_lots where stripe_payment_intent_id='pi_other'), 'other purchase preserved';
 assert (select sum(usage_credits)=-15 from adelphos_credit_ledger), 'adjustment sum';
 begin
  perform adelphos_apply_payment_refund('ch_refund','pi_refund',null,3000,2000,'gbp',false);
  raise exception 'Expected identity rejection';
 exception when others then assert sqlerrm='Refund identity changed.', 'identity rejected'; end;
 begin
  perform adelphos_apply_payment_refund('ch_wrong','pi_other',null,2000,1000,'gbp',true);
  raise exception 'Expected mode rejection';
 exception when others then assert sqlerrm='Refund does not match the original payment mode or currency.', 'mode rejected'; end;
 begin
  perform adelphos_apply_payment_refund('ch_wrong','pi_missing',null,2000,1000,'gbp',false);
  raise exception 'Expected missing grant rejection';
 exception when others then assert sqlerrm='Original payment grant is not available; retry after payment delivery.', 'missing payment retries'; end;
end $$;

-- An already consumed purchase never takes credits from a different purchase.
update adelphos_usage_credit_accounts set available_usage_credits=34,top_up_available_usage_credits=22;
insert into adelphos_usage_credit_lots(email,granted_usage_credits,remaining_usage_credits,stripe_checkout_session_id,stripe_payment_intent_id,metadata)
 values('refund-fixture@example.invalid',15,2,'cs_spent','pi_spent','{"plan_code":"refund-test-payg"}');
do $$ declare r jsonb; begin
 r:=adelphos_apply_payment_refund('ch_spent','pi_spent',null,2000,2000,'gbp',false);
 assert (r->>'revoked_usage_credits')::numeric=2 and (r->>'absorbed_usage_credits')::numeric=13, 'spent credit audit';
 assert (select available_usage_credits=32 from adelphos_usage_credit_accounts), 'no negative balance or other purchase debit';
end $$;

-- Reservations are refused, then the same event succeeds after release.
insert into adelphos_credit_reservations(request_id,email,project_id,request_kind,model,reserved_usage_credits,reserved_included_credits,reserved_top_up_credits,top_up_lot_allocations,status)
 values('refund-held','refund-fixture@example.invalid','test-project','chat','test',1,0,1,
 '[{"lot_id":"00000000-0000-0000-0000-000000000002","amount":1}]','reserved');
do $$ begin
 begin
  perform adelphos_apply_payment_refund('ch_other','pi_other',null,2000,2000,'gbp',false);
  raise exception 'Expected reservation rejection';
 exception when others then assert sqlerrm='Refund awaits active credit reservations; retry.', 'reservation gate'; end;
 assert not exists(select 1 from adelphos_payment_refund_state where stripe_charge_id='ch_other'), 'failed attempt is retryable';
end $$;
update adelphos_credit_reservations set status='released' where request_id='refund-held';
do $$ declare r jsonb; begin
 r:=adelphos_apply_payment_refund('ch_other','pi_other',null,2000,2000,'gbp',false);
 assert (r->>'revoked_usage_credits')::numeric=20, 'released retry';
 assert (select available_usage_credits=12 and top_up_available_usage_credits=0 from adelphos_usage_credit_accounts), 'released reconciliation';
end $$;

-- Current subscription refund removes only its unused allowance. Older expired
-- periods do not revoke the replacement period or a purchased bucket.
insert into adelphos_usage_credit_grants(grant_id,email,grant_kind,usage_credits,metadata)
 values('period:current-period','refund-fixture@example.invalid','subscription_period',40,'{"plan_code":"refund-test-sub"}'),
 ('period:old-period','refund-fixture@example.invalid','subscription_period',40,'{"plan_code":"refund-test-sub"}');
do $$ declare r jsonb; begin
 r:=adelphos_apply_payment_refund('ch_old','pi_old','old-period',5000,5000,'gbp',false);
 assert (r->>'revoked_usage_credits')::numeric=0 and (r->>'absorbed_usage_credits')::numeric=40, 'expired allowance';
 assert (select available_usage_credits=12 from adelphos_usage_credit_accounts), 'current allowance unchanged';
 r:=adelphos_apply_payment_refund('ch_current','pi_current','current-period',5000,5000,'gbp',false);
 assert (r->>'revoked_usage_credits')::numeric=12 and (r->>'absorbed_usage_credits')::numeric=28, 'current allowance refund';
 assert (select available_usage_credits=0 and included_available_usage_credits=0 from adelphos_usage_credit_accounts), 'zero remaining';
 assert not has_function_privilege('anon','refund_acceptance.adelphos_apply_payment_refund(text,text,text,bigint,bigint,text,boolean)','EXECUTE'), 'anon cannot refund';
 assert not has_function_privilege('authenticated','refund_acceptance.adelphos_apply_payment_refund(text,text,text,bigint,bigint,text,boolean)','EXECUTE'), 'browser cannot refund';
end $$;
select 'PASS: partial/full/replay/stale/spent/reserved/subscription/ownership/mode checks' as verdict;
