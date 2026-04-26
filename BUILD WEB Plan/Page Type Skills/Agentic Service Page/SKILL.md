# Agentic Service Page Skill

> Generates one detail page per managed Adelphos service (Finances, Project Management, Document Controller).

## When to use

Whenever a new entry is added to `sandbox/data/agentic-services.json` or an existing entry's content changes. Services are managed offerings — Adelphos runs the agent for the client — so they share the App Page skeleton but with different copy, a green/teal palette to differentiate from apps, an extra "How it becomes agentic" maturity-ladder section, an engagement model card, and a contact-driven CTA (the only place on the site we ask for contact).

## Inputs

`sandbox/data/agentic-services.json` — one object per service inside `services[]`.

| Field | Type | Required | Notes |
|---|---|---|---|
| `slug` | string | yes | URL slug. |
| `title` | string | yes | Display name. |
| `is_flagship` | bool | no | Marks the hero card on the inventory page. Exactly one service should be flagship. |
| `headline_claim` | string | yes | Hero claim. |
| `tagline` | string | yes | Supporting line. |
| `key_outcomes[]` | array | yes (3–4) | Outcomes strip. |
| `detail_paragraph` | string | yes | Quantified, specific. |
| `blurb` | string | yes | Inventory-tile description. |
| `the_shift` | object | yes | Before / After. |
| `features[]` | array | yes (5–15) | Each `{ name, desc }`. |
| `what_we_offer[]` | array | yes (3–7) | Bullet list — what's included in the service. |
| `how_it_becomes_agentic[]` | array | yes (4–6) | The maturity ladder ("1. Discovery — …", "2. Connect — …"). |
| `engagement` | string | yes | One-line engagement model (subscription + outcome bonus etc.). |
| `icon` | string | yes | Icon path. |
| `seo` | object | yes | Same as App Page. |

## Outputs

- `dist/agentic-services/<slug>/index.html` — by `scripts/build-agentic-pages.mjs#renderService`
- `dist/agentic-services/index.html` — flagship + tiles, by `buildAgenticServicesInventory`

## Hard rules

1. **Contact CTA required.** Unlike apps, services need a sales conversation. Primary action = "Talk to us about deploying X →".
2. **Maturity ladder mandatory.** Every service must spell out the 4–6 stage path from "you're doing it manually" to "the agent is running it autonomously". This is the trust mechanism — no mystery.
3. **Human service team must be named in `features[]`.** The service includes a human team behind the agent — say so explicitly.
4. **Engagement model must be concrete.** "Monthly subscription + outcome-based bonus on collected receivables" is good. "Tailored pricing" is not.
5. **`is_flagship: true` on exactly one.** Currently Finances.

## Related templates and generators

- Template:   `templates/agentic-service-page.html`
- Inventory:  `templates/agentic-services-inventory.html`
- Generator:  `scripts/build-agentic-pages.mjs`
- Schema:     `BUILD WEB Plan/Page Type Skills/Agentic Service Page/schema.json`
- CLI:        `node scripts/adelphos_CLI.mjs build agentic <slug>`
