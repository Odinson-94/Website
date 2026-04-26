# Site Shell Plan

> Parent: [Project Structure Plan](../Project%20Structure%20Plan.md)
> Location: `BUILD WEB Plan/Site Shell/`
> Status: **Partial** — `index.html` (12-view brain canvas), `about/`, `contact/`, `roadmap/`, `privacy/`, `terms/` exist and ship; SEO, perf budgets, and a11y audit are TODO; nav still has three "Coming Soon" pills.

---

## Purpose

The marketing layer: brand, navigation, the brain-canvas storytelling experience on `index.html`, and the supporting marketing pages. All other domains live INSIDE this shell — when you visit `/docs/tools/list_rooms`, the shell is the menubar, dark-mode toggle, footer, and brand tokens around the generated content.

---

## Children (H3)

| Plan | Status | Summary |
|------|--------|---------|
| [Marketing Pages Plan](Marketing%20Pages/Marketing%20Pages%20Plan.md) | **Partial** | Index hero, About, Contact, Roadmap, Privacy, Terms. |
| [Brain Canvas Plan](Brain%20Canvas/Brain%20Canvas%20Plan.md) | **Partial** | The 12-view scroll experience with overlay nodes. |
| [Performance and SEO Plan](Performance%20and%20SEO/Performance%20and%20SEO%20Plan.md) | **TODO** | Lighthouse budgets, sitemap, OG/Twitter cards, structured data, Core Web Vitals. |

---

## 1. Source of Truth

- HTML pages in `index.html`, `about/index.html`, `contact/index.html`, `roadmap/index.html`, `privacy/index.html`, `terms/index.html`.
- Brand tokens + styles in `css/shared-styles.css`, `css/index-styles.css`.
- Brain canvas logic in `js/brain.js`, `js/view-controller.js`, `js/index-main.js`, `js/menubar.js`.
- Brand palette + typography come from the existing files; future tokens consolidated into `src/styles/tokens.css`.

---

## 2. Build Pipeline

The shell is partially-static, partially-generated:

- Marketing pages: hand-written HTML → currently pass-through (no build step).
- Future state: HTML wrapped in a build step that injects nav, footer, OG tags, and dark-mode bootstrap consistently.

```
src/templates/shell.html  +  src/content/marketing/*.md  ─▶  build-marketing.mjs  ─▶  dist/<route>/index.html
```

Same shell template is used by the doc/demo/resources/downloads generators, ensuring nav consistency.

---

## 3. Runtime Surface

None at the shell level — pages are static. Telemetry endpoint is `POST /api/v1/telemetry` (Phase 2, defined in REST API Plan).

---

## 4. UI Surface

- Menubar (top, sticky, fade-in on scroll): Home · About · Roadmap · Contact · **Resources · Documentation · Downloads** (currently "Coming Soon" — to be replaced by Phase 1/4).
- Dark mode toggle (cookie-persisted; existing).
- Brain canvas (12 views, scroll- and click-driven).
- Footer (TODO — site currently has no consistent footer).

---

## 5. Risk Research — Known Issues & Pitfalls

| # | Area | Finding | Mitigation |
|---|------|---------|------------|
| 1 | Brain canvas perf | Heavy WebGL/canvas; FPS drops on low-end laptops | Already gated by IntersectionObserver; add `prefers-reduced-motion` fallback to static SVG. |
| 2 | FOUC on dark mode | Cookie set, page flashes white | Already mitigated by inline `<script>` + `html { visibility: hidden; }` until fonts load — keep this pattern in shell template. |
| 3 | Inter font flash | Even with preload, Inter not always cached | Subset Inter to Latin only; serve from same origin to avoid CORS preflight. |
| 4 | Coming Soon pills | Currently dropdowns with bullet lists; users hover and see no link | Replace with real routes the moment each section ships; never leave a dead pill. |
| 5 | Nav consistency | Each marketing page has its own copy of menubar HTML — easy to drift | Move menubar to a shared partial included by every page (build step). |
| 6 | Mobile menu | Hamburger is functional but feature-light; missing transitions and a11y attrs | Audit with axe; add `aria-expanded`, focus trap, ESC to close. |
| 7 | 12-view scroll on iOS Safari | Inertial scroll fights wheel snap | Disable snap below 768 px; revert to free scroll; tested in repo? add to test matrix. |
| 8 | Footer absence | No copyright, no privacy link, no LinkedIn | Add footer to shell template; per-page customisable. |

