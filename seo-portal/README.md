# Adelphos SEO visibility portal

Private rank and Search Console tracking for the published Adelphos keyword pages.

## What is wired

- `../scripts/build-seo-watchlist.mjs` discovers published focus pages, explicit page intents and unambiguous toolbox-to-page keyword matches, then writes `../data/seo-keywords.generated.json`.
- `../api/seo/collect.js` upserts that watchlist and imports final Search Console query data. It can optionally record independent Google organic snapshots from DataForSEO.
- `../api/seo/data.js` returns a private, aggregated dashboard payload.
- `index.html` is the self-contained portal UI. It stores the portal token in session storage only.
- `../supabase/migrations/20260807193000_seo_visibility_portal.sql` creates private history tables with RLS enabled and no browser grants.

## Activate live collection

For the exact account workflow with direct links, use [LIVE_SETUP.md](./LIVE_SETUP.md).

1. Enable the Search Console API in the service account's Google Cloud project.
2. Add the service account `client_email` as a Full user of the exact `GSC_PROPERTY` in Search Console.
3. Give Codex the downloaded JSON key's local file path. Codex will finish the Vercel configuration and deployment.
4. The Vercel cron calls `/api/seo/collect` daily at 03:15 UTC.
5. Open `/seo-portal/`, enter `SEO_PORTAL_TOKEN`, then use **Run collection** whenever an extra refresh is needed.

## Optional independent rank checks

DataForSEO is not required. When its two credentials are absent, the portal
uses first-party Search Console positions and traffic only. Queries reported by
Google are shown even when they were not already in the generated watchlist. If independent SERP
checks are enabled later, `SEO_MAX_KEYWORDS_PER_RUN` caps paid tasks and
`SEO_SERP_DEPTH` is clamped to 10-100. Provider-reported cost is stored with
each run.

Regenerate the watchlist after publishing new intent pages:

```powershell
node scripts/build-seo-watchlist.mjs
```
