# Anti-patterns — what NEVER to produce

Adapted from `C:\JPA Offline\Prompts\frontend-design\taste.md` "Anti-Pattern
Summary" + Adelphos-specific patterns we've already burned on.

## Hard bans (auto-rejected)

| Anti-pattern | Why it's banned | What to do instead |
|--------------|-----------------|--------------------|
| ALL CAPS labels | shouty, AI-tells | sentence case |
| `display_title: "LIST_ROOMS"` | snake_case copy of slug | rewrite as "List rooms" |
| description starts "This tool..." | filler | start with the verb: "Returns…", "Lists…", "Filters…" |
| "John Doe" / "Acme" / "lorem ipsum" placeholders | obviously fake | use real-looking values from typical Revit content (Level 02, Office, Meeting) |
| Emoji as icons (e.g. "🚀") | AI-tell | omit; the icon system is in the CSS |
| "best-in-class", "elevate", "empower", "seamless", "unleash" | marketing slop | omit |
| "intelligent", "AI-powered", "smart" | the product IS AI; saying so is noise | omit |
| Purple hero gradient mention | AI-default | not relevant for tool YAML; never reference colour |
| Glassmorphism mention | AI-default | not relevant; never reference visual effects |

## Soft bans (warning, not auto-reject)

- Three-or-more adjectives in a row ("simple, fast, reliable") — pick one
- Sentences > 25 words — split
- Hyphens used as em-dashes — use `—` (em-dash) for emphasis
- Tag the description with a category that's not in the source — copy `category` verbatim

## The AI Slop Test

If a reader saw the YAML and said "AI made this" within 5 seconds, the YAML
fails. Re-read every example field with that test in mind:

- Does it sound like an engineer typed it? ✓ ship
- Does it sound like a marketing site generated it? ✗ rewrite

## Adelphos-specific notes

- Avoid the word "construction" in tool descriptions — over-used elsewhere
- Avoid "BIM" unless the tool literally surfaces BIM (COBie, IFC, BCF)
- Use "Revit" liberally; that's what users are in
- Mention "MCP" only when the source data does — it's an internal architecture detail
