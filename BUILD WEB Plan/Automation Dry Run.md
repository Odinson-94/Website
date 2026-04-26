# Automation Dry Run

> How a single YAML row becomes a live page. Walks through demo · tool · command · workflow with the exact source → script → output mapping.
>
> **The prime directive:** the sandbox HTML pages we just built ARE the templates. The generators read YAML/registry and produce identical output. Nothing diverges.

---

## Five inputs → five page types

| Input file | Generator script (TODO) | Output | Live count target |
|------------|-------------------------|--------|---|
| `data/demos/<slug>.yaml` (hand) | `build-demo-pages.mjs` | `dist/demos/<slug>/index.html` + entry on gallery | 25 today |
| `data/registry.json` (synced from MEP Bridge) | `build-tool-pages.mjs` | `dist/docs/tools/<name>/index.html` | 190 today |
| `data/rest_api_registry.json` (synced) | `build-command-pages.mjs` | `dist/docs/commands/<name>/index.html` | 0 today (need `[RestApi]` tags) |
| `data/workflows/<slug>.yaml` (hand) | `build-workflow-pages.mjs` | `dist/workflows/<slug>/index.html` | 7 planned |
| `data/products/<pillar>.yaml` (hand) | `build-product-pages.mjs` | `dist/products/<pillar>/index.html` | 16 planned |

---

## Walkthrough 1 — Demo page  (the hand-curated path)

### Input

`data/demos/place-svp.yaml`:

```yaml
slug: place-svp
title: "Place SVP — Soil & Vent Pipe in 3 clicks"
status: live
product_pillar: revit-modelling
discipline: public-health
order: 12
duration_s: 47
lead: |
  Drop a soil & vent pipe through every floor in three clicks.
  BUILD MEP places the pipe, fits the boss connections, snaps to
  the nearest waste branch, and updates the schedule — without
  leaving the plan view.
steps:
  - "Pick the start point on the highest level"
  - "Pick the termination level"
  - "Confirm the diameter — BUILD MEP suggests it from the served fixture units"
  - "BUILD MEP routes the pipe vertically, places offset bends through floors, and adds boss tees automatically"
  - "Schedule auto-updates with the new run length"
related_tools:    [list_levels, place_svp, snapshot_query]
related_skills:   [routing-preferences]
related_commands: []
```

### Asset folder (matches slug)

```
sandbox/demo-assets/place-svp/
   screenshot.jpg   1920×1080
   thumbnail.jpg    640×360
   video.mp4        h.264
   poster.jpg       1920×1080
```

### What `build-demo-pages.mjs` does (pseudocode, ~80 lines)

```js
import { loadYaml, renderTemplate, writeFile } from './lib/io.mjs';

const template = await loadFile('templates/demo-page.html');         // = sandbox/demos/place-svp.html, parameterised
const galleryTpl = await loadFile('templates/demo-gallery-card.html');

const demos = await loadAllYaml('data/demos/*.yaml');                // sorted by `order`

// 1. Each detail page
for (const demo of demos) {
  const html = renderTemplate(template, {
    ...demo,
    asset_base: `/demos/${demo.slug}/`,           // production path; sandbox uses /sandbox/demo-assets/
    related_tools_resolved:    demo.related_tools.map(name => registry.tools.find(t => t.name === name)),
    related_skills_resolved:   demo.related_skills.map(slug => skills.find(s => s.slug === slug)),
    related_commands_resolved: demo.related_commands.map(name => restApi.commands.find(c => c.name === name)),
    prev_demo: demos[demo.order - 2],             // wraps
    next_demo: demos[demo.order]
  });
  await writeFile(`dist/demos/${demo.slug}/index.html`, html);
  await copyAssets(`sandbox/demo-assets/${demo.slug}/`, `dist/demos/${demo.slug}/`);
  await emitSearchEntry({ type: 'demo', title: demo.title, url: `/demos/${demo.slug}/`, keywords: [demo.discipline, demo.product_pillar] });
}

// 2. Gallery index
const cards = demos.map(d => renderTemplate(galleryTpl, d)).join('');
await writeFile('dist/demos/index.html', renderTemplate(await loadFile('templates/demo-gallery.html'), { cards }));
```

### Output

Identical HTML to `sandbox/demos/place-svp.html` and `sandbox/demos/index.html`, just at the production paths.

### How fast

