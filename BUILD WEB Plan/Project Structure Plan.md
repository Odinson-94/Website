# BUILD WEB — Project Structure Plan

> This is the root plan for the **Adelphos AI public website** (`adelphos.ai`).
> Every plan in this project links UP to this document through its parent.
> **Plan Template:** New plans must follow [Plan Template](Plan%20Template.md).
> **Sister project:** [BUILD MEP — Project Structure Plan](../../../13%20MCP%20UI/MEPBridge/BUILD%20MEP%20Plan/Project%20Structure%20Plan.md) (private repo `jordan-jones-94/MEPBridge`). The website surfaces, documents, and demos the MEP Bridge product.
> **Conventions inherited from BUILD MEP:** Plan Template, Plan Execution Skill, Skill Template, Class Structure (REST API section). All naming and linking rules are identical.

---

## The Problem

Adelphos has a powerful, attribute-driven engine in **MEP Bridge** (`MEPBridge.Revit` — 190 MCP tools auto-registered from `[McpTool]` attributes, 43 ship-ready Skills, planned `[RestApi]` external command surface, Supabase-backed discovery). None of it is reachable, learnable, or buyable from outside Revit. The website (`adelphos.ai`) is a marketing single-page experience with twelve "view" sections, three placeholder nav items (Resources, Documentation, Downloads) marked "Coming Soon", and zero programmatic surface.

We need to:

1. Ship a public **read-only API** that mirrors the MEP Bridge tool registry so any third party can discover what BUILD MEP can do.
2. Ship a public **execution API** for safe, sandboxed demos (read-only Revit snapshot queries) and an **authenticated execution API** for paying customers' real Revit sessions.
3. Auto-generate **one documentation page per tool** (190+) and **one per skill** (43+) directly from the MEP Bridge source — zero hand-maintenance.
4. Auto-generate **interactive demo cards** that seed the public chat panel with curated example prompts and stream live results.
5. Fill the three "Coming Soon" nav items (Resources, Documentation, Downloads) with real content driven by the same generators.
6. Keep the website repo clean and the local working tree ship-ready (no Windows pollution, no media in git, conventional commits, CI gates).

**Rule of the project:** if a piece of content can be generated from MEP Bridge source code, registry JSON, or a Skill markdown, it MUST be generated — never hand-maintained. The only hand-written content on the site is marketing copy, designed visuals, and YAML example files.

---

## The Architecture

**Rule: Dependencies flow downward only. The website never reaches into MEP Bridge code at runtime — it consumes published artefacts (registry JSON, skill markdown, REST API contracts) via a sync layer.**

```
Layer 0  ─  MEP Bridge source              (private repo — single source of truth)
                  │
                  │  GitHub Action on every push to master:
                  │   • generate_mcp_registry.py       → mcp_registry.json
                  │   • generate_skill_manifest.py     → skill_manifest.json
                  │   • generate_rest_api_registry.py  → rest_api_registry.json   (TODO — must build)
                  │   • repository_dispatch → Website repo
                  ▼
Layer 1  ─  Sync (Automation Pipeline)     (data/ folder in Website repo, refreshed by Action)
                  │
                  ▼
Layer 2  ─  Generators                     (scripts/build-* in Website repo)
                  │   • build-tool-pages.mjs           → /docs/tools/*.html
                  │   • build-skill-pages.mjs         → /docs/skills/*.html
                  │   • build-bridge-pages.mjs       → /docs/bridges/*.html
                  │   • build-api-reference.mjs      → /docs/api/*.html
                  │   • build-demo-cards.mjs         → /demos/*.html
                  │   • build-search-index.mjs      → /docs/search-index.json
                  ▼
Layer 3  ─  Public Site                    (static HTML/CSS/JS — GitHub Pages or Cloudflare Pages)
                  │   /docs/, /demos/, /resources/, /downloads/, /api/
                  │
                  ▼
Layer 4  ─  Live runtime                   (Supabase Edge Functions + MEP Bridge plugin)
                      • /api/v1/registry              (read-only, public)
                      • /api/v1/skills                (read-only, public)
                      • /api/v1/demo/run              (sandboxed snapshot queries, rate-limited, anon)
                      • /api/v1/commands/{name}       (authenticated, queues to user's Revit)
                      • /api/v1/commands/{id}/result  (poll/stream)

Cross-cutting layers:
                      • Brand & UI shell              (existing index.html visual system)
                      • Telemetry & analytics         (Supabase + Plausible/PostHog)
                      • Auth & rate limiting          (Supabase Auth + Edge middleware)
```

