# Codebase Inventory — adelphos.ai

> The **real** comprehensive site map. Generated from a fresh clone of `MEPBridge@master` on 2026-04-20.
> Every URL on the public site is enumerated below. The inventory itself lives as JSON at
> `sandbox/data/tools.json` (191 tools) and `sandbox/data/commands.json` (163 commands).
>
> **Rule:** this list updates automatically when the codebase changes — never hand-edit page counts.

---

## Headline numbers

| Surface | Count today | Will reach the website |
|---------|:-----------:|------------------------|
| `[McpTool]` MCP tools (active, excluding `.backups/`) | **191** | one page per tool at `/docs/tools/<name>/` |
| `[Transaction]` Revit commands (active) | **163** | one page per command at `/docs/commands/<name>/` |
| `[RestApi]` external commands | **0** today | grows to all 163 once the attribute is added |
| Skill markdowns (`ship: true`) | ~30 | one page per skill at `/docs/skills/<slug>/` |
| Bridge categories (`requiresBridge`) | 6 | one page each at `/docs/bridges/<bridge>/` |
| Hand-curated demos | 25 (your list) | `/demos/<slug>/` |
| Hand-curated workflows | 7 (initial) | `/workflows/<slug>/` |
| Product pillars | 16 (your list) | `/products/<slug>/` |
| Marketing pages | 6 | existing |
| Resources / Downloads / Changelog / Search | ~25 + auto | various |
| **Total live URLs at first launch** | **≈ 445** | mostly auto-generated |

The last sitemap I wrote estimated ≈ 330 pages because I under-counted the per-discipline tools and commands. Real number is **~445**, almost all of it generated.

---

## Tools — 191 `[McpTool]` classes

### By bridge requirement

| Bridge | Count | What activates it |
|--------|:-----:|------------------|
| _(no bridge — generic / always)_ | 117 | Pure functions, snapshot, web, memory, file system. |
| `RevitContext` | 31 | Active Revit document required. |
| `DrawingExporter` | 27 | Drawing Exporter panel open. |
| `SelfDebug` | 9 | Debug mode toggled on. |
| `Snapshot` | 3 | Model snapshot exported. |
| `ParameterEditor` | 3 | Parameter Editor panel open. |
| **other / disabled** | 1 | (rounding, registry filtering) |

### By category

| Category | Count |
|----------|:-----:|
| `context` (read-only queries) | 135 |
| `action` (mutates state) | 47 |
| `snapshot` (SQLite ops) | 5 |
| `calculator` (derives values) | 2 |
| `debug` | 1 |
| **other** | 1 |

### By source folder

| Folder | Tools |
|--------|:-----:|
| `MEPBridge.Revit/AIChat/Tools/` | **89** (the central general-purpose set) |
| `MEPBridge.Revit/Revit.MEP.Suite/0.0 Design Models/` | **72** (per-discipline workhorses) |
| `MEPBridge.Revit/WarningManager/MCP/` | 7 |
| `MEPBridge.Revit/ClashManager/Manager/` | 7 |
| `MEPBridge.Revit/TransferStandards/Read/` | 6 |
| `MEPBridge.Revit/ErrorManager/MCP/` | 6 |
| `MEPBridge.Revit/DrawingExporter/MCPTools/` | 2 |
| `MEPBridge.Revit/AIChat/MCP-Servers/` | 2 |

### Always-available subset

**108 of 191** tools have `AlwaysAvailable = true` — these are loaded into the LLM's `tools[]` on every turn. The other 83 are discoverable via `discover_tools` and activated on demand.

### The full list

Full enumeration with `name`, `description`, `bridge`, `category`, `alwaysAvailable`, `param_count`, `folder`, `file` is at **`sandbox/data/tools.json`**.

Browseable HTML index at **`sandbox/docs/tools/inventory.html`** (open it in a browser to scroll all 191 with filters).

---

## Commands — 163 `[Transaction]` classes

### By source folder

| Folder | Commands | Notes |
|--------|:--------:|-------|
| `MEPBridge.Revit/Revit.MEP.Suite/0.0 Design Models/` | **66** | Per-discipline design commands (Drainage, Heating, Lighting, Ventilation, Sprinklers, Fire Alarm, Public Health, Comms, Power, Mechanical) and the Model Setup core (sheets, views, sections) |
| `MEPBridge.Revit/Commands/` | **42** (root) + 12 in `Selection/` | The chunky top-level Revit commands |
| `MEPBridge.Revit/ClashManager/` | 18 (`Manager 11`, `Finder 5`, `Solver 2`) | Clash detection + resolution |
| `MEPBridge.Revit/WarningManager/Commands/` | 6 | Revit warning triage and auto-resolve |
| `MEPBridge.Revit/TransferStandards/` | 5 (`Write 3`, `Views 1`, `Commands 1`) | Move standards between projects |
| `MEPBridge.Revit/{TaggingPreferences,SheetViewSetup,RoutingPreferences,WorksetManager,FilterTemplateManager,ErrorManager,DrawingExporter,QAManager,ProjectSettings,ObjectStyles,CobieSheet}/` | 11 (1 each) | One root command per panel |
| `MEPBridge.Revit/AIChat/{Snapshot,Hosts}/` | 2 | Snapshot export + AI Chat host |
| `MEPBridge.Revit/Revit.MEP.Suite/Config/` | 1 | Configuration command |

