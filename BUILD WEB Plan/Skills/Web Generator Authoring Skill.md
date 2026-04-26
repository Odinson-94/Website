---
ship: false
category: web
tools: []
commands: []
keywords:
  - generator
  - build script
  - scaffolding
  - automation
---

# Web Generator Authoring Skill

> How to write or extend a `scripts/build-*.mjs` generator script in this repo.

## Prerequisites

- Node 20+
- `data/` folder populated (run `npm run sync` to pull from MEP Bridge)
- Familiarity with [Generators Plan](../Automation%20Pipeline/Generators/Generators%20Plan.md)

## Scenarios

### Scenario 1: Add a new generator

1. Decide source-of-truth file in `data/`. If new, also add a JSON Schema in `schemas/`.
2. Copy `scripts/build-tool-pages.mjs` as starting point.
3. Read input via `loadAndValidate('data/foo.json', 'schemas/foo.schema.json')` from `scripts/lib/registry.mjs`.
4. Render via `renderTemplate('templates/foo.html', context)` from `scripts/lib/renderer.mjs`.
5. Write outputs in batches of 50 with `Promise.all`.
6. Push entries to search index via `searchIndex.add({type, title, url, keywords})`.
7. Print summary: `WROTE N pages → dist/<route>` (no spinners, no clocks).
8. Exit non-zero on any validation failure.

### Scenario 2: Extend an existing generator without breaking reproducibility

1. Run `npm run build` twice locally; assert `git diff dist/` is empty.
2. Make change.
3. Run twice again; assert empty diff.
4. If diff appears, look for: `Date.now()`, `Math.random()`, `for (const k of obj)` (insertion order can vary), unsorted directory reads.
5. Fix by reading `version.json.generatedAt`, sorting array iterations, and using stable sorts.

### Scenario 3: Debug a CI failure on a generator

1. Pull the failing PR locally.
2. Run the specific generator: `node scripts/build-foo.mjs`.
3. Check the validation error in the first 5 lines of output.
4. If schema mismatch: update the schema only when MEP Bridge has truly added a new field; otherwise fix `data/`.
5. If link rewrite failure: check that the targeted `*.md` file exists in `data/skills/` post-sync.

## Do / Don't

**Do:**
- One responsibility per script (no mega-builder).
- Validate inputs before producing outputs.
- Sort everything that's iterated for stable output.
- Use `node:fs/promises` and parallel writes.
- Print actionable errors with the file + line + suggested fix.

**Don't:**
- Call `Date.now()`, `Math.random()`, or read environment in non-deterministic ways.
- Hand-write any artefact a generator can produce.
- Couple two generators (B importing from A's internals); share via `scripts/lib/`.
- Skip schema validation "just this once" — every generator gates inputs.

## Error Recovery

| Error | Cause | Fix |
|-------|-------|-----|
| `Schema validation failed` | Input changed shape | Update schema if MEP Bridge moved (commit schema bump alongside code change), else fix data |
| `git diff dist/` non-empty after 2× build | Non-determinism | Search for clocks/randomness/unsorted iteration |
| `Lighthouse perf < 90` | New page heavier than budget | Defer non-critical scripts; preload critical CSS; reduce LCP element |
| `Broken link in dist/` | Link to a slug that doesn't exist | Run lychee locally; either fix the link or generate the missing target |