---

## Hierarchy Rules

Identical to BUILD MEP (single source of truth — see [Plan Execution Skill](../../../13%20MCP%20UI/MEPBridge/BUILD%20MEP%20Plan/Skills/Plan%20Execution%20Skill.md)).

| Level | Name | Lives Here | Examples |
|:-----:|------|------------|----------|
| **H1** | Root | This file. References all H2 domains. | `Project Structure Plan.md` |
| **H2** | Domain | Top-level domains. Each links UP to H1 and DOWN to its H3 children. | `Automation Pipeline/`, `REST API/`, `Documentation/`, `Demos/` |
| **H3** | Sub-system | Sub-systems within a domain. Link UP to H2 and DOWN to H4 children. | `Tool Pages/`, `Skill Pages/`, `Bridge Pages/` (under Documentation) |
| **H4** | Leaf | Deepest level. Links UP to its H3 parent. No children. | Individual generated artefacts (rare — most leaves are auto-generated, not planned). |

**Linking rules (same as BUILD MEP):**

- H1 → H2 only. Never deeper.
- H2 ↔ H2: never directly. Connect through H1.
- H3 ↔ H3: only within the same H2 parent.
- Skills only reference other skills.
- Naming: NEVER hyphens. Title Case With Spaces. `%20` in markdown links.
- Cross-repo links to MEP Bridge are allowed ONLY in this H1 plan and inside the Automation Pipeline plan (the only domains that legitimately reach across the boundary).

---

## Full Plan Tree

> When `tools/generate_plan_tree.py` is ported into this repo it will regenerate the block below between markers. Until then, hand-edit on changes.

<!-- PLAN_TREE_START -->

```
BUILD WEB Plan/
│
├── Project Structure Plan.md                          ← H1 (ROOT)
├── Plan Template.md                                   ← shared template (copied from BUILD MEP)
│
├── Automation Pipeline/                               ← H2  (the spine — everything else depends on it)
│   ├── Automation Pipeline Plan.md
│   ├── Cross Repo Sync/                               ← H3  (GitHub Actions that move JSON between repos)
│   │   └── Cross Repo Sync Plan.md
│   ├── Generators/                                    ← H3  (build scripts in /scripts)
│   │   └── Generators Plan.md
│   └── CI Gates/                                      ← H3  (broken-link, schema, accessibility, perf budgets)
│       └── CI Gates Plan.md
│
├── REST API/                                          ← H2  (the public + private command surface)
│   ├── REST API Plan.md
│   ├── Public Read API/                               ← H3  (registry/skills/manifest, anonymous, cached)
│   │   └── Public Read API Plan.md
│   ├── Demo Run API/                                  ← H3  (sandboxed snapshot tools, anonymous, rate-limited)
│   │   └── Demo Run API Plan.md
│   ├── Authenticated Command API/                     ← H3  (queues to a customer's Revit via Supabase + plugin poll)
│   │   └── Authenticated Command API Plan.md
│   └── Webhooks/                                      ← H3  (job-completed, error, signed callbacks)
│       └── Webhooks Plan.md
│
├── Documentation/                                     ← H2  (all of /docs)
│   ├── Documentation Plan.md
│   ├── Tool Pages/                                    ← H3  (one HTML per [McpTool], 190 pages)
│   │   └── Tool Pages Plan.md
│   ├── Skill Pages/                                   ← H3  (one HTML per shipped Skill .md, 30+ pages)
│   │   └── Skill Pages Plan.md
│   ├── Bridge Pages/                                  ← H3  (one HTML per RequiresBridge value)
│   │   └── Bridge Pages Plan.md
│   ├── API Reference/                                 ← H3  (one HTML per [RestApi] command + OpenAPI spec)
│   │   └── API Reference Plan.md
│   ├── Getting Started/                               ← H3  (install, first prompt, first demo)
│   │   └── Getting Started Plan.md
│   ├── Changelog/                                     ← H3  (auto-built from conventional commits + tags)
│   │   └── Changelog Plan.md
│   └── Search/                                        ← H3  (client-side index across tools/skills/api/blog)
│       └── Search Plan.md
│
├── Demos/                                             ← H2  (interactive demo cards for /demos and View 4)
│   ├── Demos Plan.md
│   ├── Demo Cards/                                    ← H3  (reusable component + per-discipline demos)
│   │   └── Demo Cards Plan.md
│   ├── Live Chat Demo/                                ← H3  (the public chat-panel wired to Demo Run API)
│   │   └── Live Chat Demo Plan.md
│   └── Sandbox Models/                                ← H3  (curated SQLite snapshots used by Demo Run API)
│       └── Sandbox Models Plan.md
│
├── Resources/                                         ← H2  (the /resources nav item)
│   ├── Resources Plan.md
│   ├── Free Families/                                 ← H3
│   │   └── Free Families Plan.md
│   ├── Free Templates/                                ← H3
│   │   └── Free Templates Plan.md
│   └── Free Asset Data/                               ← H3
│       └── Free Asset Data Plan.md
│
├── Downloads/                                         ← H2  (the /downloads nav item)
│   ├── Downloads Plan.md
│   ├── Revit Add-In/                                  ← H3  (signed installer, version channels)
│   │   └── Revit Add-In Plan.md
│   ├── AutoCAD Bundle/                                ← H3
│   │   └── AutoCAD Bundle Plan.md
│   └── Document Controller/                           ← H3
│       └── Document Controller Plan.md
│
├── Examples/                                          ← H2  (curated prompts + expected results YAML)
│   ├── Examples Plan.md
│   └── Authoring Workflow/                            ← H3
│       └── Authoring Workflow Plan.md
│
├── Site Shell/                                        ← H2  (pages, nav, brand, dark mode, perf, SEO)
│   ├── Site Shell Plan.md
│   ├── Marketing Pages/                               ← H3  (index hero, about, contact, roadmap, privacy, terms)
│   │   └── Marketing Pages Plan.md
│   ├── Brain Canvas/                                  ← H3  (the 12-view scroll experience)
│   │   └── Brain Canvas Plan.md
│   └── Performance and SEO/                           ← H3  (Lighthouse budgets, sitemap, OG tags)
│       └── Performance and SEO Plan.md
│
├── Repo Hygiene/                                      ← H2  (git, .gitignore, conventional commits, no media in repo)
│   └── Repo Hygiene Plan.md
│
└── Skills/                                            ← H2  (web-side skills — same template as BUILD MEP Skills)
    ├── Skill Template.md
    ├── Frontend Design Skill.md                       (copied/forked from BUILD MEP)
    ├── Brand Standards Skill.md                       (copied/forked from BUILD MEP)
    └── Web Generator Authoring Skill.md               (NEW — how to write/extend the build-* scripts)
```

