# End-to-End Automation Pipeline — Codebase to Live Website

> The complete loop. Every menu item, every navigation anchor, every page,
> every API endpoint, every search-index entry — generated.
>
> Hand-written content is restricted to four narrow lanes: marketing copy,
> brand tokens, demo asset files, and **per-page-type skill documents** that
> teach the LLM how to bridge gaps in the source data.
>
> **Last updated 2026-04-21** — this version captures the deterministic-LLM
> direction, the per-page-type skill requirement, the UI/app and demo
> complexity heuristics, the workflow-from-skills approach, and the
> draft-backup workflow.

---

## TL;DR — the pipeline in one diagram

```
    ┌─────────────────────────────────────────────────────────────────────┐
    │  Layer 0 — SOURCE OF TRUTH (MEP Bridge codebase, private)           │
    │  C# attributes · XML doc tags · Skill markdowns · Sample SQLite     │
    └─────────────────────────────┬───────────────────────────────────────┘
                                  ▼
    ┌─────────────────────────────────────────────────────────────────────┐
    │  Layer 1 — EXTRACTION (Python, deterministic, no LLM)               │
    │  generate_*.py → tools.json, commands.json, rest_api.json,          │
    │                  skills/*.md, ui_surfaces.json, demos_seed.json     │
    └─────────────────────────────┬───────────────────────────────────────┘
                                  ▼
    ┌─────────────────────────────────────────────────────────────────────┐
    │  Layer 2 — SYNC (cross-repo GitHub Action)                          │
    │  bundle → R2 → repository_dispatch → Website repo opens PR          │
    └─────────────────────────────┬───────────────────────────────────────┘
                                  ▼
    ┌─────────────────────────────────────────────────────────────────────┐
    │  Layer 3 — LLM AUGMENTATION (Claude Opus 4, deterministic)          │
    │  per-page-type SKILL → strict YAML output → drafts/                 │
    │  Workflows composed from MEP Bridge skill markdowns                 │
    └─────────────────────────────┬───────────────────────────────────────┘
                                  ▼
    ┌─────────────────────────────────────────────────────────────────────┐
    │  Layer 4 — REVIEW (separate Website-Drafts repo)                    │
    │  Auto-PR + git-tracked backup of every promotion + diff explorer    │
    └─────────────────────────────┬───────────────────────────────────────┘
                                  ▼
    ┌─────────────────────────────────────────────────────────────────────┐
    │  Layer 5 — GENERATORS (Node, deterministic, no LLM)                 │
    │  build-tool-pages.mjs ... build-search-index.mjs                    │
    │  data/*.json + drafts/*.yaml → dist/*.html                          │
    └─────────────────────────────┬───────────────────────────────────────┘
                                  ▼
    ┌─────────────────────────────────────────────────────────────────────┐
    │  Layer 6 — RUNTIME (Cloudflare Pages + Supabase Edge Functions)     │
    │  static HTML  +  /api/v1/* (read · demo · authenticated execute)    │
    └─────────────────────────────────────────────────────────────────────┘
```

Single CLI wraps everything: **`adelphos_CLI`** (see §10).

---

## §1. Layer 0 — Source of truth

In MEP Bridge, every C# class can carry a precise structured surface. The
existing rich attribute set:

