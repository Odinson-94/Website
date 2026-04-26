# Codebase Coverage Report

> What the codebase already carries → what it needs to add for **full website auto-generation**. Snapshot taken 2026-04-20 from a fresh clone of `MEPBridge@master`.

---

## Headline gap

| Surface | Today | Needed for launch | Gap |
|---------|:-----:|:-----------------:|:---:|
| `[McpTool]` tools with `[Keywords]` | **191 / 191** ✅ | 191 / 191 | 0 |
| `[Transaction]` commands with `[Keywords]` | **163 / 163** ✅ | 163 / 163 | 0 |
| Commands with `<usecase>` | 131 / 163 | 163 / 163 | **32** |
| Commands with `<notfor>` | 131 / 163 | 163 / 163 | **32** |
| Commands with `<aiprompts>` | 132 / 163 | 163 / 163 | **31** |
| Commands with `[Output]` | 119 / 163 | 163 / 163 | **44** |
| Commands with `[ConfigInput]` (where applicable) | 86 / 163 | ~120 / 163 (some have no config) | **34** |
| Commands with `[SelectionInput]` (where applicable) | 34 / 163 | ~80 / 163 (others run on selection but don't declare) | **46** |
| Commands with `<logictree>` | 35 / 163 | 163 / 163 (nice-to-have for diagram) | **128** |
| **Commands with `[RestApi]`** | **0 / 163** | **163 / 163** | **163** ← THE BIG ONE |

The website builds either way — missing tags just produce smaller pages with empty sections hidden. But to expose every command as an API and unlock the full per-page automation, we close the gaps in the order below.

---

## Priority 1 — Add `[RestApi]` to all 163 commands  (the API gap)

### Why first

You said it directly: "exposing every command as an API". Today, none of the 163 chunky commands have a public REST surface. Once tagged, every one becomes:

- a `POST /api/v1/commands/<name>` endpoint,
- a `/docs/api/<name>/` reference page,
- an entry in `dist/api/openapi.json`,
- a Supabase Edge Function validator,

…all from one attribute per class.

### How

The attribute spec exists (Class Structure §REST API Exposure, lines 960–1065). Each command needs:

```csharp
[RestApi("extend_all_connectors_on_selected_elements",
    Description = "Extends pipes from all unconnected connectors on selected element(s).",
    Method = "POST",
    RequiresAuth = true,
    IsAsync = true)]

[RestApiParam("element_ids", "array<int>", "Element IDs to extend from",  Required = true)]
[RestApiParam("extension_length_mm", "double", "Pipe extension length in mm", Required = false)]

[RestApiResponse("created_pipes", "array<int>", "IDs of created pipes")]
[RestApiResponse("elements_processed", "int", "Number of elements processed")]
[RestApiResponse("total_pipes_created", "int", "Total pipe count")]
```

Most of the data needed for these tags is **already declared** on the existing `[SelectionInput]` / `[ConfigInput]` / `[Output]` attributes — so a scaffolder can do a first pass automatically and a human just reviews names and required-flags.

### Effort

| Task | Time |
|------|------|
| Write `tools/scaffold_rest_api_tags.py` (LLM-assisted, reads existing attrs, emits draft `[RestApi*]` tags) | ~2 hours |
| Run scaffolder over all 163 commands → drafts in PRs grouped by folder | ~30 min |
| Human review each draft (rename to snake_case, decide async/sync, decide auth tier) | ~3–4 hours |
| Write `tools/generate_rest_api_registry.py` (port of `generate_mcp_registry.py`) | ~3 hours |
| Wire into MEP Bridge `dotnet build` post-step | ~30 min |
| **Total to expose all 163 commands as APIs** | **~1 working day** |

---

## Priority 2 — Fill in missing `<usecase>` / `<notfor>` / `<aiprompts>`  (the prose gap)

### Coverage today

- 131 of 163 commands have `<usecase>` — the remaining **32** show empty "When to use this" sections.
- Same 32 are missing `<notfor>`.
- 31 are missing `<aiprompts>`.

### How

These are short prose blocks (3–6 sentences each). Same scaffold-then-review approach:

| Task | Time |
|------|------|
| Write `tools/scaffold_xml_doc_tags.py` (LLM reads `<summary>` + `[Keywords]` + class body + drafts `<usecase>`/`<notfor>`/`<aiprompts>` blocks) | ~2 hours |
| Run on the 32 commands missing `<usecase>` (and the 31 missing `<aiprompts>`) | ~15 min |
| Human review (rename, sharpen tone) | ~2 hours |
| **Total to close prose gap** | **~half a day** |

---

## Priority 3 — Fill in missing `[Output]`  (the schema gap)

44 commands have no `[Output]` attribute. The Returns table on those pages will be empty; more importantly, the eventual REST endpoint won't have a documented response shape.

| Task | Time |
|------|------|
| Inspect each command's `Execute()` method, look at the existing `CommandExecutor.SetResultObject({ ... })` payload (which most commands have), generate matching `[Output]` attributes | ~3 hours |
| **Total** | **~half a day** |

---

## Priority 4 — Fill in missing `[SelectionInput]` / `[ConfigInput]`  (the inputs gap)

Trickier because not all commands have user inputs (some run on the active view with no params). But the website should show **either** a populated Inputs table **or** a clear "This command takes no inputs" line — currently it's silent for ~50 commands.

| Task | Time |
|------|------|
| For each command without inputs declared: either confirm "no inputs" (annotate with a `[NoInputs]` marker so the page renders explicitly) OR add the missing attributes | ~4 hours |
| Add `[NoInputs]` attribute to `TrackingAttributes.cs` | 15 min |
| **Total** | **~half a day** |

---

## Priority 5 — Add `<logictree>` to all 163  (the diagram gap, nice-to-have)

35 of 163 have it. It's the richest visual section on a command page (renders as a vertical decision flowchart). 128 commands missing it.

| Task | Time |
|------|------|
| Hand-write per command — these need engineer judgment, not LLM scaffolding | ~5 min each × 128 = ~10 hours |
| Or skip for v1, ship without the diagram on those pages | 0 |
| **Recommendation:** ship without on launch; add over time as commands are touched. |

---

## Priority 6 — Tools coverage gaps

The 191 tools are in better shape:

- 100 % have `[McpTool]` and `[Keywords]`.
- Most have `[McpParam]` for their inputs.
- The shape of the return is implicit in the C# method signature; `generate_mcp_registry.py` already extracts it.

**Gap on tools:** there isn't really a structural one. The tool pages will render fully on day one. The only enrichment that helps is the **curated `data/examples/<name>.yaml`** files (prompts + expected outputs) — those are hand-written. Initial coverage target: the 108 `alwaysAvailable: true` tools first.

| Task | Time |
|------|------|
| Write `data/examples/<tool>.yaml` for the 108 always-available tools (3 prompts each) | LLM-drafted in batch, human-reviewed: ~2 days total over a sprint |

---

## Sequencing recommendation

| Sprint | Output | Effort |
|--------|--------|--------|
| **Sprint 0 (this week)** | Repo hygiene + sync infra + sandbox locked | 3 days |
| **Sprint 1** | Attribute scaffold scripts (Priority 1 + 2 + 3 + 4) **in MEP Bridge**, run them, review and merge in 4 PRs (one per priority). At end: 163 commands fully attributed. | 2 days |
| **Sprint 2** | `generate_rest_api_registry.py` written, build wired up, sync flows. Generators in Website repo: `build-tool-pages.mjs`, `build-command-pages.mjs`, `build-bridge-pages.mjs`. At end: 191 tool pages + 163 command pages live. | 3 days |
| **Sprint 3** | `/api/v1/commands/<name>` endpoints live in Supabase. OpenAPI spec live. Demos and workflows wired in (hand-curated YAML, no code change). | 3 days |
| **Sprint 4** | Polish, perf budgets, SEO, launch. | 2 days |

**Total to a fully populated public site: ~13 working days** with one developer, faster with two.

---

## Decision needed from you

1. **Ship `[RestApi]` to all 163 commands?**
   - **Option A — yes, all 163.** Maximum API surface; partner ecosystem unlocked; future-proof. Effort ~1 day to tag, ~3 hours scripting.
   - **Option B — selective tagging only.** Tag the chunky / external-facing ones (clash export, drawing export, COBie, batch tagging — your earlier ~25). Leaves internal-only commands as Revit-only. Lower scope but ships faster.

   **My recommendation: Option A.** The marginal cost is tiny because the scaffolder generates first-pass tags from existing data. The marginal benefit is huge: every command becomes an integration target.

2. **Fill the 32-command prose gap before launch, or ship with empty sections that hide?**
   - **A — fill it.** Half a day of scaffold + review.
   - **B — ship now, fill incrementally.** Page just hides empty sections; nothing visibly broken.

   **My recommendation: A.** It's half a day to give every command page parity.

3. **Bundle the scaffolder scripts into the MEP Bridge repo, or keep them in Website repo `tools/`?**
   - **A — MEP Bridge.** They live next to `generate_mcp_registry.py` etc., run as part of `dotnet build`, fail the build if they regress.
   - **B — Website repo.** Run on demand only; doesn't gate Bridge builds.

   **My recommendation: A.** Same pattern as the existing scripts; same reviewers; one place to look.

Once you tell me which way on those three, I draft the scaffolder scripts and the new generator, and we start the actual build.