<!-- PLAN_TREE_END -->

---

## Phased Delivery

> Every phase ends with a working, deployable site. No phase ships dead links or "Coming Soon" pills that aren't backed by content. Each phase has an automation gate — manual steps are tracked as bugs.

### Phase 0 — Foundation (Week 1, ~3 days)

**Goal:** clean repo, deterministic builds, working sync from MEP Bridge → Website.

- Workstream 1 from prior turn: repo hygiene, sync (see [Repo Hygiene Plan](Repo%20Hygiene/Repo%20Hygiene%20Plan.md)).
- Build [Cross Repo Sync](Automation%20Pipeline/Cross%20Repo%20Sync/Cross%20Repo%20Sync%20Plan.md) GitHub Action in the **MEP Bridge** repo.
- In the Website repo: create `data/` folder consumed at build time.
- First passing CI run on a PR: `npm run build` produces `dist/` from `data/` + `src/`.

**Exit criteria:**

- `data/registry.json` (190 tools) auto-pulled on each MEP Bridge push.
- `data/skills/*.md` (≥30 ship:true skills) auto-pulled.
- Website builds reproducibly from `data/` + `src/`.
- Zero `desktop.ini`, `.bak`, or media files tracked.

### Phase 1 — Documentation MVP (Week 1–2, ~4 days)

**Goal:** every tool and every skill has a URL.

- [Generators Plan](Automation%20Pipeline/Generators/Generators%20Plan.md): `build-tool-pages.mjs`, `build-skill-pages.mjs`, `build-bridge-pages.mjs`, `build-search-index.mjs`.
- [Documentation Plan](Documentation/Documentation%20Plan.md): IA, layout templates, dark-mode parity with index.html.
- Replace nav "Documentation — Coming Soon" with real `/docs/` route.

**Exit criteria:**

- 190 `/docs/tools/<name>.html` pages.
- ≥30 `/docs/skills/<slug>.html` pages.
- 6 `/docs/bridges/<bridge>.html` pages (RevitContext, DrawingExporter, SelfDebug, Snapshot, ParameterEditor, generic).
- Searchable index at `/docs/` covers all of the above.
- Every page passes Lighthouse ≥ 90 perf/accessibility.

