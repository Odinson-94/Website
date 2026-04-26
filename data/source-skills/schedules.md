---
name: schedules
description: "Use this skill when the user asks to create, edit, or query Revit schedules. Covers schedule creation (custom, from template, duplicate), column management (add, remove, reorder, rename, hide), row filtering, sorting and grouping (headers, footers, grand totals, itemize), column formatting (alignment, units, totals), appearance (text styles, grid lines, outline, row striping), placing schedules on sheets, and reading schedule data. Also use when the user mentions ViewSchedule, schedule fields, or schedule formatting."
version: 1.0.0
---

# Schedules — AI Agent Skill Document

> Parent: [Skills Plan](Skills%20Plan.md)
>
> Related skills: [Parameters Skill](Parameters%20Skill.md), [Master Model Setup Skill](Master%20Model%20Setup%20Skill.md), [Object Styles Skill](Object%20Styles%20Skill.md)

## Overview

This skill guides the AI agent through creating, querying, modifying, formatting, and placing Revit ViewSchedule objects. Schedules are tabular views that list and quantify model elements — equipment schedules, pipe/duct sizing, space data sheets, and more.

This covers the FULL lifecycle: creation → field (column) management → filtering → sorting/grouping → formatting → appearance → sheet placement.

> **Status:** Entirely TODO. No ViewSchedule management code exists. Current codebase only has defensive checks (TagsAllRoomsCommand, SetCropViewCommand reject schedule views). RadiatorScheduleService is Excel import — unrelated.
>
> **Key concept:** Revit schedules are VIEWS, not data exports. They live in the Project Browser under "Schedules/Quantities" and can be placed on sheets. All changes are live — the schedule updates automatically as the model changes.
>
> **Hard links:**
> - [Schedules Plan](../ModelSetup/Schedules/Schedules%20Plan.md) — full plan with Revit API surface and function table
> - [Object Styles Skill](Object%20Styles%20Skill.md) Scenario 8 — schedule text styles use the same TextNoteType system

---

## Prerequisites

- [ ] Document is open and modifiable
- [ ] For schedule creation: elements of that category must exist (or schedule will be empty)
- [ ] For schedule data reads: schedule must already exist
- [ ] For appearance: text styles should be set up first (see Object Styles Skill)

---

## Scenario 1: Discover Existing Schedules

### When this triggers

Before creating schedules, or when user asks "what schedules do we have?", "show me the equipment schedule".

### Step by step

```
1. LIST ALL SCHEDULES
   → list_revit_schedules
   → Returns: id, name, category, fieldCount, rowCount, isTemplate, isKeySchedule
   → "Model has {N} schedules:
      - Mechanical Equipment Schedule (24 rows, 6 columns)
      - Duct Schedule (156 rows, 8 columns)
      - Space Schedule (89 rows, 10 columns)
      ..."

2. GET SCHEDULE STRUCTURE (if user asks for details)
   → GetRevitScheduleColumnAndFilterDefinition(scheduleId)
   → "Equipment schedule structure:
      Fields: Family, Type, Count, Level, Space, System Type
      Filters: Level = 'Level 01'
      Sort: Level (ascending, with headers) → Type (ascending)
      Appearance: B&W_2.5mm body text, grid lines on"

3. GET SCHEDULE DATA (if user asks to see the data)
   → GetRevitScheduleRowAndCellData(scheduleId)
   → Returns rows and columns
   → Summarise: "8 x AHU-01 on Level 01, 4 x FCU-01 on Level 02..."
   → Don't dump the entire table unless user asks for raw data
```

---

## Scenario 2: Create a New Schedule

### When this triggers

User asks "create an equipment schedule", "make me a duct schedule", "I need a space schedule", or during model setup.

### Step by step

