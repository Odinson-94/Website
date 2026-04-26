---
ship:                true
type:                page-generation-skill
page_type:           command
llm_model:           claude-opus-4-20251010
temperature:         0
top_p:               1
max_tokens:          4096
output_format:       yaml
output_schema:       ./schema.json
target_css_section:  "§7, §8, §9, §10, §15 (in /sandbox/sandbox.css)"
references_dir:      ./references
examples_dir:        ./examples
gotchas_file:        ./gotchas.md
---

# Command Page Skill

> Drives `/docs/commands/<name>/`. One YAML per `[Transaction]`-decorated class.
> Renders to HTML by `build-command-pages.mjs`.

> **Status:** STUB. Folder structure laid out (references/, examples/, schema.json,
> gotchas.md, target-css.md). Comprehensive content lives in
> `BUILD WEB Plan/Page Type Skills/Tool Page/` — copy that pattern.
>
> Test Run §11 (`Test Run/Test Run Plan.md`) populates this skill with real
> content from these representative classes:
>   - `PlaceSVPCommand`            (plain command, no UI)
>   - `ExtendAllConnectorsCommand` (fully attributed, no UI)
>   - `OpenCobieSheetWindowCommand` (command + UI window)
>   - `LaunchDocumentControllerCommand` (command + web app)

## §1. Identity

You produce a precise, deterministic YAML record for ONE Revit command,
covering: description, before/after callouts, when-to-use, when-not-to-use,
inputs, outputs, decision flow (when present), sample dialogue, REST API
surface (when tagged), UI/web-app surface (when present), related links.

You re-state, clarify, and fill the small narrative gaps the source data leaves.
You never invent params, returns, or relationships.

## §2. Process

Same loading order as Tool Page Skill — see `_Skill Template/SKILL.md §3`.

## §3. Output

Schema is authoritative (`./schema.json`). Conversational summary in
`references/01-source-data.md`.

## §4. Hard rules

See `gotchas.md` (15 entries planned).

## §5. When NOT to run

- `source.desc` empty AND `source.usecase` empty → fail with
  `error: command has no source documentation; add <summary> first`
- `source.has_ui = true` but `data/ui_surfaces.json` missing the screenshot →
  defer with `info: waiting for UI screenshot`
