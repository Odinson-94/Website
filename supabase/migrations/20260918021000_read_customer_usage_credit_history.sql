-- Read the amount actually debited from the wallet, not legacy Mongo tokenValue
-- units or uncharged overrun cost. Every settled reservation counts once.
begin;
create or replace function public.adelphos_read_usage_credit_history(p_email text, p_days integer)
returns jsonb language plpgsql stable security definer set search_path = public as $function$
declare result jsonb;
begin
  if p_days not in (7,30,180) or trim(coalesce(p_email,''))='' then
    raise exception 'An account and supported reporting period are required';
  end if;
  with charged as (
    select (settled_at at time zone 'UTC')::date as day,
      least(actual_usage_credits,reserved_usage_credits) as amount
    from public.adelphos_credit_reservations
    where email=lower(trim(p_email))::citext and status in ('settled','overrun')
      and settled_at >= ((now() at time zone 'UTC')::date-(p_days-1)) at time zone 'UTC'
  ), daily as (select day, sum(amount) as amount from charged group by day)
  select jsonb_build_object('available',true,'days',p_days,
    'usageCredits',coalesce((select sum(amount) from charged),0),
    'daily',coalesce((select jsonb_agg(jsonb_build_object('date',day,'usageCredits',amount) order by day) from daily),'[]'::jsonb)) into result;
  return result;
end $function$;
revoke all on function public.adelphos_read_usage_credit_history(text,integer) from public, anon, authenticated;
grant execute on function public.adelphos_read_usage_credit_history(text,integer) to service_role;
commit;