### Phase 2 — REST API surface (Week 2–3, ~5 days)

**Goal:** the Adelphos API exists, is documented, and serves real data.

- In **MEP Bridge** repo: build `generate_rest_api_registry.py` (analogue of `generate_mcp_registry.py`); add `[RestApi]`, `[RestApiParam]`, `[RestApiResponse]` attributes to substantial commands per Class Structure REST API section. Initial set ≈ 25 commands (drawing exports, clash detection, network resize, COBie export, batch tagging, batch revisions).
- In **Website** repo: build [Public Read API Plan](REST%20API/Public%20Read%20API/Public%20Read%20API%20Plan.md) (Supabase Edge Function `registry`, `skills`, `commands` — JSON, cached, anonymous).
- Build [Demo Run API Plan](REST%20API/Demo%20Run%20API/Demo%20Run%20API%20Plan.md) (Edge Function `demo/run` — whitelist of ≈ 20 read-only snapshot tools against curated SQLite models).
- Build [Authenticated Command API Plan](REST%20API/Authenticated%20Command%20API/Authenticated%20Command%20API%20Plan.md) (Supabase command_queue + command_results tables, plugin polling, JWT auth).
- Auto-generate OpenAPI 3.1 spec from `rest_api_registry.json` and serve at `/api/openapi.json`.
- Auto-generate `/docs/api/<command>.html` for every `[RestApi]` command.

**Exit criteria:**

- `GET https://adelphos.ai/api/v1/registry` returns 190 tools live.
- `GET https://adelphos.ai/api/v1/skills` returns ≥30 skills live.
- `POST https://adelphos.ai/api/v1/demo/run` executes a whitelisted snapshot query against a sandboxed model in <500 ms.
- `POST https://adelphos.ai/api/v1/commands/export_clash_results_to_xml` queues a job, plugin picks it up, result returned via webhook within <10 s end-to-end.
- OpenAPI spec validated by Spectral; reference page at `/docs/api/`.

### Phase 3 — Demos & Examples (Week 3–4, ~5 days)

**Goal:** every "Coming Soon" demo on the homepage is interactive.

- [Demo Cards Plan](Demos/Demo%20Cards/Demo%20Cards%20Plan.md): reusable card component, replaces View 4 video gallery.
- [Live Chat Demo Plan](Demos/Live%20Chat%20Demo/Live%20Chat%20Demo%20Plan.md): the existing `chat-panel/` scaffolding wired to Demo Run API; seeded prompts per demo card.
- [Sandbox Models Plan](Demos/Sandbox%20Models/Sandbox%20Models%20Plan.md): 5 curated SQLite snapshots (Office, Hotel, Hospital, Education, Industrial) covering the 5 disciplines; uploaded to Supabase Storage.
- [Examples Plan](Examples/Examples%20Plan.md): authoring workflow + first 108 example YAMLs (one per `alwaysAvailable: true` tool — see registry stats below).
- Wire the existing five MEP demo videos as "before" panels alongside the live "after" demos.

**Exit criteria:**

- 5 interactive demos (Drainage, Fire Alarm, Lighting, Ventilation, Heating/Cooling) on the homepage and `/demos/`.
- Clash Manager, SpecBuilder, QA Manager demos wired (already scaffolded in repo).
- 108 tool pages enriched with at least one prompt + expected result.
- Telemetry: every demo run logged to Supabase with anon session + duration + success.

### Phase 4 — Resources & Downloads (Week 4–5, ~4 days)

**Goal:** the remaining "Coming Soon" nav items disappear.

- [Resources Plan](Resources/Resources%20Plan.md): index of free families, templates, asset data; metadata-driven (`data/resources.yaml`); downloads from Cloudflare R2 / Supabase Storage.
- [Downloads Plan](Downloads/Downloads%20Plan.md): version channels (stable/beta), signed installers, install instructions per Revit/AutoCAD year.
- Auto-generated [Changelog Plan](Documentation/Changelog/Changelog%20Plan.md) from conventional commits and tagged releases.

**Exit criteria:**

- Three nav items go from "Coming Soon" → live pages.
- First public installer downloadable from `/downloads/`.
- Changelog page at `/docs/changelog/` shows the last 20 releases.

### Phase 5 — Polish, SEO, Launch (Week 5, ~3 days)

