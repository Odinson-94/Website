#!/usr/bin/env python3
"""
bulk_enrich_commands.py
=======================
Scans MEPBridge.Revit .cs files for [Transaction]-decorated classes and
adds missing [ServiceType("pillar")] attributes based on class-name patterns.

Also patches:
  - Missing <summary> XML doc tags (generated from class name)
  - Missing [Keywords(...)] attributes (generated from class name tokens)

DRY RUN by default. Pass --apply to actually write changes.

USAGE
-----
    py -3 bulk_enrich_commands.py --scan "C:\...\MEPBridge.Revit"
    py -3 bulk_enrich_commands.py --scan "C:\...\MEPBridge.Revit" --apply
"""
import argparse
import re
import sys
from pathlib import Path

EXCLUDE_DIRS = {"bin", "obj", ".vs", ".backups", "node_modules"}

RE_TRANSACTION = re.compile(r"\[Transaction\(")
RE_CLASS_NAME = re.compile(r"(public\s+(?:sealed\s+)?(?:abstract\s+)?class\s+(\w+)\s*[:\s{])")
RE_SERVICE_TYPE = re.compile(r'\[ServiceType\(')
RE_KEYWORDS = re.compile(r'\[Keywords\(')
RE_SUMMARY_OPEN = re.compile(r'///\s*<summary>')
RE_NAMESPACE = re.compile(r"namespace\s+([\w.]+)")

