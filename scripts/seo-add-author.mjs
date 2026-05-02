#!/usr/bin/env node
/**
 * seo-add-author.mjs
 *
 * E-E-A-T pass for content pages. For each page in scope:
 *   1. Inject a visible byline immediately after the first <h1>:
 *        <p class="seo-byline" data-seo-byline>By <a rel="author" ...>Jordan Jones</a> ...
 *      Idempotent via the data-seo-byline attribute.
 *   2. Add `author: { @type: Person, ... }` to every JSON-LD block whose
 *      @type is one of CONTENT_TYPES. Existing author fields are preserved.
 *   3. Remove `https://github.com/adelphos-ai` from any `sameAs` array
 *      (per user instruction — no GitHub references).
 *
 * Scope: apps/<slug>/, agentic-services/<slug>/, demos/<slug>/,
 *        workflows/<slug>/, compare/<vs-*>/, features/<slug>/, changelog/.
 *        Skips: home, about, contact, privacy, terms, roadmap, glossary,
 *        inventory pages (apps/, etc.), authors/.
 *
 * Usage:
 *   node scripts/seo-add-author.mjs --dry-run
 *   node scripts/seo-add-author.mjs
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const DRY = process.argv.includes('--dry-run');
const VERB = process.argv.includes('--verbose');

const AUTHOR = {
  '@type': 'Person',
  '@id': 'https://adelphos.ai/authors/jordan-jones/#person',
  name: 'Jordan Jones',
  honorificSuffix: 'CEng BEng MCIBSE',
  jobTitle: 'Chief Executive Officer',
  url: 'https://adelphos.ai/authors/jordan-jones/',
  image: 'https://adelphos.ai/images/Portraits/Jordan%20Jones.jpg',
  worksFor: { '@type': 'Organization', name: 'Adelphos AI', url: 'https://adelphos.ai' },
};

const BYLINE_HTML = '<p class="seo-byline" data-seo-byline>By <a href="/authors/jordan-jones/" rel="author">Jordan Jones</a> — <span class="seo-byline-creds">CEng BEng MCIBSE, Chief Executive Officer, Adelphos AI</span></p>';

// JSON-LD @type values that should carry an author.
const CONTENT_TYPES = new Set([
  'Article', 'BlogPosting', 'NewsArticle', 'TechArticle', 'ScholarlyArticle',
  'HowTo', 'Recipe',
  'SoftwareApplication', 'WebApplication', 'MobileApplication',
  'Service',
  'WebPage',  // covers things like /features/<slug>/ if they ever get WebPage schema
]);

const GITHUB_URL = 'https://github.com/adelphos-ai';

const EXCLUDE_TOP_DIRS = new Set([
  '_archive', '_drafts', '_patches', 'sandbox', 'frontend-design',
  'node_modules', '.git', '.vercel', '.vs', '.vscode', 'docs',
  'authors',  // self
]);

// Top-dirs whose <slug>/index.html files should get author treatment.
// inventory pages (top/index.html) are EXCLUDED.
const SCOPE_TOP_DIRS = new Set([
  'apps', 'agentic-services', 'demos', 'workflows', 'compare', 'features',
]);

/* -------------------------------------------------------------------------- */

async function listScopedPages() {
  const out = [];
  async function walk(dir) {
    let entries;
    try { entries = await fs.readdir(dir, { withFileTypes: true }); }
    catch { return; }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      const rel  = path.relative(REPO_ROOT, full).replace(/\\/g, '/');
      const segs = rel.split('/');
      if (segs.some(s => EXCLUDE_TOP_DIRS.has(s))) continue;
      if (e.isDirectory()) { await walk(full); continue; }
      if (!e.isFile()) continue;
      if (e.name !== 'index.html') continue;
      if (/\.(backup|bak)/i.test(e.name)) continue;
      // Must be top/<slug>/index.html where top is in SCOPE_TOP_DIRS
      if (segs.length < 3) continue;
      if (!SCOPE_TOP_DIRS.has(segs[0])) continue;
      out.push(full);
    }
  }
  await walk(REPO_ROOT);

  // Plus changelog/index.html (single inventory-like page that's actually content)
  const cl = path.join(REPO_ROOT, 'changelog', 'index.html');
  try { await fs.access(cl); out.push(cl); } catch {}

  return out.sort();
}

/* -------------------------------------------------------------------------- */
/* Byline injection                                                            */
/* -------------------------------------------------------------------------- */

function injectBylineAfterH1(html) {
  if (html.includes('data-seo-byline')) return { html, changed: false, reason: 'already has byline' };
  // Find the first <h1>...</h1> in <body>
  const bodyMatch = html.match(/<body\b[^>]*>[\s\S]*?<\/body>/i);
  if (!bodyMatch) return { html, changed: false, reason: 'no <body>' };
  const bodyStart = bodyMatch.index;
  const bodyText = bodyMatch[0];
  const h1Match = bodyText.match(/<h1\b[^>]*>[\s\S]*?<\/h1>/i);
  if (!h1Match) return { html, changed: false, reason: 'no <h1> in body' };
  const insertPosInBody = h1Match.index + h1Match[0].length;
  const insertPosAbs = bodyStart + insertPosInBody;
  const next = html.slice(0, insertPosAbs) + '\n' + BYLINE_HTML + html.slice(insertPosAbs);
  return { html: next, changed: true };
}

