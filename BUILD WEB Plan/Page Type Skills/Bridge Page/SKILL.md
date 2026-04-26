---
ship:                true
type:                page-generation-skill
page_type:           bridge
llm_model:           claude-opus-4-20251010
temperature:         0
top_p:               1
max_tokens:          1024
output_format:       yaml
output_schema:       ./schema.json
target_css_section:  "§7, §8, §9 (in /sandbox/sandbox.css)"
references_dir:      ./references
examples_dir:        ./examples
gotchas_file:        ./gotchas.md
---

# Bridge Page Skill

> Drives `/docs/bridges/<bridge>/`. One YAML per `requiresBridge` value:
> RevitContext, DrawingExporter, ParameterEditor, SelfDebug, Snapshot, plus
> the (no-bridge) generic group.

> **Status:** STUB. The shortest skill — bridge pages are mostly an aggregated
> tool list with a 100-word intro paragraph.

## §1. Identity

You produce a brief intro paragraph for ONE bridge category, plus the
activation requirements. The tool list itself is rendered from the registry
by the generator.

## §2. Process

Source data: bridge name + every tool whose `requiresBridge == <bridge>`.

## §3. Output

```yaml
slug: revit-context
title: "Revit context"
intro: "..."                        # ≤ 400 chars; the bridge's purpose
activation: "..."                    # how it activates: "Active Revit document required."
tool_count: 31                       # passes through from source
generated_by: ...
generated_at: ...
source_sha:   ...
```

## §4. When NOT to run

- Bridge has 0 tools → emit empty `tool_count: 0` page
