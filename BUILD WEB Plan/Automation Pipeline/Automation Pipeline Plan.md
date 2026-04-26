# Automation Pipeline Plan

> Parent: [Project Structure Plan](../Project%20Structure%20Plan.md)
> Location: `BUILD WEB Plan/Automation Pipeline/`
> Status: **TODO** — no scripts exist yet in `scripts/`. The MEP Bridge generators exist; the cross-repo sync and the website generators do not.
> Skill document: [Web Generator Authoring Skill](../Skills/Web%20Generator%20Authoring%20Skill.md) (TODO)
> Cross-repo dependencies: [generate_mcp_registry.py](../../../../13%20MCP%20UI/MEPBridge/tools/generate_mcp_registry.py), [generate_skill_manifest.py](../../../../13%20MCP%20UI/MEPBridge/tools/generate_skill_manifest.py), `generate_rest_api_registry.py` (TODO in MEP Bridge).

---

## Purpose

The Automation Pipeline is the **spine** of BUILD WEB. Every other domain (Documentation, REST API, Demos, Resources, Downloads, Examples) consumes outputs from it. If the pipeline is broken, the website cannot rebuild; if the pipeline is healthy, every change to MEP Bridge propagates to the public site within minutes.

Three responsibilities:

1. **Cross-repo sync** — pull artefacts from MEP Bridge into the Website repo.
2. **Generators** — turn `data/` artefacts into HTML, JSON, sitemaps, search index.
3. **CI gates** — fail builds that violate the contract (broken links, schema drift, perf regressions, accessibility issues).

---

## Children (H3)

| Plan | Status | One-line summary |
|------|--------|------------------|
| [Cross Repo Sync Plan](Cross%20Repo%20Sync/Cross%20Repo%20Sync%20Plan.md) | **TODO** | GitHub Actions that move JSON between MEP Bridge and Website. |
| [Generators Plan](Generators/Generators%20Plan.md) | **TODO** | The `scripts/build-*.mjs` family that turn `data/` into pages. |
| [CI Gates Plan](CI%20Gates/CI%20Gates%20Plan.md) | **TODO** | Schema validation, broken-link, axe-core accessibility, Lighthouse perf budgets. |

---

## 1. Source of Truth

| Artefact | Source | Sync Method | Status |
|----------|--------|-------------|--------|
| `data/registry.json` | `MEPBridge.Revit/AIChat/Registries/mcp_registry.json` | repository_dispatch GH Action | **TODO** |
| `data/skill_manifest.json` | `MEPBridge.Revit/Resources/wwwroot/data/skill_manifest.json` | same | **TODO** |
| `data/skills/*.md` | `BUILD MEP Plan/Skills/Released/*.md` (`ship: true` only) | same | **TODO** |
| `data/rest_api_registry.json` | `MEPBridge.Revit/AIChat/Registries/rest_api_registry.json` | same | **TODO** (depends on MEP Bridge building this) |
| `data/version.json` | git rev / tag of MEP Bridge HEAD | same | **TODO** |

---

## 2. Build Pipeline — End-to-End

