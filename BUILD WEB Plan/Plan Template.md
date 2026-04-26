# [Sub-system Name] Plan

> Parent: [Parent Plan](../Parent%20Plan.md)
> Location: `BUILD WEB Plan/Domain/SubSystem/`
> Source of truth (if cross-repo): `MEPBridge/<path>` — what we consume from MEP Bridge.
> Status: **TODO** | **Partial** | **Built** — summary of what exists and what doesn't.
> Skill document: [Sub-system Skill](../../Skills/Sub-system%20Skill.md)
> Skill template: [Skill Template](../../Skills/Skill%20Template.md)
> MCP / REST cross-reference: [MCP Tool Creation Skill](../../../../13%20MCP%20UI/MEPBridge/BUILD%20MEP%20Plan/Skills/MCP%20Tool%20Creation%20Skill.md), Class Structure §REST API Exposure.

---

## How to Read This Document

### Status Markers

Identical to BUILD MEP. Every artefact (script, page, endpoint, component) has a Status column:

| Status | Meaning |
|--------|---------|
| **TODO** | Does not exist yet. Plan describes what it WILL do. |
| **Built** | Exists in the codebase, deployable, tested. |
| **Partial** | Exists but incomplete (missing tests, edge cases, pages). |
| **Bug** | Exists but has a known defect. See §Bugs/Issues. |

### Access Tier (where applicable)

| Tier | Meaning |
|------|---------|
| **Public** | Anonymous access, CDN-cached. |
| **Demo** | Anonymous, rate-limited, sandboxed. |
| **Auth** | Requires Supabase JWT + API key. |
| **Internal** | Build-time only, not exposed at runtime. |

---

## Purpose

_What problem does this sub-system solve? One paragraph._

---

## 1. Source of Truth

_Where does the data, content, or code originate? If cross-repo, name the file path in MEP Bridge. If hand-written, say so._

| Artefact | Source | Owner |
|----------|--------|-------|
| `data/registry.json` | `MEPBridge/MEPBridge.Revit/AIChat/Registries/mcp_registry.json` (synced) | Generated |
| `src/content/marketing/*.md` | hand-written | Marketing |

---

## 2. Build Pipeline

_For each generated artefact: source → script → output → consumer. Include script names, file paths, schedule (on push, nightly, on tag)._

```
data/registry.json  ─[ build-tool-pages.mjs ]─▶  dist/docs/tools/<name>.html
                                              ─▶  dist/docs/search-index.json (partial)
```

| Script | Inputs | Outputs | Status |
|--------|--------|---------|--------|
| `scripts/build-thing.mjs` | `data/foo.json` | `dist/<route>.html` | **TODO** |

---

## 3. Runtime Surface (if any)

_For sub-systems that expose endpoints, document them like an OpenAPI snippet._

| Method | Path | Tier | Purpose | Status |
|--------|------|------|---------|--------|
| GET | `/api/v1/foo` | Public | Returns foo | **TODO** |

---

## 4. UI Surface (if any)

_For sub-systems that produce pages or components, document the route map and the component contract._

| Route / Component | File | Inputs | Status |
|-------------------|------|--------|--------|
| `/docs/tools/<name>` | `templates/tool-page.html` | `tool` object from registry | **TODO** |

---

## 5. Risk Research — Known Issues & Pitfalls

Same rule as BUILD MEP: every script, endpoint, and component must have at least one risk row, even if the finding is "no known issues — straightforward".

| # | Area | Finding | Mitigation | Source |
|---|------|---------|------------|--------|
| 1 | _e.g. CDN caching_ | _Stale tool page after registry update_ | _Cache-bust on deploy + 5 min TTL_ | _Cloudflare docs_ |

---

## 6. File Layout

```
scripts/
    build-foo.mjs                # Build       — TODO
src/
    content/foo.md                # Source       — TODO
data/
    foo.json                      # Synced       — Built (auto)
dist/
    docs/foo/<name>.html          # Generated    — TODO
```

---

## 7. Configuration

```json
{
  "subSystem": { "settingName": "default value" }
}
```

---

## 8. Workflow

_Numbered workflow showing how a contributor adds new content of this kind, OR how a runtime request flows end-to-end._

### Workflow: Add a new X

1. Author Y in source-of-truth location
2. Build runs Z
3. CI gate validates A
4. Deploy refreshes B
5. Verify at URL C

---

## 9. Bugs/Issues

| # | Area | Description | Severity |
|---|------|-------------|----------|
| 1 | _placeholder_ | _none yet_ | Low |

---

## 10. Tests

| Test | Description | Status |
|------|-------------|--------|
| Verify generator output schema | Run script, validate JSON shape | **TODO** |
| Verify route accessibility | curl deployed URL, expect 200 | **TODO** |

---

## Quick Reference — Build Status Summary

| Artefact | File | Tier | Status |
|----------|------|------|--------|
| `build-foo.mjs` | `scripts/build-foo.mjs` | Internal | **TODO** |
| `/api/v1/foo` | `supabase/functions/foo/` | Public | **TODO** |
| **Total** | | | **0 Built / 2 TODO** |