```
1. DETERMINE CATEGORY
   → User: "create a mechanical equipment schedule"
   → Map to BuiltInCategory: OST_MechanicalEquipment
   → Common MEP categories:
     - Mechanical Equipment → OST_MechanicalEquipment
     - Ductwork → OST_DuctCurves
     - Pipework → OST_PipeCurves
     - Lighting Fixtures → OST_LightingFixtures
     - Spaces → OST_MEPSpaces
     - Cable Tray → OST_CableTray
     - Electrical Equipment → OST_ElectricalEquipment
     - Pipe Fittings → OST_PipeFitting

2. CHECK FOR EXISTING
   → list_revit_schedules
   → IF schedule for that category exists:
     "An equipment schedule already exists: '{name}'.
      Create a new one, or modify the existing one?"

3A. USE PRE-CONFIGURED TEMPLATE:
   → execute_command: CreateMepRevitSchedule.MechanicalEquipment
   → Creates with standard fields, sorting, and formatting
   → "Created 'Mechanical Equipment Schedule' with 6 columns."

3B. CREATE CUSTOM:
   → User wants specific fields
   → GetAvailableFieldsForRevitScheduleCategory(category)
   → "Available fields for Mechanical Equipment:
      Family, Type, Mark, Level, Space, System Type, System Name,
      Comments, Description, Manufacturer, Model, Count..."
   → User picks fields
   → execute_command: CreateRevitScheduleCommand(
       name: "Mech Equipment",
       category: "OST_MechanicalEquipment",
       fields: ["Family", "Type", "Count", "Level", "Space"])

3C. DUPLICATE EXISTING:
   → User: "copy the equipment schedule and filter it for Level 02"
   → execute_command: DuplicateExistingRevitSchedule(
       sourceScheduleId: {id},
       newName: "Mech Equipment - Level 02")
   → Then add filter: SetRowFilterOnRevitSchedule(scheduleId, "Level", "Equal", "Level 02")

4. REPORT
   "Created '{name}' with {N} columns, {M} rows."
```

---

## Scenario 3: Add, Remove, and Reorder Columns

### When this triggers

User asks "add a zone column", "remove the comments field", "move level to the first column", "rename the heading".

### Step by step

```
1. IDENTIFY SCHEDULE
   → list_revit_schedules → user selects or infer from context

2. READ CURRENT STRUCTURE
   → GetRevitScheduleColumnAndFilterDefinition(scheduleId)
   → "Current columns: Family | Type | Count | Level | Space | System Type"

3A. ADD COLUMN:
   → User: "add a Zone column"
   → Check available: GetAvailableFieldsForRevitScheduleCategory(category)
   → IF "Zone" is available:
     → execute_command: AddColumnToRevitSchedule(scheduleId, "Zone")
     → "Added 'Zone' column."
   → IF not available:
     → "No 'Zone' parameter found for this category. Available fields: {list}.
        Did you mean one of these?"

3B. REMOVE COLUMN:
   → User: "remove the comments column"
   → execute_command: RemoveColumnFromRevitSchedule(scheduleId, "Comments")
   → "Removed 'Comments' column."

3C. REORDER:
   → User: "move Level to the first column"
   → execute_command: ReorderColumnsInRevitSchedule(scheduleId, "Level", newIndex: 0)
   → "Moved 'Level' to first position."

3D. RENAME HEADING:
   → User: "rename 'System Type' to 'Service'"
   → execute_command: RenameColumnHeadingInRevitSchedule(scheduleId, "System Type", "Service")
   → "Renamed column heading to 'Service'."

3E. HIDE COLUMN:
   → User: "hide the Mark column but keep it for filtering"
   → execute_command: HideColumnInRevitSchedule(scheduleId, "Mark")
   → "Hidden 'Mark' column (still available for filters and sorts)."

3F. ADD CALCULATED FIELD:
   → User: "add a count column"
   → execute_command: AddCalculatedColumnToRevitSchedule(scheduleId, type: "Count")
   → "Added 'Count' calculated field."
```

---

## Scenario 4: Filter Schedule Rows

### When this triggers

User asks "filter to only show LTHW pipes", "show only Level 01 equipment", "remove the filter".

### Step by step

```
1. IDENTIFY SCHEDULE
   → list_revit_schedules → user selects

2. READ CURRENT FILTERS
   → GetRevitScheduleColumnAndFilterDefinition(scheduleId)
   → "Current filters: none" or "Filtered by: Level = Level 01"

3A. ADD FILTER:
   → User: "filter to only show LTHW pipes"
   → execute_command: SetRowFilterOnRevitSchedule(
       scheduleId,
       fieldName: "System Type",
       filterType: "Contains",
       value: "LTHW")
   → "Filtered by System Type contains 'LTHW'. {M} rows now visible."

3B. MULTIPLE FILTERS:
   → User: "also filter to Level 01 only"
   → execute_command: SetRowFilterOnRevitSchedule(
       scheduleId,
       fieldName: "Level",
       filterType: "Equal",
       value: "Level 01")
   → "Added filter: Level = Level 01. Filters are AND — both must match."

3C. CLEAR FILTERS:
   → User: "remove all filters"
   → execute_command: ClearAllFiltersOnRevitSchedule(scheduleId)
   → "Cleared all filters. {M} rows now showing."

FILTER OPERATORS:
   Equal, NotEqual, Contains, BeginsWith, EndsWith,
   Greater, Less, GreaterOrEqual, LessOrEqual,
   HasValue, HasNoValue
```

