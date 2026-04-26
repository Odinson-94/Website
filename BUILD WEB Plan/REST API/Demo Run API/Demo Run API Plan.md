# Demo Run API Plan

> Parent: [REST API Plan](../REST%20API%20Plan.md)
> Status: **TODO**

## Purpose

Anonymous, rate-limited execution of the 20 safest read-only snapshot tools against curated SQLite sandboxes. Powers the homepage demos and partner read-only integrations.

## 1. Source of Truth

- Whitelist: hard-coded `WHITELIST` set in Edge Function (see [parent §7](../REST%20API%20Plan.md#7-configuration)).
- Sandbox SQLite files: hosted in Supabase Storage `sandboxes/<name>.sqlite`.
- Tool execution: ports MEP Bridge `snapshot_query` logic to Deno-compatible SQL execution (or a small Python worker; decision to make).

## 2. Build Pipeline

Sandbox snapshots are produced ONCE per release:

```
Curated Revit model ── snapshot_export ──▶ office.sqlite
                                       ──▶ hotel.sqlite
                                       ...
       upload to Supabase Storage / sandboxes/
```

## 3. Runtime Surface

`POST /api/v1/demo/run`

```json
// request
{ "tool": "list_rooms", "sandbox": "office", "params": { "level": "Level 02" } }
// response 200
{ "tool": "list_rooms", "duration_ms": 312, "result": [ { "id": 345621, "name": "Office", ... } ] }
// response 403 — tool not whitelisted
{ "error": "tool_not_whitelisted", "tool": "execute_command" }
// response 429 — rate limit
{ "error": "rate_limited", "retry_after_s": 17 }
```

## 4. UI Surface

Used by `<demo-card>` Try It button.

## 5. Risk Research

See parent §5 rows #5, #11, #12. Specific:

- SQLite query injection: validate `tool` against whitelist FIRST, then route to a fixed function per tool. Never compose SQL from user input.
- Sandbox file size: cap at 50 MB; serve from Supabase Storage with `Range` requests.
- Cold start: Deno function downloads SQLite on first invocation; cache in `/tmp` for the function's lifetime.

## 6. File Layout

```
supabase/functions/demo-run/
    index.ts                          # — TODO
    whitelist.ts                       # — TODO
    sandboxes.ts                       # sandbox loader + cache — TODO
    handlers/
        list_rooms.ts                  # one per whitelisted tool — TODO
        list_levels.ts                 # — TODO
        snapshot_query.ts              # — TODO
        ...
```

## 7. Configuration

```ts
export const SANDBOXES = {
  office:     "https://supa.adelphos.ai/storage/v1/object/public/sandboxes/office-v1.sqlite",
  hotel:      "https://supa.adelphos.ai/storage/v1/object/public/sandboxes/hotel-v1.sqlite",
  hospital:   "https://supa.adelphos.ai/storage/v1/object/public/sandboxes/hospital-v1.sqlite",
  education:  "https://supa.adelphos.ai/storage/v1/object/public/sandboxes/education-v1.sqlite",
  industrial: "https://supa.adelphos.ai/storage/v1/object/public/sandboxes/industrial-v1.sqlite",
};
```

## 8. Workflow

```bash
curl -X POST https://adelphos.ai/api/v1/demo/run \
  -H "Content-Type: application/json" \
  -d '{ "tool": "list_levels", "sandbox": "office" }'
```

## 9. Bugs/Issues

_None — TODO._

## 10. Tests

| Test | Description | Status |
|------|-------------|--------|
| Whitelisted tool succeeds | Each of 20 tools called → 200 | **TODO** |
| Non-whitelisted tool blocked | `execute_command` → 403 | **TODO** |
| Rate limit | 11 requests in 60 s → 429 | **TODO** |
| Latency P50 ≤ 500 ms | Hot Edge Function | **TODO** |

## Quick Reference

| Artefact | Status |
|----------|--------|
| Edge Function + 20 handlers | **TODO** |
| 5 sandbox SQLite files | **TODO** |
