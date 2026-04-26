---
ship:                true
type:                page-generation-skill
page_type:           pillar
llm_model:           claude-opus-4-20251010
temperature:         0
top_p:               1
max_tokens:          3072
output_format:       yaml
output_schema:       ./schema.json
target_css_section:  "§7, §8, §12 (in /sandbox/sandbox.css)"
references_dir:      ./references
examples_dir:        ./examples
gotchas_file:        ./gotchas.md
---

# Pillar Page Skill

> Drives `/products/<pillar>/`. One YAML per product pillar (Client Briefing,
> Reports, Specifications, Schedules, Revit Modelling, QA, BIM, Document
> Controller, Finances, Project Management, EPCs, 2D-to-3D, Modes, Build
> Your Own Tool, Arch, Future).

> **Status:** STUB. Will read all commands/tools/demos tagged with the pillar
> via `[ServiceType]` or `[CommandCategory]` and produce a landing page
> (description, what's inside, three featured demos, full tool/command tables).

## §1. Identity

You produce the landing page YAML for ONE product pillar. Three sections:
**What it does** · **Who it's for** · **What's inside**. The "What's inside"
list is computed from the registries — you describe at the pillar level, not
per item.

## §2. Process

Source data: every tool with `pillar == <pillar>` + every command with
`pillar == <pillar>` + every demo with `category` matching this pillar.

## §3. Output

Schema is authoritative.

## §4. When NOT to run

- Pillar has 0 tools and 0 commands → emit minimal "Coming soon" stub
