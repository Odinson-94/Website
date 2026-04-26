# Attribute → Webpage Map

> **Every** attribute and XML doc tag that exists in the MEP Bridge codebase, mapped to the exact section of the website it drives. Read this top-to-bottom and you'll see why almost zero hand-writing is needed for the 354 reference pages.
>
> Source of truth for attributes: [Class Structure §EXAMPLE FOR COMMANDS](../../../13%20MCP%20UI/MEPBridge/MEPBridge.Revit/Revit.MEP.Suite/0.0%20Design%20Models/52%20Drainage/Class%20Structure.md), [MCP Tool Creation Skill](../../../13%20MCP%20UI/MEPBridge/BUILD%20MEP%20Plan/Skills/MCP%20Tool%20Creation%20Skill.md).
> Canonical example showing all of them in one file: [`MEPBridge.Revit/Revit.MEP.Suite/0.0 Design Models/52 Drainage/ExtendAllConnectorsCommand.cs`](../../../13%20MCP%20UI/MEPBridge/MEPBridge.Revit/Revit.MEP.Suite/0.0%20Design%20Models/52%20Drainage/ExtendAllConnectorsCommand.cs).

---

## How this works in one paragraph

Every C# class in MEP Bridge that the agent can call has a stack of attributes plus structured XML doc-comment tags. A Python script at build time (`generate_mcp_registry.py` for tools — exists; `generate_command_registry.py` for commands — TODO) parses those attributes/tags into JSON. The Website repo's generators read that JSON and slot each field into a fixed slot on the webpage template. **The C# source is the single source of truth — the website is a read-only projection of it.**

---

## The full attribute set, what it carries, and where it appears

### 1. Class-level routing attributes (which kind of surface this becomes)

| Attribute | Carries | Webpage section it drives | Coverage |
|-----------|---------|--------------------------|:--------:|
| `[McpTool("name", "description", …)]` | Tool name + one-line description + Category + RequiresBridge + AlwaysAvailable | Page H1 + lead paragraph + bridge pill + category pill + always-on pill on `/docs/tools/<name>/` | 191 / 191 |
| `[Transaction(TransactionMode.Manual)]` | Marks the class as a Revit external command (writes to model) | Triggers generation of `/docs/commands/<class>/` page, sets the "writes to model" badge | 163 / 163 |
| `[RestApi("name", Description, Method, RequiresAuth, IsAsync)]` | REST surface name + HTTP method + auth + sync/async | Generates `/api/v1/commands/<name>` endpoint, populates `/docs/api/<name>/` page, OpenAPI 3.1 spec entry | **0 / 163 ← THE ONE GAP** |
| `[CommandCategory("Command", DisplayName = "…")]` | Category bucket + display name | Sidebar grouping in `/docs/commands/`, breadcrumb "Commands › Drainage › Extend All Connectors" | partial |
| `[ServiceType("SoilDrainage")]` | Discipline tag (drainage / heating / vent / lighting / etc.) | Routes the command into the matching Product Pillar page (`/products/<service>/`) | partial |
| `[UsedImplicitly]` | JetBrains hint, no website effect | — | n/a |

### 2. Parameter / I-O attributes (the inputs/outputs tables)

| Attribute | Carries | Webpage section |
|-----------|---------|----------------|
| `[McpParam("name", "type", "description", Required = …)]` | Tool input parameter (for `[McpTool]` classes) | Inputs table on `/docs/tools/<name>/` |
| `[SelectionInput("name", "Type", "description", Prompt, SupportsLinkedModels, Example)]` | What the user selects (Grid, Room, Element, etc.) | Inputs table → "Selection" group; pre-fills the `Prompt` and `Example` columns |
| `[ConfigInput("name", "type", "description", DefaultValue, Example)]` | What the user types/sets (Scale, ExtensionLength, etc.) | Inputs table → "Config" group; default value column auto-populated |
| `[Output("name", "Type", "description", Nullable, Destination, Example)]` | What the command emits (CreatedSection, CreatedPipes, etc.) | Outputs table; powers the response shape on the REST API page |

### 3. Cross-reference attributes (the related-links graph)

| Attribute | Carries | Webpage section |
|-----------|---------|----------------|
| `[Calls("OtherClass")]` | Downstream dependency | "Calls" row on the page; `<see cref>` links in IDE; powers the dependency graph diagram |
| `[CalledBy("Caller")]` | Upstream caller | "Called by" row; reverse-graph |
| `[RelatedCommands("A", "B")]` | Sibling commands worth recommending | "Related commands" strip at the bottom |
| `<see cref="OtherClass"/>` (XML) | IDE-navigable link in summary/param/returns | Inline link inside rendered page text; auto-rewritten to `/docs/commands/<…>/` or `/docs/tools/<…>/` URL |

