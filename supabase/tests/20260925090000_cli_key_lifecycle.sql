-- Actual lifecycle SQL rollback regression. Run only in an isolated proof database.
begin;
insert into public.adelphos_cli_devices(id,chat_user_id,tenant_id,owner_email,name,token_hash,token_prefix,token_suffix)
values('2d2a2920-8f0b-4e1c-8c9c-172e26a645e8','proof-owner','personal-proof','owner@invalid.test','LOCAL SQL FIXTURE',repeat('a',64),'jcli_abcdef','1234');
do $$ declare first_result jsonb; replay jsonb; prior timestamptz; n integer; begin
 first_result:=public.adelphos_admin_revoke_cli_key('635b7789-c5b5-4a13-90ce-4a93f2bf7e19','proof-owner','owner@invalid.test','2d2a2920-8f0b-4e1c-8c9c-172e26a645e8','Owner-requested revocation',false,'owner','personal-proof');
 replay:=public.adelphos_admin_revoke_cli_key('635b7789-c5b5-4a13-90ce-4a93f2bf7e19','proof-owner','owner@invalid.test','2d2a2920-8f0b-4e1c-8c9c-172e26a645e8','Owner-requested revocation',true,'owner','personal-proof');
 if replay->>'replayed'<>'true' or replay->>'revokedAt' is distinct from first_result->>'revokedAt' then raise exception 'Replay failed';end if;
 select count(*) into n from public.adelphos_admin_actions;if n<>1 then raise exception 'Audit duplicated';end if;
 begin
  perform public.adelphos_admin_revoke_cli_key('635b7789-c5b5-4a13-90ce-4a93f2bf7e19','proof-owner','owner@invalid.test','2d2a2920-8f0b-4e1c-8c9c-172e26a645e8','Conflicting reason',false,'owner','personal-proof');
  raise exception 'Conflict accepted';
 exception when unique_violation then null;end;
 begin
  perform public.adelphos_admin_revoke_cli_key('11111111-c5b5-4a13-90ce-4a93f2bf7e19','wrong-owner','wrong@invalid.test','2d2a2920-8f0b-4e1c-8c9c-172e26a645e8','Owner-requested revocation',false,'owner','personal-proof');
  raise exception 'Wrong owner accepted';
 exception when no_data_found then null;end;
 replay:=public.adelphos_admin_revoke_cli_key('22222222-c5b5-4a13-90ce-4a93f2bf7e19','staff','staff@adelphos.ai','2d2a2920-8f0b-4e1c-8c9c-172e26a645e8','Staff exact-key revocation');
 if replay->>'revokedAt' is distinct from first_result->>'revokedAt' then raise exception 'Revocation timestamp changed';end if;
 if public.adelphos_admin_revoke_cli_key('33333333-c5b5-4a13-90ce-4a93f2bf7e19','staff','staff@adelphos.ai','2d2a2920-8f0b-4e1c-8c9c-172e26a645e8','Unconfirmed readback',true) is not null then raise exception 'Unknown receipt invented';end if;
 begin
  update public.adelphos_cli_devices set token_suffix=null where id='2d2a2920-8f0b-4e1c-8c9c-172e26a645e8';raise exception 'Partial mask accepted';
 exception when check_violation then null;end;
 if exists(select 1 from public.adelphos_admin_actions where before_value::text like '%token_hash%' or after_value::text like '%token_hash%') then raise exception 'Verifier exposed';end if;
end $$;
insert into public.adelphos_cli_devices(id,chat_user_id,tenant_id,owner_email,name,token_hash)
values('aa2a2920-8f0b-4e1c-8c9c-172e26a645e8','proof-owner','personal-proof','owner@invalid.test','LEGACY SQL FIXTURE',repeat('b',64));
create function public.p06_refuse_test_audit() returns trigger language plpgsql as $$ begin
 if new.reason='Deliberate audit failure' then raise exception using errcode='23514',message='Synthetic audit failure';end if;return new;end $$;
create trigger p06_refuse_test_audit before insert on public.adelphos_admin_actions for each row execute function public.p06_refuse_test_audit();
do $$ begin
 begin
  perform public.adelphos_admin_revoke_cli_key('44444444-c5b5-4a13-90ce-4a93f2bf7e19','staff','staff@adelphos.ai','aa2a2920-8f0b-4e1c-8c9c-172e26a645e8','Deliberate audit failure');raise exception 'Audit failure accepted';
 exception when check_violation then null;end;
 if exists(select 1 from public.adelphos_cli_devices where id='aa2a2920-8f0b-4e1c-8c9c-172e26a645e8' and revoked_at is not null) then raise exception 'Unaudited mutation survived';end if;
end $$;
rollback;
select 'P06 atomic SQL lifecycle assertions passed; all fixtures rolled back' as result;
