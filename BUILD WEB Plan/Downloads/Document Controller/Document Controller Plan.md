# Document Controller Plan

> Parent: [Downloads Plan](../Downloads%20Plan.md)
> Status: **TODO**

## Purpose

WPF desktop app installer (DocumentController.WPF). Standalone tool that runs outside Revit; consumes the public API. Lives in `MEPBridge/DocumentController/DocumentController.WPF/`.

## 1. Source of Truth

GitHub Releases asset names matching `DocumentController-<version>-Setup.exe` (single-platform, no per-Revit-year matrix needed).

## 2. Build Pipeline

In MEP Bridge release workflow: build with `dotnet publish -r win-x64`, package with Velopack or similar self-update framework, EV-sign.

## 3. Runtime Surface

The desktop app calls Adelphos API endpoints (Public Read + Authenticated Command) — see [REST API Plan](../../REST%20API/REST%20API%20Plan.md).

## 4. UI Surface

`/downloads/document-controller/` page with screenshots, feature list, video.

## 5. Risk Research

| # | Area | Finding | Mitigation |
|---|------|---------|------------|
| 1 | WPF .NET runtime | Bundle `Microsoft.WindowsDesktop.App.Runtime` or rely on system; choose | Self-contained publish (single ~80 MB EXE); user friction minimised. |
| 2 | Auto-update | Velopack vs Squirrel vs manual | Velopack — actively maintained; supports delta updates. |

## 6. File Layout

Same shape as Revit Add-In Plan with single-platform installer.

## 7. Configuration

`data/downloads.yaml#document-controller` channels stable/beta only (no year matrix).

## 8. Workflow

Same as Revit Add-In Plan.

## 9. Bugs/Issues

_None — TODO._

## 10. Tests

| Test | Description | Status |
|------|-------------|--------|
| Installer runs end-to-end | Fresh Windows VM | **TODO** |
| Auto-update path | Install v1.0, check, upgrade to v1.1 | **TODO** |

## Quick Reference

| Artefact | Status |
|----------|--------|
| WPF installer pipeline + page | **TODO** |
