#!/usr/bin/env python3
"""
scripts/audit_css.py
====================

CSS auditor for the Adelphos sandbox / dist site. Pure-stdlib (no pip install
needed). Scans every `.css` file plus every inline `<style>` block in `.html`
files and surfaces the things that make a stylesheet impossible to debug:

  1. DUPLICATE SELECTORS
       Same selector defined in multiple places. Sorted by count desc.
       Use this to find selectors that have been re-defined ad nauseam.

  2. SPECIFICITY HOTSPOTS  (use --target)
       For a given target (a class, id, or class combination), lists every
       rule whose selector mentions it, sorted by specificity. The rule at
       the top of the list is the one winning the cascade (later rules
       break ties at equal specificity). Use this to find out why your
       `width: 80%` is being overridden by something else.

  3. !important WARS
       Properties marked `!important` in 2+ places, against the same selector.
       These won't be resolvable by simple specificity — someone has to win.

  4. ORPHANED SELECTORS
       Selectors whose required class names / ids don't appear in any HTML
       file scanned. Conservative — flagged only when ALL custom hooks
       (.foo, #bar) in the selector are missing from every HTML file.

  5. PROPERTY PRESSURE  (per property name)
       Counts how many distinct rules touch each property. The hottest
       properties (width, height, padding, position, …) are the ones most
       likely to be in a cascade fight.

USAGE
-----
    # Full audit, write Markdown report
    python scripts/audit_css.py

    # Inspect WHY a particular selector loses the cascade
    python scripts/audit_css.py --target ".docs-layout.home-no-rails"

    # Inspect a single property fight on a single selector
    python scripts/audit_css.py --target ".docs-layout.home-no-rails" --property width

    # Custom output path
    python scripts/audit_css.py --out my-report.md

    # Limit scope (e.g. only the dist preview)
    python scripts/audit_css.py --include "dist/**/*.html" "css/**/*.css" "sandbox/**/*.css"

EXIT CODES
----------
    0 — report written
    1 — input error / no files scanned

The report is Markdown (default `audit-report.md` in cwd). Open it in any
Markdown viewer for the prettiest version.
"""

from __future__ import annotations

import argparse
import html.parser
import io
import re
import sys

# Windows-friendly stdout: cp1252 default chokes on the non-ASCII characters
# we like in the report header. Force UTF-8 if we can.
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from pathlib import Path

# =============================================================================
# CSS PARSING — minimal, no third-party deps. Handles nested @media/@supports
# by depth-counting braces. Strips comments. Splits comma-separated selector
# groups so each selector becomes its own CssRule.
# =============================================================================

_COMMENT_RE = re.compile(r"/\*.*?\*/", re.DOTALL)


@dataclass
class CssRule:
    """One parsed CSS rule.

    `properties` maps property-name → {'value': str, 'important': bool}.
    `source` is "<file>:<line>" so you can jump straight to it.
    `media` carries the enclosing @media/@supports query, '' for top-level.
    """

    selector: str
    properties: dict
    source: str
    media: str = ""
    raw_specificity: tuple[int, int, int] = field(default=(0, 0, 0))

    def __post_init__(self):
        self.raw_specificity = css_specificity(self.selector)

    @property
    def specificity(self) -> tuple[int, int, int]:
        return self.raw_specificity

    @property
    def has_important(self) -> bool:
        return any(p["important"] for p in self.properties.values())


def parse_css(text: str, source: str, media_stack: list[str] | None = None) -> list[CssRule]:
    """Top-level CSS parser. Returns a flat list of CssRule, with @media
    rules expanded inline (each rule keeping its enclosing media string)."""
    text = _COMMENT_RE.sub("", text)
    rules: list[CssRule] = []
    media_stack = list(media_stack or [])
    line_table = _build_line_table(text)
    i, n = 0, len(text)

    while i < n:
        # skip whitespace
        while i < n and text[i].isspace():
            i += 1
        if i >= n:
            break

        block_start = text.find("{", i)
        semi = text.find(";", i)
        if block_start == -1:
            break

        # at-rule with no body (@import …;) — skip
        if 0 <= semi < block_start:
            i = semi + 1
            continue

        prelude = text[i:block_start].strip()
        body_start = block_start + 1
        body_end = _find_matching_brace(text, block_start)
        if body_end == -1:
            break
        body = text[body_start:body_end]

        if prelude.startswith("@"):
            at_name = prelude.split(maxsplit=1)[0].lower()
            if at_name in ("@media", "@supports"):
                # recurse into the body with a wider media stack
                inner = parse_css(body, source, media_stack + [prelude])
                rules.extend(inner)
            # @keyframes / @font-face / @page / @import etc. — irrelevant for
            # cascade auditing, skip silently
        else:
            line = _line_at(line_table, i)
            for sel in _split_selectors(prelude):
                rules.append(
                    CssRule(
                        selector=sel.strip(),
                        properties=_parse_declarations(body),
                        source=f"{source}:{line}",
                        media=" AND ".join(media_stack),
                    )
                )

        i = body_end + 1

    return rules