| Attribute / tag | Purpose | Coverage today |
|-----------------|---------|---------------:|
| `[McpTool]` | Marks a class as an AI-callable tool | 191 / 191 |
| `[McpParam]` | Tool parameter | 100 % of tools that take params |
| `[Transaction]` | Marks a Revit external command | 163 / 163 |
| `[Keywords]` | Natural-language phrases for matching | 163 / 163 |
| `[IntentPattern]` | Wildcard intent patterns | most |
| `[SelectionInput]` | User-selected element input | 34 / 163 |
| `[ConfigInput]` | User-typed config input | 86 / 163 |
| `[Output]` | Returned value | 119 / 163 |
| `[Calls]`, `[CalledBy]`, `[RelatedCommands]` | Dependency graph | most |
| `[CommandCategory]`, `[ServiceType]` | Pillar / discipline | most |
| `[RestApi]`, `[RestApiParam]`, `[RestApiResponse]` | Public API surface | **0 / 163 ← gap** |
| `<summary>`, `<usecase>`, `<notfor>`, `<sideeffects>` | Documentation prose | 80 % |
| `<precondition>`, `<postcondition>` | State requirements | most |
| `<logictree>` | Decision flowchart | 35 / 163 |
| `<aiprompts>` (preprompt, thinkingstep, success, failure) | Sample dialogue | 132 / 163 |
| Skill markdowns at `BUILD MEP Plan/Skills/Released/*.md` | Workflows | 30+ |

**Two new attributes to add for full website automation:**

```csharp
// Marks a command as having a desktop UI window/panel
[HasUI("CobieSheetWindow", Type = "WPF", Description = "Tabbed COBie data grid")]

// Marks a command as having a web app surface
[HasWebApp("DocumentController", Url = "/apps/document-controller",
           Description = "Drawing transmittal + revision tracker")]
```

These let the website differentiate "command with UI" from "command with web app" from "headless command". Identification today is heuristic (parsing for `View.Show()`, `Launch*`, etc.) — explicit attributes make it deterministic.

---

## §2. Layer 1 — Extraction (Python, deterministic)

Python modules in `MEPBridge/tools/`. **No LLM. Single regex/AST pass over the codebase. Same source → same output.**

| Module | Status | Output | What it scans |
|--------|--------|--------|---------------|
| `generate_mcp_registry.py` | ✅ exists | `mcp_registry.json` (191 tools) | `[McpTool]`, `[McpParam]`, `[Keywords]` |
| `generate_skill_manifest.py` | ✅ exists | `skill_manifest.json` (~30 skills) | `BUILD MEP Plan/Skills/Released/*.md` YAML frontmatter |
| `generate_command_registry.py` | ⚠ TODO | `command_registry.json` (163 commands w/ desc) | `[Transaction]` + `<summary>` + every input/output attribute + every XML tag |
| `generate_rest_api_registry.py` | ⚠ TODO | `rest_api_registry.json` | `[RestApi]`, `[RestApiParam]`, `[RestApiResponse]` |
| `generate_ui_surfaces.py` | ⚠ TODO | `ui_surfaces.json` | `[HasUI]`, `[HasWebApp]`, plus heuristic XAML/React folder scan |
| `generate_demos_seed.py` | ⚠ TODO | `demos_seed.json` (commands ranked by complexity score) | Combines complexity heuristic (§3) over commands+tools |
| `generate_sandbox_snapshots.py` | ⚠ TODO | `sandboxes/*.sqlite` (5 anonymised models) | Runs `snapshot_export` against `Resources/SampleModels/*.rvt` |

### Classification heuristics (run inside extractors)

These are deterministic rules — same code → same classification.

#### UI / App identification (used by `generate_ui_surfaces.py`)

```
A command HAS_UI if any of:
  - [HasUI(...)] attribute is present                     ← preferred (explicit)
  - body contains  new <Name>View(...)
  - body contains  new <Name>Window(...)
  - body contains  <Name>.Show()  or  ShowDialog()
  - matching <ClassName>View.xaml or <ClassName>Window.xaml exists in the same folder

A command HAS_WEB_APP if any of:
  - [HasWebApp(...)] attribute is present                 ← preferred (explicit)
  - command launches a WebView2 with a known React app folder
  - URL pattern in command body matches a known web-app slug
```

Today the heuristic finds **~25 commands with UI** (CobieSheetWindow, DrawingExporterWindow, QAManagerWindow, etc.) and **1 web app** (DocumentController.React). Both lists go into `ui_surfaces.json` and inform website generation:

