# Explicit Billing Portal configuration

<!-- #region ADELPHOS-SESSION 2026-09-20/point3-portal/01a0b8b9 -->
<!-- CHANGELOG 2026-09-20: Record the completed browser upgrade and signed invoice credit replay.
what: Replace the upgrade preview with observed payment and accounting results.
why: Distinguish completed sandbox acceptance from pending downgrade and production rollout. -->

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
renewal date. After the user's confirmation, the browser upgrade completed.
Stripe displayed Standard active and a paid GBP15 invoice. The canonical
subscription retained its ID and renewal date; no second subscription was
created. The invoice credited GBP10 of unused Everyday time and charged GBP25
for the remaining Standard time, producing the GBP15 payment.

The genuine signed `invoice.paid` event was resent to an isolated candidate
using the merged webhook and credit-cycle accounting code, with separate
service-only tables. The included balance was 27.5 UC: 15 UC from the original
Everyday period plus 12.5 UC for half of Standard's 25 UC monthly increase.
Replaying the same paid event left the balance at 27.5 UC and did not create
another grant. No consumption was staged in this scenario. This proves the
candidate accounting path, not deployment of that code to production.

| Completed check | Expected | Observed | Result |
| --- | --- | --- | --- |
| Browser upgrade | Standard active; GBP15 paid | Standard active; invoice paid GBP15 | PASS |
| Subscription continuity | Same subscription and renewal date | Both unchanged | PASS |
| Prorated credit allocation | 27.5 included UC | 27.5 included UC | PASS |
| Duplicate paid-event delivery | No additional grant | Still 27.5 included UC | PASS |

## Rollout and remaining acceptance

Do not treat the configuration flags alone as proof of downgrade behavior.
Stripe's [portal configuration documentation](https://docs.stripe.com/customer-management/configure-portal)
states that scheduled downgrades require prices on the same Product. Existing
Everyday, Standard and Business prices use different Products. The isolated
configuration was accepted by Stripe, and the actual downgrade preview says
Everyday begins on 17 January 2027 at GBP20/month, with Standard access retained
until then. That preview has not been submitted: its Confirm button accepts
Terms of Service and awaits separate user confirmation. A resulting Stripe
schedule, no immediate charge, and renewal accounting still require verification
before enabling a production policy. No catalogue migration or production
subscription change is included here.

The owned sandbox subscription/configuration are retained for the pending
confirmation and subsequent downgrade test; the frozen test clock prevents
time-based renewal until explicitly advanced. They must be canceled/deactivated
after acceptance. No real-money purchase or Starlink licence change occurred.

After the policy passes full acceptance, configure the appropriate environment
and deploy both central functions using the normal release process. Merely
merging this source does not enable plan changes in production.

Private receipts: point-3-policy-candidate.json,
point3-plan-portal-20260920.json, point-3-portal-upgrade-proof.json and
point-3-portal-credit-upgrade-proof.json under the session TaskRecovery directory.
No credentials or private portal URLs are committed.
<!-- #endregion ADELPHOS-SESSION 01a0b8b9 -->
