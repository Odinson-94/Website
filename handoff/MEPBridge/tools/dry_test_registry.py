#!/usr/bin/env python3
"""
dry_test_registry.py
====================
Reads the existing command_registry.json and grades every class on how
"website-ready" it is.  Reports:

  1. Per-class pass / partial / fail with missing fields
  2. Aggregate coverage stats per field
  3. Top issues blocking auto-generation

USAGE
-----
    py -3 handoff/MEPBridge/tools/dry_test_registry.py
"""
import json, sys
from pathlib import Path
from collections import Counter

SCRIPT_DIR = Path(__file__).parent.resolve()
WEBSITE_ROOT = SCRIPT_DIR.parent.parent.parent
REGISTRY = WEBSITE_ROOT / "data" / "registries" / "command_registry.json"

CRITICAL_FIELDS = ["summary", "desc", "keywords"]
IMPORTANT_FIELDS = ["usecase", "pillar", "aiprompts", "precondition"]
NICE_TO_HAVE = [
    "notfor", "postcondition", "sideeffects", "logictree",
    "intent_patterns", "selection_inputs", "config_inputs",
    "outputs", "related_commands", "has_restapi",
]
NEW_WEBSITE_FIELDS = ["pillar", "pillar_raw"]

ALL_GRADED = CRITICAL_FIELDS + IMPORTANT_FIELDS + NICE_TO_HAVE


def is_populated(val):
    if val is None:
        return False
    if isinstance(val, str):
        return len(val.strip()) > 0
    if isinstance(val, (list, dict)):
        return len(val) > 0
    if isinstance(val, bool):
        return val
    return True


def grade(cmd: dict) -> dict:
    missing_critical = [f for f in CRITICAL_FIELDS if not is_populated(cmd.get(f))]
    missing_important = [f for f in IMPORTANT_FIELDS if not is_populated(cmd.get(f))]
    missing_nice = [f for f in NICE_TO_HAVE if not is_populated(cmd.get(f))]

    populated_count = sum(1 for f in ALL_GRADED if is_populated(cmd.get(f)))
    total = len(ALL_GRADED)

    if not missing_critical and not missing_important:
        status = "PASS"
    elif not missing_critical:
        status = "PARTIAL"
    else:
        status = "FAIL"

    return {
        "class": cmd["class"],
        "status": status,
        "score": populated_count,
        "max": total,
        "pct": round(100 * populated_count / total),
        "missing_critical": missing_critical,
        "missing_important": missing_important,
        "missing_nice": missing_nice,
    }


