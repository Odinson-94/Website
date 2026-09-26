-- Sandbox fixtures stay in central licensing but never in the public catalogue.
-- Service-role checkout/webhook handlers additionally require the exact fixture identity.
alter policy "billing plans are publicly readable" on public.adelphos_billing_plans
  using (is_active = true and active = true
    and coalesce(metadata->>'billing_verification', 'false') <> 'true');