def _find_matching_brace(text: str, open_idx: int) -> int:
    depth = 0
    for j in range(open_idx, len(text)):
        if text[j] == "{":
            depth += 1
        elif text[j] == "}":
            depth -= 1
            if depth == 0:
                return j
    return -1


def _split_selectors(prelude: str) -> list[str]:
    """Split a selector list on top-level commas."""
    out, depth, buf = [], 0, []
    for ch in prelude:
        if ch in "([":
            depth += 1
        elif ch in ")]":
            depth -= 1
        if ch == "," and depth == 0:
            out.append("".join(buf))
            buf = []
        else:
            buf.append(ch)
    if buf:
        out.append("".join(buf))
    return [s for s in (s.strip() for s in out) if s]


_DECL_IMPORTANT_RE = re.compile(r"!\s*important", re.I)


def _parse_declarations(body: str) -> dict:
    """Parse the inside of `{ ... }` into a property dict."""
    out: dict = {}
    # very small declarations parser: split on ; that aren't inside ()
    decls, depth, buf = [], 0, []
    for ch in body:
        if ch in "([":
            depth += 1
        elif ch in ")]":
            depth -= 1
        if ch == ";" and depth == 0:
            decls.append("".join(buf))
            buf = []
        else:
            buf.append(ch)
    if buf:
        decls.append("".join(buf))

    for raw in decls:
        raw = raw.strip()
        if not raw or ":" not in raw:
            continue
        name, _, value = raw.partition(":")
        name = name.strip().lower()
        value = value.strip()
        if not name or not value:
            continue
        important = bool(_DECL_IMPORTANT_RE.search(value))
        if important:
            value = _DECL_IMPORTANT_RE.sub("", value).strip()
        out[name] = {"value": value, "important": important}
    return out


def _build_line_table(text: str) -> list[int]:
    table = [0]
    for i, ch in enumerate(text):
        if ch == "\n":
            table.append(i + 1)
    return table


def _line_at(table: list[int], offset: int) -> int:
    lo, hi = 0, len(table) - 1
    while lo < hi:
        mid = (lo + hi + 1) // 2
        if table[mid] <= offset:
            lo = mid
        else:
            hi = mid - 1
    return lo + 1


# =============================================================================
# CSS SPECIFICITY  — (a, b, c)
#   a = #ids
#   b = .classes + [attrs] + :pseudo-classes
#   c = element names + ::pseudo-elements
# =============================================================================

_ID_RE = re.compile(r"#[\w-]+")
_CLASS_RE = re.compile(r"\.[\w-]+")
_ATTR_RE = re.compile(r"\[[^\]]+\]")
_PSEUDO_ELEMENT_RE = re.compile(r"::[\w-]+")
# pseudo-class but not :: (pseudo-element) and not :not (handled separately)
_PSEUDO_CLASS_RE = re.compile(r"(?<!:):(?!not\b)[\w-]+(?:\([^)]*\))?")
# tag names: a word at start or after a combinator/whitespace
_TAG_RE = re.compile(r"(?:^|[\s>+~])([a-zA-Z][\w-]*)")
_NOT_RE = re.compile(r":not\(([^)]+)\)")


def css_specificity(selector: str) -> tuple[int, int, int]:
    s = selector
    # peel off :not(...) — its inner selector contributes specificity
    not_inners = _NOT_RE.findall(s)
    s = _NOT_RE.sub("", s)
    # peel off ::pseudo-elements before counting :pseudo-classes
    pseudo_elements = len(_PSEUDO_ELEMENT_RE.findall(s))
    s_no_pe = _PSEUDO_ELEMENT_RE.sub("", s)

    a = len(_ID_RE.findall(s_no_pe))
    b = (
        len(_CLASS_RE.findall(s_no_pe))
        + len(_ATTR_RE.findall(s_no_pe))
        + len(_PSEUDO_CLASS_RE.findall(s_no_pe))
    )
    c = len(_TAG_RE.findall(s_no_pe)) + pseudo_elements

    for inner in not_inners:
        ai, bi, ci = css_specificity(inner)
        a += ai
        b += bi
        c += ci
    return (a, b, c)


# =============================================================================
# HTML PARSING — collect class names, ids, tag names, AND inline <style>
# blocks (which are added to the rule pool so they participate in audits).
# =============================================================================


