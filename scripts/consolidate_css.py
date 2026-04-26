#!/usr/bin/env python3
"""
scripts/consolidate_css.py
==========================

CSS consolidator. Builds on the MEPBridge approach (class-prefix
classification + per-bucket migration) and adds two big wins:

  • BODY DEDUPLICATION
      When N rules have identical declaration blocks, collapse them into
      ONE rule with a comma-joined selector list. Typically halves a CSS
      file. Example:

          .demo-msg-user { padding: 12px 14px; border-radius: 10px; }
          .demo-msg-bot  { padding: 12px 14px; border-radius: 10px; }
              ↓ becomes ↓
          .demo-msg-user, .demo-msg-bot { padding: 12px 14px; border-radius: 10px; }

  • CROSS-FILE DUPLICATE DETECTION
      Catches files that are stale copies of other files (e.g.
      chat-panel/index-styles.css is mostly a copy of css/index-styles.css).
      Reports overlap percentage and pinpoints unique-to-each rules so
      you can safely delete one side.

WHAT IT DOES (in order)

  1. Parse every CSS file in --inputs (with parse_css from audit_css.py).
  2. Classify every rule by selector into a bucket:
        chat      — chat UI (.demo-chat-*, .chat-*, .demo-msg-*, ...)
        shared    — site-wide brand, typography, dark mode, layout
        sandbox   — sandbox-only chrome (.docs-layout, .sandbox-*)
        page      — page-specific rules (one HTML file owner)
        generic   — html/body/* and unclassifiable
  3. For each bucket, dedupe identical bodies (merge selectors).
  4. Compare files pairwise — report which file is largely a copy of
     another and which selectors are unique to each.
  5. (--write) emit consolidated bundles to css/_consolidated/:
        chat.css      shared.css      sandbox.css      page-<slug>.css

  6. Print a summary: rule counts before/after, % saved, dupes merged.

USAGE

    # Audit-only (default): write the report, don't touch any source CSS
    python scripts/consolidate_css.py

    # Same plus emit consolidated bundles to css/_consolidated/
    python scripts/consolidate_css.py --write

    # Compare two files and report overlap
    python scripts/consolidate_css.py --compare \\
        css/index-styles.css chat-panel/index-styles.css

Pure stdlib. Reuses the parser and specificity logic from audit_css.py
(imported as a module).
"""

from __future__ import annotations

import argparse
import hashlib
import io
import re
import sys
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from pathlib import Path

# Force UTF-8 stdout on Windows
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

# Import the parser + helpers from the existing audit_css.py instead of
# duplicating them. They live in the same scripts/ folder.
sys.path.insert(0, str(Path(__file__).parent))
from audit_css import (
    CssRule,
    parse_css,
    css_specificity,
    _split_selectors,
    _CLASS_RE,
    _ID_RE,
)

# =============================================================================
# CLASSIFICATION — bucket selectors by intended owner
# =============================================================================

