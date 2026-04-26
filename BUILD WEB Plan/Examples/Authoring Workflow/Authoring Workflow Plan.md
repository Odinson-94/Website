# Authoring Workflow Plan

> Parent: [Examples Plan](../Examples%20Plan.md)
> Status: **TODO**

## Purpose

The exact day-to-day process for authoring a `data/examples/<tool>.yaml` file. LLM-assisted draft, human-validated.

## 1. Source of Truth

`scripts/seed-examples-from-registry.mjs` (LLM-drafted starter) + human review.

## 2. Build Pipeline

```
node scripts/seed-examples-from-registry.mjs --filter <expr> --max <n>
        │
        ▼
  drafts in data/examples/.drafts/<tool>.yaml
        │
        ▼ author edits, runs validate
        │
node scripts/validate-examples.mjs --tool <name>
        │
        ├─▶ schema check
        ├─▶ live run against sandbox via Demo Run API
        └─▶ pretty-prints sample_response into YAML
        │
        ▼ author moves to data/examples/<tool>.yaml
        │
        ▼ PR
```

## 3. Runtime Surface

None.

## 4. UI Surface

CLI only at v1. Optional v2: a small in-browser editor on `/contributors/examples/`.

## 5. Risk Research

| # | Area | Finding | Mitigation |
|---|------|---------|------------|
| 1 | LLM hallucination | Drafts may invent param names | Validator checks every param mentioned exists in registry. |
| 2 | Quota burn | Drafting 190 tools × 3 prompts × LLM cost adds up | Batch in chunks of 20; cache by `{tool.name + tool.description hash}`. |
| 3 | Inconsistent voice | Different authors → mixed tones | Prompt template enforces voice (active, second person, ≤ 12 words). |

## 6. File Layout

```
scripts/seed-examples-from-registry.mjs   # — TODO
scripts/validate-examples.mjs              # — TODO
data/examples/.drafts/                     # gitignored — TODO
```

## 7. Configuration

`scripts/lib/draft-prompt.txt` — the LLM prompt template.

## 8. Workflow

Detailed in §2 above.

## 9. Bugs/Issues

_None — TODO._

## 10. Tests

| Test | Description | Status |
|------|-------------|--------|
| Seed produces valid YAML | Run on 5 tools, all pass schema | **TODO** |
| Validator catches bad param | Inject typo → fails clearly | **TODO** |

## Quick Reference

| Artefact | Status |
|----------|--------|
| Seeder + validator + draft prompt | **TODO** |
