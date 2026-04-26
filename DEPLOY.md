# Deploy — Vercel

> One-page operational note for moving adelphos.ai from SiteGround to Vercel.

## What changes

- **Hosting**: SiteGround → Vercel (for adelphos.ai).

## What does not change

- Python generator scripts (run identically — they're invoked by `adelphos_CLI auto-all`).
- Azure VM + FastAPI + React app + SQLite — untouched.
- `document-controller.adelphos.ai` DNS still points to Azure.
- Any Supabase / BUILD MEP infrastructure — separate project, unrelated.

## Files added for Vercel

- `vercel.json` — build command, output directory, security headers, cache rules, redirects.
  - Build command: `node scripts/adelphos_CLI.mjs auto-all`
  - Output directory: `.` (Vercel serves the repo root; `/dist/` and other static folders stream from there)
  - Redirects: `/` → `/dist/index.html`, plus shortcuts for sitemap/robots/llms.txt
  - Cache: 1-year immutable on assets, 24-hour edge cache on HTML

## Half-day deploy plan

1. **Get the site files into a Git repo** (GitHub or GitLab).
   ```powershell
   git init
   git add -A
   git commit -m "Initial Adelphos AI website"
   git remote add origin git@github.com:adelphos-ai/website.git
   git push -u origin main
   ```

2. **Connect Vercel to the repo**.
   - Vercel dashboard → New Project → Import the GitHub repo.
   - Vercel auto-detects `vercel.json`. Build command and output directory will pre-populate.
   - First build runs `node scripts/adelphos_CLI.mjs auto-all` and emits everything under `/dist/` plus the existing static `/about/`, `/contact/`, `/roadmap/`, etc.
   - Verify the preview deploy at `https://<project-name>.vercel.app` looks correct.

3. **Add `adelphos.ai` as a custom domain in Vercel**.
   - Vercel → Project Settings → Domains → Add → `adelphos.ai`.
   - Vercel shows you which DNS records to update (typically an A record for the apex + a CNAME for `www`).

4. **Update DNS at SiteGround / your registrar**.
   - Point the A record for `adelphos.ai` to Vercel's IP (Vercel will give you the exact value — usually `76.76.21.21`).
   - Point the CNAME for `www.adelphos.ai` to `cname.vercel-dns.com`.
   - **Do not touch** the CNAME / A record for `document-controller.adelphos.ai` — that stays pointing at Azure.

5. **Wait for DNS propagation** (typically 15–60 minutes; up to 24 hours worst case).
   - Verify with `dig adelphos.ai +short` or https://dnschecker.org.
   - Vercel issues a free SSL certificate automatically once DNS resolves.

6. **Smoke-test on the live domain**.
   - Visit `https://adelphos.ai/` — should land on the new home page.
   - Visit `https://adelphos.ai/dist/apps/index.html` — apps inventory.
   - Visit `https://adelphos.ai/sitemap.xml` — should serve from `/dist/sitemap.xml`.
   - Visit `https://adelphos.ai/llms.txt` and `/robots.txt`.
   - Verify `https://document-controller.adelphos.ai/` still hits Azure.

7. **Cancel SiteGround** (or hold for 30 days as a safety net before final cancellation).

## CI / re-deploys

After the initial setup, every push to `main` triggers a Vercel build:

```
git push   →   Vercel build (auto-all)   →   preview URL   →   promote to production
```

PRs get their own preview URL automatically. Merging to `main` deploys to `adelphos.ai`.

## When MEPBridge syncs land

The cross-repo `repository_dispatch` workflow (see `handoff/MEPBridge/INTEGRATION_PLAN.md`)
opens a PR on this repo with refreshed `data/registries/*.json`. Merging the PR triggers
a Vercel deploy that regenerates every command/tool page automatically.

## Free tier sizing

Vercel's free tier covers:
- 100 GB bandwidth/month (the entire site is < 5 MB compressed; 2000 page views = ~0.01 GB)
- Unlimited static deploys
- Free SSL
- Edge network in 100+ locations
- Comfortably covers Adelphos AI traffic for the foreseeable future.

## Rollback

If something goes wrong:
- Vercel keeps every prior deploy. One-click rollback in the dashboard (~5 seconds).
- DNS rollback to SiteGround takes ~1 hour to propagate.
