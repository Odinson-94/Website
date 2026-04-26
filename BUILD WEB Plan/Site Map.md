# Site Map — adelphos.ai

> Complete page enumeration. Every URL on the site is listed here. Used by the sitemap generator and the navigation builder.
>
> **Convention:** `[A]` = auto-generated from registry/markdown · `[H]` = hand-written marketing copy · `[V]` = video-driven page (placeholder asset folder per slug) · `[D]` = data-driven from a YAML file.

---

## Top-level navigation

```
Home · About · Roadmap · Contact · Apps▾ · Agentic Services▾ · Docs▾
```

Source of truth: `sandbox/data/nav.json` (rendered by `sandbox/shell.js`).
Adding/removing items is a JSON edit — no template changes.

Three dropdowns:

- **Apps▾** (children loaded from `sandbox/data/apps.json`)
  - Revit Copilot (flagship) · Adelphos Chat · Specbuilder · Report Builder · Document Controller · QA Manager · Schedule Builder
- **Agentic Services▾** (children from `sandbox/data/agentic-services.json`)
  - Finances (flagship) · Project Management · Document Controller (managed)
- **Docs▾** (children listed inline in `nav.json`)
  - Docs Home · Tools (191) · Commands (163) · Demos · Workflows · Resources · Downloads

Apps download/run online — no contact required. Agentic Services are the only contact-driven pages.

---

## /  ·  Home  [H]

Existing 12-view brain canvas experience stays. View 4 (currently the video gallery) becomes a **featured demos** strip linking into `/demos/`.

---

## /apps  ·  Apps hub  [A + D]

Auto-generated from `sandbox/data/apps.json`. Inventory page features the flagship in a hero card; the rest live as premium tiles. Each app has a detail page with hero claim, outcomes strip, before/after shift, "what makes it special", and a self-serve download/run CTA. **No "contact" / "book a walkthrough" — apps are self-serve.**

```
/dist/apps/
├── index.html                          [A]   flagship hero (Revit Copilot) + 6 premium tiles
├── revit-copilot/index.html            [A + D]   FLAGSHIP — Revit add-in agent · 18× faster
├── adelphos-chat/index.html            [A + D]   browser / desktop agent
├── specbuilder/index.html              [A + D]   spec authoring
├── report-builder/index.html           [A + D]   report composition
├── document-controller/index.html      [A + D]   doc-control desktop service
├── qa-manager/index.html               [A + D]   QA dashboard + add-in
└── schedule-builder/index.html         [A + D]   schedules + gap analysis
```

Generators: `scripts/build-app-pages.mjs` (`buildAppsInventory`, `buildAllAppPages`).
Build cmd: `adelphos_CLI auto-all` (or per-app: `adelphos_CLI build app revit-copilot`).

---

## /agentic-services  ·  Agentic Services hub  [A + D]

Auto-generated from `sandbox/data/agentic-services.json`. Crown-jewel layout: green/teal palette to differentiate "managed service" from "app". Flagship hero card + premium tiles, then per-service detail pages with hero claim, outcomes strip, before/after shift, "what we offer", "how it becomes agentic" maturity ladder, "what makes it special", engagement model. **These are the only contact-driven pages on the site** — agentic services require a sales conversation; everything else self-serves.

```
/dist/agentic-services/
├── index.html                          [A]   flagship hero (Finances) + supporting tiles
├── finances/index.html                 [A + D]   FLAGSHIP — quotations · invoicing · reconciliation · forecasting
├── project-management/index.html       [A + D]   task allocation · deadline tracking · data ingestion · EPC tracker
└── document-controller/index.html      [A + D]   managed Document Controller — revisions · transmittals · golden thread
```

Generators: `scripts/build-agentic-pages.mjs`.
Build cmd: `adelphos_CLI build agentic finances`.

---

## /products  ·  Products hub  [H + D]

Landing page that lists all product pillars. Each pillar is its own sub-page; each sub-page lists demos + tools + commands relevant to it.