| If command has… | Website page gets… |
|----------------|--------------------|
| no UI         | command reference page only |
| has UI        | command reference page + screenshot of UI window + "Where it lives in the UI" section |
| has web app   | command reference page + dedicated `/apps/<slug>/` page + iframe-style preview + walkthrough |

#### Demo complexity score (used by `generate_demos_seed.py`)

```
score = 0
+3  if has [HasUI] or [HasWebApp]
+2  if input_count >= 2  (selection + config combined)
+2  if has <usecase> describing user workflow
+1  if has <aiprompts> with multiple thinkingstep entries
+1  if has [RestApi] (= externally important)
+1  if linked from a Skill markdown
-2  if input_count == 0 AND output_count == 0  (pure utility)

score >= 4  → DEMO_TIER  (add to demos_seed.json, deserves a video)
score 2-3   → DOCS_TIER  (gets a doc page only — no demo)
score 0-1   → UTILITY    (registry-only, may not even appear in left nav)
```

Today's snapshot (estimated):
- ~60 commands score >= 4 → demo set (matches your hand-curated list)
- ~50 score 2-3 → docs only
- ~50 score 0-1 → registry-only utilities

The 60 from the algorithm are seeded into `demos_seed.json`. The human-curated list at `data/demos.json` is kept as the override; the seed exists to surface candidates we missed.

---

## §3. Layer 2 — Sync

`.github/workflows/build-and-publish.yml` in MEP Bridge. Triggered on push to `master`.

```yaml
steps:
  - dotnet build  # triggers the post-build python scripts in §2
  - bundle:
      mcp_registry.public.json         # filePath/namespace stripped
      command_registry.public.json     # source paths stripped
      rest_api_registry.public.json
      skill_manifest.json
      skills/*.md                       # ship: true only, secrets-scrubbed
      ui_surfaces.json
      demos_seed.json
      sandboxes/*.sqlite                # anonymised
      version.json                      # sha + tag + ISO timestamp
  - upload bundle to Cloudflare R2 (signed URL)
  - repository_dispatch website-data-update { sha, bundle_url }
```

In the Website repo, `.github/workflows/sync-from-mepbridge.yml` listens for that event:

```yaml
steps:
  - download bundle from R2
  - write to data/ (overwriting)
  - git checkout -b chore/data-refresh-<sha>
  - generate diff summary in PR body:
      Tools added:   list_brand_new_thing
      Tools removed: list_old_thing
      Commands added: ExportXyzCommand
      [RestApi] tagged: 12 new endpoints
      Skills updated: Schedules Skill (+143 lines)
  - gh pr create --base master --head chore/data-refresh-<sha>
```

PR review = the human gate. Merge fires the build (Layer 5).

---

## §4. Layer 3 — LLM augmentation (Claude Opus, deterministic)

This is the contract:

```
Model:        claude-opus-4-20251010   (pinned version, never floating)
Temperature:  0
top_p:        1
max_tokens:   per-skill defined cap
Caching:      prompt cached on the system prompt + skill block
              (= same skill + same input = same cached response)
Output:       strict YAML, validated against per-page-type JSON Schema
```

**One Skill per page type** loaded as the system prompt for every draft of that page type. The skill makes the output deterministic by carrying:

- **References** — exact files to read first, in order
- **Gotchas** — known failure modes and the fix
- **Target CSS** — which `sandbox.css` sections will style this page (so the LLM sizes content appropriately)
- **Examples** — 1-3 reference HTML pages already approved by the user
- **JSON Schema** — exact YAML shape required, validated before write

If the LLM produces invalid YAML or the schema check fails, the script retries up to 3 times with an error correction prompt. After 3 failures the draft is marked `_drafts/_failed/<slug>.yaml` with the error log for human triage.

### Per-page-type skills (the comprehensive surface)

Folder: `BUILD WEB Plan/Page Type Skills/`. One file per page type:

