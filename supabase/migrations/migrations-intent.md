---
name: migrations
folder: supabase/migrations
area: billing
summary: Link every configured model to central billing and Sales pricing.
features:
  - Configured AI models use their own centrally managed prices.
public: false
status: active
last-edited: 2026-10-09
---

# Billing migration ownership

2026-10-08, session 9bb361ac: `20261008090000_configure_jason_sol_billing.sql` extends the inspected reservation model gate for Jason's existing Sol model and adds prospective Sol rate rows. Existing factors, other models, historical reservations and account balances remain intact. The migration refuses a changed gate or duplicate Sol configuration. Rehearse inside a rolled-back transaction before applying; deploy the matching credit-meter resolver only after rate/gate verification.

2026-10-09 / 74d61b2e: 20261009090000_link_configured_model_billing.sql adds only absent currently effective rate cells for the audited model census. Standard, schematic and helper factors remain 4x/20x/1.10x. Replaces the inspected exact reservation model gate with a rate-card lookup. Applied after 45 rolled-back reserve/settle checks; existing rate records and settlement function verified unchanged. No balance, plan or usage-limit edits.

2026-10-09 / 74d61b2e: 20261009100000 links 199 missing effective model/component/factor products into Sales pricing. Provider rates, existing product identities and every existing draft/published value were preserved. The catalogue baseline matches the current-rate authority; rollback, insertion and idempotency checks passed. The rate migration recognises both inspected predecessor gates and an already-applied repair, so it remains compatible with the published September migration.
