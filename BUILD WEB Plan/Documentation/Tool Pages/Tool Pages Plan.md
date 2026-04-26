# Tool Pages Plan

> Parent: [Documentation Plan](../Documentation%20Plan.md)
> Status: **TODO** — generator + template not built; 0 of 190 pages exist.

## Purpose

One auto-generated HTML page per `[McpTool]` in the MEP Bridge registry. Zero hand-maintenance; rebuilt on every sync from MEP Bridge.

## 1. Source of Truth

`data/registry.json` (synced) + `data/examples/<name>.yaml` (curated, optional).

## 2. Build Pipeline

`scripts/build-tool-pages.mjs` reads each tool, applies the template, writes `dist/docs/tools/<name>.html`. See [Generators Plan #1](../../Automation%20Pipeline/Generators/Generators%20Plan.md#2-build-pipelinegenerator-inventory).

## 3. Runtime Surface

None — static HTML.

## 4. UI Surface — Page Anatomy

```
H1: <tool.name>
[bridge badge] [category badge] [alwaysAvailable badge]
Description: <tool.description>

Section: Source
  filePath, namespace, className (sanitised — only shown for public-safe fields)

Section: Parameters (table from tool.parameters[])
  name | type | required | description | default

Section: Keywords
  comma list of tool.keywords[]

Section: Example prompts (from data/examples/<name>.yaml if present)
  prompt | expected summary | sample response (collapsible)

Section: Try It
  → /demos/?tool=<name>&prompt=<first canonical prompt>

Section: Related
  Related tools (from examples yaml + same-bridge siblings)
  Related skills (from examples yaml + skills that mention this tool in tools[])

Section: REST API equivalent (if matching [RestApi] command exists)
  → /docs/api/<command>
```

## 5. Risk Research

See parent §5. Specific:

- Tools with no examples render a friendly empty state ("No example prompts yet — contribute!") with link to repo.
- Slugify special chars in tool names (already snake_case so safe; assert).

## 6. File Layout

```
templates/tool-page.html                # — TODO
scripts/build-tool-pages.mjs            # — TODO
dist/docs/tools/<name>.html             # — TODO  (× 190)
dist/docs/tools/index.html              # filterable index — TODO
```

## 7. Configuration

Per-bridge badge colour map:

```js
export const BRIDGE_COLORS = {
  RevitContext:     "#156082",
  DrawingExporter:  "#2E7D32",
  SelfDebug:        "#C62828",
  Snapshot:         "#6A1B9A",
  ParameterEditor:  "#EF6C00",
  "":               "#455A64"   // generic
};
```

## 8. Workflow

See [Automation Pipeline §8](../../Automation%20Pipeline/Automation%20Pipeline%20Plan.md#8-workflow). New tool in MEP Bridge → page live in <3 min.

## 9. Bugs/Issues

_None — TODO._

## 10. Tests

| Test | Description | Status |
|------|-------------|--------|
| Page count == registry count | `ls dist/docs/tools | wc -l` == 190 | **TODO** |
| Each page valid HTML | `html-validate dist/docs/tools/*.html` passes | **TODO** |
| Each page has all sections | Visual regression / structural assertion | **TODO** |
| Try It link works | E2E: click button, demo runs | **TODO** |
| Search index includes every tool | Index entries == 190 | **TODO** |

## Quick Reference

| Artefact | Status |
|----------|--------|
| Template | **TODO** |
| Generator | **TODO** |
| 190 pages | **TODO** |
| Index page | **TODO** |