| Skill | Drives | Sources read | Gotchas | Target CSS sections |
|-------|--------|--------------|---------|---------------------|
| **Tool Page Skill** | `/docs/tools/<name>/` | `data/registry.json[name]`, optional `data/examples/<name>.yaml` | – Don't invent params – Description from `<summary>`, NOT `<keywords>` – Honour `alwaysAvailable` | §7, §8, §9 |
| **Command Page Skill** | `/docs/commands/<name>/` | `data/command_registry.json[name]`, all linked tools/skills | – Use `[Output]` for returns table; never invent – Strip class name suffix `Command` for display | §7, §8, §9, §10, §15 |
| **Demo Page Skill** | `/demos/<slug>/` | `data/demos.json[slug]`, linked tools/commands, optional asset folder | – Steps must be 3-5; don't pad – Avoid first person – Prev/next demo URLs computed by generator, not the LLM | §7, §13, §16 |
| **Workflow Page Skill** | `/workflows/<slug>/` | `BUILD MEP Plan/Skills/Released/<skill>.md`, plus referenced commands | – One workflow per shipped skill – Preserve the skill's scenario order – Tools in `tools_used:` must exist in tools.json | §7, §13, §16 |
| **Pillar Page Skill** | `/products/<pillar>/` | All commands/tools/demos tagged with that pillar via `ServiceType`/`CommandCategory` | – No marketing fluff – Three sections: What it does · Who it's for · What's inside | §7, §8, §12 |
| **Bridge Page Skill** | `/docs/bridges/<bridge>/` | `data/registry.json` filtered by `requiresBridge` | – Brief paragraph; the value is the tool list – Activation requirements explicit | §7, §8, §9 |

Every skill follows the **Skill Template for Page Generation** at `BUILD WEB Plan/Page Type Skills/_Skill Template.md`. Authoring a new page type is a copy-and-fill exercise.

### Workflows from skills — the special case

Workflows are **never** invented from scratch. The pipeline:

```
For each <skill> in BUILD MEP Plan/Skills/Released/:
  1. Parse skill markdown (YAML frontmatter + scenarios + tools[] + commands[])
  2. Load Workflow Page Skill into Claude system prompt
  3. Load <skill> as the user message
  4. Output: data/_drafts/workflows/<skill-slug>.yaml
     With: title, lead, phases[] (one per scenario), tools_used[] per phase
  5. Validate against workflows.schema.json
  6. Open PR to Website-Drafts
```

This means:
- No invented workflows. Each one ladder-matches a real shipped skill.
- The skill is the source of truth for ordering, tools, prerequisites.
- If a skill changes, the workflow draft regenerates (with diff PR).

---

## §5. Layer 4 — Review (Website-Drafts repo + backups)

A **separate** repo: `jordan-jones-94/Website-Drafts`. Purpose:

- Keep the noise out of the production Website repo.
- One PR per draft type (workflow, examples, demo-steps, pillar copy).
- Reviewer can land 12 example-prompt PRs without flooding the production tree.

### Backup convention — every promotion is reversible

When a draft is promoted from `Website-Drafts` to `Website/data/`:

```
adelphos_CLI promote workflow new-job-from-brief
  → reads:   Website-Drafts/data/_drafts/workflows/new-job-from-brief.yaml
  → writes:  Website/data/workflows/new-job-from-brief.yaml
  → backs up:Website/_archive/2026-04-21T15-30-00/workflows/new-job-from-brief.yaml
  → commits: chore(workflows): promote new-job-from-brief (from Drafts@<sha>)
```

`_archive/` is git-tracked. Rolling back is a single command:

```
adelphos_CLI rollback workflow new-job-from-brief --to 2026-04-21T15-30-00
```

The Drafts repo also keeps every draft (even rejected) so the LLM history is auditable.

---

## §6. Layer 5 — Generators (Node, deterministic, no LLM)