/* -------------------------------------------------------------------------- */
/* JSON-LD transformation                                                      */
/* -------------------------------------------------------------------------- */

function isContentType(typeField) {
  if (!typeField) return false;
  const types = Array.isArray(typeField) ? typeField : [typeField];
  return types.some(t => CONTENT_TYPES.has(t));
}

function stripGithubFromSameAs(node) {
  if (Array.isArray(node)) { node.forEach(stripGithubFromSameAs); return; }
  if (node && typeof node === 'object') {
    if (Array.isArray(node.sameAs)) {
      node.sameAs = node.sameAs.filter(u => u !== GITHUB_URL);
      if (node.sameAs.length === 0) delete node.sameAs;
    }
    for (const k of Object.keys(node)) {
      if (k !== 'sameAs') stripGithubFromSameAs(node[k]);
    }
  }
}

function transformJsonLd(obj) {
  // Returns { obj, changed: boolean }
  let changed = false;

  // Strip github from any nested sameAs (Organization, Person, etc.)
  const before = JSON.stringify(obj);
  stripGithubFromSameAs(obj);
  if (JSON.stringify(obj) !== before) changed = true;

  // Add author to top-level if @type is content + no author yet
  const handle = (node) => {
    if (Array.isArray(node)) { node.forEach(handle); return; }
    if (!node || typeof node !== 'object') return;
    if (isContentType(node['@type']) && !node.author) {
      // Place author after description/name if possible — but JSON object key order
      // in JS preserves insertion order, so we rebuild with author near the top.
      const out = {};
      const keys = Object.keys(node);
      // Insert author right after @type (keeps it visually near the top in serialised JSON)
      let inserted = false;
      for (const k of keys) {
        out[k] = node[k];
        if (k === '@type' && !inserted) { out.author = AUTHOR; inserted = true; }
      }
      if (!inserted) out.author = AUTHOR;
      // mutate node in place
      for (const k of keys) delete node[k];
      Object.assign(node, out);
      changed = true;
    }
    // Walk @graph if present
    if (Array.isArray(node['@graph'])) handle(node['@graph']);
  };
  handle(obj);

  return { obj, changed };
}

function processJsonLdScripts(html) {
  let totalChanges = 0;
  const re = /<script\b[^>]*\btype=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  const next = html.replace(re, (full, jsonText) => {
    let parsed;
    try { parsed = JSON.parse(jsonText.trim()); }
    catch { return full; }  // malformed JSON-LD, leave alone
    const { obj, changed } = transformJsonLd(parsed);
    if (!changed) return full;
    totalChanges++;
    const reserialized = JSON.stringify(obj, null, 2);
    return full.replace(jsonText, '\n' + reserialized + '\n');
  });
  return { html: next, changed: totalChanges };
}

/* -------------------------------------------------------------------------- */

async function main() {
  const pages = await listScopedPages();
  console.log(`Discovered ${pages.length} content pages in scope`);

  let touched = 0, unchanged = 0, skipped = 0;
  let bylinesAdded = 0, jsonLdUpdated = 0;
  const reasonMisses = new Map();

  for (const abs of pages) {
    let html;
    try { html = await fs.readFile(abs, 'utf8'); }
    catch (e) { console.error(`  ! read fail: ${abs}: ${e.message}`); skipped++; continue; }

    const rel = path.relative(REPO_ROOT, abs).replace(/\\/g, '/');

    // 1. JSON-LD pass (adds author + strips github)
    const ldStep = processJsonLdScripts(html);
    html = ldStep.html;

    // 2. Byline pass
    const blStep = injectBylineAfterH1(html);
    html = blStep.html;

    if (!blStep.changed && ldStep.changed === 0) {
      unchanged++;
      if (VERB) console.log(`  = ${rel}`);
      continue;
    }

    if (blStep.changed) bylinesAdded++;
    if (ldStep.changed > 0) jsonLdUpdated += ldStep.changed;
    touched++;

    if (!blStep.changed && blStep.reason) {
      reasonMisses.set(blStep.reason, (reasonMisses.get(blStep.reason) || 0) + 1);
    }

    if (DRY) {
      console.log(`  + ${rel}  (byline: ${blStep.changed ? 'add' : 'skip [' + blStep.reason + ']'}, JSON-LD blocks updated: ${ldStep.changed})`);
    } else {
      await fs.writeFile(abs, html, 'utf8');
      console.log(`  ✓ ${rel}  (byline: ${blStep.changed ? 'add' : 'skip [' + blStep.reason + ']'}, JSON-LD blocks updated: ${ldStep.changed})`);
    }
  }

  console.log('');
  console.log(`Touched:           ${touched}`);
  console.log(`Unchanged:         ${unchanged}`);
  console.log(`Skipped:           ${skipped}`);
  console.log(`Bylines added:     ${bylinesAdded}`);
  console.log(`JSON-LD blocks updated: ${jsonLdUpdated}`);
  if (reasonMisses.size) {
    console.log('Byline insert misses:');
    for (const [r, n] of reasonMisses) console.log(`  ${n}× ${r}`);
  }
  if (DRY) console.log('\n[DRY RUN — no files written]');
}

main().catch(e => { console.error('FATAL', e); process.exit(1); });
