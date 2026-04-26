# Examples Plan

> Parent: [Project Structure Plan](../Project%20Structure%20Plan.md)
> Location: `BUILD WEB Plan/Examples/`
> Status: **TODO** — no `data/examples/` directory yet.
> Sister plans: [Documentation Plan](../Documentation/Documentation%20Plan.md), [Demos Plan](../Demos/Demos%20Plan.md), [REST API Plan](../REST%20API/REST%20API%20Plan.md).

---

## Purpose

Curated **prompt → expected result** pairs that show what each tool actually does in plain English. Renders into:

- The Try It block on every tool page (`/docs/tools/<name>`).
- Seed prompts on every demo card (`/demos/<slug>`).
- Test fixtures for the Demo Run API (regression tests against sandbox models).
- The skill markdown files (skills can quote their own examples).

**Coverage targets (in order):**

1. All 108 `alwaysAvailable: true` tools — Phase 3.
2. All 27 DrawingExporter tools (highest commercial value) — Phase 3.
3. The remaining 55 task-specific tools — Phase 4.
4. All 25 `[RestApi]` commands (worked-end-to-end examples with curl + JS + Python) — Phase 2 alongside REST API ship.

---

## Children (H3)

| Plan | Status | One-line summary |
|------|--------|------------------|
| [Authoring Workflow Plan](Authoring%20Workflow/Authoring%20Workflow%20Plan.md) | **TODO** | How a contributor writes, tests, and ships a new example YAML. |

---

## 1. Source of Truth

Hand-curated YAML files under `data/examples/`. One file per tool (matching tool name). Schema validated by JSON Schema.

```yaml
# data/examples/list_rooms.yaml
tool: list_rooms
canonical_prompts:
  - prompt: "List all rooms on Level 02"
    expected:
      summary: "Returns all rooms whose level is named 'Level 02', sorted by room number."
      sample_response: |
        [
          {"id": 345621, "name": "Office",  "number": "02-014", "area_m2": 18.4, "level": "Level 02"},
          {"id": 345629, "name": "Meeting", "number": "02-015", "area_m2":  9.7, "level": "Level 02"}
        ]
    notes: "Empty result is valid — agent should suggest checking the level name spelling."
  - prompt: "Which rooms on the ground floor are larger than 25 m²?"
    expected:
      summary: "Filtered list, sorted by area descending."
related_skills: [filters_templates, schedules]
related_tools:  [list_levels, snapshot_query, get_current_view_level]
```

For `[RestApi]` commands, one extra block:

```yaml
# data/examples/export_clash_results_to_xml.yaml
tool: export_clash_results_to_xml
http_examples:
  curl: |
    curl -X POST https://adelphos.ai/api/v1/commands/export_clash_results_to_xml \
      -H "Authorization: Bearer $JWT" \
      -H "Idempotency-Key: $(uuidgen)" \
      -H "Content-Type: application/json" \
      -d '{"format":"BCF 2.1"}'
  javascript: |
    const r = await fetch("https://adelphos.ai/api/v1/commands/export_clash_results_to_xml", {
      method: "POST",
      headers: { "Authorization": `Bearer ${jwt}`, "Idempotency-Key": crypto.randomUUID(), "Content-Type": "application/json" },
      body: JSON.stringify({ format: "BCF 2.1" })
    });
    const { job_id } = await r.json();
  python: |
    import httpx, uuid
    r = httpx.post("https://adelphos.ai/api/v1/commands/export_clash_results_to_xml",
        headers={"Authorization": f"Bearer {jwt}", "Idempotency-Key": str(uuid.uuid4())},
        json={"format": "BCF 2.1"})
    job_id = r.json()["job_id"]
```

---

## 2. Build Pipeline

```
data/examples/<tool>.yaml
        │
        ├─▶ build-tool-pages.mjs (reads matching YAML, embeds into tool page)
        ├─▶ build-demo-cards.mjs (uses canonical_prompts as seed_prompts if not overridden in demos.yaml)
        ├─▶ build-api-reference.mjs (uses http_examples on REST command pages)
        └─▶ tests/demo-run.spec.mjs (sends prompt to Demo Run API, asserts response shape)
```

---