Same generators as previous version. Each:

1. Loads its input data (validated against schema).
2. Renders the template (passed through, no AI).
3. Emits a search-index entry via `onPageBuilt(meta)` hook.
4. Emits a sitemap entry.
5. Emits a left-nav entry (if eligible).

```
scripts/
  build-tool-pages.mjs            → 191 pages
  build-command-pages.mjs         → 163 pages
  build-bridge-pages.mjs          → 6 pages
  build-skill-pages.mjs           → 30 pages
  build-pillar-pages.mjs          → 16 pages
  build-demo-pages.mjs   ✅       → 60 pages (already proven)
  build-workflow-pages.mjs        → ~30 pages (one per shipped skill)
  build-resource-pages.mjs        → from yaml
  build-download-pages.mjs        → from gh releases
  build-changelog.mjs             → from git log
  build-shell.mjs                 → /shell.js with nav config baked in
  build-search-index.mjs          → /docs/search-index.json
  build-sitemap.mjs               → /sitemap.xml + robots.txt
  build-openapi.mjs               → /api/openapi.json
  build-rest-validators.mjs       → supabase/functions/.../validators.ts
```

Reproducibility gate (CI): `npm run build && npm run build && git diff dist/` must be empty.

---

## §7. Layer 6 — Runtime

| Surface | Where | What |
|---------|-------|------|
| Static pages | Cloudflare Pages | `dist/**/*.html` |
| Public read API | Supabase Edge Function | `/api/v1/registry`, `/api/v1/skills`, `/api/v1/commands` |
| OpenAPI spec | Cloudflare Pages | `/api/openapi.json` (regenerated each build) |
| Authenticated execute | Supabase Edge Function + plugin polling | `/api/v1/commands/<name>` |
| Search index | Cloudflare Pages | `/docs/search-index.json` (sharded) |
| Sitemap | Cloudflare Pages | `/sitemap.xml` |

---

## §8. Auto-generated UI surfaces

Every navigable element comes from data. Hand-edits are a bug.

| Surface | Source | Built by |
|---------|--------|----------|
| **Top menubar** (Home · About · Roadmap · Contact · Apps▾ · Agentic Services▾ · Docs▾) | `sandbox/data/nav.json` (orchestrator) + `sandbox/data/apps.json` + `sandbox/data/agentic-services.json` (children); Docs▾ uses `dropdown-inline` with children listed directly in `nav.json` | `sandbox/shell.js` — fetches JSON at runtime, renders the bar |
| **Mobile menu overlay** | same `nav.json` | `sandbox/shell.js` |
| **Apps dropdown** (7 items: Revit Copilot · Adelphos Chat · Specbuilder · Report Builder · Document Controller · QA Manager · Schedule Builder) | `sandbox/data/apps.json` → `apps[]` | `shell.js` reads `children_from` per nav item |
| **Docs dropdown** (Docs Home, Tools, Commands, Demos, Workflows, Resources, Downloads) | `sandbox/data/nav.json` → `items[].children` (inline) | `shell.js` `dropdown-inline` renderer |
| **Agentic Services dropdown** (3 items) | `sandbox/data/agentic-services.json` → `services[]` | same |
| Apps inventory page | `sandbox/data/apps.json` | `build-app-pages.mjs` → `buildAppsInventory` |
| Per-app detail pages (6) | same | `buildAllAppPages` |
| Agentic Services inventory page | `sandbox/data/agentic-services.json` | `build-agentic-pages.mjs` → `buildAgenticServicesInventory` |
| Per-service detail pages (3) | same | `buildAllAgenticServicePages` |
| Workflows inventory | filesystem scan of `data/workflows/*.json` | `build-section-inventories.mjs` → `buildWorkflowsInventory` |
| Resources inventory | `sandbox/data/resources.json` | `buildResourcesInventory` |
| Downloads inventory | `sandbox/data/downloads.json` | `buildDownloadsInventory` |
| Left rail nav (Demos categories with counts, Reference list, Workflows list, Plan docs) | same + `data/workflows/*.json` | `sandbox/docs-shell.js` (runtime) |
| Right rail "On this page" | each generated page's H2/H3 IDs + `[data-toc]` markers | `docs-shell.js` (runtime) |
| Footer columns (Product, Resources, Company, Plans) | hard-coded in `shell.js` for now → migrate to `data/footer.json` | `sandbox/shell.js` |
| Search index | hook fired by every other generator | `build-search-index.mjs` |
| Sitemap.xml | hook fired by every other generator | `build-sitemap.mjs` |
| OpenAPI spec | `data/rest_api_registry.json` | `build-openapi.mjs` |
| Inventory tables (filter dropdowns, dashboard counts) | `data/registry.json` etc. | inline JS reading the data |

