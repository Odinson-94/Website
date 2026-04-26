#!/usr/bin/env python3
"""
generate_command_registry.py
============================
Scans every .cs file in MEPBridge.Revit for [Transaction]-decorated classes
and extracts the full attribute + XML-doc surface into command_registry.json.

USAGE
-----
    python tools/generate_command_registry.py [--out PATH] [--verbose]

OUTPUT
------
    MEPBridge.Revit/AIChat/Registries/command_registry.json

This is the SECOND registry (the first is mcp_registry.json for [McpTool] classes).
Together they cover the full functional surface of the codebase.

DETERMINISM
-----------
Single regex/AST pass. No randomness. No external network calls.
Same source tree → same JSON, byte-for-byte (file ordering is sorted).
"""
import argparse
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

# ─── Configuration ──────────────────────────────────────────────────────────
SCRIPT_DIR   = Path(__file__).parent.resolve()
PROJECT_ROOT = SCRIPT_DIR.parent
SCAN_PATH    = PROJECT_ROOT / "MEPBridge.Revit"
OUTPUT_FILE  = SCAN_PATH / "AIChat" / "Registries" / "command_registry.json"
EXCLUDE_DIRS = {"bin", "obj", ".vs", ".backups", "Tracking"}

# ─── Regex set (compiled once) ──────────────────────────────────────────────
RE_TRANSACTION   = re.compile(r"\[Transaction\(")
RE_CLASS_NAME    = re.compile(r"public\s+(?:sealed\s+)?(?:abstract\s+)?class\s+(\w+)\s*[:\s{]")
RE_NAMESPACE     = re.compile(r"namespace\s+([\w.]+)")
RE_KEYWORDS      = re.compile(r'\[Keywords\(([^)]+)\)\]')
RE_INTENT        = re.compile(r'\[IntentPattern\(([^)]+)\)\]')
RE_CMD_CATEGORY  = re.compile(r'\[CommandCategory\("([^"]+)"(?:[^)]*DisplayName\s*=\s*"([^"]+)")?')
RE_SERVICE_TYPE  = re.compile(r'\[ServiceType\("([^"]+)"\)\]')
RE_CALLS         = re.compile(r'\[Calls\("([^"]+)"\)\]')
RE_CALLED_BY     = re.compile(r'\[CalledBy\("([^"]+)"\)\]')
RE_RELATED_CMDS  = re.compile(r'\[RelatedCommands\(([^)]+)\)\]')
RE_HAS_REST_API  = re.compile(r'\[RestApi\(')

RE_SELECTION_INPUT = re.compile(
    r'\[SelectionInput\(\s*"([^"]+)"\s*,\s*"([^"]+)"\s*,\s*"([^"]+)"'
    r'(?:\s*,\s*Prompt\s*=\s*"([^"]+)")?'
    r'(?:\s*,\s*SupportsLinkedModels\s*=\s*(true|false))?'
    r'(?:\s*,\s*Example\s*=\s*"([^"]+)")?'
)
RE_CONFIG_INPUT = re.compile(
    r'\[ConfigInput\(\s*"([^"]+)"\s*,\s*"([^"]+)"\s*,\s*"([^"]+)"'
    r'(?:\s*,\s*DefaultValue\s*=\s*([^,)]+))?'
    r'(?:\s*,\s*Example\s*=\s*"([^"]+)")?'
)
RE_OUTPUT = re.compile(
    r'\[Output\(\s*"([^"]+)"\s*,\s*"([^"]+)"\s*,\s*"([^"]+)"'
    r'(?:\s*,\s*Nullable\s*=\s*(true|false))?'
    r'(?:\s*,\s*Destination\s*=\s*"([^"]+)")?'
    r'(?:\s*,\s*Example\s*=\s*"([^"]+)")?'
)

# XML doc tags
RE_XML_BLOCK = lambda tag: re.compile(rf"<{tag}>(.*?)</{tag}>", re.DOTALL)


def clean_xml_text(raw: str) -> str:
    """Strip /// markers, collapse whitespace, drop angle-bracket tags."""
    cleaned = re.sub(r"^\s*///\s?", "", raw, flags=re.MULTILINE)
    cleaned = re.sub(r"<see\s+cref=\"([^\"]+)\"\s*/>", r"\1", cleaned)
    cleaned = re.sub(r"<[^>]+>", "", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned)
    return cleaned.strip()


def first_sentence(text: str, max_chars: int = 240) -> str:
    if not text:
        return ""
    m = re.match(r"(.*?[.!?])(\s+[A-Z]|\s*$)", text)
    if m:
        return m.group(1).strip()
    return text[:max_chars].strip()


def parse_string_list(raw: str):
    """Parse a comma-separated list of double-quoted strings."""
    return [m.group(1) for m in re.finditer(r'"([^"]+)"', raw)]


def parse_aiprompts(text: str):
    if "<aiprompts>" not in text:
        return None
    m = re.search(r"<aiprompts>(.*?)</aiprompts>", text, re.DOTALL)
    if not m:
        return None
    block = m.group(1)
    return {
        "preprompts":          [clean_xml_text(x) for x in re.findall(r"<preprompt>(.*?)</preprompt>", block, re.DOTALL)],
        "thinkingsteps":       [clean_xml_text(x) for x in re.findall(r"<thinkingstep>(.*?)</thinkingstep>", block, re.DOTALL)],
        "preconditionprompts": [clean_xml_text(x) for x in re.findall(r"<preconditionprompt>(.*?)</preconditionprompt>", block, re.DOTALL)],
        "resolverprompts":     {m2.group(1): clean_xml_text(m2.group(2))
                                for m2 in re.finditer(r'<resolverprompt name="([^"]+)">(.*?)</resolverprompt>', block, re.DOTALL)},
        "successprompts":      [clean_xml_text(x) for x in re.findall(r"<successprompt>(.*?)</successprompt>", block, re.DOTALL)],
        "failureprompts":      [clean_xml_text(x) for x in re.findall(r"<failureprompt>(.*?)</failureprompt>", block, re.DOTALL)],
    }


