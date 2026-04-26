# Revit Add-In Plan

> Parent: [Downloads Plan](../Downloads%20Plan.md)
> Status: **TODO** — no signed installer exists.

## Purpose

The flagship download. Per-Revit-year MSI built from `MEPBridge.Revit.csproj`, signed with EV cert, distributed via GitHub Releases on the MEP Bridge repo, surfaced on `/downloads/revit-addin/`.

## 1. Source of Truth

GitHub Releases on `jordan-jones-94/MEPBridge` filtered by tag pattern + asset name pattern.

## 2. Build Pipeline

In MEP Bridge:

```
git tag v1.4.3 ─▶ release workflow
                     ├─ build per-year (2021..2026) MSI via WiX
                     ├─ EV-sign each MSI
                     ├─ counter-sign timestamp
                     └─ gh release create v1.4.3 MEPBridge-2021-1.4.3.msi ... MEPBridge-2026-1.4.3.msi
                            └─ dispatches website-data-update event
```

In Website:

```
build-downloads.mjs reads release list ─▶ dist/downloads/revit-addin.html
                                       ─▶ dist/downloads/version.json (revit-addin section)
```

## 3. Runtime Surface

`GET /downloads/version.json#revit-addin` for in-app update checks.

## 4. UI Surface

`/downloads/revit-addin/` page:
- Channel selector (stable / beta)
- Detected Revit year hint (parsed from User-Agent if possible, else dropdown)
- "Download" button → MSI URL
- Release notes (rendered from GitHub Release body)
- System requirements
- Install instructions (linked to /docs/getting-started/install)
- "Detect updates" badge for power users

## 5. Risk Research

See [Downloads Plan §5](../Downloads%20Plan.md#5-risk-research--known-issues--pitfalls). Specific:

- Manifest URL is the in-product update check; must be highly available + cacheable. Cloudflare cache 60 s.
- WiX MSI minimum supported Windows version; document it.

## 6. File Layout

```
# In MEP Bridge:
.github/workflows/release.yml             # — TODO
MEPBridge.Revit/Installer/                 # WiX project — TODO

# In Website:
src/content/downloads/revit-addin.md      # hand-written intro — TODO
templates/download-page.html              # — TODO
```

## 7. Configuration

`data/downloads.yaml#revit-addin` defines channels, matrix, signing certificate metadata (public).

## 8. Workflow

Release cut in MEP Bridge → page updates within 3 min.

## 9. Bugs/Issues

_None — TODO._

## 10. Tests

| Test | Description | Status |
|------|-------------|--------|
| Each MSI signed | `signtool verify /pa <file>` passes | **TODO** |
| Version.json shape | Schema valid | **TODO** |
| Update check | Add-in v1.0 sees v1.4 in version.json | **TODO** |

## Quick Reference

| Artefact | Status |
|----------|--------|
| Release workflow + WiX project + 6 signed MSIs + page | **TODO** |
