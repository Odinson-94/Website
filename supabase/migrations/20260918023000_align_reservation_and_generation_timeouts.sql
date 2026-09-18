-- Generation may run for 30 minutes; interrupted receipts recover after 35.
-- A 15-minute hold could expire during generation, or before durable recovery.
-- Change only the default for new reservations; historical rows are unchanged.
alter table public.adelphos_credit_reservations
  alter column expires_at set default (now() + interval '60 minutes');
