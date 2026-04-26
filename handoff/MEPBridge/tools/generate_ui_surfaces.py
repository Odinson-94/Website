#!/usr/bin/env python3
"""
generate_ui_surfaces.py
=======================
Detects which commands have UI windows / web apps. Two routes:

  1. EXPLICIT (preferred) — class carries [HasUI(...)] or [HasWebApp(...)]
  2. HEURISTIC (fallback) — class body shows .Show()/ShowDialog()/new <X>Window
     AND a matching <X>.xaml file exists in the codebase

OUTPUT
------
    MEPBridge.Revit/AIChat/Registries/ui_surfaces.json

Two top-level keys: `ui_windows` (per-command UI), `web_apps` (React etc.).
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
OUTPUT_FILE  = SCAN_PATH / "AIChat" / "Registries" / "ui_surfaces.json"
EXCLUDE_DIRS = {"bin", "obj", ".vs", ".backups"}

RE_TRANSACTION = re.compile(r"\[Transaction\(")
RE_CLASS_NAME  = re.compile(r"public\s+(?:sealed\s+)?(?:abstract\s+)?class\s+(\w+)\s*[:\s{]")

# Explicit attributes
RE_HAS_UI      = re.compile(
    r'\[HasUI\(\s*"([^"]+)"'
    r'(?:[^)]*Type\s*=\s*"([^"]+)")?'
    r'(?:[^)]*Description\s*=\s*"([^"]+)")?'
    r'(?:[^)]*LiveScreenshot\s*=\s*"([^"]+)")?'
)
RE_HAS_WEBAPP  = re.compile(
    r'\[HasWebApp\(\s*"([^"]+)"'
    r'(?:[^)]*Url\s*=\s*"([^"]+)")?'
    r'(?:[^)]*ReactSource\s*=\s*"([^"]+)")?'
    r'(?:[^)]*Description\s*=\s*"([^"]+)")?'
    r'(?:[^)]*LiveScreenshot\s*=\s*"([^"]+)")?'
)

# Heuristic patterns
RE_SHOW_PATTERNS = re.compile(
    r"new\s+(\w+)(?:View|Window|Panel|Dialog)\s*\("
    r"|(\w+)(?:View|Window|Panel|Dialog)\s*\.\s*Show(?:Dialog)?\s*\("
    r"|Launch(\w+)\s*\("
)


def scan_xaml_files(root: Path):
    """Map className → xaml file path (basename without .xaml)."""
    xaml = {}
    for p in root.rglob("*.xaml"):
        if any(part in EXCLUDE_DIRS for part in p.parts):
            continue
        xaml[p.stem] = str(p.relative_to(root.parent))
    return xaml


def scan_react_apps(root: Path):
    """Find React app folders (contain package.json)."""
    apps = {}
    for p in root.rglob("package.json"):
        if any(part in EXCLUDE_DIRS for part in p.parts) or "node_modules" in p.parts:
            continue
        folder = p.parent
        # Heuristic: react app folders end with .React or contain react in package
        if folder.name.endswith(".React") or "\"react\"" in p.read_text(errors="replace"):
            apps[folder.name] = str(folder.relative_to(root))
    return apps


def extract(file_path: Path, xaml_index: dict, react_apps: dict):
    text = file_path.read_text(encoding="utf-8", errors="replace")
    if not RE_TRANSACTION.search(text):
        return None
    m = RE_CLASS_NAME.search(text)
    if not m:
        return None
    cls = m.group(1)

    result = {"class": cls, "ui": None, "web_app": None}

    # --- Explicit attributes --------
    m_ui = RE_HAS_UI.search(text)
    if m_ui:
        win_class = m_ui.group(1)
        result["ui"] = {
            "source":         "explicit",
            "window_class":   win_class,
            "type":           m_ui.group(2) or "WPF",
            "description":    m_ui.group(3) or "",
            "screenshot":     m_ui.group(4) or "",
            "xaml_path":      xaml_index.get(win_class, ""),
        }

    m_wa = RE_HAS_WEBAPP.search(text)
    if m_wa:
        result["web_app"] = {
            "source":       "explicit",
            "app_slug":     m_wa.group(1),
            "url":          m_wa.group(2) or "",
            "react_source": m_wa.group(3) or "",
            "description":  m_wa.group(4) or "",
            "screenshot":   m_wa.group(5) or "",
        }

    # --- Heuristic fallback (only if explicit not present) --------
    if not result["ui"] and not result["web_app"]:
        for m in RE_SHOW_PATTERNS.finditer(text):
            base = next((g for g in m.groups() if g), None)
            if base and base in xaml_index:
                result["ui"] = {
                    "source":       "heuristic",
                    "window_class": base,
                    "type":         "WPF",
                    "description":  "",
                    "screenshot":   "",
                    "xaml_path":    xaml_index[base],
                }
                break

    if result["ui"] is None and result["web_app"] is None:
        return None
    return result


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", type=Path, default=OUTPUT_FILE)
    ap.add_argument("--scan", type=Path, default=SCAN_PATH)
    ap.add_argument("--root", type=Path, default=PROJECT_ROOT)
    args = ap.parse_args()

    xaml_index = scan_xaml_files(args.scan)
    react_apps = scan_react_apps(args.root)

    print(f"Indexed {len(xaml_index)} XAML files, {len(react_apps)} React apps")

    files = sorted(p for p in args.scan.rglob("*.cs")
                   if not any(part in EXCLUDE_DIRS for part in p.parts))
    surfaces = []
    for f in files:
        try:
            row = extract(f, xaml_index, react_apps)
            if row:
                surfaces.append(row)
        except Exception as e:
            print(f"  WARN {f.name}: {e}", file=sys.stderr)

    surfaces.sort(key=lambda c: c["class"])
    explicit = sum(1 for s in surfaces if (s.get("ui") and s["ui"]["source"] == "explicit") or s.get("web_app"))
    heuristic = sum(1 for s in surfaces if s.get("ui") and s["ui"]["source"] == "heuristic")

    out = {
        "version":     "1.0",
        "generatedBy": "generate_ui_surfaces.py",
        "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "commandsWithSurface": len(surfaces),
        "explicit":    explicit,
        "heuristic":   heuristic,
        "knownReactApps": react_apps,
        "surfaces":    surfaces,
    }
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(out, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"✓ {len(surfaces)} commands with UI/app surface → {args.out}")
    print(f"   ({explicit} explicit attribute, {heuristic} heuristic match)")


if __name__ == "__main__":
    main()
