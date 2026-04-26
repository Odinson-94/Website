# Changelog Plan

> Parent: [Documentation Plan](../Documentation%20Plan.md)
> Status: **TODO**

## Purpose

Auto-built changelog from conventional commits + git tags across BOTH the Website repo and the MEP Bridge repo.

## 1. Source of Truth

- Local: `git log` from this repo with conventional commit prefixes.
- Cross-repo: GitHub Releases API on `jordan-jones-94/MEPBridge` for tagged releases.

## 2. Build Pipeline

`scripts/build-changelog.mjs`:
1. Run `git log --pretty=format:'%H|%s|%an|%ai' --reverse v0.0.0..HEAD` (or since previous tag).
2. Parse conventional commits: group by type (feat / fix / chore / docs / refactor / perf / test / ci / build).
3. Fetch MEP Bridge releases via API; merge by date.
4. Render to `dist/docs/changelog/index.html` and `dist/docs/changelog/feed.xml` (RSS).

## 3. Runtime Surface

`/docs/changelog/feed.xml` for RSS readers.

## 4. UI Surface

Reverse-chronological. Group by month. Each entry: type badge, scope, message, commit short SHA → GitHub link (only if user is on internal network; else hide link).

## 5. Risk Research

| # | Area | Finding | Mitigation |
|---|------|---------|------------|
| 1 | Bad commit messages in history | Pre-conventions commits like `f4f49d8 t` | Skip commits whose message doesn't match convention regex; document the cutoff date. |
| 2 | Long PRs squashed | Squash message is the changelog entry | Enforce conventional PR title via CI (`commitlint --from PR title`). |
| 3 | Cross-repo links | MEP Bridge is private | Only show release titles + dates publicly; full notes redacted unless authenticated. |

## 6. File Layout

```
scripts/build-changelog.mjs              # — TODO
templates/changelog.html                  # — TODO
dist/docs/changelog/index.html             # — TODO
dist/docs/changelog/feed.xml               # — TODO
```

## 7. Configuration

```js
export const CHANGELOG = {
  conventionalCutoff: "2026-04-20",   // ignore commits before this date (history is messy)
  groupBy: "month",
  showHashes: false                    // private repo
};
```

## 8. Workflow

Each merged PR with a conventional title becomes one changelog entry on the next deploy.

## 9. Bugs/Issues

_None — TODO._

## 10. Tests

| Test | Description | Status |
|------|-------------|--------|
| Parses fixture log | Synthetic git log → expected groupings | **TODO** |
| RSS valid | feed.xml passes W3C validator | **TODO** |
| Cross-repo merge | Mock MEP releases → merged correctly by date | **TODO** |

## Quick Reference

| Artefact | Status |
|----------|--------|
| Generator + template + RSS feed | **TODO** |
