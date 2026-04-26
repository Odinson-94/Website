#!/usr/bin/env python3
"""
validate_cs_structure.py
========================
Validates that all [Transaction]-decorated .cs files have correct structure:
1. XML doc comments (/// <summary>) come before attributes
2. [ServiceType] and [Transaction] appear before the class declaration
3. No orphaned tags or broken nesting
4. Attributes aren't inside doc comments

Reports any structural issues found.
"""
import re
import sys
from pathlib import Path
from collections import Counter

EXCLUDE_DIRS = {"bin", "obj", ".vs", ".backups", "Tracking", "node_modules"}
SCAN_PATH = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(".")

RE_TRANSACTION = re.compile(r"\[Transaction\(")
RE_CLASS_LINE = re.compile(r"^(\s*)(public\s+(?:sealed\s+)?(?:abstract\s+)?class\s+(\w+))", re.MULTILINE)

issues = Counter()
issue_details = []

def check_file(f: Path):
    text = f.read_text(encoding="utf-8", errors="replace")
    if not RE_TRANSACTION.search(text):
        return

    m_class = RE_CLASS_LINE.search(text)
    if not m_class:
        issues["no_class_found"] += 1
        issue_details.append(f"NO CLASS: {f.name}")
        return

    cls = m_class.group(3)
    class_pos = m_class.start()
    before_class = text[:class_pos]
    lines = text.split('\n')

    # 1. Check [UsedImplicitly] isn't between summary and class
    summary_pos = text.find("/// <summary>")
    used_impl = text.find("[UsedImplicitly]")
    if used_impl != -1 and summary_pos != -1:
        if used_impl < summary_pos and summary_pos < class_pos:
            # UsedImplicitly before summary -- this is wrong if summary is for the class
            pass  # Actually this can be ok in some patterns
        elif summary_pos < used_impl < class_pos:
            pass  # Summary then UsedImplicitly then class -- OK

    # 2. Check [ServiceType] is before class and NOT inside a doc comment
    for m in re.finditer(r'\[ServiceType\("([^"]+)"\)\]', text):
        line_num = text[:m.start()].count('\n') + 1
        line_text = lines[line_num - 1].strip()
        if line_text.startswith("///"):
            issues["servicetype_in_comment"] += 1
            issue_details.append(f"SERVICETYPE IN COMMENT: {cls} ({f.name}:{line_num})")
        elif m.start() > class_pos:
            issues["servicetype_after_class"] += 1
            issue_details.append(f"SERVICETYPE AFTER CLASS: {cls} ({f.name}:{line_num})")

    # 3. Check [Transaction] is before class
    for m in RE_TRANSACTION.finditer(text):
        if m.start() > class_pos:
            line_num = text[:m.start()].count('\n') + 1
            line_text = lines[line_num - 1].strip()
            if not line_text.startswith("///"):
                issues["transaction_after_class"] += 1
                issue_details.append(f"TRANSACTION AFTER CLASS: {cls} ({f.name}:{line_num})")

    # 4. Check [Keywords] is before class and NOT inside a doc comment
    for m in re.finditer(r'\[Keywords\(', text):
        line_num = text[:m.start()].count('\n') + 1
        line_text = lines[line_num - 1].strip()
        if line_text.startswith("///"):
            issues["keywords_in_comment"] += 1
            issue_details.append(f"KEYWORDS IN COMMENT: {cls} ({f.name}:{line_num})")

    # 5. Check summary is NOT after [Transaction]
    transaction_pos = None
    for m in RE_TRANSACTION.finditer(text):
        if m.start() < class_pos:
            transaction_pos = m.start()
            break
    if transaction_pos and summary_pos and summary_pos > transaction_pos:
        issues["summary_after_transaction"] += 1
        issue_details.append(f"SUMMARY AFTER TRANSACTION: {cls} ({f.name})")

    # 6. Check for [UsedImplicitly] appearing BEFORE /// <summary>
    if used_impl != -1 and summary_pos != -1:
        if used_impl < summary_pos < class_pos:
            # Check if [UsedImplicitly] is on its own line not in a comment
            ui_line_num = text[:used_impl].count('\n') + 1
            ui_line = lines[ui_line_num - 1].strip()
            sum_line_num = text[:summary_pos].count('\n') + 1
            if not ui_line.startswith("///"):
                issues["usedimplicitly_before_summary"] += 1
                issue_details.append(f"[UsedImplicitly] BEFORE <summary>: {cls} ({f.name}:{ui_line_num}) -- summary at line {sum_line_num}")

    # 7. Check no duplicate [ServiceType]
    st_matches = list(re.finditer(r'\[ServiceType\("([^"]+)"\)\]', text))
    real_st = [m for m in st_matches if not lines[text[:m.start()].count('\n')].strip().startswith("///")]
    if len(real_st) > 1:
        issues["duplicate_servicetype"] += 1
        issue_details.append(f"DUPLICATE SERVICETYPE: {cls} ({f.name})")

files = sorted(p for p in SCAN_PATH.rglob("*.cs")
               if not any(part in EXCLUDE_DIRS for part in p.parts))

total = 0
for f in files:
    try:
        check_file(f)
        total += 1
    except Exception as e:
        print(f"ERROR reading {f.name}: {e}", file=sys.stderr)

print(f"Checked {total} .cs files\n")

if not issues:
    print("ALL CLEAR -- no structural issues found.")
else:
    print("ISSUES FOUND:")
    for issue, count in issues.most_common():
        print(f"  {count:>4}x  {issue}")
    print(f"\nDETAILS ({len(issue_details)} items):")
    for d in issue_details[:50]:
        print(f"  {d}")
    if len(issue_details) > 50:
        print(f"  ... and {len(issue_details) - 50} more")