class HtmlScanner(html.parser.HTMLParser):
    def __init__(self):
        super().__init__()
        self.classes: set[str] = set()
        self.ids: set[str] = set()
        self.tags: set[str] = set()
        self.style_blocks: list[str] = []
        self._in_style = False
        self._style_buf: list[str] = []

    def handle_starttag(self, tag, attrs):
        self.tags.add(tag.lower())
        for name, value in attrs:
            if not value:
                continue
            if name == "class":
                for c in value.split():
                    self.classes.add(c)
            elif name == "id":
                self.ids.add(value)
        if tag.lower() == "style":
            self._in_style = True
            self._style_buf = []

    def handle_endtag(self, tag):
        if tag.lower() == "style" and self._in_style:
            self._in_style = False
            self.style_blocks.append("".join(self._style_buf))

    def handle_data(self, data):
        if self._in_style:
            self._style_buf.append(data)


def scan_html(path: Path) -> HtmlScanner:
    text = path.read_text(encoding="utf-8", errors="replace")
    scanner = HtmlScanner()
    try:
        scanner.feed(text)
    except Exception:
        # tolerant — keep whatever we got before the parse error
        pass
    return scanner


# =============================================================================
# JS SCANNING — find class names + ids that JS toggles dynamically.
# Without this, classes like `.is-dragging`, `.active`, `.hidden` look like
# orphans because they never appear statically in HTML.
#
# Patterns covered:
#   classList.add('foo')          classList.add("foo")
#   classList.remove('foo')       classList.toggle('foo', cond)
#   classList.contains('foo')     classList.replace('a', 'b')
#   className = 'foo bar'         className += ' foo'
#   element.id = 'foo'
#   querySelector('.foo')         querySelectorAll('#foo')
#   getElementById('foo')         getElementsByClassName('foo')
#   data-class="foo"              and similar template literals
# =============================================================================

_JS_CLASSLIST_RE = re.compile(
    r"""classList\s*\.\s*(?:add|remove|toggle|contains|replace)\s*\(\s*
        ['"]([^'"]+)['"]
        (?:\s*,\s*['"]([^'"]+)['"])?     # 2nd arg of replace()
    """,
    re.VERBOSE,
)

# className = "...", className = `...` (raw text, can hold many classes)
_JS_CLASSNAME_ASSIGN_RE = re.compile(
    r"""(?:className|class)\s*[\+]?=\s*['"`]([^'"`]+)['"`]""",
    re.VERBOSE,
)

# querySelector('.foo'), querySelector('#foo'), querySelectorAll('.foo .bar')
_JS_QUERY_SELECTOR_RE = re.compile(
    r"""(?:querySelector|querySelectorAll|matches|closest)\s*\(\s*
        ['"`]([^'"`]+)['"`]
    """,
    re.VERBOSE,
)

# getElementById('foo'), getElementsByClassName('foo')
_JS_GET_ID_RE = re.compile(
    r"""getElementById\s*\(\s*['"`]([^'"`]+)['"`]""",
    re.VERBOSE,
)
_JS_GET_CLASS_RE = re.compile(
    r"""getElementsByClassName\s*\(\s*['"`]([^'"`]+)['"`]""",
    re.VERBOSE,
)

# id = "foo" assignments
_JS_ID_ASSIGN_RE = re.compile(
    r"""\.\s*id\s*=\s*['"`]([^'"`]+)['"`]""",
    re.VERBOSE,
)

# template literals with class= or id= attributes (innerHTML strings)
_JS_TEMPLATE_CLASS_RE = re.compile(r"""class\s*=\s*["'`]([^"'`]+)["'`]""")
_JS_TEMPLATE_ID_RE = re.compile(r"""\bid\s*=\s*["'`]([^"'`]+)["'`]""")


def scan_js(path: Path) -> tuple[set[str], set[str]]:
    """Return (used_classes, used_ids) found by static analysis of a JS
    or .mjs file. Conservative: matches only literal string arguments.
    Computed names like `'msg-' + type` will be missed — that's a
    fundamental limit of static analysis."""
    classes: set[str] = set()
    ids: set[str] = set()
    try:
        text = path.read_text(encoding="utf-8", errors="replace")
    except Exception:
        return classes, ids

    # strip /* comments */ and // line comments to reduce false positives
    text = re.sub(r"/\*.*?\*/", "", text, flags=re.DOTALL)
    text = re.sub(r"(^|[^:])//[^\n]*", r"\1", text)  # don't kill http://

    # classList.add / remove / toggle / contains / replace
    for m in _JS_CLASSLIST_RE.finditer(text):
        for g in m.groups():
            if g:
                classes.add(g)

    # className = "foo bar baz"
    for m in _JS_CLASSNAME_ASSIGN_RE.finditer(text):
        for tok in m.group(1).split():
            classes.add(tok)

    # querySelector('.foo'), querySelector('#foo'), querySelector('.foo .bar')
    for m in _JS_QUERY_SELECTOR_RE.finditer(text):
        sel = m.group(1)
        for c in _CLASS_RE.findall(sel):
            classes.add(c[1:])
        for i in _ID_RE.findall(sel):
            ids.add(i[1:])

    # getElementById('foo'), getElementsByClassName('foo')
    for m in _JS_GET_ID_RE.finditer(text):
        ids.add(m.group(1))
    for m in _JS_GET_CLASS_RE.finditer(text):
        classes.add(m.group(1))

    # element.id = "foo"
    for m in _JS_ID_ASSIGN_RE.finditer(text):
        ids.add(m.group(1))

    # template literals with class= / id= attributes (e.g. innerHTML strings)
    for m in _JS_TEMPLATE_CLASS_RE.finditer(text):
        for tok in m.group(1).split():
            # template-literal interpolations like ${x} produce noise — skip
            if "${" not in tok and "}" not in tok:
                classes.add(tok)
    for m in _JS_TEMPLATE_ID_RE.finditer(text):
        val = m.group(1)
        if "${" not in val and "}" not in val:
            ids.add(val)

    return classes, ids