# Class name prefixes that belong to each bucket. Order matters — the FIRST
# bucket whose prefix list matches a class name wins. Inspired by
# MEPBridge/tools/find_orphan_css.py but extended for the sandbox repo.
BUCKETS: dict[str, list[str]] = {
    "chat": [
        # in-app chat UI from /index.html SPA + chat-panel/chat-panel.html
        "demo-chat", "demo-msg", "demo-history", "demo-ready", "demo-view-overlay",
        "demo-revit", "demo-image", "demo-containers", "demo-text", "demo-split",
        "demo-titlebar", "demo-outputs", "demo-ribbon", "demo-design-",
        "chat-", "msg-", "user-msg", "assistant-", "bot-message", "user-message",
        "thinking-", "thinking_", "thinking", "tool-", "tool_call",
        "neural", "node-", "node_",
        "skill-palette", "mention-palette", "agent-",
        "sidebar-tab", "sidebar-panel", "sidebar-footer", "sidebar-",
        "design-option", "design-tab", "design-tabs",
        "share-chat", "new-agent", "qa-", "session-", "queued-", "message-queue",
        "drag-overlay", "chat-toast", "branch-", "grind-", "token-", "feedback",
        "review-panel", "code-block", "shimmer", "cursor-style",
        "open-chat", "buildx-warmup", "mode-", "model-", "llm-",
        "chat-persistent", "chat-input", "chat-send", "chat-share",
        "chat-meeting", "chat-sidebar", "chat-composer", "chat-agent",
        "chat-model", "chat-dropdown", "chat-node", "chat-thinking",
        "chat-history", "chat-files", "chat-neural",
        "thinking-container", "thinking-header", "steps-list", "step-icon",
        "step-content", "step-text", "step-changes",
        "pulsing-node", "steps-count", "steps-toggle",
        "specbuilder", "spec-",
    ],
    "sandbox": [
        # sandbox preview chrome — only loaded by /sandbox/ and /dist/ pages
        "docs-layout", "docs-content", "docs-left", "docs-right", "docs-",
        "sandbox-", "home-no-rails", "home-summary", "home-section", "home-hero",
        "hero-stage", "hero-kicker", "hero-text-container",
        "draggable-chat", "drag-handle",
        "bundle-", "banner-card", "logo-tile", "feat-", "inner-card",
        "row-2up", "row-3up",
        "ic-", "ic-glyph", "scene-3d", "scene-modal",
        "tone-", "btn-primary", "btn-secondary", "end-cta",
    ],
    "shared": [
        # site-wide layout, brand, dark mode, footer, menubar
        "menubar", "menu-", "menu-tail", "menu-highlight", "menu-link",
        "logo", "hamburger", "mobile-menu", "section-indicator", "section-",
        "section-active-ball", "section-trail-ball", "section-dot",
        "dark-toggle", "toggle-switch", "toggle-slider",
        "color-palette", "color-swatch", "more-colors",
        "right-panel", "panel-content", "panel-",
        "footer-", "sandbox-footer",
        "brain-", "brain-overlay", "overlay-nodes",
        "project-complete",
        "favicon-",
        "ai", "accent",
        "ribbon-", "v8-", "v8_", "v6-", "v6_", "v7-", "v7_",
        "buildx-", "build-", "brand-",
    ],
    # everything else falls into "page" (page-specific) or "generic"
    # (tag-only / global *)
}

# Friendly names for the bucket emit files
BUCKET_OUT_NAMES = {
    "chat":    "chat.css",
    "shared":  "shared.css",
    "sandbox": "sandbox.css",
}


def classify_rule(selector: str) -> str:
    """Return one of: chat, sandbox, shared, page, generic."""
    classes = [c[1:] for c in _CLASS_RE.findall(selector)]
    if not classes and not _ID_RE.search(selector):
        return "generic"  # html, body, *, p, h1 …
    for bucket, prefixes in BUCKETS.items():
        for c in classes:
            for prefix in prefixes:
                if c == prefix or c.startswith(prefix):
                    return bucket
    return "page"


# =============================================================================
# DEDUPLICATION — merge rules with identical declaration blocks
# =============================================================================


def body_signature(rule: CssRule) -> str:
    """Stable hash of a rule's declaration block. Two rules with the same
    signature can be merged into one rule with a comma-joined selector."""
    # sort property names so order doesn't matter; serialize value+!important
    parts = []
    for prop in sorted(rule.properties):
        info = rule.properties[prop]
        imp = " !important" if info["important"] else ""
        parts.append(f"{prop}:{info['value']}{imp}")
    payload = ";".join(parts) + f"|@{rule.media}"
    return hashlib.sha1(payload.encode("utf-8")).hexdigest()


