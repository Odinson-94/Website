# Intent — stripe-checkout

Create hosted checkout for a server-verified identity and server-owned plan/price. Collect billing address and tax ID with explicit customer update permission.

For subscription purchases, verify the bound Stripe customer and inspect its canonical subscription history. If any nonterminal subscription exists, return a Billing Portal session for that customer instead of creating another subscription Checkout. One-time credit top-ups remain available. Provider or ownership failures must not fall through to new subscription creation.

Use the mode-specific configured portal policy when provided, shared with the
management route. Validate that explicit policy before opening a session; never
fall back to the default if an explicit configuration is invalid or unavailable.

Secrets are supplied by the deployment environment; never store credentials or session URLs here.


2026-09-19 · Session 01a0b8b9: Sales publishes one revision of app prices, the GBP credit-pack price and model/tier token rates. The public API projects only published customer prices (contract 3). Credit-meter quotes use the same configured rate reader as reservations and preserve the quote timestamp through settlement. New top-up checkouts resolve the published versioned plan; historical plan/Price rows remain intact for pending webhooks.

2026-09-26: Support app subscriptions are separate from base plans. Add-on checkout verifies registered customer and monthly catalogue price, refuses duplicates and preserves existing base subscriptions. Signed webhook writes service-only app licences and never grants base credits for Support. Local Stripe regression tests pass; live activation requires the approved Support Price and deployment.