# =============================================================================
# AUDITS
# =============================================================================


def find_duplicates(rules: list[CssRule]) -> list[tuple[str, str, list[CssRule]]]:
    """Selectors defined in 2+ places (same media context). Returns
    list of (selector, media, [rules]) sorted by count desc."""
    groups: dict[tuple[str, str], list[CssRule]] = defaultdict(list)
    for r in rules:
        groups[(r.selector, r.media)].append(r)
    dupes = [(sel, media, rs) for ((sel, media), rs) in groups.items() if len(rs) > 1]
    dupes.sort(key=lambda x: -len(x[2]))
    return dupes


def find_important_wars(rules: list[CssRule]) -> list[tuple[str, str, list[CssRule]]]:
    """For each (selector, property) pair, find places where !important is
    set in 2+ rules. These can't be resolved by specificity alone."""
    by_key: dict[tuple[str, str], list[CssRule]] = defaultdict(list)
    for r in rules:
        for prop, info in r.properties.items():
            if info["important"]:
                by_key[(r.selector, prop)].append(r)
    wars = [(sel, prop, rs) for ((sel, prop), rs) in by_key.items() if len(rs) > 1]
    wars.sort(key=lambda x: -len(x[2]))
    return wars


# Pseudo-classes/elements that look like tag-segments to our regex; ignore
# them when checking if a "tag" is real.
_PSEUDO_BLACKLIST = {
    "before", "after", "first-child", "last-child", "first-of-type", "last-of-type",
    "nth-child", "nth-of-type", "only-child", "only-of-type", "hover", "focus",
    "active", "visited", "checked", "disabled", "enabled", "empty", "root",
    "target", "lang", "not", "is", "where", "has",
}


def find_orphans(
    rules: list[CssRule],
    used_classes: set[str],
    used_ids: set[str],
    used_tags: set[str],
) -> list[CssRule]:
    """Rules whose selector cannot match anything in the scanned HTML.

    Conservative: flagged only when the selector contains at least one
    custom hook (.class or #id), AND every such hook is missing from the
    HTML. Rules that target only generic tags (body, html, etc.) are NOT
    flagged because they always match."""
    out = []
    seen = set()
    for r in rules:
        key = (r.selector, r.media, r.source)
        if key in seen:
            continue
        seen.add(key)
        if _is_orphan(r.selector, used_classes, used_ids):
            out.append(r)
    return out


def _is_orphan(selector: str, classes: set[str], ids: set[str]) -> bool:
    sel_classes = [c[1:] for c in _CLASS_RE.findall(selector)]
    sel_ids = [i[1:] for i in _ID_RE.findall(selector)]
    if not sel_classes and not sel_ids:
        return False  # generic / tag-only — assume alive
    # any required hook missing from the scanned HTML?
    for c in sel_classes:
        if c not in classes:
            return True
    for i in sel_ids:
        if i not in ids:
            return True
    return False


def find_specificity_hotspots(
    rules: list[CssRule], target: str
) -> list[CssRule]:
    """Every rule whose selector mentions ALL the classes/ids in `target`.

    Sorted by specificity desc, then by source order. The rule at the top
    is the one that wins the cascade for properties it sets. Use this to
    debug a "why isn't my width:80% applying?" issue — the answer is
    always at the top of this list."""
    target_classes = {c[1:] for c in _CLASS_RE.findall(target)}
    target_ids = {i[1:] for i in _ID_RE.findall(target)}
    if not target_classes and not target_ids:
        return []
    hits = []
    for r in rules:
        rule_classes = {c[1:] for c in _CLASS_RE.findall(r.selector)}
        rule_ids = {i[1:] for i in _ID_RE.findall(r.selector)}
        # A rule is a candidate if at least one class/id hook from the
        # target appears in the selector. Stricter "issubset" misses
        # parent-context rules (e.g. `.docs-layout` on `.docs-layout.x`).
        if (target_classes & rule_classes) or (target_ids & rule_ids):
            hits.append(r)
    # cascade order: !important first, then specificity desc, then source
    hits.sort(
        key=lambda r: (
            r.has_important,
            r.specificity[0],
            r.specificity[1],
            r.specificity[2],
        ),
        reverse=True,
    )
    return hits


