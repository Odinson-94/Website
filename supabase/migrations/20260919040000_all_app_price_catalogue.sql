-- Session 01a0b8b9: cover every registered app. New report drafts start at the user-approved 20 UC.
-- Does not publish prices or change existing wallets, provider usage, subscriptions or receipts.
begin;
create table public.adelphos_app_price_products (
 code text primary key, app_key text unique not null, name text not null, unit text not null,
 mode text not null check(mode in ('report','usage','included','internal'))
);
alter table public.adelphos_app_price_products enable row level security;
revoke all on public.adelphos_app_price_products from public,anon,authenticated,service_role;
grant select on public.adelphos_app_price_products to service_role;
insert into public.adelphos_app_price_products(code,app_key,name,unit,mode)
select p->>'code',p->>'appKey',p->>'name',p->>'unit',p->>'mode' from jsonb_array_elements('[{"code": "usersales", "appKey": "usersales", "name": "User & Sales", "unit": "project", "mode": "internal"}, {"code": "familybuilder", "appKey": "familybuilder", "name": "Family Builder", "unit": "project", "mode": "report"}, {"code": "adelphos", "appKey": "adelphos", "name": "Adelphos", "unit": "project", "mode": "usage"}, {"code": "specs", "appKey": "specs", "name": "Specs", "unit": "project", "mode": "report"}, {"code": "schedules", "appKey": "schedules", "name": "Schedules", "unit": "project", "mode": "report"}, {"code": "reports", "appKey": "reports", "name": "Reports", "unit": "project", "mode": "report"}, {"code": "schematics", "appKey": "schematics", "name": "Schematics", "unit": "project", "mode": "report"}, {"code": "documents", "appKey": "documents", "name": "Document Control", "unit": "project", "mode": "report"}, {"code": "errors", "appKey": "errors", "name": "Errors", "unit": "project", "mode": "internal"}, {"code": "programme", "appKey": "programme", "name": "Programmes", "unit": "project", "mode": "report"}, {"code": "roomplanner", "appKey": "roomplanner", "name": "Building Generator", "unit": "project", "mode": "report"}, {"code": "sap", "appKey": "sap", "name": "EPC (Domestic)", "unit": "project (all houses)", "mode": "report"}, {"code": "cable", "appKey": "cablecalcs", "name": "Cable Calculations", "unit": "calculation", "mode": "report"}, {"code": "mepsizing", "appKey": "mepsizing", "name": "Duct and Pipe Sizing", "unit": "project", "mode": "report"}, {"code": "browser", "appKey": "browser", "name": "Browser", "unit": "project", "mode": "included"}, {"code": "marketplace", "appKey": "marketplace", "name": "Marketplace", "unit": "project", "mode": "included"}, {"code": "calculators", "appKey": "calculators", "name": "Calculators", "unit": "project", "mode": "report"}, {"code": "finance", "appKey": "finance", "name": "Financial Health", "unit": "project", "mode": "report"}, {"code": "quotationqueue", "appKey": "quotationqueue", "name": "Quotation Queue", "unit": "project", "mode": "internal"}, {"code": "marketing", "appKey": "marketing", "name": "Marketing", "unit": "project", "mode": "internal"}, {"code": "seo", "appKey": "seo", "name": "SEO Visibility", "unit": "project", "mode": "internal"}, {"code": "emails", "appKey": "emails", "name": "Emails", "unit": "project", "mode": "included"}, {"code": "projectmanager", "appKey": "projectmanager", "name": "Project Board", "unit": "project", "mode": "report"}, {"code": "pdfmarkup", "appKey": "pdfmarkup", "name": "PDF Markup", "unit": "project", "mode": "report"}, {"code": "estimating", "appKey": "estimating", "name": "Estimating and Take Offs", "unit": "project", "mode": "report"}, {"code": "procurement", "appKey": "procurement", "name": "Procurement", "unit": "project", "mode": "report"}, {"code": "lighting", "appKey": "lighting", "name": "Lighting Calculations", "unit": "project", "mode": "report"}, {"code": "sbem", "appKey": "sbem", "name": "EPC (Non-domestic)", "unit": "project", "mode": "report"}, {"code": "thermal", "appKey": "thermal", "name": "Thermal Modelling", "unit": "project", "mode": "report"}, {"code": "qamanager", "appKey": "qamanager", "name": "QA Manager", "unit": "project", "mode": "report"}, {"code": "cobie", "appKey": "cobie", "name": "CoBie Manager", "unit": "project", "mode": "report"}, {"code": "voicestudio", "appKey": "voicestudio", "name": "Voice Studio", "unit": "project", "mode": "usage"}, {"code": "agentstudio", "appKey": "agentstudio", "name": "Agent Studio", "unit": "project", "mode": "usage"}, {"code": "development", "appKey": "development", "name": "Development", "unit": "project", "mode": "internal"}]'::jsonb) p;
alter table public.adelphos_report_price_catalogue drop constraint valid_report_draft;
-- Published snapshots are immutable and may predate newly registered apps.
alter table public.adelphos_report_price_catalogue drop constraint valid_report_publication;
create or replace function public.adelphos_validate_report_prices(p_prices jsonb)
returns boolean language plpgsql stable set search_path=public as $$
declare product_code text; item jsonb; tier jsonb; amount numeric; last_amount numeric; last_quantity integer; quantity integer;
begin
 if jsonb_typeof(p_prices) is distinct from 'object' or
    (select array_agg(key order by key) from jsonb_object_keys(p_prices) key) is distinct from (select array_agg(code order by code) from public.adelphos_app_price_products) then return false; end if;
 for product_code in select p.code from public.adelphos_app_price_products p loop
  item := p_prices->product_code;
  if jsonb_typeof(item) is distinct from 'object' or
     (select array_agg(key order by key) from jsonb_object_keys(item) key) is distinct from array['batches','usageCredits'] or
     jsonb_typeof(item->'batches') is distinct from 'array' then return false; end if;
  if (select p.mode from public.adelphos_app_price_products p where p.code=product_code) <> 'report' then
   if item->'usageCredits' <> 'null'::jsonb or item->'batches' <> '[]'::jsonb then return false; end if;
   continue;
  end if;
  if jsonb_typeof(item->'usageCredits') is distinct from 'number' then return false; end if;
  amount := (item->>'usageCredits')::numeric;
  if amount<0 or amount>100000 or round(amount,2)<>amount or jsonb_array_length(item->'batches')>12 then return false; end if;
  last_quantity := 1; last_amount := amount;
  for tier in select value from jsonb_array_elements(item->'batches') loop
   if jsonb_typeof(tier) is distinct from 'object' or
      (select array_agg(key order by key) from jsonb_object_keys(tier) key) is distinct from array['quantity','usageCredits'] or
      jsonb_typeof(tier->'quantity') is distinct from 'number' or jsonb_typeof(tier->'usageCredits') is distinct from 'number' then return false; end if;
   if (tier->>'quantity')::numeric<>trunc((tier->>'quantity')::numeric) then return false; end if;
   quantity := (tier->>'quantity')::integer; amount := (tier->>'usageCredits')::numeric;
   if quantity<=last_quantity or quantity>10000 or amount<0 or amount>=last_amount or round(amount,2)<>amount then return false; end if;
   last_quantity := quantity; last_amount := amount;
  end loop;
 end loop;
 return true;
