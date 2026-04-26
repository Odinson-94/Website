# Page Structures — adelphos.ai

> Wireframes + content contracts for the four content-heavy page types.
> All other pages (marketing, product hubs, downloads, resources) reuse subsets of these blocks.

---

## 1. Demo detail page  ·  `/demos/<slug>/`

**The fixed card layout you specified.** One demo = one folder of placeholder assets = one HTML page. Drop assets in at the listed resolution; the page picks them up automatically.

```
┌──────────────────────────────────────────────────────────────────────┐
│  ← Back to demos               (top nav inherits site shell)         │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   ┌────────────────────────────────────────────────────────────┐     │
│   │                                                            │     │
│   │   SCREENSHOT (hero)                                         │     │
│   │   1920 × 1080 jpg, lazy-loaded, fades in                    │     │
│   │                                                            │     │
│   └────────────────────────────────────────────────────────────┘     │
│                                                                      │
│   HEADER (h1)                                                         │
│   "Place SVP — Soil & Vent Pipe in 3 clicks"                         │
│                                                                      │
│   PARAGRAPH (lead)                                                    │
│   2–4 sentence summary. What the tool does, who it's for, the time   │
│   it saves. ~60–80 words.                                             │
│                                                                      │
│   ┌────────────────────────────────────────────────────────────┐     │
│   │                                                            │     │
│   │   VIDEO (embedded)                                         │     │
│   │   16:9, MP4 or HLS via Cloudflare Stream                    │     │
│   │   Poster image = the screenshot above                       │     │
│   │   Length: 30–90 s, muted autoplay disabled                  │     │
│   │                                                            │     │
│   └────────────────────────────────────────────────────────────┘     │
│                                                                      │
│   PARAGRAPH WITH BULLETS (h2 + p + ul)                                │
│   "What's happening in this demo"                                     │
│   • Step 1 — describe                                                 │
│   • Step 2 — describe                                                 │
│   • Step 3 — describe                                                 │
│   …                                                                   │
│                                                                      │
│   FOOTER                                                              │
│   ←  Previous demo  |  Up to all demos  |  Next demo  →               │
│   Related tools (auto, from registry)  ·  Related skills (auto)       │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

**Content contract** (one YAML per demo):

```yaml
# data/demos/place-svp.yaml
slug: place-svp
title: "Place SVP — Soil & Vent Pipe in 3 clicks"
status: live                     # live | coming-soon
product_pillar: revit-modelling
discipline: public-health
order: 12                        # ordering inside the gallery
duration_s: 47

screenshot: "/sandbox/demo-assets/place-svp/screenshot.jpg"   # 1920×1080
video:
  src:    "/sandbox/demo-assets/place-svp/video.mp4"          # 1920×1080, h.264, < 25 MB
  poster: "/sandbox/demo-assets/place-svp/screenshot.jpg"     # reuse screenshot

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

related_tools:    [list_levels, place_svp, snapshot_query]   # auto-link to /docs/tools
related_skills:   [routing-preferences]                       # auto-link to /docs/skills
related_commands: []                                          # auto-link to /docs/commands when applicable
```

---

## 2. Demos gallery page  ·  `/demos/`

```
┌──────────────────────────────────────────────────────────────────────┐
│  Demos                                                                │
│  All the things BUILD MEP can do, on video.                          │
│                                                                      │
│  Filters:  [Pillar ▾]  [Discipline ▾]  [Mode ▾]  [Status ▾]   ⌕ search│
│                                                                      │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐    │
│  │ thumbnail   │ │ thumbnail   │ │ thumbnail   │ │ thumbnail   │    │
│  │ (16:9)      │ │             │ │             │ │             │    │
│  ├─────────────┤ ├─────────────┤ ├─────────────┤ ├─────────────┤    │
│  │ Title       │ │ Title       │ │ Title       │ │ Title       │    │
│  │ Pillar pill │ │ Pillar pill │ │ Pillar pill │ │ Pillar pill │    │
│  │ 47 s        │ │ 1m 12s      │ │ Coming Soon │ │ 32 s        │    │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘    │
│  …                                                                    │
└──────────────────────────────────────────────────────────────────────┘
```

Cards are 4 across desktop, 2 across tablet, 1 across mobile. Each card links to the detail page. "Coming Soon" cards have a desaturated thumbnail + badge and don't link anywhere.

---

## 3. Tool reference page  ·  `/docs/tools/<name>/`  [auto]

Generated from one row of `mcp_registry.json`. **Zero hand-editing.**

```
┌──────────────────────────────────────────────────────────────────────┐
│  Tools  ›  list_rooms                                                 │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   list_rooms                                                          │
│   [bridge: RevitContext]  [category: context]  [always available]    │
│                                                                      │
│   Returns all rooms in the document, optionally filtered by level.   │
│                                                                      │
│   PARAMETERS                                                          │
│   ┌─────────────┬─────────┬──────────┬──────────────────────────┐   │
│   │ Name        │ Type    │ Required │ Description              │   │
│   ├─────────────┼─────────┼──────────┼──────────────────────────┤   │
│   │ level       │ string  │ no       │ Filter by level name     │   │
│   │ min_area_m2 │ number  │ no       │ Lower bound, square m    │   │
│   └─────────────┴─────────┴──────────┴──────────────────────────┘   │
│                                                                      │
│   KEYWORDS                                                            │
│   rooms · list rooms · spaces · level                                 │
│                                                                      │
│   EXAMPLE PROMPTS  (from data/examples/list_rooms.yaml)              │
│   ▸ "List all rooms on Level 02"                                      │
│   ▸ "Which rooms on the ground floor are larger than 25 m²?"          │
│                                                                      │
│   RELATED                                                             │
│   Tools:    list_levels · snapshot_query · get_current_view_level    │
│   Skills:   schedules · filters & templates                           │
│   Demos:    qa-manager-error-detection · model-setup-views           │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

