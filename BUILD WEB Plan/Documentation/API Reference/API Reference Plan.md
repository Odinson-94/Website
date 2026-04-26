# API Reference Plan

> Parent: [Documentation Plan](../Documentation%20Plan.md)
> Sister: [REST API Plan](../../REST%20API/REST%20API%20Plan.md)
> Status: **TODO** — depends on `[RestApi]` attributes existing in MEP Bridge.

## Purpose

The reference docs for the public REST API. Auto-generated from `data/rest_api_registry.json`. Includes a Stoplight Elements–powered OpenAPI explorer.

## 1. Source of Truth

`data/rest_api_registry.json` (synced from MEP Bridge — TODO there) + `data/examples/<command>.yaml` for curl/JS/Python snippets.

## 2. Build Pipeline

```
data/rest_api_registry.json ──[ build-api-reference.mjs ]──▶ dist/docs/api/<command>.html
                            ──[ build-openapi.mjs ]──────▶ dist/api/openapi.json
                                                          ──▶ dist/docs/api/openapi-explorer.html (loads spec)
```

## 3. Runtime Surface

None — Stoplight Elements loads `/api/openapi.json` at runtime in the browser.

## 4. UI Surface — Per-Command Page

```
H1: POST /api/v1/commands/<name>
Description (from registry)
Auth requirement: JWT + API key
Tier: pro / enterprise
Async: yes (returns 202 + job_id)

Request body schema (table from RestApiParam[])
Response schema (table from RestApiResponse[])

Code examples (tabs):
  curl | JavaScript (fetch) | Python (httpx)

How it executes (sequence diagram: client → Edge Function → command_queue → plugin → result)

Webhooks emitted: command.completed, command.failed, command.expired
```

## 5. Risk Research

See [REST API Plan §5](../../REST%20API/REST%20API%20Plan.md#5-risk-research--known-issues--pitfalls). Specific: code samples must be regenerated when params change; never hand-edit the snippets in YAML — use templated generation if possible.

## 6. File Layout

```
templates/api-page.html                # — TODO
scripts/build-api-reference.mjs        # — TODO
scripts/build-openapi.mjs              # — TODO
dist/docs/api/<command>.html            # — TODO
dist/docs/api/openapi-explorer.html     # — TODO
dist/api/openapi.json                   # — TODO
```

## 7. Configuration

OpenAPI metadata block hand-written in `src/content/api/info.yaml`:

```yaml
openapi: 3.1.0
info:
  title: Adelphos API
  version: 1.0.0
  description: |
    Public read + authenticated execution surface for the BUILD MEP engine.
  contact:
    name: Adelphos Support
    url: https://adelphos.ai/contact
servers:
  - url: https://adelphos.ai
```

## 8. Workflow

A new `[RestApi]` command is added in MEP Bridge → auto-page lives at `/docs/api/<name>` after sync.

## 9. Bugs/Issues

_None — TODO._

## 10. Tests

| Test | Description | Status |
|------|-------------|--------|
| OpenAPI valid | Spectral lint passes | **TODO** |
| Each command has page | Count match | **TODO** |
| Code samples compile | curl/JS/Python snippets are syntactically valid | **TODO** |

## Quick Reference

| Artefact | Status |
|----------|--------|
| Template + generator + spec + per-command pages | **TODO** |