---

## Scenario 5: Sort and Group Rows

### When this triggers

User asks "sort by level", "group by system type", "add totals", "show a count".

### Step by step

```
1. IDENTIFY SCHEDULE
   → list_revit_schedules → user selects

2A. SORT:
   → User: "sort by Level then by Type"
   → execute_command: SetSortOrderOnRevitSchedule(
       scheduleId, "Level",
       ascending: true,
       showHeader: true,
       showBlankLine: true)
   → execute_command: SetSortOrderOnRevitSchedule(
       scheduleId, "Type",
       ascending: true)
   → "Sorted by Level (with group headers) then by Type."

2B. GROUP WITH FOOTERS:
   → User: "group by System Type with subtotals"
   → execute_command: SetSortOrderOnRevitSchedule(
       scheduleId, "System Type",
       ascending: true,
       showHeader: true,
       showFooter: true)
   → "Grouped by System Type with header and footer rows."

2C. GRAND TOTALS:
   → User: "show a grand total at the bottom"
   → execute_command: SetRevitScheduleGrandTotalRow(
       scheduleId, showGrandTotal: true, showCount: true)
   → "Grand total row added."

2D. ITEMIZE:
   → User: "don't list every instance, just show counts"
   → execute_command: SetRevitScheduleItemizeEveryInstance(scheduleId, false)
   → "Grouped identical rows — showing count per unique combination."

   → User: "I want to see every individual item"
   → execute_command: SetRevitScheduleItemizeEveryInstance(scheduleId, true)
   → "Itemized — showing every instance as a separate row."
```

---

## Scenario 6: Format Columns

### When this triggers

User asks "centre the count column", "change the length units", "add totals to the length column", "right-align the numbers".

### Step by step

```
1. IDENTIFY SCHEDULE AND FIELD
   → list_revit_schedules → GetRevitScheduleColumnAndFilterDefinition(scheduleId)

2A. ALIGNMENT:
   → User: "centre the Count column"
   → execute_command: SetColumnFormatInRevitSchedule(
       scheduleId, "Count", alignment: "Center")
   → "Count column centred."

2B. FIELD TOTALS:
   → User: "show total length at the bottom"
   → execute_command: SetColumnTotalsInRevitSchedule(
       scheduleId, "Length", displayType: "Totals")
   → "Length column now shows sum in footer."

2C. FORMAT OPTIONS:
   → User: "show length in metres with 2 decimal places"
   → execute_command: SetColumnFormatInRevitSchedule(
       scheduleId, "Length",
       units: "meters",
       rounding: 2,
       showUnitSymbol: true)
   → "Length formatted as metres (2 d.p.)."
```

---

## Scenario 7: Set Schedule Appearance

### When this triggers

User asks "change the text style", "add grid lines", "turn on stripe rows", "hide the title", "make headers bold".

### Step by step

```
1. IDENTIFY SCHEDULE
   → list_revit_schedules → user selects

2. SET APPEARANCE
   → execute_command: SetRevitScheduleAppearance(
       scheduleId,
       showTitle: true,
       showHeaders: true,
       titleTextStyle: "5mm Bold",
       headerTextStyle: "3.5mm Bold",
       bodyTextStyle: "2.5mm",
       gridLines: true,
       outline: true,
       blankRowBeforeData: true,
       stripeRows: false)
   → "Updated appearance: title 5mm Bold, headers 3.5mm Bold,
      body 2.5mm, grid lines on, outline on."

NOTE: Text styles reference TextNoteType names.
Use list_text (Object Styles Skill) to see available text styles.
If the needed text style doesn't exist, create it first using Scenario 8
of the Object Styles Skill.
```

---

## Scenario 8: Place Schedule on Sheet

### When this triggers

User asks "put the equipment schedule on sheet M-00-01", "place all schedules on their sheets".

### Step by step

