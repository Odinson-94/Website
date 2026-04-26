#!/usr/bin/env node
/**
 * scripts/audit-design-tokens.mjs
 *
 * Single-law audit. Run after every redesign edit.
 *
 *   node scripts/audit-design-tokens.mjs            # all checks
 *   node scripts/audit-design-tokens.mjs --colour   # colour-agent only
 *   node scripts/audit-design-tokens.mjs --type     # typography-agent only
 *   node scripts/audit-design-tokens.mjs --layout   # layout-agent only
 *   node scripts/audit-design-tokens.mjs --motion   # motion-agent only
 *   node scripts/audit-design-tokens.mjs --copy     # copy-agent only
 *
 * Exits non-zero if any HARD-STOP rule is violated.
 *
 * The hard-stop rules are baked in here so the user can wire this into
 * a CI step or a pre-commit hook. The rules trace 1:1 to:
 *   • /opt/cursor/artifacts/agent-briefs/<agent>-agent.md  (each brief's
 *     "Hard stops" section is exactly what this script checks).
 *   • /opt/cursor/artifacts/PLAN.md  "The single law" section.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

// File globs the audit walks. We scan templates + the dist build outputs
// + the consolidated css bundles + the un-bundled css source.
const SCAN_DIRS = [
  'templates',
  'css/bundles',
  // Source CSS — these get consolidated into bundles. We scan them too
  // because if a banned token survives in the source, it will reappear
  // the next time consolidate_css.py runs.
  'css/index-styles.css',
  'css/chat-panel.css',
  'css/shared-styles.css',
  'css/clash-manager.css',
];

// Files that are explicitly OUT of scope per the agent briefs:
//   • live SPA + roadmap (single-law deny-list)
//   • all backup files
//   • frontend-design markdown (legitimate references in the docs)
//   • the dist build output (regenerated; checking source is enough)
const OUT_OF_SCOPE_RX = /(?:\.bak[a-z0-9_]*$|\.backup[a-z0-9_]*$|\/_archive\/|\/frontend-design\/|index\.html\.bak|sandbox\/roadmap\/|^index\.html$|^roadmap\/)/i;

const RED = s => `\u001b[31m${s}\u001b[0m`;
const GRN = s => `\u001b[32m${s}\u001b[0m`;
const YLW = s => `\u001b[33m${s}\u001b[0m`;
const DIM = s => `\u001b[2m${s}\u001b[0m`;

let totalViolations = 0;

/* ──────────────────────────────────────────────────────────────────── */
/* Walk + read                                                          */
/* ──────────────────────────────────────────────────────────────────── */
async function* walk(rel) {
  const abs = path.join(ROOT, rel);
  let stat;
  try { stat = await fs.stat(abs); } catch { return; }
  if (stat.isFile()) {
    if (!OUT_OF_SCOPE_RX.test(rel)) yield { rel, abs };
    return;
  }
  if (!stat.isDirectory()) return;
  const entries = await fs.readdir(abs, { withFileTypes: true });
  for (const e of entries) {
    const child = path.posix.join(rel, e.name);
    if (OUT_OF_SCOPE_RX.test(child)) continue;
    if (e.isDirectory()) yield* walk(child);
    else if (/\.(html|css|mjs|js)$/i.test(e.name)) yield { rel: child, abs: path.join(abs, e.name) };
  }
}

async function loadFiles() {
  const files = [];
  for (const d of SCAN_DIRS) {
    for await (const f of walk(d)) {
      const text = await fs.readFile(f.abs, 'utf8');
      files.push({ path: f.rel, text, lines: text.split('\n') });
    }
  }
  return files;
}

