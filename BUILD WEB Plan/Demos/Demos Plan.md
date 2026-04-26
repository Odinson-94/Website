# Demos Plan

> Parent: [Project Structure Plan](../Project%20Structure%20Plan.md)
> Location: `BUILD WEB Plan/Demos/`
> Status: **Sandbox approved** — sandbox HTML at `sandbox/demos/` (gallery + `place-svp` detail) ready for review. Page template + asset folder convention defined in [Page Structures.md §1](../Page%20Structures.md) and [sandbox/demo-assets/ASSETS.md](../../sandbox/demo-assets/ASSETS.md).
> Sister plans: [Page Structures](../Page%20Structures.md), [Site Map](../Site%20Map.md), [Automation Dry Run](../Automation%20Dry%20Run.md).
>
> **⚠ SCOPE CHANGE 2026-04-20:** the engine cannot run headlessly outside Revit. Demos are **video only** — no live execution, no sandboxed snapshot queries from the public site. The earlier "Try It" / Demo Run API / sandbox SQLite plan is **dropped**. The "Live Chat Demo" sub-plan is also dropped (the chat panel scaffolding stays in the repo for later work, but is not on the public site at launch).

---

## Purpose

Make the engine real for a stranger in 60 seconds. Each demo = one folder of placeholder assets + one HTML page with the fixed card layout (screenshot · header · paragraph · video · paragraph + bullets · footer). 25 demos at launch (see [Site Map](../Site%20Map.md#demos--demos-hub--v--d) for the full list).

---

## Children (H3)

| Plan | Status | One-line summary |
|------|--------|------------------|
| [Demo Cards Plan](Demo%20Cards/Demo%20Cards%20Plan.md) | **TODO** | Reusable `<demo-card>` component + per-discipline instances. |
| [Live Chat Demo Plan](Live%20Chat%20Demo/Live%20Chat%20Demo%20Plan.md) | **Partial** | Wire the existing `chat-panel/` to Demo Run API. |
| [Sandbox Models Plan](Sandbox%20Models/Sandbox%20Models%20Plan.md) | **TODO** | 5 SQLite snapshots (Office, Hotel, Hospital, Education, Industrial) hosted in Supabase Storage. |

---

## 1. Source of Truth

| Demo | Inputs | Status of inputs |
|------|--------|-----------------|
| Drainage layout | `Videos/Demo Drainage Floorplan.mp4` (4.9 MB) + `office.sqlite` sandbox + skill `Coordination` | Video exists; sandbox TODO |
| Fire Alarm layout | `Videos/Demo Fire Alarm Floorplan.mp4` + `hotel.sqlite` | Video exists; sandbox TODO |
| Lighting layout | `Videos/Demo Floorplan Lighting.mp4` + `education.sqlite` | Video exists; sandbox TODO |
| Ventilation layout | `Videos/Demo Floorplan Ventilation.mp4` + `hospital.sqlite` | Video exists; sandbox TODO |
| Heating/Cooling layout | `Videos/Demo Heating Cooling Floorplan .mp4` + `industrial.sqlite` | Video exists; sandbox TODO |
| Clash Manager | `clash-manager.html` + `js/clash-manager.js` + tools `get_all_clash_results_from_latest_check`, `get_clash_result_summary_by_status` | UI Partial, wiring TODO |
| SpecBuilder | `js/specbuilder.js` + `chat-panel/SPECBUILDER_CHECKLIST.md` + skill `Custom Tool Creation` | Partial; needs API hook |
| QA Manager | `js/qa-chat.js` + tools `get_unresolved_errors`, `get_error_summary`, `resolve_error` | Partial; needs API hook |

---

## 2. Build Pipeline

```
data/demos.yaml                      # hand-curated metadata (title, video_url, sandbox, prompts)
        │
        ├─▶ build-demo-cards.mjs ─▶ dist/demos/index.html (gallery)
        │                          ─▶ dist/demos/<slug>.html (per-demo)
        │                          ─▶ partials injected into index.html View 4
        │
        └─▶ build-search-index.mjs (entries for each demo)
```

`data/demos.yaml` shape:

```yaml
- slug: drainage
  title: "Drainage layout in 90 seconds"
  discipline: drainage
  video:
    url: "https://stream.adelphos.ai/drainage-poster.m3u8"
    poster: "/images/demos/drainage-poster.jpg"
    duration_s: 87
  sandbox: office
  seed_prompts:
    - "Run drainage layout for the kitchen on Level 02"
    - "List the existing drainage stacks"
  related_tools: [list_rooms, list_levels, snapshot_query, get_document_info]
  related_skills: [coordination, sheets]
```

---

## 3. Runtime Surface

Demos use the Demo Run API surface defined in [REST API Plan §3](../REST%20API/REST%20API%20Plan.md#3-runtime-surface--the-full-public-map). No new endpoints.

---

## 4. UI Surface

`<demo-card>` Web Component contract:

| Attribute | Type | Default | Purpose |
|-----------|------|---------|---------|
| `slug` | string | — | Demo identifier from `data/demos.yaml` |
| `mode` | "split" \| "video" \| "try" | "split" | Video only / Try only / both side by side |
| `seed-prompt` | string | first from yaml | Pre-filled chat input |
| `theme` | "light" \| "dark" \| "auto" | "auto" | Inherits from page |

Card layout (split mode):

```
┌─ Drainage layout in 90 seconds ─────────────────────────────┐
│  ┌────────────────────┐  ┌───────────────────────────────┐  │
│  │  [▶  video poster] │  │  [chat input pre-filled]      │  │
│  │  87 s              │  │  ─────────────────────────    │  │
│  │  Watch desktop demo│  │  [send] → live result panel   │  │
│  └────────────────────┘  └───────────────────────────────┘  │
│  Related tools  ·  Related skills  ·  See on docs           │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. Risk Research — Known Issues & Pitfalls

| # | Area | Finding | Mitigation | Source |
|---|------|---------|------------|--------|
| 1 | Video hosting | Self-hosted MP4 = bandwidth bill explodes; Drive embeds = ugly + tracker | Cloudflare Stream (HLS, signed URLs, $1/1000 min); fallback YouTube unlisted; never host MP4 in repo | Cloudflare Stream pricing |
| 2 | Sandbox model freshness | Snapshot becomes stale relative to current MEP Bridge schema | Sandbox SQLite has its own version field; CI matrix tests demo run against current registry monthly | Self-rule |
| 3 | Demo run latency feel | 500 ms cold call feels slow with no skeleton | Skeleton shimmer + "warming up" message under 300 ms; pre-warm Edge Function on page load via `<link rel="preconnect">` + tiny health check | UX heuristic |
| 4 | Embedded chat XSS | Skill markdown contains code blocks; rendering as HTML in chat could XSS | DOMPurify; render in shadow DOM; CSP `script-src 'self'` | OWASP |
| 5 | View 4 overlap | Existing index.html View 4 has hand-coded video gallery — needs replacing without breaking scroll system | Replace inside same PR as feature flag; keep current cluster as fallback for 1 release | Self-rule |
| 6 | Mobile demo UX | Split layout doesn't fit narrow viewport | Below 768 px: video on top, try below; collapse one when other expanded | Existing responsive patterns in `index-styles.css` |
| 7 | Bot abuse on Try | Headless browsers click Send button | hCaptcha after 3 unauth runs/session; rate limit at Edge Function | Cloudflare bot protection |
| 8 | Streaming responses | If we add SSE for long results, browser EventSource has reconnection quirks | Use fetch + ReadableStream; document max 60 s wall-clock | MDN SSE |

---

## 6. File Layout

```
src/components/
    demo-card.mjs                    # Web Component  — TODO
    chat-panel.mjs                   # refactor of existing chat-panel/ — Partial

scripts/
    build-demo-cards.mjs             # generator      — TODO

data/
    demos.yaml                        # hand-curated   — TODO

dist/demos/
    index.html                        # gallery        — TODO
    <slug>.html                       # one per demo   — TODO

dist/embed/
    demo-card.js                      # bundled component for partner embeds — TODO
```

---

## 7. Configuration

`data/demos.yaml` is the entire config. Stream URLs and poster paths are the only secrets-adjacent values; they're public CDN URLs.

---

## 8. Workflow

### Workflow: A new visitor lands on the homepage

1. Scroll to View 4 — sees five discipline demo cards in a grid.
2. Hovers Drainage → autoplay muted preview at 0.5× opacity overlay.
3. Clicks → split view: video plays on left, chat ready on right with seed prompt.
4. Clicks Send → result streams in within 1 s.
5. Clicks "See on docs" → `/docs/tools/list_rooms`.

### Workflow: A new demo is added

1. Author records 30 s screencast, uploads to Cloudflare Stream.
2. Adds row to `data/demos.yaml` with slug, video URL, sandbox, prompts.
3. Picks sandbox model from existing 5; or creates a new one (see [Sandbox Models Plan](Sandbox%20Models/Sandbox%20Models%20Plan.md)).
4. Commits, opens PR; CI builds preview.
5. Merge → live in <3 min.

---

## 9. Bugs/Issues

_None yet — partial implementation; full wiring TODO._

---

## 10. Tests

| Test | Description | Status |
|------|-------------|--------|
| Card renders without runtime errors | Mount each demo in fixture; assert no console errors | **TODO** |
| Video falls back gracefully | If Stream URL 404s, show poster + "Watch on YouTube" link | **TODO** |
| Try button respects rate limit | 11th send in 60 s shows clear UI message, not raw 429 | **TODO** |
| Mobile collapses correctly | Browser at 375 px width: split → stacked | **TODO** |

---

## Quick Reference — Build Status Summary

| Artefact | File | Tier | Status |
|----------|------|------|--------|
| `<demo-card>` component | `src/components/demo-card.mjs` | UI | **TODO** |
| Chat panel refactor | `src/components/chat-panel.mjs` | UI | **Partial** |
| Generator | `scripts/build-demo-cards.mjs` | Internal | **TODO** |
| 5 discipline cards + 3 product cards | `data/demos.yaml` | Public | **TODO** |
| 5 sandbox models | `Supabase Storage` | Internal | **TODO** |
| Cloudflare Stream uploads (15 videos) | external | CDN | **TODO** |
| **Total** | | | **0 Built / 1 Partial / 6 TODO** |
