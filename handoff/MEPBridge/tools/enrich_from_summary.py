#!/usr/bin/env python3
"""
enrich_from_summary.py
======================
Reads each [Transaction] class's <summary> and generates COMMAND-SPECIFIC:
  - <usecase>   derived from the actual summary text
  - <precondition>  derived from hints in the summary (parameters, prereqs)
  - <aiprompts>  with thinking steps that reflect the real workflow

This does NOT use pillar templates. Every command gets unique content
derived from its own summary.

DRY RUN by default. Pass --apply to write.
"""
import argparse
import re
import sys
from pathlib import Path

EXCLUDE_DIRS = {"bin", "obj", ".vs", ".backups", "Tracking", "node_modules"}

RE_TRANSACTION = re.compile(r"\[Transaction\(")
RE_CLASS_NAME = re.compile(r"public\s+(?:sealed\s+)?(?:abstract\s+)?class\s+(\w+)\s*[:\s{]")
RE_SUMMARY_TAG = re.compile(r"<summary>(.*?)</summary>", re.DOTALL)
RE_USECASE_TAG = re.compile(r"<usecase>")
RE_PRECONDITION_TAG = re.compile(r"<precondition>")
RE_AIPROMPTS_TAG = re.compile(r"<aiprompts>")
RE_NOTFOR_TAG = re.compile(r"<notfor>(.*?)</notfor>", re.DOTALL)


def clean_xml(raw: str) -> str:
    cleaned = re.sub(r"^\s*///\s?", "", raw, flags=re.MULTILINE)
    cleaned = re.sub(r"<see\s+cref=\"([^\"]+)\"\s*/>", r"\1", cleaned)
    cleaned = re.sub(r"<[^>]+>", "", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned)
    return cleaned.strip()


def humanize(name: str) -> str:
    for s in ("Command", "ExternalCommand"):
        if name.endswith(s):
            name = name[:-len(s)]
    words = re.findall(r'[A-Z][a-z]+|[A-Z]+(?=[A-Z][a-z])|[A-Z]+$|[a-z]+|\d+', name)
    return ' '.join(w.lower() for w in words)


def first_sentence(text: str) -> str:
    if not text:
        return ""
    m = re.match(r"(.*?[.!?])(?:\s+[A-Z]|\s*$)", text)
    return m.group(1).strip() if m else text[:200].strip()


def extract_workflow_steps(summary: str) -> list:
    """Extract numbered or bullet workflow steps from summary."""
    steps = []
    for m in re.finditer(r'(?:^|\s)(\d+)[.)]\s*([^.]+\.)', summary):
        steps.append(m.group(2).strip())
    if not steps:
        for m in re.finditer(r'(?:^|\s)-\s*([^.]+\.)', summary):
            steps.append(m.group(1).strip())
    return steps


def extract_params(summary: str) -> list:
    """Extract real parameter names mentioned in the summary (camelCase identifiers)."""
    params = []
    # Match explicit "orchestrated parameters: x, y"
    for m in re.finditer(r'orchestrated parameters?:?\s*([^.)]+)', summary, re.I):
        params.extend(re.findall(r'\b([a-z][a-zA-Z]{3,})\b', m.group(1)))
    # Match camelCase words that look like parameter names (min 5 chars)
    for m in re.finditer(r'\b([a-z][a-z]+[A-Z][a-zA-Z]{2,})\b', summary):
        params.append(m.group(1))
    return list(dict.fromkeys(params))[:5]


def extract_prereqs(summary: str) -> list:
    """Extract prerequisites mentioned in the summary."""
    prereqs = []
    for pattern in [
        r'[Rr]equires?\s+([^.]+\.)',
        r'[Mm]ust (?:have|be|exist|contain)\s+([^.]+\.)',
        r'[Nn]eeds?\s+([^.]+\.)',
        r'[Oo]nly works?\s+(?:when|if|on)\s+([^.]+\.)',
        r'[Pp]recondition:?\s*([^.]+\.)',
    ]:
        for m in re.finditer(pattern, summary):
            prereqs.append(m.group(1).strip())
    return prereqs


def extract_verbs(summary: str) -> list:
    """Extract the main action verbs/phrases from the summary."""
    verbs = []
    for m in re.finditer(
        r'\b(creates?|builds?|generates?|exports?|imports?|resolves?|finds?|'
        r'detects?|calculates?|validates?|checks?|reads?|writes?|loads?|'
        r'captures?|navigates?|cycles?|marks?|clears?|applies?|configures?|'
        r'updates?|deletes?|renames?|moves?|copies?|transfers?|isolates?|'
        r'sizes?|places?|routes?|extends?|connects?|tags?|dimensions?|'
        r'annotates?|snaps?|assigns?|sets?|runs?|executes?|launches?)\s+([^,.]+)',
        summary, re.I):
        verbs.append(f"{m.group(1)} {m.group(2)}".strip())
    return verbs[:5]


