# Prorated subscription credit cycles

Previously, every paid subscription invoice replaced the included balance with
a full monthly allowance. A mid-cycle upgrade could restore credits already
spent, and repeated changes could repeatedly refill the wallet.

Each subscription billing cycle now has one allocation record. Its paid base
invoice funds the initial allowance. A paid upgrade adds the increase above the
highest tier already funded in that cycle, multiplied by the fraction of the
cycle remaining. Consumption stays deducted. Downgrades, reactivation and
repeated purchases of an already-funded tier add no UC. The next paid base
invoice starts a fresh cycle and expires the previous included balance;
purchased top-ups persist.

For example, Everyday starts with 15 UC. After spending 5 UC, a halfway upgrade
to Standard adds `(40 - 15) × 0.5 = 12.5 UC`, leaving **22.5 UC**. Repeated plan
changes cannot refill that consumed allowance. Renewal on Standard starts a new
40 UC allowance.

The handler reads all paid invoices in the current cycle, including the base,
before applying the latest paid invoice. This tolerates reordered delivery and
does not treat a small upgrade payment as funding a whole new month. Each
invoice is recorded once. Existing accounts adopt their already-funded current
cycle without rewriting historical grants or restoring consumed credits.

Refunds remain tied to the original funding invoice. Included credits are
attributed oldest funding first within the cycle. A refund can remove only that
source's remaining credits; another upgrade, purchased credits, and a subsequent
renewal are preserved. Already-used or expired credits remain recorded as
absorbed. Active reservations against the shared cycle cause a retry. Refunded
credits cannot be restored by replaying paid invoices. Zero-UC plan-change
invoices have an audit allocation and refund without debiting another source.

This patch governs UC allocation. It does not change Stripe's monetary
proration configuration, approve refunds, or enable self-service plan changes.
The inspected sandbox default portal has subscription updates disabled. The
upgrade/downgrade proof below uses the authenticated Stripe test API; it is not
evidence of a completed self-service app journey or launch-wide billing policy.

## Validation — 20 September 2026

52 Node tests passed across the webhook handlers, invoice compatibility, refund
boundaries, and paid-cycle collection. Set `ADELPHOS_TYPESCRIPT_PATH` to an
installed TypeScript package and run:

```text
node --test supabase/functions/stripe-webhook/*test*.cjs
```

Two real PostgreSQL test transactions passed and were rolled back:

- `supabase/scripts/verify-prorated-credit-cycles.sql`: initial allowance,
  fractional upgrade, retained consumption, downgrade/repeat, later higher
  tier, duplicate delivery, shared reservations, per-source partial/full
  refunds, zero-credit refunds, renewal, expiry, legacy adoption, last-minute
  upgrade, atomic licence/allocation, and browser-role denial.
- The existing `supabase/scripts/verify-payment-refunds.sql` passed against the
  updated refund routine, preserving the earlier top-up and subscription refund
  cases.

A real owned Stripe sandbox subscription and its test clock exercised these
candidate results through signed webhooks and supported event resend:

| Action | Included balance |
| --- | ---: |
| Initial Everyday payment | 15 UC |
| Stage 5 UC consumption in copied test accounting | 10 UC |
| Halfway paid upgrade to Standard | 22.5 UC |
| Paid downgrade to Everyday | 22.5 UC |
| Paid repeat upgrade to Standard | 22.5 UC |
| Schedule cancellation, then reactivate | 22.5 UC |
| Paid Standard renewal | 40 UC |

Invoices and payments were genuine Stripe test-mode objects. The consumption
was explicitly staged in copied accounting tables; no AI call is claimed for
that step. The candidate used isolated tables and an isolated signed endpoint.
The existing production handler also received the owned sandbox fixture's
events; its test financial history is retained. Starlink and real-money accounts
were not changed. The owned subscription was canceled after the proof, and the
candidate and control fixture balances returned to zero/Free before endpoint
cleanup.

## Release

Apply `20260920120000_prorated_subscription_credit_cycles.sql` and
`20260920121000_refund_subscription_cycle_sources.sql` after the preceding
refund/event-order migrations. Deploy the webhook with
`070-paid-cycle-invoices.ts` and the updated `050-subscription-state.ts`, which
uses `adelphos_apply_subscription_event_v2`. Drain old handler executions before
replaying failed invoices; an old handler still uses the full-invoice allowance
routine. Migration and source merge alone are not a production deployment.

Actual signed-in app Checkout/return tests, remaining Sales/currency acceptance,
and launch configuration are still separate Payments acceptance work. This
document does not mark point 3 complete.

References: [Stripe proration behaviour](https://docs.stripe.com/billing/subscriptions/prorations)
and [portal configuration](https://docs.stripe.com/customer-management/configure-portal).
