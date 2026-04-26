# Downloads Plan

> Parent: [Project Structure Plan](../Project%20Structure%20Plan.md)
> Location: `BUILD WEB Plan/Downloads/`
> Status: **TODO** — nav still says "Downloads — Coming Soon"; no signed installers exist.

---

## Purpose

Replace the homepage "Downloads — Coming Soon" pill with a proper download centre for the BUILD MEP Revit add-in, the AutoCAD bundle, and the Document Controller WPF app. Pulls release metadata from the GitHub Releases API of the MEP Bridge repo so a `git tag v1.x.x && gh release create` automatically lands a new version on the site.

---

## Children (H3)

| Plan | Status | Summary |
|------|--------|---------|
| [Revit Add-In Plan](Revit%20Add-In/Revit%20Add-In%20Plan.md) | **TODO** | Signed installer per Revit year, channels stable/beta. |
| [AutoCAD Bundle Plan](AutoCAD%20Bundle/AutoCAD%20Bundle%20Plan.md) | **TODO** | `.bundle` zip per AutoCAD year. |
| [Document Controller Plan](Document%20Controller/Document%20Controller%20Plan.md) | **TODO** | WPF desktop installer. |

---

## 1. Source of Truth

- GitHub Releases API: `GET /repos/jordan-jones-94/MEPBridge/releases` (private — needs token).
- `data/downloads.yaml` for human-curated metadata that GitHub Releases doesn't carry (per-Revit-year matrices, install instructions, system requirements).

```yaml
- product: revit-addin
  channels:
    stable: latest_release_tag_filter: "v[0-9]+.[0-9]+.[0-9]+"
    beta:   latest_release_tag_filter: "v[0-9]+.[0-9]+.[0-9]+-beta"
  matrix:
    revit_years: [2021, 2022, 2023, 2024, 2025, 2026]
  system_requirements:
    os: ["Windows 10 21H2+", "Windows 11"]
    ram_min_gb: 16
  install_doc: /docs/getting-started/install
  signing:
    cert_thumbprint: "..."
    timestamp_authority: "http://timestamp.digicert.com"
```

---

## 2. Build Pipeline

```
GitHub Releases API ─▶ build-downloads.mjs ─▶ dist/downloads/index.html
                                            ─▶ dist/downloads/<product>.html
                                            ─▶ dist/downloads/version.json (machine-readable)
```

Build runs nightly + on `repository_dispatch` event from MEP Bridge release workflow.

---

## 3. Runtime Surface

`GET /downloads/version.json` — machine-readable manifest:

```json
{
  "revit-addin": {
    "stable": { "version": "1.4.2", "released": "2026-04-12", "assets": { "2021": "https://github.com/.../MEPBridge-2021-1.4.2.msi", "2026": "..." } },
    "beta":   { "version": "1.5.0-beta.3", "released": "2026-04-19", "assets": {...} }
  }
}
```

The Revit add-in itself can poll this URL to detect updates.

---

## 4. UI Surface

- `/downloads/` — three product cards, each with channel selector, Revit-year matrix, "Download" button.
- `/downloads/<product>` — detail with full release notes (rendered from GitHub Release body), system requirements, install instructions.

---

## 5. Risk Research — Known Issues & Pitfalls

| # | Area | Finding | Mitigation |
|---|------|---------|------------|
| 1 | Code signing | Unsigned MSI triggers SmartScreen warning | EV code-signing cert; counter-sign with timestamp authority. |
| 2 | GitHub API rate limit | Unauth = 60/h; auth = 5000/h | Use GitHub App token; cache release list 5 min in build. |
| 3 | Private repo | Releases API needs auth | Use installation token at build time only; site shows public URLs only. |
| 4 | Stale beta | Beta channel forgotten, becomes "stable" by default | If beta release > 30 days old without promotion, CI raises issue. |
| 5 | Per-Revit-year confusion | User downloads 2026 build, has 2022 | Big version selector with detected Revit year hint via `?revit=2026` query. |
| 6 | Install instructions drift | Each Revit year has different add-in folder | Per-year instruction blocks generated from a matrix; one source of truth. |

---

## 6. File Layout

```
data/downloads.yaml                    # — TODO
scripts/build-downloads.mjs            # — TODO
templates/download-page.html           # — TODO
dist/downloads/                        # — TODO
```

---

## 7. Configuration

Env: `GITHUB_RELEASES_TOKEN` (GitHub App installation token, scope: contents:read on MEPBridge).

---

## 8. Workflow

### Workflow: Cut a new stable release

1. In MEP Bridge: `gh release create v1.4.3 --title "..." --notes-file CHANGELOG.md MEPBridge-2021-1.4.3.msi MEPBridge-2026-1.4.3.msi ...`
2. MEP Bridge workflow dispatches `website-data-update` event with new release info.
3. Website rebuilds; `dist/downloads/version.json` updates within 3 min.
4. Add-in installations call home, see new version, prompt user.

---

## 9. Bugs/Issues

_None — TODO._

---

## 10. Tests

| Test | Description | Status |
|------|-------------|--------|
| All asset URLs 200 | After build, HEAD each asset URL | **TODO** |
| Schema valid | downloads.yaml validates | **TODO** |
| Channel ordering | "stable" appears above "beta" in UI | **TODO** |
| Per-year selector | Selecting 2024 swaps the displayed asset URL | **TODO** |

---

## Quick Reference — Build Status Summary

| Artefact | File | Tier | Status |
|----------|------|------|--------|
| `data/downloads.yaml` | as above | Public | **TODO** |
| `build-downloads.mjs` | as above | Internal | **TODO** |
| Template | `templates/download-page.html` | Internal | **TODO** |
| Code signing setup | external | Build | **TODO** |
| First signed installer (Revit + AutoCAD) | GitHub Releases | Public | **TODO** |
| **Total** | | | **0 Built / 5 TODO** |