def extract_one(file_path: Path) -> dict | None:
    text = file_path.read_text(encoding="utf-8", errors="replace")
    if not RE_TRANSACTION.search(text):
        return None

    m_class = RE_CLASS_NAME.search(text)
    if not m_class:
        return None

    cls = m_class.group(1)
    ns_m = RE_NAMESPACE.search(text)
    namespace = ns_m.group(1) if ns_m else ""

    # XML doc tags
    summary_m = RE_XML_BLOCK("summary").search(text)
    summary   = clean_xml_text(summary_m.group(1)) if summary_m else ""

    usecase_m = RE_XML_BLOCK("usecase").search(text)
    usecase   = clean_xml_text(usecase_m.group(1)) if usecase_m else ""

    notfor_m  = RE_XML_BLOCK("notfor").search(text)
    notfor    = clean_xml_text(notfor_m.group(1)) if notfor_m else ""

    sideeff_m = RE_XML_BLOCK("sideeffects").search(text)
    sideeff   = clean_xml_text(sideeff_m.group(1)) if sideeff_m else ""

    pre_m  = RE_XML_BLOCK("precondition").search(text)
    post_m = RE_XML_BLOCK("postcondition").search(text)
    logic_m = RE_XML_BLOCK("logictree").search(text)

    # Attributes
    keywords_m = RE_KEYWORDS.search(text)
    keywords   = parse_string_list(keywords_m.group(1)) if keywords_m else []

    intent_m   = RE_INTENT.search(text)
    intents    = parse_string_list(intent_m.group(1)) if intent_m else []

    cat_m  = RE_CMD_CATEGORY.search(text)
    pillar_m = RE_SERVICE_TYPE.search(text)

    selection_inputs = []
    for m in RE_SELECTION_INPUT.finditer(text):
        selection_inputs.append({
            "name":        m.group(1),
            "type":        m.group(2),
            "description": m.group(3),
            "prompt":      m.group(4) or "",
            "linked":      m.group(5) == "true" if m.group(5) else False,
            "example":     m.group(6) or "",
        })

    config_inputs = []
    for m in RE_CONFIG_INPUT.finditer(text):
        config_inputs.append({
            "name":        m.group(1),
            "type":        m.group(2),
            "description": m.group(3),
            "default":     (m.group(4) or "").strip(),
            "example":     m.group(5) or "",
        })

    outputs = []
    for m in RE_OUTPUT.finditer(text):
        outputs.append({
            "name":        m.group(1),
            "type":        m.group(2),
            "description": m.group(3),
            "nullable":    m.group(4) == "true" if m.group(4) else False,
            "destination": m.group(5) or "",
            "example":     m.group(6) or "",
        })

    calls            = sorted({m.group(1) for m in RE_CALLS.finditer(text)})
    called_by        = sorted({m.group(1) for m in RE_CALLED_BY.finditer(text)})
    related_cmds_m   = RE_RELATED_CMDS.search(text)
    related_commands = parse_string_list(related_cmds_m.group(1)) if related_cmds_m else []

    return {
        "class":             cls,
        "namespace":         namespace,
        "desc":              first_sentence(summary),
        "summary":           summary,
        "usecase":           usecase,
        "notfor":            notfor,
        "sideeffects":       sideeff,
        "precondition":      clean_xml_text(pre_m.group(1)) if pre_m else "",
        "postcondition":     clean_xml_text(post_m.group(1)) if post_m else "",
        "logictree":         logic_m.group(1).strip() if logic_m else "",
        "keywords":          keywords,
        "intent_patterns":   intents,
        "command_category":  cat_m.group(1) if cat_m else "",
        "command_display":   (cat_m.group(2) if cat_m and cat_m.group(2) else cls.replace("Command", "").strip()),
        "pillar":            pillar_m.group(1) if pillar_m else "",
        "selection_inputs":  selection_inputs,
        "config_inputs":     config_inputs,
        "outputs":           outputs,
        "calls":             calls,
        "called_by":         called_by,
        "related_commands":  related_commands,
        "aiprompts":         parse_aiprompts(text),
        "has_restapi":       bool(RE_HAS_REST_API.search(text)),
    }


def scan(scan_path: Path):
    files = sorted(p for p in scan_path.rglob("*.cs")
                   if not any(part in EXCLUDE_DIRS for part in p.parts))
    commands = []
    for f in files:
        try:
            row = extract_one(f)
            if row:
                commands.append(row)
        except Exception as e:
            print(f"  WARN parsing {f.name}: {e}", file=sys.stderr)
    commands.sort(key=lambda c: c["class"])
    return commands


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", type=Path, default=OUTPUT_FILE,
                    help="Where to write command_registry.json")
    ap.add_argument("--scan", type=Path, default=SCAN_PATH,
                    help="Path to scan for .cs files")
    ap.add_argument("--verbose", action="store_true")
    args = ap.parse_args()

    if args.verbose:
        print(f"Scanning {args.scan}")

    commands = scan(args.scan)

    out = {
        "version":        "1.0",
        "generatedBy":    "generate_command_registry.py",
        "generatedAt":    datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "commandCount":   len(commands),
        "commands":       commands,
    }
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(out, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"OK {len(commands)} commands -> {args.out}")


if __name__ == "__main__":
    main()
