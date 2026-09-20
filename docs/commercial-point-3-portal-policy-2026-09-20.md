# Explicit Billing Portal configuration

The shared Stripe default has subscription updates disabled. Opening management
therefore did not let a customer choose another plan. Both billing entry points
now support an explicit, server-owned portal configuration:

- STRIPE_TEST_BILLING_PORTAL_CONFIGURATION_ID
- STRIPE_LIVE_BILLING_PORTAL_CONFIGURATION_ID

The management route chooses the configuration from the verified customer's
actual Stripe mode, including live customers whose internal/free plan metadata
prefers test mode. Browser-supplied configuration IDs are ignored.

The shared session helper checks active status, Stripe mode, price-only changes,
immediate invoicing of prorated upgrades, scheduled decreases, end-of-period
cancellation without proration and no customer-email editing. An explicit
configuration failure stops the request. With neither setting supplied, existing
default management behavior remains unchanged.

## Verification

38 focused tests passed: 16 policy/management-handler checks, 15 existing
subscriber Checkout checks and seven customer-resolution checks. These cover
cross-mode fallback, inactive/wrong policy, unsafe policy changes, provider
failure, fixed return URL and untrusted browser configuration input.

An isolated non-default sandbox configuration was created for the existing three
hidden test plans. Candidate copies of both real entry points used that policy
with an additional exact test identity guard. Both returned real Stripe portal
sessions, and both browser pages visibly offered Update subscription for the
correct Everyday customer. Anonymous requests returned401 and foreign identities
returned403. Both candidate functions were then removed. Shared configuration,
production functions and shared project secrets were not changed.

At the midpoint of the owned sandbox subscription, the real customer flow
Everyday → Standard showed GBP15 due now and GBP50/month from the existing
renewal date. This is a verified preview, not a completed upgrade. The Confirm
button also accepts Terms of Service and is awaiting user confirmation.

## Rollout and remaining acceptance

Do not treat the configuration flags alone as proof of downgrade behavior.
Stripe's [portal configuration documentation](https://docs.stripe.com/customer-management/configure-portal)
states that scheduled downgrades require prices on the same Product. Existing
Everyday, Standard and Business prices use different Products. The isolated
configuration was accepted by Stripe, but customer-facing downgrade timing still
requires proof before enabling a production policy. No catalogue migration or
production subscription change is included here.

The owned sandbox subscription/configuration are retained for the pending
confirmation and subsequent downgrade test; the frozen test clock prevents
time-based renewal until explicitly advanced. They must be canceled/deactivated
after acceptance. No real-money purchase or Starlink licence change occurred.

After the policy passes full acceptance, configure the appropriate environment
and deploy both central functions using the normal release process. Merely
merging this source does not enable plan changes in production.

Private receipts: point-3-policy-candidate.json and
point3-plan-portal-20260920.json under the session TaskRecovery directory.
No credentials or private portal URLs are committed.
