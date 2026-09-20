/** Existing subscribers manage their current billing account instead of buying a second subscription. */
type Subscription = { id: string; customer: string | { id: string }; livemode: boolean; status: string };
type Customer = { deleted?: boolean; email?: string | null; livemode?: boolean };
type StripeClient = {
  customers: { retrieve(id: string): Promise<Customer> };
  subscriptions: { list(params: { customer: string; status: 'all'; limit: number }): AsyncIterable<Subscription> };
  billingPortal: { sessions: { create(params: { customer: string; return_url: string }): Promise<{ url: string }> } };
};

export async function existingSubscriptionPortal(
  stripe: StripeClient,
  identity: { customerId: string; email: string; live: boolean },
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
    if (!['canceled', 'incomplete_expired'].includes(subscription.status)) existing = true;
  }
  if (!existing) return null;
  const portal = await stripe.billingPortal.sessions.create({
    customer: identity.customerId,
    return_url: 'https://chat.adelphos.ai/account/billing',
  });
  if (!portal.url || !portal.url.startsWith('https://billing.stripe.com/')) {
    throw new Error('Stripe did not return a Billing Portal URL.');
  }
  return portal.url;
}
