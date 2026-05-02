#!/usr/bin/env node
/**
 * seo-head-baseline.mjs
 *
 * Idempotently injects missing SEO/social <head> metadata across hand-maintained
 * user-facing pages. Templates for build-generated pages (docs/tools, docs/commands)
 * are handled separately.
 *
 * Tags ensured (added only if missing):
 *   - <link rel="canonical">
 *   - <meta name="description">           (derived from first <p> if absent)
 *   - <meta name="robots">                 ("index, follow, max-snippet:-1, ...")
 *   - <meta name="theme-color">            (#156082)
 *   - <link rel="icon">                    (/logos/Node%20Logo.png)
 *   - <link rel="alternate" type="text/plain" href="/llms.txt">
 *   - Open Graph: type, title, description, url, image, image:width/height, site_name, locale
 *   - Twitter:    card, title, description, image
 *   - JSON-LD:    WebPage (only if NO json-ld script already present)
 *
 * Usage:
 *   node scripts/seo-head-baseline.mjs --dry-run   # show diff plan, no writes
 *   node scripts/seo-head-baseline.mjs             # apply changes
 *   node scripts/seo-head-baseline.mjs --verbose   # per-file detail
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

const ARGS  = new Set(process.argv.slice(2));
const DRY   = ARGS.has('--dry-run');
const VERB  = ARGS.has('--verbose');

const SITE_ORIGIN = 'https://adelphos.ai';
const BRAND_NAME  = 'Adelphos AI';
const BRAND_FALLBACK_DESC =
  'Adelphos AI ships apps, agentic services and bespoke automations for MEP — built on the MEP Bridge platform.';
const DEFAULT_OG_IMAGE  = `${SITE_ORIGIN}/images/og/default.png`;
const DEFAULT_LOCALE    = 'en_GB';
const FAVICON_HREF      = '/logos/Node%20Logo.png';
const ROBOTS_VALUE      = 'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1';
const THEME_COLOR       = '#156082';

// Page-set scope: directories considered "user-facing & hand-maintained".
// Each entry is {dir, schemaType, ogType}. dir is repo-relative.
// /docs/ is intentionally excluded — handled by templates + build pipeline.
const SCOPED_DIRS = [
  { dir: '',                    schemaType: 'WebPage',         ogType: 'website' },  // root /index.html only
  { dir: 'about',               schemaType: 'AboutPage',       ogType: 'website' },
  { dir: 'contact',             schemaType: 'ContactPage',     ogType: 'website' },
  { dir: 'privacy',             schemaType: 'WebPage',         ogType: 'website' },
  { dir: 'terms',               schemaType: 'WebPage',         ogType: 'website' },
  { dir: 'roadmap',             schemaType: 'WebPage',         ogType: 'website' },
  { dir: 'changelog',           schemaType: 'Article',         ogType: 'article' },
  { dir: 'glossary',            schemaType: 'DefinedTermSet',  ogType: 'website' },
  { dir: 'resources',           schemaType: 'CollectionPage',  ogType: 'website' },
  { dir: 'downloads',           schemaType: 'CollectionPage',  ogType: 'website' },
  { dir: 'compare',             schemaType: 'CollectionPage',  ogType: 'website' },
  { dir: 'apps',                schemaType: 'CollectionPage',  ogType: 'website' },
  { dir: 'agentic-services',    schemaType: 'CollectionPage',  ogType: 'website' },
  { dir: 'features',            schemaType: 'CollectionPage',  ogType: 'website' },
  { dir: 'demos',               schemaType: 'CollectionPage',  ogType: 'website' },
  { dir: 'workflows',           schemaType: 'CollectionPage',  ogType: 'website' },
];

// Per-detail-page schema overrides (for /<dir>/<slug>/index.html — not the inventory).
const DETAIL_TYPE_BY_PARENT = {
  apps:               { schemaType: 'SoftwareApplication', ogType: 'product' },
  'agentic-services': { schemaType: 'Service',             ogType: 'product' },
  features:           { schemaType: 'WebPage',             ogType: 'article' },
  demos:              { schemaType: 'TechArticle',         ogType: 'article' },
  workflows:          { schemaType: 'HowTo',               ogType: 'article' },
  compare:            { schemaType: 'Article',             ogType: 'article' },
};

// Skip files under any of these path segments.
const EXCLUDE_SEGMENTS = [
  '_archive', '_drafts', '_patches', 'sandbox', 'frontend-design',
  'node_modules', '.git', '.vercel', '.vs', '.vscode', 'docs',
];

const EXCLUDE_BASENAME_RE = /\.(backup|bak)/i;

/* -------------------------------------------------------------------------- */
/* File discovery                                                              */
/* -------------------------------------------------------------------------- */

