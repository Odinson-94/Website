# Test Run Plan — 6-class proof of concept

> Goal: prove the entire pipeline end-to-end on a small, hand-picked set of
> real classes BEFORE scaling to all 354 surfaces. Outcome of this run is the
> final greenlight for full automation.

---

## The test set

Six classes from MEP Bridge, picked to cover every page-type skill at every
complexity tier (no UI · UI window · UI + web app), plus the tool-vs-command
split and the full XML-tag coverage spectrum.

| # | Class                            | Type    | Tier            | Has UI? | Has Web App? | Why this one                                              |
|---|----------------------------------|---------|-----------------|---------|--------------|-----------------------------------------------------------|
| 1 | `ListRooms`                      | tool    | `context`       | no      | no           | Plain read-only, 0 inputs — baseline tool page            |
| 2 | `SnapshotQuery`                  | tool    | `snapshot`      | no      | no           | Param-heavy tool with explicit return shape               |
| 3 | `PlaceSVPCommand`                | command | `action`        | no      | no           | Headless command, multiple inputs                         |
| 4 | `ExtendAllConnectorsCommand`     | command | `action`        | no      | no           | Already fully attributed (sandbox shows it); regression   |
| 5 | `OpenCobieSheetWindowCommand`    | command | `action` + UI   | YES     | no           | Tests UI surface block (CobieSheetWindow.xaml screenshot) |
| 6 | `LaunchDocumentControllerCommand`| command | `action` + app  | YES     | YES (React)  | Tests web-app embed block (DocumentController.React)      |

---

## Class-structure edits to apply

> One PR in MEP Bridge. The XML/attribute additions below make these classes
> "fully automation-ready". Each edit is small (5–20 lines) and safe.

### 1. `ListRooms` — already complete

Already carries `[McpTool]`, `[McpParam]`, `[Keywords]`, `<summary>`. No edits.

### 2. `SnapshotQuery` — already complete

Already carries `[McpTool]`, `[McpParam]`, `[Keywords]`, `<summary>`. Verify
`<summary>` describes the return shape; if not, add one paragraph.

### 3. `PlaceSVPCommand` — fill the gaps

Add (if missing):
- `<usecase>` — 2–3 sentences describing when an engineer would use it
- `<notfor>` — 1 sentence stating the wrong context
- `<aiprompts>` block (preprompt × 2, thinkingstep × 3, success × 2, failure × 2)
- `[RestApi]` (with `[RestApiParam]`/`[RestApiResponse]`) — see Phase 2 of the pipeline plan

### 4. `ExtendAllConnectorsCommand` — add `[RestApi]` only

Already has everything else. Add `[RestApi]` block per the Class Structure
REST API Exposure section.

### 5. `OpenCobieSheetWindowCommand` — add `[HasUI]` + `[RestApi]`

```csharp
[HasUI("CobieSheetWindow",
       Type = "WPF",
       Description = "20-sheet tabbed COBie data grid with row context menu",
       LiveScreenshot = "ui-screenshots/cobie-sheet-window.png")]

[RestApi("open_cobie_sheet_window",
         Method = "POST",
         RequiresAuth = true,
         IsAsync = false,
         Description = "Opens the COBie sheet manager for the active document.")]
```

Plus capture the screenshot once and commit to MEP Bridge `Resources/ui-screenshots/`.

### 6. `LaunchDocumentControllerCommand` — add `[HasWebApp]` + `[RestApi]`

```csharp
[HasWebApp("DocumentController",
           Url = "/apps/document-controller",
           ReactSource = "DocumentController/DocumentController.React",
           Description = "Drawing transmittal + revision tracker, hosted in WebView2",
           LiveScreenshot = "ui-screenshots/document-controller.png")]

[RestApi("launch_document_controller",
         Method = "POST",
         RequiresAuth = true,
         IsAsync = false,
         Description = "Launches the Document Controller WebView2 panel.")]
```

---

## End-to-end run-through

