# Published report price rendering

<!-- #region ADELPHOS-SESSION 01a0b8b9 -->
2026-09-19: report-prices.js reads only /api/billing/report-prices, renders prices with textContent, refreshes without rebuilding the static page and clears stale values on failure. report-prices.test.cjs tests the actual renderer with jsdom from the existing Chat workspace (NODE_PATH points at its node_modules). No public hard-coded fallback price. Batch totals are presentation only; purchases require the separately verified report billing path.
<!-- #endregion -->
