# Gotchas — Tool Page Skill

Every entry below has been hit at least once during drafting. Read these
before you generate. The drafter checks each entry post-generation.

| # | Gotcha | Symptom | Fix |
|---|--------|---------|-----|
| 1 | LLM uses `keywords` to write `description` | Description reads like a tag list ("rooms list spaces filter") | Use the `desc` field only; if it's empty, refuse with `error: tool has no description` |
| 2 | LLM invents parameter names not in source | YAML lists `level_filter` but source has `level` | Don't list params in the YAML at all — the generator reads `parameters[]` from source |
| 3 | LLM expands `description` past 200 chars | Hero card overflows | Hard cap; truncate at sentence boundary |
| 4 | `display_title` snake_case from `name` | `"list_rooms"` shown as h1 instead of "List rooms" | Always sentence-case rewrite; if name has no underscores, capitalise first letter only |
| 5 | `related.tools[]` references a tool that doesn't exist | Build fails with broken link | Validate every entry against `data/registry.json` keys before write |
| 6 | `related.tools[]` includes the tool itself | Self-reference cycle | Filter out the current tool's own slug |
| 7 | `example_prompts[]` written in third person | "The user wants to list rooms" instead of "List all rooms on Level 02" | First/second-person voice; the engineer's actual prompt |
| 8 | `example_prompts[]` count != 3 | Schema fails | Always exactly 3; if the tool is too narrow for 3 distinct prompts, repeat the same intent with different phrasing |
| 9 | `bridge_label` left as raw enum value ("RevitContext") | Looks like internal jargon | Use the pretty-print map in `references/01-source-data.md` |
| 10 | `what_it_returns` invented for a tool with no obvious return shape | Misleads | Leave empty; the page hides the section |
| 11 | LLM writes `description` as a question ("Looking for rooms?") | Marketing voice | Declarative only |
| 12 | `description` mentions "this tool" or "this function" | Filler word | Just say what it does: "Returns…", "Lists…" |
| 13 | YAML strings unescaped quotes inside double-quoted strings | YAML parse fails | Use single quotes for the outer wrap, OR escape inner doubles, OR use literal block `|` |
| 14 | `related.demos[]` includes a demo slug that doesn't exist | Build fails | Validate against `data/demos.json` keys |
| 15 | LLM emits trailing commas (JSON habit) | YAML parse fails | YAML doesn't allow trailing commas in flow sequences |

## Recovery — when validation fails

The drafter retries up to 3 times with the validation error appended to the
prompt. After 3 failures the draft is moved to
`data/_drafts/_failed/tools/<slug>.yaml.failed` with the full error log.
Human triage required.
