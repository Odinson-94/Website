-- Run inside a transaction in the isolated event_acceptance schema, with the
-- billing tables and three existing entitlement functions copied into it.
-- Apply the candidate migration there and ROLLBACK after these assertions.
set local search_path=event_acceptance,public;
insert into adelphos_billing_plans select * from public.adelphos_billing_plans where code in ('free','everyday','standard');
insert into adelphos_user_licenses(email,plan_code,status,stripe_customer_id,stripe_subscription_id)
 values('event-fixture@example.invalid','everyday','active','cus_owner','sub_current');
insert into adelphos_usage_credit_accounts(email,available_usage_credits,included_available_usage_credits,top_up_available_usage_credits,included_period_id,lifetime_granted_usage_credits)
 values('event-fixture@example.invalid',13,8,5,'in_previous',15);

do $$ declare r jsonb; begin
 -- Reproduce the old defect in a nested transaction, then undo it.
 begin
  perform adelphos_revert_to_free_entitlement('event-fixture@example.invalid','{"stripe_subscription_id":"sub_old"}');
  assert (select status='free' and stripe_subscription_id='sub_current' from adelphos_user_licenses), 'baseline bug reproduced';
  raise exception using errcode='ZX001',message='undo baseline mutation';
 exception when sqlstate 'ZX001' then null; end;
 assert (select status='active' from adelphos_user_licenses), 'baseline mutation rolled back';

 begin
  perform adelphos_apply_subscription_event('event-fixture@example.invalid','sub_old',0,'sub_old','cus_owner','everyday','canceled','2026-09-01','2026-10-01',false);
  raise exception 'Expected old identity refusal';
 exception when others then assert sqlerrm='Subscription state changed; retry with a fresh Stripe snapshot.', 'replaced identity refused'; end;
 begin
  perform adelphos_apply_subscription_event('event-fixture@example.invalid','sub_current',0,'sub_other','cus_owner','everyday','active','2026-09-01','2026-10-01',false);
  raise exception 'Expected binding refusal';
 exception when others then assert sqlerrm='Subscription does not own the current entitlement.', 'event cannot rebind'; end;
 begin
  perform adelphos_apply_subscription_event('event-fixture@example.invalid','sub_current',0,'sub_current','cus_other','everyday','active','2026-09-01','2026-10-01',false);
  raise exception 'Expected customer refusal';
 exception when others then assert sqlerrm='Subscription customer does not own this licence.', 'other customer refused'; end;
 assert (select available_usage_credits=13 from adelphos_usage_credit_accounts), 'denials preserved wallet';

 r:=adelphos_apply_subscription_event('event-fixture@example.invalid','sub_current',0,'sub_current','cus_owner','everyday','active','2026-09-01','2026-10-01',false,false,'in_current');
 assert (r->>'state_version')::integer=1, 'version increments';
 assert (select available_usage_credits=20 and included_available_usage_credits=15 and top_up_available_usage_credits=5 from adelphos_usage_credit_accounts), 'one initial allowance';
 -- Simulate consumption between duplicate deliveries; the duplicate must not refill it.
 update adelphos_usage_credit_accounts set available_usage_credits=17,included_available_usage_credits=12,lifetime_spent_usage_credits=3;
 perform adelphos_apply_subscription_event('event-fixture@example.invalid','sub_current',1,'sub_current','cus_owner','everyday','active','2026-09-01','2026-10-01',false,false,'in_current');
 assert (select available_usage_credits=17 from adelphos_usage_credit_accounts), 'duplicate cannot restore consumed credits';
 assert (select count(*)=1 from adelphos_usage_credit_grants), 'one invoice grant';
 perform adelphos_apply_subscription_event('event-fixture@example.invalid','sub_current',2,'sub_current','cus_owner','everyday','active','2026-09-01','2026-10-01',true);
 assert (select cancel_at_period_end from adelphos_user_licenses), 'scheduled cancellation';
 perform adelphos_apply_subscription_event('event-fixture@example.invalid','sub_current',3,'sub_current','cus_owner','everyday','active','2026-09-01','2026-10-01',false);
 assert (select not cancel_at_period_end from adelphos_user_licenses), 'reactivated';
 assert (select available_usage_credits=17 from adelphos_usage_credit_accounts), 'reactivation does not grant again';
 begin
  perform adelphos_apply_subscription_event('event-fixture@example.invalid','sub_current',2,'sub_current','cus_owner','everyday','past_due','2026-09-01','2026-10-01',false);
  raise exception 'Expected stale snapshot refusal';
 exception when others then assert sqlerrm='Subscription state changed; retry with a fresh Stripe snapshot.', 'concurrent stale version refused'; end;
 assert (select status='active' and stripe_state_version=4 from adelphos_user_licenses), 'stale failure cannot reverse state';

 perform adelphos_apply_subscription_event('event-fixture@example.invalid','sub_current',4,'sub_new','cus_owner','standard','active','2026-09-02','2026-10-02',false,true);
 begin
  perform adelphos_apply_subscription_event('event-fixture@example.invalid','sub_current',4,'sub_current','cus_owner','everyday','canceled','2026-09-01','2026-10-01',false);
  raise exception 'Expected replaced cancellation refusal';
 exception when others then assert sqlerrm='Subscription state changed; retry with a fresh Stripe snapshot.', 'old cancel cannot revoke replacement'; end;
 assert (select status='active' and plan_code='standard' and stripe_subscription_id='sub_new' from adelphos_user_licenses), 'replacement preserved';
 assert (select available_usage_credits=17 from adelphos_usage_credit_accounts), 'replacement wallet preserved';
 -- A failed grant rolls back its preceding licence update and version together.
 update adelphos_billing_plans set monthly_usage_credit_grant=0 where code='everyday';
 begin
  perform adelphos_apply_subscription_event('event-fixture@example.invalid','sub_new',5,'sub_new','cus_owner','everyday','active','2026-09-02','2026-10-02',false,false,'in_bad');
  raise exception 'Expected grant failure';
 exception when others then assert sqlerrm='Subscription credit grant is unavailable.', 'grant failed'; end;
 assert (select plan_code='standard' and stripe_state_version=5 from adelphos_user_licenses), 'licence and grant atomic';
 assert not exists(select 1 from adelphos_usage_credit_grants where grant_id='period:in_bad'), 'no partial grant';
 perform adelphos_apply_subscription_event('event-fixture@example.invalid','sub_new',5,'sub_new','cus_owner','standard','canceled','2026-09-02','2026-10-02',false);
 assert (select status='free' and plan_code='free' and stripe_state_version=6 from adelphos_user_licenses), 'current cancellation still works';
 assert (select available_usage_credits=5 and included_available_usage_credits=0 and top_up_available_usage_credits=5 from adelphos_usage_credit_accounts), 'cancellation preserves purchased credits';
 assert not has_function_privilege('anon','event_acceptance.adelphos_apply_subscription_event(text,text,bigint,text,text,text,text,timestamptz,timestamptz,boolean,boolean,text)','EXECUTE'), 'anon denied';
 assert not has_function_privilege('authenticated','event_acceptance.adelphos_apply_subscription_event(text,text,bigint,text,text,text,text,timestamptz,timestamptz,boolean,boolean,text)','EXECUTE'), 'browser denied';
end $$;
select 'PASS: old cancellation, stale snapshot, binding/customer checks, duplicate grant, reactivation, atomic failure, current cancellation, access boundaries' as verdict;
