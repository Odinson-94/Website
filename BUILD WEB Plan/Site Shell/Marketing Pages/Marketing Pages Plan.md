# Marketing Pages Plan

> Parent: [Site Shell Plan](../Site%20Shell%20Plan.md)
> Status: **Partial** — pages ship; need shell extraction + SEO + footer.

## Purpose

The hand-written marketing surface: index hero, About, Roadmap, Contact, Privacy, Terms.

## 1. Source of Truth

Currently raw HTML in `index.html`, `about/index.html`, `contact/index.html`, `roadmap/index.html`, `privacy/index.html`, `terms/index.html`.

Future: `src/content/marketing/*.md` rendered through `src/templates/shell.html`.

## 2. Build Pipeline

`build-marketing.mjs` (TODO):
1. Reads markdown frontmatter (title, description, og_image).
2. Renders body via markdown-it.
3. Wraps in shell template.
4. Writes to `dist/<route>/index.html`.

## 3. Runtime Surface

None — static.

## 4. UI Surface

Each page = hero + body sections + footer. Brain canvas only on `/`.

## 5. Risk Research

| # | Area | Finding | Mitigation |
|---|------|---------|------------|
| 1 | Drift between hand-edited HTML and shell extraction | Mid-migration, two sources of truth | One PR per page migration, smoke-tested before next. |
| 2 | Brain canvas tied to index.html structure | Refactoring index.html risks breaking 12-view system | Keep brain canvas self-contained in shell template; expose as `<div id="scene">` slot. |
| 3 | Open Graph cards | Currently absent; sharing on Slack shows generic preview | Required `og_image` per page; checked in CI. |

## 6. File Layout

```
# Current (Built):
index.html, about/, contact/, roadmap/, privacy/, terms/

# Target (TODO):
src/content/marketing/
    index.md
    about.md
    roadmap.md
    contact.md
    privacy.md
    terms.md
src/templates/
    shell.html
    menubar.html
    footer.html
scripts/build-marketing.mjs
```

## 7. Configuration

Frontmatter required fields: `title`, `description`, `og_image` (relative path), `canonical` (optional override).

## 8. Workflow

Phase 0–1: extract shell from existing pages, migrate one page at a time.

## 9. Bugs/Issues

| # | Area | Description | Severity |
|---|------|-------------|----------|
| 1 | "Coming Soon" pills | Three nav items are dead | Medium — fixed by Phases 1 and 4. |
| 2 | No footer | Inconsistent | Low — fixed by shell extraction. |

## 10. Tests

| Test | Description | Status |
|------|-------------|--------|
| Each page valid HTML | html-validate | **TODO** |
| OG card validates | Twitter validator | **TODO** |
| Lighthouse a11y ≥ 95 | axe via Playwright | **TODO** |

## Quick Reference

| Artefact | Status |
|----------|--------|
| 6 marketing pages | **Built** (raw HTML) |
| Shell extraction + footer + OG | **TODO** |