No "Try It" button — we agreed today the engine can't run headlessly outside Revit, so the page is documentation only. Where the user wants to *see* the tool in action, the **Related Demos** strip points them at the matching video.

---

## 4. Command reference page  ·  `/docs/commands/<name>/`  [auto]

Generated from one row of `rest_api_registry.json` (when populated). Same shell as the tool page, plus HTTP-specific blocks.

```
┌──────────────────────────────────────────────────────────────────────┐
│  Commands  ›  export_clash_results_to_xml                            │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   export_clash_results_to_xml                                         │
│   [POST]  [auth: JWT + API key]  [tier: pro]  [async]                │
│                                                                      │
│   Exports the latest clash detection run to BCF or XML for           │
│   external coordination platforms.                                    │
│                                                                      │
│   ENDPOINT                                                            │
│   POST  https://adelphos.ai/api/v1/commands/export_clash_results_to_xml│
│                                                                      │
│   REQUEST BODY                                                        │
│   ┌──────────┬─────────┬──────────┬─────────────────────────────┐   │
│   │ Field    │ Type    │ Required │ Description                 │   │
│   ├──────────┼─────────┼──────────┼─────────────────────────────┤   │
│   │ format   │ string  │ yes      │ "BCF 2.1" | "BCF 3.0" | "XML"│   │
│   │ status   │ string  │ no       │ "all" | "open" | "closed"   │   │
│   └──────────┴─────────┴──────────┴─────────────────────────────┘   │
│                                                                      │
│   RESPONSE                                                            │
│   202 Accepted  →  { job_id, status: "queued", expires_at }          │
│   See /docs/commands/job-result for polling shape.                   │
│                                                                      │
│   CODE EXAMPLES   [ curl | JS | Python ]                              │
│   ┌────────────────────────────────────────────────────────────┐     │
│   │ curl -X POST https://adelphos.ai/api/v1/commands/...       │     │
│   │   -H "Authorization: Bearer $JWT" \                        │     │
│   │   -H "Idempotency-Key: $(uuidgen)" \                        │     │
│   │   -d '{ "format": "BCF 2.1" }'                             │     │
│   └────────────────────────────────────────────────────────────┘     │
│                                                                      │
│   HOW IT EXECUTES                                                     │
│   client → Edge Function → command_queue → user's Revit → result      │
│                                                                      │
│   RELATED                                                             │
│   Tools:    get_all_clash_results_from_latest_check · …              │
│   Demos:    qa-manager-clash-detection                                │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 5. Workflow page  ·  `/workflows/<slug>/`

Multi-step recipe. Same demo-card shape, but with **multiple video segments** in sequence and **multiple step blocks**.

```
┌──────────────────────────────────────────────────────────────────────┐
│  Workflow: New job from brief to Stage 2                             │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   HERO SCREENSHOT                                                     │
│                                                                      │
│   H1 + LEAD PARAGRAPH                                                 │
│                                                                      │
│   STEPS (one block per phase)                                         │
│   ┌────────────────────────────────────────────────────────────┐     │
│   │ Phase 1 — Set up the project from template                 │     │
│   │ video clip · paragraph · bullets                           │     │
│   │ Tools used: setup_project_from_template, list_filters      │     │
│   ├────────────────────────────────────────────────────────────┤     │
│   │ Phase 2 — Pull in the briefing data                        │     │
│   │ video clip · paragraph · bullets                           │     │
│   ├────────────────────────────────────────────────────────────┤     │
│   │ Phase 3 — Generate the MEP strategy report                 │     │
│   │ video clip · paragraph · bullets                           │     │
│   └────────────────────────────────────────────────────────────┘     │
│                                                                      │
│   FOOTER                                                              │
│   Related demos · Related tools · Try this workflow yourself          │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 6. Asset folder structure  (the bit you asked about)