def property_pressure(rules: list[CssRule]) -> list[tuple[str, int]]:
    """How many distinct rules touch each property name?"""
    counter: Counter = Counter()
    for r in rules:
        for prop in r.properties:
            counter[prop] += 1
    return counter.most_common()


# =============================================================================
# REPORT (Markdown)
# =============================================================================


def render_report(
    rules: list[CssRule],
    dupes: list,
    wars: list,
    orphans: list,
    target_hotspots: list,
    target: str,
    target_property: str,
    files_scanned: dict,
) -> str:
    out: list[str] = []
    out.append("# CSS Audit Report\n")
    out.append(f"- CSS files scanned: **{files_scanned['css']}**")
    out.append(f"- HTML files scanned: **{files_scanned['html']}**")
    out.append(f"- Total rules parsed: **{len(rules)}**")
    out.append(f"- Duplicate selectors: **{len(dupes)}**")
    out.append(f"- !important wars: **{len(wars)}**")
    out.append(f"- Orphaned selectors: **{len(orphans)}**\n")

    # --- target hotspots first if requested -------------------------------
    if target:
        out.append(f"## 🎯 Cascade stack for `{target}`\n")
        if target_property:
            out.append(f"_Filtered to property `{target_property}` — winning value at the top._\n")
            target_hotspots = [r for r in target_hotspots if target_property in r.properties]
        else:
            out.append("_All rules that touch this selector, sorted by cascade priority (winning rule on top)._\n")

        if not target_hotspots:
            out.append("_No matching rules found._\n")
        else:
            out.append("| # | spec | !imp | selector | source | media | properties |")
            out.append("|---|------|------|----------|--------|-------|------------|")
            for i, r in enumerate(target_hotspots, 1):
                spec = r.specificity
                imp = "✓" if r.has_important else ""
                media = r.media or "—"
                if target_property and target_property in r.properties:
                    info = r.properties[target_property]
                    pmark = "✓" if info["important"] else ""
                    props = f"`{target_property}: {info['value']}` {pmark}"
                else:
                    props = ", ".join(f"`{p}`" for p in list(r.properties)[:6])
                    if len(r.properties) > 6:
                        props += f" _+{len(r.properties) - 6} more_"
                out.append(
                    f"| {i} | ({spec[0]},{spec[1]},{spec[2]}) | {imp} | "
                    f"`{r.selector}` | `{r.source}` | `{media}` | {props} |"
                )
            out.append("")
            out.append(
                "> The rule at row 1 wins. To beat it, either raise specificity, "
                "add `!important`, or move your rule later in the same stylesheet."
            )
            out.append("")

    # --- duplicates -------------------------------------------------------
    out.append("## 🔁 Duplicate selectors (same selector, multiple rule blocks)\n")
    if not dupes:
        out.append("_None._\n")
    else:
        out.append(f"_Showing top {min(len(dupes), 50)} of {len(dupes)}_\n")
        for sel, media, rs in dupes[:50]:
            mtag = f" @media({media})" if media else ""
            props_union = sorted({p for r in rs for p in r.properties})
            out.append(f"### `{sel}`{mtag} × {len(rs)}")
            out.append(f"_Properties touched: {', '.join('`'+p+'`' for p in props_union)}_")
            for r in rs:
                out.append(f"- `{r.source}`  →  {len(r.properties)} props")
            out.append("")

    # --- !important wars --------------------------------------------------
    out.append("## ⚠ !important wars\n")
    if not wars:
        out.append("_None._\n")
    else:
        out.append(f"_Showing top {min(len(wars), 30)} of {len(wars)}_\n")
        for sel, prop, rs in wars[:30]:
            out.append(f"### `{sel}` · `{prop}` × {len(rs)} `!important`")
            for r in rs:
                val = r.properties[prop]["value"]
                out.append(f"- `{r.source}` → `{val}`")
            out.append("")

    # --- property pressure ------------------------------------------------
    out.append("## 🔥 Property pressure (most-fought-over properties)\n")
    pressures = property_pressure(rules)
    out.append("| property | rules touching it |")
    out.append("|----------|-------------------|")
    for prop, count in pressures[:30]:
        out.append(f"| `{prop}` | {count} |")
    out.append("")

    # --- orphans ----------------------------------------------------------
    out.append("## 👻 Orphaned selectors (no matching DOM hook found)\n")
    out.append(
        "_Conservative — only flagged when every `.class` and `#id` in the "
        "selector is missing from every HTML file scanned. Tag-only / "
        "html / body / pseudo-element rules are intentionally not flagged._\n"
    )
    if not orphans:
        out.append("_None._\n")
    else:
        # group by source file for easier deletion
        by_file: dict[str, list[CssRule]] = defaultdict(list)
        for r in orphans:
            by_file[r.source.rsplit(":", 1)[0]].append(r)
        out.append(f"_Total orphans: {len(orphans)}; in {len(by_file)} files_\n")
        for fname in sorted(by_file):
            rs = by_file[fname]
            out.append(f"### `{fname}` — {len(rs)} orphans")
            for r in rs[:200]:
                mtag = f" @media({r.media})" if r.media else ""
                out.append(f"- `{r.selector}`{mtag}  ({r.source.rsplit(':', 1)[1]})")
            if len(rs) > 200:
                out.append(f"_… {len(rs) - 200} more_")
            out.append("")

    return "\n".join(out)


