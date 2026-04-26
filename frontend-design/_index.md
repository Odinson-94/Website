---
id: coding/frontend-design
parent: coding/_index
type: index
description: "Frontend design excellence: typography, colour, spatial design, motion, interaction, responsive, UX writing, taste, and critique — anti-slop principles for distinctive UI"
backend: reasoning
cache: always
tools: [python, web_search, file_read, file_write, file_edit, file_present, visualize]
---

<!-- SUMMARY
Sub-branch index for frontend design skills. Adapted from Impeccable (impeccable.style)
and Taste Skill — production-grade design guides that fight generic AI aesthetics.
Contains shared design philosophy, the AI Slop Test, and context gathering protocol.
Routes to domain-specific leaves for typography, colour, spatial design, motion,
interaction design, responsive design, UX writing, design taste, and design critique.
-->

# Frontend Design

## Downstream Skills

| Skill | File | Use When |
|-------|------|----------|
| Typography | [typography.md](./typography.md) | Font selection, pairing, modular scales, fluid type, OpenType features, web font loading |
| Colour & Contrast | [color-and-contrast.md](./color-and-contrast.md) | OKLCH palettes, tinted neutrals, dark mode, accessibility, contrast ratios |
| Spatial Design | [spatial-design.md](./spatial-design.md) | Spacing systems, grids, visual hierarchy, container queries, depth/elevation |
| Motion Design | [motion-design.md](./motion-design.md) | Duration, easing curves, staggered animations, reduced motion, perceived performance |
| Interaction Design | [interaction-design.md](./interaction-design.md) | Interactive states, focus rings, forms, modals, popovers, keyboard navigation |
| Responsive Design | [responsive-design.md](./responsive-design.md) | Mobile-first, fluid design, container queries, input detection, safe areas |
| UX Writing | [ux-writing.md](./ux-writing.md) | Button labels, error messages, empty states, voice/tone, translation |
| Design Taste | [taste.md](./taste.md) | Anti-slop rules, design variance dials, creative proactivity, forbidden AI patterns |
| Design Critique | [critique.md](./critique.md) | UX audits, heuristic scoring, persona testing, AI slop detection, actionable feedback |

Read ONE leaf for domain-specific depth. Apply its rules on top of the shared rules below.

---

## Shared Rules (apply to ALL frontend design work)

These rules are loaded every time any frontend design leaf is active.

### Context Gathering Protocol

Design skills produce generic output without project context. Before any design work:

1. **Check current instructions**: If your loaded instructions already contain brand standards or design context, proceed immediately.
2. **Check existing brand docs**: Search the project for brand standards, design tokens, or style guides. If found, follow them.
3. **Gather from user**: If no context exists, you MUST ask: Who is the target audience? What jobs are they doing? How should the interface feel?

You cannot infer design context by reading code. Code tells you what was built, not who it's for or what it should feel like.

### Design Direction

Before writing any frontend code, commit to a BOLD aesthetic direction:

- **Purpose**: What problem does this interface solve? Who uses it?
- **Tone**: Pick an extreme and execute with precision — brutally minimal, maximalist chaos, retro-futuristic, organic/natural, luxury/refined, playful/toy-like, editorial/magazine, brutalist/raw, art deco/geometric, soft/pastel, industrial/utilitarian.
- **Constraints**: Technical requirements (framework, performance, accessibility).
- **Differentiation**: What makes this UNFORGETTABLE? What's the one thing someone will remember?

Choose a clear conceptual direction and execute it with precision. Bold maximalism and refined minimalism both work — the key is intentionality, not intensity.

Then implement working code that is:
- Production-grade and functional
- Visually striking and memorable
- Cohesive with a clear aesthetic point-of-view
- Meticulously refined in every detail

### The AI Slop Test

**Critical quality check**: If you showed this interface to someone and said "AI made this," would they believe you immediately? If yes, that's the problem.

A distinctive interface should make someone ask "how was this made?" not "which AI made this."

