import { resolveInvoicePrice } from './010-resolve-invoice-price.ts';
import { assertBillingVerificationIdentity } from '../_shared/010-guard-billing-verification.ts';
import { stripeId } from './050-subscription-state.ts';

// Reconcile all paid changes in the current cycle, so delivery order cannot
// omit its initial allowance or a paid upgrade. Stripe controls the periods.
export async function paidCycleInvoices(db: any, stripe: any, state: any, latestInvoiceId: string) {
  const entries: any[] = [];
  const plans = new Map<string, any>();
  let inspected = 0;
  for await (const invoice of stripe.invoices.list({ subscription: state.subscription.id, status: 'paid', limit: 100 })) {
    if (++inspected > 500) throw new Error('Invoice history needs explicit reconciliation.');
    if (!['subscription_create', 'subscription_cycle', 'subscription_update'].includes(invoice.billing_reason)) continue;
    if (invoice.status !== 'paid' || invoice.livemode !== state.subscription.livemode
      || stripeId(invoice.customer) !== state.customerId) throw new Error('Paid invoice ownership or mode is invalid.');
    const charged = (invoice.lines?.data || []).filter((line: any) => Number(line.amount ?? 0) >= 0
      && (line.price || line.pricing?.price_details?.price));
    if (!charged.some((line: any) => line.period?.end === state.end)) continue;
    const priceId = resolveInvoicePrice(invoice); // Also refuses truncated line lists.
    if (charged.some((line: any) => line.period?.end !== state.end
      || !Number.isSafeInteger(line.period?.start) || line.period.start < state.start || line.period.start > state.end)) {
      throw new Error('Paid invoice period does not match the subscription cycle.');
    }
    const starts = [...new Set(charged.map((line: any) => line.period.start))];
    if (starts.length !== 1) throw new Error('Paid invoice has ambiguous proration periods.');
    const kind = invoice.billing_reason === 'subscription_update' ? 'update' : 'base';
    if (kind === 'base' && starts[0] !== state.start) throw new Error('Base invoice does not cover the full subscription cycle.');
    if (!plans.has(priceId)) {
      const result = await db.from('adelphos_billing_plans').select('code,plan_kind,currency,metadata')
        .eq('stripe_price_id', priceId).single();
      if (result.error) throw result.error;
      plans.set(priceId, result.data);
    }
    const plan = plans.get(priceId);
    if (plan?.plan_kind !== 'subscription' || plan.currency !== invoice.currency
      || plan.metadata?.stripe_mode !== (invoice.livemode ? 'live' : 'test')) throw new Error('Paid invoice catalogue identity is invalid.');
    assertBillingVerificationIdentity(plan, { email: state.email });
    entries.push({ invoice_id: invoice.id, plan_code: plan.code, kind, start: starts[0], end: state.end, created: invoice.created ?? 0 });
  }
  if (entries.filter(item => item.kind === 'base').length !== 1 || !entries.some(item => item.invoice_id === latestInvoiceId)) {
    throw new Error('Current cycle needs its paid base and latest invoice; retry after payment delivery.');
  }
  return entries.sort((a, b) => (a.kind === 'base' ? 0 : 1) - (b.kind === 'base' ? 0 : 1)
    || a.start - b.start || a.created - b.created || a.invoice_id.localeCompare(b.invoice_id));
}
