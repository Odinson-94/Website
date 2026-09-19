-- Session 01a0b8b9: one reviewed publication drives the public catalogue, token
-- metering and the next credit-pack Checkout. Existing receipts keep their rates.
begin;
create table public.adelphos_token_price_products (
 code text primary key, model text not null, factor_code text not null,
 component text not null, context_class text not null,
 unique(model,factor_code,component,context_class)
);
insert into public.adelphos_token_price_products
select distinct md5(model||':'||factor_code||':'||component||':'||context_class),model,factor_code,component,context_class
from public.adelphos_provider_rate_card where active and effective_from<=now() and (effective_until is null or effective_until>now());
alter table public.adelphos_token_price_products enable row level security;
revoke all on public.adelphos_token_price_products from public,anon,authenticated,service_role;
grant select on public.adelphos_token_price_products to service_role;

create function public.adelphos_current_token_prices() returns jsonb language sql stable security definer set search_path=public as $$
 select jsonb_object_agg(p.code,r.usd_per_million_units) from public.adelphos_token_price_products p
 cross join lateral (select usd_per_million_units from public.adelphos_provider_rate_card r
 where r.model=p.model and r.factor_code=p.factor_code and r.component=p.component and r.context_class=p.context_class
 and r.active and r.effective_from<=now() and (r.effective_until is null or r.effective_until>now()) order by effective_from desc limit 1) r;
$$;
alter table public.adelphos_report_price_catalogue
 add column economics_draft jsonb,
 add column economics_published jsonb,
 add column token_price_baseline jsonb,
 add column published_credit_plan text not null default 'payg-20' references public.adelphos_billing_plans(code);
update public.adelphos_report_price_catalogue set
 economics_draft=jsonb_build_object('retail',jsonb_build_object('currency',upper(p.currency),'packCredits',p.top_up_usage_credits,'packPriceMinor',p.price_cents),'tokenRates',public.adelphos_current_token_prices()),
 token_price_baseline=public.adelphos_current_token_prices()
from public.adelphos_billing_plans p where p.code='payg-20';
alter table public.adelphos_report_price_catalogue alter column economics_draft set not null;

create function public.adelphos_validate_commercial_prices(e jsonb) returns boolean language plpgsql stable set search_path=public as $$
declare r jsonb; v jsonb;
begin
 if jsonb_typeof(e)<>'object' or (select array_agg(key order by key) from jsonb_object_keys(e) key) is distinct from array['retail','tokenRates'] then return false; end if;
 r:=e->'retail';
 if (select array_agg(key order by key) from jsonb_object_keys(r) key) is distinct from array['currency','packCredits','packPriceMinor']
 or r->>'currency'<>'GBP' or jsonb_typeof(r->'packCredits')<>'number' or (r->>'packCredits')::numeric<>15
 or jsonb_typeof(r->'packPriceMinor')<>'number' or (r->>'packPriceMinor')::numeric<>trunc((r->>'packPriceMinor')::numeric)
 or (r->>'packPriceMinor')::numeric not between 50 and 10000000 then return false; end if;
 if jsonb_typeof(e->'tokenRates')<>'object' or (select array_agg(key order by key) from jsonb_object_keys(e->'tokenRates') key)
 is distinct from (select array_agg(code order by code) from public.adelphos_token_price_products) then return false; end if;
 for v in select value from jsonb_each(e->'tokenRates') loop
  if jsonb_typeof(v)<>'number' or v::text::numeric<=0 or v::text::numeric>1000000 or round(v::text::numeric,9)<>v::text::numeric then return false; end if;
 end loop;
 return true;
exception when others then return false;
end $$;
alter table public.adelphos_report_price_catalogue add constraint valid_commercial_draft check(public.adelphos_validate_commercial_prices(economics_draft));

