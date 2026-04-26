# Performance and SEO Plan

> Parent: [Site Shell Plan](../Site%20Shell%20Plan.md)
> Status: **TODO**

## Purpose

Make the site fast, indexed, sharable, and accessible. Budgets enforced in CI; never regressions.

## 1. Source of Truth

- `.lighthouserc.json` — perf budgets.
- `src/templates/shell.html` — `<head>` partials for SEO + OG.
- `scripts/build-seo.mjs` — sitemap, robots.txt, structured data injection.

## 2. Build Pipeline

```
all generators ─▶ build-seo.mjs ─▶ dist/sitemap.xml
                                ─▶ dist/robots.txt
                                ─▶ injects per-page <head> meta + structured data
```

## 3. Runtime Surface

`/sitemap.xml`, `/robots.txt`.

## 4. UI Surface

OG cards on Slack, Twitter, LinkedIn previews.

## 5. Risk Research

| # | Area | Finding | Mitigation |
|---|------|---------|------------|
| 1 | Lighthouse flakiness | Scores vary ±5% between runs | 5 runs, median; budget gives 200 ms LCP headroom. |
| 2 | Inter font CLS | FOUT shifts text | Already mitigated via `display: block` + visibility hide pattern in index.html. |
| 3 | Brain canvas LCP | Canvas counts as LCP element on `/` | Use `fetchpriority="high"` on first-paint hero text instead. |
| 4 | Sitemap drift | Forgetting routes | Generated automatically from all build outputs. |
| 5 | Structured data correctness | Google rejects malformed JSON-LD | Schema.org validator step in CI. |

## 6. File Layout

```
.lighthouserc.json                       # — TODO
scripts/build-seo.mjs                    # — TODO
src/templates/partials/seo-head.html     # — TODO
src/templates/partials/structured-data.html  # — TODO
dist/sitemap.xml                          # — TODO
dist/robots.txt                            # — TODO
```

## 7. Configuration

Lighthouse budgets (excerpt):

```json
{
  "categories:performance":   ["error", { "minScore": 0.90 }],
  "categories:accessibility": ["error", { "minScore": 0.95 }],
  "categories:best-practices": ["warn",  { "minScore": 0.95 }],
  "categories:seo":            ["error", { "minScore": 0.95 }],
  "largest-contentful-paint": ["error", { "maxNumericValue": 1500 }],
  "cumulative-layout-shift":  ["error", { "maxNumericValue": 0.05 }],
  "total-blocking-time":      ["error", { "maxNumericValue": 200 }]
}
```

Structured data per page type:

```json
{
  "@context": "https://schema.org",
  "@type": "TechArticle",
  "headline": "list_rooms",
  "applicationCategory": "BIM",
  "operatingSystem": "Windows + Revit 2021–2026"
}
```

## 8. Workflow

Each PR runs Lighthouse against changed pages → blocked if any page fails any budget.

## 9. Bugs/Issues

_None — TODO._

## 10. Tests

| Test | Description | Status |
|------|-------------|--------|
| Sitemap covers every page | Diff against `dist/**/*.html` | **TODO** |
| OG card valid | Twitter validator + LinkedIn inspector | **TODO** |
| Structured data valid | Google Rich Results Test | **TODO** |
| Perf budget on cold cache | LH on Slow 3G CPU 4× throttle | **TODO** |

## Quick Reference

| Artefact | Status |
|----------|--------|
| SEO generator + budgets + sitemap + structured data | **TODO** |