# =============================================================================
# MAIN
# =============================================================================


def main() -> int:
    p = argparse.ArgumentParser(
        description="Audit CSS for duplicates, specificity fights, !important wars and orphans.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    p.add_argument("--root", type=Path, default=Path.cwd(),
                   help="Project root (default: cwd)")
    p.add_argument("--target", default="",
                   help='Selector to inspect, e.g. ".docs-layout.home-no-rails" or "#draggableChat"')
    p.add_argument("--property", dest="target_property", default="",
                   help='If set with --target, filter the cascade stack to this property (e.g. "width")')
    p.add_argument("--out", type=Path, default=Path("audit-report.md"),
                   help="Markdown report path (default: audit-report.md)")
    p.add_argument(
        "--include", nargs="*",
        default=[
            "css/**/*.css",
            "sandbox/**/*.css",
            "chat-panel/**/*.css",
            "dist/**/*.html",
            "sandbox/**/*.html",
            "*.html",
            "templates/**/*.html",
            # JS files — scanned for dynamically-added classes / ids so we
            # don't flag e.g. `.is-dragging` (added by JS only) as orphan.
            "js/**/*.js",
            "chat-panel/**/*.js",
            "scripts/**/*.mjs",
            "scripts/**/*.js",
            "sandbox/**/*.js",
            "sandbox/**/*.mjs",
        ],
        help="Glob patterns to scan (relative to --root)",
    )
    p.add_argument(
        "--exclude", nargs="*",
        default=[
            "**/node_modules/**",
            "**/_archive/**",
            "**/backup_*/**",
            "**/backup/**",
            "**/.vs/**",
            "**/*.bak*",
            "**/*.backup*",
            "**/dist/**/index.html.bak*",
        ],
        help="Glob patterns to exclude",
    )
    p.add_argument(
        "--delete-orphans", action="store_true",
        help="Surgically remove orphan rules from CSS files. Backs up "
             "originals to <file>.bak.<timestamp>. Skips inline <style> "
             "blocks in dist/ (regenerated by build) and skips files in "
             "--protect-files. SAFE TO RUN — has dry-run preview first.",
    )
    p.add_argument(
        "--protect-files", nargs="*",
        default=[
            # CSS files we never want auto-deleted from. The shared/SPA
            # stylesheets are loaded by 100+ pages and used by JS; the
            # static analysis can miss things, so we only delete from
            # files explicitly opted-in via --include-files.
        ],
        help="CSS files to NEVER delete from",
    )
    p.add_argument(
        "--delete-from", nargs="*",
        default=[],
        help="ONLY delete from these CSS files (whitelist). If empty, "
             "deletion runs on every CSS file scanned (still skips "
             "inline <style> blocks in HTML).",
    )
    p.add_argument(
        "--yes", action="store_true",
        help="Skip the confirmation prompt before deleting.",
    )
    args = p.parse_args()

    root: Path = args.root.resolve()
    if not root.is_dir():
        print(f"--root not a directory: {root}", file=sys.stderr)
        return 1

    css_files: list[Path] = []
    html_files: list[Path] = []
    js_files: list[Path] = []
    for pattern in args.include:
        for f in root.glob(pattern):
            if not f.is_file():
                continue
            rel = f.relative_to(root).as_posix()
            if any(_glob_match(rel, ex) for ex in args.exclude):
                continue
            if f.suffix == ".css":
                css_files.append(f)
            elif f.suffix in (".html", ".htm"):
                html_files.append(f)
            elif f.suffix in (".js", ".mjs"):
                js_files.append(f)

    css_files = sorted(set(css_files))
    html_files = sorted(set(html_files))
    js_files = sorted(set(js_files))

    if not css_files and not html_files:
        print("No CSS or HTML files matched. Check --include / --exclude / --root.", file=sys.stderr)
        return 1

    print(f"Scanning {len(css_files)} CSS files + {len(html_files)} HTML files + {len(js_files)} JS files…")

    # parse all CSS
    rules: list[CssRule] = []
    for f in css_files:
        try:
            text = f.read_text(encoding="utf-8", errors="replace")
            rels = f.relative_to(root).as_posix()
            rules.extend(parse_css(text, rels))
        except Exception as e:
            print(f"  ! parse error in {f}: {e}", file=sys.stderr)

    # scan HTML for hooks AND inline <style> blocks
    used_classes: set[str] = set()
    used_ids: set[str] = set()
    used_tags: set[str] = set()
    for f in html_files:
        try:
            scanner = scan_html(f)
        except Exception as e:
            print(f"  ! html scan error in {f}: {e}", file=sys.stderr)
            continue
        used_classes |= scanner.classes
        used_ids |= scanner.ids
        used_tags |= scanner.tags
        rels = f.relative_to(root).as_posix()
        for i, blk in enumerate(scanner.style_blocks):
            try:
                rules.extend(parse_css(blk, f"{rels}<style#{i}>"))
            except Exception as e:
                print(f"  ! inline css parse error in {f}: {e}", file=sys.stderr)

    # scan JS for dynamically-added classes and ids
    js_classes_added = 0
    js_ids_added = 0
    for f in js_files:
        cls, ids = scan_js(f)
        new_cls = cls - used_classes
        new_ids = ids - used_ids
        used_classes |= cls
        used_ids |= ids
        js_classes_added += len(new_cls)
        js_ids_added += len(new_ids)

    print(f"Parsed {len(rules)} CSS rules; "
          f"HTML+JS uses {len(used_classes)} classes "
          f"(+{js_classes_added} from JS only), "
          f"{len(used_ids)} ids "
          f"(+{js_ids_added} from JS only), "
          f"{len(used_tags)} tag names.")

    dupes = find_duplicates(rules)
    wars = find_important_wars(rules)
    orphans = find_orphans(rules, used_classes, used_ids, used_tags)
    target_hotspots = (
        find_specificity_hotspots(rules, args.target) if args.target else []
    )

    report = render_report(
        rules,
        dupes,
        wars,
        orphans,
        target_hotspots,
        args.target,
        args.target_property,
        files_scanned={"css": len(css_files), "html": len(html_files)},
    )
    args.out.write_text(report, encoding="utf-8")

    print(f"\nReport written to {args.out}")
    print(f"  Duplicates: {len(dupes)}")
    print(f"  !important wars: {len(wars)}")
    print(f"  Orphans: {len(orphans)}")
    if args.target:
        print(f"  Rules touching `{args.target}`: {len(target_hotspots)}")
        if args.target_property:
            filtered = [r for r in target_hotspots if args.target_property in r.properties]
            print(f"  Rules setting `{args.target_property}`: {len(filtered)}")
            if filtered:
                winner = filtered[0]
                val = winner.properties[args.target_property]
                imp = " !important" if val["important"] else ""
                print(f"  → CASCADE WINNER: `{winner.selector}` from `{winner.source}` "
                      f"sets `{args.target_property}: {val['value']}{imp}` "
                      f"(specificity {winner.specificity})")

    # ─────────────────────────────────────────────────────────────────────
    # OPTIONAL: surgically delete orphan rules from CSS files
    # ─────────────────────────────────────────────────────────────────────
    if args.delete_orphans:
        return _delete_orphans(orphans, args, root)

    return 0


