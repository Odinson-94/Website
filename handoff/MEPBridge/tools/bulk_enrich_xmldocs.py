#!/usr/bin/env python3
"""
bulk_enrich_xmldocs.py
======================
Second enrichment pass: adds missing <usecase>, <precondition>, and <aiprompts>
XML doc tags to [Transaction]-decorated C# classes.

Generates content from the class name + existing <summary>.

DRY RUN by default. Pass --apply to actually write changes.

USAGE
-----
    py -3 bulk_enrich_xmldocs.py --scan "C:\...\MEPBridge.Revit"
    py -3 bulk_enrich_xmldocs.py --scan "C:\...\MEPBridge.Revit" --apply
"""
import argparse
import re
import sys
from pathlib import Path

EXCLUDE_DIRS = {"bin", "obj", ".vs", ".backups", "Tracking", "node_modules"}

RE_TRANSACTION = re.compile(r"\[Transaction\(")
RE_CLASS_NAME = re.compile(r"public\s+(?:sealed\s+)?(?:abstract\s+)?class\s+(\w+)\s*[:\s{]")

RE_USECASE_TAG = re.compile(r"<usecase>")
RE_PRECONDITION_TAG = re.compile(r"<precondition>")
RE_AIPROMPTS_TAG = re.compile(r"<aiprompts>")
RE_SUMMARY_TAG = re.compile(r"<summary>(.*?)</summary>", re.DOTALL)
RE_XML_DOC_END = re.compile(r"([ \t]*///[^\n]*\n)(\s*\[)")


def clean_xml_text(raw: str) -> str:
    cleaned = re.sub(r"^\s*///\s?", "", raw, flags=re.MULTILINE)
    cleaned = re.sub(r"<see\s+cref=\"([^\"]+)\"\s*/>", r"\1", cleaned)
    cleaned = re.sub(r"<[^>]+>", "", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned)
    return cleaned.strip()


def humanize(class_name: str) -> str:
    name = class_name
    for suffix in ["Command", "ExternalCommand"]:
        if name.endswith(suffix):
            name = name[:-len(suffix)]
    words = re.findall(r'[A-Z][a-z]+|[A-Z]+(?=[A-Z][a-z])|[A-Z]+$|[a-z]+|\d+', name)
    return ' '.join(w.lower() for w in words)


def first_sentence(text: str) -> str:
    if not text:
        return ""
    m = re.match(r"(.*?[.!?])(?:\s+[A-Z]|\s*$)", text)
    if m:
        return m.group(1).strip()
    return text[:200].strip()