- [Performance and SEO Plan](Site%20Shell/Performance%20and%20SEO/Performance%20and%20SEO%20Plan.md): sitemap.xml, robots.txt, OG/Twitter cards, structured data (`SoftwareApplication`, `APIReference`), perf budgets enforced in CI.
- [CI Gates Plan](Automation%20Pipeline/CI%20Gates/CI%20Gates%20Plan.md): broken-link checker, JSON schema validation against `data/registry.json`, accessibility audit (axe-core), Lighthouse perf budget.
- Privacy and terms updated for telemetry and API usage.
- Launch checklist run; tag `v1.0.0`; announce.

**Exit criteria:**

- 100 % of nav items live.
- All pages auto-generated where possible; only marketing copy hand-written.
- CI fails the build on broken link, schema mismatch, or perf regression.
- Live at `https://adelphos.ai`.

---

## Automation Strategy — "If it can be generated, it must be generated"

This is the project's prime directive. Every domain plan must answer: **what is the source of truth, and what generator produces the artefact?**

| Artefact on the site | Source of truth | Generator | Lives in |
|----------------------|-----------------|-----------|----------|
| Tool reference pages (191) | `[McpTool]` attrs in `MEPBridge.Revit/AIChat/Tools/*.cs` | `generate_mcp_registry.py` (MEP Bridge) → `build-tool-pages.mjs` (Website) | `/dist/docs/tools/<name>/index.html` |
| Command reference pages (163) | `[Transaction]` + XML doc tags in `MEPBridge.Revit/Commands/*.cs` | `generate_command_registry.py` → `build-command-pages.mjs` | `/dist/docs/commands/<slug>/index.html` |
| Workflow pages | `BUILD MEP Plan/Skills/*.md` (skill markdown) | `drafter.mjs` → `build-workflow-pages.mjs` | `/dist/workflows/<slug>/index.html` |
| Demo pages | `sandbox/data/demos.json` | `build-demo-pages.mjs` | `/dist/demos/<slug>/index.html` |
| **App pages (6)** | `sandbox/data/apps.json` | `build-app-pages.mjs` (`buildAllAppPages`, `buildAppsInventory`) | `/dist/apps/<slug>/index.html` |
| **Agentic Service pages (3)** | `sandbox/data/agentic-services.json` | `build-agentic-pages.mjs` | `/dist/agentic-services/<slug>/index.html` |
| **Top menubar + mobile menu** | `sandbox/data/nav.json` (+ apps.json + agentic-services.json) | `sandbox/shell.js` (renders client-side from JSON) | every page |
| Apps inventory | `sandbox/data/apps.json` | `buildAppsInventory` in `build-app-pages.mjs` | `/dist/apps/index.html` |
| Agentic Services inventory | `sandbox/data/agentic-services.json` | `buildAgenticServicesInventory` | `/dist/agentic-services/index.html` |
| Workflows inventory | `data/workflows/*.json` (file-system scan) | `buildWorkflowsInventory` in `build-section-inventories.mjs` | `/dist/workflows/index.html` |
| Resources inventory | `sandbox/data/resources.json` | `buildResourcesInventory` | `/dist/resources/index.html` |
| Downloads inventory | `sandbox/data/downloads.json` | `buildDownloadsInventory` | `/dist/downloads/index.html` |
| Skill pages (30+) | `BUILD MEP Plan/Skills/*.md` with `ship: true` frontmatter | `generate_skill_manifest.py` (MEP Bridge) → `build-skill-pages.mjs` | `/docs/skills/<slug>.html` |
| Bridge category pages (6) | `requiresBridge` field in registry | `build-bridge-pages.mjs` | `/docs/bridges/<bridge>.html` |
| REST API reference + OpenAPI spec | `[RestApi]` attrs in `MEPBridge.Revit/**/*.cs` | `generate_rest_api_registry.py` (TODO — MEP Bridge) → `build-api-reference.mjs` | `/docs/api/`, `/api/openapi.json` |
| Search index | All registries above | `build-search-index.mjs` | `/docs/search-index.json` |
| Plan tree (this document) | Folder layout under `BUILD WEB Plan/` | `generate_plan_tree.py` (port from MEP Bridge) | inline between markers in this file |
| Changelog | git log with conventional commits + tags | `build-changelog.mjs` | `/docs/changelog/` |
| Demo cards | `data/demos.yaml` + tool registry | `build-demo-cards.mjs` | `/demos/` and View 4 of homepage |
| Resources index | `data/resources.yaml` | `build-resources.mjs` | `/resources/` |
| Downloads page | GitHub Releases API | `build-downloads.mjs` | `/downloads/` |
| Sitemap and OG cards | All generated routes | `build-seo.mjs` | `/sitemap.xml`, `<head>` partials |