> **Adding a new app or service is one JSON edit.** Add an object to `apps.json` or `agentic-services.json`, run `adelphos_CLI auto-all`, and the menubar dropdown, the inventory grid, the detail page, and the mobile menu all update — no template changes, no script changes.

---

## §9. CSS as a process surface (linked to commands)

`sandbox/sandbox.css` is now organised as **17 explicitly labelled sections (§1–§17)**. Every section header carries: WHAT, CHANGE, AUTOMATION CMD.

The `adelphos_CLI` command surface that targets specific sections:

| CLI command | What it changes | CSS section |
|-------------|-----------------|-------------|
| `adelphos_CLI brand-color <hex>` | --brand-teal | §1 |
| `adelphos_CLI dark-mode <on|off>` | enables html.dark-mode token block | §2 |
| `adelphos_CLI content-width <px>` | --max-content | §1 |
| `adelphos_CLI motion <fast> <base> <slow>` | --motion-* tokens | §1 + §17 |
| `adelphos_CLI pill-theme <muted|outline|dot>` | [data-pill-theme] across all pages | §9 |
| `adelphos_CLI callout-theme <muted|outline|editorial>` | [data-callout-theme] across all pages | §10 |
| `adelphos_CLI add-pill <name> <hue>` | new .pill-X block | §9 |
| `adelphos_CLI add-callout <name> <hue>` | new .callout-X + tokens + icon | §1 + §10 |
| `adelphos_CLI apply-brand-tokens <preset>` | swaps the entire §1 + §2 token block | §1 + §2 |

Every CLI command writes a deterministic patch (find section header by `§N.` marker, replace block).

---

## §10. The `adelphos_CLI` command palette

One CLI = one entry point. Built on Node, lives in the Website repo at `scripts/cli.mjs`, installed via `npm link` so `adelphos_CLI` is on PATH.

```
adelphos_CLI auto-all                        run EVERY generator (extract → all inventories → all detail pages)
adelphos_CLI auto <type> <slug>              extract → draft → promote → build for one entity
adelphos_CLI build                           run a single page build
adelphos_CLI build --watch                   rebuild on data/ or src/ change
adelphos_CLI sync                            pull latest bundle from MEP Bridge

adelphos_CLI draft tool <name>               LLM drafts /docs/tools/<name>/ extras
adelphos_CLI draft command <name>            LLM drafts /docs/commands/<name>/ extras
adelphos_CLI draft demo <slug>               LLM drafts demo steps + description
adelphos_CLI draft workflow <skill-slug>     LLM drafts a workflow from a MEP Bridge skill
adelphos_CLI draft pillar <pillar>           LLM drafts pillar landing copy
adelphos_CLI draft examples <tool-or-command>  LLM drafts 3 example prompts

adelphos_CLI promote <type> <slug>           moves draft to data/, backs up, commits
adelphos_CLI rollback <type> <slug> --to <iso>  restore from _archive/

# build types now supported:
#   tool · command · workflow · demo · app · agentic
adelphos_CLI build app revit-copilot         builds /dist/apps/revit-copilot/index.html
adelphos_CLI build agentic finances          builds /dist/agentic-services/finances/index.html

adelphos_CLI brand-color <hex>               §1.--brand-teal
adelphos_CLI pill-theme <name>               sets [data-pill-theme]
adelphos_CLI callout-theme <name>            sets [data-callout-theme]
adelphos_CLI add-pill <name> <hue>           scaffolds new pill type
adelphos_CLI add-callout <name> <hue>        scaffolds new callout type
adelphos_CLI apply-brand-tokens <preset>     swap entire token block

adelphos_CLI search-rebuild                  regenerate /docs/search-index.json
adelphos_CLI check                           run all CI gates locally
adelphos_CLI serve                           start local dev server (port 8765)
adelphos_CLI test-page <slug>                regenerate one page only and open in browser
```