## 3. Runtime Surface

None — examples are static content rendered at build time.

---

## 4. UI Surface

Embedded into the tool page as a "Try It" / "Examples" section, not a separate route.

---

## 5. Risk Research — Known Issues & Pitfalls

| # | Area | Finding | Mitigation | Source |
|---|------|---------|------------|--------|
| 1 | Sample responses drift | Tool changes shape; YAML sample_response now lies. | CI: when registry changes for a tool, flag matching YAML for review (PR comment). Optional: live-fetch sample_response from sandbox at build time. | Self-rule |
| 2 | Authoring scale | 190 tools × 3 prompts each = 570 entries to write | Prioritise by `alwaysAvailable` first; LLM-assisted draft from `tool.description` + `tool.keywords`, human review/approve. | Pragmatic. |
| 3 | Localisation | English only at v1. | YAML schema has `lang: en`; future i18n can add `lang: de` etc. without breaking. | Schema design |
| 4 | Sensitive data leakage in samples | A sample_response containing real client room names. | Sandbox-only data; CI gate forbids sample_responses containing common UK client names (regex blocklist). | Self-rule |
| 5 | Prompt injection in seeded demos | A "fun" prompt that tries to break the agent. | All seed prompts vetted at PR time; CI runs the prompt against sandbox and rejects if > 5 s or > 10 KB response. | Self-rule |

---

## 6. File Layout

```
data/examples/
    list_rooms.yaml                      # — TODO
    list_levels.yaml                     # — TODO
    ...one per tool...
    export_clash_results_to_xml.yaml     # — TODO

schemas/
    example.schema.json                   # JSON Schema validator   — TODO

scripts/
    seed-examples-from-registry.mjs       # one-shot bootstrap (LLM-drafted)  — TODO
    validate-examples.mjs                  # CI gate                            — TODO

tests/
    demo-run.spec.mjs                       # E2E vs Demo Run API                — TODO
```

---

## 7. Configuration

JSON Schema enforces shape; no other config. Initial author quotas tracked in `BUILD WEB Plan/Examples/Authoring Workflow/Authoring Workflow Plan.md`.

---

## 8. Workflow

### Workflow: Bootstrap initial 108 examples

1. Run `node scripts/seed-examples-from-registry.mjs --filter alwaysAvailable=true`.
2. Script calls Anthropic / OpenAI with `tool.description` + `tool.parameters` + `tool.keywords` and asks for 3 prompt/expected pairs each.
3. Writes draft YAML to `data/examples/`.
4. Reviewer goes file by file: edit prompt for natural English, run against sandbox via `node scripts/validate-examples.mjs --tool=list_rooms`, paste real response into `sample_response`, approve.
5. Single PR per batch of 10–20.

### Workflow: A new tool ships in MEP Bridge

1. Cross Repo Sync brings tool into `data/registry.json`.
2. Tool page builds without examples (still functional, just no Try It block).
3. CI emits a TODO summary: "5 new tools without examples — see /docs/tools?missing-examples".
4. Author writes example YAML when capacity allows.

---

## 9. Bugs/Issues

_None yet — directory doesn't exist._

---

## 10. Tests

| Test | Description | Status |
|------|-------------|--------|
| Schema valid | All YAML pass `example.schema.json` | **TODO** |
| Prompt resolves | Each prompt sent to sandbox returns success | **TODO** |
| Sample response shape | sample_response JSON parses; matches a JSON Schema derived from tool's expected return | **TODO** |
| Coverage report | CI prints "Examples coverage: 108/190 tools (57%)" | **TODO** |

---

## Quick Reference — Build Status Summary

| Artefact | File | Tier | Status |
|----------|------|------|--------|
| Schema | `schemas/example.schema.json` | Internal | **TODO** |
| Seeder script | `scripts/seed-examples-from-registry.mjs` | Internal | **TODO** |
| Validator | `scripts/validate-examples.mjs` | Internal | **TODO** |
| 108 alwaysAvailable example YAMLs | `data/examples/*.yaml` | Public | **TODO** |
| 25 REST API example YAMLs | `data/examples/*.yaml` | Public | **TODO** |
| **Total** | | | **0 Built / 5 TODO + 133 example files** |
