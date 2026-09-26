// Stripe moved invoice line prices under pricing.price_details in newer API versions.
type InvoiceLine = {
  amount?: number;
  price?: { id?: string } | string | null;
  pricing?: { price_details?: { price?: string | { id?: string } | null } | null } | null;
};

export function resolveInvoicePrice(invoice: { lines?: { data?: InvoiceLine[]; has_more?: boolean } }) {
  if (invoice.lines?.has_more) throw new Error('Invoice has additional line items; refusing an incomplete entitlement decision.');
  const lines = invoice.lines?.data || [];
  // Upgrades include a negative credit for the previous plan. Entitle the paid new plan.
  const charged = lines.filter((line) => Number(line.amount ?? 0) >= 0);
  const ids = [...new Set(charged.map((line) => {
    const price = line.pricing?.price_details?.price ?? line.price;
    return typeof price === 'string' ? price : price?.id || '';
  }).filter(Boolean))];
  if (ids.length !== 1) throw new Error('Invoice must resolve to one charged Stripe Price.');
  return ids[0];
}