# ──────────────────────────────────────────────────────────────────────────────
# PILLAR MAPPING: prefix pattern -> pillar name
# Order matters: first match wins
# ──────────────────────────────────────────────────────────────────────────────
PILLAR_RULES = [
    # MEP disciplines
    (r"^Design(Drainage|SoilDrainage)", "Drainage"),
    (r"^(Drainage|PlaceDrainageNotes|DrainageNotes|PlaceDrops)", "Drainage"),
    (r"^DesignVentilation", "Ventilation"),
    (r"^Ventilation", "Ventilation"),
    (r"^DesignLighting", "Lighting"),
    (r"^Lighting", "Lighting"),
    (r"^DesignSmallPower", "Small Power"),
    (r"^SmallPower", "Small Power"),
    (r"^DesignMechPower", "Mechanical Power"),
    (r"^MechanicalPower", "Mechanical Power"),
    (r"^DesignFireAlarm", "Fire Alarm"),
    (r"^DesignContainment", "Containment"),
    (r"^DesignHeating", "Heating"),
    (r"^Heating", "Heating"),
    (r"^Cooling", "Cooling"),
    (r"^Circuit", "Electrical"),
    (r"^Amtech", "Electrical"),

    # Calculations by type
    (r"^CalculationWriteHeatLoss", "Heating"),
    (r"^CalculationWriteHeatGain", "Cooling"),
    (r"^CalculationWriteLuxLevel", "Lighting"),
    (r"^CalculationWriteKitchenVentilation", "Ventilation"),
    (r"^CalculationWriteVentilationRequirement", "Ventilation"),
    (r"^CalculationWriteRoomPressure", "Ventilation"),
    (r"^Calculation", "Calculations"),

    # Clash detection / solving / management
    (r"^Clash(Finder|Manager|Solver)", "Clash Detection"),
    (r"^(Check|Run)Clash", "Clash Detection"),
    (r"^(AddCommentToClash|CaptureAllClash|CaptureSingleClash|CycleThroughClash|ExecuteApprovedClash|ExportClash|MarkClashResult|NavigateToClash|PlanClashSolutions|SectionBoxAroundClash|UpdateClashResult)", "Clash Detection"),
    (r"^ImportNavisworks", "Clash Detection"),

    # Architecture
    (r"^Architecture", "Architecture"),
    (r"^Room(Edit|Place)", "Architecture"),

    # Builderswork
    (r"^Builderswork", "Builderswork"),

    # Schematics
    (r"^Schematic", "Schematics"),

    # Pipework
    (r"^Pipework", "Pipework"),
    (r"^Extend(AllConnectors|AndConnect|Pipe|FromConnector)", "Pipework"),
    (r"^Match(Height|PipeCenters)", "Pipework"),
    (r"^MEPSystem(Auto)?Fillet", "Pipework"),
    (r"^MEPSystemTee", "Pipework"),
    (r"^Ramp(Secondary)?Services", "Pipework"),
    (r"^Connector", "Pipework"),
    (r"^FittingRotate", "Pipework"),
    (r"^RoutingPreferences", "Pipework"),
    (r"^QuickSize", "Pipework"),
    (r"^IsolateSystem", "Pipework"),
    (r"^SelectConnected", "Pipework"),
    (r"^NetworkFind", "Pipework"),
    (r"^NetworkGetAll", "Pipework"),
    (r"^NetworkTrace", "Pipework"),

    # Sizing
    (r"^Sizing", "Sizing"),
    (r"^DuctNetwork", "Sizing"),

    # Voxel routing
    (r"^Voxel", "Routing"),
    (r"^MultiServiceDrawer", "Routing"),

    # Plantroom
    (r"^Plantroom", "Plantroom"),
    (r"^Layout", "Plantroom"),

    # Placement / detection
    (r"^Placement", "Placement"),
    (r"^Detection", "Detection"),
    (r"^Place(SVP|Svp|Family)", "Placement"),

    # Annotation / tagging
    (r"^Annotation", "Annotation"),
    (r"^Tagging", "Annotation"),
    (r"^Tag(All|sAllRooms|ExistingRevision)", "Annotation"),
    (r"^(AddDetailLine|AddFilledRegion|CreateTextNote|EditTextNote|ChangeTextType)", "Annotation"),
    (r"^TextStyles", "Annotation"),
    (r"^Legend", "Annotation"),

    # Sheets & views
    (r"^Sheet(ViewSetup|Setup|SetUp)", "Sheets and Views"),
    (r"^Create(Sheet|Views|Floorplan|ReflectedCeiling|Section|3DSection|RoomElevation|SimilarViews)", "Sheets and Views"),
    (r"^PlaceViews", "Sheets and Views"),
    (r"^(SetCropView|SetViewToScopeBox|Rotate3DTo|RemoveViewTemplate|ConfigureViewTemplate|CreateViewTemplate|ApplyViewTemplate)", "Sheets and Views"),
    (r"^View(Hide|Toggle)", "Sheets and Views"),

    # Revisions
    (r"^(AddRevision|BatchAddRevision|CheckRevisions|CreateRevision|EditRevision|IssueRevision|PlaceRevision|RemoveRevision)", "Revisions"),

    # Selection
    (r"^Select(All|By|In|Titleblock)", "Selection"),
    (r"^FilterSelection", "Selection"),

    # QA
    (r"^(QA|Qa)Manager", "QA"),
    (r"^ErrorManager", "QA"),
    (r"^ShowMe(Dispatch|User)", "QA"),
    (r"^ShowUserThe", "QA"),

    # Import / export
    (r"^(Export|Import)(JSON|Rad|Families|MEPTags|Systems|Zones|Model|Command|WithCloud|Placed|Drawing)", "Import and Export"),
    (r"^Snapshot(Export|Query|Staging)", "Import and Export"),

    # COBie
    (r"^(Open)?Cobie", "COBie"),

    # Standards transfer
    (r"^Transfer(All|Specific|Standards)", "Standards Transfer"),
    (r"^OpenTransfer", "Standards Transfer"),

    # Filters
    (r"^(AddFilter|CreateFilter|CreateBatchMep|EditFilter|ExportModelFilter|ExportViewFilter|OpenFilter)", "Filters and Templates"),

    # Project settings
    (r"^ProjectSettings", "Project Settings"),
    (r"^SetTemplateProject", "Project Settings"),

    # Workset management
    (r"^WorksetManager", "Workset Management"),

    # Warnings
    (r"^(Acknowledge|AutoResolve|Clear|Dismiss)(Central|Revit)?Warning", "Warnings"),

    # Object settings
    (r"^Object(Settings|Style)", "Object Settings"),
    (r"^Element(Style|Colour|Line)", "Object Settings"),
    (r"^OpenObject", "Object Settings"),

    # Parameter editing
    (r"^Parameter(Editor|Set)", "Parameters"),
    (r"^OpenProject(Settings)?Window", "Project Settings"),
    (r"^OpenRoutingPreferences", "Pipework"),
    (r"^OpenWarning", "Warnings"),
    (r"^OpenWorkset", "Workset Management"),
    (r"^OpenTagging", "Annotation"),

    # Preferences
    (r"^Preferences(Save|Sync)", "Settings"),

    # Grids
    (r"^(Pin|Unpin|Toggle|CopyMonitor)(All)?Grids", "Grids"),
    (r"^CopyMonitorLevels", "Grids"),

    # Debug / test / internal
    (r"^Debug", "Debug"),
    (r"^Test", "Debug"),
    (r"^Startup", "Internal"),
    (r"^ShowAIChat", "Internal"),
    (r"^AIChatSave", "Internal"),
    (r"^ToggleLogger", "Internal"),

    # Build schedules
    (r"^BuildSchedules", "Schedules"),

    # Families
    (r"^Family(Swap|Load|Import)", "Families"),

    # Snap
    (r"^SnapToWall", "Placement"),

    # Visualize
    (r"^Visualize", "QA"),

    # Linked view settings
    (r"^ApplyLinkedView", "Sheets and Views"),

    # Remaining misc
    (r"^(Query|System)Model", "General"),
    (r".*", "General"),
]