```
1. IDENTIFY SCHEDULE AND SHEET
   → list_revit_schedules → user selects schedule
   → list_sheets → user selects sheet (or infer from context)

2. CHECK SPACE
   → FreeViewportSpaceCalculator(sheetId)  (BUILT — already in codebase)
   → "Sheet M-00-01 has 400x250mm free space."

3. CHECK NOT ALREADY PLACED
   → A schedule can only be placed ONCE per sheet
   → IF already placed: "This schedule is already on sheet {number}."

4. PLACE
   → execute_command: PlaceRevitScheduleOnSheet(
       scheduleId, sheetNumber: "M-00-01",
       position: "auto")
   → Auto-positioned in free space on the sheet
   → "Placed 'Mechanical Equipment Schedule' on sheet M-00-01."
```

---

## Scenario 9: Read Schedule Data

### When this triggers

User asks about quantities, counts, or data: "how many AHUs are there?", "what's on Level 02?", "show me the pipe schedule data".

### Step by step

```
1. FIND THE RIGHT SCHEDULE
   → list_revit_schedules → find by category or name
   → IF no schedule exists: "No equipment schedule found. Create one?"

2. READ DATA
   → GetRevitScheduleRowAndCellData(scheduleId)
   → Returns column headers + row values

3. ANSWER THE QUESTION
   → Summarise — don't dump raw tables unless asked
   → "There are 24 mechanical equipment items:
      - 8 x AHU-01 on Level 01
      - 4 x FCU-01 on Level 02
      - 12 x VAV Box on Levels 01-03"

4. FOR SPECIFIC QUESTIONS:
   → "How many ducts on Level 01?"
   → Check if schedule has a Level filter, or count from data
   → "Level 01 has 45 duct segments totalling 320 linear metres."
```

---

## General Dos and Don'ts

### DO
- **Check for existing schedules** before creating — avoid duplicates
- **Use pre-configured templates** for standard MEP categories — they have sensible defaults
- **List available fields first** before adding columns — use GetAvailableFieldsForRevitScheduleCategory
- **Summarise data** when answering questions — don't dump raw tables
- **Set appearance** after creating — grid lines, text styles, stripe rows make schedules readable
- **Use hidden fields** for filtering/sorting without cluttering the visible columns
- **Group with headers** when sorting by Level or System Type — makes the schedule scannable
- **Turn off itemize** for equipment counts — much cleaner than listing every instance
- **Check free space** before placing on sheet — schedules can be large
- **Coordinate text styles** with Object Styles Skill — schedule text uses same TextNoteType

### DON'T
- **Don't create duplicate schedules** without asking — check first
- **Don't add every possible field** — keep schedules focused on 5-8 key columns
- **Don't dump raw data** — summarise for the user unless they ask for full table
- **Don't place on a full sheet** — check FreeViewportSpaceCalculator first
- **Don't modify schedules the user didn't ask about** — they may have custom setups
- **Don't use panel schedule API** — electrical panel schedules are `PanelScheduleView`, not `ViewSchedule`
- **Don't hardcode field IDs** — always look up by name from `GetAvailableFieldsForRevitScheduleCategory()`
- **Don't forget the schedule is live** — it updates with the model, no need to "refresh"
- **Don't confuse schedule keys with building component schedules** — keys are lookup tables, not element listings
- **Don't place a schedule twice on the same sheet** — Revit will error

---

## Common Errors and Recovery