def derive_usecase(cls: str, summary: str, notfor: str) -> str:
    """Generate a usecase specific to this command's summary."""
    if not summary:
        human = humanize(cls)
        return f"AI orchestrator invokes this to {human}."

    first = first_sentence(summary)

    # Strip class name echo from start of summary
    cleaned = re.sub(r'^[\w]+Command\s*[-—]\s*', '', first)
    cleaned = re.sub(r'^Command:\s*', '', cleaned)
    cleaned = re.sub(r'^Phase \d+ Command:\s*', '', cleaned)
    cleaned = cleaned.strip()

    if not cleaned:
        cleaned = first

    # Make it read as a purpose statement
    lower = cleaned[0].lower() + cleaned[1:] if cleaned else ""
    return f"AI orchestrator invokes this to {lower}"


def derive_precondition(cls: str, summary: str) -> str:
    """Generate a precondition specific to this command's summary."""
    prereqs = extract_prereqs(summary)
    if prereqs:
        return ' '.join(prereqs[:2])

    params = extract_params(summary)
    hints = ["Active document must be open"]

    if re.search(r'(?:space|room|zone)', summary, re.I):
        hints.append("with spaces or rooms placed")
    if re.search(r'(?:sheet)', summary, re.I):
        hints.append("with sheets in the project")
    if re.search(r'(?:linked|link)', summary, re.I):
        hints.append("with linked models loaded")
    if re.search(r'(?:XML|JSON|csv|excel)', summary, re.I):
        hints.append("with the source data file accessible")
    if re.search(r'(?:select|selection)', summary, re.I):
        hints.append("with the target elements selected or identifiable")
    if re.search(r'(?:clash|QA\s+result)', summary, re.I):
        hints[0] = "Active document must be open and a clash/QA results set must exist"
    if re.search(r'(?:warning|log)', summary, re.I) and 'clash' not in summary.lower():
        hints[0] = "Revit session must be running"

    if params:
        param_str = ', '.join(params[:3])
        hints.append(f"with {param_str} parameters supplied")

    return '. '.join(hints) + '.'


def derive_aiprompts(cls: str, summary: str) -> str:
    """Generate command-specific aiprompts from the summary."""
    human = humanize(cls)
    cap_human = human[0].upper() + human[1:] if human else "Processing"

    first = first_sentence(summary) if summary else f"{cap_human}."

    # Strip class name echo from preprompt
    prep = re.sub(r'^[\w]+Command\s*[-—]\s*', '', first)
    prep = re.sub(r'^Command:\s*', '', prep)
    prep = re.sub(r'^Phase \d+ Command:\s*', '', prep)
    prep = prep.strip()[:120] if prep.strip() else f"{cap_human}..."

    # Thinking steps from sentences in the summary
    sentences = [s.strip() for s in re.split(r'(?<=[.!?])\s+', summary) if s.strip()]
    think_steps = []
    for sent in sentences[1:5]:
        cleaned = re.sub(r'^[\w]+Command\s*[-—]\s*', '', sent)
        cleaned = re.sub(r'^(?:IMPORTANT|WARNING|NOTE|WORKFLOW|FEATURES?)[:\s]*', '', cleaned, flags=re.I)
        cleaned = cleaned.strip()
        if len(cleaned) > 15:
            think_steps.append(cleaned[:120])

    if not think_steps:
        verbs = extract_verbs(summary)
        for v in verbs[:3]:
            cleaned = v.strip().capitalize()
            if len(cleaned) > 10:
                think_steps.append(cleaned[:120])

    if not think_steps:
        think_steps = [f"{cap_human}"]

    # Object noun for success message
    obj_match = re.search(
        r'\b(schedule|schematic|filter|template|view|sheet|section|'
        r'report|annotation|tag|dimension|family|workset|revision|'
        r'clash|opening|route|placement|system|parameter|warning|'
        r'element|region|line|image|snapshot|preset|standard|data|'
        r'calculation|result|model|space|room|pipe|duct|valve|'
        r'equipment|device|socket|light|grille|damper)\b',
        summary, re.I)
    obj_noun = obj_match.group(1).lower() if obj_match else "operation"

    succ = f"{cap_human} completed -- {obj_noun} ready."
    fail = f"Could not complete {human}: {{error}}"

    lines = [f"    /// <aiprompts>"]
    lines.append(f"    /// <preprompt>{prep}</preprompt>")
    for step in think_steps:
        step_clean = step.rstrip('.') + '...'
        lines.append(f"    /// <thinkingstep>{step_clean}</thinkingstep>")
    lines.append(f"    /// <successprompt>{succ}</successprompt>")
    lines.append(f"    /// <failureprompt>{fail}</failureprompt>")
    lines.append(f"    /// </aiprompts>")
    return '\n'.join(lines)


