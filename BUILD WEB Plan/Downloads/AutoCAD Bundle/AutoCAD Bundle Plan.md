# AutoCAD Bundle Plan

> Parent: [Downloads Plan](../Downloads%20Plan.md)
> Status: **TODO**

## Purpose

`.bundle` ZIP for the BUILD MEP AutoCAD plugin (`MEPBridge.AutoCAD`). Per-AutoCAD-year build, signed.

## 1. Source of Truth

GitHub Releases on MEP Bridge with asset names matching `MEPBridge-AutoCAD-<year>-<version>.bundle`.

## 2. Build Pipeline

In MEP Bridge: same release workflow as Revit add-in adds AutoCAD bundle build per year using `MEPBridge.AutoCAD/Bundle/` skeleton.

## 3. Runtime Surface

None.

## 4. UI Surface

`/downloads/autocad-bundle/` analogous to Revit page.

## 5. Risk Research

| # | Area | Finding | Mitigation |
|---|------|---------|------------|
| 1 | AutoCAD year compatibility | Some APIs change between years | Per-year compile; matrix tested. |
| 2 | Bundle install | Users sometimes copy to wrong folder | Provide `BundleManager.exe` helper or clear instructions per OS. |

## 6. File Layout

Same as Revit Add-In Plan.

## 7. Configuration

Same as Revit Add-In Plan with `acad_years: [2021..2026]`.

## 8. Workflow

Same as Revit Add-In Plan.

## 9. Bugs/Issues

_None — TODO._

## 10. Tests

| Test | Description | Status |
|------|-------------|--------|
| Bundle structure valid | CI inspects PackageContents.xml | **TODO** |
| Loads in target AutoCAD year | Manual smoke per release | **TODO** |

## Quick Reference

| Artefact | Status |
|----------|--------|
| AutoCAD release workflow + 6 signed bundles + page | **TODO** |
