# CI Gates Plan

> Parent: [Automation Pipeline Plan](../Automation%20Pipeline%20Plan.md)
> Status: **TODO**

## Purpose

Fail the build before bad changes reach production. Six categories of gate, each independently auditable.

## 1. Source of Truth

`.github/workflows/build-and-deploy.yml` (TODO).

## 2. Build Pipeline

| # | Gate | Tool | Triggers fail when |
|---|------|------|-------------------|
| 1 | Schema validation | `ajv` | `data/*.json` doesn't match `schemas/*.schema.json` |
| 2 | Broken link check | `lychee` | Any internal href returns 404 in `dist/` |
| 3 | Accessibility | `@axe-core/cli` against `dist/` via headless Chromium | a11y violation severity >= serious |
| 4 | Lighthouse perf | `@lhci/cli` with budget file | LCP > 1.5 s, CLS > 0.05, perf score < 90 |
| 5 | Reproducibility | Build twice + `git diff dist/` | non-empty diff |
| 6 | Internal-field leak | `jq 'has("filePath")'` on `dist/api/v1/registry.json` entries | any entry has internal field |
| 7 | Conventional commits | `commitlint` | PR title or commit messages don't match convention |
| 8 | Secret leak | `gitleaks` | secret patterns matched in PR diff |
| 9 | OpenAPI valid | `@stoplight/spectral` | `dist/api/openapi.json` lints fail |
| 10 | Bundle size | `bundlesize` against `package.json#bundlesize` | any bundle exceeds budget |

## 3. Runtime Surface

None.

## 4. UI Surface

PR check annotations + collapsible report comment.

## 5. Risk Research

| # | Area | Finding | Mitigation |
|---|------|---------|------------|
| 1 | Lighthouse flakiness | LCP varies ±200 ms between runs | Run 5 times, median; budget gives 200 ms headroom. |
| 2 | Slow CI on big builds | 256 pages × 5 gates = minutes | Parallelise: gates run in matrix; cache Node + Lighthouse browsers. |
| 3 | Lychee false positives | Some external URLs require User-Agent | `lychee.toml` user-agent + retry policy. |
| 4 | axe noise | Third-party CSS has known issues | Allowlist documented; review monthly. |

## 6. File Layout

```
.github/workflows/build-and-deploy.yml      # — TODO
.lychee.toml                                  # — TODO
.lighthouserc.json                            # — TODO
.commitlintrc.js                              # — TODO
.gitleaks.toml                                # — TODO
schemas/*.schema.json                         # — TODO
```

## 7. Configuration

Lighthouse budget excerpt:

```json
{
  "ci": {
    "assert": {
      "assertions": {
        "categories:performance":   ["error", { "minScore": 0.90 }],
        "categories:accessibility": ["error", { "minScore": 0.95 }],
        "largest-contentful-paint": ["error", { "maxNumericValue": 1500 }],
        "cumulative-layout-shift":  ["error", { "maxNumericValue": 0.05 }]
      }
    }
  }
}
```

## 8. Workflow

Each PR runs all gates in parallel; first failure annotates the PR; deploy blocked until all green.

## 9. Bugs/Issues

_None — TODO._

## 10. Tests

| Test | Description | Status |
|------|-------------|--------|
| Each gate fails on test fixture | Sandbox PR with intentional violation per gate | **TODO** |
| Gates run in parallel | CI takes ≤ 4 min for full PR | **TODO** |

## Quick Reference — Build Status Summary

| Artefact | File | Tier | Status |
|----------|------|------|--------|
| Build workflow | `.github/workflows/build-and-deploy.yml` | Internal | **TODO** |
| 10 gate configs | various | Internal | **TODO** |
| **Total** | | | **0 Built / 11 TODO** |