# =============================================================================
# DELETION — surgical orphan removal from .css files only
# =============================================================================


def _delete_orphans(orphans: list[CssRule], args, root: Path) -> int:
    """For each orphan rule that lives in a real .css file (not an inline
    <style> block in an HTML file — those get regenerated on build), find
    the rule's exact text in the source and remove it. Backups go to
    <file>.bak.<unix-timestamp> so any mistake is reversible."""
    import time

    # Collect orphans by source file, only from .css files (skip
    # <style#N> blocks — those live inside HTML and are typically
    # regenerated by the build).
    by_file: dict[str, list[CssRule]] = defaultdict(list)
    skipped_inline = 0
    skipped_protected = 0
    for r in orphans:
        src = r.source.rsplit(":", 1)[0]
        if "<style" in src:
            skipped_inline += 1
            continue
        if not src.endswith(".css"):
            skipped_inline += 1
            continue
        if args.delete_from and src not in args.delete_from:
            skipped_protected += 1
            continue
        if any(_glob_match(src, pat) for pat in args.protect_files):
            skipped_protected += 1
            continue
        by_file[src].append(r)

    if skipped_inline:
        print(f"\nSkipped {skipped_inline} orphans in inline <style> blocks "
              f"(those are regenerated by the build script).")
    if skipped_protected:
        print(f"Skipped {skipped_protected} orphans in protected/non-whitelisted files.")

    if not by_file:
        print("\nNo external .css orphans to delete.")
        return 0

    print(f"\nReady to delete from {len(by_file)} .css files:")
    total = 0
    for fname, rs in sorted(by_file.items()):
        print(f"  {fname}: {len(rs)} orphan rules")
        total += len(rs)
    print(f"  TOTAL: {total} rules\n")

    if not args.yes:
        try:
            ans = input("Proceed? Type 'yes' to delete (anything else = abort): ").strip().lower()
        except EOFError:
            ans = ""
        if ans != "yes":
            print("Aborted — no files modified.")
            return 0

    timestamp = int(time.time())
    deleted_total = 0
    for fname, rs in sorted(by_file.items()):
        path = root / fname
        if not path.exists():
            print(f"  ! {fname} not found, skipping")
            continue
        try:
            text = path.read_text(encoding="utf-8")
        except Exception as e:
            print(f"  ! failed to read {fname}: {e}")
            continue

        # backup
        bak = path.with_suffix(path.suffix + f".bak.{timestamp}")
        bak.write_bytes(path.read_bytes())

        new_text, removed = _strip_rules_by_selector(text, rs)
        if removed == 0:
            print(f"  · {fname}: 0 rules actually removed (selectors not found in source — "
                  f"file may have been edited since the audit ran)")
            continue
        path.write_text(new_text, encoding="utf-8")
        print(f"  ✓ {fname}: removed {removed} rules (backup: {bak.name})")
        deleted_total += removed

    print(f"\nDone. Removed {deleted_total} orphan rules. "
          f"Restore any file by copying its .bak.{timestamp} sibling back.")
    return 0


