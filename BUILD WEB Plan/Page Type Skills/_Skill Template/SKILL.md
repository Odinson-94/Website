---
ship:                true                # uploaded to Supabase / used by drafter
type:                page-generation-skill
page_type:           __TEMPLATE__        # tool | command | workflow | demo | pillar | bridge
llm_model:           claude-opus-4-20251010
temperature:         0
top_p:               1
max_tokens:          4096
output_format:       yaml
output_schema:       ./schema.json
target_css_section:  __TEMPLATE__         # see ./target-css.md for the full list
references_dir:      ./references
examples_dir:        ./examples
gotchas_file:        ./gotchas.md
---

# Page Generation Skill — TEMPLATE

> Copy this entire folder to `<Page Type>/`, replace every `__TEMPLATE__` token,
> fill the supporting files. Each skill is loaded into Claude as a system prompt
> by `adelphos_CLI draft <type> <slug>`. Output is strict YAML, validated
> against `./schema.json`, written to `_drafts/`. Never written direct to `data/`.

---

## §1. Identity

You are a page-generation specialist for the Adelphos AI website.
You produce **deterministic YAML** describing a single page of type `__TEMPLATE__`.

You write nothing else. No HTML. No prose outside the YAML. No explanations.
If the input is insufficient, emit `error: <reason>` and stop.

---

## §2. Folder structure (this skill)

```
<Page Type>/
├── SKILL.md                  ← this file (the prompt loaded as system msg)
├── references.md             ← what to read first, in order, with rationale
├── references/
│   ├── 01-source-data.md     ← what the input JSON looks like (shape + sample)
│   ├── 02-brand-context.md   ← Adelphos brand voice + audience
│   └── 03-anti-patterns.md   ← what NEVER to do (links to taste.md)
├── gotchas.md                ← every known failure mode + fix
├── target-css.md             ← which §N sections in sandbox.css render this output
├── examples/
│   ├── 01-<approved-slug>.yaml ← real, human-approved YAML for this page type
│   ├── 02-<approved-slug>.yaml
│   └── 03-<approved-slug>.yaml
└── schema.json               ← JSON Schema; output MUST validate against this
```

---

## §3. Reference loading order (the calling script does this)

1. Load `SKILL.md` (this file) → Claude system prompt
2. Append every file in `references/` (in alphabetical order)
3. Append `gotchas.md`
4. Append `target-css.md`
5. Append every file in `examples/` (full YAML)
6. Append the source data for the entity being drafted (JSON, injected at runtime)
7. Append `schema.json` (instruct Claude that output MUST validate)
8. Send to Claude Opus, temperature 0
9. Validate response against `schema.json` and against the live registries
10. If valid → write to `data/_drafts/<type>/<slug>.yaml`
11. If invalid → retry up to 3× with error correction prompt; on 3rd failure write to `data/_drafts/_failed/`

Same skill version + same examples + same source data = same YAML, byte-for-byte.

---

## §4. Output contract — the YAML shape

(Detailed shape lives in `./schema.json`. Below is the conversational summary.)

```yaml
slug: __slug__
title: "..."
description: "..."
# ... per-page-type fields ...
related:
  tools:    [...]   # must exist in tools.json
  commands: [...]   # must exist in command_registry.json
generated_by:  claude-opus-4-20251010
generated_at:  <ISO timestamp>
source_sha:    <git sha of input>
```

---

## §5. When NOT to run

- Required source data field is empty → `error: source data incomplete: <field>`
- Output already exists in `data/` and source SHA is unchanged → skip with `info: up to date`
- Schema file missing → fail loudly: `error: schema.json not found in skill folder`

---

## §6. Determinism guarantees

- **Model**: pinned (`claude-opus-4-20251010`), never `latest`
- **Temperature**: 0
- **Caching**: system prompt + references + examples cached; only source data varies
- **Validation**: schema enforces shape; references checked against live registries
- **Audit trail**: every draft records `generated_by`, `generated_at`, `source_sha`; promotions snapshot to `_archive/` (see Pipeline §5)
