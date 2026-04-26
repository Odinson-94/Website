# MEPBridge ↔ Website Integration Plan

> Single document for the MEPBridge dev (you, future-you, or anyone else) that
> describes exactly what to merge into the MEPBridge repo so the website's
> automated pipeline can pull rich metadata from the C# source.
>
> Everything here lives under `handoff/MEPBridge/` in this Website repo and is
> ready to copy into MEPBridge as-is.

---

## TL;DR — what to merge and where

| File from `handoff/MEPBridge/` | Drop into MEPBridge at | Why |
|---|---|---|
| `Attributes/HasUIAttribute.cs`            | `MEPBridge.Revit/Tracking/HasUIAttribute.cs` | Marks commands with a desktop UI window. Drives the website's "Has UI" badge + screenshot embed. |
| `Attributes/HasWebAppAttribute.cs`        | `MEPBridge.Revit/Tracking/HasWebAppAttribute.cs` | Marks commands with a web-app surface. Drives the "Open in browser" link on the page. |
| `Attributes/RestApiAttribute.cs`          | `MEPBridge.Revit/Tracking/RestApiAttribute.cs` | Public REST API marker + param/response variants. Drives the REST API reference pages. |
| `Attributes/FeatureAttribute.cs`          | `MEPBridge.Revit/Tracking/FeatureAttribute.cs` | **NEW.** Multiple per command/tool. Drives the website's `features[]` block. Optional `Group=` for grouped feature lists (QA Manager pattern). |
| `Attributes/DetailParagraphAttribute.cs`  | `MEPBridge.Revit/Tracking/DetailParagraphAttribute.cs` | **NEW.** Long-form, time-savings-quantified description. Drives the new "Description" section on every page (left of the brand pull-quote). |
| `Attributes/PillarAttribute.cs`           | `MEPBridge.Revit/Tracking/PillarAttribute.cs` | **NEW.** Buckets a command into a mini-project (Drainage / Lighting / Ventilation / etc.). Drives the grouped commands inventory + filter dropdown. |
| `Attributes/SeoIntentAttribute.cs`        | `MEPBridge.Revit/Tracking/SeoIntentAttribute.cs` | **NEW.** Per-section H3 phrases (`why`, `shift`, `special`, `who`). Drives the visible AEO-targeted H3s + JSON-LD signals. |
| `Attributes/RelatedToAttribute.cs`        | `MEPBridge.Revit/Tracking/RelatedToAttribute.cs` | **NEW.** Multiple per class. Drives the visible "Related" block + Schema.org `mentions[]` for internal-linking authority. |
| `tools/generate_command_registry.py`      | `MEPBridge.Revit/tools/generate_command_registry.py` | Extracts every `[Transaction]` class with full attribute + XML-doc surface → `command_registry.json`. |
| `tools/generate_ui_surfaces.py`           | `MEPBridge.Revit/tools/generate_ui_surfaces.py` | Extracts `[HasUI]` / `[HasWebApp]` + heuristic XAML/React detection → `ui_surfaces.json`. |
| `tools/generate_rest_api_registry.py`     | `MEPBridge.Revit/tools/generate_rest_api_registry.py` | Extracts `[RestApi]` + params + responses → `rest_api_registry.json`. |

**Existing extractor (already in MEPBridge):** `generate_mcp_registry.py` — keep as-is. The new ones follow the exact same pattern so they slot in next to it.

---

## End-to-end data flow

