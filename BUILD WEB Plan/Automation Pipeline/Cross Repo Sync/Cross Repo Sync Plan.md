# Cross Repo Sync Plan

> Parent: [Automation Pipeline Plan](../Automation%20Pipeline%20Plan.md)
> Status: **TODO**

## Purpose

Move JSON + Skill markdown from `MEPBridge` repo to `Website` repo automatically and securely.

## 1. Source of Truth

`MEPBridge/.github/workflows/build-and-publish.yml` (TODO — to add to MEP Bridge).

## 2. Build Pipeline

See parent §2 — full diagram is in [Automation Pipeline Plan §2](../Automation%20Pipeline%20Plan.md#2-build-pipeline-end-to-end).

| Step | Where | Status |
|------|-------|--------|
| `dotnet build` runs `generate_mcp_registry.py` | MEPBridge | **Built** |
| `dotnet build` runs `generate_skill_manifest.py` | MEPBridge | **Built** |
| `dotnet build` runs `generate_rest_api_registry.py` | MEPBridge | **TODO** |
| Bundle artefacts + sanitise + upload to R2 | MEPBridge GH Action | **TODO** |
| Dispatch `repository_dispatch website-data-update` | MEPBridge GH Action | **TODO** |
| Receive dispatch, download bundle, write `data/` | Website GH Action | **TODO** |
| Open PR with diff summary | Website GH Action | **TODO** |

## 3. Runtime Surface

None.

## 4. UI Surface

PR body summary table:

```
Tools added:    list_brand_new_thing
Tools removed:  list_old_thing
Tools changed:  list_rooms (description, +1 param)
Skills added:   COBie Workflow Skill
Skills changed: Schedules Skill
REST commands added: export_brand_new_thing
```

## 5. Risk Research

See parent §5 (rows #1–#10). Key risks: PR storms, secret leakage in skill bodies, registry schema drift, repository_dispatch payload size limit.

## 6. File Layout

```
.github/workflows/sync-from-mepbridge.yml          # — TODO
scripts/sync-from-mepbridge.sh                      # — TODO
.github/pr-body.md.tpl                              # — TODO

# In MEPBridge repo:
.github/workflows/build-and-publish.yml             # — TODO
tools/bundle_for_website.py                          # — TODO  (sanitise + zip)
```

## 7. Configuration

Secrets:
- `MEPBRIDGE_R2_KEY` (Cloudflare R2 — write to `mepbridge-publish/` bucket)
- `WEBSITE_REPO_PAT` (GitHub App token, fine-grained, scope: contents:write on Website only)

## 8. Workflow

See [Automation Pipeline Plan §8](../Automation%20Pipeline%20Plan.md#8-workflow).

## 9. Bugs/Issues

_None — TODO._

## 10. Tests

| Test | Description | Status |
|------|-------------|--------|
| Manual dispatch | `gh workflow run sync-from-mepbridge.yml` opens PR | **TODO** |
| Dispatch debounce | 5 dispatches in 60 s → 1 PR | **TODO** |
| Sanitiser strips secrets | Inject test secret, assert it's removed | **TODO** |

## Quick Reference — Build Status Summary

| Artefact | File | Tier | Status |
|----------|------|------|--------|
| Sync workflow | `.github/workflows/sync-from-mepbridge.yml` | Internal | **TODO** |
| Sync script | `scripts/sync-from-mepbridge.sh` | Internal | **TODO** |
| MEP Bridge publish workflow | `MEPBridge/.github/workflows/build-and-publish.yml` | Cross-repo | **TODO** |
| MEP Bridge bundler | `MEPBridge/tools/bundle_for_website.py` | Cross-repo | **TODO** |
| **Total** | | | **0 Built / 4 TODO** |
