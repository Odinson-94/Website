-- Jason CLI keys expire only when their owner chooses (Jordan 2026-10-04: "We give them
-- the option on how they can expire. I don't want things expiring like that.").
-- NULL expires_at = the key never expires. Keys already issued keep the date they were given;
-- revocation and resolve-time checks are unchanged.
alter table public.adelphos_cli_devices alter column expires_at drop default;
alter table public.adelphos_cli_devices alter column expires_at drop not null;
alter table public.adelphos_cli_devices add constraint adelphos_cli_device_expiry_after_creation
  check (expires_at is null or expires_at > created_at) not valid;
alter table public.adelphos_cli_devices validate constraint adelphos_cli_device_expiry_after_creation;