def _strip_rules_by_selector(css_text: str, rules: list[CssRule]) -> tuple[str, int]:
    """Walk the CSS text the same way parse_css() does, but rewrite it,
    skipping any top-level rule whose selector list is wholly contained
    in the orphan set. Comments inside skipped rules go too. Multi-
    selector rules (e.g. ".a, .b") are kept as-is unless ALL listed
    selectors are orphans."""
    orphan_selectors = {r.selector for r in rules}

    text = css_text
    out: list[str] = []
    i, n = 0, len(text)
    removed = 0

    while i < n:
        # try to advance past a comment block; preserve it in output
        if text.startswith("/*", i):
            end = text.find("*/", i + 2)
            if end == -1:
                out.append(text[i:])
                i = n
                break
            out.append(text[i : end + 2])
            i = end + 2
            continue

        # whitespace — preserve
        if text[i].isspace():
            ws_start = i
            while i < n and text[i].isspace():
                i += 1
            out.append(text[ws_start:i])
            continue

        # find the next rule block
        block_start = text.find("{", i)
        semi = text.find(";", i)
        if block_start == -1:
            out.append(text[i:])
            break
        if 0 <= semi < block_start:
            # at-rule with no body (@import etc.) — preserve
            out.append(text[i : semi + 1])
            i = semi + 1
            continue

        prelude = text[i:block_start]
        body_end = _find_matching_brace(text, block_start)
        if body_end == -1:
            out.append(text[i:])
            break
        full_rule_text = text[i : body_end + 1]

        prelude_stripped = prelude.strip()
        if prelude_stripped.startswith("@"):
            # @media / @supports / @keyframes / @font-face — preserve as-is
            # (we don't recurse to delete inside @media — keeping safer)
            out.append(full_rule_text)
            i = body_end + 1
            continue

        # split selector list and check membership in orphan set
        selectors = [s.strip() for s in _split_selectors(prelude_stripped)]
        if selectors and all(s in orphan_selectors for s in selectors):
            removed += len(selectors)
            i = body_end + 1
            # collapse any leading blank line we just left behind
            if out and out[-1].endswith("\n\n"):
                out[-1] = out[-1].rstrip("\n") + "\n"
            continue

        # keep
        out.append(full_rule_text)
        i = body_end + 1

    return "".join(out), removed


# fnmatch-style glob with ** support, since pathlib's Path.match doesn't
# do ** the way humans expect.
def _glob_match(path: str, pattern: str) -> bool:
    import fnmatch
    # convert ** to a regex that matches across slashes
    regex = fnmatch.translate(pattern).replace(r".*.*", r".*").replace(r"\*\*", r".*")
    return re.match(regex, path) is not None


if __name__ == "__main__":
    sys.exit(main())