---

## §11. The test run — proof of concept on real classes

> Goal: prove the entire pipeline end to end on a small, hand-picked set
> before scaling to all 354 surfaces.

### Test set (mix of all complexity tiers + UI/app surfaces)

Picked from real MEP Bridge codebase:

| Class | Type | Tier | Has UI? | Has Web App? | Why this one |
|-------|------|------|---------|--------------|---|
| `ListRooms` | tool | `context` | no | no | Simple read, 0 inputs — tests the **plain tool page** |
| `SnapshotQuery` | tool | `snapshot` | no | no | Has params + return schema — tests **tool with parameters** |
| `PlaceSVPCommand` | command | `action` | no | no | Headless command — tests **plain command page** |
| `ExtendAllConnectorsCommand` | command | `action` | no | no | Already fully attributed — tests **fully-documented command** (sandbox already shows this) |
| `OpenCobieSheetWindowCommand` | command + UI | `action` | YES (CobieSheetWindow.xaml) | no | Tests **command + UI window page** with screenshot |
| `LaunchDocumentControllerCommand` | command + web app | `action` | YES (MainWindow.xaml) | YES (DocumentController.React) | Tests **command + web app page** with iframe |

### Class-structure edits to apply (one PR in MEP Bridge)

For the test, we add or fill the missing attributes/tags on each test class:

```csharp
// Example: OpenCobieSheetWindowCommand.cs — add these lines
[HasUI("CobieSheetWindow",
       Type = "WPF",
       Description = "20-sheet tabbed COBie data grid with row context menu",
       LiveScreenshot = "ui/cobie-sheet-window.png")]

[RestApi("open_cobie_sheet_window",
         Method = "POST", RequiresAuth = true, IsAsync = false,
         Description = "Opens the COBie sheet manager window for the active document.")]

// Example: LaunchDocumentControllerCommand.cs — add these lines
[HasWebApp("DocumentController",
           Url = "/apps/document-controller",
           ReactSource = "DocumentController/DocumentController.React",
           Description = "Drawing transmittal + revision tracker, hosted in WebView2")]
```

Plus: any test class missing `<usecase>` / `<notfor>` / `[Output]` gets them filled by the LLM-assisted scaffolder (Layer 3) and then human-reviewed in the test-run PR.

### Test pipeline run-through

```
1. Edit the 6 test classes in MEP Bridge (one PR)
2. Run generate_command_registry.py + generate_ui_surfaces.py
3. Inspect command_registry.json + ui_surfaces.json — confirm all 6 present and rich
4. Sync those JSON files into Website repo manually (full GH Action wired in Phase 3)
5. Run adelphos_CLI draft command place-svp
   → produces data/_drafts/commands/place-svp.yaml
6. Open PR in Website-Drafts → review
7. adelphos_CLI promote command place-svp
8. adelphos_CLI build
9. Open /docs/commands/place-svp/ in browser → visually confirm correctness
10. Repeat for the other 5 test classes
11. For OpenCobieSheetWindowCommand: confirm the UI screenshot section appears
12. For LaunchDocumentControllerCommand: confirm the web-app embed section appears
13. Sign off → green-light Phase 4 (run on all 354 surfaces)
```

