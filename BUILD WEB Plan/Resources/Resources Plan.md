# Resources Plan

> Parent: [Project Structure Plan](../Project%20Structure%20Plan.md)
> Location: `BUILD WEB Plan/Resources/`
> Status: **TODO** — nav still says "Resources — Coming Soon".

---

## Purpose

Replace the homepage "Resources — Coming Soon" pill with a metadata-driven download centre. Free Revit families, free templates, free asset data, distributed via Cloudflare R2 / Supabase Storage. Driven by a single YAML file — adding a resource is one PR.

---

## Children (H3)

| Plan | Status | Summary |
|------|--------|---------|
| [Free Families Plan](Free%20Families/Free%20Families%20Plan.md) | **TODO** | Parametric family packs (RFA), per Revit year. |
| [Free Templates Plan](Free%20Templates/Free%20Templates%20Plan.md) | **TODO** | RTE/RVT starter templates. |
| [Free Asset Data Plan](Free%20Asset%20Data/Free%20Asset%20Data%20Plan.md) | **TODO** | CSV/JSON asset databases (radiator schedules, fitting catalogues). |

---

## 1. Source of Truth

`data/resources.yaml`:

```yaml
- slug: jpa-radiator-family-pack-v3
  name: "JPA Radiator Family Pack"
  category: families
  description: "26 parametric LST and standard radiator families. Revit 2021–2026."
  download_url: "https://r2.adelphos.ai/families/radiator-pack-v3.zip"
  size_mb: 47
  license: "CC-BY-NC-4.0"
  license_url: "https://creativecommons.org/licenses/by-nc/4.0/"
  thumbnail: "/images/resources/radiator-pack.png"
  added: 2026-04-15
  revit_years: [2021, 2022, 2023, 2024, 2025, 2026]
  tags: [heating, radiators, lst]
```

---

## 2. Build Pipeline

```
data/resources.yaml ─▶ build-resources.mjs ─▶ dist/resources/index.html
                                            ─▶ dist/resources/<slug>.html
                                            ─▶ entries in dist/docs/search-index.json
```

---

## 3. Runtime Surface

None. Direct download from R2. Optional analytics: signed URLs with `tracking_id` query param posted to Supabase on hit.

---

## 4. UI Surface

- `/resources/` — filterable grid (by category, Revit year, tag).
- `/resources/<slug>` — detail page with thumbnail, description, license, "Download" button.
- Header nav item replaces Coming Soon.

---

## 5. Risk Research — Known Issues & Pitfalls

| # | Area | Finding | Mitigation |
|---|------|---------|------------|
| 1 | Bandwidth on hot files | A 47 MB family pack downloaded 10k times = 470 GB | Cloudflare R2 has free egress; use it. Cap unauth downloads via signed URL TTL. |
| 2 | License attribution | Some assets sourced under CC-BY require attribution | YAML mandatory `license` + `license_url`; renderer shows badge. |
| 3 | Family corruption | Repackaged ZIPs lose folder structure | CI: open each ZIP, assert expected file tree before publish. |
| 4 | Discoverability | Resources hidden if not in search index | `build-search-index.mjs` ingests `data/resources.yaml`. |
| 5 | Stale download URLs | R2 bucket renamed → 404s | Use stable bucket name; CI link-checks all `download_url`s nightly. |

---

## 6. File Layout

```
data/resources.yaml                   # — TODO
scripts/build-resources.mjs           # — TODO
templates/resource-page.html          # — TODO
schemas/resources.schema.json         # — TODO
dist/resources/index.html             # — TODO
dist/resources/<slug>.html            # — TODO
```

---

## 7. Configuration

R2 bucket name + base URL in env: `RESOURCES_R2_BASE_URL=https://r2.adelphos.ai`.

---

## 8. Workflow

### Workflow: Add a new free family pack

1. Build the .zip locally; smoke-test in Revit 2021 + 2026.
2. Upload to R2 bucket `families/`; copy URL.
3. Add row to `data/resources.yaml` with thumbnail, license, size.
4. Add 240×160 thumbnail PNG to `images/resources/`.
5. PR; CI validates ZIP structure + URL reachability + schema.
6. Merge → live in <3 min; appears in search.

---

## 9. Bugs/Issues

_None — TODO._

---

## 10. Tests

| Test | Description | Status |
|------|-------------|--------|
| Schema valid | YAML passes schema | **TODO** |
| All download_urls 200 | Nightly CI link-check | **TODO** |
| ZIP structure | Each archive opens; required folders present | **TODO** |

---

## Quick Reference — Build Status Summary

| Artefact | File | Tier | Status |
|----------|------|------|--------|
| `data/resources.yaml` | as above | Public | **TODO** |
| `build-resources.mjs` | as above | Internal | **TODO** |
| Template | `templates/resource-page.html` | Internal | **TODO** |
| Schema | `schemas/resources.schema.json` | Internal | **TODO** |
| 5 initial families + 3 templates + 4 asset CSVs | R2 bucket | Public | **TODO** |
| **Total** | | | **0 Built / 4 + 12 assets TODO** |
