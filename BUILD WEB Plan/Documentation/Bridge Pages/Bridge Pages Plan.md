# Bridge Pages Plan

> Parent: [Documentation Plan](../Documentation%20Plan.md)
> Status: **TODO** — 0 of 6 pages exist.

## Purpose

One page per `requiresBridge` value: a category overview that explains what the bridge is, when it's active, and lists every tool that requires it.

## 1. Source of Truth

`data/registry.json` grouped by `requiresBridge`.

Six bridges (from current registry):

| Bridge | Tools | Description (hand-written) |
|--------|-------|---------------------------|
| (no bridge / generic) | 117 | Pure functions, snapshot, web, memory — always available regardless of Revit context. |
| `RevitContext` | 31 | Requires an active Revit document. The chat must be running in the Revit add-in. |
| `DrawingExporter` | 27 | Requires the Drawing Exporter panel to be open in Revit. |
| `SelfDebug` | 9 | Requires debug mode toggled on. |
| `Snapshot` | 3 | Requires a model snapshot to have been exported. |
| `ParameterEditor` | 3 | Requires the Parameter Editor panel to be open. |

## 2. Build Pipeline

`scripts/build-bridge-pages.mjs` reads registry, groups, applies template + hand-written description from `src/content/bridges/<bridge>.md`.

## 3. Runtime Surface

None.

## 4. UI Surface

```
H1: <bridge name>
Description (from src/content/bridges/<bridge>.md)
Activation requirements
Tool count: N

Tools (table):
name | category | alwaysAvailable | description (truncated)
```

## 5. Risk Research

Adding a new bridge in MEP Bridge: this generator handles it automatically (page appears next sync). The hand-written description must be added in the same PR (CI gate flags missing description files).

## 6. File Layout

```
src/content/bridges/<bridge>.md          # — TODO  (6 files, hand-written intros)
templates/bridge-page.html               # — TODO
scripts/build-bridge-pages.mjs           # — TODO
dist/docs/bridges/<bridge>.html          # — TODO
```

## 7. Configuration

None.

## 8. Workflow

When a new bridge appears in registry but `src/content/bridges/<name>.md` is missing → CI fails with "Add description for new bridge: <name>".

## 9. Bugs/Issues

_None — TODO._

## 10. Tests

| Test | Description | Status |
|------|-------------|--------|
| 6 bridges → 6 pages | Count match | **TODO** |
| Sum of tool counts == registry length | Sanity check | **TODO** |
| New bridge without description fails CI | Fixture test | **TODO** |

## Quick Reference

| Artefact | Status |
|----------|--------|
| Template + 6 bridge MD files + generator | **TODO** |
