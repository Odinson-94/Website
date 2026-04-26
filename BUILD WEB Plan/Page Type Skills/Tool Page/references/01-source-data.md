# Source data — one row of `data/registry.json`

A tool registry row looks like this. Every field comes from C# attributes on
the source class. The drafter receives ONE such object per call.

```json
{
  "name": "list_rooms",
  "desc": "Returns all rooms in the document, optionally filtered by level.",
  "bridge": "RevitContext",
  "category": "context",
  "always": true,
  "param_count": 1,
  "parameters": [
    { "name": "level", "type": "string", "description": "Filter by level name. Exact match.", "required": false }
  ],
  "keywords": ["rooms", "list rooms", "spaces", "level", "room schedule"]
}
```

## Field meanings

| Field | Source | Use it for | DO NOT use it for |
|-------|--------|------------|-------------------|
| `name` | `[McpTool("name", ...)]` | `slug`, `title` | `display_title` (use sentence case) |
| `desc` | first sentence of `<summary>` | `description` | re-styling — pass through and clarify only if needed |
| `bridge` | `RequiresBridge="..."` on `[McpTool]` | `bridge_label` (after pretty-print) | omit if empty string |
| `category` | `Category="..."` on `[McpTool]` | `category_label` | inventing — pass through |
| `always` | `AlwaysAvailable=true` on `[McpTool]` | `always_available` | inventing |
| `param_count` | count of `[McpParam]` attributes | reading only | the actual params come from `parameters[]` |
| `parameters[]` | each `[McpParam(...)]` attribute | the page renders these from source — your YAML doesn't restate them | inventing names or types |
| `keywords[]` | each `[Keywords("...")]` value | NOTHING — keywords are not for descriptions | the description field — that comes from `desc` |

## Bridge labels — pretty-print map

```
RevitContext     → "Revit"
DrawingExporter  → "Drawing exporter"
ParameterEditor  → "Parameter editor"
SelfDebug        → "Debug"
Snapshot         → "Snapshot"
""               → omit the bridge_label field entirely
```

## Common mistakes to avoid

- Reading `keywords[]` to build the description (these are search terms, not descriptions)
- Re-listing parameters in the YAML (the generator reads them from source)
- Hard-coding the bridge label string (use the pretty-print map)
