#!/usr/bin/env python3
"""
generate_rest_api_registry.py
=============================
Scans for [RestApi(...)] decorated classes. Extracts the public REST API
surface into rest_api_registry.json. Drives:
  • the OpenAPI 3.1 spec at /api/openapi.json
  • the Supabase Edge Function input validators
  • the per-command page REST API block

OUTPUT
------
    MEPBridge.Revit/AIChat/Registries/rest_api_registry.json
"""
import argparse
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

SCRIPT_DIR   = Path(__file__).parent.resolve()
PROJECT_ROOT = SCRIPT_DIR.parent
SCAN_PATH    = PROJECT_ROOT / "MEPBridge.Revit"
OUTPUT_FILE  = SCAN_PATH / "AIChat" / "Registries" / "rest_api_registry.json"
EXCLUDE_DIRS = {"bin", "obj", ".vs", ".backups"}

RE_CLASS_NAME = re.compile(r"public\s+(?:sealed\s+)?(?:abstract\s+)?class\s+(\w+)\s*[:\s{]")

RE_REST_API = re.compile(
    r'\[RestApi\(\s*"([^"]+)"'
    r'(?:[^)]*Method\s*=\s*"([^"]+)")?'
    r'(?:[^)]*RequiresAuth\s*=\s*(true|false))?'
    r'(?:[^)]*IsAsync\s*=\s*(true|false))?'
    r'(?:[^)]*Description\s*=\s*"([^"]+)")?'
    r'(?:[^)]*Tier\s*=\s*"([^"]+)")?'
)
RE_REST_PARAM = re.compile(
    r'\[RestApiParam\(\s*"([^"]+)"\s*,\s*"([^"]+)"\s*,\s*"([^"]+)"'
    r'(?:[^)]*Required\s*=\s*(true|false))?'
    r'(?:[^)]*Example\s*=\s*"([^"]+)")?'
)
RE_REST_RESP = re.compile(
    r'\[RestApiResponse\(\s*"([^"]+)"\s*,\s*"([^"]+)"\s*,\s*"([^"]+)"'
)


def extract(file_path: Path):
    text = file_path.read_text(encoding="utf-8", errors="replace")
    m_api = RE_REST_API.search(text)
    if not m_api:
        return None
    m_cls = RE_CLASS_NAME.search(text)
    if not m_cls:
        return None

    return {
        "class":         m_cls.group(1),
        "command_name":  m_api.group(1),                # snake_case external name
        "method":        m_api.group(2) or "POST",
        "requires_auth": m_api.group(3) != "false",
        "is_async":      m_api.group(4) != "false",
        "description":   m_api.group(5) or "",
        "tier":          m_api.group(6) or "pro",
        "path":          f"/api/v1/commands/{m_api.group(1)}",
        "params": [
            {
                "name":        m.group(1),
                "type":        m.group(2),
                "description": m.group(3),
                "required":    m.group(4) == "true" if m.group(4) else False,
                "example":     m.group(5) or "",
            }
            for m in RE_REST_PARAM.finditer(text)
        ],
        "responses": [
            {"name": m.group(1), "type": m.group(2), "description": m.group(3)}
            for m in RE_REST_RESP.finditer(text)
        ],
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", type=Path, default=OUTPUT_FILE)
    ap.add_argument("--scan", type=Path, default=SCAN_PATH)
    args = ap.parse_args()

    files = sorted(p for p in args.scan.rglob("*.cs")
                   if not any(part in EXCLUDE_DIRS for part in p.parts))
    commands = []
    for f in files:
        try:
            row = extract(f)
            if row:
                commands.append(row)
        except Exception as e:
            print(f"  WARN {f.name}: {e}", file=sys.stderr)

    commands.sort(key=lambda c: c["command_name"])
    out = {
        "version":      "1.0",
        "generatedBy":  "generate_rest_api_registry.py",
        "generatedAt":  datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "commandCount": len(commands),
        "commands":     commands,
    }
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(out, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"✓ {len(commands)} REST API commands → {args.out}")


if __name__ == "__main__":
    main()