def dedupe_within_bucket(rules: list[CssRule]) -> tuple[list[list[CssRule]], int]:
    """Group rules with identical bodies (and same media context).
    Returns (groups, merged_savings). Each group is a list of rules that
    can be collapsed into one combined-selector rule."""
    by_sig: dict[str, list[CssRule]] = defaultdict(list)
    for r in rules:
        if not r.properties:
            continue
        by_sig[body_signature(r)].append(r)
    groups = list(by_sig.values())
    # savings = N rules → 1 rule; sum (N-1) for groups with N > 1
    saved = sum(len(g) - 1 for g in groups if len(g) > 1)
    return groups, saved


# =============================================================================
# CROSS-FILE OVERLAP — detect stale copies between two files
# =============================================================================


def file_overlap(rules_a: list[CssRule], rules_b: list[CssRule]) -> dict:
    """Pairwise comparison. Returns dict with:
       same: rules with identical (selector + body)
       same_sel_diff_body: same selector, different declarations (drift)
       only_in_a, only_in_b
    """
    def key(r): return (r.selector, body_signature(r))
    map_a = {key(r): r for r in rules_a}
    map_b = {key(r): r for r in rules_b}
    keys_a = set(map_a)
    keys_b = set(map_b)

    same_keys = keys_a & keys_b
    only_a = keys_a - keys_b
    only_b = keys_b - keys_a

    # selectors in both files but with drifted bodies
    sel_to_keys_a = defaultdict(list)
    sel_to_keys_b = defaultdict(list)
    for k in keys_a: sel_to_keys_a[k[0]].append(k)
    for k in keys_b: sel_to_keys_b[k[0]].append(k)
    drifted = []
    for sel in set(sel_to_keys_a) & set(sel_to_keys_b):
        bodies_a = {k[1] for k in sel_to_keys_a[sel]}
        bodies_b = {k[1] for k in sel_to_keys_b[sel]}
        if bodies_a != bodies_b:
            drifted.append(sel)

    return {
        "same": same_keys,
        "drifted_selectors": drifted,
        "only_in_a": only_a,
        "only_in_b": only_b,
        "total_a": len(rules_a),
        "total_b": len(rules_b),
    }


# =============================================================================
# EMIT — write a consolidated bucket file
# =============================================================================


def serialize_group(group: list[CssRule]) -> str:
    """Render a deduped group as `sel1, sel2, ... { props }`.
    All rules in `group` share the same body signature, so we can pick
    any one for the property block."""
    selectors = sorted({r.selector for r in group})
    head = group[0]
    decl_lines = []
    for prop in sorted(head.properties):
        info = head.properties[prop]
        imp = " !important" if info["important"] else ""
        decl_lines.append(f"  {prop}: {info['value']}{imp};")
    sels_text = ",\n".join(selectors)
    media = head.media
    body = "{\n" + "\n".join(decl_lines) + "\n}"
    if media:
        # render @media wrapper, indenting body
        inner = "\n".join("  " + l for l in (sels_text + " " + body).splitlines())
        return f"{media} {{\n{inner}\n}}"
    return f"{sels_text} {body}"


def write_bundle(bucket: str, groups: list[list[CssRule]], out_dir: Path) -> Path:
    """Write all merged groups for a bucket as one .css file. Sources are
    listed in a leading comment so you can see what was merged in."""
    out_path = out_dir / BUCKET_OUT_NAMES.get(bucket, f"{bucket}.css")
    out_path.parent.mkdir(parents=True, exist_ok=True)

    sources = sorted({r.source.rsplit(":", 1)[0] for g in groups for r in g})
    header = (
        f"/*\n"
        f" * {out_path.name}  ·  AUTO-GENERATED by scripts/consolidate_css.py\n"
        f" *\n"
        f" * Bucket: {bucket}\n"
        f" * Rules in source files: {sum(len(g) for g in groups)}\n"
        f" * Rules after dedup:     {len(groups)}\n"
        f" * Source files merged:\n"
        + "".join(f" *   - {s}\n" for s in sources)
        + " */\n\n"
    )

    body_chunks = []
    # sort groups by ascending specificity, then by first-seen source for
    # deterministic output (cascade order matters — lower specificity
    # rules go first so they can be overridden later in the file)
    def sort_key(g):
        spec = g[0].specificity
        first_src = min(r.source for r in g)
        return (spec, first_src)
    for g in sorted(groups, key=sort_key):
        body_chunks.append(serialize_group(g))

    out_path.write_text(header + "\n\n".join(body_chunks) + "\n", encoding="utf-8")
    return out_path