For 25 demos: parse YAML + render + write + copy assets ≈ **300 ms** on a CI runner.

---

## Walkthrough 2 — Tool page  (the auto-from-MEP-Bridge path)

### Input  (one entry from `data/registry.json`)

```json
{
  "name": "list_rooms",
  "description": "Returns all rooms in the document, optionally filtered by level.",
  "category": "context",
  "requiresBridge": "RevitContext",
  "alwaysAvailable": true,
  "parameters": [
    { "name": "level",         "type": "string",  "description": "Filter by level name. Exact match.",      "required": false },
    { "name": "min_area_m2",   "type": "number",  "description": "Lower bound, square metres.",              "required": false },
    { "name": "include_unplaced", "type": "boolean", "description": "Include rooms with no boundary.",       "required": false }
  ],
  "keywords": ["rooms","list rooms","spaces","level","room schedule","area"]
}
```

### Optional curated overlay  (`data/examples/list_rooms.yaml`)

```yaml
tool: list_rooms
canonical_prompts:
  - "List all rooms on Level 02"
  - "Which rooms on the ground floor are larger than 25 m²?"
  - "Show me every meeting room in the model"
related_demos: [qa-manager-error-detection, model-setup-views]
```

### What `build-tool-pages.mjs` does

```js
const template = await loadFile('templates/tool-page.html');         // = sandbox/docs/tools/list_rooms.html, parameterised
for (const tool of registry.tools) {
  const overlay = await tryLoadYaml(`data/examples/${tool.name}.yaml`);  // optional
  const html = renderTemplate(template, {
    ...tool,
    prompts: overlay?.canonical_prompts ?? [],
    related_demos_resolved: (overlay?.related_demos ?? []).map(slug => demos.find(d => d.slug === slug))
  });
  await writeFile(`dist/docs/tools/${tool.name}/index.html`, html);
  await emitSearchEntry({ type: 'tool', title: tool.name, url: `/docs/tools/${tool.name}/`, keywords: tool.keywords });
}
```

### Output

Identical HTML to `sandbox/docs/tools/list_rooms.html` for every one of the 190 tools, just with the per-tool data substituted.

### How fast

190 tools × ~3 ms each = **570 ms**.

---

## Walkthrough 3 — Command page  (the REST API path)

### Input  (one entry from `data/rest_api_registry.json` — registry doesn't exist yet, this is the target shape)

```json
{
  "name": "export_clash_results_to_xml",
  "description": "Exports the latest clash detection run to BCF or XML for external coordination platforms.",
  "method": "POST",
  "path": "/api/v1/commands/export_clash_results_to_xml",
  "auth": "jwt",
  "tier": "pro",
  "is_async": true,
  "parameters": [
    { "name": "format", "type": "string",  "required": true,  "description": "One of \"BCF 2.1\", \"BCF 3.0\", \"XML\"." },
    { "name": "status", "type": "string",  "required": false, "description": "\"all\" | \"open\" | \"closed\". Default \"open\"." }
  ],
  "responses": [
    { "name": "job_id",     "type": "string",   "description": "Tracking ID for polling." },
    { "name": "status",     "type": "string",   "description": "queued | processing | completed | failed | expired." },
    { "name": "expires_at", "type": "datetime", "description": "When the queued job expires if not picked up." }
  ],
  "webhooks": ["command.completed", "command.failed", "command.expired"]
}
```

### What `build-command-pages.mjs` does

```js
const template = await loadFile('templates/command-page.html');      // = sandbox/docs/commands/export_clash_results_to_xml.html, parameterised
for (const cmd of restApi.commands) {
  const html = renderTemplate(template, {
    ...cmd,
    curl_example: buildCurlExample(cmd),       // generated from path + parameters
    js_example:   buildJsExample(cmd),
    py_example:   buildPyExample(cmd),
    related_tools_resolved: findRelatedTools(cmd.name)   // by keyword overlap
  });
  await writeFile(`dist/docs/commands/${cmd.name}/index.html`, html);
}
// Also: regenerate dist/api/openapi.json
```

### Output

Identical HTML to `sandbox/docs/commands/export_clash_results_to_xml.html` for every `[RestApi]` command, plus a fresh OpenAPI 3.1 spec at `dist/api/openapi.json` (and Stoplight Elements at `/docs/api/`).

---

## Walkthrough 4 — Workflow page  (multi-phase recipe)

