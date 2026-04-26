# Generators Plan

> Parent: [Automation Pipeline Plan](../Automation%20Pipeline%20Plan.md)
> Status: **TODO** — `scripts/` directory doesn't exist yet.

## Purpose

Turn `data/` artefacts into HTML pages, JSON manifests, and search indexes. Every script is small (one responsibility), idempotent, and reproducible (no clocks, no randomness).

## 1. Source of Truth

`data/registry.json`, `data/skill_manifest.json`, `data/skills/*.md`, `data/rest_api_registry.json`, `data/version.json`, `data/demos.yaml`, `data/resources.yaml`, `data/downloads.yaml`, `data/examples/*.yaml`.

## 2. Build Pipeline — Generator Inventory

| # | Script | Inputs | Outputs | Status |
|---|--------|--------|---------|--------|
| 1 | `build-tool-pages.mjs` | `data/registry.json`, `data/examples/*.yaml`, `templates/tool-page.html` | `dist/docs/tools/<name>.html` × 190 | **TODO** |
| 2 | `build-skill-pages.mjs` | `data/skill_manifest.json`, `data/skills/*.md`, `templates/skill-page.html` | `dist/docs/skills/<slug>.html` | **TODO** |
| 3 | `build-bridge-pages.mjs` | `data/registry.json` | `dist/docs/bridges/<bridge>.html` × 6 | **TODO** |
| 4 | `build-api-reference.mjs` | `data/rest_api_registry.json`, `data/examples/*.yaml` | `dist/docs/api/<command>.html` | **TODO** |
| 5 | `build-openapi.mjs` | `data/rest_api_registry.json` + parent | `dist/api/openapi.json` | **TODO** |
| 6 | `build-api-validator.mjs` | `data/rest_api_registry.json` | `supabase/functions/commands/validator.generated.ts` | **TODO** |
| 7 | `build-content-pages.mjs` | `src/content/**/*.md` | `dist/<route>/index.html` | **TODO** |
| 8 | `build-changelog.mjs` | git log + tags | `dist/docs/changelog/index.html` | **TODO** |
| 9 | `build-demo-cards.mjs` | `data/demos.yaml`, `data/registry.json` | `dist/demos/<slug>.html` + partials | **TODO** |
| 10 | `build-resources.mjs` | `data/resources.yaml` | `dist/resources/<slug>.html` | **TODO** |
| 11 | `build-downloads.mjs` | GitHub Releases API + `data/downloads.yaml` | `dist/downloads/<product>.html` + `dist/downloads/version.json` | **TODO** |
| 12 | `build-search-index.mjs` | All of the above (collects entries) | `dist/docs/search-index.json` | **TODO** |
| 13 | `build-seo.mjs` | All generated routes | `dist/sitemap.xml`, `dist/robots.txt`, OG partials | **TODO** |
| 14 | `generate-plan-tree.mjs` | `BUILD WEB Plan/` filesystem | inline injection in `BUILD WEB Plan/Project Structure Plan.md` | **TODO** |

## 3. Runtime Surface

None — build-time only.

## 4. UI Surface

Each script can be invoked with `--watch` for local development; logs are colour-coded and quiet on success.

## 5. Risk Research

See parent §5 (rows #5, #6, #8, #9). Specific to generators:

- Reproducibility: never call `Date.now()` inside a generator; use `data/version.json.generatedAt`.
- Performance: parallelise file writes (target ≤ 5 s for full site at 500 tools).
- Schema validation: every generator validates its inputs against the schemas before producing output.

## 6. File Layout

```
scripts/
    build-tool-pages.mjs                  # — TODO
    build-skill-pages.mjs                 # — TODO
    build-bridge-pages.mjs                # — TODO
    build-api-reference.mjs               # — TODO
    build-openapi.mjs                     # — TODO
    build-api-validator.mjs               # — TODO
    build-content-pages.mjs               # — TODO
    build-changelog.mjs                   # — TODO
    build-demo-cards.mjs                  # — TODO
    build-resources.mjs                   # — TODO
    build-downloads.mjs                   # — TODO
    build-search-index.mjs                # — TODO
    build-seo.mjs                         # — TODO
    generate-plan-tree.mjs                # — TODO
    lib/
        registry.mjs                       # shared loader     — TODO
        renderer.mjs                       # markdown + Shiki   — TODO
        sanitiser.mjs                      # — TODO
        slug.mjs                            # — TODO
        link-rewrite.mjs                    # *.md → /docs/skills/<slug> — TODO
```

## 7. Configuration

`scripts/lib/config.mjs`:

```js
export const CONFIG = {
  outputDir: "dist",
  templatesDir: "templates",
  baseUrl:  "https://adelphos.ai",
  brand:    { primaryColor: "#156082" }
};
```

## 8. Workflow

```bash
npm ci
npm run build           # runs all 14 generators in dependency order
npm run build:watch     # rebuild on data/ or src/ change
npm run lint:dist       # broken-link check + a11y + lighthouse
```

## 9. Bugs/Issues

_None — TODO._

## 10. Tests

| Test | Description | Status |
|------|-------------|--------|
| Each generator produces expected count | Fixture data → assert `ls dist/...` count | **TODO** |
| Reproducible | Build twice → `git diff dist/` empty | **TODO** |
| Schema validation fails loudly | Inject malformed data → exit non-zero with clear error | **TODO** |
| Performance budget | Full build ≤ 5 s on CI runner | **TODO** |

## Quick Reference — Build Status Summary

| Artefact | File | Tier | Status |
|----------|------|------|--------|
| 14 generator scripts | `scripts/build-*.mjs`, `generate-plan-tree.mjs` | Internal | **TODO** |
| 5 lib modules | `scripts/lib/*.mjs` | Internal | **TODO** |
| 5 page templates | `templates/*.html` | Internal | **TODO** |
| **Total** | | | **0 Built / 24 TODO** |
