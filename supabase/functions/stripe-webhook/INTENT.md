# Stripe webhook ownership

Verify Stripe signatures and apply central licensing entitlements from real payments. Invoice price resolution supports legacy and current Stripe event shapes, and selects the charged plan when upgrades credit the previous plan. Hidden sandbox plans are restricted to their designated verification identity.

`010-resolve-invoice-price.ts` owns invoice price resolution; `020-test-invoice-price.cjs` covers version compatibility and ambiguous invoice rejection. Shared verification identity guards live in `../_shared/010-guard-billing-verification.ts`.