Every demo, workflow, and product pillar has one folder. **You drop files in at the listed dimensions and naming, the page picks them up.** No code change required to swap a placeholder for the real asset.

```
sandbox/demo-assets/
├── _placeholder/                              ← reusable placeholder kit
│     ├── screenshot.jpg                       1920×1080 grey card with slug overlay
│     ├── thumbnail.jpg                        640×360
│     ├── video.mp4                             1920×1080 5-second placeholder loop
│     └── poster.jpg                           same as screenshot
│
├── place-svp/                                 ← one folder per demo slug
│     ├── screenshot.jpg                       1920 × 1080  · jpg, < 250 KB · hero
│     ├── thumbnail.jpg                        640  ×  360  · jpg, < 60  KB · gallery card
│     ├── video.mp4                             1920 × 1080  · h.264 · 30–90 s · < 25 MB
│     ├── poster.jpg                            1920 × 1080  · video poster (can equal screenshot)
│     └── caption.vtt                          (optional — auto-captions later)
│
├── extend-connectors/
│     └── …same shape…
│
└── …one folder per slug…
```

**Naming rules:**

- Folder name = the demo slug (matches `slug:` in the YAML).
- Filenames are fixed: `screenshot.jpg`, `thumbnail.jpg`, `video.mp4`, `poster.jpg`. No version suffixes.
- All assets stay in `sandbox/demo-assets/` while we're previewing. Once approved, the build copies them to `dist/demos/<slug>/` and the YAML gets repointed automatically. **No edits to the YAML when assets move** — the build handles the path swap.

**Production target (later):**

- Videos move to **Cloudflare Stream**; YAML gets the HLS URL instead of the local path.
- Thumbnails and screenshots stay local in `images/demos/<slug>/`.
- The card template doesn't change — just the `video.src` field swaps.

---

## How automation will fill these later (the dry run)

For each page type, the future automated flow is:

| Page type | Source of truth | Generator | Output |
|-----------|----------------|-----------|--------|
| **Demo gallery + detail** | `data/demos/*.yaml` (one per demo, you fill in) | `build-demo-pages.mjs` (TODO) | `dist/demos/index.html` + `dist/demos/<slug>/index.html` |
| **Tool reference** | `data/registry.json` (synced from MEP Bridge) | `build-tool-pages.mjs` (TODO) | `dist/docs/tools/<name>/index.html` × 190 |
| **Command reference** | `data/rest_api_registry.json` (synced from MEP Bridge) | `build-command-pages.mjs` (TODO) | `dist/docs/commands/<name>/index.html` × N |
| **Workflow** | `data/workflows/*.yaml` (one per workflow, you fill in) | `build-workflow-pages.mjs` (TODO) | `dist/workflows/<slug>/index.html` |
| **Product pillar** | `data/products/*.yaml` (one per pillar) | `build-product-pages.mjs` (TODO) | `dist/products/<slug>/index.html` |

Right now we're building these by hand into `sandbox/` so you can comment on them. Once a sandbox page is approved, the corresponding generator script is written to produce that exact HTML from a YAML row — no template diverges from the sandbox version. **The sandbox page IS the template.**

---

## Page-by-page review queue

What I want you to look at, in order:

1. **`sandbox/demos/index.html`** — the gallery view. Comment on filters, card density, copy.
2. **`sandbox/demos/place-svp.html`** — one demo detail page, fully populated with placeholder content. Comment on the layout, spacing, video placement.
3. **`sandbox/docs/tools/list_rooms.html`** — one tool reference page. Comment on what auto-content should appear.
4. **`sandbox/docs/commands/export_clash_results_to_xml.html`** — one command reference page. Comment on the HTTP block.
5. **`sandbox/workflows/new-job-from-brief.html`** — one workflow page with multiple step blocks.

Then we can move them into the real `dist/` paths and start writing the generators that will produce them at scale.
