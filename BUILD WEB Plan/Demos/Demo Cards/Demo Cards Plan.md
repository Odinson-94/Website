# Demo Cards Plan

> Parent: [Demos Plan](../Demos%20Plan.md)
> Status: **TODO**

## Purpose

The reusable `<demo-card>` component + per-demo content. Replaces the existing View 4 video gallery on `index.html`.

## 1. Source of Truth

`data/demos.yaml` (hand-curated metadata + seed prompts).

## 2. Build Pipeline

`scripts/build-demo-cards.mjs` reads YAML → renders index + per-demo HTML → emits a partial that gets injected into `index.html` View 4 placeholder.

## 3. Runtime Surface

Calls `POST /api/v1/demo/run` (see Demo Run API Plan).

## 4. UI Surface

See [Demos Plan §4](../Demos%20Plan.md#4-ui-surface) for the layout.

Component contract:

```html
<demo-card slug="drainage" mode="split" theme="auto"></demo-card>
```

Custom events emitted:

| Event | Detail |
|-------|--------|
| `demo:try` | `{ slug, prompt }` — user clicked Send |
| `demo:result` | `{ slug, prompt, durationMs, ok }` — response received |
| `demo:error` | `{ slug, prompt, error }` |

## 5. Risk Research

See [Demos Plan §5](../Demos%20Plan.md#5-risk-research--known-issues--pitfalls). Specific:

- Lazy-load video poster (intersection observer); only load HLS source on play.
- Component is framework-free (plain custom element) so it can be embedded by partners on third-party sites without React.

## 6. File Layout

```
src/components/demo-card.mjs              # — TODO
src/components/demo-card.css              # — TODO
scripts/build-demo-cards.mjs              # — TODO
templates/demo-card.html                  # template for SSR — TODO
data/demos.yaml                           # — TODO
dist/embed/demo-card.js                   # bundled for external embedding — TODO
```

## 7. Configuration

`data/demos.yaml` shape: see [Demos Plan §2](../Demos%20Plan.md#2-build-pipeline).

## 8. Workflow

1. Load `index.html` View 4 → 5 cards lazy-rendered.
2. User scrolls into view → poster loads.
3. User hovers → muted preview (optional).
4. User clicks Try → chat panel slides in pre-filled.
5. Response streams.

## 9. Bugs/Issues

_None — TODO._

## 10. Tests

| Test | Description | Status |
|------|-------------|--------|
| Component mounts headlessly | jsdom render succeeds | **TODO** |
| Lazy load fires on intersect | Mock observer | **TODO** |
| Custom events emitted | Listener catches `demo:try` | **TODO** |
| Embed bundle <30 KB gzip | bundlesize gate | **TODO** |

## Quick Reference

| Artefact | Status |
|----------|--------|
| Component + bundled embed + 8 cards | **TODO** |