```
┌───────────────────────────────────────────────────────────────────────────────┐
│  MEP Bridge repo  (jordan-jones-94/MEPBridge)                                 │
│                                                                               │
│   git push to master                                                          │
│          │                                                                    │
│          ▼                                                                    │
│   .github/workflows/build-and-publish.yml          [TODO — to add]            │
│      ├─ dotnet build                                                          │
│      ├─ post-build: generate_mcp_registry.py        ✓ exists                  │
│      ├─ post-build: generate_skill_manifest.py      ✓ exists                  │
│      ├─ post-build: generate_rest_api_registry.py   ⚠ TODO  ← Phase 2 dep     │
│      ├─ collect → bundle/                                                     │
│      │     mcp_registry.public.json                  (filePath/namespace strip)│
│      │     skill_manifest.json                                                │
│      │     skills/*.md                                (ship: true only)        │
│      │     rest_api_registry.json                                             │
│      │     version.json                              (sha, tag, generatedAt)   │
│      └─ repository_dispatch event_type=website-data-update                    │
│              with payload={ sha, branch, bundle_url }                         │
└──────────────────────────────────┬────────────────────────────────────────────┘
                                   │
                                   ▼
┌───────────────────────────────────────────────────────────────────────────────┐
│  Website repo  (jordan-jones-94/Website)                                      │
│                                                                               │
│  .github/workflows/sync-from-mepbridge.yml          [TODO]                    │
│      ├─ on: repository_dispatch [website-data-update]                          │
│      ├─ download bundle, write to data/                                        │
│      ├─ git checkout -b chore/data-refresh-<sha>                              │
│      ├─ git diff data/ → summary table in PR body                             │
│      └─ gh pr create  → review + merge                                         │
│                                                                               │
│  .github/workflows/build-and-deploy.yml              [TODO]                    │
│      ├─ on: push to master                                                     │
│      ├─ npm ci                                                                 │
│      ├─ node scripts/build-tool-pages.mjs                                      │
│      ├─ node scripts/build-skill-pages.mjs                                     │
│      ├─ node scripts/build-bridge-pages.mjs                                    │
│      ├─ node scripts/build-api-reference.mjs                                   │
│      ├─ node scripts/build-demo-cards.mjs                                      │
│      ├─ node scripts/build-resources.mjs                                       │
│      ├─ node scripts/build-downloads.mjs                                       │
│      ├─ node scripts/build-changelog.mjs                                       │
│      ├─ node scripts/build-search-index.mjs                                    │
│      ├─ node scripts/build-seo.mjs                                             │
│      ├─ CI gates (validate, axe, lighthouse, broken-link)                      │
│      └─ deploy → Cloudflare Pages / GitHub Pages                               │
└───────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Runtime Surface

None — this is build-time only. Runtime artefacts are documented in [REST API Plan](../REST%20API/REST%20API%20Plan.md).

---

## 4. UI Surface

None — this domain produces inputs for other UI surfaces.

---

## 5. Risk Research — Known Issues & Pitfalls

| # | Area | Finding | Mitigation | Source |
|---|------|---------|------------|--------|
| 1 | GitHub repository_dispatch | Payload limited to ~64 KB; cannot embed registry JSON inline. | Upload bundle as Action artifact or to Cloudflare R2; pass URL only. | [GH docs — repository_dispatch](https://docs.github.com/en/rest/repos/repos#create-a-repository-dispatch-event) |
| 2 | Auth between repos | Personal Access Tokens (PATs) expire; classic PATs lack fine-grain scope. | Use GitHub App with installation token, fine-grained PAT scoped to "Contents: write" on Website only. | GH best practice. |
| 3 | Cross-repo PR storms | If MEP Bridge pushes 20 commits in 5 min, 20 PRs spawn. | Debounce: action waits 60 s, coalesces dispatches; second dispatch within window updates the open PR rather than opening a new one. | Empirical CI hygiene. |
| 4 | Stripping internal fields | If we forget to strip `filePath`/`namespace` from public registry, internal architecture leaks. | Add CI gate: `assert no "filePath" in dist/api/v1/registry.json` (snapshot test). | Self-rule. |
| 5 | Generator non-determinism | Random `Date.now()` in output breaks CDN cache + `git diff`. | Generators must read `data/version.json.generatedAt` only; never call `new Date()`. | Reproducible build practice. |
| 6 | Markdown rendering | `marked`/`markdown-it` differ on edge cases (link nesting, tables); skill docs use both. | Lock to `markdown-it` with `markdown-it-anchor` + `markdown-it-attrs`; snapshot-test 5 representative skills. | Existing usage in MEP Bridge skill rendering. |
| 7 | Schema drift | MEP Bridge adds new field to registry → website crashes. | JSON Schema in `schemas/registry.schema.json` (versioned); CI gate validates `data/registry.json` against it; missing optional fields handled, missing required fields fail loudly. | Schema-first design. |
| 8 | Build perf at 190 → 500+ tools | Sequential file writes slow; sync I/O blocks. | Use `node:fs/promises` with `Promise.all` batches of 50; benchmark target ≤ 5 s for full site build. | Node FS guide. |
| 9 | Plan tree drift (this folder) | Manual edits diverge from filesystem. | Port `generate_plan_tree.py` from MEP Bridge; run in pre-commit hook. | MEP Bridge convention. |
| 10 | Secrets in skills | Some MEP Bridge skills mention internal Supabase URLs. | `ship: true` skills are sanitised at sync time: strip lines matching `(?i)supabase|secret|key|token`. Add SARIF gate. | Self-rule. |

---

## 6. File Layout

```
.github/workflows/
    sync-from-mepbridge.yml             # Sync     — TODO
    build-and-deploy.yml                 # Build    — TODO

scripts/
    build-tool-pages.mjs                  # Generator    — TODO
    build-skill-pages.mjs                 # Generator    — TODO
    build-bridge-pages.mjs                # Generator    — TODO
    build-api-reference.mjs              # Generator    — TODO
    build-demo-cards.mjs                  # Generator    — TODO
    build-resources.mjs                   # Generator    — TODO
    build-downloads.mjs                   # Generator    — TODO
    build-changelog.mjs                   # Generator    — TODO
    build-search-index.mjs                # Generator    — TODO
    build-seo.mjs                         # Generator    — TODO
    generate-plan-tree.mjs                # Internal     — TODO  (port of MEP Bridge generate_plan_tree.py)
    lib/
        registry.mjs                      # shared loader/validator    — TODO
        renderer.mjs                       # markdown + template helpers — TODO
        sanitiser.mjs                      # strip secrets from skills    — TODO

schemas/
    registry.schema.json                   # JSON Schema  — TODO
    skill-frontmatter.schema.json          # JSON Schema  — TODO
    rest-api-registry.schema.json          # JSON Schema  — TODO
    example.schema.json                    # for data/examples/*.yaml — TODO

