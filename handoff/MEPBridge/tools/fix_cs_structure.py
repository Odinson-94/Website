#!/usr/bin/env python3
"""
fix_cs_structure.py
===================
Fixes structural issues in [Transaction]-decorated .cs files:

1. [UsedImplicitly] BEFORE <summary>: Moves [UsedImplicitly] after the
   doc comment block, right before the other attributes.

2. SUMMARY AFTER TRANSACTION: Moves the /// doc block to before [Transaction].

3. SERVICETYPE/TRANSACTION AFTER CLASS: These are secondary classes in the
   same file -- skipped (not a real issue for the generator).

DRY RUN by default. Pass --apply to write.
"""
import argparse
import re
import sys
from pathlib import Path

EXCLUDE_DIRS = {"bin", "obj", ".vs", ".backups", "Tracking", "node_modules"}

RE_TRANSACTION = re.compile(r"\[Transaction\(")
RE_CLASS_LINE = re.compile(r"^(\s*)(public\s+(?:sealed\s+)?(?:abstract\s+)?class\s+(\w+))", re.MULTILINE)


def fix_usedimplicitly_before_summary(text: str) -> tuple:
    """Move [UsedImplicitly] from before /// <summary> to after the doc block."""
    changes = []
    
    # Find pattern: [UsedImplicitly]\n    /// <summary>...
    pattern = re.compile(
        r'([ \t]*)\[UsedImplicitly\]\s*\n'
        r'((?:[ \t]*///[^\n]*\n)+)',  # doc comment block
        re.MULTILINE
    )
    
    m = pattern.search(text)
    if m:
        indent = m.group(1)
        doc_block = m.group(2)
        # Replace: put doc block first, then [UsedImplicitly]
        replacement = doc_block + f'{indent}[UsedImplicitly]\n'
        text = text[:m.start()] + replacement + text[m.end():]
        changes.append("Moved [UsedImplicitly] after doc block")
    
    return text, changes


def fix_summary_after_transaction(text: str) -> tuple:
    """Move doc block from after [Transaction] to before it."""
    changes = []
    lines = text.split('\n')
    
    # Find the first [Transaction] that's before a class
    m_class = RE_CLASS_LINE.search(text)
    if not m_class:
        return text, changes
    
    class_line_num = text[:m_class.start()].count('\n')
    
    # Find [Transaction] line before class
    tx_line = None
    for i, line in enumerate(lines):
        if i < class_line_num and '[Transaction(' in line and not line.strip().startswith('///'):
            tx_line = i
            break
    
    if tx_line is None:
        return text, changes
    
    # Check if there's a doc block AFTER [Transaction] but before class
    doc_start = None
    doc_end = None
    for i in range(tx_line + 1, class_line_num + 1):
        if lines[i].strip().startswith('/// <summary>'):
            doc_start = i
        if doc_start is not None and (lines[i].strip().startswith('/// </') or
            (not lines[i].strip().startswith('///') and not lines[i].strip() == '' and doc_start is not None)):
            doc_end = i
            break
    
    if doc_start is None:
        return text, changes
    
    # Find the full doc block (all consecutive /// lines)
    block_start = doc_start
    block_end = doc_start
    for i in range(doc_start, min(class_line_num + 1, len(lines))):
        if lines[i].strip().startswith('///') or lines[i].strip() == '':
            block_end = i
        else:
            break
    
    # Extract the doc block lines
    doc_lines = lines[block_start:block_end + 1]
    
    # Remove from current position
    new_lines = lines[:block_start] + lines[block_end + 1:]
    
    # Find where to insert (before [Transaction])
    insert_at = tx_line
    if block_start < tx_line:
        # Adjust since we removed lines before tx
        insert_at = tx_line - len(doc_lines)
    
    # Re-find [Transaction] in new_lines
    for i, line in enumerate(new_lines):
        if '[Transaction(' in line and not line.strip().startswith('///'):
            insert_at = i
            break
    
    # Insert before [Transaction]
    new_lines = new_lines[:insert_at] + doc_lines + new_lines[insert_at:]
    
    text = '\n'.join(new_lines)
    changes.append("Moved doc block before [Transaction]")
    
    return text, changes


def process_file(file_path: Path, apply: bool) -> dict:
    text = file_path.read_text(encoding="utf-8", errors="replace")
    if not RE_TRANSACTION.search(text):
        return None
    
    m_class = RE_CLASS_LINE.search(text)
    if not m_class:
        return None
    
    cls = m_class.group(3)
    all_changes = []
    new_text = text
    
    # Fix 1: [UsedImplicitly] before summary
    new_text, ch = fix_usedimplicitly_before_summary(new_text)
    all_changes.extend(ch)
    
    # Fix 2: Summary after transaction
    new_text, ch = fix_summary_after_transaction(new_text)
    all_changes.extend(ch)
    
    if not all_changes:
        return {"class": cls, "changes": [], "status": "ok"}
    
    result = {"class": cls, "changes": all_changes, "status": "fixed"}
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
        print("DRY RUN\n")

    files = sorted(p for p in args.scan.rglob("*.cs")
                   if not any(part in EXCLUDE_DIRS for part in p.parts))

    fixed = 0
    for f in files:
        try:
            r = process_file(f, args.apply)
            if r and r["status"] == "fixed":
                fixed += 1
                ch = "; ".join(r["changes"])
                w = "[WRITTEN]" if r.get("written") else "[dry-run]"
                print(f"  {r['class']:<55} {ch} {w}")
        except Exception as e:
            print(f"  ERROR {f.name}: {e}", file=sys.stderr)

    print(f"\nFixed: {fixed}")
    if not args.apply and fixed > 0:
        print("Pass --apply to write.")


if __name__ == "__main__":
    main()
