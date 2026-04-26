# Webhooks Plan

> Parent: [REST API Plan](../REST%20API%20Plan.md)
> Status: **TODO**

## Purpose

Push delivery of command lifecycle events to user-registered URLs. HMAC-signed, retried with exponential back-off, observable.

## 1. Source of Truth

`webhooks` table + `webhook_deliveries` table in Supabase.

## 2. Build Pipeline

None — runtime only.

## 3. Runtime Surface

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/v1/webhooks` | GET | JWT | List my webhooks |
| `/api/v1/webhooks` | POST | JWT | Register new webhook |
| `/api/v1/webhooks/<id>` | DELETE | JWT | Remove |
| `/api/v1/webhooks/<id>/deliveries` | GET | JWT | Recent deliveries with status |

Outbound (delivered to user URLs):

| Event | Payload |
|-------|---------|
| `command.completed` | `{ event, delivery_id, timestamp, command, job_id, status, result_url }` |
| `command.failed` | `{ event, delivery_id, timestamp, command, job_id, error }` |
| `command.expired` | `{ event, delivery_id, timestamp, command, job_id }` |

Headers on outbound:

```
X-Adelphos-Event:        command.completed
X-Adelphos-Delivery:     <uuid>
X-Adelphos-Signature:    sha256=<hex>
X-Adelphos-Timestamp:    <unix-seconds>
```

## 4. UI Surface

`/account/webhooks/` — list, register, view deliveries with replay button.

## 5. Risk Research

See parent §5 row #9. Plus:

- User URL down → exponential back-off: 1, 5, 30, 120, 600, 3600 seconds; max 7 attempts; mark as `failed`; user can replay.
- HMAC secret rotation: per-webhook secret; rotate via UI; old secret valid for 24 h after rotation.
- Receiving endpoint slowness: 5 s timeout per attempt; success = 2xx within 5 s.

## 6. File Layout

```
supabase/migrations/
    20260420_webhooks.sql                  # — TODO
    20260420_webhook_deliveries.sql        # — TODO

supabase/functions/
    webhooks/
        index.ts                            # CRUD — TODO
    webhooks-deliver/
        index.ts                            # background worker — TODO
```

## 7. Configuration

`webhooks` table:

```sql
create table webhooks (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  url text not null,
  events text[] not null,       -- ['command.completed', 'command.failed']
  secret text not null,         -- HMAC shared secret
  created_at timestamptz default now(),
  last_success_at timestamptz,
  last_failure_at timestamptz,
  enabled boolean default true
);
```

## 8. Workflow

1. User registers webhook via `POST /api/v1/webhooks { url, events: ['*'] }`.
2. Command completes → trigger inserts row into `webhook_deliveries` (`pending`).
3. `webhooks-deliver` cron (every 10 s) picks up pending, attempts POST.
4. On 2xx → `delivered`; on non-2xx or timeout → schedule retry with back-off.
5. After 7 failures → `failed`; user can replay from UI.

## 9. Bugs/Issues

_None — TODO._

## 10. Tests

| Test | Description | Status |
|------|-------------|--------|
| HMAC matches expected | Verify signature against fixture payload | **TODO** |
| Retry schedule | Mock failing endpoint, observe back-off pattern | **TODO** |
| Replay | Failed delivery → manual replay → success | **TODO** |
| Timestamp guard | Replay with timestamp > 5 min old → rejected | **TODO** |

## Quick Reference

| Artefact | Status |
|----------|--------|
| 2 SQL migrations | **TODO** |
| 2 Edge Functions | **TODO** |
| User dashboard tab | **TODO** |
