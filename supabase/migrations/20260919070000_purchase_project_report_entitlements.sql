-- Manual reports: one published-price purchase per account/app/project scope.
-- Called only by authenticated application servers after ownership and output checks.
-- No agent/tool surcharge; existing provider settlement and receipts are untouched.
begin;

create table public.adelphos_report_entitlements (
 tenant_id text not null,
 user_id text not null,
 product_code text not null references public.adelphos_app_price_products(code),
 scope_id text not null,
 request_id text not null unique,
 email text not null,
 price_version bigint not null,
 usage_credits numeric not null check (usage_credits >= 0),
 artifact_sha256 text not null check (artifact_sha256 ~ '^[a-f0-9]{64}$'),
 purchased_at timestamptz not null default now(),
 primary key (tenant_id,user_id,product_code,scope_id)
);
alter table public.adelphos_report_entitlements enable row level security;
revoke all on public.adelphos_report_entitlements from public, anon, authenticated;
grant select on public.adelphos_report_entitlements to service_role;

create function public.adelphos_quote_report_export(
 p_email text, p_tenant_id text, p_user_id text, p_product_code text, p_scope_id text
) returns jsonb language plpgsql security definer set search_path=public as $$
declare
 v_ent public.adelphos_report_entitlements;
 v_catalogue public.adelphos_report_price_catalogue;
 v_price numeric;
begin
 if coalesce(p_scope_id,'')='' or length(p_scope_id)>256 or coalesce(p_user_id,'')='' or coalesce(p_tenant_id,'')='' then
  raise exception 'Report scope and verified identity are required';
 end if;
 if not exists(select 1 from public.adelphos_user_licenses where lower(email::text)=lower(trim(p_email))
  and auth_user_id::text=p_user_id and tenant_id=p_tenant_id and status in ('active','trialing','free')) then
  raise exception 'Report billing identity is unavailable';
 end if;
 if not exists(select 1 from public.adelphos_app_price_products where code=p_product_code and mode='report') then
  raise exception 'Manual report product is unavailable';
 end if;
 select * into v_catalogue from public.adelphos_report_price_catalogue where id;
 if v_catalogue.published is null or not (v_catalogue.published ? p_product_code) then
  raise exception 'Report price is not published';
 end if;
 select * into v_ent from public.adelphos_report_entitlements where tenant_id=p_tenant_id and user_id=p_user_id
  and product_code=p_product_code and scope_id=p_scope_id;
 v_price := (v_catalogue.published->p_product_code->>'usageCredits')::numeric;
 return jsonb_build_object('productCode',p_product_code,'scopeId',p_scope_id,
  'priceVersion',v_catalogue.published_revision,'usageCredits',case when v_ent.request_id is not null then 0 else v_price end,
  'alreadyPurchased',v_ent.request_id is not null,'coversFutureEdits',true,
  'receiptId',v_ent.request_id);
end $$;

create function public.adelphos_purchase_report_export(
 p_email text, p_tenant_id text, p_user_id text, p_product_code text, p_scope_id text,
 p_price_version bigint, p_request_id text, p_artifact_sha256 text
) returns jsonb language plpgsql security definer set search_path=public as $$
declare
 v_email text := lower(trim(p_email));
 v_quote jsonb;
 v_price numeric;
 v_project_id text;
 v_res jsonb;
 v_previous public.adelphos_report_entitlements;
 v_metadata jsonb;