**Hand-maintained files (deliberately small):**

- Marketing copy: `src/content/marketing/*.md`
- Visual assets: `public/images/*`, `public/logos/*`
- Brand tokens and CSS: `src/styles/*`
- Example YAMLs: `data/examples/*.yaml` (curated by humans, but rendered automatically)
- The plan documents in this folder.

---

## Cross-Repo Wiring — How BUILD WEB and BUILD MEP Connect

```
MEP Bridge repo (jordan-jones-94/MEPBridge, private, branch master)
│
├── On push to master:
│     • dotnet build → triggers post-build python scripts:
│         - generate_mcp_registry.py    → mcp_registry.json
│         - generate_skill_manifest.py  → skill_manifest.json
│         - generate_rest_api_registry.py (TODO)  → rest_api_registry.json
│     • New GitHub Action ("publish-website-data"):
│         - Bundles the three JSON files + Skills/*.md (ship:true only)
│         - Strips internal-only fields (filePath, namespace) from public registry
│         - Sends repository_dispatch event "website-data-update" to Website repo
│
Website repo (jordan-jones-94/Website, private, branch master)
│
├── On repository_dispatch "website-data-update":
│     • Action checks out master
│     • Downloads bundled artefacts → writes to data/
│     • Commits "chore(data): refresh from MEPBridge@<sha>" to data branch
│     • Opens PR to master with diff summary (added/changed tools, new skills)
│
└── On PR merge:
      • Production build runs all build-*.mjs generators
      • Deploys to Cloudflare Pages / GitHub Pages
      • Cache-busts CDN
      • Posts deploy summary to Slack/Discord
```

**Why this shape works:**

- The website never reads MEP Bridge source — only published artefacts. Privacy preserved.
- The website is reproducible from `data/` alone, so contributors without MEP Bridge access can still develop it.
- Every change to a tool's name, description, or parameters propagates to the public site within minutes, with a reviewable PR in between.
- Stripping `filePath` and `namespace` from public registry prevents leaking internal architecture.
- A failed build in the MEP Bridge repo never breaks the Website build — only successful Bridge builds dispatch.

See [Cross Repo Sync Plan](Automation%20Pipeline/Cross%20Repo%20Sync/Cross%20Repo%20Sync%20Plan.md) for the exact GitHub Action YAML and signing strategy.

---

## API Surface to Expose — Decisions

Three public surfaces, each with explicit auth and rate-limit policy. **No write tools are exposed without authentication. No exceptions.**

### 1. Public Read API — `GET https://adelphos.ai/api/v1/*`

Anonymous, aggressively cached at the CDN (1 h TTL).

| Endpoint | Returns | Source |
|----------|---------|--------|
| `GET /api/v1/registry` | Public-safe MCP tool registry (190 tools, fields: name, description, category, requiresBridge, alwaysAvailable, parameters, keywords) | `data/registry.json` (synced from MEP Bridge) |
| `GET /api/v1/registry/<name>` | Single tool detail | as above |
| `GET /api/v1/skills` | All ship:true skills (slug, name, category, tags, description) | `data/skill_manifest.json` |
| `GET /api/v1/skills/<slug>` | Full skill markdown | `data/skills/*.md` |
| `GET /api/v1/commands` | All `[RestApi]` commands (name, description, params, responses, auth) | `data/rest_api_registry.json` |
| `GET /api/v1/commands/<name>` | Single command detail | as above |
| `GET /api/openapi.json` | OpenAPI 3.1 spec for the entire API | generated from `rest_api_registry.json` + this list |

**Decision rationale:** these are documentation surfaces. Cheap, safe, drives SEO and external integrations.

### 2. Demo Run API — `POST https://adelphos.ai/api/v1/demo/run`

Anonymous but rate-limited (10 req/min/IP, 100 req/day/IP), executes against curated read-only SQLite snapshots in Supabase Storage.

**Whitelist** (initial 20 — all `category: snapshot` or `category: context` AND `alwaysAvailable: true` AND no Revit thread requirement):

```
list_levels, list_rooms, list_doors, list_corridors, list_comms, list_plant_rooms,
list_risers, list_space_names, list_families, list_filters, list_grids,
list_grid_angles, get_document_info, get_current_view, get_element_summary,
snapshot_query, get_clash_result_summary_by_status, get_clash_result_history_over_time,
get_unresolved_errors, get_error_summary
```

**Decision rationale:** these are the "wow factor" public demos. They prove the engine works without exposing any customer data, any write capability, or any user-uploaded model. Cost is bounded by snapshot size and rate limit.

