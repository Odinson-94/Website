# Getting Started Plan

> Parent: [Documentation Plan](../Documentation%20Plan.md)
> Status: **TODO** — only hand-written content in the whole `/docs` tree.

## Purpose

Six short, hand-written guides for first-time users. The only docs not auto-generated.

## 1. Source of Truth

`src/content/docs/getting-started/*.md` (hand-written).

## 2. Build Pipeline

`scripts/build-content-pages.mjs` renders markdown with shell + sidebar to `dist/docs/getting-started/<slug>/index.html`.

## 3. Runtime Surface

None.

## 4. UI Surface — The Six Guides

| Slug | Title | Audience |
|------|-------|----------|
| `install` | Install BUILD MEP for Revit | Engineer who downloaded the installer. |
| `first-prompt` | Your first AI prompt | Engineer just opened the chat panel. |
| `first-demo` | Run a demo without installing | Developer evaluating the product. |
| `api-quickstart` | Hit the public API in 60 seconds | External developer / partner. |
| `connect-revit-to-cloud` | Wire your Revit session to the cloud command queue | Power user / IT. |
| `troubleshooting` | Common installation + runtime issues | Anyone stuck. |

Each ≤ 800 words, with one screenshot, one code block, one "next step" link.

## 5. Risk Research

Stale screenshots — every Revit version changes UI slightly. Mitigation: each guide pins target Revit year (`Tested with: Revit 2026`) and has a refresh-due date.

## 6. File Layout

```
src/content/docs/getting-started/
    install.md                           # — TODO
    first-prompt.md                       # — TODO
    first-demo.md                          # — TODO
    api-quickstart.md                       # — TODO
    connect-revit-to-cloud.md               # — TODO
    troubleshooting.md                       # — TODO
```

## 7. Configuration

Markdown frontmatter:

```yaml
---
title: Your first AI prompt
description: 60-second walkthrough — open chat, ask a question, see the answer.
tested_with: "Revit 2026"
refresh_by: 2026-10-01
audience: engineer
order: 2
---
```

## 8. Workflow

Author edits markdown → PR → CI → live.

## 9. Bugs/Issues

_None — TODO._

## 10. Tests

| Test | Description | Status |
|------|-------------|--------|
| Frontmatter valid | All 6 files parse | **TODO** |
| Word count | Each ≤ 800 words | **TODO** |
| `refresh_by` not past | CI warns on stale guides | **TODO** |

## Quick Reference

| Artefact | Status |
|----------|--------|
| 6 markdown guides | **TODO** |
