# Authenticated billing return boundaries

<!-- #region ADELPHOS-SESSION 2026-09-20/point3-return/01a0b8b9 -->
<!-- CHANGELOG 2026-09-20: Record real Starlink return-route checks.
what: Verify account state is read from the server and external return destinations are refused.
why: Separate return-page routing acceptance from an actual ordinary-account payment journey. -->
<!-- CHANGELOG 2026-09-20: Complete declined, pending-authentication, failed-authentication and abandoned sandbox checkout cases. -->

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
completed or canceled a payment. Ordinary customer app-to-Checkout,
post-payment return/reload and cross-account acceptance remain open.

A separate owned GBP20 sandbox Checkout was created through the central billing
API, using the existing controlled fixture, synthetic billing details and saving
details switched off. After the user's confirmation of the prepared submission,
the real browser used published
[Stripe test cards](https://docs.stripe.com/testing#declined-payments).

| Sandbox payment case | Expected | Observed | Result |
| --- | --- | --- | --- |
| Generic card decline | Visible decline; unpaid; no credits | Decline shown; `card_declined` / `generic_decline`; GBP0 received; Free and zero UC | PASS |
| Authentication challenge pending | No payment completion or premature grant | 3D Secure test challenge visible; `requires_action`; unpaid; GBP0 received; Free and zero UC | PASS |
| Authentication explicitly failed | Customer can retry; no credits | Authentication error shown; `requires_payment_method` / `payment_intent_authentication_failure`; Free and zero UC | PASS |
| Abandon and expire unpaid Checkout | Cancellation destination; no grant | Back link reached configured cancellation URL; owned session expired; fixture remained Free and zero UC | PASS |

The failure cases reused the same owned Checkout. The initial generic decline
receipt was preserved before attempting authentication, and the pending receipt
was preserved before failing the challenge. No successful payment or financial
credit grant occurred. Expiring the session was explicit cleanup after leaving
the page; clicking Back alone is not claimed to expire a Stripe session.

The Checkout was API-created and its hosted return reached an existing browser
session, not a normal signed-in application fixture. These results do not close
ordinary customer app-to-Checkout, post-payment return/reload or cross-account
acceptance. Pending here specifically means unfinished card authentication;
asynchronous non-card settlement is outside this test.

Private receipts: `point-3-starlink-return-proof.json`,
`point-3-checkout-failure-ui.json`, `point-3-checkout-decline-proof.json`,
`point-3-checkout-pending-proof.json` and
`point-3-checkout-authentication-failure-proof.json` in the session TaskRecovery directory. The
Checkout URL is private and must not be committed. Production deployment remains
separate from these acceptance receipts.

<!-- #endregion ADELPHOS-SESSION 01a0b8b9 -->
