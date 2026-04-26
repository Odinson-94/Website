# BUILD WEB Plan — README

The complete plan for `adelphos.ai`. Mirrors the structure and conventions of [BUILD MEP Plan](../../../13%20MCP%20UI/MEPBridge/BUILD%20MEP%20Plan/).

## Start here

1. [Project Structure Plan](Project%20Structure%20Plan.md) — the H1 root. Read this first.
2. [Plan Template](Plan%20Template.md) — copy this when adding a new sub-plan.
3. The five-phase delivery is in §"Phased Delivery" of the root plan.

## Conventions

- **Status markers** on every artefact: `TODO` · `Partial` · `Built` · `Bug`. Plan-level status summarises children.
- **Hierarchy:** H1 (root) → H2 (domain) → H3 (sub-system) → H4 (leaf). Every plan links UP to its parent. Cross-H2 links go through H1 only.
- **Naming:** Title Case With Spaces. `%20` in markdown links. No hyphens in plan/folder names.
- **Cross-repo links** to BUILD MEP are allowed only in the H1 plan and the Automation Pipeline H2 — those are the only domains that legitimately reach across repos.
- **Automation prime directive:** if a piece of content can be generated from MEP Bridge source, registry JSON, or a Skill markdown, it MUST be generated — never hand-maintained.

## Quick map

```
Project Structure Plan (H1)
├── Automation Pipeline   ← the spine — every other domain depends on its outputs
├── REST API              ← public read + demo run + authenticated command + webhooks
├── Documentation         ← /docs (tools, skills, bridges, api, getting-started, changelog, search)
├── Demos                 ← /demos (cards, live chat, sandbox models)
├── Resources             ← /resources (free families, templates, asset data)
├── Downloads             ← /downloads (Revit add-in, AutoCAD bundle, Document Controller)
├── Examples              ← data/examples/*.yaml (prompt → expected result)
├── Site Shell            ← marketing pages, brain canvas, perf + SEO
├── Repo Hygiene          ← .gitignore, conventional commits, branch protection
└── Skills/               ← web-side skills (Skill Template + Web Generator Authoring + …)
```

## Phase-zero owner checklist

Before any code is written:

- [ ] Read [Project Structure Plan](Project%20Structure%20Plan.md) end to end.
- [ ] Read [REST API Plan](REST%20API/REST%20API%20Plan.md) and confirm the API surface decisions match the business model.
- [ ] Read [Automation Pipeline Plan](Automation%20Pipeline/Automation%20Pipeline%20Plan.md) and confirm GitHub Actions strategy is acceptable (vs Jenkins / Azure DevOps).
- [ ] Confirm the **5 questions** from the Project Structure Plan §"Top-level status" are agreed:
  - Should `cursor/clash-manager-ui-1217` branch be merged or deleted?
  - Should videos move to Cloudflare Stream or stay on Drive embeds (Cloudflare picked previously)?
  - Should `.bak` archive go to local `_archive/` (picked previously) or be deleted entirely?
  - Are the 5 sandbox model archetypes (Office, Hotel, Hospital, Education, Industrial) the right cut?
  - Are the 25 commands listed in REST API Plan §3 the right initial `[RestApi]` cut?
- [ ] Approve Phase 0 execution: repo hygiene + sync + bootstrap of `data/` + first GitHub Action.

## What was created in this planning pass

19 markdown files under `BUILD WEB Plan/`:

| H1 | H2 | H3 |
|----|----|----|
| Project Structure Plan | Automation Pipeline / Cross Repo Sync, Generators, CI Gates | |
| Plan Template | REST API / Public Read API, Demo Run API, Authenticated Command API, Webhooks | |
| README (this) | Documentation / Tool Pages, Skill Pages, Bridge Pages, API Reference, Getting Started, Changelog, Search | |
| | Demos / Demo Cards, Live Chat Demo, Sandbox Models | |
| | Resources / Free Families, Free Templates, Free Asset Data | |
| | Downloads / Revit Add-In, AutoCAD Bundle, Document Controller | |
| | Examples / Authoring Workflow | |
| | Site Shell / Marketing Pages, Brain Canvas, Performance and SEO | |
| | Repo Hygiene | |
| | Skills (Skill Template, Web Generator Authoring Skill) | |
