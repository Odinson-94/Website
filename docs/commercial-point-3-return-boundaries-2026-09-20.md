# Authenticated billing return boundaries

<!-- #region ADELPHOS-SESSION 2026-09-20/point3-return/01a0b8b9 -->
<!-- CHANGELOG 2026-09-20: Record real Starlink return-route checks.
what: Verify account state is read from the server and external return destinations are refused.
why: Separate return-page routing acceptance from an actual ordinary-account payment journey. -->

The existing Starlink browser session on local port 3089 displayed the internal
director plan, 138.54 included UC and zero top-up UC. These tests used the real
in-app browser, without mocked API responses, injected authentication or changes
to Starlink's licence.

| Case | Expected | Observed | Result |
| --- | --- | --- | --- |
| Open billing with a manually supplied success query | Account plan and credits remain server-backed | Internal-Director, 138.54 UC | PASS |
| Reload that success return | No duplicate credit grant | Still 138.54 UC | PASS |
| Open billing with a cancellation query | Account unchanged | Internal-Director, 138.54 UC | PASS |
| Supply an external return destination and close Billing | Stay within the app | Navigated to local `/c/new`, not the external destination | PASS |

These are return-route and URL-parameter boundary tests. No payment was made for
Starlink, and the informational return banner is not evidence that Stripe
completed or canceled a payment. Ordinary customer Checkout, post-payment
return/reload, failure/pending and cross-account acceptance remain open.

A separate owned GBP20 sandbox Checkout was prepared with the published
[Stripe decline card](https://docs.stripe.com/testing#declined-payments), synthetic
billing details and saving details switched off. It remains unsubmitted pending
the user confirmation required for its Terms checkbox; no decline verdict is
claimed. The controlled fixture started on Free with zero available credits.

Private receipts: `point-3-starlink-return-proof.json` and
`point-3-checkout-failure-ui.json` in the session TaskRecovery directory. The
Checkout URL is private and must not be committed. Production deployment remains
separate from these acceptance receipts.

<!-- #endregion ADELPHOS-SESSION 01a0b8b9 -->