```
┌──────────────────────────────────────────────────────────────────────────┐
│  MEPBridge repo                                                          │
│  ─────────────                                                           │
│  [Transaction] + [Feature] + [DetailParagraph] + [HasUI] + ... attributes│
│  ↓                                                                       │
│  MSBuild target runs: python tools/generate_*.py                         │
│  ↓                                                                       │
│  bin/registries/                                                         │
│    ├── command_registry.json      (163+ commands, full surface)          │
│    ├── tool_registry.json         (191+ MCP tools)                       │
│    ├── ui_surfaces.json           (per-command UI metadata)              │
│    └── rest_api_registry.json     (public REST API)                      │
└──────────────────────────────────────────────────────────────────────────┘
                                ↓
                  GitHub Actions: bundle + sanitise
                                ↓
                  repository_dispatch → Website repo
                                ↓
┌──────────────────────────────────────────────────────────────────────────┐
│  Website repo (this folder)                                              │
│  ────────────                                                            │
│  data/registries/<file>.json    (bundle lands here, in a PR)             │
│  ↓                                                                       │
│  adelphos_CLI auto-all                                                   │
│  ↓                                                                       │
│  • per-tool pages, per-command pages (auto from registries)              │
│  • inventory + grouping by pillar                                        │
│  • sitemap.xml + robots.txt + llms.txt                                   │
│  ↓                                                                       │
│  dist/  →  pushed to adelphos.ai                                         │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Step 1 — Add the 5 attributes to MEPBridge

All five live in `MEPBridge.Revit.Tracking`. Drop the `.cs` files in the table above into `MEPBridge.Revit/Tracking/` (or the equivalent namespace folder). Build. Done — they're now usable across the codebase.

### Existing usage you can copy from

```csharp
// Already merged earlier
[HasUI("CobieSheetWindow",
       Type = "WPF",
       Description = "20-sheet tabbed COBie data grid",
       LiveScreenshot = "ui-screenshots/cobie-sheet-window.png")]
