/** Use an explicitly selected, mode-matched portal policy for billing sessions. */
type Policy = {
  id: string; active: boolean; livemode: boolean;
  features: {
    subscription_update: {
      enabled: boolean; default_allowed_updates: string[]; proration_behavior: string;
      schedule_at_period_end?: { conditions: { type: string }[] };
    };
    subscription_cancel: { enabled: boolean; mode: string; proration_behavior: string };
    customer_update: { enabled: boolean; allowed_updates: string[] };
  };
};
export type PortalClient = {
  billingPortal: {
    configurations?: { retrieve(id: string): Promise<Policy> };
    sessions: { create(params: { customer: string; return_url: string; configuration?: string }): Promise<{ url: string }> };
  };
};

export async function billingPortalUrl(stripe: PortalClient, customerId: string, live: boolean, configurationId = '') {
  const params: { customer: string; return_url: string; configuration?: string } = {
    customer: customerId,
    return_url: 'https://chat.adelphos.ai/account/billing',
  };
  if (configurationId) {
    if (!/^bpc_[A-Za-z0-9]+$/.test(configurationId) || !stripe.billingPortal.configurations) {
      throw new Error('Billing Portal configuration is invalid.');
    }
    const policy = await stripe.billingPortal.configurations.retrieve(configurationId);
    if (policy.id !== configurationId || !policy.active || policy.livemode !== live) {
      throw new Error('Billing Portal configuration is inactive or belongs to a different Stripe mode.');
    }
    const update = policy.features.subscription_update;
    if (!update.enabled || update.default_allowed_updates.length !== 1 || update.default_allowed_updates[0] !== 'price' ||
        update.proration_behavior !== 'always_invoice' ||
        !update.schedule_at_period_end?.conditions.some(condition => condition.type === 'decreasing_item_amount')) {
      throw new Error('Billing Portal must invoice upgrades immediately and schedule downgrades at renewal.');
    }
    const cancel = policy.features.subscription_cancel;
    if (!cancel.enabled || cancel.mode !== 'at_period_end' || cancel.proration_behavior !== 'none') {
      throw new Error('Billing Portal cancellations must retain the paid period.');
    }
    if (policy.features.customer_update.enabled && policy.features.customer_update.allowed_updates.includes('email')) {
      throw new Error('Billing Portal cannot change the authenticated account email.');
    }
    params.configuration = configurationId;
  }
  const session = await stripe.billingPortal.sessions.create(params);
  if (!session.url || !session.url.startsWith('https://billing.stripe.com/')) {
    throw new Error('Stripe did not return a Billing Portal URL.');
  }
  return session.url;
}
