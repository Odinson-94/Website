# Website signup and billing handoff

Uses the same verified Chat account. Pricing choices enter the email-code login/signup UI, retain the chosen plan, then exchange a one-time, PKCE-bound code for an HttpOnly encrypted website session. Stripe Checkout receives the authenticated account identity from the server. No browser-provided email, amount or price is trusted.

The pending state cookie lasts 15 minutes to allow the 10-minute email-code flow. The issued central handoff code remains short-lived and single-use. Cookies are Secure and SameSite=Lax. Required runtime values are ADELPHOS_SITE_URL, ADELPHOS_CHAT_URL, ADELPHOS_CHECKOUT_ORIGINS, ADELPHOS_CALCULATOR_SESSION_SECRET, ADELPHOS_BILLING_FUNCTIONS_URL, ADELPHOS_BILLING_BRIDGE_TOKEN and ADELPHOS_METERING_SERVICE_TOKEN; secrets stay outside Git.

Signup links target https://chat.adelphos.ai/register. Deployment must serve the corresponding Chat release before publishing customer links.

<!-- #region ADELPHOS-SESSION 01a0b8b9 -->
2026-09-19: `report-prices.js` serves only the central published report catalogue through `adelphos_published_report_prices`. Uses the existing server-only SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY (Adelphos aliases accepted). No client token or account is required for published prices; drafts, actor identities and audit reasons never reach this endpoint. Responses prohibit browser/CDN caching and expose contractVersion 1 for the dashboard publication readiness check. Failure never substitutes hard-coded prices. `report-prices.test.cjs` tests the public projection and failure boundaries. Stripe checkout remains separate.
<!-- #endregion -->

2026-09-19: report-prices.js contract version 2 returns every public app in the central catalogue, with explicit pricing mode/name/unit and a strict field projection. Internal apps and private metadata are excluded; non-report entries have no invented numeric fee. API tests cover an additional report app, included model and internal omission.


2026-09-19 · Session 01a0b8b9: Sales publishes one revision of app prices, the GBP credit-pack price and model/tier token rates. The public API projects only published customer prices (contract 3). Credit-meter quotes use the same configured rate reader as reservations and preserve the quote timestamp through settlement. New top-up checkouts resolve the published versioned plan; historical plan/Price rows remain intact for pending webhooks.
