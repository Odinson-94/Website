# Documentation Plan

> Parent: [Project Structure Plan](../Project%20Structure%20Plan.md)
> Location: `BUILD WEB Plan/Documentation/`
> Status: **TODO** — `/docs/*` does not exist on the site; nav still shows "Documentation — Coming Soon".
> Sister plans: [Automation Pipeline Plan](../Automation%20Pipeline/Automation%20Pipeline%20Plan.md), [REST API Plan](../REST%20API/REST%20API%20Plan.md), [Examples Plan](../Examples/Examples%20Plan.md).

---

## Purpose

Replace the homepage's "Documentation — Coming Soon" pill with a complete, generated, searchable docs site. **No content on `/docs/` is hand-written except the Getting Started section and short marketing intros.** Everything else is generated from MEP Bridge artefacts on every build.

Outcome: every MCP tool, every skill, every REST API command, and every release has a stable URL the day it lands in MEP Bridge `master`.

---

## Children (H3)

| Plan | Status | Pages produced |
|------|--------|---------------|
| [Tool Pages Plan](Tool%20Pages/Tool%20Pages%20Plan.md) | **TODO** | 190 (one per `[McpTool]`) |
| [Skill Pages Plan](Skill%20Pages/Skill%20Pages%20Plan.md) | **TODO** | ~30+ (one per `ship: true` skill) |
| [Bridge Pages Plan](Bridge%20Pages/Bridge%20Pages%20Plan.md) | **TODO** | 6 (one per `requiresBridge` value) |
| [API Reference Plan](API%20Reference/API%20Reference%20Plan.md) | **TODO** | 1 OpenAPI explorer + ~25 (one per `[RestApi]`) |
| [Getting Started Plan](Getting%20Started/Getting%20Started%20Plan.md) | **TODO** | ~6 hand-written guides |
| [Changelog Plan](Changelog/Changelog%20Plan.md) | **TODO** | 1 (auto from conventional commits + tags) |
| [Search Plan](Search/Search%20Plan.md) | **TODO** | client-side index across all pages above |

---

## 1. Source of Truth

| Page | Source | Generator |
|------|--------|-----------|
| `/docs/tools/<name>` | `data/registry.json` + `data/examples/<name>.yaml` (optional) | `build-tool-pages.mjs` |
| `/docs/skills/<slug>` | `data/skill_manifest.json` + `data/skills/<slug>.md` | `build-skill-pages.mjs` |
| `/docs/bridges/<bridge>` | `data/registry.json` grouped by `requiresBridge` | `build-bridge-pages.mjs` |
| `/docs/api/<command>` | `data/rest_api_registry.json` | `build-api-reference.mjs` |
| `/docs/changelog/` | `git log` with conventional commit prefixes + tags | `build-changelog.mjs` |
| `/docs/getting-started/*` | `src/content/docs/getting-started/*.md` | `build-content-pages.mjs` |
| `/docs/search-index.json` | every other generator emits an entry | `build-search-index.mjs` (runs last) |

---

## 2. Build Pipeline

