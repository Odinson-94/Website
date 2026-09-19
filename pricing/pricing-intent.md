---
name: Published report prices
folder: pricing
area: commercial
summary: Display current published report prices alongside the existing subscription plans.
features:
  - Report prices and batch discounts published from the sales dashboard.
public: true
last-edited: 2026-09-19
---

<!-- #region ADELPHOS-SESSION 01a0b8b9 -->
`index.html` adds a dedicated manual-report section. Existing subscription prices and checkout remain unchanged. `../js/report-prices.js` reads the public catalogue on load, refresh, visible-tab return and every visible minute. It displays no price before publication and clears stale prices on errors. The website API and UI must be deployed together before User & Sales can publish. This display does not prove that each export adapter settles the advertised project price; that remains acceptance point 1.
<!-- #endregion -->
