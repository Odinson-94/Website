#!/usr/bin/env node
/**
 * seo-update-og-images.mjs
 *
 * Updates og:image and twitter:image on app + agentic-service pages to
 * point at their per-page card (rendered by seo-build-og-cards.mjs).
 *
 * All other pages keep using /images/og/default.png — no edits there.
 *
 * Idempotent. Run again after re-rendering cards, no diff is produced
 * if the files already reference the right image.
 *
 * Usage:
 *   node scripts/seo-update-og-images.mjs --dry-run
 *   node scripts/seo-update-og-images.mjs
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const DRY = process.argv.includes('--dry-run');
const SITE_ORIGIN = 'https://adelphos.ai';

// page-relative-path -> og slug (without .png)
const MAP = {
  // Apps
  'apps/revit-copilot/index.html':       'app-revit-copilot',
  'apps/adelphos-chat/index.html':       'app-adelphos-chat',
  'apps/specbuilder/index.html':         'app-specbuilder',
  'apps/report-builder/index.html':      'app-report-builder',
  'apps/document-controller/index.html': 'app-document-controller',
  'apps/qa-manager/index.html':          'app-qa-manager',
  'apps/schedule-builder/index.html':    'app-schedule-builder',
  'apps/cobie-manager/index.html':       'app-cobie-manager',
  'apps/autocad-copilot/index.html':     'app-autocad-copilot',
  'apps/word-add-in/index.html':         'app-word-add-in',
  'apps/excel-add-in/index.html':        'app-excel-add-in',
  // Agentic services
  'agentic-services/finances/index.html':              'svc-finances',
  'agentic-services/project-management/index.html':    'svc-project-management',
  'agentic-services/document-controller/index.html':   'svc-document-controller-managed',
  'agentic-services/email-specifications/index.html':  'svc-email-specifications',
  'agentic-services/email-revit-modelling/index.html': 'svc-email-revit-modelling',
  'agentic-services/email-cobie/index.html':           'svc-email-cobie',
  'agentic-services/email-schematics/index.html':      'svc-email-schematics',
};

function setOgImage(html, fullUrl) {
  let changed = 0;
  // og:image  -- handle both attribute orders
  html = html.replace(
    /(<meta\s[^>]*\bproperty=["']og:image["'][^>]*\bcontent=["'])[^"']*(["'][^>]*>)/gi,
    (m, p1, p2) => { changed++; return p1 + fullUrl + p2; }
  );
  html = html.replace(
    /(<meta\s[^>]*\bcontent=["'])[^"']*(["'][^>]*\bproperty=["']og:image["'][^>]*>)/gi,
    (m, p1, p2) => { changed++; return p1 + fullUrl + p2; }
  );
  // twitter:image
  html = html.replace(
    /(<meta\s[^>]*\bname=["']twitter:image["'][^>]*\bcontent=["'])[^"']*(["'][^>]*>)/gi,
    (m, p1, p2) => { changed++; return p1 + fullUrl + p2; }
  );
  html = html.replace(
    /(<meta\s[^>]*\bcontent=["'])[^"']*(["'][^>]*\bname=["']twitter:image["'][^>]*>)/gi,
    (m, p1, p2) => { changed++; return p1 + fullUrl + p2; }
  );
  return { html, changed };
}

async function main() {
  let touched = 0, unchanged = 0, missing = 0;

  for (const [relPath, slug] of Object.entries(MAP)) {
    const abs = path.join(REPO_ROOT, relPath);
    const fullUrl = `${SITE_ORIGIN}/images/og/${slug}.png`;
    let html;
    try { html = await fs.readFile(abs, 'utf8'); }
    catch { console.log(`  ! missing file: ${relPath}`); missing++; continue; }

    if (html.includes(fullUrl)) {
      // Already points to per-page card — but make sure BOTH og + twitter use it.
      // Quick check: count occurrences. We expect 2 (og:image, twitter:image).
      const count = (html.match(new RegExp(fullUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
      if (count >= 2) { unchanged++; continue; }
    }

    const { html: next, changed } = setOgImage(html, fullUrl);
    if (changed === 0) {
      console.log(`  ! ${relPath} — no og:image / twitter:image found, skipping (run seo-head-baseline first)`);
      missing++;
      continue;
    }
    if (DRY) {
      console.log(`  + ${relPath} -> ${slug}.png  (${changed} replacement(s))`);
    } else {
      await fs.writeFile(abs, next, 'utf8');
      console.log(`  ✓ ${relPath} -> ${slug}.png  (${changed} replacement(s))`);
    }
    touched++;
  }

  console.log('');
  console.log(`Touched:    ${touched}`);
  console.log(`Unchanged:  ${unchanged}`);
  console.log(`Missing:    ${missing}`);
  if (DRY) console.log('\n[DRY RUN — no files written]');
}

main().catch(e => { console.error('FATAL', e); process.exit(1); });
