/** Reconcile only provider-confirmed successful refunds, never browser amounts. */
export async function applyPaymentRefund(supabase: any, stripe: any, object: any, livemode: boolean) {
  const chargeId = object.object === 'charge' ? object.id
    : typeof object.charge === 'string' ? object.charge : object.charge?.id;
  if (!chargeId) throw new Error('Refund has no charge identity.');
  const charge = await stripe.charges.retrieve(chargeId);
  if (charge.livemode !== livemode || !charge.paid || !Number.isSafeInteger(charge.amount) || charge.amount <= 0) {
    throw new Error('Refund charge mode or paid amount is invalid.');
  }
  const paymentIntent = typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id;
  if (!paymentIntent) throw new Error('Refund charge has no PaymentIntent.');
  let refunded = 0;
  // Do not trust the event's old cumulative amount or a truncated refund list.
  for await (const refund of stripe.refunds.list({ charge: charge.id, limit: 100 })) {
    if (refund.status !== 'succeeded') continue;
    if (refund.currency !== charge.currency || !Number.isSafeInteger(refund.amount) || refund.amount < 0) {
      throw new Error('Refund amount or currency is invalid.');
    }
    refunded += refund.amount;
  }
  if (refunded === 0) return { applied: false, reason: 'no_successful_refund' };
  if (refunded > charge.amount) throw new Error('Refund exceeds the original charge.');
  const invoiceId = typeof charge.invoice === 'string' ? charge.invoice : charge.invoice?.id ?? null;
  const { data, error } = await supabase.rpc('adelphos_apply_payment_refund', {
    p_charge_id: charge.id,
    p_payment_intent_id: paymentIntent,
    p_invoice_id: invoiceId,
    p_original_amount: charge.amount,
    p_refunded_amount: refunded,
    p_currency: charge.currency,
    p_livemode: livemode,
  });
  if (error) throw error;
  return data;
}
