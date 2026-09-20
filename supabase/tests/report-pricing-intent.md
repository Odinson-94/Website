# Report catalogue transaction tests

<!-- #region ADELPHOS-SESSION 01a0b8b9 -->
2026-09-19: report-price-publication.sql exercises the real catalogue functions against a newly migrated isolated database and rolls back all fixture changes. Covers malformed amounts/tiers, draft privacy, publication, stale versions, repeated request IDs and private/immutable grants. Requires an unpublished seed, so it must not be run as an acceptance mutation against an active published catalogue.
<!-- #endregion -->

2026-09-19: all-app-price-catalogue.sql proves complete coverage, new-app prices and discounts, draft privacy, replay/stale rejection, public projection and role boundaries inside a rollback transaction.

2026-09-20: report-project-entitlements.sql runs only inside an outer rollback transaction. It covers quote isolation, exact licence identity, stale price refusal, one receipt, free retries and edits, changed future prices, zero-credit refusal and funded retry, included/top-up allocation and browser role boundaries. Fixture credits and catalogue changes do not survive. This is database regression evidence, not UI acceptance.


## 2026-09-20 — Shared durable project purchases

One entitlement per owning tenant, app and project retains its original payer and purchase time. Current server-authorised members reuse it across later edits without a second debit. A project lock serialises different payers, with service-role-only RPC access. Existing export RPCs remain compatible. Transactional tests cover all seven manual products, insufficient funds, retry/edit/member reuse and unchanged payer attribution; fixtures roll back.