### 3. Authenticated Command API — `POST https://adelphos.ai/api/v1/commands/{name}`

Requires JWT (Supabase Auth) + per-user API key. Queues commands to the user's Revit instance via plugin polling.

**Initial commands to expose (from MEP Bridge — must be tagged with `[RestApi]`):**

| Command | Why expose |
|---------|------------|
| `export_clash_results_to_xml` | External clash dashboards (Navisworks, BIMCollab) need a feed. |
| `resize_entire_pipe_network` | External flow-calculation tools push back results. |
| `run_clash_detection_between_mechanical_and_electrical` | Coordination dashboards trigger overnight runs. |
| `export_drawing_set_to_pdf` | Document control systems trigger publishing. |
| `add_revision_to_sheets_for_export` | Document control issues a revision externally. |
| `apply_view_template_to_views_by_filter` | Standards enforcement bots. |
| `tag_all_rooms_in_current_view_including_linked` | Bulk tagging workflows. |
| `export_cobie_workbook_to_excel` | Handover platforms (Bentley, Cohesive). |
| `export_pipe_sizing_schedule_to_excel` | External MEP calculators. |
| `batch_add_revision_to_sheets_by_filter` | Batch revision workflows. |

The tagging exercise produces ~25 `[RestApi]` commands at first cut. The `generate_rest_api_registry.py` script (to be built) keeps the list in sync without further hand-edits.

**Decision rationale:** these are the integrations that unlock partner ecosystems. They are the genuine commercial surface — gated by auth, rate limits per plan tier, and usage quotas.

### What we explicitly do NOT expose

- Any tool whose `category` is `action` and `requiresBridge` is `RevitContext` *unless* the matching command class also carries `[RestApi]`. Action tools are dangerous; only the curated REST set is exposed.
- Any tool whose `requiresBridge` is `SelfDebug` or `ParameterEditor` — these are UI-bound and meaningless without a desktop session.
- Internal helpers, calculators, and snapshot writes (`snapshot_write`, `snapshot_apply`).
- Any UI-driving command (point picking, element selection prompts).

---

## Inventory of Demos / Interfaces / Docs / Resources

### Demos to build (5 disciplines × 2 modes)

For each discipline: **Watch demo** (existing 30 s mp4 hosted on Cloudflare Stream) + **Try demo** (live Demo Run API call against the matching sandbox model).

1. Drainage layout — Office sandbox.
2. Fire Alarm layout — Hotel sandbox.
3. Lighting layout — Education sandbox.
4. Ventilation layout — Hospital sandbox.
5. Heating / Cooling layout — Industrial sandbox.

Plus the three product demos already partially scaffolded in the repo:

6. **Clash Manager** — `clash-manager.html` + `js/clash-manager.js` wired to `get_all_clash_results_from_latest_check`.
7. **SpecBuilder** — `js/specbuilder.js` + `chat-panel/SPECBUILDER_CHECKLIST.md` wired to skill `Custom Tool Creation`.
8. **QA Manager** — `js/qa-chat.js` wired to `get_unresolved_errors` + `get_error_summary`.

### Interfaces (the embeddable demo card)

Single `<demo-card>` Web Component or React island. Inputs: `tool` or `skill` slug, `prompt`, `sandbox`. Outputs: result panel, "View on docs" link, "Open in chat" deep link.

### Docs (replaces the "Documentation — Coming Soon" pill)

| Route | Content | Generator |
|-------|---------|-----------|
| `/docs/` | Landing + search index | `build-search-index.mjs` |
| `/docs/getting-started/` | Install + first prompt + first demo | hand-written, marketing |
| `/docs/tools/` | Filterable index of all 190 tools | `build-tool-pages.mjs` |
| `/docs/tools/<name>` | One per tool (see Tool Pages Plan for shape) | as above |
| `/docs/skills/` | Index of shipped skills | `build-skill-pages.mjs` |
| `/docs/skills/<slug>` | One per skill, rendered from markdown | as above |
| `/docs/bridges/<bridge>` | One per `requiresBridge` value | `build-bridge-pages.mjs` |
| `/docs/api/` | REST API reference | `build-api-reference.mjs` |
| `/docs/api/<command>` | One per `[RestApi]` command | as above |
| `/docs/changelog/` | Auto from conventional commits | `build-changelog.mjs` |

### Resources (replaces the "Resources — Coming Soon" pill)

Driven by `data/resources.yaml`:

