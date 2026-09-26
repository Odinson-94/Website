/** Existing subscribers manage their current billing account instead of buying a second subscription. */
import { billingPortalUrl, type PortalClient } from '../_shared/030-billing-portal-session.ts';
type Subscription = { metadata?: { app_addon?: string }; id: string; customer: string | { id: string }; livemode: boolean; status: string };
type Customer = { deleted?: boolean; email?: string | null; livemode?: boolean };
type StripeClient = PortalClient & {
  customers: { retrieve(id: string): Promise<Customer> };
  subscriptions: { list(params: { customer: string; status: 'all'; limit: number }): AsyncIterable<Subscription> };
};

export async function existingSubscriptionPortal(
  stripe: StripeClient,
  identity: { customerId: string; email: string; live: boolean },
  configurationId = '',
): Promise<string | null> {
  const customer = await stripe.customers.retrieve(identity.customerId);
  if (customer.deleted || customer.livemode !== identity.live ||
    String(customer.email || '').trim().toLowerCase() !== identity.email.trim().toLowerCase()) {
    throw new Error('Stripe customer does not match the authenticated billing account.');
  }
  let inspected = 0;
  let existing = false;
  for await (const subscription of stripe.subscriptions.list({ customer: identity.customerId, status: 'all', limit: 100 })) {
    if (++inspected > 500) throw new Error('Subscription history requires reconciliation before another checkout.');
    const owner = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id;
    if (owner !== identity.customerId || subscription.livemode !== identity.live) {
      throw new Error('Stripe subscription does not match the authenticated billing account.');
    }
    // Canceled and incomplete_expired are terminal. Every other status can
    // still involve a subscription or pending collection; fail closed for new statuses.
    if (!subscription.metadata?.app_addon && !['canceled', 'incomplete_expired'].includes(subscription.status)) existing = true;
  }
  if (!existing) return null;
  return billingPortalUrl(stripe, identity.customerId, identity.live, configurationId);
}