### 4. Discovery attributes (the search/intent layer)

| Attribute | Carries | Webpage section |
|-----------|---------|----------------|
| `[Keywords("phrase 1", "phrase 2")]` | Natural-language phrases for matching | Search index entries; visible "Keywords" pill row at page footer |
| `[IntentPattern("create * section * grid", …)]` | Wildcard intent patterns the orchestrator matches against | "How the agent triggers this" callout; powers similarity-suggested commands |

### 5. XML doc tags (the structured prose)

| XML tag | Carries | Webpage section |
|---------|---------|----------------|
| `<summary>` | What the command/tool does, the key dependencies (with `<see cref/>`) | Page lead paragraph (h1 + first paragraph) |
| `<precondition>` | What must be true before running | "Before you run this" callout |
| `<postcondition>` | The model state after success | "After it runs" callout |
| `<usecase>` | When to use it (free-form sentences) | "When to use this" h2 + bullet list (split on `. `) — **the most useful auto-content** |
| `<notfor>` | When NOT to use it / which sibling to use instead | "Don't use this for" callout (yellow / warn style) |
| `<sideeffects>` | Non-obvious model changes | "Side effects" callout |
| `<keywords>` | Free-text keywords (parallel to `[Keywords]`) | Footer keyword pills (deduplicated with attribute) |
| `<logictree>` | Decision flow (`check:`, `action:`, `resolve:`) | "Decision flow" diagram, rendered as a vertical flowchart |
| `<param name="…">` | Parameter description with `<see cref/>` to source-of-valid-values | Inputs table description column |
| `<returns>` | Return value description with `<see cref/>` to consumer | Outputs table description column |

### 6. AI-prompt diversity tags (the "what you'll see" preview)

Inside `<aiprompts>`:

| Tag | Carries | Webpage section |
|-----|---------|----------------|
| `<preprompt>` | Strings shown when the command starts | "Sample dialogue → start" line |
| `<thinkingstep>` | Per-step progress messages | "Sample dialogue → progress" sequence |
| `<preconditionprompt>` | Pre-run checks announced to user | "Pre-flight" announcement |
| `<resolverprompt name="…">` | What the agent says when an input is missing | Inline next to each missing input row in the Inputs table |
| `<successprompt>` | Variants of the success message (with `{placeholder}` from outputs) | "On success you'll see" example |
| `<failureprompt>` | Variants of the failure message (with `{error}`) | "If it fails you'll see" example |

### 7. Resolver pattern (AI inputs as code)

Class properties named `Resolver_<Name>` (e.g. `Resolver_Grid`, `Resolver_Scale`) are auto-detected by `command_architecture_analyzer.py` and matched to:

- the matching `[SelectionInput]` / `[ConfigInput]` attribute (for the schema), and
- the matching `<resolverprompt name="Name">` (for the user-facing question).

Together these populate the Inputs table on the webpage **and** the runtime resolver questions in the Edge Function validator.

---

## How a single command renders on the website

Take `ExtendAllConnectorsCommand.cs`. Reading the source top-to-bottom, here's what each block becomes on `/docs/commands/extend-all-connectors/`:

```
SOURCE                                       WEBPAGE BLOCK
──────────────────────────────────────────── ────────────────────────────────────────────
class name + namespace                       URL slug + breadcrumb
[Transaction] + [CommandCategory]            "Revit Command" badge + category pill
[ServiceType("SoilDrainage")]                Pillar pill linking to /products/drainage/
[Keywords(...)] + [IntentPattern(...)]       Footer keyword pills + search index
<summary>                                    H1 + lead paragraph (first sentence becomes H1
                                             if no DisplayName, otherwise lead)
<precondition>                                "Before you run this" callout
<postcondition>                               "After it runs" callout
<usecase>                                     "When to use this" h2 + bullets
<notfor>                                      "Don't use this for" warning callout
<sideeffects>                                "Side effects" callout
<logictree>                                   "Decision flow" rendered as a vertical chart
[SelectionInput("Element", ...)]              Inputs table → row "Element" / Selection / prompt
[ConfigInput("ExtensionLength", ...)]         Inputs table → row "ExtensionLength" / Config / default 100
[Output("CreatedPipes", ...)]                 Returns table → row "CreatedPipes" / List<Pipe>
[Calls(...)] / [CalledBy(...)]                "Implementation" reveal → call graph
[RelatedCommands(...)]                        "Related commands" footer strip
<aiprompts><preprompt>                         "What you'll see → on start" sample
<aiprompts><thinkingstep>                      "What you'll see → during" sample
<aiprompts><resolverprompt name="Element">     Inline next to "Element" row in Inputs
<aiprompts><successprompt>                     "On success" sample with {placeholders} highlighted
<aiprompts><failureprompt>                     "On failure" sample
[RestApi(...)]    ← TODO across the codebase   "REST API" tab → endpoint + body schema +
                                              curl/JS/Python examples
```

