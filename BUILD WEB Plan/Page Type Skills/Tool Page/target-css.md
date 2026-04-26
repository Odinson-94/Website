# Target CSS sections — Tool Page

The HTML rendered by `build-tool-pages.mjs` is styled by these sections of
`sandbox/sandbox.css`. The drafter must respect the size constraints these
sections impose so content fits without overflow.

## Sections that style this page

| CSS section | Renders | Owns |
|-------------|---------|------|
| **§7 TYPOGRAPHY** | h1, h2, h3, p, .lead, .crumbs | typeface, hierarchy, line height |
| **§8 TABLES** | parameters table, returns table, related table | column widths, sticky headers, row hover |
| **§9 PILLS** | bridge_label, category_label, always_available pills | colour by theme (muted / outline / dot) |
| **§4 LAYOUT** | the 3-column docs-layout the page sits inside | content max-width 760px (when wrapped in main column) |

## Length caps derived from rendered styling

| YAML field | CSS that renders it | Effective cap |
|------------|--------------------|---------------:|
| `display_title` | `<h1>` § 7 (38 px / weight 500) | **≤ 32 chars** to fit one line at 760 px content |
| `description` | `<p class="lead">` § 7 (16 px / 1.65 line-height) | **≤ 200 chars** = 2 lines |
| `bridge_label` | `<span class="pill pill-bridge">` § 9 | **≤ 18 chars** |
| `category_label` | `<span class="pill pill-category">` § 9 | **≤ 14 chars** |
| `always_available` | rendered as "always" or "on demand" pill § 9 | n/a (boolean) |
| `what_it_returns` | `.logictree` § 15 | **≤ 8 lines** of text, monospace |
| `example_prompts[]` | `<ul><li>` inside main column § 7 | each ≤ 90 chars to fit one line |
| `related.tools[]`, `related.skills[]`, `related.demos[]` | `<table class="ref-table">` § 8 | unlimited rows; column truncation handled by CSS |

## Visual reference

A finished tool page (using these caps) looks like:

```
┌──────────────────────────────────────────────────────────┐
│  Docs › Tools › list_rooms                               │
│                                                          │
│  list_rooms                                              │  ← h1 (display_title)
│  [bridge: Revit] [category: context] [always available]  │  ← pills row
│                                                          │
│  Returns every room in the document, optionally          │  ← lead (description)
│  filtered by level name or minimum area.                 │
│                                                          │
│  Parameters                                              │
│  ┌─────────────┬────────┬──────────┬───────────────────┐ │  ← params table
│  │ Name        │ Type   │ Required │ Description       │ │     (rendered from SOURCE
│  │ level       │ string │ no       │ Filter by level   │ │      not from your YAML)
│  └─────────────┴────────┴──────────┴───────────────────┘ │
│                                                          │
│  Returns                                                 │  ← what_it_returns block
│  Array of objects: ...                                   │
│                                                          │
│  Example prompts                                         │  ← example_prompts[]
│  • List all rooms on Level 02                            │
│  • Which rooms on the ground floor are larger than 25 m² │
│  • Show me every meeting room                            │
│                                                          │
│  Related                                                 │  ← related table
│  Tools:    list_levels · snapshot_query                  │
│  Skills:   schedules · filters & templates               │
└──────────────────────────────────────────────────────────┘
```

## What the drafter MUST NOT touch

- Layout decisions (handled by §4)
- Pill colours (handled by §9; the active theme is set on `<html data-pill-theme="...">`)
- Table column widths (handled by §8)

The drafter writes content. CSS is the surface. The two are kept apart on purpose.
