# Brain Canvas Plan

> Parent: [Site Shell Plan](../Site%20Shell%20Plan.md)
> Status: **Built** (functional) / **Partial** (not modularised, no reduced-motion fallback, no documented API).

## Purpose

The 12-view scroll experience that anchors the homepage. A canvas-driven brain visualisation with overlay nodes, view dots, and storytelling per scroll position. Already shipped in `js/brain.js` + `js/view-controller.js` + `js/index-main.js`.

## 1. Source of Truth

Existing files: `js/brain.js`, `js/view-controller.js`, `js/index-main.js`, `js/menubar.js`, plus inline HTML/CSS in `index.html` (canvas, overlay nodes, section indicator, hero text container).

## 2. Build Pipeline

Currently no build step — files served as-is. Future: bundle into `dist/assets/brain.bundle.js` with tree-shaking.

## 3. Runtime Surface

Public globals (currently): `window.PERF`, `window.goToView(n)`, `window.brainOverlay*`. Refactor target: single `window.AdelphosBrain` object with documented API.

## 4. UI Surface

12 sections (0–11) keyed by `data-view` attribute on `.section-dot`s; controlled by scroll + dot clicks; brain canvas zooms/pans per view; overlay node positions interpolated.

## 5. Risk Research

| # | Area | Finding | Mitigation |
|---|------|---------|------------|
| 1 | Perf on low-end | Canvas redraws every frame; CPU heavy | Already gated; add `requestIdleCallback` for non-critical updates; throttle to 30 FPS on weak devices. |
| 2 | `prefers-reduced-motion` | Currently animates regardless | Add static SVG fallback respecting media query. |
| 3 | Accessibility | Brain canvas is decorative but section-dots are interactive | Dots have visible focus + ARIA labels; canvas has `aria-hidden="true"`. |
| 4 | View 4 video gallery being replaced | Brain canvas state for View 4 currently shows videos | Extract View 4 cluster behind a slot so [Demos Plan](../../Demos/Demos%20Plan.md) can swap content without forking brain.js. |
| 5 | Bundle size | `brain.js` not minified, served raw | Bundle + minify in build pipeline. |
| 6 | iOS Safari scroll snap | Inertial scroll fights snap | Disable snap < 768 px (already partial); document fix. |

## 6. File Layout

```
# Current (Built):
js/brain.js, js/view-controller.js, js/index-main.js, js/menubar.js
inline HTML/CSS in index.html

# Target (Partial → TODO):
src/brain/
    index.mjs                    # entry, public API
    canvas.mjs                   # rendering
    view-controller.mjs           # scroll mapping
    overlay-nodes.mjs             # node positioning
    section-indicator.mjs         # dot UI
    fallback.svg                  # reduced-motion fallback
scripts/build-brain.mjs           # bundler — TODO
```

## 7. Configuration

`src/brain/config.mjs`:

```js
export const VIEWS = [
  { id: 0,  name: 'Hero',          zoom: 1.0, pan: [0, 0] },
  { id: 1,  name: 'What is Adelphos',  zoom: 0.9, pan: [-100, 0] },
  // ...
  { id: 11, name: 'CTA',           zoom: 1.4, pan: [0, 200] },
];
```

## 8. Workflow

Adding a new view: append entry to `VIEWS` array, add `<div class="section-dot" data-view="12">`, define overlay content for that view ID. CI breaks if dot count != VIEWS length.

## 9. Bugs/Issues

| # | Area | Description | Severity |
|---|------|-------------|----------|
| 1 | No reduced-motion fallback | Animates regardless of system preference | Low |
| 2 | View 4 hard-coded | Demo gallery embedded in brain canvas | Medium — fixed during Demos integration |
| 3 | Globals leak | Multiple window-level functions | Low — fixed in modularisation |

## 10. Tests

| Test | Description | Status |
|------|-------------|--------|
| 12 views render | Snapshot test per view | **TODO** |
| reduced-motion respected | Set media query, assert no animation | **TODO** |
| Section dots a11y | axe-core | **TODO** |

## Quick Reference

| Artefact | Status |
|----------|--------|
| Brain canvas core | **Built** |
| Modularisation + bundler + fallback + a11y | **TODO** |
