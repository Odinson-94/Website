#!/usr/bin/env node
/**
 * seo-heading-audit.mjs
 *
 * Reports heading-hierarchy issues across every user-facing page in the
 * sitemap (plus features/* not in sitemap). Read-only — no edits.
 *
 * Issues flagged per page:
 *   - h1-missing       : zero <h1> in body
 *   - h1-multiple      : more than one <h1>
 *   - h1-empty         : <h1> with only whitespace / no text
 *   - skipped-level    : a heading skips a level (e.g. h1 → h3)
 *   - empty-heading    : any <hN> with no visible text
 *   - h1-mismatch-title: the H1 text is wildly different from <title>
 *
 * Usage:
 *   node scripts/seo-heading-audit.mjs           # human-readable report
 *   node scripts/seo-heading-audit.mjs --json    # machine-readable JSON
 *   node scripts/seo-heading-audit.mjs --csv     # CSV
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

const ARGS  = new Set(process.argv.slice(2));
const JSON_OUT = ARGS.has('--json');
const CSV_OUT  = ARGS.has('--csv');

const EXCLUDE_SEGMENTS = [
  '_archive', '_drafts', '_patches', 'sandbox', 'frontend-design',
  'node_modules', '.git', '.vercel', '.vs', '.vscode',
];
// docs/ is the build-generated zone — heading consistency comes from the
// templates, so it's audited too but a single template fix patches all of it.

async function listPages() {
  const out = [];
  async function walk(dir) {
    let entries;
    try { entries = await fs.readdir(dir, { withFileTypes: true }); }
    catch { return; }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      const rel  = path.relative(REPO_ROOT, full).replace(/\\/g, '/');
      const segs = rel.split('/');
      if (segs.some(s => EXCLUDE_SEGMENTS.includes(s))) continue;
      if (e.isDirectory()) {
        await walk(full);
      } else if (e.isFile()) {
        if (!e.name.endsWith('.html')) continue;
        if (/\.(backup|bak)/i.test(e.name)) continue;
        if (e.name !== 'index.html') continue;
        out.push(full);
      }
    }
  }
  await walk(REPO_ROOT);
  return out.sort();
}

function decodeEntities(s) {
  return s
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ');
}

function getBody(html) {
  const m = html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
  return m ? m[1] : html;
}

function getTitle(html) {
  const m = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  return m ? decodeEntities(m[1].replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim() : '';
}

// Extract headings in document order from the body. Skips headings inside
// elements that are visibly hidden (display:none / hidden attribute).
function extractHeadings(body) {
  const result = [];
  const re = /<h([1-6])\b([^>]*)>([\s\S]*?)<\/h\1>/gi;
  let m;
  while ((m = re.exec(body)) !== null) {
    const level = Number(m[1]);
    const attrs = m[2];
    const inner = m[3];
    if (/\bhidden\b/i.test(attrs)) continue;
    if (/style=["'][^"']*display\s*:\s*none/i.test(attrs)) continue;
    const text = decodeEntities(inner.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
    result.push({ level, text, attrs: attrs.trim() });
  }
  return result;
}

function analyzeHeadings(html) {
  const body = getBody(html);
  const title = getTitle(html);
  const headings = extractHeadings(body);
  const issues = [];

  const h1s = headings.filter(h => h.level === 1);
  if (h1s.length === 0) {
    issues.push({ rule: 'h1-missing', detail: 'Page has zero <h1> in body' });
  } else if (h1s.length > 1) {
    issues.push({
      rule: 'h1-multiple',
      detail: `Found ${h1s.length} <h1> elements (texts: ${h1s.slice(0, 3).map(h => `"${h.text.slice(0, 50)}"`).join(', ')})`,
    });
  }

  for (const h of h1s) {
    if (!h.text) {
      issues.push({ rule: 'h1-empty', detail: '<h1> has no text content' });
    }
  }

  // empty headings (any level)
  const emptyH = headings.filter(h => !h.text);
  if (emptyH.length) {
    issues.push({
      rule: 'empty-heading',
      detail: `${emptyH.length} heading(s) with empty text (levels: ${[...new Set(emptyH.map(h => 'h' + h.level))].join(', ')})`,
    });
  }

  // skipped-level: each heading must be ≤ previous heading level + 1
  let prev = 0;
  let skips = [];
  for (const h of headings) {
    if (prev !== 0 && h.level > prev + 1) {
      skips.push(`h${prev}→h${h.level} ("${h.text.slice(0, 50)}")`);
    }
    prev = h.level;
  }
  if (skips.length) {
    issues.push({
      rule: 'skipped-level',
      detail: `Heading hierarchy skips: ${skips.slice(0, 3).join('; ')}${skips.length > 3 ? ` (+${skips.length - 3} more)` : ''}`,
    });
  }

  // h1 text vs title — only a soft check (rough divergence indicator)
  if (h1s.length === 1 && title) {
    const h1t = h1s[0].text.toLowerCase();
    const tt  = title.toLowerCase().replace(/\s*[—\-–|]\s*adelphos ai\s*$/i, '').trim();
    // Only flag if completely unrelated (no token overlap)
    if (h1t && tt) {
      const a = new Set(h1t.split(/\W+/).filter(w => w.length > 3));
      const b = new Set(tt.split(/\W+/).filter(w => w.length > 3));
      const overlap = [...a].some(w => b.has(w));
      if (!overlap) {
        issues.push({
          rule: 'h1-mismatch-title',
          detail: `H1 "${h1s[0].text.slice(0, 60)}" shares no significant words with title "${title.slice(0, 60)}"`,
        });
      }
    }
  }

  return { headings, title, h1Count: h1s.length, issues };
}

async function main() {
  const pages = await listPages();

  const results = [];
  for (const abs of pages) {
    let html;
    try { html = await fs.readFile(abs, 'utf8'); }
    catch { continue; }
    const rel = path.relative(REPO_ROOT, abs).replace(/\\/g, '/');
    const r = analyzeHeadings(html);
    results.push({
      file: rel,
      title: r.title,
      h1Count: r.h1Count,
      headingCount: r.headings.length,
      sequence: r.headings.map(h => `h${h.level}`).join(' '),
      issues: r.issues,
    });
  }

  if (JSON_OUT) {
    process.stdout.write(JSON.stringify(results, null, 2));
    return;
  }
  if (CSV_OUT) {
    const rows = [['file', 'title', 'h1_count', 'heading_count', 'rules', 'first_issue_detail']];
    for (const r of results) {
      const rules = r.issues.map(i => i.rule).join('|') || 'OK';
      const first = r.issues[0]?.detail || '';
      rows.push([r.file, r.title, String(r.h1Count), String(r.headingCount), rules, first]);
    }
    process.stdout.write(rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n'));
    return;
  }

  // Human report
  const total = results.length;
  const withIssues = results.filter(r => r.issues.length > 0);
  const ok = total - withIssues.length;

  // Tally rule counts
  const ruleCount = new Map();
  for (const r of withIssues) {
    for (const i of r.issues) ruleCount.set(i.rule, (ruleCount.get(i.rule) || 0) + 1);
  }

  console.log('===== Heading hierarchy audit =====');
  console.log(`Pages scanned:        ${total}`);
  console.log(`Pages clean:          ${ok}`);
  console.log(`Pages with issues:    ${withIssues.length}`);
  console.log('');
  console.log('Rule frequency (pages affected):');
  for (const [r, n] of [...ruleCount.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(4, ' ')}  ${r}`);
  }
  console.log('');
  console.log('--- Detail by page (issues only) ---');
  for (const r of withIssues) {
    console.log(`\n${r.file}`);
    console.log(`  title: ${r.title}`);
    console.log(`  sequence: ${r.sequence || '(no headings)'}`);
    for (const i of r.issues) console.log(`  • [${i.rule}] ${i.detail}`);
  }
}

main().catch(e => { console.error('FATAL', e); process.exit(1); });
