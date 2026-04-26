#!/usr/bin/env python3
"""
revert_generic_xmldocs.py
=========================
Removes the generic <usecase>, <precondition>, and <aiprompts> XML doc tags
that were bulk-added by bulk_enrich_xmldocs.py.

Detects them by their generated patterns:
  - <usecase> starting with "User needs to ..."
  - <precondition> matching a known pillar-template sentence
  - <aiprompts> containing the generated "Validating input parameters..." pattern

Also fixes pillar assignments:
  - SoilDrainage -> Drainage
  - Placement -> Revit Utilities
  - Selection -> Revit Utilities

Pass --apply to write.
"""
import argparse
import re
import sys
from pathlib import Path

EXCLUDE_DIRS = {"bin", "obj", ".vs", ".backups", "Tracking", "node_modules"}

RE_TRANSACTION = re.compile(r"\[Transaction\(")
RE_CLASS_NAME = re.compile(r"public\s+(?:sealed\s+)?(?:abstract\s+)?class\s+(\w+)\s*[:\s{]")

# Patterns that match the GENERATED content (not hand-written)
RE_GEN_USECASE = re.compile(
    r"[ \t]*///[ \t]*<usecase>User needs to .*?</usecase>\s*\n",
    re.DOTALL
)
RE_GEN_PRECONDITION_TEMPLATES = [
    "Active Revit document open with the relevant level/view visible.",
    "Active Revit document open.",
    "Active Revit document open with a detail-capable view.",
    "Active Revit document open with MEP spaces/rooms placed.",
    "Active Revit document open with MEP spaces/rooms placed and heat-loss calculation data available.",
    "Active Revit document open with MEP spaces/rooms placed and heat-gain calculation data available.",
    "Active Revit document open with rooms placed.",
    "Active Revit document open with distribution boards placed.",
    "Active Revit document open with pipe elements visible.",
    "Active Revit document open with the target view active.",
    "Active Revit document open with plantroom boundaries defined.",
    "Active Revit document open with sheets placed.",
    "Active Revit document open with drainage system visible.",
    "Active Revit document open with soil drainage system visible.",
    "Active Revit document open with MEP services routed through structural elements.",
    "Active Revit document open with the relevant systems modelled.",
    "Active Revit document open with start/end connectors identified.",
    "Active Revit document open with systems connected.",
    "Active Revit document open with source document accessible.",
    "Active Revit document open with COBie data populated.",
    "Active Revit document open in workshared mode.",
    "Active Revit document open with grids placed.",
    "Active Revit document open with spaces/rooms placed.",
    "Active Revit document open with electrical systems modelled.",
    "Active Revit document open with fire alarm devices placed.",
    "Active Revit document open with cable routes defined.",
    "Active Revit document open with model elements placed.",
    "QA results XML exists from a previous clash run.",
    "Active Revit session running.",
]

RE_GEN_AIPROMPTS_BLOCK = re.compile(
    r"([ \t]*///[ \t]*<aiprompts>\s*\n)"
    r"([ \t]*///[ \t]*<preprompt>.*?</preprompt>\s*\n){1,3}"
    r"([ \t]*///[ \t]*<thinkingstep>Validating input parameters\.\.\.</thinkingstep>\s*\n)"
    r"([ \t]*///[ \t]*<thinkingstep>Resolving target .*?</thinkingstep>\s*\n)"
    r"([ \t]*///[ \t]*<thinkingstep>Executing .*?</thinkingstep>\s*\n)"
    r"([ \t]*///[ \t]*<successprompt>.*?</successprompt>\s*\n)"
    r"([ \t]*///[ \t]*<failureprompt>.*?</failureprompt>\s*\n)"
    r"([ \t]*///[ \t]*</aiprompts>\s*\n)",
    re.DOTALL
)

# Pillar renames
PILLAR_RENAMES = {
    "SoilDrainage": "Drainage",
    "Placement": "Revit Utilities",
    "Selection": "Revit Utilities",
}


def process_file(file_path: Path, apply: bool) -> dict:
    text = file_path.read_text(encoding="utf-8", errors="replace")
    if not RE_TRANSACTION.search(text):
        return None
    m_class = RE_CLASS_NAME.search(text)
    if not m_class:
        return None

    cls = m_class.group(1)
    changes = []
    new_text = text

    # 1. Remove generated <usecase>
    m = RE_GEN_USECASE.search(new_text)
    if m:
        new_text = new_text[:m.start()] + new_text[m.end():]
        changes.append("Removed generic <usecase>")

    # 2. Remove generated <precondition>
    for tmpl in RE_GEN_PRECONDITION_TEMPLATES:
        escaped = re.escape(tmpl)
        pat = re.compile(rf"[ \t]*///[ \t]*<precondition>{escaped}</precondition>\s*\n")
        m = pat.search(new_text)
        if m:
            new_text = new_text[:m.start()] + new_text[m.end():]
            changes.append("Removed generic <precondition>")
            break

    # 3. Remove generated <aiprompts> block
    m = RE_GEN_AIPROMPTS_BLOCK.search(new_text)
    if m:
        new_text = new_text[:m.start()] + new_text[m.end():]
        changes.append("Removed generic <aiprompts>")

    # 4. Fix pillar names
    for old_name, new_name in PILLAR_RENAMES.items():
        old_attr = f'[ServiceType("{old_name}")]'
        new_attr = f'[ServiceType("{new_name}")]'
        if old_attr in new_text:
            new_text = new_text.replace(old_attr, new_attr)
            changes.append(f"Renamed pillar {old_name} -> {new_name}")

    if not changes:
        return {"class": cls, "changes": [], "status": "unchanged"}

    result = {"class": cls, "changes": changes, "status": "reverted"}
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
        print("  DRY RUN -- pass --apply to write")
        print("=" * 60)
        print()

    files = sorted(p for p in args.scan.rglob("*.cs")
                   if not any(part in EXCLUDE_DIRS for part in p.parts))

    stats = {"usecase_removed": 0, "precondition_removed": 0,
             "aiprompts_removed": 0, "pillar_renamed": 0,
             "files_changed": 0, "errors": 0}

    for f in files:
        try:
            r = process_file(f, args.apply)
            if r is None or r["status"] == "unchanged":
                continue
            stats["files_changed"] += 1
            for c in r["changes"]:
                if "usecase" in c:
                    stats["usecase_removed"] += 1
                elif "precondition" in c:
                    stats["precondition_removed"] += 1
                elif "aiprompts" in c:
                    stats["aiprompts_removed"] += 1
                elif "pillar" in c.lower():
                    stats["pillar_renamed"] += 1
            if not args.apply:
                ch = "; ".join(r["changes"])
                print(f"  {r['class']:<55} {ch}")
        except Exception as e:
            stats["errors"] += 1
            print(f"  ERROR {f.name}: {e}", file=sys.stderr)

    print()
    print(f"Files changed:         {stats['files_changed']}")
    print(f"Usecases removed:      {stats['usecase_removed']}")
    print(f"Preconditions removed: {stats['precondition_removed']}")
    print(f"AI prompts removed:    {stats['aiprompts_removed']}")
    print(f"Pillars renamed:       {stats['pillar_renamed']}")
    print(f"Errors:                {stats['errors']}")

    if not args.apply:
        print("\nPass --apply to write.")


if __name__ == "__main__":
    main()