### Coverage of the rich attribute set (drives auto-generated content)

These commands already carry the metadata that drives the website page — **most of the work is done**:

| Tag / Attribute | Coverage | What it powers on the webpage |
|-----------------|:--------:|------------------------------|
| `[Keywords]` | **163 / 163  (100%)** | Search index, footer pills |
| `<usecase>` | 131 / 163  (80%) | Hero "When to use this" bullet list |
| `<notfor>` | 131 / 163  (80%) | "Don't use for" callout |
| `<aiprompts>` (preprompt, thinkingstep, success, failure) | 132 / 163  (81%) | "What you'll see" sample dialogue |
| `[Output]` | 119 / 163  (73%) | Returns table |
| `[ConfigInput]` | 86 / 163  (53%) | Inputs table — config side |
| `<logictree>` | 35 / 163  (21%) | "Decision flow" diagram |
| `[SelectionInput]` | 34 / 163  (21%) | Inputs table — selection side |
| `[RestApi]` | **0 / 163  (0%)** | **THE GAP** — this is the next thing to add to the codebase |

### The full list

Full enumeration with `class`, `folder`, `file`, `keywords`, `sel_inputs`, `cfg_inputs`, `outputs`, `has_usecase`, `has_notfor`, `has_logictree`, `has_aiprompts`, `has_restapi` is at **`sandbox/data/commands.json`**.

Browseable HTML index at **`sandbox/docs/commands/inventory.html`** (open it to scroll all 163).

---

## Per-discipline footprint (the deepest layer)

The `Revit.MEP.Suite/0.0 Design Models/` folder is where the per-discipline design work lives. Each numbered folder is one MEP discipline (52 = drainage in BS1192 / Uniclass numbering). These are the workhorses behind the discipline-design demo cards.

| # | Discipline | Tools (in scope) | Commands (in scope) |
|--:|------------|:----------------:|:-------------------:|
| 0.00 | Model Set Up (sheets, views, sections, templates, schedules, scope boxes) | many | many |
| 51 | Hot & Cold Water | yes | yes |
| 52 | Drainage / Soil & Vent | yes (incl. `place_svp`, `extend_all_connectors`) | yes (incl. `ExtendAllConnectorsCommand`, `PlaceSVPCommand`) |
| 56 | Heating | yes | yes |
| 57 | Cooling / Air Conditioning | yes | yes |
| 58 | Ventilation | yes | yes |
| 65 | Lighting | yes | yes |
| 66 | Power | yes | yes |
| 67 | Communications | yes | yes |
| 68 | Fire Detection / Alarm | yes | yes |
| 69 | Sprinklers | yes | yes |

Each discipline gets its own product-pillar landing page at `/products/<discipline>/` listing the tools, commands and demos that belong to it.

---

## Final URL count by section

| Section | URLs at launch | Source |
|---------|:--------------:|--------|
| Marketing (`/`, `/about`, `/contact`, `/roadmap`, `/privacy`, `/terms`) | 6 | hand |
| Products hub + 16 pillars (one per row in your message) | 17 | hand + data |
| Demos hub + 25 detail pages | 26 | video + YAML |
| Workflows hub + 7 detail pages | 8 | video + YAML |
| Docs landing + getting-started (6 guides) | 7 | hand |
| **Tool reference — `/docs/tools/<name>/`** | **191** | **auto from `[McpTool]`** |
| **Command reference — `/docs/commands/<name>/`** | **163** | **auto from `[Transaction]` + future `[RestApi]`** |
| Bridge reference | 6 | auto |
| Skill reference | ~30 | auto from MEP Bridge `Skills/Released/*.md` |
| API explorer (OpenAPI) | 1 | auto |
| Changelog (RSS + HTML) | 2 | auto from git |
| Resources hub + 12 detail pages | 13 | YAML |
| Downloads hub + 3 product detail pages | 4 | GH Releases + YAML |
| **Total** | **~474** | **≈ 90% auto-generated** |

The hand-written share is small: marketing copy, product-pillar narrative, demo bullet copy, workflow recipe copy, getting-started guides. Everything else flows from the codebase.

---

## What this changes vs my previous Site Map

| Before (estimate) | After (real) |
|-------------------|--------------|
| "190 tools" | **191** (exact, excluding `.backups/`) |
| "~25 [RestApi] commands" | **163 commands** (every `[Transaction]` class becomes a REST endpoint once tagged) |
| "~30 skills" | unchanged (depends on `ship: true` count) |
| Site Map listed slugs by hand | Site Map now points at **`sandbox/data/{tools,commands}.json`** as the source of truth — no hand maintenance |
| Page count estimate ~330 | Real ~474 |

---

## Where to look next

- **Inventory data:** `sandbox/data/tools.json`, `sandbox/data/commands.json`
- **Browseable lists:** `sandbox/docs/tools/inventory.html`, `sandbox/docs/commands/inventory.html`
- **Real auto-generated command page:** `sandbox/docs/commands/extend-all-connectors.html` — built from the `ExtendAllConnectorsCommand.cs` source, showing every section the attributes drive.
- **Attribute → webpage map:** `BUILD WEB Plan/Attribute to Webpage Map.md`
- **Coverage report:** `BUILD WEB Plan/Codebase Coverage Report.md`
