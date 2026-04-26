# Live Chat Demo Plan

> Parent: [Demos Plan](../Demos%20Plan.md)
> Status: **Partial** — `chat-panel/` directory exists locally (untracked) with HTML, CSS, JS scaffolding for a chat UI; needs API wiring and brand-shell consolidation.

## Purpose

The reusable chat panel that backs every Try It interaction across the site. Single component, lives in the menubar overlay AND inside demo cards.

## 1. Source of Truth

Existing: `chat-panel/chat-panel.html`, `chat-panel/css/chat-panel.css`, `chat-panel/js/WPFapplication.js`, `chat-panel/view4-chat.js`, `chat-panel/SPECBUILDER_CHECKLIST.md`.

Will refactor to: `src/components/chat-panel.mjs` (single self-contained Web Component).

## 2. Build Pipeline

`scripts/build-chat-panel-bundle.mjs` produces `dist/embed/chat-panel.js` (single-file ESM, no framework).

## 3. Runtime Surface

Calls `POST /api/v1/demo/run` (anonymous demos) or `POST /api/v1/commands/<name>` (authenticated, future).

## 4. UI Surface

```
┌─ Adelphos ─ list_rooms ─────────────────────────[ x ]┐
│                                                       │
│  > Run drainage layout for kitchen on Level 02        │
│                                                       │
│  ⚙ thinking…                                          │
│  ✓ Found 3 rooms; planning 12 m of pipework.          │
│                                                       │
│  Result:                                              │
│  ┌─────────────────────────────────────────────────┐  │
│  │ id     name      level     fittings            │  │
│  │ 345621 Kitchen   Level 02  4                   │  │
│  └─────────────────────────────────────────────────┘  │
│                                                       │
│  [ tweak prompt … ]              [ ↗ open in docs ]   │
└───────────────────────────────────────────────────────┘
```

## 5. Risk Research

| # | Area | Finding | Mitigation |
|---|------|---------|------------|
| 1 | XSS in result rendering | Skill markdown / tool output may contain HTML | DOMPurify; render in shadow DOM. |
| 2 | Multiple chats on same page | Demo card chat AND menubar chat AND view4-chat | Component instance state isolated; shared streaming via single EventSource pool with topic per `chatId`. |
| 3 | Existing duplication | `js/view4-chat.js`, `js/view5-chat.js`, `js/qa-chat.js`, `js/specbuilder.js`, `chat-panel/view4-chat.js` — five chat variants | Phase 3 consolidates all into the single component with a `mode` prop (`general` / `qa` / `specbuilder` / `view-tour`). |

## 6. File Layout

```
src/components/chat-panel.mjs            # — Partial (extract from chat-panel/)
src/components/chat-panel.css            # — Partial
scripts/build-chat-panel-bundle.mjs       # — TODO

# To deprecate after consolidation:
js/view4-chat.js                          # → mode='view-tour' — Partial
js/view5-chat.js                          # → mode='view-tour' — Partial
js/qa-chat.js                             # → mode='qa'        — Partial
js/specbuilder.js                          # → mode='specbuilder' — Partial
chat-panel/                                # → consume from /src/components — Partial
```

## 7. Configuration

```js
export const CHAT_MODES = {
  general:      { tools: 'demo-whitelist', sandbox: 'office',     placeholder: 'Ask anything…' },
  'view-tour':  { tools: 'demo-whitelist', sandbox: 'office',     placeholder: 'Try a demo prompt…' },
  qa:           { tools: ['get_unresolved_errors','get_error_summary','resolve_error'], placeholder: 'Find an issue…' },
  specbuilder:  { tools: ['discover_skills','custom_tool_creation'], placeholder: 'Describe a tool you want…' }
};
```

## 8. Workflow

User clicks Try on demo card → component mounts in slide-over → calls `/api/v1/demo/run` with seed prompt → streams result → user can tweak prompt and re-run.

## 9. Bugs/Issues

| # | Area | Description | Severity |
|---|------|-------------|----------|
| 1 | Five chat variants | Five separate JS files with overlapping logic | Medium — fixed by Phase 3 consolidation. |

## 10. Tests

| Test | Description | Status |
|------|-------------|--------|
| Mode switching | Mount with each mode → tools whitelist matches config | **TODO** |
| XSS in response | Inject `<script>` in mocked tool output → sanitised | **TODO** |
| Multi-instance | Two `<chat-panel>` on one page → independent state | **TODO** |

## Quick Reference

| Artefact | Status |
|----------|--------|
| Consolidated component | **Partial** |
| 5 deprecation migrations | **TODO** |
| Bundled embed | **TODO** |
