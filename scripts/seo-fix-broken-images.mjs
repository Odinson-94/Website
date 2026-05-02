#!/usr/bin/env node
/**
 * seo-fix-broken-images.mjs
 *
 * Fixes broken <img src> references found by the SEO audit.
 *
 * Strategy:
 *   1. Map known path mismatches to their real on-disk assets
 *      (e.g. /images/logos/AutoCAD.jpg -> /logos/AutoCAD.jpg).
 *   2. Stub references where no real asset exists (and there are
 *      already onerror handlers acting as fallbacks) get pointed
 *      at /images/placeholder.png — a 1x1 transparent PNG. Visual
 *      effect is identical to the existing onerror display:none,
 *      but the browser stops 404-ing the resource.
 *   3. Template-placeholder leaks like /{{icon}} and
 *      /app-assets/{{slug}}/... — entire <img> tag removed.
 *
 * Left untouched (require user input — no clear remapping):
 *   /images/logos/BIM360.png            (which Autodesk asset?)
 *   /images/logos/{Civil3D,IESVE,ProEst,Robot,Trimble}.jpg
 *
 * Usage:
 *   node scripts/seo-fix-broken-images.mjs --dry-run
 *   node scripts/seo-fix-broken-images.mjs
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const DRY = process.argv.includes('--dry-run');

const PLACEHOLDER = '/images/placeholder.png';

// 1. Definitive path remappings (real asset exists at the new path)
const REMAPS = {
  // Autodesk + MS Office logos live at /logos/, not /images/logos/
  '/images/logos/AutoCAD.jpg': '/logos/AutoCAD.jpg',
  '/images/logos/Excel.jpg':   '/logos/Excel.jpg',
  '/images/logos/Revit.jpg':   '/logos/Revit.jpg',
  '/images/logos/Word.jpg':    '/logos/Word.jpg',
  // Doc-controller platform logos live at /images/doc-controller-platforms/
  '/images/logos/Asite.png':       '/images/doc-controller-platforms/asite.webp',
  '/images/logos/SharePoint.png':  '/images/doc-controller-platforms/sharepoint.png',
  '/images/logos/V4PO.png':        '/images/doc-controller-platforms/viewpoint.png',
};

// 2. Path *prefixes* whose any-suffix should map to placeholder.
// These are the stub directories that don't exist on disk.
const STUB_PREFIXES = ['/app-assets/', '/workflow-assets/'];

// 3. Template-placeholder leaks — entire <img> removed
const REMOVE_PATTERNS = [
  /\/\{\{[^}]+\}\}/,             // /{{icon}} or any path with {{...}} in it
];

const EXCLUDE_TOP_DIRS = new Set([
  '_archive', '_drafts', '_patches', 'sandbox', 'frontend-design',
  'node_modules', '.git', '.vercel', '.vs', '.vscode',
]);

async function listHtml() {
  const out = [];
  async function walk(dir) {
    let entries;
    try { entries = await fs.readdir(dir, { withFileTypes: true }); }
    catch { return; }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      const rel  = path.relative(REPO_ROOT, full).replace(/\\/g, '/');
      if (rel.split('/').some(s => EXCLUDE_TOP_DIRS.has(s))) continue;
      if (e.isDirectory()) { await walk(full); continue; }
      if (!e.isFile() || !e.name.endsWith('.html')) continue;
      if (/\.(backup|bak)/i.test(e.name)) continue;
      out.push(full);
    }
  }
  await walk(REPO_ROOT);
  return out;
}

function classifySrc(src) {
  if (REMAPS[src]) return { action: 'remap', to: REMAPS[src] };
  if (REMOVE_PATTERNS.some(re => re.test(src))) return { action: 'remove' };
  if (STUB_PREFIXES.some(p => src.startsWith(p))) return { action: 'placeholder', to: PLACEHOLDER };
  return null;
}

async function main() {
  const files = await listHtml();
  let touched = 0, remaps = 0, placeholders = 0, removed = 0;

  for (const abs of files) {
    let html = await fs.readFile(abs, 'utf8');
    const orig = html;

    // 1. Pass: handle <img> tags individually (we may need to remove some entirely)
    html = html.replace(
      /<img\b[^>]*\bsrc=(["'])([^"']+)\1[^>]*>/gi,
      (full, q, src) => {
        const c = classifySrc(src);
        if (!c) return full;
        if (c.action === 'remap') {
          remaps++;
          return full.replace(`src=${q}${src}${q}`, `src=${q}${c.to}${q}`);
        }
        if (c.action === 'placeholder') {
          placeholders++;
          // Also strip onerror — no longer needed since src no longer 404s
          return full
            .replace(`src=${q}${src}${q}`, `src=${q}${c.to}${q}`)
            .replace(/\s+onerror=("[^"]*"|'[^']*')/i, '');
        }
        if (c.action === 'remove') {
          removed++;
          return '';
        }
        return full;
      }
    );

    if (html !== orig) {
      touched++;
      const rel = path.relative(REPO_ROOT, abs).replace(/\\/g, '/');
      if (DRY) console.log(`  + ${rel}`);
      else { await fs.writeFile(abs, html, 'utf8'); console.log(`  ✓ ${rel}`); }
    }
  }

  console.log('');
  console.log(`Files touched:                 ${touched}`);
  console.log(`Path remaps applied:           ${remaps}`);
  console.log(`Placeholders pointed:          ${placeholders}`);
  console.log(`Template-placeholder removed:  ${removed}`);
  if (DRY) console.log('\n[DRY RUN — no files written]');
}

main().catch(e => { console.error('FATAL', e); process.exit(1); });
