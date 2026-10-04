-- FILE: 20260925090000_cli_key_display_and_revocation.sql
-- PURPOSE: Store non-recoverable display fragments and atomically audit exact-key revocation.
-- CALLS: Existing device registry and admin action ledger. CALLED BY: internal service bridge.
-- ERROR WIRE: SQL exceptions roll back the mutation and audit together.
begin;
alter table public.adelphos_cli_devices add column if not exists token_prefix text;
alter table public.adelphos_cli_devices add column if not exists token_suffix text;
alter table public.adelphos_cli_devices add constraint adelphos_cli_device_display_fragments_check check (
 (token_prefix is null and token_suffix is null) or
 (token_prefix is not null and token_suffix is not null and token_prefix ~ '^jcli_[0-9a-f]{6}$' and token_suffix ~ '^[0-9a-f]{4}$')
);
-- Existing accounting owner defines this table and the two preserved actions.
do $$ declare previous_check text; begin
 select pg_get_constraintdef(oid) into previous_check from pg_constraint
 where conrelid='public.adelphos_admin_actions'::regclass and conname='adelphos_admin_actions_action_check';
 if previous_check is null or left(previous_check,6)<>'CHECK ' then raise exception 'Existing admin action constraint unavailable'; end if;
 alter table public.adelphos_admin_actions drop constraint adelphos_admin_actions_action_check;
 execute 'alter table public.adelphos_admin_actions add constraint adelphos_admin_actions_action_check check (' || substr(previous_check,7) || ' OR action = ''revoke_cli_key'')';
end $$;
create or replace function public.adelphos_admin_revoke_cli_key(
 p_request_id uuid,p_actor_id text,p_actor_email text,p_key_id uuid,p_reason text,p_read_only boolean default false,p_mode text default 'staff',p_tenant text default null
) returns jsonb language plpgsql security definer set search_path=public as $$
declare previous public.adelphos_admin_actions; device public.adelphos_cli_devices;
 result jsonb; actor text:=lower(trim(p_actor_email)); stamp timestamptz;
begin
 if p_request_id is null or p_key_id is null or length(trim(coalesce(p_actor_id,'')))=0 or
 actor !~ '^[^@[:space:]]+@[^@[:space:]]+$' or p_mode not in ('owner','staff') or
 (p_mode='staff' and actor !~ '^[^@[:space:]]+@adelphos[.]ai$') or
 (p_mode='owner' and length(trim(coalesce(p_tenant,'')))=0) or length(trim(coalesce(p_reason,''))) not between 5 and 500 then
  raise exception using errcode='22023',message='Invalid key action';
 end if;
 perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,0));
 select * into previous from public.adelphos_admin_actions where request_id=p_request_id;
 if found then
  if previous.action<>'revoke_cli_key' or previous.actor_email<>actor or previous.reason<>p_reason or
   previous.after_value->>'mode' is distinct from p_mode or previous.after_value->>'tenantId' is distinct from p_tenant or
   previous.after_value->>'actorId' is distinct from p_actor_id or previous.after_value->>'id' is distinct from p_key_id::text then
   raise exception using errcode='23505',message='Action ID conflict';
  end if;
  return previous.after_value || jsonb_build_object('replayed',true);
 end if;
 if p_read_only then return null; end if;
 select * into device from public.adelphos_cli_devices where id=p_key_id for update;
 if not found then raise exception using errcode='P0002',message='Key not found'; end if;
 if p_mode='owner' and (device.chat_user_id<>p_actor_id or device.tenant_id<>p_tenant) then raise exception using errcode='P0002',message='Key not found'; end if;
 stamp:=coalesce(device.revoked_at,clock_timestamp());
 update public.adelphos_cli_devices set revoked_at=stamp where id=p_key_id;
 result:=jsonb_build_object('id',device.id,'revokedAt',stamp,'requestId',p_request_id,'actorId',p_actor_id,'mode',p_mode,'tenantId',p_tenant,'replayed',false);
 insert into public.adelphos_admin_actions(request_id,actor_email,email,action,reason,before_value,after_value)
 values(p_request_id,actor,device.owner_email,'revoke_cli_key',p_reason,
 jsonb_build_object('id',device.id,'userId',device.chat_user_id,'tenantId',device.tenant_id,'revokedAt',device.revoked_at),result);
 return result;
end $$;
revoke all on function public.adelphos_admin_revoke_cli_key(uuid,text,text,uuid,text,boolean,text,text) from public,anon,authenticated;
grant execute on function public.adelphos_admin_revoke_cli_key(uuid,text,text,uuid,text,boolean,text,text) to service_role;
commit;
