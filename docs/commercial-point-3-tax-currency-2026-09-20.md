# Checkout tax and currency acceptance

The deployed webhook rejected a real paid sandbox purchase because GBP 20 of
credit plus GBP 4 synthetic test tax produced a GBP 24 total. It compared that
gross total to the GBP 20 catalogue price. The paid event's failed record
confirmed the exact amount-mismatch error before testing the candidate fix.

The handler now retrieves the canonical Stripe Checkout session and checks
completion, payment state and Stripe mode. It verifies one unit of the configured
Price, its base currency/unit amount, and matching session/line-item totals.
Inclusive and exclusive tax can change the tax component without changing the
purchased UC. Discounts, shipping, extra quantities/items, incomplete tax
calculations, currency/mode mismatches and unexplained totals remain rejected.
Adaptive Pricing presentment amounts are not used to calculate credits.

## Real sandbox checks

| Case | Customer paid | Canonical total | Tax | UC granted | UC after refund |
| --- | --- | --- | --- | --- | --- |
| Exclusive test tax, AUD presentment | AUD 46.92 | GBP 24.00 | GBP 4.00 | 15 | 0 |
| Inclusive test tax, GBP | GBP 20.00 | GBP 20.00 | GBP 3.33 included | 15 | 0 |

Both payments were completed through Stripe's real browser Checkout with its
public test card, using the owned disposable fixture. Saved-payment information
was disabled. No real-money transaction or production tax setting was changed.
The 20% rate was synthetic arithmetic test data, not a tax determination.

The first Checkout showed AUD subtotal 39.10 plus tax 7.82. Stripe's completed
session, invoice and charge consistently retained the GBP accounting amounts;
the session and charge separately recorded AUD 46.92 presentment. The second
Checkout was switched to GBP in the UI and showed its GBP 3.33 included tax.

An isolated candidate webhook accepted only the two owned sandbox Checkout IDs
and this run's fixture refunds. Both genuine signed completion events were
replayed twice: one 15-UC lot per purchase, no duplicate grant. Both charges were
fully refunded and genuine refund events replayed twice: zero remaining credits,
all four candidate event records processed without errors. The existing
inclusive-tax path and candidate shared the idempotent grant identity.

All 86 webhook Node tests passed, including 34 new amount/payment-state cases.
The isolated candidate deployed and executed successfully. Its webhook was
disabled, function and temporary secret removed, and synthetic tax rates archived
after testing. Audit records remain; the fixture ended with zero available UC.

## Scope and release

Central production handlers were not replaced. The original deployed exclusive
tax event remains failed until normal rollout/reprocessing; its owned purchase
was already reconciled and refunded by the candidate. Do not relabel that old
event as a production pass.

These are actual Checkout, currency, tax arithmetic and entitlement checks, not
an ordinary signed-in application Checkout/return test. Automatic jurisdictional
tax determination and production tax registrations are outside this change.
Normal-account return/reload and customer-facing plan changes remain point-3 work.

Private evidence: point-3-tax-currency-proof.json, point3-tax-currency-20260920.json,
point3-tax-webhook-20260920.json and their scripts in the session TaskRecovery
directory. No credentials or Checkout URLs are committed.

Stripe reference: [tax behavior](https://docs.stripe.com/tax/products-prices-tax-codes-tax-behavior).
