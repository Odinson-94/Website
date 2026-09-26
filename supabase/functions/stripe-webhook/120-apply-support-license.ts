/** Separate Support subscriptions from base-plan and credit-grant event handling. */
export async function applySupportEvent(supabase: any, stripe: any, event: any): Promise<boolean> {
  if (!['checkout.session.completed','checkout.session.async_payment_succeeded','customer.subscription.created','customer.subscription.updated','customer.subscription.deleted','invoice.paid','invoice.payment_failed'].includes(event.type)) return false;
  const object = event.data.object;
  if (!event.type.startsWith('invoice.') && object.metadata?.app_addon !== 'support') return false;
  if (event.type.startsWith('invoice.')) {
    const marker = object.subscription_details?.metadata?.app_addon || object.parent?.subscription_details?.metadata?.app_addon;
    if (marker !== 'support') return false;
  }
  let subscriptionId: string | undefined;
  if (event.type.startsWith('customer.subscription.')) subscriptionId = object.id;
  else if (event.type.startsWith('checkout.session.') || event.type.startsWith('invoice.')) {
    const sub = object.subscription || object.parent?.subscription_details?.subscription;
    subscriptionId = typeof sub === 'string' ? sub : sub?.id;
  }
  if (!subscriptionId) return false;
  const observedAt = new Date().toISOString();
  // Fetch current truth so replayed paid/cancelled events cannot restore an obsolete entitlement.
  const subscription = await stripe.subscriptions.retrieve(subscriptionId, { expand: ['latest_invoice'] });
  if (subscription.metadata?.app_addon !== 'support') return false;
  const metadata = subscription.metadata;
  if (!metadata.adelphos_user_id || !metadata.email || !metadata.plan_code || subscription.livemode !== event.livemode) throw new Error('Support subscription identity is incomplete.');
  const planRead = await supabase.from('adelphos_billing_plans').select('code,stripe_price_id,metadata').eq('code', metadata.plan_code).single();
  const plan = planRead.data;
  if (planRead.error || !plan || plan.metadata?.app_addon !== 'support' || plan.metadata?.stripe_mode !== (event.livemode ? 'live' : 'test') || subscription.items.data.length !== 1 || subscription.items.data[0].price.id !== plan.stripe_price_id) throw new Error('Support subscription does not match the registered app price.');
  const ownerRead = await supabase.from('adelphos_user_licenses').select('auth_user_id,email').eq('email', metadata.email.toLowerCase()).single();
  if (ownerRead.error || ownerRead.data?.auth_user_id !== metadata.adelphos_user_id) throw new Error('Support purchase has no registered billing owner.');
  const invoice = subscription.latest_invoice;
  const paid = subscription.status === 'active' && invoice && typeof invoice === 'object' && invoice.paid === true;
  const periodEnd = subscription.current_period_end || subscription.items.data[0].current_period_end;
  const result = await supabase.rpc('adelphos_record_support_license', { p_record: {
    stripe_subscription_id: subscription.id, user_id: metadata.adelphos_user_id, email: metadata.email.toLowerCase(), plan_code: plan.code, livemode: event.livemode,
    status: paid ? 'active' : subscription.status === 'active' ? 'unpaid' : subscription.status,
    paid_through: paid && periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    cancel_at_period_end: subscription.cancel_at_period_end === true, observed_at: observedAt,
  } });
  if (result.error) throw result.error;
  return true;
}
