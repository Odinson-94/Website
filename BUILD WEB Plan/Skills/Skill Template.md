---
ship: false
---

# Skill Template (BUILD WEB)

> Mirrors the [BUILD MEP Skill Template](../../../../13%20MCP%20UI/MEPBridge/BUILD%20MEP%20Plan/Skills/Skill%20Template.md). Use this when adding a web-side skill.

## YAML Frontmatter Reference

```yaml
---
ship: true              # true = upload to Supabase for LLM discovery
                        # false = local dev only (Frontend Design, Brand Standards, Web Generator Authoring, etc.)
category: web           # web | docs | api | ops | content | brand
tools:                  # MCP tool names this skill uses (LLM calls via execute_tool)
  - browse_files
commands:               # Adelphos REST commands this skill triggers (via /api/v1/commands/<name>)
  - export_clash_results_to_xml
keywords:
  - keyword1
  - keyword2
---
```

## Skill Content Template

```markdown
# [Skill Name]

> [One-line description — search result summary in Supabase]

## Prerequisites

- [What must be true before running this skill]

## Scenarios

### Scenario 1: [Short title]

1. [Step-by-step instructions]
2. [Reference tools and commands by exact name]
3. [Include error recovery]

## Do / Don't

**Do:**
- [Best practices]

**Don't:**
- [Common mistakes]

## Error Recovery

| Error | Cause | Fix |
|-------|-------|-----|
| [symptom] | [why] | [what to do] |
```

## Build Pipeline (Web Side)

Skills with `ship: true` are rendered to `/docs/skills/<slug>` by `build-skill-pages.mjs` AND uploaded to Supabase `ai_skills` table by the same upload pipeline used by BUILD MEP (when this site exposes API). Skills with `ship: false` stay local as developer tooling.
