# Repo Hygiene Plan

> Parent: [Project Structure Plan](../Project%20Structure%20Plan.md)
> Location: `BUILD WEB Plan/Repo Hygiene/`
> Status: **Partial** — `.gitignore` hardened (this session), `.git/` cleaned of 200+ rogue `desktop.ini` files (this session); push of pending work to `origin/master` and tracked-`desktop.ini` removal still pending user approval.

---

## Purpose

Keep the repo deterministic, fast to clone, and safe to commit from. Block Windows / Google Drive / editor pollution at the gate. Enforce conventional commits so the changelog generator works. Keep media out of git so cloning stays sub-second.

---

## 1. Source of Truth

- `.gitignore` (hardened this session — see appended block from line 365 onwards).
- `.gitattributes` (`* text=auto` — keep, but see Risk #4).
- `.github/workflows/ci.yml` (TODO — convention enforcement).

---

## 2. Build Pipeline

| Gate | Tool | When |
|------|------|------|
| Lint commit messages | `commitlint` with `@commitlint/config-conventional` | pre-push hook + CI on PR |
| Block desktop.ini | grep step | CI on PR |
| Block large binaries | `git diff --stat | awk '$3 > 5242880'` | CI on PR |
| Block secrets | `gitleaks detect` | CI on PR |
| Format check | `prettier --check` (HTML/CSS/JS) | CI on PR |

---

## 3. Runtime Surface

None.

---

## 4. UI Surface

None.

---

## 5. Risk Research — Known Issues & Pitfalls

| # | Area | Finding | Mitigation |
|---|------|---------|------------|
| 1 | Google Drive metadata | `desktop.ini` keeps reappearing inside `.git/` because Drive descends into hidden dirs | Set folder property `System+Hidden` on `.git/` so Drive skips it (see Workflow §8); cron job sweeps weekly. |
| 2 | `* text=auto` in `.gitattributes` | Generates CRLF/LF warnings on every text file | Acceptable noise; alternative is forcing LF everywhere via `* text eol=lf` — chose now to keep noise + cross-platform compatibility. |
| 3 | Tracked desktop.ini | ~20 desktop.ini are **tracked** (visible in `M` status) | One-time sweep: `git rm --cached **/desktop.ini && git commit`. Then `.gitignore` keeps them away. |
| 4 | Branch divergence | Local `master` is 4 ahead, 1 behind `origin/master`; needs rebase | Plan: `git pull --rebase origin master`, resolve conflicts (mostly desktop.ini noise), squash + theme into 3 conventional commits. |
| 5 | Stale feature branch | `cursor/clash-manager-ui-1217` exists on origin | Decide: merge or delete; user owns. |
| 6 | Large media files | 818 MB of `Videos/` would have been committed | Already gitignored this session; user opted "keep locally". CI added: any `.mp4`/`.mov`/`.webm` changeset > 5 MB blocked. |
| 7 | Backup file proliferation | 25 `.bak`/`.backup_*`/`.copy.*` files | Already gitignored; user opted "move to local `_archive/`" — apply at sync time. |
| 8 | Branch protection | `master` has no required-review or required-status-check | Enable branch protection on push: required PR review (1), required CI green. |

---

## 6. File Layout

```
.gitignore                      # — Built (hardened 2026-04-20)
.gitattributes                   # — Built
.github/workflows/ci.yml         # — TODO
.husky/pre-commit                 # — TODO  (lint-staged + commitlint)
.husky/pre-push                  # — TODO  (commitlint range)
package.json scripts             # — TODO  (lint, format, commitlint)
commitlint.config.js              # — TODO
.prettierrc                       # — TODO
.gitleaks.toml                    # — TODO
```

---

## 7. Configuration

`commitlint.config.js`:

```js
export default { extends: ['@commitlint/config-conventional'] };
```

Conventional types in scope: `feat`, `fix`, `chore`, `docs`, `refactor`, `perf`, `test`, `ci`, `style`, `build`, `revert`. Scopes: `docs`, `api`, `demos`, `data`, `site`, `ci`, `auto`, `examples`, `clash`, `chat`, `roadmap`.

---

## 8. Workflow

### Workflow: One-time cleanup (this session, pending user approval to push)

1. ✅ Delete `.git/**/desktop.ini` (DONE).
2. ✅ Harden `.gitignore` (DONE).
3. `attrib +H +S "$WS\.git"` — mark `.git` as System+Hidden so Google Drive backs off.
4. `git rm --cached **/desktop.ini` — untrack the ~20 currently-tracked desktop.ini files.
5. Move `.bak`/`.backup_*`/`* copy.*` (per user choice "move_archive") to `_archive/` and `git rm` if any are tracked.
6. `git pull --rebase origin master` to absorb the one upstream commit (`8c12de4 Add project files.`).
7. Stage real work in three conventional commits:
   - `feat(clash): clash manager UI + JS overhaul`
   - `feat(chat): specbuilder + qa-chat + chat-panel scaffolding`
   - `chore(site): hero, dark-mode cookies, perf instrumentation, asset cleanup`
8. Decide on `cursor/clash-manager-ui-1217` — merge or delete (user choice, separate PR).
9. `git push origin master`.
10. Enable branch protection on `master`: required PR review (1) + required CI green.

### Workflow: Day-to-day commit

1. Stage with `git add` (NEVER `git add .` blindly — use granular adds).
2. `git commit` invokes pre-commit (prettier, gitleaks).
3. Conventional message required (`feat(scope): message`).
4. PR opened; CI runs lints + builds + a11y/perf gates.
5. Squash merge via `gh pr merge --squash`.

---

## 9. Bugs/Issues

| # | Area | Description | Severity |
|---|------|-------------|----------|
| 1 | Tracked desktop.ini | 20 files tracked despite `.gitignore`; need `git rm --cached` sweep | Medium — fixed by §8 step 4. |
| 2 | Local-vs-remote divergence | 4 ahead / 1 behind, dirty WT | Medium — fixed by §8 step 6–9. |
| 3 | Bad commit messages in history | `f4f49d8 t`, `4d73f23 checkpoint…` | Low — leave history alone, enforce going forward. |

---

## 10. Tests

| Test | Description | Status |
|------|-------------|--------|
| `git status` clean post-cleanup | After workflow §8, status shows zero modified | **TODO** |
| `git ls-files | grep desktop.ini` empty | After step 4 | **TODO** |
| `git log -1 --format=%s` matches conventional regex | After every push | **TODO** |
| CI fails on bad commit | PR with `bad msg` blocked | **TODO** |

---

## Quick Reference — Build Status Summary

| Artefact | File | Tier | Status |
|----------|------|------|--------|
| `.gitignore` hardened | `.gitignore` | Internal | **Built** |
| `.git/` cleaned | n/a | Internal | **Built** |
| Tracked desktop.ini removed | git index | Internal | **TODO** |
| Branch synced | `master` | Internal | **TODO** |
| Commit hooks | `.husky/*` | Internal | **TODO** |
| CI hygiene gates | `.github/workflows/ci.yml` | Internal | **TODO** |
| Branch protection | GitHub settings | Internal | **TODO** |
| **Total** | | | **2 Built / 5 TODO** |