def main():
    if not REGISTRY.exists():
        print(f"ERROR: {REGISTRY} not found", file=sys.stderr)
        sys.exit(1)

    raw = json.loads(REGISTRY.read_text(encoding="utf-8"))
    commands = raw["commands"] if isinstance(raw, dict) and "commands" in raw else raw
    print(f"Loaded {len(commands)} commands from {REGISTRY.name}\n")

    results = [grade(c) for c in commands]

    pass_count = sum(1 for r in results if r["status"] == "PASS")
    partial_count = sum(1 for r in results if r["status"] == "PARTIAL")
    fail_count = sum(1 for r in results if r["status"] == "FAIL")

    print("=" * 80)
    print("  SUMMARY")
    print("=" * 80)
    print(f"  PASS    (all critical + important filled):  {pass_count:>4}  ({100*pass_count//len(commands)}%)")
    print(f"  PARTIAL (critical OK, some important gap):  {partial_count:>4}  ({100*partial_count//len(commands)}%)")
    print(f"  FAIL    (missing critical fields):          {fail_count:>4}  ({100*fail_count//len(commands)}%)")
    print(f"  TOTAL                                       {len(commands):>4}")
    print()

    field_pop = Counter()
    for c in commands:
        for f in ALL_GRADED:
            if is_populated(c.get(f)):
                field_pop[f] += 1

    print("=" * 80)
    print("  FIELD COVERAGE (across all 163 commands)")
    print("=" * 80)
    print(f"  {'Field':<22} {'Populated':>10} {'Missing':>10} {'Coverage':>10}  Tier")
    print(f"  {'-'*22} {'-'*10} {'-'*10} {'-'*10}  ----")
    for f in CRITICAL_FIELDS + IMPORTANT_FIELDS + NICE_TO_HAVE:
        pop = field_pop.get(f, 0)
        miss = len(commands) - pop
        pct = 100 * pop // len(commands)
        tier = "CRITICAL" if f in CRITICAL_FIELDS else ("IMPORTANT" if f in IMPORTANT_FIELDS else "nice-to-have")
        bar = "#" * (pct // 5) + "." * (20 - pct // 5)
        print(f"  {f:<22} {pop:>10} {miss:>10} {pct:>9}%  {tier}  {bar}")
    print()

    print("=" * 80)
    print("  CLASSES THAT FAIL (missing critical fields)")
    print("=" * 80)
    fails = [r for r in results if r["status"] == "FAIL"]
    if not fails:
        print("  None - all classes have critical fields!")
    else:
        for r in sorted(fails, key=lambda r: r["pct"]):
            print(f"  FAIL  {r['class']:<50} score={r['score']}/{r['max']} ({r['pct']}%)  missing: {', '.join(r['missing_critical'])}")
    print()

    print("=" * 80)
    print("  CLASSES THAT PASS (website-ready)")
    print("=" * 80)
    passes = [r for r in results if r["status"] == "PASS"]
    if not passes:
        print("  None yet.")
    else:
        for r in sorted(passes, key=lambda r: -r['pct']):
            print(f"  PASS  {r['class']:<50} score={r['score']}/{r['max']} ({r['pct']}%)")
    print()

    print("=" * 80)
    print("  PARTIAL CLASSES (critical OK, missing important)")
    print("=" * 80)
    partials = [r for r in results if r["status"] == "PARTIAL"]
    if not partials:
        print("  None.")
    else:
        for r in sorted(partials, key=lambda r: -r['pct']):
            gaps = r["missing_important"]
            print(f"  PARTIAL  {r['class']:<47} score={r['score']}/{r['max']} ({r['pct']}%)  gaps: {', '.join(gaps)}")
    print()

    pillar_counter = Counter()
    for c in commands:
        p = c.get("pillar", "").strip() or "(empty)"
        pillar_counter[p] += 1
    print("=" * 80)
    print("  PILLAR DISTRIBUTION")
    print("=" * 80)
    for pillar, count in pillar_counter.most_common():
        bar = "#" * count
        print(f"  {pillar:<30} {count:>4}  {bar}")
    print()

    aiprompts_quality = {"full": 0, "partial": 0, "none": 0}
    for c in commands:
        ap = c.get("aiprompts")
        if not ap:
            aiprompts_quality["none"] += 1
        else:
            has_pre = bool(ap.get("preprompts"))
            has_think = bool(ap.get("thinkingsteps"))
            has_success = bool(ap.get("successprompts"))
            if has_pre and has_think and has_success:
                aiprompts_quality["full"] += 1
            else:
                aiprompts_quality["partial"] += 1

    print("=" * 80)
    print("  AI PROMPTS QUALITY")
    print("=" * 80)
    for k, v in aiprompts_quality.items():
        print(f"  {k:<12} {v:>4}  ({100*v//len(commands)}%)")
    print()

    summary_lengths = [len(c.get("summary", "")) for c in commands]
    desc_lengths = [len(c.get("desc", "")) for c in commands]
    short_summaries = [c["class"] for c in commands if len(c.get("summary", "")) < 50]
    print("=" * 80)
    print("  CONTENT QUALITY")
    print("=" * 80)
    print(f"  Summary lengths:  min={min(summary_lengths)}  avg={sum(summary_lengths)//len(commands)}  max={max(summary_lengths)}")
    print(f"  Desc lengths:     min={min(desc_lengths)}  avg={sum(desc_lengths)//len(commands)}  max={max(desc_lengths)}")
    if short_summaries:
        print(f"  Short summaries (<50 chars): {len(short_summaries)} classes:")
        for s in short_summaries[:15]:
            print(f"    - {s}")
        if len(short_summaries) > 15:
            print(f"    ... and {len(short_summaries) - 15} more")
    print()

    no_inputs = [c["class"] for c in commands
                 if not c.get("selection_inputs") and not c.get("config_inputs")]
    print("=" * 80)
    print("  COMMANDS WITH NO INPUTS DECLARED")
    print("=" * 80)
    print(f"  {len(no_inputs)} of {len(commands)} commands have zero inputs:")
    for n in no_inputs[:20]:
        print(f"    - {n}")
    if len(no_inputs) > 20:
        print(f"    ... and {len(no_inputs) - 20} more")
    print()

    print("=" * 80)
    print("  TOP BLOCKING ISSUES FOR WEBSITE AUTO-GENERATION")
    print("=" * 80)
    issue_counter = Counter()
    for r in results:
        for f in r["missing_critical"]:
            issue_counter[f"CRITICAL missing: {f}"] += 1
        for f in r["missing_important"]:
            issue_counter[f"IMPORTANT missing: {f}"] += 1
    for issue, count in issue_counter.most_common(15):
        print(f"  {count:>4}x  {issue}")


if __name__ == "__main__":
    main()
