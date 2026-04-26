# Page Type Skills — INDEX

> One folder per page type the website renders.
> Each folder is a **complete, self-contained Claude Opus skill** with
> `SKILL.md`, `references.md`, `references/`, `gotchas.md`, `target-css.md`,
> `examples/`, `schema.json`. The drafter loads ALL of these for one call.

---

## The skills

| Folder | Drives | Status |
|--------|--------|--------|
| `_Skill Template/` | Copy this when adding a new page type | reference template |
| `Tool Page/` | `/docs/tools/<name>/` | **Fully populated** — canonical worked example |
| `Command Page/` | `/docs/commands/<name>/` | Stub + folder shape; populated in Test Run §11 |
| `Workflow Page/` | `/workflows/<slug>/` (composed from a MEP Bridge skill) | Stub + folder shape; populated in Test Run §11 |
| `Demo Page/` | `/demos/<slug>/` (overlay metadata onto the auto-generated page) | Stub + folder shape; populated in Test Run §11 |
| `Pillar Page/` | `/products/<pillar>/` (one per the 16 pillars) | Stub + folder shape; populated in Test Run §11 |
| `Bridge Page/` | `/docs/bridges/<bridge>/` (one per `requiresBridge` value) | Stub + folder shape; populated in Test Run §11 |

---

## What's in every skill folder

```
<Page Type>/
├── SKILL.md                        ← prompt (loaded as Claude system msg)
├── references.md                   ← what to load, in order, with rationale
├── references/                     ← the actual files the LLM needs
│   ├── 01-source-data.md           — input JSON shape + sample
│   ├── 02-brand-context.md         — Adelphos voice + audience
│   ├── 03-anti-patterns.md         — never-do list (taste.md derived)
│   └── … extras as needed (e.g. 04-ui-surfaces.md for Command Page)
├── gotchas.md                      ← every known failure mode + fix
├── target-css.md                   ← which §N sections in sandbox.css render
│                                     this output, with size caps
├── examples/                       ← human-approved YAMLs (1–3)
│   ├── 01-<approved-slug>.yaml
│   ├── 02-<approved-slug>.yaml
│   └── 03-<approved-slug>.yaml
└── schema.json                     ← JSON Schema; output MUST validate
```

**Why this shape:** every file has a job. Every job is documented. The
drafter (an `adelphos_CLI` command) loads them in a deterministic order, so
two runs on the same source = the same YAML output, byte-for-byte.

---

## The drafter contract

```
adelphos_CLI draft tool list_rooms

  reads:
    Page Type Skills/Tool Page/SKILL.md           → system prompt
    Page Type Skills/Tool Page/references/*       → context (alphabetical)
    Page Type Skills/Tool Page/gotchas.md         → reminders
    Page Type Skills/Tool Page/target-css.md      → sizing constraints
    Page Type Skills/Tool Page/examples/*.yaml    → style anchors
    data/registry.json[list_rooms]                → source data (varies per call)
    Page Type Skills/Tool Page/schema.json        → validation contract
  calls:
    Claude Opus 4 (claude-opus-4-20251010)
    temperature: 0
    top_p: 1
    max_tokens: 3072
  receives:
    raw YAML response
  validates:
    parses as YAML?
    matches schema.json?
    every reference in related.* exists in the live registries?
  writes (if valid):
    data/_drafts/tools/list_rooms.yaml
  on failure:
    retries up to 3× with the validation error appended
    after 3 failures: data/_drafts/_failed/tools/list_rooms.yaml.failed
  finally:
    opens / updates a PR in the Website-Drafts repo
```

---

## How to add a new page type

1. Copy `_Skill Template/` → `<Your Page Type>/`
2. Replace every `__TEMPLATE__` token in `SKILL.md`
3. Fill `references/01-source-data.md` with the input JSON shape
4. Adapt `references/02-brand-context.md` if voice differs (usually doesn't)
5. Add anything new to `references/03-anti-patterns.md`
6. Write `gotchas.md` — start small, grow as you hit failures
7. Write `target-css.md` — list which `sandbox.css` §N sections render this page, with caps per field
8. Write `schema.json`
9. Author 1–3 human-approved YAMLs in `examples/`
10. Add `adelphos_CLI draft <type> <slug>` to the CLI

---

## See also

- [_Skill Template/](_Skill%20Template/) — the canonical structure to copy
- [Tool Page/](Tool%20Page/) — fully-populated worked example
- [Test Run/Test Run Plan.md](../Test%20Run/Test%20Run%20Plan.md) — the 6-class proof-of-concept that fills the stubs above with real content
- [End to End Automation Pipeline.md](../End%20to%20End%20Automation%20Pipeline.md) — where these skills fit in the larger pipeline
