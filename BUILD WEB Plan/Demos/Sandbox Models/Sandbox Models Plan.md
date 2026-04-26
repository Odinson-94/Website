# Sandbox Models Plan

> Parent: [Demos Plan](../Demos%20Plan.md)
> Status: **TODO** — 0 of 5 sandboxes built.

## Purpose

Five curated SQLite snapshots covering the discipline matrix of the demo cards. Generated once per release from real Revit models, anonymised, uploaded to Supabase Storage, used by the Demo Run API.

## 1. Source of Truth

Source Revit models live in MEP Bridge `Resources/SampleModels/`:

| Sandbox | Source RVT | Disciplines covered |
|---------|------------|--------------------|
| `office` | OfficeBlock-Sample.rvt | drainage, lighting, comms |
| `hotel` | Hotel-Sample.rvt | drainage, fire alarm, ventilation |
| `hospital` | Hospital-Sample.rvt | ventilation, heating, medical gases |
| `education` | School-Sample.rvt | lighting, ventilation, fire alarm |
| `industrial` | Warehouse-Sample.rvt | heating, drainage, power |

## 2. Build Pipeline

In MEP Bridge:

```
SampleModels/<name>.rvt
        │
        ▼
  snapshot_export tool (anonymisation flag)
        │
        ▼
  SampleModels/<name>-vN.sqlite
        │
        ▼
  upload to Supabase Storage public bucket "sandboxes"
```

Run on each release; `vN` increments on schema change.

## 3. Runtime Surface

Read by `POST /api/v1/demo/run`. See [Demo Run API Plan §7](../../REST%20API/Demo%20Run%20API/Demo%20Run%20API%20Plan.md#7-configuration).

## 4. UI Surface

Sandbox name appears in chat panel header ("running against `office` sandbox").

## 5. Risk Research

| # | Area | Finding | Mitigation |
|---|------|---------|------------|
| 1 | Anonymisation | Sample models contain real client names in parameters | Anonymisation pass: replace `Project Name`, `Building Name`, room names with curated values. CI gate: regex against UK client names. |
| 2 | File size | Industrial sandbox could be > 100 MB | Strip non-essential tables (history, options, hidden categories). Cap 50 MB. |
| 3 | Schema drift | New snapshot table added in MEP Bridge → old sandboxes missing it | Sandboxes carry `schema_version`; Demo Run API checks compatibility; auto-rebuild trigger. |

## 6. File Layout

```
# In MEP Bridge:
Resources/SampleModels/                  # — Partial (some samples exist)
tools/build_sandbox_snapshots.py          # — TODO

# In Website (consumed only):
data/sandboxes.yaml                       # metadata + URLs — TODO
```

## 7. Configuration

`data/sandboxes.yaml`:

```yaml
- slug: office
  name: "5-storey office block"
  url: "https://supa.adelphos.ai/storage/v1/object/public/sandboxes/office-v3.sqlite"
  size_mb: 12
  schema_version: 3
  generated_at: 2026-04-15
  disciplines: [drainage, lighting, comms]
```

## 8. Workflow

Quarterly: build all 5 sandboxes, upload, bump version, update `data/sandboxes.yaml`, regenerate doc pages.

## 9. Bugs/Issues

_None — TODO._

## 10. Tests

| Test | Description | Status |
|------|-------------|--------|
| Each sandbox loads | Demo Run API can open and query each | **TODO** |
| No PII | grep for known client names in each sandbox dump | **TODO** |
| Size cap | Each ≤ 50 MB | **TODO** |

## Quick Reference

| Artefact | Status |
|----------|--------|
| 5 SQLite sandboxes + builder script + metadata | **TODO** |