[HasWebApp("/cobie", "React")]
[Transaction(TransactionMode.Manual)]
public class OpenCobieSheetWindowCommand : ExternalCommand { ... }
```

### NEW usage — `[Feature]` and `[DetailParagraph]`

```csharp
[DetailParagraph(@"Schedule Builder reads the live Revit model, your house
schedule template, your calc spreadsheets and your preferred-manufacturer
library, then produces every schedule the project needs in one go: radiators,
AHUs, fans, lights, fixtures, and any custom schedule type you've configured.
It saves them into your project's Schedules/ folder, formatted exactly to your
house style. Then it runs a three-way gap analysis: what's in the schedule but
missing from the model, what's in the model but missing from the schedule, and
which rows disagree with your calculations. For a typical commercial scheme,
this collapses what is normally 4–8 hours per schedule of hand-building plus
another half-day of pre-issue cross-checking into about 20 minutes of review.")]
[Feature("Builds Revit schedules from the model",
         "Radiators, AHUs, fans, lights, fixtures + your custom schedule types — all populated from live element data.")]
[Feature("House schedule templates",
         "Your office templates applied automatically; output formatted exactly like your manual schedules.")]
[Feature("Three-way gap analysis",
         "Model vs schedule vs calc cross-checked. Every disagreement flagged with both values.")]
[Transaction(TransactionMode.Manual)]
public class BuildSchedulesCommand : IExternalCommand
{
    public Result Execute(...) { ... }
}
```

### Grouped features (QA Manager pattern)

When the same command performs many checks across categories, use `Group=`:

```csharp
[Feature("Line weights", "Every line on every sheet checked against your house line-weight standard.", Group = "Drawing checks")]
[Feature("Layer naming", "Layer names validated against your office naming convention.",                Group = "Drawing checks")]
[Feature("Sheet borders + title block", "Title block parameter completeness, project info, revision block.", Group = "Drawing checks")]
[Feature("Row reconciliation", "Every schedule row reconciled against the model element it represents.",     Group = "Schedule checks")]
[Feature("Missing rows",       "Elements present in the model but missing from the schedule — flagged.",     Group = "Schedule checks")]
// ...
[Transaction(TransactionMode.Manual)]
public class RunQAGateCommand : IExternalCommand { ... }
```

The website's extractor groups features by `Group` and renders one `<section class="features-group">` per distinct group name.

### Alternative: XML doc tags (also supported)

If you'd rather keep narrative content as XML doc rather than attribute strings:

```csharp
/// <summary>Builds every Revit schedule the project needs and gap-analyses against the model.</summary>
/// <detail>Schedule Builder reads the live Revit model, your house schedule template ...
/// (full long-form text here, multi-line OK) ...</detail>
/// <feature>Builds Revit schedules from the model | Radiators, AHUs, fans, lights, fixtures...</feature>
/// <feature>House schedule templates | Your office templates applied automatically...</feature>
[Transaction(TransactionMode.Manual)]
public class BuildSchedulesCommand : IExternalCommand { ... }
```

The Python extractor reads both. Attribute wins if both forms exist for the same command.

---

## Step 2 — Wire the Python extractors into the build

Add to `MEPBridge.Revit.csproj` (next to the existing `generate_mcp_registry.py` target):

```xml
<Target Name="GenerateRegistries"
        BeforeTargets="Build"
        Inputs="@(Compile)"
        Outputs="bin\registries\command_registry.json;
                 bin\registries\tool_registry.json;
                 bin\registries\ui_surfaces.json;
                 bin\registries\rest_api_registry.json">
  <Exec Command="python tools/generate_mcp_registry.py     bin/registries/tool_registry.json" />
  <Exec Command="python tools/generate_command_registry.py bin/registries/command_registry.json" />
  <Exec Command="python tools/generate_ui_surfaces.py      bin/registries/ui_surfaces.json" />
  <Exec Command="python tools/generate_rest_api_registry.py bin/registries/rest_api_registry.json" />
</Target>
```

After every successful build, `bin/registries/` will contain four JSON files representing the entire surface area of the codebase.

---

## Step 3 — Bundle + cross-repo sync

`.github/workflows/sync-to-website.yml` (in MEPBridge repo):

```yaml
name: Sync to Website
on:
  push:
    branches: [main]
    paths:
      - 'MEPBridge.Revit/**/*.cs'
      - 'BUILD MEP Plan/Skills/**'
jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-dotnet@v4
        with: { dotnet-version: '8.0.x' }
      - uses: actions/setup-python@v5
        with: { python-version: '3.12' }
      - run: dotnet build MEPBridge.sln -c Release
      - name: Sanitise registries
        run: python tools/sanitise_registries.py bin/registries/ artifact/
      - name: Trigger Website rebuild
        uses: peter-evans/repository-dispatch@v3
        with:
          token: ${{ secrets.WEBSITE_REPO_PAT }}
          repository: adelphos-ai/website
          event-type: registries-updated
          client-payload: |
            { "sha": "${{ github.sha }}", "registries_url": "..." }
```

Website-side workflow (already exists at `.github/workflows/sync-from-mepbridge.yml`):
- Listens for `registries-updated`.
- Downloads the artifact bundle.
- Drops into `data/registries/`.
- Runs `node scripts/adelphos_CLI.mjs auto-all`.
- Opens a PR with the diff for human review.
- Merging the PR triggers deploy.

---

## Step 4 — What the website does on its end

Already shipped in this repo. Once registries land:

1. `adelphos_CLI extract` re-reads the new JSON.
2. `adelphos_CLI auto-all` regenerates:
   - 191 tool pages (from `tool_registry.json`)
   - 163 command pages (from `command_registry.json`, grouped by pillar)
   - All inventory pages
   - All app/service pages (these are hand-curated in `sandbox/data/apps.json` — not from MEPBridge — but they share the same template machinery)
   - sitemap.xml (441+ URLs), robots.txt, llms.txt
   - Comparison + changelog + glossary pages
3. Each tool/command page now picks up its `[Feature]` and `[DetailParagraph]` content automatically because the Tool Page schema (`BUILD WEB Plan/Page Type Skills/Tool Page/schema.json`) already declares those fields as optional.

---

## Step 4½ — The complete extraction map (every field, every page, every source)

> The big table. Every field on every page type is listed here with where the
> data comes from. Use this as the single source of truth when adding fresh
> content or wiring a new attribute.

### 4½.1 — How a single command page is assembled

`/dist/docs/commands/<slug>/index.html`

| Page section | Field | Source on the MEPBridge side | Falls back to |
|---|---|---|---|
| **`<head>` SEO** | `<title>` | `<summary>` first sentence | C# class name humanised |
| | `meta description` | `<summary>` first sentence | C# class name |
| | `meta keywords` | `[Keywords("a","b")]` attr or `<keywords>` doc tag | empty |
| | `link rel=canonical` | derived from slug | derived |
| | `og:type` | always `article` for commands | — |
| | `og:image` | `[HasUI(LiveScreenshot=...)]` or `default.png` | `default.png` |
| **JSON-LD** | `WebSite` block | `sandbox/data/site.json` (Website-side) | site.json |
| | `TechArticle` block | `<summary>` + `[DetailParagraph]` | `<summary>` |
| | `HowTo` block (if `<logictree>` present) | `<logictree>` XML doc tag | omitted |
| | `FAQPage` block | auto-derived from `the_shift` + `<aiprompts>` | auto |
| | `BreadcrumbList` | derived from URL path | derived |
| | `mentions[]` | `[RelatedTo]` attrs | empty |
| **Hero card** | H1 title | `[Transaction]` class name → display name | — |
| | Hero claim | `[SeoIntent("why", ...)]` | `<summary>` first sentence |
| | Tagline | `<usecase>` doc tag | empty |
| | Surface badge | "Revit command" + `[HasUI]` / `[HasWebApp]` flags | "Revit command" |
| | Pillar badge | `[Pillar("Drainage")]` | "General" |
| | Primary CTA | "Run via Revit Copilot" → `/dist/apps/revit-copilot/` | — |
| **Outcomes strip** | 4 stat tiles | hand-curated in JSON only (apps), or skipped for commands | skipped |
| **Description (H2)** | Detail paragraphs | `[DetailParagraph]` attr or `<detail>` XML tag | `<usecase>` |
| | Right-column quote | site-wide (`sandbox/data/brand.json`) | brand.json |
| **Hero video** | `<video>` | `[HasUI(LiveScreenshot=...)]` adjacent `.mp4` | placeholder |
| **The shift (H2)** | Before / After | `<beforeafter>` doc tag (split on `\|`) | omitted |
| **Features (H2)** | Capability rows | `[Feature(name, desc)]` (multiple) | `<feature>` doc tags |
| | Grouped variant | `[Feature(..., Group="…")]` | flat |
| **Install (H2)** | Platforms | "Revit 2022 → 2026" derived from `[Transaction]` target frameworks | — |
| | Requirements | hard-coded ("Revit running, MEP Bridge installed") | — |
| | CTA | "Install via Revit Copilot" → `/dist/apps/revit-copilot/` | — |
| **Inputs / Returns (H2)** | Tables | `[SelectionInput]`, `[ConfigInput]`, `[Output]` attrs | empty |
| **Decision flow (H2)** | Code block | `<logictree>` XML doc tag | omitted |
| **Sample dialogue (H2)** | Agent / user lines | `<aiprompts>` XML doc tag | omitted |
| **REST API (H2)** | Endpoint + params | `[RestApi]` + `[RestApiParam]` attrs | omitted |
| **Keywords + Related (H2)** | Keyword pills | `[Keywords("a","b")]` or `<keywords>` | empty |
| | Related cards | `[RelatedTo]` attrs + auto-discover by shared keywords | auto |
| **FAQ (H2)** | Q/A pairs | auto from `<usecase>`, `<beforeafter>`, `<aiprompts>` | auto |
| **Side effects warning** | Callout | `<sideeffects>` doc tag | omitted |
| **Provenance footer** | Generated stamp | `git rev-parse HEAD` + ISO timestamp | — |

### 4½.2 — How a single MCP tool page is assembled

`/dist/docs/tools/<name>/index.html`

| Page section | Field | Source |
|---|---|---|
| `<head>` SEO | title, description | `[McpTool(Description=...)]` |
| | keywords | `[Keywords]` attr |
| Hero | Tool name | `[McpTool(Name=...)]` |
| | Category badge | `[McpTool(Category=...)]` (`context`/`action`/`snapshot`/`calculator`/`debug`) |
| | "Always available" badge | `[McpTool(AlwaysAvailable=true)]` |
| | Bridge | `[McpTool(Bridge=...)]` |
| Description | Long-form | `[DetailParagraph]` or `<detail>` |
| Parameters | Table | `[McpParam(Name, Type, Description, Required)]` (multiple) |
| Returns | Block | `<returns>` doc tag |
| Features | Capability rows | `[Feature]` attrs |
| Example prompts | 3 prompts | `<aiprompts>` doc tag |
| Related tools | Cards | `[RelatedTo]` + auto-discover |
| FAQ | Q/A | auto-derived |

### 4½.3 — How a workflow page is assembled

`/dist/workflows/<slug>/index.html`

Workflows aren't from C# — they come from `BUILD MEP Plan/Skills/<slug>.md` skill markdown.

| Page section | Source on the MEPBridge side |
|---|---|
| H1 + H2s | Skill markdown headings (parsed by `scripts/lib/drafter.mjs`) |
| Description | `## Overview` section |
| The shift | `## When to use` (before) + `## What it ships` (after) |
| Features | `## What ships with it` bullets |
| Settings table | `## Settings & options` table |
| Step-by-step screenshots | `/sandbox/workflow-assets/<slug>/flow-N.svg` (filesystem) |
| Hero video | `/sandbox/workflow-assets/<slug>/hero.mp4` |
| Provenance | the source skill path |

### 4½.4 — Pages that are 100% Website-side (no MEPBridge input needed)

| Page | Source |
|---|---|
| `/dist/apps/*` (7 app detail pages + inventory) | `sandbox/data/apps.json` |
| `/dist/agentic-services/*` (3 service pages + inventory) | `sandbox/data/agentic-services.json` |
| `/dist/demos/*` | `sandbox/data/demos.json` + asset folders |
| `/dist/compare/*` (5 competitor pages) | `sandbox/data/comparisons.json` |
| `/dist/changelog/index.html` | `sandbox/data/changelog.json` |
| `/dist/glossary/index.html` | `sandbox/data/glossary.json` |
| `/dist/resources/index.html` | `sandbox/data/resources.json` |
| `/dist/downloads/index.html` | `sandbox/data/downloads.json` |
| Top menubar | `sandbox/data/nav.json` (rendered client-side by `sandbox/shell.js`) |
| `/sitemap.xml` | derived from every other registry + JSON file |
| `/robots.txt` | `sandbox/data/site.json` `ai_crawlers_allowed[]` |
| `/llms.txt` | derived from apps + services + docs roots |

### 4½.5 — How SEO/AEO actually marries with MEPBridge

The website's SEO/AEO surface (`scripts/lib/seo.mjs`) has 4 inputs per page:

```
┌──────────────────────────────────────────────────────────────────────┐
│  1. <head> meta block                                                │
│     ├─ title           ← page title (from C# class name + summary)   │
│     ├─ description     ← from <summary> XML tag                      │
│     ├─ keywords        ← from [Keywords] attr                        │
│     ├─ canonical       ← derived from slug                           │
│     ├─ Open Graph      ← title + desc + og:image                     │
│     └─ Twitter card    ← summary_large_image                         │
│                                                                      │
│  2. JSON-LD per page kind                                            │
│     ├─ WebSite + Org    ← always (sandbox/data/site.json)            │
│     ├─ TechArticle      ← from <summary> + [DetailParagraph]         │
│     ├─ HowTo            ← from <logictree> if present                │
│     ├─ FAQPage          ← auto from the_shift + <aiprompts>          │
│     ├─ BreadcrumbList   ← from URL path                              │
│     └─ mentions[]       ← from [RelatedTo] attrs                     │
│                                                                      │
│  3. Visible H3 SEO sub-headings                                      │
│     ├─ why_h3      ← [SeoIntent("why",     "...")]                   │
│     ├─ shift_h3    ← [SeoIntent("shift",   "...")]                   │
│     ├─ special_h3  ← [SeoIntent("special", "...")]                   │
│     └─ who_h3      ← [SeoIntent("who",     "...")]                   │
│                                                                      │
│  4. Auto-FAQ block (visible <details> + JSON-LD)                     │
│     └─ Q/A pairs   ← derived from <usecase>, <beforeafter>,          │
│                       <aiprompts>, [Feature], <surface>, <bestfor>   │
└──────────────────────────────────────────────────────────────────────┘
```

To get **rich SEO + AEO** on every command page, just add the four `[SeoIntent]` attributes plus `[Keywords]`. Everything else flows from the existing `<summary>`, `<usecase>`, `<aiprompts>` and `[Feature]` attributes you've authored.

### 4½.6 — How internal linking flows (authority signals)

Three layers, all auto-derived once `[RelatedTo]` and `[Pillar]` are set:

1. **Visible "Related" block** at the bottom of every detail page —
   shows up to 3 cards (sibling commands/tools/apps/workflows).
2. **JSON-LD `mentions[]`** — same data as the visible block, but
   structured for AI engines and Google to follow without rendering.
3. **Auto-discovery** — when `[RelatedTo]` is missing, the website
   auto-suggests up to 3 siblings by shared `[Keywords]` overlap so the
   block is never empty.

Adding `[RelatedTo("workflow", "schedules")]` to a command linking it to the
Schedules workflow gives you:

- A "Related" card on the command page → the workflow page.
- A "Related" card on the workflow page → back to the command (bidirectional).
- A `mentions[]` entry in JSON-LD on both sides.
- A higher topical-authority signal to Google for both pages.

### 4½.7 — Header sizing + page structure (so the H1/H2/H3 hierarchy is consistent)

The website enforces this hierarchy on every detail page. The MEPBridge dev
doesn't need to do anything — the templates already emit the right tags — but
it's documented here so authoring decisions stay aligned.

| Tag | Where it appears | Source |
|---|---|---|
| `<h1>` | App / command / tool / service name (in the dark hero card, 56px) | one per page |
| `<h2>` | Section headings (Description, Features, Install, The shift, FAQ, Related, …), 36px / 500 / -0.025em — same scale as the brand quote | one per top-level section |
| `<h3>` | Group labels inside Features, sub-sections, "Where this came from" | optional |

If you add a new section to a page, use `<h2>` with an `id="..."` so it shows
in the right rail "On this page" and is linkable.

### 4½.8 — Additional MEPBridge-side niceties (optional)

These don't block anything but improve auto-generation quality:

| C# / XML construct | What the website does with it |
|---|---|
| `[Keywords("revit","schedule","mep")]` | meta keywords + related auto-discovery |
| `<beforeafter>Manual: ... \| With Adelphos: ...</beforeafter>` | "The shift" section |
| `<bestfor>MEP designers \| BIM coordinators</bestfor>` | "Who it's for" pills |
| `<surface>Revit add-in · Windows</surface>` | surface badge under H1 |
| `<sideeffects>Modifies family parameters</sideeffects>` | warning callout |
| `<precondition>Document open and modifiable</precondition>` | "Before you start" callout |
| `<postcondition>Schedule saved into Schedules/</postcondition>` | "After it runs" callout |

All of these are read by the existing `generate_command_registry.py` extractor.
The website's Tool Page + Command Page templates render them when present and
hide the section when absent.

---

## Step 5 — Migrating existing content (optional but recommended)

For maximum auto-generation, walk through the codebase command-by-command and add (in priority order):

1. **`[Pillar("...")]`** — buckets the command into a mini-project (102 of 163 commands are currently `Uncategorised` because the `pillar` field isn't set in the source). Drives the grouped commands inventory + filter dropdown. **Single highest-impact change** — touch every command, takes seconds each.
2. **`[Feature(...)]`** attributes — one per real capability (typically 5–12 per substantial command). Drives the Features section. Use `Group="..."` for QA-style grouped lists.
3. **`[DetailParagraph(...)]`** — quantified time-savings prose (`BUILD WEB Plan/Page Type Skills/Tool Page/SKILL.md` has authoring guidance: 80–180 words, lead with mechanism, quantify the saving, end with cumulative effect).
4. **`[SeoIntent("why|shift|special|who", "...")]`** — four short intent-keyword phrases per command. Drives both the visible H3 sub-headings and the AEO/JSON-LD signals.
5. **`[RelatedTo(kind, slug)]`** — declares relationships to other commands, tools, apps, workflows, demos. Drives the "Related" block and `mentions[]` JSON-LD.
6. **`[Keywords("a","b","c")]`** — search keywords; also feeds related auto-discovery when explicit `[RelatedTo]` is absent.

The website filter dropdown on `/dist/docs/commands/index.html` automatically reflects whatever pillars you set. The Related block, FAQ block, JSON-LD, sitemap, and llms.txt all regenerate without further wiring.

---

## What's already done on the Website side

- ✅ **8 C# attribute classes** ready to merge (this folder): `HasUI`, `HasWebApp`, `RestApi`, `Feature`, `DetailParagraph`, `Pillar`, `SeoIntent`, `RelatedTo`.
- ✅ **3 Python extractors** ready to merge (this folder).
- ✅ **Tool Page + Command Page schemas** extended with `detail_paragraph`, `features`, `feature_groups`, `seo`, `related[]`, `pillar`.
- ✅ **App Page + Agentic Service Page skill folders** with formal schemas.
- ✅ **Full SEO/AEO suite**: `<head>` meta + Open Graph + Twitter Cards + canonical + per-page JSON-LD (WebSite, Org, SoftwareApplication, Service, TechArticle, HowTo, VideoObject, FAQPage, BreadcrumbList, CollectionPage, DefinedTermSet, mentions[]) + `gitLastMod` per page.
- ✅ **Auto-generated FAQ blocks** on every detail page (visible `<details>`/`<summary>` + FAQPage JSON-LD), derived from `the_shift` + `key_outcomes` + `<aiprompts>` + `[Feature]`.
- ✅ **Auto-generated Related blocks** on every detail page (visible cards + `mentions[]` JSON-LD), with auto-discovery fallback by `[Keywords]` overlap.
- ✅ **Header hierarchy** locked: H1 (56px hero), H2 (36px section, matches brand-quote scale), H3 (22px sub-section).
- ✅ **`adelphos_CLI auto-all`** produces 441 URLs + `sitemap.xml` + `robots.txt` (21 AI crawlers explicitly allowed) + `llms.txt` (Anthropic-led standard) + 5 comparison pages + changelog (with `SoftwareApplication` JSON-LD) + glossary (with `DefinedTermSet` JSON-LD).
- ✅ **`repository_dispatch` listener** exists in the Website repo (`.github/workflows/sync-from-mepbridge.yml`).

## What the MEPBridge dev still needs to do

| # | Task | Effort |
|---|------|--------|
| 1 | ☐ Copy the **8 `.cs` files** from `handoff/MEPBridge/Attributes/` into `MEPBridge.Revit/Tracking/`. | 5 min |
| 2 | ☐ Copy the **3 Python extractors** from `handoff/MEPBridge/tools/` into `MEPBridge.Revit/tools/`. | 5 min |
| 3 | ☐ Add the `<Target Name="GenerateRegistries">` block to `MEPBridge.Revit.csproj`. | 5 min |
| 4 | ☐ Add the GitHub workflow `.github/workflows/sync-to-website.yml` (template above). | 10 min |
| 5 | ☐ Generate a `WEBSITE_REPO_PAT` secret with `repo` scope on the Website repo and add it to MEPBridge secrets. | 5 min |
| 6 | ☐ Bulk-annotate every command with `[Pillar("...")]` (single highest-impact authoring step — fixes the 102 Uncategorised commands). | 1–2 hr |
| 7 | ☐ (Recommended) Annotate the flagship 20–30 commands with `[Feature]` + `[DetailParagraph]` + `[SeoIntent]` + `[RelatedTo]`. | 4–6 hr |
| 8 | ☐ Push to `main`. The first sync will open a PR on the Website repo. | instant |

After step 8, MEPBridge → Website is fully automated. **Every** C# change that touches any of the 8 attributes, `[Transaction]`, `[McpTool]`, or any of the supported XML doc tags (`<summary>`, `<usecase>`, `<detail>`, `<feature>`, `<beforeafter>`, `<bestfor>`, `<surface>`, `<aiprompts>`, `<logictree>`, `<sideeffects>`, `<precondition>`, `<postcondition>`, `<keywords>`, `<returns>`) will trigger a regeneration on the website with a human-reviewable PR — including refreshed sitemap, llms.txt, JSON-LD, FAQ blocks, Related blocks, and SEO meta on every page.
