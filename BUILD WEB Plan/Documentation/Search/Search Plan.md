# Search Plan

> Parent: [Documentation Plan](../Documentation%20Plan.md)
> Status: **TODO**

## Purpose

One client-side search box across tools, skills, bridges, REST commands, examples, getting-started, and changelog. No server, no Algolia, no per-keystroke billing.

## 1. Source of Truth

Every other generator emits a "search entry" alongside its page. `build-search-index.mjs` runs last and concatenates.

```json
{
  "type": "tool",
  "title": "list_rooms",
  "description": "Returns all rooms in the document, optionally filtered by level.",
  "url": "/docs/tools/list_rooms",
  "keywords": ["rooms", "list rooms", "spaces", "level"]
}
```

## 2. Build Pipeline

Each generator pushes to a per-section JSON shard; `build-search-index.mjs` merges into `dist/docs/search-index.json` (sharded by section for code-splitting).

## 3. Runtime Surface

Static JSON files served from CDN. Loaded on demand by the search UI.

## 4. UI Surface

- Search box in the docs sidebar + Cmd+K modal anywhere on the site.
- `fuse.js` for fuzzy matching (small footprint, good defaults).
- Results grouped by type (Tools / Skills / API / Guides / Changelog) with badge colours.

## 5. Risk Research

| # | Area | Finding | Mitigation |
|---|------|---------|------------|
| 1 | Index size | At 500 tools, full index could exceed 200 KB | Shard per section; load on demand; lazy initialise Fuse. |
| 2 | Search relevance | Fuzzy matching can be too loose | Boost exact name matches; weight `title` 4×, `keywords` 2×, `description` 1×. |
| 3 | Cmd+K conflicts | Some browsers/extensions hijack | Document fallback; use `/` shortcut too. |

## 6. File Layout

```
scripts/build-search-index.mjs          # — TODO
src/components/search-box.mjs            # — TODO
src/components/search-modal.mjs          # — TODO
dist/docs/search-index.json             # — TODO  (root manifest pointing at shards)
dist/docs/search-index.tools.json       # — TODO
dist/docs/search-index.skills.json      # — TODO
dist/docs/search-index.api.json         # — TODO
dist/docs/search-index.guides.json      # — TODO
dist/docs/search-index.changelog.json   # — TODO
```

## 7. Configuration

```js
export const SEARCH = {
  fuse: { keys: [{name:'title',weight:4},{name:'keywords',weight:2},{name:'description',weight:1}], threshold: 0.35 },
  maxResults: 25,
  shortcut: ['k', '/']
};
```

## 8. Workflow

User presses Cmd+K → modal appears → types "rooms" → results appear in <50 ms after first index load.

## 9. Bugs/Issues

_None — TODO._

## 10. Tests

| Test | Description | Status |
|------|-------------|--------|
| Index includes every page | Sum of shard entries == sum of generated pages | **TODO** |
| Fuzzy match relevance | Fixture queries → expected top result | **TODO** |
| Modal a11y | Focus trap, ESC closes, results announced | **TODO** |

## Quick Reference

| Artefact | Status |
|----------|--------|
| Generator + 6 shards + 2 components | **TODO** |
