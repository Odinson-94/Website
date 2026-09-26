# Stripe webhook ownership

Verify Stripe signatures and apply central licensing entitlements from real payments. Invoice price resolution supports legacy and current Stripe event shapes, and selects the charged plan when upgrades credit the previous plan. Hidden sandbox plans are restricted to their designated verification identity.

`010-resolve-invoice-price.ts` owns invoice price resolution; `020-test-invoice-price.cjs` covers version compatibility and ambiguous invoice rejection. Shared verification identity guards live in `../_shared/010-guard-billing-verification.ts`.

`090-verify-checkout-amounts.ts` verifies exactly one purchased catalogue unit
against Stripe's canonical session and line-item totals. Inclusive/exclusive
taxes and Adaptive Pricing display amounts must not change the UC grant.
Discounts, shipping, wrong currency/mode, incomplete tax calculations and
unpaid or incomplete sessions fail closed. `100-test-checkout-amounts.cjs`
covers this boundary and the actual entitlement handler.

<!-- #region ADELPHOS-SESSION 2026-09-20/payment-simulation/01a0b8b9 -->
`110-test-simulated-plan-checkout.cjs` covers each plan's actual Checkout and
invoice handler commands using offline adapters. The simulation runner keeps
this evidence distinct from Stripe delivery and durable database settlement.
<!-- #endregion ADELPHOS-SESSION 01a0b8b9 -->

2026-09-26: Support app subscriptions are separate from base plans. Add-on checkout verifies registered customer and monthly catalogue price, refuses duplicates and preserves existing base subscriptions. Signed webhook writes service-only app licences and never grants base credits for Support. Local Stripe regression tests pass; live activation requires the approved Support Price and deployment.