begin
 if coalesce(p_request_id,'') !~ '^report:[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' or coalesce(p_artifact_sha256,'') !~ '^[a-f0-9]{64}$' then
  raise exception 'Report request and verified output digest are required';
 end if;
 -- Same lock order as the central wallet. Concurrent exports share one purchase.
 perform pg_advisory_xact_lock(hashtextextended(v_email,0));
 perform 1 from public.adelphos_report_price_catalogue where id for share;
 v_quote := public.adelphos_quote_report_export(v_email,p_tenant_id,p_user_id,p_product_code,p_scope_id);
 select * into v_previous from public.adelphos_report_entitlements where request_id=p_request_id;
 if v_previous.request_id is not null and (v_previous.tenant_id<>p_tenant_id or v_previous.user_id<>p_user_id
  or v_previous.product_code<>p_product_code or v_previous.scope_id<>p_scope_id) then
  raise exception 'Report request identity conflict';
 end if;
 if (v_quote->>'alreadyPurchased')::boolean then
  return v_quote || jsonb_build_object('allowed',true,'idempotent',true);
 end if;
 if (v_quote->>'priceVersion')::bigint is distinct from p_price_version then
  return v_quote || jsonb_build_object('allowed',false,'reason','report_price_changed');
 end if;
 -- An unrelated reservation must never be converted into a report purchase.
 -- Completed report retries have already returned their durable entitlement.
 if exists(select 1 from public.adelphos_credit_reservations where request_id=p_request_id) then
  raise exception 'Report request identity conflict';
 end if;
 v_price := (v_quote->>'usageCredits')::numeric;
 v_project_id := 'report-project:' || md5(p_tenant_id||':'||p_user_id||':'||p_scope_id);
 v_metadata := jsonb_build_object('source','manual_report_export','product_code',p_product_code,
  'report_scope_id',p_scope_id,'user_id',p_user_id,'tenant_id',p_tenant_id,
  'price_version',p_price_version,'artifact_sha256',p_artifact_sha256,'covers_future_edits',true);
 if v_price>0 then
  perform public.adelphos_create_billing_project(v_email,v_project_id,'Report exports');
  v_res := public.adelphos_reserve_credits(v_email,v_project_id,p_request_id,'tool','claude-opus-5',v_price,v_metadata);
  if not coalesce((v_res->>'allowed')::boolean,false) then return v_res; end if;
  if not exists(select 1 from public.adelphos_credit_reservations where request_id=p_request_id
   and lower(email::text)=v_email and project_id=v_project_id and status='reserved'
   and reserved_usage_credits=v_price and metadata->>'source'='manual_report_export') then
   raise exception 'Report reservation does not match the published purchase';
  end if;
  -- Reserve and consume the exact published amount in one transaction. No
  -- output is delivered until commit. Rollback restores every balance/lot.
  -- The allocator requires a configured model argument for legacy tool holds;
  -- this is a report receipt, not provider usage, so label its attribution.
  update public.adelphos_credit_reservations set status='settled',model='manual-report',actual_usage_credits=v_price,
   settled_at=now(),overrun_usage_credits=0,cap_overrun=false where request_id=p_request_id;
  update public.adelphos_billing_projects set reserved_usage_credits=reserved_usage_credits-v_price,
   spent_usage_credits=spent_usage_credits+v_price,updated_at=now() where project_id=v_project_id;
  update public.adelphos_usage_credit_accounts set lifetime_spent_usage_credits=lifetime_spent_usage_credits+v_price,
   updated_at=now() where lower(email::text)=v_email;
  insert into public.adelphos_credit_ledger(request_id,email,project_id,event_type,component,usage_credits,metadata)
   values(p_request_id,v_email,v_project_id,'settle','manual_report:'||p_product_code,v_price,v_metadata);
 end if;
 insert into public.adelphos_report_entitlements(tenant_id,user_id,product_code,scope_id,request_id,email,
  price_version,usage_credits,artifact_sha256)
 values(p_tenant_id,p_user_id,p_product_code,p_scope_id,p_request_id,v_email,p_price_version,v_price,p_artifact_sha256);
 return v_quote || jsonb_build_object('allowed',true,'receiptId',p_request_id,'idempotent',false);
end $$;
revoke all on function public.adelphos_quote_report_export(text,text,text,text,text) from public,anon,authenticated;
revoke all on function public.adelphos_purchase_report_export(text,text,text,text,text,bigint,text,text) from public,anon,authenticated;
grant execute on function public.adelphos_quote_report_export(text,text,text,text,text) to service_role;
grant execute on function public.adelphos_purchase_report_export(text,text,text,text,text,bigint,text,text) to service_role;
notify pgrst,'reload schema';
commit;
