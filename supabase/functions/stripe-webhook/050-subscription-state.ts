import { assertBillingVerificationIdentity } from '../_shared/010-guard-billing-verification.ts';

export function stripeId(value: any): string {
  return typeof value === 'string' ? value : value?.id || '';
}

// Read the licence version BEFORE contacting Stripe. If another delivery commits
// while this request is in flight, the database refuses this snapshot and retries.
export async function readSubscriptionState(db: any, stripe: any, subscriptionId: string,
  emailHint: string, livemode: boolean, allowBinding = false) {
  if (!subscriptionId) throw new Error('Missing subscription identity.');
  let query = db.from('adelphos_user_licenses')
    .select('email,stripe_subscription_id,stripe_customer_id,stripe_state_version');
  query = emailHint ? query.eq('email', emailHint.toLowerCase().trim()) : query.eq('stripe_subscription_id', subscriptionId);
  const { data: licence, error } = await query.maybeSingle();
  if (error) throw error;
  if (!licence) throw new Error('Subscription licence is not bound yet; retry after Checkout.');
  if (!allowBinding && licence.stripe_subscription_id !== subscriptionId) {
    if (!licence.stripe_subscription_id) throw new Error('Subscription is not bound yet; retry after Checkout.');
    return null; // A replaced subscription cannot change the current entitlement.
  }
  if (!Number.isSafeInteger(licence.stripe_state_version)) throw new Error('Subscription state migration is required.');
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const customerId = stripeId(subscription.customer);
  if (subscription.id !== subscriptionId || subscription.livemode !== livemode || !customerId) {
    throw new Error('Subscription identity or Stripe mode is invalid.');
  }
  if (licence.stripe_customer_id && licence.stripe_customer_id !== customerId) {
    throw new Error('Subscription customer does not own this licence.');
  }
  if (allowBinding && licence.stripe_subscription_id && licence.stripe_subscription_id !== subscriptionId) {
    const current = await stripe.subscriptions.retrieve(licence.stripe_subscription_id);
    if (stripeId(current.customer) !== customerId || current.livemode !== livemode) {
      throw new Error('Existing subscription identity or mode does not match.');
    }
    if (!Number.isSafeInteger(subscription.created) || !Number.isSafeInteger(current.created)) {
      throw new Error('Subscription creation time is missing.');
    }
    if (subscription.created === current.created) throw new Error('Subscription replacement order is ambiguous; review the duplicate purchase.');
    if (subscription.created < current.created) return null;
  }
  if (subscription.items?.data?.length !== 1 || subscription.items?.has_more) {
    throw new Error('Subscription must contain one complete plan item.');
  }
  const item = subscription.items.data[0];
  const priceId = stripeId(item.price);
  const result = await db.from('adelphos_billing_plans')
    .select('code,plan_kind,metadata').eq('stripe_price_id', priceId)
    .eq('active', true).eq('is_active', true).single();
  if (result.error) throw result.error;
  const plan = result.data;
  if (!plan || plan.plan_kind !== 'subscription'
      || plan.metadata?.stripe_mode !== (livemode ? 'live' : 'test')) {
    throw new Error('Subscription plan or Stripe mode is invalid.');
  }
  const email = String(licence.email).toLowerCase();
  if (subscription.metadata?.email && String(subscription.metadata.email).trim().toLowerCase() !== email) {
    throw new Error('Subscription email does not own this licence.');
  }
  assertBillingVerificationIdentity(plan, { email });
  const start = subscription.current_period_start ?? item.current_period_start;
  const end = subscription.current_period_end ?? item.current_period_end;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || end <= start) {
    throw new Error('Subscription period is invalid.');
  }
  const status = ['active', 'trialing'].includes(subscription.status) ? subscription.status
    : ['past_due', 'unpaid'].includes(subscription.status) ? 'past_due'
    : ['canceled', 'incomplete_expired'].includes(subscription.status) ? 'canceled' : 'incomplete';
  return { licence, subscription, plan, email, customerId, start, end, status, allowBinding };
}

export async function writeSubscriptionState(db: any, state: any, invoiceId: string | null = null) {
  if (!state) return { ignored: true, reason: 'replaced_subscription' };
  const { data, error } = await db.rpc('adelphos_apply_subscription_event', {
    p_email: state.email,
    p_expected_subscription_id: state.licence.stripe_subscription_id,
    p_expected_state_version: state.licence.stripe_state_version,
    p_subscription_id: state.subscription.id,
    p_customer_id: state.customerId,
    p_plan_code: state.plan.code,
    p_status: state.status,
    p_current_period_start: new Date(state.start * 1000).toISOString(),
    p_current_period_end: new Date(state.end * 1000).toISOString(),
    p_cancel_at_period_end: Boolean(state.subscription.cancel_at_period_end),
    p_allow_binding: state.allowBinding,
    p_invoice_id: invoiceId,
  });
  if (error) throw error;
  return data;
}
