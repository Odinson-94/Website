# Free Templates Plan

> Parent: [Resources Plan](../Resources%20Plan.md)
> Status: **TODO**

## Purpose

Starter Revit templates (`.rte`/`.rvt`) configured with the BUILD MEP defaults: filters, view templates, sheet sizes, parameters. Subset filtering of `data/resources.yaml` by `category: templates`.

## 1. Source of Truth

`data/resources.yaml` rows where `category == templates`.

## 2. Build Pipeline

Same as parent.

## 3. Runtime Surface

R2 direct download.

## 4. UI Surface

`/resources/templates/` index. Each template page links to the matching skill (`/docs/skills/master_model_setup` etc.) for context on what's included.

## 5. Risk Research

| # | Area | Finding | Mitigation |
|---|------|---------|------------|
| 1 | Template version drift | Filters change in BUILD MEP → templates stale | Each release: regenerate templates from current MEP Bridge config; bump version. |
| 2 | Disclosure | Template might leak internal naming conventions | Curated naming subset before publish. |

## 6. File Layout

Same shape as Free Families Plan, with `templates/` bucket.

## 7. Configuration

Per-template `includes` array drives the "what's inside" list:

```yaml
- slug: jpa-mep-template-2026
  name: "JPA MEP Master Template (Revit 2026)"
  category: templates
  includes:
    - "60 view templates (4 per discipline × 15)"
    - "120 filters (organised by service code)"
    - "ISO sheet sizes A0/A1/A3 with title block"
    - "JPA shared parameter file embedded"
```

## 8. Workflow

Build template → smoke-test → upload → YAML → PR → live.

## 9. Bugs/Issues

_None — TODO._

## 10. Tests

| Test | Description | Status |
|------|-------------|--------|
| Template opens cleanly | Per Revit year smoke test | **TODO** |
| Includes content matches reality | Open template, count filters/views | **TODO** |

## Quick Reference

| Artefact | Status |
|----------|--------|
| 3 initial templates | **TODO** |
