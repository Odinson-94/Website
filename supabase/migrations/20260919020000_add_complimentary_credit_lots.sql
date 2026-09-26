-- Complimentary credits must participate in the canonical lot allocator.
-- No Stripe payment is invented; existing purchased lots retain their constraints.
begin;
alter table public.adelphos_usage_credit_lots drop constraint adelphos_usage_credit_lots_source_kind_check;
alter table public.adelphos_usage_credit_lots alter column stripe_checkout_session_id drop not null;
alter table public.adelphos_usage_credit_lots add constraint adelphos_usage_credit_lots_source_kind_check
 check (source_kind in ('top_up','complimentary'));
alter table public.adelphos_usage_credit_lots add constraint adelphos_usage_credit_lots_source_identity_check
 check ((source_kind='top_up' and stripe_checkout_session_id is not null)
     or (source_kind='complimentary' and stripe_checkout_session_id is null and stripe_payment_intent_id is null));

create or replace function public.adelphos_admin_grant_credits(p_request_id uuid,p_actor text,p_email text,p_amount numeric,p_reason text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_email text:=lower(trim(p_email)); previous public.adelphos_admin_actions; before_wallet jsonb;
begin
 if p_amount is null or p_amount<=0 or p_amount>10000 or round(p_amount,2)<>p_amount or length(trim(p_reason)) not between 5 and 500 or split_part(lower(p_actor),'@',2)<>'adelphos.ai' then raise exception 'Invalid credit action'; end if;
 perform pg_advisory_xact_lock(hashtextextended(v_email,0));
 select * into previous from public.adelphos_admin_actions where request_id=p_request_id;
 if found then
  if previous.email<>v_email or previous.actor_email<>p_actor or previous.action<>'grant_credits' or (previous.after_value->>'amount')::numeric<>p_amount or previous.reason<>p_reason then raise exception 'Action ID conflict'; end if;
  return jsonb_build_object('idempotent',true,'amount',p_amount);
 end if;
 if not exists(select 1 from public.adelphos_user_licenses where email=v_email::citext) then raise exception 'Account has no central licence'; end if;
 select to_jsonb(a) into before_wallet from public.adelphos_usage_credit_accounts a where email=v_email::citext;
 insert into public.adelphos_usage_credit_grants(grant_id,email,grant_kind,usage_credits,metadata)
 values('admin:'||p_request_id,v_email,'adjustment',p_amount,jsonb_build_object('actor',p_actor,'reason',p_reason));
 -- The spending/refund allocator consumes persistent lots for every extra credit.
 -- Complimentary lots have no Stripe identifiers and never count as sales.
 insert into public.adelphos_usage_credit_lots(id,email,granted_usage_credits,remaining_usage_credits,source_kind,metadata)
 values(p_request_id,v_email,p_amount,p_amount,'complimentary',jsonb_build_object('admin_request_id',p_request_id,'actor',p_actor,'reason',p_reason));
 insert into public.adelphos_usage_credit_accounts(email,available_usage_credits,top_up_available_usage_credits,lifetime_granted_usage_credits)
 values(v_email,p_amount,p_amount,p_amount)
 on conflict(email) do update set available_usage_credits=public.adelphos_usage_credit_accounts.available_usage_credits+excluded.available_usage_credits,
 top_up_available_usage_credits=public.adelphos_usage_credit_accounts.top_up_available_usage_credits+excluded.top_up_available_usage_credits,
 lifetime_granted_usage_credits=public.adelphos_usage_credit_accounts.lifetime_granted_usage_credits+excluded.lifetime_granted_usage_credits,updated_at=now();
 insert into public.adelphos_credit_ledger(request_id,email,project_id,event_type,component,usage_credits,metadata)
 values('admin:'||p_request_id,v_email,'account','adjustment','admin_credit_grant',p_amount,jsonb_build_object('actor',p_actor,'reason',p_reason));
 insert into public.adelphos_admin_actions values(p_request_id,p_actor,v_email,'grant_credits',p_reason,coalesce(before_wallet,'{}'),jsonb_build_object('amount',p_amount),now());
 return jsonb_build_object('idempotent',false,'amount',p_amount,'message','Credits granted. No payment was charged.');
end $$;


-- Repair only audited grants that have no lot, without changing wallet totals.
-- Refuse ambiguous historical balances instead of fabricating spendable credit.
do $$
declare account_email citext; missing numeric; wallet_extra numeric; allocated numeric;
begin
 for account_email in select distinct g.email from public.adelphos_usage_credit_grants g
  join public.adelphos_admin_actions a on g.grant_id='admin:'||a.request_id
  where a.action='grant_credits' and not exists(select 1 from public.adelphos_usage_credit_lots l where l.id=a.request_id)
 loop
  perform pg_advisory_xact_lock(hashtextextended(lower(account_email::text),0));
  select sum(g.usage_credits) into missing from public.adelphos_usage_credit_grants g
   join public.adelphos_admin_actions a on g.grant_id='admin:'||a.request_id
   where g.email=account_email and a.action='grant_credits'
   and not exists(select 1 from public.adelphos_usage_credit_lots l where l.id=a.request_id);
  select top_up_available_usage_credits into wallet_extra from public.adelphos_usage_credit_accounts where email=account_email for update;
  select coalesce(sum(remaining_usage_credits),0) into allocated from public.adelphos_usage_credit_lots
   where email=account_email and (expires_at is null or expires_at>now());
  if wallet_extra is null or wallet_extra-allocated<>missing then raise exception 'Complimentary credit backfill requires balance reconciliation'; end if;
  insert into public.adelphos_usage_credit_lots(id,email,granted_usage_credits,remaining_usage_credits,source_kind,granted_at,metadata)
   select a.request_id,g.email,g.usage_credits,g.usage_credits,'complimentary',g.granted_at,
    g.metadata||jsonb_build_object('admin_request_id',a.request_id,'backfilled',true)
   from public.adelphos_usage_credit_grants g join public.adelphos_admin_actions a on g.grant_id='admin:'||a.request_id
   where g.email=account_email and a.action='grant_credits' and not exists(select 1 from public.adelphos_usage_credit_lots l where l.id=a.request_id);
 end loop;
end $$;
revoke all on function public.adelphos_admin_grant_credits(uuid,text,text,numeric,text) from public,anon,authenticated;
grant execute on function public.adelphos_admin_grant_credits(uuid,text,text,numeric,text) to service_role;
commit;