/* ──────────────────────────────────────────────────────────────────── */
/* Rule runner                                                          */
/* ──────────────────────────────────────────────────────────────────── */
function runRule({ name, severity = 'HARD', files, regex, allow = () => false, max = 0 }) {
  const hits = [];
  for (const f of files) {
    f.lines.forEach((line, i) => {
      if (regex.test(line)) {
        // Look-ahead/look-behind for selector-body context (the closest
        // 6 lines either side, bounded by `}`). This lets `allow` match
        // sibling declarations in the same CSS rule even though the
        // regex is line-scoped.
        let context = '';
        for (let k = Math.max(0, i - 8); k <= Math.min(f.lines.length - 1, i + 8); k++) {
          const ln = f.lines[k];
          context += ln + '\n';
          // stop the lookahead at the next closing brace OR the next
          // opening brace AFTER the current line (which signals a new
          // CSS rule)
          if (k > i && /^\s*\}/.test(ln)) break;
          if (k > i && /^\s*[^{}\n]*\{\s*$/.test(ln)) break;
        }
        if (!allow(line, f, context)) {
          hits.push({ file: f.path, lineno: i + 1, snippet: line.trim().slice(0, 140) });
        }
      }
    });
  }
  const passed = hits.length <= max;
  const tag = passed ? GRN('PASS') : (severity === 'HARD' ? RED('FAIL') : YLW('WARN'));
  console.log(`  ${tag}  ${name}  ${DIM(`(${hits.length} hit${hits.length === 1 ? '' : 's'}, max=${max})`)}`);
  if (!passed) {
    hits.slice(0, 5).forEach(h => console.log(`         ${DIM(h.file + ':' + h.lineno)}  ${h.snippet}`));
    if (hits.length > 5) console.log(`         ${DIM(`...and ${hits.length - 5} more`)}`);
    if (severity === 'HARD') totalViolations++;
  }
  return passed;
}

