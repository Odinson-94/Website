# Existing subscriber Checkout acceptance

An authenticated customer who already has a nonterminal Stripe subscription
must manage that subscription instead of being offered another subscription
through the plan-purchase route. The reproduced sandbox defect offered
Standard Checkout while Everyday was active. No second payment was submitted.

The subscription route now verifies the bound customer's email and Stripe mode,
scans paginated canonical subscription history, and returns a Billing Portal URL
when any subscription is nonterminal. Canceled and incomplete_expired history
permits subscription Checkout. Ownership mismatches, provider errors, or more
than 500 historical records stop the request. One-time top-ups stay available.

## Validation

- 22 Node tests passed: 15 focused helper/actual-handler tests plus seven
  existing portal customer-resolution regressions. Cases include delinquent,
  paused, trialing and unknown subscription states, paginated history, ownership,
  Stripe mode, transport failures, top-ups and terminal history.
- Deployed an isolated candidate copied from this change with additional exact
  fixture identity, plan allowlist and test-mode guards. The production
  stripe-checkout function was not replaced.
- With one real Stripe sandbox Everyday subscription active, requesting Standard
  returned manage_existing_subscription and a real Billing Portal URL. Stripe
  Checkout session IDs were unchanged; exactly one active subscription remained.
- Browser verified the portal's current Everyday subscription at GBP 20/month
  and the correct disposable customer identity.
- The candidate created a payment-mode top-up Checkout while subscribed.
- Anonymous candidate request returned 401; a foreign identity returned 403.
- After canceling the owned test subscription, the candidate created a
  subscription-mode Checkout again. No payment was submitted through that link.
- Expired all three owned open Checkout sessions, canceled the owned test
  subscription and removed the isolated candidate endpoint. Final fixture:
  Free licence, zero UC, no nonterminal subscriptions. Financial audit retained.

## Scope and release

This fixes the observed existing-subscription path. It does not serialize two
simultaneous first purchases or revoke previously issued Checkout links.
Existing portal configuration is unchanged; opening management does not itself
apply the newly selected tier. Customer-facing plan changes still need their
separate configuration and acceptance tests.

The central function requires its normal deployment and deployed recheck after
merge. This receipt is not a production deployment or a full point-3 pass.
Ordinary-account app-to-Checkout return/reload and remaining currency/tax checks
remain separate acceptance items. Starlink's identity and licence were unchanged.

Private evidence and reproducible candidate harness are in the session's
TaskRecovery directory (point3-checkout-verification-20260920.json and
point-3-checkout-candidate.py). No credentials or session URLs are committed.