### Input  (`data/workflows/new-job-from-brief.yaml`)

```yaml
slug: new-job-from-brief
title: "New job from brief to Stage 2"
lead: "From a fresh client brief to a coordinated Stage 2 model in one afternoon."
phases:
  - title: "Set up the project from template"
    description: "Open BUILD MEP, pick the JPA master template…"
    video: "video-phase-1.mp4"
    poster: "poster-phase-1.jpg"
    steps:
      - "Pick the master template"
      - "Confirm project info (number, address, RIBA stage)"
    tools_used: [setup_project_from_template, list_filters, apply_view_template_to_views_by_filter]
  - title: "Pull in the briefing data"
    # ...
related_demos: [model-setup-views, qa-manager-clash-detection]
related_commands: [export_clash_results_to_xml]
```

### Asset folder

```
sandbox/demo-assets/new-job-from-brief/
   screenshot.jpg
   poster-phase-1.jpg .. poster-phase-5.jpg
   video-phase-1.mp4  .. video-phase-5.mp4
```

### What `build-workflow-pages.mjs` does

Same shape as the demo page generator, but iterates over `phases[]` to render the sequence of phase blocks.

### Output

Identical HTML to `sandbox/workflows/new-job-from-brief.html`.

---

## Walkthrough 5 — How the registry refreshes  (the cross-repo bit)

```
1. You push a change to MEP Bridge master
   └─ adds [McpTool] to a new tool, or updates a description, or adds [RestApi] tag
2. MEP Bridge GitHub Action runs
   ├─ dotnet build → invokes generate_mcp_registry.py (exists)
   ├─                         + generate_skill_manifest.py (exists)
   ├─                         + generate_rest_api_registry.py (TODO — needs writing)
   ├─ collects: mcp_registry.json, skill_manifest.json, skills/*.md, rest_api_registry.json
   ├─ sanitises (strip filePath, namespace from public registry)
   ├─ uploads bundle to Cloudflare R2
   └─ fires repository_dispatch event to Website repo
3. Website GitHub Action receives event
   ├─ downloads bundle, writes to data/
   └─ opens PR with diff summary in the body
4. You merge PR
   └─ build-and-deploy workflow runs:
        ├─ build-tool-pages.mjs        → 190 (or whatever) tool pages
        ├─ build-command-pages.mjs     → N command pages
        ├─ build-skill-pages.mjs       → 30+ skill pages
        ├─ build-bridge-pages.mjs      → 6 bridge pages
        ├─ build-demo-pages.mjs        → 25 demo pages from your YAMLs
        ├─ build-workflow-pages.mjs    → 7 workflow pages from your YAMLs
        ├─ build-product-pages.mjs     → 16 product pillar pages from your YAMLs
        ├─ build-search-index.mjs      → /docs/search-index.json
        ├─ build-seo.mjs                → /sitemap.xml + OG tags
        └─ deploy → Cloudflare Pages
5. Live in <3 min from your original push
```

---

## What's already done in this session (sandbox stage)

- Five real HTML pages you can open in a browser right now and comment on.
- Asset folder structure with the resolution rules captured in `sandbox/demo-assets/ASSETS.md`.
- Five placeholder demo folders so the gallery and detail page render without missing-image icons.
- The "no live demos, video only" decision baked into both the page templates and the documentation.

## What still needs your input before automation starts

1. **Approve the five sandbox pages.** Mark them up — anything you want changed in the layout, copy, or pill colours. Once approved, the templates lock and the generators are written against them.
2. **Confirm the demo list.** I extracted 25 demos from your message. Is that the right cut for launch, or are some on hold and others I missed?
3. **Confirm the product pillar list.** I have 16 from your message (Client Briefing, Reports, Specifications, Schedules, Revit Modelling, QA, BIM, Document Controller, Finances, Project Management, EPCs/SBEM/SAP, 2D-to-3D, Modes, Build Your Own Tool, Arch, Future). Right cut?
4. **Workflow archetypes.** I sketched one (`new-job-from-brief`). Which other recipes should ship with launch? My initial guess: stage-3-coordination-handover, set-up-from-template, run-qa-pack, issue-cobie-package, monthly-cdn-with-revisions.

After your sign-off on those four, the next session writes the actual generators (~half a day) and we replace `sandbox/` with `dist/` produced from data files.