# =============================================================================
# MAIN
# =============================================================================


def main() -> int:
    p = argparse.ArgumentParser(
        description="Classify, dedupe and split CSS into clean bundles.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    p.add_argument("--root", type=Path, default=Path.cwd())
    p.add_argument(
        "--inputs", nargs="*",
        default=[
            "css/shared-styles.css",
            "css/index-styles.css",
            "css/chat-panel.css",
            "css/thinking-animation.css",
            "css/clash-manager.css",
            "sandbox/sandbox.css",
            "chat-panel/css/chat-panel.css",
            "chat-panel/css/thinking-animation.css",
            "chat-panel/index-styles.css",
            "chat-panel/shared-styles.css",
            "chat-panel/thinking-animation.css",
        ],
        help="CSS files to consolidate (relative to --root)",
    )
    p.add_argument("--out-dir", type=Path, default=Path("css/_consolidated"),
                   help="Where to write bundles when --write")
    p.add_argument("--write", action="store_true",
                   help="Emit consolidated bundles. Without this, audit-only.")
    p.add_argument("--report", type=Path, default=Path("consolidation-report.md"),
                   help="Markdown report path")
    p.add_argument("--compare", nargs=2, metavar=("FILE_A", "FILE_B"),
                   help="Pairwise overlap comparison between two files; "
                        "skips full consolidation")
    args = p.parse_args()

    root: Path = args.root.resolve()

    # ── COMPARE MODE ──────────────────────────────────────────────────────
    if args.compare:
        a, b = (root / args.compare[0]), (root / args.compare[1])
        for f in (a, b):
            if not f.exists():
                print(f"missing: {f}", file=sys.stderr)
                return 1
        rules_a = parse_css(a.read_text(encoding="utf-8"), str(a.relative_to(root)))
        rules_b = parse_css(b.read_text(encoding="utf-8"), str(b.relative_to(root)))
        ov = file_overlap(rules_a, rules_b)
        print(f"\nFile A: {args.compare[0]}  ({ov['total_a']} rules)")
        print(f"File B: {args.compare[1]}  ({ov['total_b']} rules)")
        print(f"  Identical (selector + body):  {len(ov['same'])}")
        print(f"  Same selector, drifted body:  {len(ov['drifted_selectors'])}")
        print(f"  Only in A:                    {len(ov['only_in_a'])}")
        print(f"  Only in B:                    {len(ov['only_in_b'])}")
        if ov["total_a"]:
            pct_a = 100.0 * len(ov["same"]) / ov["total_a"]
            print(f"  → {pct_a:.0f}% of A is identical to B")
        if ov["total_b"]:
            pct_b = 100.0 * len(ov["same"]) / ov["total_b"]
            print(f"  → {pct_b:.0f}% of B is identical to A")
        if ov["drifted_selectors"]:
            print(f"\nFirst 20 drifted selectors (need manual reconcile):")
            for s in sorted(ov["drifted_selectors"])[:20]:
                print(f"  {s}")
        return 0

    # ── FULL CONSOLIDATION ────────────────────────────────────────────────
    files: list[Path] = []
    for rel in args.inputs:
        f = root / rel
        if not f.exists():
            print(f"  ! missing input: {rel}", file=sys.stderr)
            continue
        files.append(f)
    if not files:
        print("No input files found.", file=sys.stderr)
        return 1

    print(f"Parsing {len(files)} CSS files…")
    all_rules: list[CssRule] = []
    rules_per_file: dict[str, list[CssRule]] = {}
    for f in files:
        rels = f.relative_to(root).as_posix()
        rules = parse_css(f.read_text(encoding="utf-8"), rels)
        rules_per_file[rels] = rules
        all_rules.extend(rules)
    print(f"  {len(all_rules)} rules total ({sum(1 for r in all_rules if r.media)} inside @media)\n")

    # ── classify ─────────────────────────────────────────────────────────
    by_bucket: dict[str, list[CssRule]] = defaultdict(list)
    for r in all_rules:
        by_bucket[classify_rule(r.selector)].append(r)

    print("Bucket breakdown")
    print("─" * 60)
    bucket_total = 0
    for bucket in ("chat", "sandbox", "shared", "page", "generic"):
        n = len(by_bucket[bucket])
        bucket_total += n
        print(f"  {bucket:8s}  {n:5d} rules")
    print(f"  {'TOTAL':8s}  {bucket_total:5d} rules\n")

    # ── dedupe within each bucket ────────────────────────────────────────
    print("Dedup within each bucket (merge rules with identical bodies)")
    print("─" * 60)
    bucket_groups: dict[str, list[list[CssRule]]] = {}
    grand_saved = 0
    for bucket, rules in by_bucket.items():
        groups, saved = dedupe_within_bucket(rules)
        bucket_groups[bucket] = groups
        grand_saved += saved
        before = sum(len(g) for g in groups)
        after = len(groups)
        if before:
            print(f"  {bucket:8s}  {before:5d} → {after:5d}  "
                  f"({saved:4d} merged, "
                  f"{100*saved/before:.0f}% saved)")
    print(f"\n  TOTAL MERGED: {grand_saved} rules eliminated by body-dedup\n")

    # ── pairwise file overlap (catch stale copies) ───────────────────────
    print("Pairwise file overlap (looking for stale copies)")
    print("─" * 60)
    overlap_pairs = []
    file_names = list(rules_per_file)
    for i, a in enumerate(file_names):
        for b in file_names[i+1:]:
            ov = file_overlap(rules_per_file[a], rules_per_file[b])
            if not ov["total_a"] or not ov["total_b"]:
                continue
            pct_a = 100.0 * len(ov["same"]) / ov["total_a"]
            pct_b = 100.0 * len(ov["same"]) / ov["total_b"]
            if pct_a >= 30 or pct_b >= 30:  # report any meaningful overlap
                overlap_pairs.append((a, b, ov, pct_a, pct_b))
    overlap_pairs.sort(key=lambda x: -max(x[3], x[4]))
    for a, b, ov, pa, pb in overlap_pairs[:20]:
        print(f"  {a}")
        print(f"  {b}")
        print(f"    {len(ov['same'])} identical · "
              f"{len(ov['drifted_selectors'])} drifted · "
              f"{len(ov['only_in_a'])} only-A · "
              f"{len(ov['only_in_b'])} only-B")
        print(f"    A is {pa:.0f}% in B   ·   B is {pb:.0f}% in A\n")

    # ── write report ─────────────────────────────────────────────────────
    report = build_report(rules_per_file, by_bucket, bucket_groups, overlap_pairs)
    args.report.write_text(report, encoding="utf-8")
    print(f"Report written to {args.report}")

    # ── optional: write the consolidated bundles ─────────────────────────
    if args.write:
        out_dir = root / args.out_dir
        print(f"\nWriting consolidated bundles to {out_dir.relative_to(root)}/")
        for bucket in ("chat", "sandbox", "shared"):
            groups = bucket_groups.get(bucket, [])
            if not groups:
                continue
            out = write_bundle(bucket, groups, out_dir)
            size_kb = out.stat().st_size / 1024
            print(f"  ✓ {out.relative_to(root).as_posix()}  "
                  f"({len(groups)} rules, {size_kb:.1f} KB)")

        # page-specific bundle: one file per "owner" — for now, emit them all
        # as a single page.css since we don't know who owns which selector
        # without HTML correlation. User can split later.
        page_groups = bucket_groups.get("page", [])
        if page_groups:
            out = write_bundle("page", page_groups, out_dir)
            size_kb = out.stat().st_size / 1024
            print(f"  ✓ {out.relative_to(root).as_posix()}  "
                  f"({len(page_groups)} rules, {size_kb:.1f} KB)")

        generic = bucket_groups.get("generic", [])
        if generic:
            out = write_bundle("generic", generic, out_dir)
            size_kb = out.stat().st_size / 1024
            print(f"  ✓ {out.relative_to(root).as_posix()}  "
                  f"({len(generic)} rules, {size_kb:.1f} KB)")

        # final size summary
        total_in = sum(f.stat().st_size for f in files)
        total_out = sum(f.stat().st_size for f in (out_dir).glob("*.css"))
        print(f"\n  Source files:       {total_in/1024:.1f} KB")
        print(f"  Consolidated:       {total_out/1024:.1f} KB")
        if total_in:
            print(f"  → {100*(total_in - total_out)/total_in:.0f}% smaller")

        print(f"\nNext step: review {out_dir.relative_to(root).as_posix()}/, "
              f"then update <link rel=\"stylesheet\"> tags in HTML to load "
              f"these instead of the originals.")

    return 0


def build_report(rules_per_file, by_bucket, bucket_groups, overlap_pairs) -> str:
    out = ["# CSS Consolidation Report\n"]

    out.append("## Per-file rule counts\n")
    out.append("| File | Rules | KB |")
    out.append("|------|-------|----|")
    for fname, rules in sorted(rules_per_file.items()):
        path = Path(fname)
        size = path.stat().st_size / 1024 if path.exists() else 0
        out.append(f"| `{fname}` | {len(rules)} | {size:.1f} |")
    out.append("")

    out.append("## Bucket classification\n")
    out.append("| Bucket | Rules in source | Rules after dedup | Merged | % saved |")
    out.append("|--------|-----------------|-------------------|--------|---------|")
    for bucket in ("chat", "sandbox", "shared", "page", "generic"):
        rules = by_bucket.get(bucket, [])
        groups = bucket_groups.get(bucket, [])
        before = sum(len(g) for g in groups)
        after = len(groups)
        saved = before - after
        pct = 100 * saved / before if before else 0
        out.append(f"| `{bucket}` | {before} | {after} | {saved} | {pct:.0f}% |")
    out.append("")

    out.append("## Stale-copy candidates (pairwise overlap ≥ 30%)\n")
    if not overlap_pairs:
        out.append("_None._\n")
    for a, b, ov, pa, pb in overlap_pairs:
        out.append(f"### `{a}`  ⇄  `{b}`")
        out.append(f"- Identical rules:           **{len(ov['same'])}**")
        out.append(f"- Same selector, drifted:    {len(ov['drifted_selectors'])}")
        out.append(f"- Only in `{a}`:    {len(ov['only_in_a'])}")
        out.append(f"- Only in `{b}`:    {len(ov['only_in_b'])}")
        out.append(f"- A is **{pa:.0f}%** identical to B  ·  B is **{pb:.0f}%** identical to A\n")

    out.append("## Top body-dedup wins (rules merged into one selector list)\n")
    for bucket in ("chat", "sandbox", "shared", "page", "generic"):
        groups = bucket_groups.get(bucket, [])
        big = sorted([g for g in groups if len(g) > 1], key=len, reverse=True)[:10]
        if not big:
            continue
        out.append(f"### {bucket}")
        for g in big:
            sels = sorted({r.selector for r in g})
            out.append(f"- **{len(g)} rules** → 1 (selectors: {', '.join('`'+s+'`' for s in sels[:4])}{'…' if len(sels)>4 else ''})")
        out.append("")

    return "\n".join(out)


if __name__ == "__main__":
    sys.exit(main())