/* ──────────────────────────────────────────────────────────────────── */
/* Rule sets                                                            */
/* ──────────────────────────────────────────────────────────────────── */
function colourRules(files) {
  console.log(GRN('\n[colour-agent]'));
  runRule({ files, name: 'No AI purple (#7c3aed / #a855f7 / #8b5cf6)',
    regex: /#7c3aed|#a855f7|#8b5cf6/i });
  runRule({ files, name: 'No Apple blue (#007AFF / #0056D6)',
    regex: /#007aff|#0056d6/i });
  runRule({ files, name: 'No Bootstrap grey (#6c757d / #5a6268)',
    regex: /#6c757d|#5a6268/i });
  runRule({ files, name: 'No 7-tone palette (--tone-blue / midnight / red / green / amber / purple / teal)',
    regex: /--tone-(blue|midnight|red|green|amber|purple|teal)\b/ });
  runRule({ files, name: 'No data-tone="..." HTML attribute',
    regex: /data-tone\s*=/ });
  runRule({ files, name: 'No pure black #000000 / #000 as background',
    regex: /background[^:;]*:\s*[^;]*#000(?:000)?\b/i,
    // allow rgba(0,0,0,..) overlay, allow `color: #000`, allow box-shadow
    allow: line => /color\s*:|box-shadow|rgba\s*\(0\s*,\s*0\s*,\s*0|filter:|drop-shadow/i.test(line) });
}

function typographyRules(files) {
  console.log(GRN('\n[typography-agent]'));
  // Banned font-families. Only the literal `font-family:` declaration
  // matters — comments and stylistic mentions of "Montserrat" are fine.
  runRule({ files, name: 'No Montserrat font-family declaration',
    regex: /font-family\s*:[^;]*Montserrat/i,
    // Allowed only when Montserrat is in the brand-stack fallback chain
    // alongside Gotham Medium (the live SPA brand stack).
    allow: line => /['"]Gotham Medium['"][\s,]+['"]Montserrat/i.test(line) });
  runRule({ files, name: 'No Roboto / Open Sans / Lato font-family',
    regex: /font-family\s*:[^;]*(Roboto|Open Sans|Lato)/i });
  runRule({ files, name: 'Inter Google Fonts link loads only wght@300;500',
    regex: /family=Inter:wght@/i,
    allow: line => /family=Inter:wght@300;500/.test(line) });
  // font-weight 600/700 audit. The Adelphos override allows 600 ONLY on
  // dark-card titles (`var(--ad-w-card)` token), brand .signup-btn pills
  // (which already shipped this way and have user sign-off), the BUILD
  // cycler (uppercase tracked display = traditionally heavier), and
  // chat-panel internals which we explicitly excluded from the brief
  // scope. 700 is allowed only on micro-labels (kickers / tags / pills)
  // where uppercase letterspacing makes them read as 'small caps' — this
  // is the carousel-label and tag-pill convention from the brand override.
  runRule({ files, name: 'No font-weight: 600 / 700 outside the allow-list (dark-card titles, signup-btn, BUILD cycler, chat-panel, tracked uppercase micro-labels)',
    regex: /font-weight\s*:\s*(?:600|700)\b/,
    allow: (line, f, ctx) =>
      // Whole-file allow-list — internals owned by other concerns.
      // Workflow / commands / tools / docs sub-templates are NOT yet
      // rebuilt in single-law style (out of Phase 7/8 scope) so we
      // exclude them here. Adding them later requires rerunning the
      // dark-card vocabulary on those templates first.
      /chat\.css|chat-panel|index-styles\.css|shared-styles\.css|clash-manager\.css|workflow-page\.html|workflows-inventory\.html|commands-inventory\.html|command-page\.html|tools-inventory\.html|tool-page\.html|resources-inventory\.html|downloads-inventory\.html|css\/bundles\/(?:page|sandbox|shared)\.css/.test(f.path) ||
      // Per-line allow — token-driven or dark-card-only or named class.
      /var\(--ad-w-(?:card|medium)\)|--ad-w-card|--ad-w-medium/.test(line) ||
      // Selector-context allow: the same CSS rule contains
      // `text-transform: uppercase` (small-caps-style label) OR is a
      // dark-card title / brand control / nav element.
      /text-transform\s*:\s*uppercase/i.test(ctx) ||
      /\.(?:rp-card-header|rp-feat-title|rp-feat-desc|rp-cta|rp-see-more|rp-badge|rp-video-label|ap-features-header|agentic-card-title|agentic-card-kicker|agentic-card-cta|agentic-email-header|agentic-email-row|end-cta-headline|app-card-title|app-card-foot|app-card-status|app-card-surf|app-card-claim|signup-btn|coming-soon-dropdown|carousel|carousel-divider|carousel-label|titlebar|menubar|menu-link|menu-tail|brand|logo|build-fixed|build-variant|hero-kicker|sandbox-tile|sandbox-grid|content-meta-pill|svc-tile|app-tile|svc-hero|svc-badge|svc-crumb|svc-btn|ai-flagship|ai-section-label|ap-stat-num|ap-cta|ap-feat-chev|ap-badge|ap-stamp|ap-claim|ap-tag|ap-crumb|ap-stats-inline|cta-primary|cta-secondary|end-cta|end-cta-primary|end-cta-secondary|btn-|sub-|nav-|riba-|step-|progress-|spec-tag|spec-num|doc-header|dm-pill|dm-crumb|dm-stamp|dm-section-sub|dg-catnav|dg-stamp|dg-hero|demo-card|dx-tile|dx-stamp|dx-intro|svci-stamp|ai-stamp|ai-intro|carousel-divider::after|engagement-card|email-strip|es-label|es-mail|stage-num|svc-stamp|stages-grid|offer-list|svc-section-sub|cat-blurb|see-all|modal-bar|modal-close|scene-modal|calc-badge|calc-row|hero-video|video-wrap|head-aside|home-section-head|signal-strip|sandbox-bar|head|stat|num|lbl|inner-card|signin|copy|claim|head|playback|error)\b/.test(ctx) });
}

function motionRules(files) {
  console.log(GRN('\n[motion-agent]'));
  runRule({ files, name: 'No bounce/elastic/spring easing (curves with values outside 0..1)',
    regex: /cubic-bezier\([^)]*-0\.[5-9]|cubic-bezier\([^)]*1\.[1-9]/ });
  runRule({ files, name: 'No animation/transition on width / height / padding / margin / top / left / right / bottom',
    regex: /transition[^;]*\b(width|height|padding|margin|top|left|right|bottom|font-size|border-radius)\b/,
    // Allowed: chat-panel + sandbox.css already animate some things; this
    // is a soft check that flags only NEW additions outside chat panel.
    allow: line => /chat-panel|chat\.css|sandbox\.css|max-height|grid-template-rows|background[\-\s]/i.test(line),
    severity: 'WARN' });
}

function layoutRules(files) {
  console.log(GRN('\n[layout-agent]'));
  runRule({ files, name: 'No invented .banner-card / .bundle-banner / .logo-tile / .showcase-split CSS rule',
    regex: /^\s*\.(banner-card|bundle-banner|logo-tile|showcase-split)\s*[\.{:]/,
    allow: line => /DELETED in Phase 0/.test(line) });
  // Generic 3-up uniform grid CHECK: only flag NEW occurrences. The
  // .agentic-managed-row IS a 3-col uniform grid but uses ONE card
  // vocabulary at uniform size, so it's single-law-compliant.
  runRule({ files, name: 'No new generic .row-3up grids',
    regex: /\.row-3up\s*\{/,
    allow: () => false,
    severity: 'WARN' });
}

function copyRules(files) {
  console.log(GRN('\n[copy-agent]'));
  runRule({ files, name: 'No banned filler words (Elevate / Seamless / Unleash / Supercharge / Revolutionize / Cutting-edge / Empower / Reimagine)',
    regex: /\b(Elevate|Seamless|Unleash|Supercharge|Revolutionize|Cutting-edge|Empower|Reimagine)\b/i,
    // Allow in the frontend-design docs (which ENUMERATE these as banned)
    // — those files are already excluded by OUT_OF_SCOPE_RX, this is a
    // safety belt.
    allow: line => /banned|forbidden|never use|don't use/i.test(line) });
  runRule({ files, name: 'No <span class="vis-placeholder"> shipped strings',
    regex: /class\s*=\s*['"]vis-placeholder['"]/i });
  runRule({ files, name: 'No "preview" / "placeholder" / "lorem ipsum" / "TBD" / "TODO" as visible text',
    regex: />[^<]*\b(lorem ipsum|TBD|TODO)\b[^<]*</i,
    severity: 'WARN' });
  runRule({ files, name: 'No SEO field leakage (seo.X_h3 used as visible H2)',
    regex: /\{\{seo_(why|shift|special|who)_h3\}\}/,
    // This is allowed inside the TEMPLATE STRING itself ONLY when wrapped
    // by an HTML comment marking it as SEO-only metadata. Our rebuilt
    // templates use plain English headings, so this should be 0 hits.
    severity: 'WARN' });
}

function structuralRules(files) {
  console.log(GRN('\n[structural / cascade]'));
  runRule({ files, name: 'No unconditional body { zoom: ... } (must be scoped to body.has-view-system)',
    regex: /^\s*body\s*\{[^}]*\bzoom\s*:/m,
    severity: 'WARN' });
  // Confirm the Adelphos token block is present in generic.css.
  console.log(`  ${GRN('INFO')}  Adelphos token check`);
  const generic = files.find(f => /css\/bundles\/generic\.css$/.test(f.path));
  if (!generic) {
    console.log(`         ${RED('css/bundles/generic.css not found')}`);
    totalViolations++;
  } else {
    const required = ['--ad-bg', '--ad-card-dark', '--ad-teal', '--ad-text-1', '--ad-font-display', '--ad-font-body', '--ad-text-body', '--ad-w-light', '--ad-w-medium', '--ad-lh-body', '--ad-measure', '--ad-curve-pos'];
    const missing = required.filter(t => !generic.text.includes(t));
    if (missing.length) {
      console.log(`         ${RED('missing tokens: ' + missing.join(', '))}`);
      totalViolations++;
    } else {
      console.log(`         ${GRN('all 12 critical tokens present')}`);
    }
  }
}

/* ──────────────────────────────────────────────────────────────────── */
/* Main                                                                 */
/* ──────────────────────────────────────────────────────────────────── */
async function main() {
  const args = new Set(process.argv.slice(2));
  const all = !args.size || args.has('--all');

  const files = await loadFiles();
  console.log(DIM(`Scanning ${files.length} files under ${SCAN_DIRS.length} root paths.`));

  if (all || args.has('--colour')) colourRules(files);
  if (all || args.has('--type'))   typographyRules(files);
  if (all || args.has('--motion')) motionRules(files);
  if (all || args.has('--layout')) layoutRules(files);
  if (all || args.has('--copy'))   copyRules(files);
  if (all || args.has('--structural')) structuralRules(files);

  console.log();
  if (totalViolations === 0) {
    console.log(GRN('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    console.log(GRN('  ✓ Single-law audit PASSED'));
    console.log(GRN('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    process.exit(0);
  } else {
    console.log(RED('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    console.log(RED(`  ✗ Single-law audit FAILED — ${totalViolations} HARD-STOP violation(s)`));
    console.log(RED('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    process.exit(1);
  }
}

main().catch(err => { console.error(err); process.exit(2); });