# ──────────────────────────────────────────────────────────────────────
# Pillar-to-domain context mapping for generating better content
# ──────────────────────────────────────────────────────────────────────
PILLAR_CONTEXT = {
    "Clash Detection": ("clash detection", "QA results XML exists from a previous clash run", "clash"),
    "Architecture": ("architectural modelling", "Active Revit document open with the relevant level/view visible", "architectural element"),
    "Sheets and Views": ("drawing production", "Active Revit document open", "sheet/view"),
    "Annotation": ("annotation and tagging", "Active Revit document open with a detail-capable view", "annotation"),
    "Ventilation": ("ventilation design", "Active Revit document open with MEP spaces/rooms placed", "ventilation"),
    "Heating": ("heating design", "Active Revit document open with MEP spaces/rooms placed and heat-loss calculation data available", "heating"),
    "Cooling": ("cooling design", "Active Revit document open with MEP spaces/rooms placed and heat-gain calculation data available", "cooling"),
    "Lighting": ("lighting design", "Active Revit document open with MEP spaces/rooms placed", "lighting"),
    "Small Power": ("small power design", "Active Revit document open with rooms placed", "socket/power point"),
    "Mechanical Power": ("mechanical power design", "Active Revit document open with distribution boards placed", "power distribution"),
    "Pipework": ("pipework routing", "Active Revit document open with pipe elements visible", "pipe/fitting"),
    "Placement": ("element placement", "Active Revit document open with the target view active", "element"),
    "Plantroom": ("plantroom layout", "Active Revit document open with plantroom boundaries defined", "equipment"),
    "Selection": ("element selection", "Active Revit document open", "element"),
    "QA": ("quality assurance", "Active Revit document open", "QA check"),
    "Import and Export": ("data exchange", "Active Revit document open", "data"),
    "Revisions": ("revision management", "Active Revit document open with sheets placed", "revision"),
    "Drainage": ("drainage design", "Active Revit document open with drainage system visible", "drainage element"),
    "SoilDrainage": ("soil drainage design", "Active Revit document open with soil drainage system visible", "soil drainage element"),
    "Builderswork": ("builderswork openings", "Active Revit document open with MEP services routed through structural elements", "opening"),
    "Schematics": ("schematic generation", "Active Revit document open with the relevant systems modelled", "schematic"),
    "Routing": ("automated routing", "Active Revit document open with start/end connectors identified", "route"),
    "Sizing": ("system sizing", "Active Revit document open with systems connected", "system"),
    "Filters and Templates": ("view filters and templates", "Active Revit document open", "filter/template"),
    "Standards Transfer": ("standards transfer", "Active Revit document open with source document accessible", "standard"),
    "COBie": ("COBie data management", "Active Revit document open with COBie data populated", "COBie data"),
    "Object Settings": ("object style management", "Active Revit document open", "object style"),
    "Project Settings": ("project settings", "Active Revit document open", "setting"),
    "Workset Management": ("workset management", "Active Revit document open in workshared mode", "workset"),
    "Warnings": ("warning management", "Active Revit document open", "warning"),
    "Grids": ("grid management", "Active Revit document open with grids placed", "grid"),
    "Families": ("family management", "Active Revit document open", "family"),
    "Parameters": ("parameter editing", "Active Revit document open", "parameter"),
    "Settings": ("preference management", "Active Revit document open", "preference"),
    "Schedules": ("schedule building", "Active Revit document open with model elements placed", "schedule"),
    "Detection": ("spatial detection", "Active Revit document open with rooms/spaces placed", "location"),
    "Electrical": ("electrical design", "Active Revit document open with electrical systems modelled", "electrical element"),
    "Debug": ("debugging and testing", "Active Revit document open", "debug output"),
    "Internal": ("internal tooling", "Active Revit session running", "internal state"),
    "General": ("general Revit operations", "Active Revit document open", "element"),
    "Combined": ("combined MEP operations", "Active Revit document open", "system"),
    "Fire Alarm": ("fire alarm design", "Active Revit document open with fire alarm devices placed", "fire alarm device"),
    "Containment": ("containment design", "Active Revit document open with cable routes defined", "containment element"),
    "Calculations": ("engineering calculations", "Active Revit document open with spaces/rooms placed", "calculation result"),
}


def get_summary_from_file(text: str) -> str:
    m = RE_SUMMARY_TAG.search(text)
    if m:
        return clean_xml_text(m.group(1))
    return ""


def generate_usecase(class_name: str, summary: str, pillar: str) -> str:
    human = humanize(class_name)
    domain, _, noun = PILLAR_CONTEXT.get(pillar, ("Revit operations", "Active Revit document open", "element"))

    if summary:
        first = first_sentence(summary)
        return f"User needs to {human} as part of {domain}. AI orchestrator calls this when {first.lower().rstrip('.')}"
    return f"User needs to {human} as part of {domain}."


def generate_precondition(class_name: str, summary: str, pillar: str) -> str:
    _, precond, _ = PILLAR_CONTEXT.get(pillar, ("Revit operations", "Active Revit document open", "element"))
    return precond + "."


def generate_aiprompts(class_name: str, summary: str, pillar: str) -> str:
    human = humanize(class_name)
    domain, _, noun = PILLAR_CONTEXT.get(pillar, ("Revit operations", "Active Revit document open", "element"))

    cap_human = human[0].upper() + human[1:] if human else "Running"

    # Build prompt components
    prep1 = f"{cap_human}..."
    prep2 = f"Working on {human} now..."

    think1 = f"Validating input parameters..."
    think2 = f"Resolving target {noun}..."
    think3 = f"Executing {human} in the model..."

    succ1 = f"{cap_human} completed successfully."
    fail1 = f"Could not {human}: {{error}}"

    lines = []
    lines.append(f"    /// <aiprompts>")
    lines.append(f"    /// <preprompt>{prep1}</preprompt>")
    lines.append(f"    /// <preprompt>{prep2}</preprompt>")
    lines.append(f"    /// <thinkingstep>{think1}</thinkingstep>")
    lines.append(f"    /// <thinkingstep>{think2}</thinkingstep>")
    lines.append(f"    /// <thinkingstep>{think3}</thinkingstep>")
    lines.append(f"    /// <successprompt>{succ1}</successprompt>")
    lines.append(f"    /// <failureprompt>{fail1}</failureprompt>")
    lines.append(f"    /// </aiprompts>")
    return "\n".join(lines)


def get_pillar_from_file(text: str) -> str:
    m = re.search(r'\[ServiceType\("([^"]+)"\)\]', text)
    if m:
        return m.group(1)
    return "General"