```
Step 1 — Edit MEP Bridge
  Open the 6 .cs files above
  Apply the edits above (one PR)
  Capture 2 screenshots → Resources/ui-screenshots/
  Commit, merge

Step 2 — Run extraction (MEP Bridge)
  python tools/generate_command_registry.py     ← TODO to write (Phase 1)
  python tools/generate_ui_surfaces.py          ← TODO to write (Phase 1)
  python tools/generate_rest_api_registry.py    ← TODO to write (Phase 1)
  Inspect outputs:
    - command_registry.json contains all 6 classes
    - ui_surfaces.json has #5 (UI) and #6 (UI + web app)
    - rest_api_registry.json has all 6 with [RestApi] tagged

Step 3 — Sync to Website (manual until Phase 3 lands the GH Action)
  Copy the 3 JSON files to Website/data/

Step 4 — Run drafter for each test page
  adelphos_CLI draft tool list_rooms                              # → data/_drafts/tools/list_rooms.yaml
  adelphos_CLI draft tool snapshot_query                          # → data/_drafts/tools/snapshot_query.yaml
  adelphos_CLI draft command place-svp                            # → data/_drafts/commands/place-svp.yaml
  adelphos_CLI draft command extend-all-connectors                # → data/_drafts/commands/extend-all-connectors.yaml
  adelphos_CLI draft command open-cobie-sheet-window              # → data/_drafts/commands/open-cobie-sheet-window.yaml
  adelphos_CLI draft command launch-document-controller           # → data/_drafts/commands/launch-document-controller.yaml

Step 5 — Open Website-Drafts PR
  6 YAML files reviewed in one PR
  Adjust as needed (re-run drafter on any failures with notes)

Step 6 — Promote
  adelphos_CLI promote tool list_rooms
  adelphos_CLI promote tool snapshot_query
  adelphos_CLI promote command place-svp
  adelphos_CLI promote command extend-all-connectors
  adelphos_CLI promote command open-cobie-sheet-window
  adelphos_CLI promote command launch-document-controller

  (each promotion writes to Website/data/, snapshots to Website/_archive/<date>/)

Step 7 — Build and verify
  adelphos_CLI build
  Open in browser:
    /docs/tools/list_rooms/
    /docs/tools/snapshot_query/
    /docs/commands/place-svp/
    /docs/commands/extend-all-connectors/
    /docs/commands/open-cobie-sheet-window/             ← UI block visible
    /docs/commands/launch-document-controller/          ← Web app embed visible

Step 8 — Sign off
  Visual check + spec check + accessibility check
  If all pass → green-light Phase 4 (run on all 354 surfaces)
  If any fail → triage, update the relevant page-type skill (gotchas.md or
                examples/), re-run, re-verify
```

---

## What success looks like

After Step 8, you can answer YES to all of these:

- [ ] Every test page renders without missing fields or visible errors
- [ ] Bridge / category / always-available pills look right
- [ ] Inputs / Returns tables match the source attributes exactly
- [ ] `<usecase>` / `<notfor>` callouts read like an engineer wrote them
- [ ] `<aiprompts>` sample-dialogue block is present where source has one
- [ ] UI screenshot appears on `OpenCobieSheetWindow`
- [ ] Web-app embed appears on `LaunchDocumentController`
- [ ] REST API block appears on the four `[RestApi]`-tagged commands
- [ ] All 6 right-rail "On this page" anchors work
- [ ] All 6 left-rail nav entries appear under the right pillar
- [ ] Search index includes all 6 entries
- [ ] Re-running the drafter on the same source produces identical YAML
      (the determinism gate)

When all 12 are green: scale to all 354.

---

## Estimated effort

| Step | Effort |
|------|--------|
| 1 — class-structure edits + screenshots | 1 hour |
| 2 — write the 3 extraction Python scripts | 3 hours (Phase 1 work; mostly mechanical) |
| 3 — manual sync | 5 minutes |
| 4 — drafter calls (Claude API, ~30 sec each) | 5 minutes total |
| 5 — review YAMLs in PR | 30 minutes |
| 6 — promote | 5 minutes |
| 7 — build + visual verify | 30 minutes |
| 8 — sign-off + remediation if needed | 1 hour |
| **Total** | **~6 hours** |

---

## Dependencies (must exist before this test run can start)

- [ ] `tools/generate_command_registry.py` written (Pipeline Phase 1)
- [ ] `tools/generate_ui_surfaces.py` written (Phase 1)
- [ ] `tools/generate_rest_api_registry.py` written (Phase 1)
- [ ] `[HasUI]`, `[HasWebApp]`, `[RestApi]` C# attribute classes added to MEP Bridge `MEPBridge.Revit.Tracking` namespace
- [ ] `adelphos_CLI` skeleton with `draft`, `promote`, `build` commands (Phase 7 of pipeline; minimal version sufficient for the test)
- [ ] `Website-Drafts` repo created with branch protection
- [ ] All 6 page-type skills filled in to "ready to run" status (currently:
      Tool Page is full; Command/Workflow/Demo/Pillar/Bridge are stubs +
      folder shape — populated as part of this test run)