def classify_pillar(class_name: str) -> str:
    for pattern, pillar in PILLAR_RULES:
        if re.search(pattern, class_name):
            return pillar
    return "General"


def humanize_class_name(class_name: str) -> str:
    """Turn CamelCase class name into readable sentence fragment."""
    name = class_name
    for suffix in ["Command", "ExternalCommand"]:
        if name.endswith(suffix):
            name = name[:-len(suffix)]
    words = re.findall(r'[A-Z][a-z]+|[A-Z]+(?=[A-Z][a-z])|[A-Z]+$|[a-z]+|\d+', name)
    return ' '.join(w.lower() for w in words)


def generate_summary(class_name: str) -> str:
    """Generate a reasonable summary from class name."""
    human = humanize_class_name(class_name)
    # Capitalize first letter
    if human:
        human = human[0].upper() + human[1:]
    return f"{human}."


def generate_keywords(class_name: str) -> list:
    """Generate keywords from class name tokens."""
    human = humanize_class_name(class_name)
    words = human.split()
    stop_words = {"a", "an", "the", "in", "on", "at", "to", "for", "of", "by",
                  "from", "with", "and", "or", "is", "it", "do", "all", "set",
                  "get", "run", "add", "new", "command"}
    meaningful = [w for w in words if w.lower() not in stop_words and len(w) > 2]
    kw = []
    if len(meaningful) >= 2:
        kw.append(' '.join(meaningful[:3]))
    if len(meaningful) >= 4:
        kw.append(' '.join(meaningful[1:4]))
    kw.append(human)
    return kw[:3]


