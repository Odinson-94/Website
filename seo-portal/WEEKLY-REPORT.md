# Weekly SEO email

Sundays at **09:00 Australia/Perth**, from **noreply@adelphos.ai** to
**jordan.jones@adelphos.ai**. The first report can be sent by invoking the same
authenticated production function. Email-to-chat and paid marketing are out of scope.

The existing Supabase project schedules `seo-weekly-report` using pg_cron and
pg_net. It reads stored `seo_gsc_daily` observations and sends through the existing
Adelphos Microsoft application. No paid rank provider or AI model is invoked.
It runs independently of the desktop and does not rebuild or restart Chat.

The report covers the latest available seven days, compares the preceding seven,
lists observed queries with impression-weighted positions, and suggests focused
improvements. Missing and stale data are labelled. These are query/page totals,
not a claim to match all Search Console property totals.

## Configuration and deployment

Edge secrets: `SEO_REPORT_CRON_SECRET`, `SEO_REPORT_MS_TENANT`,
`SEO_REPORT_MS_CLIENT`, `SEO_REPORT_MS_SECRET`. Use the protected existing company
connection to configure Microsoft credentials; never commit them or log tokens.
Store the same cron secret in Supabase Vault as `seo_weekly_report_token`.
Deploy only `seo-weekly-report` with gateway JWT verification disabled: the
handler verifies its own dedicated secret before any read or write, and accepts
POST only. The sender and recipient are fixed in code, so this is not a mail relay.
Apply only `20260930030000_seo_weekly_report.sql`, not unrelated pending migrations.

The private delivery ledger has one entry per Perth Sunday week and recipient.
Concurrent or repeated calls skip an existing entry. Failures before dispatch
release the claim. Uncertain dispatches remain recorded for reconciliation;
check the sender's Sent Items before clearing them. Microsoft 202 means accepted,
not proof of inbox delivery. `preparing` records stranded by a runtime crash also
require inspection before removal. Inspect `cron.job_run_details` and
`net._http_response` when investigating transport failures.

Tests: `node --test seo-portal/weekly-report.test.mjs`.
To stop future emails, unschedule only `adelphos-seo-weekly-report` in Supabase.