exception when others then return false;
end $$;

-- Use the existing audited save operation for the draft expansion, preserving all existing prices.
select public.adelphos_change_report_prices(
 '019a0190-0000-4000-8000-000000000004','system@adelphos.ai','save',
 'Expand draft to all 34 registered apps; new report prices start at user-approved 20 UC.',c.revision,
 (select jsonb_object_agg(p.code,coalesce(c.draft->p.code,jsonb_build_object('usageCredits',case when p.mode='report' then 20 else null end,'batches','[]'::jsonb))) from public.adelphos_app_price_products p)
) from public.adelphos_report_price_catalogue c where id;
alter table public.adelphos_report_price_catalogue add constraint valid_report_draft check(public.adelphos_validate_report_prices(draft));
create or replace function public.adelphos_published_report_prices()
returns jsonb language sql stable security definer set search_path=public as $$
 select case when c.published is null then null else jsonb_build_object(
  'version',c.published_revision,'publishedAt',c.published_at,'identicalDownloadsFree',true,
  'products',(select jsonb_object_agg(p.code,(c.published->p.code)||jsonb_build_object('name',p.name,'appKey',p.app_key,'unit',p.unit,'mode',p.mode))
    from public.adelphos_app_price_products p where p.mode<>'internal' and c.published ? p.code)
 ) end from public.adelphos_report_price_catalogue c where c.id;
$$;
notify pgrst,'reload schema';
commit;
