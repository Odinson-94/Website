# Free Families Plan

> Parent: [Resources Plan](../Resources%20Plan.md)
> Status: **TODO**

## Purpose

Free RFA family packs hosted on Cloudflare R2. Listed via `data/resources.yaml` filtered to `category: families`.

## 1. Source of Truth

`data/resources.yaml` rows where `category == families`. Files in R2 bucket `families/`.

## 2. Build Pipeline

Same as parent — `build-resources.mjs` produces filtered `/resources/families/` index.

## 3. Runtime Surface

R2 direct download with optional signed URL for tracking.

## 4. UI Surface

Filterable by Revit year, tag (heating, cooling, drainage, lighting), license.

## 5. Risk Research

See [Resources Plan §5](../Resources%20Plan.md#5-risk-research--known-issues--pitfalls). Specific:

- RFA versions are forward-incompatible (you can open a 2021 in 2026 but not vice versa). Each pack ships per-year RFAs in subfolders.

## 6. File Layout

```
data/resources.yaml                       # rows where category=families
images/resources/<slug>.png                # thumbnails — TODO
R2 bucket families/<slug>-vN.zip           # — TODO
```

## 7. Configuration

Per-pack `revit_years` array drives which year subfolder appears in download options.

## 8. Workflow

Build pack → upload → add YAML row → PR → live.

## 9. Bugs/Issues

_None — TODO._

## 10. Tests

| Test | Description | Status |
|------|-------------|--------|
| Each pack contains expected RFAs | CI opens ZIP, checks file tree | **TODO** |
| RFA opens in target Revit year | Manual smoke per release | **TODO** |

## Quick Reference

| Artefact | Status |
|----------|--------|
| 5 initial packs | **TODO** |