-- Stripe preparation is server-only. Its verified Price is passed only by the
-- service-role publisher after checking amount, currency, product and mode.
create function public.adelphos_change_commercial_prices(p_request_id uuid,p_actor text,p_action text,p_reason text,p_revision integer,p_prices jsonb default null,p_economics jsonb default null,p_stripe_price jsonb default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare c public.adelphos_report_price_catalogue; prior public.adelphos_report_price_actions; command jsonb; result jsonb;
 plan public.adelphos_billing_plans; product record; old_rate public.adelphos_provider_rate_card; cutover timestamptz; amount numeric; new_code text;
begin
 if p_request_id is null or p_actor is null or p_actor !~ '^[^@[:space:]]+@adelphos[.]ai$' or p_reason is null or length(trim(p_reason)) not between 5 and 500
 or p_revision is null or p_revision<0 or p_action is null or p_action not in ('save','publish') then raise exception 'Invalid pricing action'; end if;
 command:=jsonb_build_object('actor',p_actor,'action',p_action,'reason',trim(p_reason),'revision',p_revision,'prices',p_prices,'economics',p_economics);
 select * into c from public.adelphos_report_price_catalogue where id for update;
 select * into prior from public.adelphos_report_price_actions where request_id=p_request_id;
 if found then
  if prior.input<>command then raise exception 'Pricing action ID conflict'; end if;
  return prior.result;
 end if;
 if c.revision<>p_revision then raise exception 'Pricing revision conflict. Reload before editing or publishing.'; end if;
 if p_action='save' then
  if public.adelphos_validate_report_prices(p_prices) is distinct from true or public.adelphos_validate_commercial_prices(p_economics) is distinct from true then raise exception 'Invalid commercial prices'; end if;
  update public.adelphos_report_price_catalogue set draft=p_prices,economics_draft=p_economics,revision=revision+1,updated_at=now() where id returning * into c;
 else
  if p_prices is not null or p_economics is not null then raise exception 'Publish accepts only the saved draft revision'; end if;
  if c.published is not distinct from c.draft and c.economics_published is not distinct from c.economics_draft then raise exception 'These prices are already published'; end if;
  -- Refuse to overwrite an independently changed billing rate card.
  if public.adelphos_current_token_prices() is distinct from c.token_price_baseline then raise exception 'Pricing rate card conflict. Reconcile current billing rates before publication.'; end if;
  select * into plan from public.adelphos_billing_plans where code=c.published_credit_plan;
  if plan.price_cents<>(c.economics_draft#>>'{retail,packPriceMinor}')::integer then
   if p_stripe_price is null or p_stripe_price->>'id' !~ '^price_[A-Za-z0-9]+$'
    or p_stripe_price->>'currency'<>'gbp' or (p_stripe_price->>'unit_amount')::integer<>(c.economics_draft#>>'{retail,packPriceMinor}')::integer
    or (p_stripe_price->>'livemode')::boolean is distinct from (plan.metadata->>'stripe_mode'='live') then raise exception 'Invalid prepared credit price'; end if;
   new_code:='payg-price-'||c.revision;
   plan.code:=new_code; plan.name:='15 Usage Credits'; plan.price_cents:=(c.economics_draft#>>'{retail,packPriceMinor}')::integer;
   plan.stripe_price_id:=p_stripe_price->>'id'; plan.stripe_lookup_key:=p_stripe_price->>'lookup_key'; plan.updated_at:=now();
   plan.metadata:=plan.metadata||jsonb_build_object('pricing_revision',c.revision,'pricing_managed',true);
   insert into public.adelphos_billing_plans select plan.*;
   update public.adelphos_report_price_catalogue set published_credit_plan=new_code where id;
  end if;
  cutover:=clock_timestamp();
  for product in select * from public.adelphos_token_price_products loop
   amount:=(c.economics_draft->'tokenRates'->>product.code)::numeric;
   select * into old_rate from public.adelphos_provider_rate_card r where r.model=product.model and r.factor_code=product.factor_code and r.component=product.component and r.context_class=product.context_class
    and active and effective_from<=cutover and (effective_until is null or effective_until>cutover) order by effective_from desc limit 1;
   if old_rate.rate_code is null then raise exception 'Pricing rate card conflict: missing component'; end if;
   if old_rate.usd_per_million_units<>amount then
    update public.adelphos_provider_rate_card set effective_until=cutover where model=product.model and factor_code=product.factor_code and component=product.component and context_class=product.context_class and active and effective_from<=cutover and (effective_until is null or effective_until>cutover);
    old_rate.rate_code:='sales-'||c.revision||'-'||product.code; old_rate.usd_per_million_units:=amount;
    old_rate.effective_from:=cutover; old_rate.effective_until:=null;
    insert into public.adelphos_provider_rate_card select old_rate.*;
   end if;
  end loop;
  update public.adelphos_report_price_catalogue set published=draft,economics_published=economics_draft,token_price_baseline=economics_draft->'tokenRates',published_revision=revision,published_at=cutover,updated_at=cutover,revision=revision+1 where id returning * into c;
 end if;
 result:=to_jsonb(c)-'id'-'token_price_baseline';
 insert into public.adelphos_report_price_actions(request_id,actor,action,reason,input,result) values(p_request_id,p_actor,p_action,trim(p_reason),command,result);
 return result;
end $$;
-- Old clients cannot accidentally publish an incomplete pricing policy.
create or replace function public.adelphos_change_report_prices(p_request_id uuid,p_actor text,p_action text,p_reason text,p_revision integer,p_prices jsonb default null)
returns jsonb language plpgsql security definer set search_path=public as $$
begin raise exception 'Pricing client update required. Reload the Sales dashboard.'; end $$;
create or replace function public.adelphos_published_report_prices() returns jsonb language sql stable security definer set search_path=public as $$
 select case when c.published is null then null else jsonb_build_object(
 'version',c.published_revision,'publishedAt',c.published_at,'identicalDownloadsFree',true,
 'products',(select jsonb_object_agg(p.code,(c.published->p.code)||jsonb_build_object('name',p.name,'appKey',p.app_key,'unit',p.unit,'mode',p.mode)) from public.adelphos_app_price_products p where p.mode<>'internal' and c.published ? p.code),
 'retail',c.economics_published->'retail',
 'tokenRates',(select jsonb_agg(jsonb_build_object('code',p.code,'model',p.model,'tier',p.factor_code,'component',p.component,'context',p.context_class,'usageCreditsPerMillion',(c.economics_published->'tokenRates'->p.code))) from public.adelphos_token_price_products p)
 ) end from public.adelphos_report_price_catalogue c where c.id;
$$;
revoke all on function public.adelphos_current_token_prices(),public.adelphos_validate_commercial_prices(jsonb),public.adelphos_change_commercial_prices(uuid,text,text,text,integer,jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.adelphos_current_token_prices(),public.adelphos_validate_commercial_prices(jsonb),public.adelphos_change_commercial_prices(uuid,text,text,text,integer,jsonb,jsonb,jsonb) to service_role;
notify pgrst,'reload schema';
commit;