```
/products/
├── client-briefing/                          [H + D]   Client-facing intake & history
│     ├── demos relevant to this product           (linked from /demos)
│     ├── tools relevant to this product           (linked from /docs/tools)
│     └── commands relevant to this product        (linked from /docs/commands)
│
├── reports/                                   [H + D]
│     • MEP Strategy · Site Survey · Option Appraisal · IESVE · Clash · Stage 2 · Stage 3
│
├── specifications/                            [H + D]
│     • MEP Specification from Revit
│
├── schedules/                                 [H + D]
│
├── revit-modelling/                           [H + D]   "Utilities" — the workhorse tools
│     • Smart Notes · Place SVP · Extend Connectors · Snap to Wall · Smart Tagging
│     • Schedule Creator · Builderswork Tool · all the rest
│
├── qa/                                        [H + D]
│     • Check Drawings · Check Specification · Check Schedules · Check Revit Model
│     • Clash Reporting · Automated QA Checks · ACC Clash Issues
│
├── bim/                                       [H + D]
│     • COBie · BIM Compliance · Drawing Numbering · Family Swapper (Coming)
│
├── document-controller/                       [H + D]
│     • Drawing Revisions · Latest Revision Check · Drawing Export
│
├── finances/                                   [H + D]   (optional / paid tier)
│     • Quotations · Invoicing · Forecasting · Reconciliation
│
├── project-management/                         [H + D]   (optional / paid tier)
│     • Task Assignment · Job Tracking · Data Storage · Team Tracking
│
├── epcs-sbem-sap/                              [H + D]
│
├── 2d-to-3d/                                  [H + D]
│
├── modes/                                      [H]
│     • Designer Mode (Plan)
│     • Build Mode (Build)
│     • QA Mode (Check)
│     • Ask Mode (On site)
│
├── build-your-own-tool/                        [H + D]
│
├── arch/                                       [H + D]   architecture-side toolkit
│     • 2D to 3D · Workflows (Model Set Up · Views · Sections · Elevations)
│
└── future/                                     [H]
      • MEP Design · ...
```

---

## /demos  ·  Demos hub  [V + D]

The video demo gallery. **Master inventory** below. Each demo = one detail page with the fixed card layout (screenshot, header, paragraph, video, paragraph + bullets, footer).

```
/demos/
├── index.html                                 [D]   gallery — filterable by product pillar
│
├── how-to-navigate/                           [V]   ★ Phase 1 priority
├── place-svp/                                  [V]   ★
├── extend-connectors/                         [V]   ★
├── model-setup-views/                          [V]
├── model-setup-templates/                     [V]
├── qa-manager-error-detection/                 [V]
├── qa-manager-clash-detection/                 [V]
├── cobie-manager/                              [V]
├── snap-objects-to-wall/                       [V]
├── fire-alarm-design/                          [V]   ★
├── pipe-up-bathroom/                           [V]   (Coming Soon badge)
├── lighting-design/                            [V]
├── ventilation-design/                         [V]
├── sprinkler-design/                           [V]
├── place-fan-coil-units/                       [V]
├── snap-to-wall/                               [V]
├── warnings-manager/                           [V]
├── document-control/                           [V]
├── parameter-editor/                           [V]
├── drawing-export/                             [V]
├── auto-notes/                                 [V]
├── smart-tagging/                              [V]
├── mep-specification-from-revit/               [V]
├── schedule-creator/                           [V]
└── iesve-report-creator/                       [V]
```

**Filter facets on the gallery:**
- Product pillar (Modelling · QA · BIM · Reports · Specifications · …)
- Mode (Designer · Build · QA · Ask)
- Status (Live · Coming Soon)
- Discipline (Mechanical · Electrical · Public Health · Fire · Acoustic · …)

---

## /workflows  ·  Workflows hub  [D]

End-to-end multi-step recipes that chain several tools/commands together. Different from a single demo because it shows a **full job** (e.g. "from Stage 2 brief to coordinated Stage 3 model").

```
/workflows/
├── index.html                                 [D]
├── new-job-from-brief-to-stage-2/             [V + D]
├── stage-3-coordination-handover/             [V + D]
├── set-up-a-new-project-from-template/        [V + D]
├── run-end-of-stage-qa-pack/                  [V + D]
├── issue-cobie-handover-package/              [V + D]
├── monthly-cdn-issue-with-revisions/          [V + D]
└── …                                          (one per archetype)
```