This test plan is fully captured at `BUILD WEB Plan/Test Run/Test Run Plan.md`.

---

## §12. Decisions confirmed

| Decision | Confirmed |
|----------|----------|
| LLM provider | **Claude Opus** (pinned model version, temp=0) |
| Drafts repo | **`Website-Drafts`** (separate, with backups) |
| Workflow seed source | **MEP Bridge Skill markdowns** (one workflow per shipped skill) |
| CLI name | **`adelphos_CLI`** |
| Theme switcher | _user asked "what switcher?"_ — see note below |

### Note on the theme switcher

The "switcher" I added is a small floating panel in the **top-right corner** of `sandbox/docs/commands/extend-all-connectors.html`. Look for a small white card with the label "**Theme**" and three buttons: Muted / Outline / Editorial.

It only appears when the viewport is wider than 1100 px (so it might not be visible in screenshots taken at half-width). If you want me to:

- **Move it** somewhere more obvious (top of the page content, not floating)
- **Remove it entirely** and just lock to Muted
- **Promote it** to a permanent control like Cursor/Linear's density toggle

— say so and I'll change it. My recommendation: lock to **Muted** for production, keep the switcher visible only on `?theme=preview` (a query string toggle) so internal reviewers can A/B but real visitors don't see it.

---

## §13. Phase delivery — refined

| Phase | What | Effort | Status |
|-------|------|--------|--------|
| **0** | Sandbox + 3-col layout + theme system + per-demo pages + footer + CSS reorganisation | 3 d | ✅ done |
| **1** | `generate_command_registry.py` + `generate_ui_surfaces.py` + `generate_demos_seed.py` in MEP Bridge | 1 d | next |
| **2** | Per-page-type Skill documents (6) — comprehensive, with refs/gotchas/CSS/examples | 1 d | this PR |
| **3** | LLM scaffold scripts (one per page type) — drafts to `Website-Drafts` repo | 2 d | depends on §1+§2 |
| **4** | Test run on the 6 chosen classes — full loop, end-to-end | 1 d | depends on §1+§2+§3 |
| **5** | Cross-repo sync GitHub Actions wired | 1 d | parallel with §4 |
| **6** | All 14 Node generators ported from sandbox HTML scripts | 2 d | depends on §1 |
| **7** | `adelphos_CLI` wrapping everything | 1 d | last |
| **8** | Tag `[RestApi]` across all 163 commands (LLM-scaffolded, human-approved per pillar) | 1 d | parallel |
| **9** | Run promote workflow → all 60 demos + 30 workflows + 16 pillars + 191 tool pages + 163 command pages | 2 d | depends on §3+§4 |
| **10** | CI gates (links, schema, a11y, perf, reproducibility) + launch | 2 d | last |

**Total: ~15 working days** to a fully populated, deterministic, automated public site with re-skinnable CSS and one CLI driving the whole thing.

---

## §14. References (read these in order)

1. [Codebase Inventory](Codebase%20Inventory.md) — what's in the codebase right now
2. [Attribute to Webpage Map](Attribute%20to%20Webpage%20Map.md) — every attribute → page section
3. [Codebase Coverage Report](Codebase%20Coverage%20Report.md) — gaps + tagging plan
4. [Page Structures](Page%20Structures.md) — wireframes per page type
5. [Page Type Skills/](Page%20Type%20Skills/) — the comprehensive per-page-type LLM skills
6. [Test Run/Test Run Plan](Test%20Run/Test%20Run%20Plan.md) — the 6-class proof of concept
7. [Site Map](Site%20Map.md) — every URL on the site
8. [Project Structure Plan](Project%20Structure%20Plan.md) — H1 root plan