Review the anti-pattern lists in the downstream leaves — they are the fingerprints of AI-generated work from 2024–2025.

### Implementation Principles

Match implementation complexity to the aesthetic vision:
- Maximalist designs need elaborate code with extensive animations and effects
- Minimalist designs need restraint, precision, and careful attention to spacing, typography, and subtle details
- Elegance comes from executing the vision well

Interpret creatively and make unexpected choices that feel genuinely designed for the context. No design should be the same. Vary between light and dark themes, different fonts, different aesthetics. NEVER converge on common choices across generations.

### Anti-Pattern Summary (Quick Reference)

These are the fingerprints of generic AI output. NEVER do these:

| Category | Banned Pattern |
|----------|---------------|
| **Fonts** | Inter, Roboto, Arial, Open Sans, Lato, Montserrat for display |
| **Colours** | Purple-to-blue gradients, cyan-on-dark, neon accents, pure black (#000), pure white (#fff), gray text on coloured backgrounds |
| **Layout** | Cards wrapping everything, cards nested in cards, identical 3-column card grids, hero metric layout template, centered everything |
| **Effects** | Glassmorphism everywhere, bounce/elastic easing, gradient text for impact, rounded rectangles with generic drop shadows |
| **Content** | "John Doe" placeholder names, "Acme" brand names, "Elevate/Seamless/Unleash" copywriting, emoji as icons |
| **Motion** | Animating width/height/padding/margin (use transform+opacity only), bounce easing, animation without reduced-motion fallback |

### Agent Swarming Protocol

When a frontend design task involves multiple domains (e.g. a full page build), deploy agents in parallel:

1. **Typography agent**: Audit and fix font choices, hierarchy, sizing — consult [typography.md](./typography.md)
2. **Colour agent**: Audit palette, contrast, dark mode — consult [color-and-contrast.md](./color-and-contrast.md)
3. **Layout agent**: Audit spacing, grids, composition — consult [spatial-design.md](./spatial-design.md)
4. **Motion agent**: Audit animations, transitions, performance — consult [motion-design.md](./motion-design.md)
5. **Interaction agent**: Audit states, focus, forms, keyboard — consult [interaction-design.md](./interaction-design.md)
6. **Responsive agent**: Audit breakpoints, mobile, container queries — consult [responsive-design.md](./responsive-design.md)
7. **Copy agent**: Audit labels, errors, empty states — consult [ux-writing.md](./ux-writing.md)
8. **Taste agent**: Final anti-slop sweep — consult [taste.md](./taste.md)
9. **Critique agent**: Holistic UX review with heuristic scoring — consult [critique.md](./critique.md)

Each agent loads its leaf, applies the rules, and returns findings. The orchestrating agent merges all findings into a prioritised action list.

### Adelphos Brand Override

When building UI for the Adelphos website or any Adelphos product, the brand standards documented as "Adelphos Brand Override" sections in each downstream leaf take precedence. These override generic examples with the actual production values from the Adelphos website.

Key Adelphos overrides:
- **Colour**: Greyscale hierarchy (#000→#888) + single teal accent (#156082). See [color-and-contrast.md](./color-and-contrast.md).
- **Typography**: Inter 300/500, 14px body, 30px headings, 400px columns. See [typography.md](./typography.md).
- **Layout**: Asymmetric 60/40 or 55/45 splits, 400px text columns, whitespace as structural material. See [spatial-design.md](./spatial-design.md).
- **Motion**: Opacity fades, sequential reveals, custom cubic-bezier(0.65, 0, 0.35, 1). See [motion-design.md](./motion-design.md).
- **Voice**: Industry professional, direct, deliverable-focused. No startup fluff. See [ux-writing.md](./ux-writing.md).
- **Taste**: Restrained engineering elegance. DESIGN_VARIANCE 6, MOTION_INTENSITY 4, VISUAL_DENSITY 3. See [taste.md](./taste.md).

The design philosophy rules from the upstream leaves still apply — they govern quality, anti-patterns, and accessibility. The Adelphos Brand Override governs the specific values and identity.
