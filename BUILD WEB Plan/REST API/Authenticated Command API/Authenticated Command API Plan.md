# Authenticated Command API Plan

> Parent: [REST API Plan](../REST%20API%20Plan.md)
> Status: **TODO** — depends on `[RestApi]` attributes being added in MEP Bridge.

## Purpose

The commercial surface. JWT-gated, async-by-default, queues commands to the user's Revit instance via Supabase + plugin polling/Realtime. Idempotent, observable, billable.

## 1. Source of Truth

`data/rest_api_registry.json` (synced from MEP Bridge).

## 2. Build Pipeline

```
data/rest_api_registry.json
        │
        ├─▶ build-api-validator.mjs ──▶ supabase/functions/commands/validator.generated.ts
        ├─▶ build-api-reference.mjs ──▶ dist/docs/api/<command>.html
        └─▶ build-openapi.mjs       ──▶ dist/api/openapi.json
```

## 3. Runtime Surface

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/v1/commands/<name>` | POST | JWT + API key + Idempotency-Key | Queue command |
| `/api/v1/commands/<job_id>/result` | GET | JWT | Poll for result |
| `/api/v1/commands/<job_id>/stream` | GET | JWT | SSE stream |
| `/api/v1/me/usage` | GET | JWT | Current period usage |

## 4. UI Surface

User dashboard at `/account/`:

- API key management (create, rotate, revoke)
- Webhook URL registration
- Usage history with rate-limit graphs
- Sample-code generator (curl / JS / Python) per command

## 5. Risk Research

See parent §5 rows #2, #3, #4, #5, #7, #8, #9, #14. Critical: the queue table is the single point of contention; partition by `user_id` and use Supabase Realtime instead of polling at scale.

## 6. File Layout

```
supabase/migrations/
    20260420_command_queue.sql            # — TODO
    20260420_command_results.sql          # — TODO
    20260420_api_keys.sql                  # — TODO
    20260420_usage.sql                     # — TODO

supabase/functions/
    commands/
        index.ts                            # POST handler — TODO
        validator.generated.ts              # generated     — TODO
    result/
        index.ts                            # GET poll      — TODO
        stream.ts                           # GET SSE        — TODO
    me-usage/
        index.ts                            # GET            — TODO

# In MEP Bridge plugin:
MEPBridge.Revit/AIChat/CommandQueuePoller.cs   # — TODO  (port pattern from existing chat poller)
```

## 7. Configuration

`command_queue` table (Postgres):

```sql
create table command_queue (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  command_name text not null,
  parameters jsonb not null,
  idempotency_key text not null,
  status text not null default 'queued',  -- queued | processing | completed | failed | expired
  created_at timestamptz not null default now(),
  picked_up_at timestamptz,
  completed_at timestamptz,
  expires_at timestamptz not null default now() + interval '5 minutes',
  unique (user_id, idempotency_key)
);
create index command_queue_pickup_idx on command_queue (user_id, status, expires_at) where status = 'queued';
```

## 8. Workflow

See [parent §8 — Authenticated partner triggers an async command](../REST%20API%20Plan.md#workflow-authenticated-partner-triggers-an-async-command).

## 9. Bugs/Issues

_None — TODO._

## 10. Tests

| Test | Description | Status |
|------|-------------|--------|
| Idempotent retry | Same key returns same job_id | **TODO** |
| Tier enforcement | Free user calling pro command → 402 | **TODO** |
| Job expiry | Queued job not picked up in 5 min → status = expired | **TODO** |
| End-to-end | POST → plugin pickup → result returned ≤ 10 s | **TODO** |
| Realtime fallback | Disable Realtime, plugin polling kicks in | **TODO** |

## Quick Reference

| Artefact | Status |
|----------|--------|
| 4 SQL migrations | **TODO** |
| 4 Edge Functions | **TODO** |
| Plugin poller | **TODO** |
| Validator generator | **TODO** |
