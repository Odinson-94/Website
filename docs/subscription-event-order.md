# Subscription event ordering

An old subscription cancellation previously reverted an account to Free by
email, even after Checkout had attached a replacement subscription. A delayed
payment-failure event could likewise mark a recovered account past due, and an
old paid invoice could reset the current allowance.

Subscription and invoice events now read current Stripe objects. Events from a
replaced subscription retain invoice history but cannot change its replacement.
Checkout also reads current subscription status, so an old Checkout delivery
cannot reactivate a canceled subscription or reattach an older subscription.
Ambiguous same-second duplicate purchases fail for review rather than silently
discarding one customer's payment.

The handler reads a licence version before contacting Stripe. One database
transaction compares that version and the bound subscription/customer, applies
the new state, and grants any eligible invoice credits. A concurrent change
causes a retry with fresh provider data. Failed credit grants roll back the
licence change too. Current cancellation preserves purchased credits, and
reactivation does not create another invoice allowance.

Only the latest paid invoice of the current active subscription can grant an
allowance through this handler. Earlier invoices stay in history, using their
current provider status, without refilling the current wallet. This change does
not resolve the separate policy/implementation work for repeated paid prorations:
distinct current proration invoices still use the existing period-grant routine.
Payments acceptance remains open until that and the actual app Checkout cases
pass. Do not treat this PR as completion of the entire Payments checklist.

## Verification — 20 September 2026

- 40 Node tests: invoice-price compatibility, refund regression checks, and 20
  tests exercising the actual subscription/Checkout/invoice handlers. Set
  `ADELPHOS_TYPESCRIPT_PATH` to an installed TypeScript package, then run
  `node --test supabase/functions/stripe-webhook/*test*.cjs`.
- `supabase/scripts/verify-subscription-event-order.sql` reproduces the original
  cancellation bug, then verifies the fix against real PostgreSQL functions and
  constraints. It checks identity/customer/version rejection, duplicate grants
  after consumption, cancellation/reactivation, replacement, atomic failure,
  current cancellation and browser-role denial. All assertions ran in an
  isolated schema in a transaction that was rolled back.
- Genuine signed Stripe sandbox events were resent with Stripe CLI to an
  isolated candidate endpoint using seven copied fixture tables. An old
  cancellation left the staged replacement unchanged. An old active event
  applied Stripe's current canceled state. A deliberately unavailable fixture
  plan produced a recorded failed delivery; restoring that fixture plan and
  resending recovered successfully. A delayed failed invoice retained its
  current Paid history and did not reverse the replacement or grant credits.
  Duplicate delivery changed no state or credits.
- The replay setup deliberately stages account state in test copies; it is not
  an actual app Checkout journey. Production fixture licence, wallet and grants
  were compared before/after and stayed unchanged. No live payments were made.

## Deployment

Apply `20260920110000_guard_subscription_event_order.sql` before deploying the
updated `stripe-webhook`, including `050-subscription-state.ts`. It adds a
version column and service-role-only atomic RPC. Keep the same Stripe signature
authentication and separate test/live API keys. This source merge does not
deploy those production changes. Drain old handler executions during release so
an old email-only writer cannot race the new transaction; then replay failed
events through Stripe's supported resend mechanism.

Reference: [Stripe's webhook delivery guidance](https://docs.stripe.com/webhooks)
explains unordered event delivery, canonical object retrieval and retries.
