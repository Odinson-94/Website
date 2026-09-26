# Payment simulation and final payment handoff

<!-- #region ADELPHOS-SESSION 2026-09-20/payment-simulation/01a0b8b9 -->
20 September 2026: the user explicitly deferred actual payment until the very
last release test and requested a repeatable simulation now.

Run `node scripts/simulate-payments.cjs --output payment-simulation.json` with
`ADELPHOS_TYPESCRIPT_PATH` pointing to an installed TypeScript module. The runner
loads the production billing handlers through the existing fixture tests,
disables network transports and passes no service credentials to its child.
It does not touch Stripe, Supabase, browser sessions or real customer balances.
Its receipt always identifies itself as `OFFLINE_PAYMENT_SIMULATION`.

Observed result: **159 tests passed, zero failed/skipped/cancelled**. Coverage
includes Everyday, Standard, Business and PAYG Checkout dispatch; exact account
binding; unpaid/open/expired/mismatched purchase refusal; canonical amounts,
tax and currency; provider-state ordering; invoice periods; refund processing;
customer ownership; existing subscription routing and sandbox isolation.
These are handler/adapter tests, not proof of durable Postgres settlement or a
new browser purchase. The existing genuine Stripe sandbox receipts in the
portal, return-boundary, refund and tax records remain separate evidence.

Point 3's requested **interim simulation checkpoint is complete**. Full payment
acceptance remains deferred, not silently passed. At the very end of point 9,
use the actual ordinary customer account and the deployed candidate to prove
app → payment → return → exact licence/wallet → reload, then reconcile the
receipt and Sales. No real-money purchase is authorized by this document.
The actual Chat/Supabase release still requires its normal deployment receipt;
merging this test script does not deploy those handlers or migrations.
<!-- #endregion ADELPHOS-SESSION 01a0b8b9 -->
