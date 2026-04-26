# Free Asset Data Plan

> Parent: [Resources Plan](../Resources%20Plan.md)
> Status: **TODO**

## Purpose

Free CSV / JSON asset databases (radiator schedules, pump catalogues, fitting databases). Power BUILD MEP's data-driven family swap and routing decisions; usable independently for engineers' calcs.

## 1. Source of Truth

`data/resources.yaml` rows where `category == asset-data`.

## 2. Build Pipeline

Same as parent.

## 3. Runtime Surface

R2 direct download. Optional JSON also exposed at `GET /api/v1/asset-data/<slug>.json` for programmatic use.

## 4. UI Surface

`/resources/asset-data/` index with column count, row count, last updated.

## 5. Risk Research

| # | Area | Finding | Mitigation |
|---|------|---------|------------|
| 1 | Manufacturer data licensing | Some catalogues are proprietary | Only ship data we own or that's CC-licensed; one-shot scrape blocked. |
| 2 | Schema evolution | Adding a column breaks downstream consumers | Versioned filenames; old versions remain reachable. |

## 6. File Layout

```
data/resources.yaml                       # rows where category=asset-data
R2 bucket asset-data/<slug>-vN.csv         # — TODO
R2 bucket asset-data/<slug>-vN.json        # — TODO
```

## 7. Configuration

Per-dataset `schema_version` and `columns: []`.

## 8. Workflow

Curate spreadsheet → export → upload both CSV + JSON → YAML → PR.

## 9. Bugs/Issues

_None — TODO._

## 10. Tests

| Test | Description | Status |
|------|-------------|--------|
| CSV parses | CI loads via PapaParse | **TODO** |
| JSON valid | jq parses | **TODO** |
| Columns match `columns:` | Schema check | **TODO** |

## Quick Reference

| Artefact | Status |
|----------|--------|
| 4 initial datasets | **TODO** |
