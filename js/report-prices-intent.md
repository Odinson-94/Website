# Published report price rendering

<!-- #region ADELPHOS-SESSION 01a0b8b9 -->
2026-09-19: report-prices.js reads only /api/billing/report-prices, renders prices with textContent, refreshes without rebuilding the static page and clears stale values on failure. report-prices.test.cjs tests the actual renderer with jsdom from the existing Chat workspace (NODE_PATH points at its node_modules). No public hard-coded fallback price. Batch totals are presentation only; purchases require the separately verified report billing path.
<!-- #endregion -->

2026-09-19: report-prices.js renders all public catalogue entries dynamically by name rather than a hardcoded three-app list. Usage and included models display explanatory labels, and all report prices/batches refresh together. Tests cover Building Generator and mixed models.

<!-- #region ADELPHOS-SESSION 2026-09-20/public-pricing/01a0b8b9 -->
CHANGELOG 2026-09-20: `report-prices.js` stops rendering internal provider/model token rates, including clearing the old container in cached HTML. Public app and credit prices still refresh from Sales publications. `report-prices.test.cjs` verifies that internal model names never render and that publishing works without token-rate data. Session: 01a0b8b9.
<!-- #endregion ADELPHOS-SESSION 01a0b8b9 -->
