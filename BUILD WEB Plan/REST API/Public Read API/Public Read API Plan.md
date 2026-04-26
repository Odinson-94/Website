# Public Read API Plan

> Parent: [REST API Plan](../REST%20API%20Plan.md)
> Status: **TODO**

## Purpose

Anonymous, CDN-cached read-only endpoints. The "is this product real?" surface for any developer.

## 1. Source of Truth

`data/registry.json`, `data/skill_manifest.json`, `data/skills/*.md`, `data/rest_api_registry.json`.

## 2. Build Pipeline

Endpoints are static-first: served as files from CDN where possible; Edge Function only for negotiated content (e.g. ETag handling, future filtering).

```
data/registry.json ──[ build-public-api.mjs ]──▶ dist/api/v1/registry.json
                                              ──▶ dist/api/v1/registry/<name>.json (sharded)
```

## 3. Runtime Surface

| Endpoint | Tier | Cache TTL |
|----------|------|-----------|
| `GET /api/v1/registry` | Public | 1 h |
| `GET /api/v1/registry/<name>` | Public | 1 h |
| `GET /api/v1/skills` | Public | 1 h |
| `GET /api/v1/skills/<slug>` | Public | 1 h |
| `GET /api/v1/commands` | Public | 1 h |
| `GET /api/v1/commands/<name>` | Public | 1 h |
| `GET /api/openapi.json` | Public | 5 min |
| `GET /api/v1/health` | Public | none |

## 4. UI Surface

OpenAPI explorer at `/docs/api/openapi-explorer/` — Stoplight Elements pointed at `/api/openapi.json`.

## 5. Risk Research

See parent §5 rows #1, #6, #11. Specific:

- Aggressive caching means deprecations are slow to propagate; document 7-day cache busting policy.
- `/registry/<name>` for 190 tools = 190 small files; avoid request amplification by also serving the bundled `/registry` for clients that want it all at once.

## 6. File Layout

```
scripts/build-public-api.mjs         # — TODO
dist/api/v1/registry.json            # — TODO
dist/api/v1/registry/<name>.json     # — TODO
dist/api/v1/skills.json              # — TODO
dist/api/v1/skills/<slug>.json       # — TODO
dist/api/v1/commands.json            # — TODO
dist/api/v1/commands/<name>.json     # — TODO
supabase/functions/health/index.ts   # — TODO
```

## 7. Configuration

CDN cache headers:

```
/api/v1/registry*  Cache-Control: public, max-age=3600, stale-while-revalidate=600
/api/openapi.json  Cache-Control: public, max-age=300
/api/v1/health     Cache-Control: no-store
```

## 8. Workflow

`curl https://adelphos.ai/api/v1/registry | jq '.tools[] | .name' | wc -l` → 190.

## 9. Bugs/Issues

_None — TODO._

## 10. Tests

| Test | Description | Status |
|------|-------------|--------|
| Endpoint returns 200 | E2E vs deployed URL | **TODO** |
| Cache header present | Headers contain Cache-Control | **TODO** |
| No internal fields | `assert no "filePath" in response` | **TODO** |

## Quick Reference

| Artefact | Status |
|----------|--------|
| Generator + 4 sharded JSON sets | **TODO** |
| Health endpoint | **TODO** |
