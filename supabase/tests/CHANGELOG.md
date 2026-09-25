# Local SQL lifecycle regression

2026-09-25 p06: `20260925090000_cli_key_lifecycle.sql` runs against the real migration in a separate disposable local proof database, inside rollback. It validates owner/staff authority, exact action replay, conflict refusal, masked-fragment constraints, no secret in audit and audit-failure atomic rollback. It does not seed product accounts or mutate the existing acceptance dataset. Migration provenance and runtime application are separate evidence; this test is not a claim that the whole historical migration chain replays cleanly.
