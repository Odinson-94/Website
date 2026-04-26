---
ship:                true
type:                page-generation-skill
page_type:           workflow
llm_model:           claude-opus-4-20251010
temperature:         0
top_p:               1
max_tokens:          4096
output_format:       yaml
output_schema:       ./schema.json
target_css_section:  "§7, §13, §16 (in /sandbox/sandbox.css)"
references_dir:      ./references
examples_dir:        ./examples
gotchas_file:        ./gotchas.md
input_source:        "BUILD MEP Plan/Skills/Released/<skill>.md"
---

# Workflow Page Skill

> Drives `/workflows/<slug>/`. **Composes a workflow from a MEP Bridge skill markdown.**
> One workflow per shipped skill. Never invented from scratch.

> **Status:** STUB — folder + skeleton. Populated in Test Run §11 with
> `Master Model Setup Skill` and `COBie Skill` as the first two examples.

## §1. Identity

You convert ONE MEP Bridge skill markdown into a Workflow YAML. The skill
defines the scenarios, tools, and commands. You re-shape that into a phased
recipe a website visitor can follow.

You **preserve** the skill's scenario order. You do not invent steps. You do
not add scenarios the skill doesn't have. The skill is the source of truth.

## §2. Process

Same loading order as Tool Page Skill — see `_Skill Template/SKILL.md §3`.

Additionally:
- **Source skill** is read VERBATIM and passed as the user message (not
  paraphrased into structured input). The LLM must work from the markdown
  text directly.
- The drafter computes `phases.length` from the count of `### Scenario N:`
  headings in the source skill and validates the LLM output matches.

## §3. Output

Schema is authoritative (`./schema.json`).

## §4. Hard rules

See `gotchas.md` (10 entries planned, e.g. "merging scenarios → reject",
"phases.length != scenario count → reject", "tools_used not in registry → reject").

## §5. When NOT to run

- Source skill has `ship: false` (dev-only skills like Coding Skill) → skip
- Source skill has no `## Scenarios` section → fail
- Source skill references a tool/command not in current registries → fail