def process_file(file_path: Path, apply: bool) -> dict:
    text = file_path.read_text(encoding="utf-8", errors="replace")
    if not RE_TRANSACTION.search(text):
        return None
    m_class = RE_CLASS_NAME.search(text)
    if not m_class:
        return None

    cls = m_class.group(1)

    m_sum = RE_SUMMARY_TAG.search(text)
    summary = clean_xml(m_sum.group(1)) if m_sum else ""

    m_nf = RE_NOTFOR_TAG.search(text)
    notfor = clean_xml(m_nf.group(1)) if m_nf else ""

    changes = []
    new_text = text
    tags_to_add = []

    if not RE_USECASE_TAG.search(text):
        uc = derive_usecase(cls, summary, notfor)
        tags_to_add.append(f"    /// <usecase>{uc}</usecase>")
        changes.append("Added <usecase>")

    if not RE_PRECONDITION_TAG.search(text):
        pc = derive_precondition(cls, summary)
        tags_to_add.append(f"    /// <precondition>{pc}</precondition>")
        changes.append("Added <precondition>")

    if not RE_AIPROMPTS_TAG.search(text):
        ap = derive_aiprompts(cls, summary)
        tags_to_add.append(ap)
        changes.append("Added <aiprompts>")

    if not changes:
        return {"class": cls, "changes": [], "status": "complete"}

    insert_block = '\n'.join(tags_to_add) + '\n'

    summary_end = re.search(r"(///\s*</summary>\s*\n)", new_text)
    if summary_end:
        insert_pos = summary_end.end()
        new_text = new_text[:insert_pos] + insert_block + new_text[insert_pos:]
    else:
        tx = re.search(r"\n(\s*\[(?:ServiceType|Transaction)\()", new_text)
        if tx:
            insert_pos = tx.start() + 1
            new_text = new_text[:insert_pos] + insert_block + new_text[insert_pos:]

    result = {"class": cls, "changes": changes, "status": "updated"}
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
    ap.add_argument("--sample", type=int, default=0,
                    help="Print N sample outputs for review")
    args = ap.parse_args()

    if not args.apply:
        print("=" * 60)
        print("  DRY RUN -- pass --apply to write")
        print("=" * 60)
        print()

    files = sorted(p for p in args.scan.rglob("*.cs")
                   if not any(part in EXCLUDE_DIRS for part in p.parts))

    stats = {"updated": 0, "complete": 0, "errors": 0,
             "uc": 0, "pc": 0, "ap": 0}
    results = []
    samples = []

    for f in files:
        try:
            r = process_file(f, args.apply)
            if r is None or r["status"] == "complete":
                if r:
                    stats["complete"] += 1
                continue
            stats["updated"] += 1
            results.append(r)
            for c in r["changes"]:
                if "usecase" in c: stats["uc"] += 1
                elif "precondition" in c: stats["pc"] += 1
                elif "aiprompts" in c: stats["ap"] += 1

            if args.sample and len(samples) < args.sample:
                text = f.read_text(encoding="utf-8", errors="replace")
                m_sum = RE_SUMMARY_TAG.search(text)
                summary = clean_xml(m_sum.group(1)) if m_sum else ""
                cls = r["class"]
                samples.append({
                    "class": cls,
                    "summary": summary[:200],
                    "usecase": derive_usecase(cls, summary, ""),
                    "precondition": derive_precondition(cls, summary),
                })
        except Exception as e:
            stats["errors"] += 1
            print(f"  ERROR {f.name}: {e}", file=sys.stderr)

    print(f"Updated:           {stats['updated']}")
    print(f"Already complete:  {stats['complete']}")
    print(f"Errors:            {stats['errors']}")
    print(f"  Usecases:        {stats['uc']}")
    print(f"  Preconditions:   {stats['pc']}")
    print(f"  AI prompts:      {stats['ap']}")

    if samples:
        print(f"\n{'=' * 60}")
        print(f"  SAMPLE OUTPUTS (review for quality)")
        print(f"{'=' * 60}")
        for s in samples:
            print(f"\n  CLASS: {s['class']}")
            print(f"  SUMMARY: {s['summary']}")
            print(f"  -> USECASE: {s['usecase']}")
            print(f"  -> PRECOND: {s['precondition']}")

    if not args.apply:
        print("\nPass --apply to write.")


if __name__ == "__main__":
    main()