| Error | Cause | Recovery |
|-------|-------|----------|
| "No schedulable fields for category" | Category has no elements in model | Place elements first, or create schedule anyway (it'll populate when elements are added) |
| "Schedule already exists with that name" | Duplicate name | Use a different name or modify existing |
| "Field not found" | Parameter name doesn't match a schedulable field | GetAvailableFieldsForRevitScheduleCategory to discover correct name |
| "Field already in schedule" | Trying to add a field that's already a column | Skip — it's already there |
| "Cannot remove last field" | Trying to remove the only column | Add another field first, then remove |
| "Sheet is full" | No free space for schedule placement | Use a different sheet or resize existing viewports |
| "Schedule already placed on this sheet" | ScheduleSheetInstance duplicate | Place on a different sheet, or remove existing placement first |
| "Filter value type mismatch" | Filter value doesn't match field data type | Check field type — numeric fields need numbers, text fields need strings |
| "Panel schedule type" | Tried ViewSchedule API on electrical panel | Panel schedules use PanelScheduleView (out of scope) |
| "Cannot tag/crop in schedule view" | Attempted tagging or crop in schedule | Switch to a plan or section view for those operations |

---

## Tool Discovery

> **Single source of truth:** Tool specifications live in the MCP registry. Do not duplicate tool details here.
>
> Use `list_tools` to discover available tools. Filter by the categories below.

### Relevant tool categories

_No built tools exist yet for schedules._

### Planned tools (not yet in registry)

- `list_revit_schedules` / `GetRevitScheduleRowAndCellData` / `GetRevitScheduleColumnAndFilterDefinition` / `GetAvailableFieldsForRevitScheduleCategory` — schedule discovery and data reading
- `CreateRevitScheduleCommand` / `DuplicateExistingRevitSchedule` / `CreateMepRevitSchedule.*` — schedule creation
- `AddColumnToRevitSchedule` / `RemoveColumnFromRevitSchedule` / `ReorderColumnsInRevitSchedule` / `RenameColumnHeadingInRevitSchedule` / `HideColumnInRevitSchedule` / `AddCalculatedColumnToRevitSchedule` — field (column) management
- `SetRowFilterOnRevitSchedule` / `ClearAllFiltersOnRevitSchedule` — row filtering
- `SetSortOrderOnRevitSchedule` / `SetRevitScheduleGrandTotalRow` / `SetRevitScheduleItemizeEveryInstance` — sorting and grouping
- `SetColumnFormatInRevitSchedule` / `SetColumnTotalsInRevitSchedule` — column formatting
- `SetRevitScheduleAppearance` — appearance (text styles, grid lines, outline, stripe rows)
- `PlaceRevitScheduleOnSheet` — place schedule on sheet

---

## Related Skills

- [Master Model Setup Skill](Master%20Model%20Setup%20Skill.md) — may create standard schedules during setup
- [Parameters Skill](Parameters%20Skill.md) — schedule fields reference the same parameters discoverable via parameter tools
- [Revisions Skill](Revisions%20Skill.md) — revision schedule is a special ViewSchedule type
- [Object Styles Skill](Object%20Styles%20Skill.md) — schedule text styles (title/header/body) use TextNoteType — see Scenario 8

---

## Change Log

| Date | Change | Reason |
|------|--------|--------|
| 2026-03-20 | Created skill document. 5 scenarios: discover, create, modify, place on sheet, read data. All TODO — no ViewSchedule code exists. | User requirement: schedules need their own folder in ModelSetup with plan and skill. |
| 2026-03-20 | Major expansion: 9 scenarios covering full Revit schedule lifecycle. Added: Scenario 3 (add/remove/reorder/rename/hide columns), Scenario 4 (filter rows with operators), Scenario 5 (sort/group with headers/footers/grand totals/itemize), Scenario 6 (format columns — alignment/units/totals), Scenario 7 (appearance — text styles/grid/outline/stripe/title/headers). Expanded tool reference to 22 commands across 7 groups. | User requirement: full schedule CRUD — create, edit columns, remove, resort, formatting and appearance. Revit ViewSchedule API, not Excel. |

---

## How it flows

Ask Jason to build schedules. He'll start by looking at where you already are.

If you're inside a Revit model, he checks the open document for existing schedules and the elements that would feed each one. If you're in a connected workspace folder, he scans the folder for existing schedules, the client brief, and the project specification.

Before generating anything new, Jason asks for:

- **The client brief** (if not already in the workspace) — so the schedules match the deliverable list, not just the model contents.
- **The project specification** — to align column choices, units, and naming with what's been agreed.
- **Preferred client manufacturers** — so the model populates with the brands you actually specify, not Revit's defaults.

Once those are in hand, Jason builds and saves the schedules into your project's `Schedules/` folder. He then runs a cross-check against the model and produces a gap analysis: what's in the schedules that isn't in the model, what's in the model that's missing from the schedules, and which rows have stale or placeholder data.

If you have calculations connected (heat-loss spreadsheet, IESVE export, sizing calc), Jason tells you which schedule rows are out of sync — for example, a radiator whose output in the model doesn't match the calculated load.

---

## Settings & options

Per-workflow toggles that change Jason's defaults for this run.

| Option | Default | What it does |
|--------|---------|--------------|
| **Template source** | Adelphos templates | Choose between `Adelphos templates` or `Upload your own` (.rfa schedule template). |
| **Header & row configuration** | Auto from spec | Override which columns appear, their order, and which fields are visible vs hidden-for-filter. |
| **Always use preferred manufacturers** | On | When on, every modelled element pulls from the preferred-manufacturer list. When off, generic families are used. |
| **Generic data, no selection** | Off | When on, schedules populate with placeholder values (sizes, models, ratings) so the structure is in place before final selection. |

These options live in the skill document under `## Settings & options` — Jason reads them at runtime so the workflow page and the live behaviour stay in sync.