A real worked example sits at **`sandbox/docs/commands/extend-all-connectors.html`** — every section above is filled from the source.

---

## How a single tool renders on the website

Tools have a smaller surface than commands but the mapping is the same:

```
SOURCE                                       WEBPAGE BLOCK
──────────────────────────────────────────── ────────────────────────────────────────────
[McpTool("name", "desc", Category=, ...)]    URL slug + H1 + lead + bridge pill + category pill +
                                             "always available" badge if true
[McpParam("level", "string", "...")]          Parameters table — one row each
[Keywords(...)]                                Footer pills + search index
<summary>                                      Page lead (overrides description if longer)
return type / sample shape (from method body)  "Returns" code block (extracted by registry script)
data/examples/<name>.yaml (curated)            "Example prompts" + sample responses block
related tools (same bridge or keyword overlap) "Related" strip
related demos (declared in demo YAML)          "Related demos" strip
```

---

## What's auto vs hand for each page section

For every `/docs/commands/<name>/` page, here's the split:

| Section | Source | Auto / hand |
|---------|--------|------------|
| H1 + breadcrumb | class name + `[CommandCategory]` | **auto** |
| Lead paragraph | `<summary>` first sentence | **auto** |
| "Before you run" | `<precondition>` | **auto** |
| "After it runs" | `<postcondition>` | **auto** |
| "When to use" | `<usecase>` | **auto** |
| "Don't use for" | `<notfor>` | **auto** |
| "Side effects" | `<sideeffects>` | **auto** |
| "Decision flow" diagram | `<logictree>` | **auto** |
| Inputs table | `[SelectionInput]` + `[ConfigInput]` + `<param>` + `Resolver_*` | **auto** |
| Returns table | `[Output]` + `<returns>` | **auto** |
| Sample dialogue | `<aiprompts>` | **auto** |
| Related commands strip | `[RelatedCommands]` + `[Calls]` + `[CalledBy]` | **auto** |
| Search index entry | `[Keywords]` + `<keywords>` + `[IntentPattern]` | **auto** |
| REST API tab | `[RestApi]` + `[RestApiParam]` + `[RestApiResponse]` | **auto** (when added) |
| Related demos strip | `data/demos/*.yaml` `related_commands:` field | **hand-curated YAML** |
| Tutorial / how-to | `data/tutorials/<command>.md` | **hand-written** if needed |

**Anything not in the "hand" rows requires zero authoring on the website side.** Add or change an attribute in the C# source, push, and the page rebuilds.

---

## The one gap to close

`[RestApi]` is at **0 / 163** today. The attribute system is fully designed in the Class Structure REST API Exposure section (lines 960–1065) and the `generate_rest_api_registry.py` script is a known TODO. Once those exist:

1. Tag each command with `[RestApi("snake_case_name", ...)]` + `[RestApiParam(...)]` + `[RestApiResponse(...)]` — most of this is mechanical because the parameters are already declared on the existing `[SelectionInput]` / `[ConfigInput]` attributes; a script can scaffold first-pass tags.
2. `generate_rest_api_registry.py` produces `rest_api_registry.json`.
3. Website sync pulls it; `build-api-pages.mjs` produces `/docs/api/<name>/` for each.
4. Supabase Edge Function reads the same JSON to validate incoming POSTs.

**Effort to tag all 163:** roughly 1 day with an LLM-assisted scaffolder + half a day of human review. Or shipped in batches per pillar over a sprint. Discussed in the [Codebase Coverage Report](Codebase%20Coverage%20Report.md).

---

## Why this matters

You asked the right question: "we build the website from the codebase". The codebase is **already** carrying the data — 100 % of commands have keywords, 80 % have usecase / notfor / aiprompts, 73 % have output schemas. The website job isn't to write content, it's to **render** what the source already says. Adding `[RestApi]` to the chunky commands is the last attribute needed to expose every single one of them as both a doc page and a callable HTTP endpoint, with zero additional content authoring.
