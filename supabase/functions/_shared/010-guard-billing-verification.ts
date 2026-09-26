// Hidden sandbox plans can only serve their explicitly designated test identity.
type Plan = { metadata?: Record<string, unknown> | null };
type Identity = { email: string; userId?: string; tenantId?: string };

export function assertBillingVerificationIdentity(plan: Plan, identity: Identity, requireBinding = false) {
  const metadata = plan.metadata || {};
  if (metadata.billing_verification !== true) return;
  const expected = metadata.verification_identity as Identity | undefined;
  if (metadata.stripe_mode !== 'test' || !expected?.email || !expected.userId || !expected.tenantId
    || !(expected.email.endsWith('@example.invalid')
      || /^billing-chat-verification-[0-9]{8}@adelphos\.ai$/.test(expected.email))
    || identity.email.trim().toLowerCase() !== expected.email
    || ((requireBinding || identity.userId) && identity.userId !== expected.userId)
    || ((requireBinding || identity.tenantId) && identity.tenantId !== expected.tenantId)) {
    throw new Error('This sandbox plan is restricted to its billing verification identity.');
  }
}
