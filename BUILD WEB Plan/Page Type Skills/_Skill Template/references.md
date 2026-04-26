# References — what to read first, in order

The calling script appends each of these to the Claude prompt before the source
data. Each reference has a clear job. Don't drop one without thinking — every
file here exists to prevent a specific failure mode.

| # | File | Why it's loaded |
|---|------|-----------------|
| 1 | `references/01-source-data.md` | Documents the input JSON shape so the LLM knows which fields exist and what each one means. Prevents "invented field" errors. |
| 2 | `references/02-brand-context.md` | Adelphos voice + audience + tone constraints. Prevents marketing fluff and developer-only language. |
| 3 | `references/03-anti-patterns.md` | The frontend-design `taste.md` Anti-Pattern Summary — the things AI converges on by default. Prevents AI-slop output. |
| 4 | `gotchas.md` | Page-type-specific failure modes the drafter has hit before, with fixes. |
| 5 | `target-css.md` | Which `sandbox.css` sections will render this output, with size/length constraints derived from the rendered styling. Prevents text overflow and broken layouts. |
| 6 | `examples/*.yaml` | 1–3 real, human-approved YAML files of this page type. The strongest determinism lever — same examples + same source = same output. |
| 7 | `schema.json` | The JSON Schema. Output MUST validate. The drafter retries with error correction if it doesn't. |

If you add a new file to `references/`, give it a numeric prefix so the load
order is stable. Don't use date-prefixed names — they invite churn.
