# Offline payment simulation

<!-- #region ADELPHOS-SESSION 2026-09-20/payment-simulation/01a0b8b9 -->
`simulate-payments.cjs` runs maintained billing tests and emits an explicitly
simulated receipt. `simulation-no-network.cjs` prevents fixture tests from
accidentally reaching real services. These scripts never grant credits or
pretend a simulated transaction is a real customer payment.
<!-- #endregion ADELPHOS-SESSION 01a0b8b9 -->
