# Payment refund reconciliation

A successful Stripe refund now removes unused UC from the payment that funded
them. Previously the webhook acknowledged refund events without changing credit
balances. This handler accounts for refunds already approved in Stripe; it does
not approve refunds or change the published refund policy.

For example, refunding half of a £20 / 15 UC purchase removes 7.5 unused UC. A
subsequent full refund removes the remaining 7.5 UC. If credits have already been
spent or expired, that portion is recorded as absorbed. Other purchases and the
current allowance of a different billing period remain intact. Balances never
become negative. An active reservation against the affected purchase causes a
retry instead of allowing a later release to restore refunded credits.

The handler verifies the Stripe signature and mode, reads the canonical charge,
and totals all successful refunds across pagination. The database uses a
cumulative amount and the same per-account transaction lock as credit metering.
Older events and duplicate delivery cannot create another adjustment. Refund
state is service-role-only, with an immutable adjustment in the credit ledger;
historical grants and lifetime usage totals are preserved.

## Validation on 20 September 2026

- 20 Node tests passed: 11 refund boundary/dispatch tests and 9 existing invoice
  price tests. Run with `ADELPHOS_TYPESCRIPT_PATH` pointing to an installed
  TypeScript package:
  `node --test supabase/functions/stripe-webhook/020-test-invoice-price.cjs supabase/functions/stripe-webhook/040-test-payment-refund.cjs`.
- `supabase/scripts/verify-payment-refunds.sql` passed against real PostgreSQL
  tables and constraints in an isolated schema, with the entire transaction
  rolled back. Cases cover partial/full refunds, replay, older cumulative
  amounts, partly spent purchases, reservations and retry, current/expired
  subscription periods, unrelated purchases, mode and identity checks, missing
  grants, and browser-role access denial.
- A real £20 Stripe **test-mode** refund of an already-consumed 15 UC purchase
  reached an isolated signed webhook running this candidate code. Both
  `refund.updated` and `charge.refunded` were processed. The wallet stayed at
  0 UC; one adjustment recorded 15 absorbed UC and no debit. A Stripe CLI resend
  of the real event left the same single adjustment and unchanged balances.
- The isolated endpoint was restricted to one disposable billing fixture and
  test-mode refund events. The production webhook was not replaced. No real
  money or Starlink account records were changed by these refund tests.

This is refund-handler evidence, not completion of the entire Payments
acceptance point. Actual app-to-Checkout journeys, unused-purchase refunds
through Checkout, Sales presentation, and remaining lifecycle cases still need
their acceptance evidence.

## Release order

1. Apply `20260920100000_reconcile_payment_refunds.sql` with the established
   migration process. It adds only refund state and a service-role RPC.
2. Deploy `stripe-webhook` including `030-apply-payment-refund.ts`; retain Stripe
   signature authentication (`verify_jwt = false`).
3. Enable **both** `charge.refunded` and `refund.updated` on each appropriate
   Stripe test/live endpoint while retaining all existing event types. Test and
   live secrets must remain separate. Merely merging the source does not enable
   refund delivery or deploy this migration/function.
4. Replay missed successful refund events through Stripe's supported resend
   mechanism. Reconciliation retries when an original payment grant has not yet
   arrived or a relevant reservation remains active. Investigate persistent
   failures; do not manually acknowledge them as processed.

The isolated acceptance function and its event/state tables are temporary.
Export their evidence before deleting those exact test resources. Retain the
financial credit-ledger adjustment and Stripe refund record.
