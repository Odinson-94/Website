# Skill Pages Plan

> Parent: [Documentation Plan](../Documentation%20Plan.md)
> Status: **TODO** — 0 of 30+ pages exist.

## Purpose

One auto-generated HTML page per `ship: true` skill markdown from MEP Bridge.

## 1. Source of Truth

`data/skill_manifest.json` (synced) + `data/skills/<slug>.md` (synced markdown bodies, sanitised).

## 2. Build Pipeline

`scripts/build-skill-pages.mjs` reads each manifest entry, loads the matching `.md`, renders via `markdown-it` + Shiki, writes `dist/docs/skills/<slug>.html`.

Markdown link rewriter: any `[Foo Skill](Foo%20Skill.md)` → `/docs/skills/foo`.

## 3. Runtime Surface

None.

## 4. UI Surface — Page Anatomy

```
H1: <skill.name>
[category badge] [tags...]
Description: <skill.description>

Section: Tools used
  list of links → /docs/tools/<name>

Section: Commands used
  list of links → /docs/api/<command> if [RestApi], else /docs/tools

Section: Body (rendered markdown — Prerequisites / Scenarios / Do-Don't / Error Recovery)

Section: Source
  link to the matching skill markdown in MEP Bridge (private — only shown to authenticated maintainers)
```

## 5. Risk Research

See [Documentation Plan §5](../Documentation%20Plan.md#5-risk-research--known-issues--pitfalls). Specific:

- Skill markdowns reference internal Class Structure docs that aren't published — link rewriter must drop or convert these.
- Some skills are very long (Coding Skill is 80 KB); split into sections with sticky table of contents.

## 6. File Layout

```
templates/skill-page.html                # — TODO
scripts/build-skill-pages.mjs            # — TODO
dist/docs/skills/<slug>.html             # — TODO  (× 30+)
dist/docs/skills/index.html              # — TODO
```

## 7. Configuration

```js
export const SKILL_CATEGORIES = ["model-setup", "views-sheets", "annotation", "coordination", "families", "export", "documents", "bulk-ops", "cloud", "custom"];
```

## 8. Workflow

A skill .md is updated in MEP Bridge → cross-repo sync brings it in → page rebuilds.

## 9. Bugs/Issues

_None — TODO._

## 10. Tests

| Test | Description | Status |
|------|-------------|--------|
| All ship:true skills get a page | manifest count == html count | **TODO** |
| Internal links rewritten | No `*.md` href in rendered HTML | **TODO** |
| Tools[] linked correctly | Each tool name in YAML resolves to existing tool page | **TODO** |

## Quick Reference

| Artefact | Status |
|----------|--------|
| Template | **TODO** |
| Generator | **TODO** |
| 30+ pages | **TODO** |