data/                                       # synced from MEP Bridge — DO NOT hand-edit
    registry.json                           # synced       — TODO
    skill_manifest.json                     # synced       — TODO
    rest_api_registry.json                  # synced       — TODO
    version.json                            # synced       — TODO
    skills/                                 # synced       — TODO
    examples/                               # hand-curated YAML  — TODO
    demos.yaml                              # hand-curated       — TODO
    resources.yaml                          # hand-curated       — TODO
    downloads.yaml                          # hand-curated       — TODO

templates/
    tool-page.html                          # template     — TODO
    skill-page.html                         # template     — TODO
    bridge-page.html                        # template     — TODO
    api-page.html                           # template     — TODO
    demo-card.html                          # component    — TODO
```

---

## 7. Configuration

`.github/workflows/sync-from-mepbridge.yml`:

```yaml
on:
  repository_dispatch:
    types: [website-data-update]
  workflow_dispatch:
    inputs:
      bundle_url:
        description: "Override bundle URL (debug only)"
        required: false

env:
  NODE_VERSION: "20"
  BUNDLE_URL:   ${{ github.event.client_payload.bundle_url || inputs.bundle_url }}
  MEP_SHA:      ${{ github.event.client_payload.sha }}

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: scripts/sync-from-mepbridge.sh "$BUNDLE_URL" "$MEP_SHA"
      - uses: peter-evans/create-pull-request@v6
        with:
          branch: chore/data-refresh-${{ env.MEP_SHA }}
          title:  "chore(data): sync from MEPBridge@${{ env.MEP_SHA }}"
          body-path: .github/pr-body.md
          commit-message: "chore(data): sync from MEPBridge@${{ env.MEP_SHA }}"
```

---

## 8. Workflow

### Workflow: A new `[McpTool]` is added in MEP Bridge

1. Developer adds class with `[McpTool]` attribute, pushes to `MEPBridge@master`.
2. MEP Bridge CI builds, runs `generate_mcp_registry.py`, bundles artefacts, dispatches event.
3. Website CI receives event, downloads bundle, writes to `data/`, opens PR.
4. PR body contains a diff table: `+ list_new_thing  context  RevitContext`.
5. Reviewer approves + merges to `master`.
6. Website build runs, `build-tool-pages.mjs` produces `dist/docs/tools/list_new_thing.html`.
7. CI gates pass; Cloudflare Pages deploys.
8. Page live at `https://adelphos.ai/docs/tools/list_new_thing` within ~3 min of original push.

### Workflow: A skill is updated in MEP Bridge

1. Developer edits `BUILD MEP Plan/Skills/Released/Schedules Skill.md`, pushes.
2. Same dispatch chain; the markdown content changes.
3. Website regenerates `dist/docs/skills/schedules.html`.
4. Search index rebuilt; new keywords from the skill body now match queries.

### Workflow: A new `[RestApi]` command is exposed

1. In MEP Bridge: developer adds `[RestApi]` + `[RestApiParam]` + `[RestApiResponse]` to a command.
2. `generate_rest_api_registry.py` (TODO — to be built) picks it up.
3. Standard sync flow.
4. Website regenerates `dist/docs/api/<name>.html` and `/api/openapi.json`.
5. Supabase Edge Function reads new `rest_api_registry.json` and starts accepting POSTs to `/api/v1/commands/<name>`.

---

## 9. Bugs/Issues

_None yet — all components are TODO._

---

## 10. Tests

| Test | Description | Status |
|------|-------------|--------|
| Sync action E2E | Manually dispatch from MEP Bridge → assert PR opens with expected diff | **TODO** |
| Generator schema | Run all `build-*.mjs` against fixture `data/`; assert output paths + counts | **TODO** |
| Reproducible build | Run build twice on same input; `git diff dist/` must be empty | **TODO** |
| Sanitiser | Inject a fake `SUPABASE_SERVICE_ROLE_KEY` into a skill; assert it's stripped | **TODO** |
| CI gate triggers | Submit PR that breaks each gate; assert each fails individually | **TODO** |

---

## Quick Reference — Build Status Summary

| Artefact | File | Tier | Status |
|----------|------|------|--------|
| Sync workflow | `.github/workflows/sync-from-mepbridge.yml` | Internal | **TODO** |
| Build/deploy workflow | `.github/workflows/build-and-deploy.yml` | Internal | **TODO** |
| 11 generator scripts | `scripts/build-*.mjs` | Internal | **TODO** |
| 4 JSON schemas | `schemas/*.schema.json` | Internal | **TODO** |
| MEP Bridge publish workflow | `MEPBridge/.github/workflows/build-and-publish.yml` | Cross-repo | **TODO** |
| `generate_rest_api_registry.py` | `MEPBridge/tools/` | Cross-repo | **TODO** |
| **Total** | | | **0 Built / 18 TODO** |
