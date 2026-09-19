-- Session 01a0b8b9: private drafts and atomic, audited publication of report prices.
-- Additive only. This does not publish a price, debit a wallet or alter Stripe.
begin;
create table public.adelphos_report_price_catalogue (
 id boolean primary key default true check (id),
 revision integer not null default 0,
 draft jsonb not null,
 published jsonb,
 published_revision integer,
 published_at timestamptz,
 updated_at timestamptz not null default now()
);
insert into public.adelphos_report_price_catalogue(id,draft) values(true,
 '{"cable":{"usageCredits":20,"batches":[]},"sap":{"usageCredits":20,"batches":[]},"lighting":{"usageCredits":20,"batches":[]}}');
create table public.adelphos_report_price_actions (
 request_id uuid primary key,
 actor text not null,
 action text not null check(action in ('save','publish')),
 reason text not null,
 input jsonb not null,
 result jsonb not null,
 created_at timestamptz not null default now()
);
alter table public.adelphos_report_price_catalogue enable row level security;
alter table public.adelphos_report_price_actions enable row level security;
revoke all on public.adelphos_report_price_catalogue,public.adelphos_report_price_actions from public,anon,authenticated,service_role;
grant select on public.adelphos_report_price_catalogue,public.adelphos_report_price_actions to service_role;

create function public.adelphos_validate_report_prices(p_prices jsonb)
returns boolean language plpgsql immutable set search_path=public as $$
declare code text; item jsonb; tier jsonb; amount numeric; last_amount numeric; last_quantity integer; quantity integer;
begin
 if jsonb_typeof(p_prices) is distinct from 'object' or
    (select array_agg(key order by key) from jsonb_object_keys(p_prices) key) is distinct from array['cable','lighting','sap'] then return false; end if;
 foreach code in array array['cable','sap','lighting'] loop
  item := p_prices->code;
  if jsonb_typeof(item) is distinct from 'object' or
     (select array_agg(key order by key) from jsonb_object_keys(item) key) is distinct from array['batches','usageCredits'] or
     jsonb_typeof(item->'usageCredits') is distinct from 'number' or jsonb_typeof(item->'batches') is distinct from 'array' then return false; end if;
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
alter table public.adelphos_report_price_catalogue add constraint valid_report_draft check(public.adelphos_validate_report_prices(draft));
alter table public.adelphos_report_price_catalogue add constraint valid_report_publication check(published is null or public.adelphos_validate_report_prices(published));

create function public.adelphos_change_report_prices(p_request_id uuid,p_actor text,p_action text,p_reason text,p_revision integer,p_prices jsonb default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare current_row public.adelphos_report_price_catalogue; previous public.adelphos_report_price_actions; command jsonb; result jsonb;
begin
 if p_request_id is null or p_actor is null or p_actor !~ '^[^@[:space:]]+@adelphos[.]ai$' or
    p_reason is null or length(trim(p_reason)) not between 5 and 500 or p_revision is null or p_revision<0 or
    p_action is null or p_action not in ('save','publish') then raise exception 'Invalid pricing action'; end if;
 command := jsonb_build_object('actor',p_actor,'action',p_action,'reason',trim(p_reason),'revision',p_revision,'prices',p_prices);
 select * into current_row from public.adelphos_report_price_catalogue where id for update;
 select * into previous from public.adelphos_report_price_actions where request_id=p_request_id;
 if found then
  if previous.input<>command then raise exception 'Pricing action ID conflict'; end if;
  return previous.result;
 end if;
 if current_row.revision<>p_revision then raise exception 'Pricing revision conflict. Reload before editing or publishing.'; end if;
 if p_action='save' then
  if public.adelphos_validate_report_prices(p_prices) is distinct from true then raise exception 'Invalid report prices'; end if;
  update public.adelphos_report_price_catalogue set draft=p_prices,revision=revision+1,updated_at=now() where id returning * into current_row;
 else
  if p_prices is not null then raise exception 'Publish accepts only the saved draft revision'; end if;
  if current_row.published is not distinct from current_row.draft then raise exception 'These report prices are already published'; end if;
  update public.adelphos_report_price_catalogue set published=draft,published_revision=revision,published_at=now(),updated_at=now(),revision=revision+1 where id returning * into current_row;
 end if;
 result := to_jsonb(current_row)-'id';
 insert into public.adelphos_report_price_actions(request_id,actor,action,reason,input,result) values(p_request_id,p_actor,p_action,trim(p_reason),command,result);
 return result;
end $$;

-- Public readers see only the published snapshot; no draft, actor, reason or audit data.
create function public.adelphos_published_report_prices()
returns jsonb language sql stable security definer set search_path=public as $$
 select case when published is null then null else jsonb_build_object('version',published_revision,'publishedAt',published_at,'products',published,'identicalDownloadsFree',true) end
 from public.adelphos_report_price_catalogue where id;
$$;
revoke all on function public.adelphos_validate_report_prices(jsonb) from public,anon,authenticated;
revoke all on function public.adelphos_change_report_prices(uuid,text,text,text,integer,jsonb) from public,anon,authenticated;
revoke all on function public.adelphos_published_report_prices() from public,anon,authenticated;
grant execute on function public.adelphos_validate_report_prices(jsonb),public.adelphos_change_report_prices(uuid,text,text,text,integer,jsonb),public.adelphos_published_report_prices() to service_role;
notify pgrst,'reload schema';
commit;
