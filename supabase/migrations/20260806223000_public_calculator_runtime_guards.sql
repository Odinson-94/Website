create table if not exists public.website_calculator_rate_windows (
  client_key text primary key,
  window_start timestamptz not null,
  request_count integer not null check (request_count > 0)
);

create table if not exists public.website_calculator_report_tokens (
  token_hash text primary key,
  expires_at timestamptz not null
);

alter table public.website_calculator_rate_windows enable row level security;
alter table public.website_calculator_report_tokens enable row level security;

create or replace function public.website_calculator_check_rate_limit(
  p_client_key text,
  p_limit integer default 15,
  p_window_seconds integer default 60
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_count integer;
begin
  if p_client_key is null or length(p_client_key) < 8 or p_limit < 1 or p_window_seconds < 1 then
    return true;
  end if;

  insert into public.website_calculator_rate_windows (client_key, window_start, request_count)
  values (p_client_key, v_now, 1)
  on conflict (client_key) do update
    set window_start = case
          when website_calculator_rate_windows.window_start <= v_now - make_interval(secs => p_window_seconds)
            then v_now
          else website_calculator_rate_windows.window_start
        end,
        request_count = case
          when website_calculator_rate_windows.window_start <= v_now - make_interval(secs => p_window_seconds)
            then 1
          else website_calculator_rate_windows.request_count + 1
        end
  returning request_count into v_count;

  if random() < 0.01 then
    delete from public.website_calculator_rate_windows
    where window_start < v_now - interval '10 minutes';
  end if;
  return v_count > p_limit;
end;
$$;

create or replace function public.website_calculator_claim_report_token(
  p_token_hash text,
  p_expires_at timestamptz
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_token_hash is null or length(p_token_hash) <> 64 or p_expires_at <= clock_timestamp() then
    return false;
  end if;
  delete from public.website_calculator_report_tokens where expires_at < clock_timestamp();
  insert into public.website_calculator_report_tokens (token_hash, expires_at)
  values (p_token_hash, p_expires_at)
  on conflict (token_hash) do nothing;
  return found;
end;
$$;

create or replace function public.website_calculator_release_report_token(
  p_token_hash text
) returns void
language sql
security definer
set search_path = public
as $$
  delete from public.website_calculator_report_tokens where token_hash = p_token_hash;
$$;

revoke all on public.website_calculator_rate_windows from public, anon, authenticated;
revoke all on public.website_calculator_report_tokens from public, anon, authenticated;
revoke all on function public.website_calculator_check_rate_limit(text, integer, integer) from public, anon, authenticated;
revoke all on function public.website_calculator_claim_report_token(text, timestamptz) from public, anon, authenticated;
revoke all on function public.website_calculator_release_report_token(text) from public, anon, authenticated;
grant execute on function public.website_calculator_check_rate_limit(text, integer, integer) to service_role;
grant execute on function public.website_calculator_claim_report_token(text, timestamptz) to service_role;
grant execute on function public.website_calculator_release_report_token(text) to service_role;
