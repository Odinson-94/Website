# Report catalogue publication migration

<!-- #region ADELPHOS-SESSION 01a0b8b9 -->
2026-09-19: 20260919030000_report_price_publication.sql adds an unpublished Cable/SAP/Lighting catalogue, immutable action receipts, validation, an atomic revision-checked save/publish RPC and a published-only reader. Seed 20 UC is a proposed draft, with no invented batches. Existing billing tables, wallets, licences, Stripe prices and receipts are untouched. Exact migration SHA-256 eb41593f50bd6dc17495a904333a1b6ca3441b52c9df26aab898367a5dcacfed was rehearsed with rollback and applied to central with its migration-history receipt on 19 September. Published remains null. The CLI's historical short migration-version mismatch was not repaired; only this exact additive migration was applied through the documented management query API and recorded in the same transaction.
<!-- #endregion -->

2026-09-19: 20260919040000 adds the complete 34-app metadata registry and expands the private draft through the audited RPC, preserving current prices and seeding new report prices at the approved 20 UC. Validation rejects missing/unknown apps and fees on included/metered/internal entries. Versioned public output includes every public app. Existing published snapshots and receipts are preserved; nothing is published by migration.