---

## 6. File Layout

```
src/templates/
    shell.html                     # — TODO (extracted from existing pages)
    menubar.html                    # — TODO (partial)
    footer.html                     # — TODO (partial)

src/content/marketing/
    index.md                         # — TODO (extract from index.html)
    about.md                         # — TODO
    roadmap.md                       # — TODO
    contact.md                       # — TODO
    privacy.md                       # — TODO
    terms.md                         # — TODO

src/styles/
    tokens.css                       # — TODO (consolidated brand tokens)

scripts/
    build-marketing.mjs              # — TODO

current state:
    index.html, about/index.html, etc.   # Built (will be regenerated post-shell-extract)
```

---

## 7. Configuration

Brand tokens (`src/styles/tokens.css`):

```css
:root {
  --brand-teal: #156082;
  --brand-text: #1a1a1a;
  --brand-bg:   #ffffff;
  --font-sans:  'Inter', system-ui, sans-serif;
  --radius-sm:  6px;
  --radius-md:  12px;
}
:root.dark-mode {
  --brand-text: #f5f5f5;
  --brand-bg:   #1a1a1a;
}
```

---

## 8. Workflow

### Workflow: Add a new marketing page

1. Create `src/content/marketing/new-page.md` with frontmatter (`title`, `description`, `og_image`).
2. `build-marketing.mjs` generates `dist/new-page/index.html` wrapped in shell.
3. Add nav entry to `src/templates/menubar.html` if it should appear in the bar.
4. PR; CI validates a11y + perf budget.

---

## 9. Bugs/Issues

| # | Area | Description | Severity |
|---|------|-------------|----------|
| 1 | Coming Soon dropdowns | Three nav items show dropdowns with bullet lists but no clickable destination | Medium — fixed by Phases 1 and 4. |
| 2 | No site footer | All pages lack a footer (copyright, social, sitemap link) | Low — fixed in Site Shell extraction. |

---

## 10. Tests

| Test | Description | Status |
|------|-------------|--------|
| Lighthouse perf ≥ 90 | Marketing pages on Slow 3G | **TODO** |
| Lighthouse a11y ≥ 95 | axe-core via Playwright | **TODO** |
| OG card valid | Twitter card validator + Facebook debugger | **TODO** |
| Sitemap covers all routes | `dist/sitemap.xml` includes every generated page | **TODO** |
| Dark-mode no FOUC | Visual regression across 6 templates | **TODO** |

---

## Quick Reference — Build Status Summary

| Artefact | File | Tier | Status |
|----------|------|------|--------|
| 6 marketing pages | `index.html`, `about/`, `contact/`, `roadmap/`, `privacy/`, `terms/` | Public | **Built** (need shell extraction) |
| Brain canvas | `js/brain.js`, `js/view-controller.js` | UI | **Built** |
| Dark mode | inline scripts + `css/shared-styles.css` | UI | **Built** |
| Shared shell template | `src/templates/shell.html` | Internal | **TODO** |
| Footer | `src/templates/footer.html` | UI | **TODO** |
| Brand tokens consolidated | `src/styles/tokens.css` | Internal | **TODO** |
| Marketing builder | `scripts/build-marketing.mjs` | Internal | **TODO** |
| Sitemap, OG, structured data | `scripts/build-seo.mjs` | Internal | **TODO** |
| **Total** | | | **3 Built / 5 TODO** |