```yaml
- slug: jpa-radiator-family-pack
  name: "JPA Radiator Family Pack"
  category: families
  description: "26 parametric LST and standard radiator families (RFA), Revit 2021–2026."
  download_url: "https://r2.adelphos.ai/families/radiator-pack-v3.zip"
  size_mb: 47
  license: "CC-BY-NC-4.0"
  thumbnail: "/images/resources/radiator-pack.png"
```

Initial set: 5 family packs, 3 templates (RTE/RVT), 4 asset data CSVs. All hand-curated; YAML is the contract.

### Downloads (replaces the "Downloads — Coming Soon" pill)

Pulled from GitHub Releases API + `data/downloads.yaml` for installer metadata. Channels: `stable`, `beta`, `preview`. Per-version per-Revit-year filtering.

### Example prompts + expected results — the data shape

One YAML file per tool, kept under `data/examples/<tool_name>.yaml`:

```yaml
tool: list_rooms
canonical_prompts:
  - prompt: "List all rooms on Level 02"
    expected:
      summary: "Returns all rooms on the level named 'Level 02', sorted by room number."
      sample_response: |
        [
          {"id": 345621, "name": "Office",  "number": "02-014", "area_m2": 18.4, "level": "Level 02"},
          {"id": 345629, "name": "Meeting", "number": "02-015", "area_m2":  9.7, "level": "Level 02"}
        ]
    notes: "Empty result is valid — agent should suggest checking the level name."
  - prompt: "Which rooms on the ground floor are larger than 25 m²?"
    expected:
      summary: "Filtered list, sorted by area descending. Areas in m²."
related_skills: [filters_templates, schedules]
related_tools:  [list_levels, snapshot_query, get_current_view_level]
```

The doc generator reads the YAML and embeds the Try It block on the matching tool page. Initial coverage target = the 108 `alwaysAvailable: true` tools (most useful first), then expand.

---

## Quick Reference — Domain Status Summary

> Copied from BUILD MEP convention. Every domain reports its build state at the bottom of the H1 plan.

| Domain (H2) | Plan | Built | Notes |
|-------------|------|-------|-------|
| Automation Pipeline | [link](Automation%20Pipeline/Automation%20Pipeline%20Plan.md) | **TODO** | Foundation — Phase 0. |
| REST API | [link](REST%20API/REST%20API%20Plan.md) | **TODO** | Phase 2. Depends on `[RestApi]` attrs being added in MEP Bridge. |
| Documentation | [link](Documentation/Documentation%20Plan.md) | **TODO** | Phase 1. |
| Demos | [link](Demos/Demos%20Plan.md) | **Partial** | `clash-manager.html`, `chat-panel/`, `qa-chat.js`, `specbuilder.js` already exist (untracked). |
| Resources | [link](Resources/Resources%20Plan.md) | **TODO** | Phase 4. |
| Downloads | [link](Downloads/Downloads%20Plan.md) | **TODO** | Phase 4. |
| Examples | [link](Examples/Examples%20Plan.md) | **TODO** | Phase 3 (alongside demos). |
| Site Shell | [link](Site%20Shell/Site%20Shell%20Plan.md) | **Partial** | `index.html`, brain canvas, dark mode, menubar shipped; SEO/perf budgets TODO. |
| Repo Hygiene | [link](Repo%20Hygiene/Repo%20Hygiene%20Plan.md) | **Partial** | `.gitignore` hardened, `.git` cleaned this session; sync push pending user approval. |

**Top-level status: Partial — foundation in place, no automation pipeline yet, no public API yet.**

---

## Source Registry Snapshot (informs every plan below)

Captured from a fresh clone of `MEPBridge@master` on 2026-04-20:

- **Tool count:** 190
- **Always Available:** 108 (the high-value public demo set)
- **By bridge:** 117 (no bridge — pure functions, snapshot, web, memory) · 31 RevitContext · 27 DrawingExporter · 9 SelfDebug · 3 Snapshot · 3 ParameterEditor
- **By category:** 135 context · 47 action · 5 snapshot · 2 calculator · 1 debug
- **Skills:** 43 markdowns under `BUILD MEP Plan/Skills/` (subset with `ship: true` is the public-facing set; the rest are dev tooling)
- **Plans:** ~50+ markdowns under `BUILD MEP Plan/` plus the per-discipline `Class Structure.md` files
- **REST API attribute system:** designed and documented (`[RestApi]`, `[RestApiParam]`, `[RestApiResponse]` in Class Structure §REST API Exposure), `generate_rest_api_registry.py` script **not yet created** — first deliverable in Phase 2.