See [Automation Pipeline Plan §2](../Automation%20Pipeline/Automation%20Pipeline%20Plan.md#2-build-pipeline-end-to-end). Documentation is the largest consumer of the pipeline.

---

## 3. Runtime Surface

None at runtime; static HTML served from CDN. Search uses a static JSON index loaded client-side (lunr.js or fuse.js).

---

## 4. UI Surface — Page Templates

Every doc page shares one shell with three regions:

```
┌──────────────────────────────────────────────────────────────────┐
│ [Adelphos AI]  Home · About · Roadmap · Contact · Resources ·    │
│                Documentation · Downloads          🌓 search [⌕]   │
├────────────────┬─────────────────────────────────────────────────┤
│                │                                                 │
│  Sidebar       │  Page content                                   │
│  (collapsible, │  • H1 title                                     │
│  per section)  │  • Description / metadata table                 │
│                │  • Parameters table                             │
│  Tools (190) ▾ │  • Example prompts (from data/examples)         │
│   - by bridge  │  • Try It (links to /demos/?tool=...)           │
│   - by category│  • Related tools / skills                       │
│   - alpha      │  • Source link (to GitHub if public)            │
│                │                                                 │
│  Skills (30) ▾ │                                                 │
│  Bridges (6)   │                                                 │
│  API (25)      │                                                 │
│  Changelog     │                                                 │
│                │                                                 │
└────────────────┴─────────────────────────────────────────────────┘
```

Brand: dark-mode aware (existing index.html cookie strategy), Inter font, brand teal #156082, code blocks via Prism.js with the existing colour palette.

---

## 5. Risk Research — Known Issues & Pitfalls

| # | Area | Finding | Mitigation | Source |
|---|------|---------|------------|--------|
| 1 | 190+ pages | First-paint search index can be large. | Code-split: per-section JSON shards loaded on demand; gzip; <100 KB initial. | Algolia DocSearch sizing data |
| 2 | Markdown skill bodies contain custom syntax | `markdown-it` + plugins must match what MEP Bridge uses. | Lock plugin set: `markdown-it-anchor`, `markdown-it-attrs`, `markdown-it-task-lists`, `markdown-it-table-of-contents`. Snapshot 5 skills. | MEP Bridge skill rendering |
| 3 | Code-block syntax highlight | Prism vs Shiki; Shiki is better but heavier (server-side at build). | Use Shiki at build time (zero runtime cost), pre-render highlighted HTML into pages. | Shiki perf docs |
| 4 | Internal links to MEP Bridge skills cross-link | Skill A references Skill B by `[Schedules Skill](Schedules%20Skill.md)`. After conversion, slugify and rewrite to `/docs/skills/schedules`. | Renderer rewrites markdown links matching `*.md` to slugified docs URLs. Test with each skill's link map. | Self-rule |
| 5 | "Coming Soon" pills | Removing them mid-deploy = broken nav. | Phase 1 ships nav with real `/docs/` link replacing pill in same PR. | Self-rule |
| 6 | Long tool names break sidebar | Some names ~50 chars. | CSS `text-overflow: ellipsis` + tooltip; sidebar width ~280 px. | Frontend hygiene |
| 7 | RTL/i18n | Not in scope v1; hard-coded `lang="en"`. | Document constraint; `data-i18n` attrs absent. | Scope decision |
| 8 | Tool deprecation | Tool removed from registry → page 404s, breaks SEO. | Generator emits `meta http-equiv="refresh"` redirect to `/docs/tools/?deprecated=<name>` for 30 days; sitemap removes immediately. | Stripe API deprecation playbook |

---

## 6. File Layout

```
src/content/docs/getting-started/
    install.md                            # hand-written  — TODO
    first-prompt.md                       # hand-written  — TODO
    first-demo.md                          # hand-written  — TODO
    api-quickstart.md                      # hand-written  — TODO

templates/
    docs-shell.html                        # template      — TODO
    tool-page.html                         # template      — TODO
    skill-page.html                        # template      — TODO
    bridge-page.html                        # template      — TODO
    api-page.html                           # template      — TODO

scripts/
    build-tool-pages.mjs                    # generator    — TODO
    build-skill-pages.mjs                   # generator    — TODO
    build-bridge-pages.mjs                  # generator    — TODO
    build-api-reference.mjs                 # generator    — TODO
    build-content-pages.mjs                  # generator   — TODO
    build-changelog.mjs                      # generator   — TODO
    build-search-index.mjs                   # generator   — TODO

dist/docs/
    index.html
    tools/<name>.html        × 190
    skills/<slug>.html       × 30+
    bridges/<bridge>.html    × 6
    api/<command>.html       × 25
    api/openapi-explorer.html
    getting-started/*.html
    changelog/index.html
    search-index.json
```

---

## 7. Configuration

`scripts/lib/docs-config.mjs`:

```js
export const DOCS_CONFIG = {
  brand: { name: "Adelphos AI", primaryColor: "#156082" },
  search: { engine: "fuse", maxResults: 25, fields: ["title", "description", "keywords", "body"] },
  shiki:  { themes: { light: "github-light", dark: "github-dark-dimmed" }, langs: ["json","ts","cs","python","bash","yaml"] },
  redirects: { gracePeriodDays: 30 }
};
```

---

## 8. Workflow

### Workflow: A user lands on `/docs/`

1. Sees landing page: hero, search bar, four cards (Tools, Skills, API, Getting Started).
2. Types "rooms" → fuzzy search finds `list_rooms`, `list_room_data`, `tag_all_rooms_in_current_view_including_linked`, `Schedules Skill`, `Sheets Skill`.
3. Clicks `list_rooms` → `/docs/tools/list_rooms` loads in <300 ms.
4. Sees: description, params table, 3 example prompts, "Try It" button → opens `/demos/?tool=list_rooms&prompt=List+all+rooms+on+Level+02`.
5. Demo runs against sandbox; sees 47 rooms returned.

### Workflow: A new skill is published

See [Automation Pipeline Plan §8](../Automation%20Pipeline/Automation%20Pipeline%20Plan.md#8-workflow). New page live in <3 min; appears in search; appears in sidebar; appears in any related-tool sidebars that reference its tools.

---

## 9. Bugs/Issues

_None yet — all components are TODO._

---

## 10. Tests

| Test | Description | Status |
|------|-------------|--------|
| Page count == registry count | After build, `ls dist/docs/tools | wc -l` == `data/registry.json#tools.length` | **TODO** |
| Skill links rewritten | All `*.md` references in skills resolve to `/docs/skills/*` URLs | **TODO** |
| Search index covers all pages | Index entries == sum of generated pages | **TODO** |
| Lighthouse a11y ≥ 95 | Each template type passes axe-core | **TODO** |
| Lighthouse perf ≥ 90 | Tool page LCP < 1.5 s on Slow 3G | **TODO** |
| Dark mode parity | Cookie set, page renders in dark from first paint (no FOUC) | **TODO** |

---

## Quick Reference — Build Status Summary

| Artefact | File | Tier | Status |
|----------|------|------|--------|
| 7 generators | `scripts/build-*.mjs` | Internal | **TODO** |
| 5 page templates | `templates/*.html` | Internal | **TODO** |
| Docs shell + sidebar | `templates/docs-shell.html` | UI | **TODO** |
| ~256 generated pages | `dist/docs/**/*.html` | Public | **TODO** |
| 4 hand-written guides | `src/content/docs/getting-started/*.md` | Public | **TODO** |
| **Total** | | | **0 Built / 17 TODO** |
