/** Verify the purchased catalogue item independently of tax and display currency. */
type Amounts = { amount_subtotal?: number | null; amount_total?: number | null; currency?: string | null };
type Checkout = Amounts & {
  mode?: string | null;
  total_details?: { amount_discount?: number; amount_shipping?: number; amount_tax?: number } | null;
  automatic_tax?: { enabled?: boolean; status?: string | null };
};
type Line = Amounts & {
  quantity?: number | null; amount_discount?: number; amount_tax?: number;
  price?: { id: string; unit_amount?: number | null; currency?: string; livemode?: boolean } | null;
};
type Plan = { stripe_price_id: string; price_cents: number; currency: string; plan_kind: string };

function money(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0;
}

export function verifyCheckoutAmounts(session: Checkout, lines: { data: Line[]; has_more?: boolean }, plan: Plan, livemode: boolean) {
  if (lines.has_more || lines.data.length !== 1 || lines.data[0].quantity !== 1) {
    throw new Error('Checkout must contain exactly one unit of one catalogue Price.');
  }
  const line = lines.data[0];
  const price = line.price;
  if (!price || price.id !== plan.stripe_price_id || price.livemode !== livemode ||
      !money(plan.price_cents) || price.unit_amount !== plan.price_cents) {
    throw new Error('Checkout Price or unit amount does not match the catalogue.');
  }
  if (![session.currency, line.currency, price.currency].every(currency =>
    String(currency || '').toLowerCase() === plan.currency.toLowerCase())) {
    throw new Error('Checkout currency does not match the catalogue.');
  }
  if (!['payment', 'subscription'].includes(plan.plan_kind) || session.mode !== plan.plan_kind) {
    throw new Error('Checkout mode does not match the catalogue.');
  }
  const details = session.total_details;
  if (!details || details.amount_discount !== 0 || details.amount_shipping !== 0 || line.amount_discount !== 0) {
    throw new Error('Checkout discounts or shipping are not supported for this purchase.');
  }
  if (session.automatic_tax?.enabled && session.automatic_tax.status !== 'complete') {
    throw new Error('Checkout tax calculation is incomplete.');
  }
  const subtotal = session.amount_subtotal;
  const total = session.amount_total;
  const tax = details.amount_tax;
  if (!money(subtotal) || !money(total) || !money(tax) || subtotal !== plan.price_cents ||
      line.amount_subtotal !== subtotal || line.amount_total !== total || line.amount_tax !== tax ||
      total < subtotal || total > subtotal + tax || tax > total) {
    throw new Error('Checkout totals do not reconcile with its verified catalogue line item.');
  }
  // Tax can be inclusive, exclusive, or a mixture. Stripe's API-returned line
  // total is authoritative; tax and Adaptive Pricing presentment never buy UC.
}