def process_file(file_path: Path, apply: bool) -> dict:
    text = file_path.read_text(encoding="utf-8", errors="replace")
    if not RE_TRANSACTION.search(text):
        return None

    m_class = RE_CLASS_NAME.search(text)
    if not m_class:
        return None

    cls = m_class.group(1)
    summary = get_summary_from_file(text)
    pillar = get_pillar_from_file(text)
    changes = []
    new_text = text

    has_usecase = RE_USECASE_TAG.search(text)
    has_precondition = RE_PRECONDITION_TAG.search(text)
    has_aiprompts = RE_AIPROMPTS_TAG.search(text)

    tags_to_add = []

    if not has_usecase:
        uc = generate_usecase(cls, summary, pillar)
        tags_to_add.append(f"    /// <usecase>{uc}</usecase>")
        changes.append("Added <usecase>")

    if not has_precondition:
        pc = generate_precondition(cls, summary, pillar)
        tags_to_add.append(f"    /// <precondition>{pc}</precondition>")
        changes.append("Added <precondition>")

    if not has_aiprompts:
        ap = generate_aiprompts(cls, summary, pillar)
        tags_to_add.append(ap)
        changes.append("Added <aiprompts>")

    if not changes:
        return {"class": cls, "changes": [], "status": "already_complete"}

    insert_block = "\n".join(tags_to_add) + "\n"

    # Find the right insertion point: after </summary> but before attributes/class
    # Strategy: find the last /// line before the first [ attribute, insert after it
    summary_end = re.search(r"(///\s*</summary>\s*\n)", new_text)
    if summary_end:
        insert_pos = summary_end.end()
        new_text = new_text[:insert_pos] + insert_block + new_text[insert_pos:]
    else:
        # Fallback: insert before [Transaction] or [ServiceType]
        tx_match = re.search(r"\n(\s*\[(?:ServiceType|Transaction)\()", new_text)
        if tx_match:
            insert_pos = tx_match.start() + 1
            new_text = new_text[:insert_pos] + insert_block + new_text[insert_pos:]

    result = {"class": cls, "changes": changes, "status": "updated", "pillar": pillar}

    if apply and new_text != text:
        file_path.write_text(new_text, encoding="utf-8")
        result["written"] = True
    else:
        result["written"] = False

    return result


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--scan", type=Path, required=True)
    ap.add_argument("--apply", action="store_true")
    args = ap.parse_args()

    if not args.apply:
        print("=" * 60)
        print("  DRY RUN -- pass --apply to write changes")
        print("=" * 60)
        print()

    files = sorted(p for p in args.scan.rglob("*.cs")
                   if not any(part in EXCLUDE_DIRS for part in p.parts))

    stats = {"scanned": 0, "transaction_classes": 0, "updated": 0,
             "already_complete": 0, "usecase_added": 0,
             "precondition_added": 0, "aiprompts_added": 0, "errors": 0}

    results = []
    for f in files:
        stats["scanned"] += 1
        try:
            r = process_file(f, args.apply)
            if r is None:
                continue
            stats["transaction_classes"] += 1
            results.append(r)
            if r["status"] == "updated":
                stats["updated"] += 1
                for c in r["changes"]:
                    if "usecase" in c:
                        stats["usecase_added"] += 1
                    if "precondition" in c:
                        stats["precondition_added"] += 1
                    if "aiprompts" in c:
                        stats["aiprompts_added"] += 1
            else:
                stats["already_complete"] += 1
        except Exception as e:
            stats["errors"] += 1
            print(f"  ERROR {f.name}: {e}", file=sys.stderr)

    print(f"Scanned {stats['scanned']} .cs files")
    print(f"Found {stats['transaction_classes']} [Transaction] classes")
    print()
    print(f"  Updated:           {stats['updated']}")
    print(f"  Already complete:  {stats['already_complete']}")
    print(f"  Errors:            {stats['errors']}")
    print()
    print(f"  Usecases added:    {stats['usecase_added']}")
    print(f"  Preconditions:     {stats['precondition_added']}")
    print(f"  AI prompts:        {stats['aiprompts_added']}")
    print()

    if not args.apply:
        for r in sorted(results, key=lambda x: x["class"]):
            if r["changes"]:
                changes_str = "; ".join(r["changes"])
                written = " [WRITTEN]" if r.get("written") else " [dry-run]"
                print(f"  {r['class']:<55} {changes_str}{written}")
        print()
        print("Pass --apply to write these changes to disk.")


if __name__ == "__main__":
    main()