---

## /docs  ·  Documentation hub  [A]

Everything here is auto-generated from MEP Bridge artefacts.

```
/docs/
├── index.html                                  [A]   landing + global search
│
├── getting-started/                            [H]
│     ├── install/
│     ├── first-prompt/
│     ├── api-quickstart/
│     ├── connect-revit-to-cloud/
│     └── troubleshooting/
│
├── tools/                                      [A]   one page per [McpTool]
│     ├── index.html                                  filterable index of all 190
│     ├── list_rooms.html
│     ├── get_document_info.html
│     ├── snapshot_query.html
│     └── …                                          ~190 today, growing
│
├── commands/                                   [A]   one page per [RestApi] command
│     ├── index.html
│     ├── export_clash_results_to_xml.html
│     ├── resize_entire_pipe_network.html
│     └── …                                         however many you tag
│
├── bridges/                                    [A]   one page per requiresBridge value
│     ├── index.html
│     ├── revit-context.html
│     ├── drawing-exporter.html
│     ├── parameter-editor.html
│     ├── snapshot.html
│     ├── self-debug.html
│     └── generic.html
│
├── skills/                                     [A]   one page per ship:true Skill
│     ├── index.html
│     ├── parameters.html
│     ├── routing-preferences.html
│     ├── coordination.html
│     ├── schedules.html
│     └── …                                         ~30+ today
│
├── api/                                        [A]
│     ├── index.html                                 OpenAPI explorer (Stoplight Elements)
│     ├── openapi.json
│     └── <command>.html                            same content as /docs/commands/<…>
│
└── changelog/                                  [A]   from conventional commits + tags
      ├── index.html
      └── feed.xml
```

---

## /resources  ·  Resources hub  [D]

Driven by `data/resources.yaml`.

```
/resources/
├── index.html                                  [D]
├── families/                                   [D]
│     ├── index.html                                 (filtered to category=families)
│     └── <slug>.html                                one per pack
├── templates/                                  [D]
│     └── <slug>.html
└── asset-data/                                 [D]
      └── <slug>.html
```

---

## /downloads  ·  Downloads hub  [D]

Driven by `data/downloads.yaml` + GitHub Releases API.

```
/downloads/
├── index.html                                  [D]
├── revit-addin/                                [D]   per-Revit-year MSI
├── autocad-bundle/                             [D]   per-AutoCAD-year .bundle
├── document-controller/                        [D]   WPF installer
└── version.json                                [D]   machine-readable manifest
```

---

## Existing marketing pages (kept as-is, just polished)

```
/about/           [H]   already shipped
/contact/         [H]   already shipped
/roadmap/         [H]   already shipped
/privacy/         [H]   already shipped
/terms/           [H]   already shipped
```

---

## Total page count at first launch

| Section | Pages | Type | Status |
|---------|-------|------|--------|
| Marketing (existing) | 5 | hand | live |
| **Apps hub + 7 detail pages** | **8** | **auto + data** | **live** |
| **Agentic Services hub + 3 detail pages** | **4** | **auto + data** | **live** |
| Demos hub + 60 detail pages | 61 | video + data | hub live, 1 detail live |
| Workflows hub + per-workflow pages | 1 + N | video + data | hub live, 1 detail live |
| Docs landing + getting-started | 6 | hand | landing live |
| Tool reference (191 pages) | 191 | auto | inventory live, 1 detail live |
| Command reference (163 pages) | 163 | auto | inventory live, 1 detail live |
| Bridge reference | 6 | auto | planned |
| Skill reference | 30+ | auto | planned |
| API reference (REST) | 1 explorer + per-command | auto | planned |
| Resources hub + categories | 5 | data | hub live |
| Downloads hub + items | 5 | data | hub live |
| **Total when fully built** | **≈ 484** | **mostly automated** | |

Hand-curated: marketing (5), getting-started copy. Everything else is auto-generated from `sandbox/data/*.json`, `data/registries/*.json`, and the MEP Bridge skill markdown.
