# Changelog

- 2026-09-17: Reconciled local source with deployed model compatibility and deployed factor-aware lookup. Applied separate schema and prospective 4x/20x activation migrations against the existing central licensing project. Real central five-component reserve/settle/refund/idempotency checks pass for both factors; prior rates retained.

- 2026-10-09: Link all 15 configured model identifiers to effective central rates; replace gateway/database allowlists; add missing Sales price products while preserving unpublished edits. Verified 45 rolled-back settlements, 45 live reserve/release checks and 67 handler tests.
