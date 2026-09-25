-- Jason CLI uses existing Chat identities and the existing central billing project.
-- Only the authenticated backend service can create/resolve/revoke credentials.
begin;
create table if not exists public.adelphos_cli_devices (
  id uuid primary key default gen_random_uuid(),
  chat_user_id text not null,
  tenant_id text not null,
  owner_email text not null,
  name text not null check (char_length(name) between 1 and 80),
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  scopes text[] not null default array['chat:read','chat:run'],
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '90 days'),
  last_used_at timestamptz,
  revoked_at timestamptz
);
create index if not exists adelphos_cli_devices_owner on public.adelphos_cli_devices(chat_user_id,tenant_id);
alter table public.adelphos_cli_devices enable row level security;
revoke all on public.adelphos_cli_devices from anon, authenticated;
grant select,insert,update on public.adelphos_cli_devices to service_role;
comment on table public.adelphos_cli_devices is 'Per-user Jason CLI/MCP devices; SHA-256 credential hashes only. Wallet remains the existing account wallet.';
commit;