async function listCandidatePages() {
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
        if (EXCLUDE_BASENAME_RE.test(e.name)) continue;
        // Only main pages: filename must be index.html, OR root-level index.html
        if (e.name !== 'index.html') continue;
        out.push(full);
      }
    }
  }
  await walk(REPO_ROOT);
  return out.sort();
}

/* -------------------------------------------------------------------------- */
/* URL + metadata derivation                                                   */
/* -------------------------------------------------------------------------- */

function relUrlFromPath(absPath) {
  const rel = path.relative(REPO_ROOT, absPath).replace(/\\/g, '/');
  // index.html at repo root → "/"
  if (rel === 'index.html') return '/';
  // dir/index.html → "/dir/index.html" (matches existing site convention)
  return '/' + rel;
}

function canonicalUrlForPath(absPath) {
  return SITE_ORIGIN + relUrlFromPath(absPath);
}

function categorize(absPath) {
  const rel = path.relative(REPO_ROOT, absPath).replace(/\\/g, '/');
  if (rel === 'index.html') return { schemaType: 'WebSite', ogType: 'website', topDir: '', isDetail: false };
  const segs = rel.split('/'); // e.g. ['apps','revit-copilot','index.html']
  const topDir = segs[0];
  // Inventory page: /<dir>/index.html (segs.length === 2)
  if (segs.length === 2) {
    const cfg = SCOPED_DIRS.find(s => s.dir === topDir);
    if (!cfg) return null;
    return { schemaType: cfg.schemaType, ogType: cfg.ogType, topDir, isDetail: false };
  }
  // Detail page: /<dir>/<slug>/index.html (segs.length >= 3)
  if (segs.length >= 3) {
    const detailCfg = DETAIL_TYPE_BY_PARENT[topDir];
    if (detailCfg) return { schemaType: detailCfg.schemaType, ogType: detailCfg.ogType, topDir, isDetail: true };
    // Unknown nested area — fall back to WebPage
    return { schemaType: 'WebPage', ogType: 'website', topDir, isDetail: true };
  }
  return null;
}

/* -------------------------------------------------------------------------- */
/* HTML parsing helpers (regex-based, surgical only)                           */
/* -------------------------------------------------------------------------- */

function getHeadBlock(html) {
  const m = html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i);
  if (!m) return null;
  return { full: m[0], inner: m[1], start: m.index, end: m.index + m[0].length };
}

