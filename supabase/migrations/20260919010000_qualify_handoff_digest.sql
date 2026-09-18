-- Existing hosted definitions; qualify pgcrypto without changing identity, expiry or PKCE rules.
CREATE OR REPLACE FUNCTION public.adelphos_consume_billing_handoff(p_code text, p_state text, p_pkce_verifier text, p_return_origin text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_row public.adelphos_billing_handoffs;
begin
  update public.adelphos_billing_handoffs set consumed_at=now()
    where code_digest=encode(extensions.digest(p_code,'sha256'),'hex')
      and state_digest=encode(extensions.digest(p_state,'sha256'),'hex')
      and pkce_challenge=encode(extensions.digest(p_pkce_verifier,'sha256'),'hex')
      and return_origin=p_return_origin
      and consumed_at is null and expires_at>now()
    returning * into v_row;
  if v_row.code_digest is null then raise exception 'Handoff code is invalid or expired.'; end if;
  return jsonb_build_object('email',v_row.email,'user_id',v_row.auth_user_id,'tenant_id',v_row.tenant_id);
end $function$
;
CREATE OR REPLACE FUNCTION public.adelphos_issue_billing_handoff(p_code text, p_email text, p_auth_user_id text, p_tenant_id text, p_return_origin text, p_state text, p_pkce_challenge text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if length(p_code)<32 or length(p_state)<32 or length(p_pkce_challenge)<>64
    or trim(p_email)='' or trim(p_auth_user_id)='' or trim(p_tenant_id)=''
    or p_return_origin not in ('https://adelphos.ai','https://www.adelphos.ai','http://127.0.0.1:4177') then
    raise exception 'Complete handoff identity is required.';
  end if;
  perform public.adelphos_bind_billing_identity(p_email,p_auth_user_id,p_tenant_id);
  insert into public.adelphos_billing_handoffs(code_digest,email,auth_user_id,tenant_id,return_origin,state_digest,pkce_challenge,expires_at)
  values(encode(extensions.digest(p_code,'sha256'),'hex'),lower(trim(p_email)),p_auth_user_id,p_tenant_id,p_return_origin,
    encode(extensions.digest(p_state,'sha256'),'hex'),p_pkce_challenge,now()+interval '2 minutes');
  return true;
end $function$
;