# Changes

- 2026-09-20: Tax-added Checkout previously failed because its gross total exceeded the catalogue price. Retrieve canonical completed/paid Checkout state, verify the Price and quantity, and reconcile session totals with Stripe line items. Support inclusive/exclusive tax and Adaptive Pricing without granting credits for tax or conversion. Real AUD/GBP sandbox payments and signed duplicate events verified.

- 2026-09-17: Central sandbox payment reproduced paid checkout without credits: API 2026-06-24.dahlia moved invoice line prices to `pricing.price_details.price`. Resolve both formats and ignore negative prior-plan credits when identifying an upgrade. Added focused compatibility tests.
- 2026-09-17: Restrict hidden central verification plans to their designated test identity; normal public-plan behavior is preserved.