function hasMeta(head, attr, value) {
  const re = new RegExp(`<meta\\b[^>]*\\b${attr}=["']${escapeRe(value)}["']`, 'i');
  return re.test(head);
}
function hasMetaName(head, name)     { return hasMeta(head, 'name', name); }
function hasMetaProperty(head, prop) { return hasMeta(head, 'property', prop); }
function hasLinkRel(head, rel) {
  const re = new RegExp(`<link\\b[^>]*\\brel=["'](?:[^"']*\\s)?${escapeRe(rel)}(?:\\s[^"']*)?["']`, 'i');
  return re.test(head);
}
function hasLinkRelHref(head, rel, href) {
  const re = new RegExp(
    `<link\\b[^>]*\\brel=["'](?:[^"']*\\s)?${escapeRe(rel)}(?:\\s[^"']*)?["'][^>]*\\bhref=["']${escapeRe(href)}["']` +
    `|<link\\b[^>]*\\bhref=["']${escapeRe(href)}["'][^>]*\\brel=["'](?:[^"']*\\s)?${escapeRe(rel)}(?:\\s[^"']*)?["']`,
    'i');
  return re.test(head);
}
function hasJsonLd(head) {
  return /<script\b[^>]*\btype=["']application\/ld\+json["']/i.test(head);
}
function escapeRe(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function extractTitle(html) {
  const m = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  return m ? decodeEntities(m[1].trim()) : '';
}

function extractExistingMetaContent(head, attr, value) {
  const re = new RegExp(
    `<meta\\b[^>]*\\b${attr}=["']${escapeRe(value)}["'][^>]*\\bcontent=["']([^"']*)["']` +
    `|<meta\\b[^>]*\\bcontent=["']([^"']*)["'][^>]*\\b${attr}=["']${escapeRe(value)}["']`,
    'i');
  const m = head.match(re);
  return m ? (m[1] || m[2] || '') : null;
}

function decodeEntities(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

function escapeAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function deriveDescription(html, fallback) {
  // Try first <p> in body — strip tags, normalize whitespace.
  const bodyMatch = html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
  const body = bodyMatch ? bodyMatch[1] : html;
  const pMatches = body.match(/<p\b[^>]*>([\s\S]{20,400}?)<\/p>/gi) || [];
  for (const raw of pMatches) {
    let txt = raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    txt = decodeEntities(txt);
    if (txt.length >= 60 && txt.length <= 250) {
      return txt.length > 200 ? txt.slice(0, 197).trimEnd() + '…' : txt;
    }
    if (txt.length > 250) return txt.slice(0, 197).trimEnd() + '…';
  }
  return fallback;
}

function deriveOgTitle(fullTitle) {
  // Strip the trailing brand suffix when present, e.g.
  // "Revit Copilot — Apps — Adelphos AI" → "Revit Copilot — Apps".
  let t = fullTitle;
  t = t.replace(/\s*[—\-–|]\s*Adelphos AI\s*$/i, '').trim();
  return t || fullTitle;
}

/* -------------------------------------------------------------------------- */
/* Tag builders                                                                */
/* -------------------------------------------------------------------------- */

function buildJsonLd({ schemaType, name, url, description }) {
  const obj = {
    '@context': 'https://schema.org',
    '@type': schemaType,
    name,
    url,
    description,
    inLanguage: 'en-GB',
    isPartOf: { '@type': 'WebSite', name: BRAND_NAME, url: SITE_ORIGIN },
    publisher: {
      '@type': 'Organization',
      name: BRAND_NAME,
      url: SITE_ORIGIN,
      logo: `${SITE_ORIGIN}${FAVICON_HREF}`,
    },
  };
  return `<script type="application/ld+json">${JSON.stringify(obj)}</script>`;
}

/* -------------------------------------------------------------------------- */
/* Per-file processor                                                          */
/* -------------------------------------------------------------------------- */

function planInjections(html, absPath, cat) {
  const headBlock = getHeadBlock(html);
  if (!headBlock) return { skip: 'no <head> block', injections: [], note: '' };

  const head = headBlock.inner;
  const canonicalUrl = canonicalUrlForPath(absPath);
  const fullTitle = extractTitle(html) || BRAND_NAME;
  const existingDesc = extractExistingMetaContent(head, 'name', 'description');
  const description = existingDesc || deriveDescription(html, BRAND_FALLBACK_DESC);
  const ogTitle = deriveOgTitle(fullTitle);

  const lines = [];
  const reasons = [];

  // canonical
  if (!hasLinkRel(head, 'canonical')) {
    lines.push(`<link rel="canonical" href="${escapeAttr(canonicalUrl)}">`);
    reasons.push('canonical');
  }
  // description
  if (!existingDesc) {
    lines.push(`<meta name="description" content="${escapeAttr(description)}">`);
    reasons.push('description');
  }
  // robots
  if (!hasMetaName(head, 'robots')) {
    lines.push(`<meta name="robots" content="${ROBOTS_VALUE}">`);
    reasons.push('robots');
  }
  // theme-color
  if (!hasMetaName(head, 'theme-color')) {
    lines.push(`<meta name="theme-color" content="${THEME_COLOR}">`);
    reasons.push('theme-color');
  }
  // favicon
  if (!hasLinkRel(head, 'icon') && !hasLinkRel(head, 'shortcut icon')) {
    lines.push(`<link rel="icon" type="image/png" href="${FAVICON_HREF}">`);
    reasons.push('favicon');
  }
  // llms.txt link
  if (!hasLinkRelHref(head, 'alternate', '/llms.txt')) {
    lines.push(`<link rel="alternate" type="text/plain" title="llms.txt" href="/llms.txt">`);
    reasons.push('llms.txt link');
  }
  // Open Graph block
  const ogPairs = [
    ['og:type',          cat.ogType],
    ['og:title',         ogTitle],
    ['og:description',   description],
    ['og:url',           canonicalUrl],
    ['og:image',         DEFAULT_OG_IMAGE],
    ['og:image:width',   '1200'],
    ['og:image:height',  '630'],
    ['og:site_name',     BRAND_NAME],
    ['og:locale',        DEFAULT_LOCALE],
  ];
  for (const [prop, val] of ogPairs) {
    if (!hasMetaProperty(head, prop)) {
      lines.push(`<meta property="${prop}" content="${escapeAttr(val)}">`);
      reasons.push(prop);
    }
  }
  // Twitter (no twitter:site / twitter:creator — handle hasn't been claimed yet)
  const twPairs = [
    ['twitter:card',        'summary_large_image'],
    ['twitter:title',       ogTitle],
    ['twitter:description', description],
    ['twitter:image',       DEFAULT_OG_IMAGE],
  ];
  for (const [name, val] of twPairs) {
    if (!hasMetaName(head, name)) {
      lines.push(`<meta name="${name}" content="${escapeAttr(val)}">`);
      reasons.push(name);
    }
  }
  // JSON-LD: only if no JSON-LD at all
  if (!hasJsonLd(head)) {
    lines.push(buildJsonLd({
      schemaType: cat.schemaType,
      name: ogTitle,
      url: canonicalUrl,
      description,
    }));
    reasons.push('JSON-LD ' + cat.schemaType);
  }

  return { skip: null, injections: lines, reasons };
}

function injectIntoHead(html, lines) {
  if (!lines.length) return html;
  const block = '\n  <!-- SEO baseline (auto-injected by scripts/seo-head-baseline.mjs) -->\n  ' +
    lines.join('\n  ') + '\n';
  return html.replace(/<\/head>/i, block + '</head>');
}

/* -------------------------------------------------------------------------- */
/* Main                                                                        */
/* -------------------------------------------------------------------------- */

async function main() {
  const pages = await listCandidatePages();
  console.log(`Discovered ${pages.length} candidate pages`);

  let touched = 0, unchanged = 0, skipped = 0;
  const reasonTotals = new Map();

  for (const abs of pages) {
    const cat = categorize(abs);
    if (!cat) {
      skipped++;
      if (VERB) console.log(`  - skip (no category): ${path.relative(REPO_ROOT, abs)}`);
      continue;
    }
    let html;
    try { html = await fs.readFile(abs, 'utf8'); }
    catch (e) { console.error(`  ! read fail: ${abs}: ${e.message}`); skipped++; continue; }

    const plan = planInjections(html, abs, cat);
    if (plan.skip) {
      skipped++;
      console.log(`  ! skip (${plan.skip}): ${path.relative(REPO_ROOT, abs)}`);
      continue;
    }
    if (plan.injections.length === 0) {
      unchanged++;
      if (VERB) console.log(`  = ok: ${path.relative(REPO_ROOT, abs)}`);
      continue;
    }
    touched++;
    for (const r of plan.reasons) reasonTotals.set(r, (reasonTotals.get(r) || 0) + 1);
    if (DRY) {
      console.log(`  + ${path.relative(REPO_ROOT, abs)}  (+${plan.injections.length}: ${plan.reasons.join(', ')})`);
    } else {
      const next = injectIntoHead(html, plan.injections);
      await fs.writeFile(abs, next, 'utf8');
      console.log(`  ✓ ${path.relative(REPO_ROOT, abs)}  (+${plan.injections.length})`);
    }
  }

  console.log('');
  console.log(`Touched:    ${touched}`);
  console.log(`Unchanged:  ${unchanged}`);
  console.log(`Skipped:    ${skipped}`);
  console.log('');
  console.log('Reason totals (pages affected per missing-tag rule):');
  for (const [r, n] of [...reasonTotals.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(4, ' ')}  ${r}`);
  }
  if (DRY) console.log('\n[DRY RUN — no files written]');
}

main().catch(e => { console.error('FATAL', e); process.exit(1); });
