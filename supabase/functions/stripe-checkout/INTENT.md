# Intent — stripe-checkout

Create hosted checkout for a server-verified identity and server-owned plan/price. Collect billing address and tax ID with explicit customer update permission.

Secrets are supplied by the deployment environment; never store credentials or session URLs here.


2026-09-19 · Session 01a0b8b9: Sales publishes one revision of app prices, the GBP credit-pack price and model/tier token rates. The public API projects only published customer prices (contract 3). Credit-meter quotes use the same configured rate reader as reservations and preserve the quote timestamp through settlement. New top-up checkouts resolve the published versioned plan; historical plan/Price rows remain intact for pending webhooks.