def process_file(file_path: Path, apply: bool, verbose: bool) -> dict:
    """Process a single .cs file. Returns stats dict."""
    text = file_path.read_text(encoding="utf-8", errors="replace")
    if not RE_TRANSACTION.search(text):
        return None

    m_class = RE_CLASS_NAME.search(text)
    if not m_class:
        return None

    cls = m_class.group(2)
    changes = []
    new_text = text

    # 1. Add [ServiceType] if missing
    has_service_type = RE_SERVICE_TYPE.search(text)
    if not has_service_type:
        pillar = classify_pillar(cls)
        attr_line = f'    [ServiceType("{pillar}")]'
        # Insert before the [Transaction] line
        tx_match = RE_TRANSACTION.search(new_text)
        if tx_match:
            insert_pos = new_text.rfind('\n', 0, tx_match.start()) + 1
            new_text = new_text[:insert_pos] + attr_line + '\n' + new_text[insert_pos:]
            changes.append(f"Added [ServiceType(\"{pillar}\")]")

    # 2. Add <summary> if missing
    has_summary = RE_SUMMARY_OPEN.search(text)
    if not has_summary:
        summary = generate_summary(cls)
        doc_block = f"    /// <summary>{summary}</summary>\n"
        # Insert before [ServiceType] or [Transaction]
        tx_match = re.search(r'\n(\s*\[(?:ServiceType|Transaction)\()', new_text)
        if tx_match:
            insert_pos = tx_match.start() + 1
            new_text = new_text[:insert_pos] + doc_block + new_text[insert_pos:]
            changes.append(f"Added <summary>")

    # 3. Add [Keywords] if missing
    has_keywords = RE_KEYWORDS.search(text)
    if not has_keywords:
        kws = generate_keywords(cls)
        kw_str = ', '.join(f'"{k}"' for k in kws)
        attr_line = f'    [Keywords({kw_str})]'
        tx_match = re.search(r'\n(\s*\[Transaction\()', new_text)
        if tx_match:
            insert_pos = tx_match.start() + 1
            new_text = new_text[:insert_pos] + attr_line + '\n' + new_text[insert_pos:]
            changes.append(f"Added [Keywords]")

    if not changes:
        return {"class": cls, "changes": [], "status": "already_complete"}

    result = {"class": cls, "changes": changes, "status": "updated"}

    if apply and new_text != text:
        file_path.write_text(new_text, encoding="utf-8")
        result["written"] = True
    else:
        result["written"] = False

    return result


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--scan", type=Path, required=True,
                    help="Path to MEPBridge.Revit folder")
    ap.add_argument("--apply", action="store_true",
                    help="Actually write changes (default is dry run)")
    ap.add_argument("--verbose", action="store_true")
    args = ap.parse_args()

    if not args.apply:
        print("=" * 60)
        print("  DRY RUN -- pass --apply to write changes")
        print("=" * 60)
        print()

    files = sorted(p for p in args.scan.rglob("*.cs")
                   if not any(part in EXCLUDE_DIRS for part in p.parts))

    stats = {"scanned": 0, "transaction_classes": 0, "updated": 0,
             "already_complete": 0, "pillar_added": 0, "summary_added": 0,
             "keywords_added": 0, "errors": 0}

    results = []
    for f in files:
        stats["scanned"] += 1
        try:
            r = process_file(f, args.apply, args.verbose)
            if r is None:
                continue
            stats["transaction_classes"] += 1
            results.append(r)
            if r["status"] == "updated":
                stats["updated"] += 1
                for c in r["changes"]:
                    if "ServiceType" in c:
                        stats["pillar_added"] += 1
                    if "summary" in c:
                        stats["summary_added"] += 1
                    if "Keywords" in c:
                        stats["keywords_added"] += 1
            else:
                stats["already_complete"] += 1
        except Exception as e:
            stats["errors"] += 1
            print(f"  ERROR {f.name}: {e}", file=sys.stderr)

    # Print results
    print(f"Scanned {stats['scanned']} .cs files")
    print(f"Found {stats['transaction_classes']} [Transaction] classes")
    print()
    print(f"  Updated:          {stats['updated']}")
    print(f"  Already complete: {stats['already_complete']}")
    print(f"  Errors:           {stats['errors']}")
    print()
    print(f"  Pillars added:    {stats['pillar_added']}")
    print(f"  Summaries added:  {stats['summary_added']}")
    print(f"  Keywords added:   {stats['keywords_added']}")
    print()

    if args.verbose or not args.apply:
        for r in sorted(results, key=lambda x: x["class"]):
            if r["changes"]:
                changes_str = "; ".join(r["changes"])
                written = " [WRITTEN]" if r.get("written") else " [dry-run]"
                print(f"  {r['class']:<55} {changes_str}{written}")

    if not args.apply:
        print()
        print("Pass --apply to write these changes to disk.")


if __name__ == "__main__":
    main()
