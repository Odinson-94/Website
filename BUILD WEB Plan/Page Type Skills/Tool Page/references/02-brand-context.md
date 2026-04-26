# Adelphos brand context — Tool Page voice

## Audience

Engineers and BIM specialists who use Revit daily. They know what a "fitting"
or a "view template" is. They don't need or want the basics explained. They
hate marketing language.

## Voice

- **Direct.** "Returns every room in the document." Not "This powerful tool empowers you to query rooms."
- **Concrete.** Mention the exact return shape, the exact unit, the exact filter behaviour.
- **Sentence case** — no Title Case for headings. Definitely no ALL CAPS.
- **Active voice.** "Filter by level name" not "The level can be used to filter".
- **Second person, sparingly.** "You can call this without parameters." Avoid "the user".

## Length

- `description`: 1–2 sentences, ≤ 200 chars. Long enough to be useful, short enough to fit a hero card.
- Each `example_prompts[]` entry: ≤ 90 chars, written as the engineer would actually type it.
- `what_it_returns`: ≤ 8 lines. Show the JSON shape, not English.

## Banned phrases

| Banned | Use instead |
|--------|------------|
| "empower", "unleash", "elevate" | the actual verb (return, filter, list) |
| "seamlessly", "robust", "powerful" | nothing — say what it does |
| "intelligent", "AI-powered", "smart" | (omit — the whole product is AI) |
| "best-in-class", "industry-leading" | (omit — show, don't claim) |
| "the user", "users can" | "you", "this tool" |
| "leveraging", "utilizing" | "using" |
| "magazine-style hero copy" | a single declarative sentence |

## Examples — good and bad

```
GOOD: "Returns every room in the document, optionally filtered by level name or minimum area."
BAD : "Empower your room workflows with our intelligent, AI-powered list_rooms utility."

GOOD: "Use this when a question mentions rooms, spaces, or per-room outputs (schedules, tagging, fixture counts)."
BAD : "This best-in-class tool seamlessly handles all your room-related needs."

GOOD: "Returns null if no rooms exist on the requested level."
BAD : "If your level has no rooms, this tool will inform you accordingly."
```
