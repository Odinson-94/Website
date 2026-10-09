---
name: credit-meter
folder: supabase/functions/credit-meter
area: billing
summary: Link every configured model to central billing and Sales pricing.
features:
  - Configured AI models use their own centrally managed prices.
public: false
status: active
last-edited: 2026-10-09
---

# Central billing model ownership

2026-10-09 / 74d61b2e: effective-dated rate records replace the gateway model allowlist. 040 is the 15-model audit census, not an admission gate. 020/030 prove all three factors, model attribution and refusal before RPC when rates are missing. Migration 20261009090000 supplies missing cells prospectively, retains existing rates and replaces the database model list. 45 rollback reserve/settle pairs passed; live reserve/release proof is saved in Adelphos Chat/output/billing-model-audit-20261009. Application delivery is a separate deployment.

The same model entries are linked into Sales pricing by 20261009100000; existing unpublished edits and historical rate rows are preserved.

Published September handler tests and compatibility exports are retained; all identifiers are validated by effective central rates.
