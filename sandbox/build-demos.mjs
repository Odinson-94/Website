/**
 * sandbox/build-demos.mjs
 *
 * Demonstrates the production automation principle:
 *   data/demos.json  +  demos/_template.html  →  one HTML file per demo
 *
 * Run from the website root:
 *   node sandbox/build-demos.mjs
 *
 * Outputs:  sandbox/demos/<slug>.html  (one per demo)
 *
 * In production, this same script reads from data/demos/*.yaml
 * synced from the MEP Bridge repo and writes to dist/demos/<slug>/.
 */
import fs   from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT     = path.dirname(fileURLToPath(import.meta.url));
const DATA     = path.join(ROOT, 'data', 'demos.json');
const TEMPLATE = path.join(ROOT, 'demos', '_template.html');
const OUT_DIR  = path.join(ROOT, 'demos');

const data    = JSON.parse(await fs.readFile(DATA, 'utf8'));
const template = await fs.readFile(TEMPLATE, 'utf8');

const catBySlug = Object.fromEntries(data.categories.map(c => [c.slug, c]));

let written = 0, skipped = 0;
for (let i = 0; i < data.demos.length; i++) {
  const demo = data.demos[i];
  const cat  = catBySlug[demo.category] || { slug: 'unknown', title: 'Unknown' };
  const prev = data.demos[(i - 1 + data.demos.length) % data.demos.length];
  const next = data.demos[(i + 1) % data.demos.length];

  // Reasonable default steps; once data has explicit steps[], use them
  const steps = demo.steps || [
    `Open the chat panel and ask "${demo.title.toLowerCase()}"`,
    `BUILD MEP shows what it's about to do, then runs it against the active model`,
    `Review the result inline; commit, undo, or refine with a follow-up prompt`
  ];

  const statusPill = demo.status === 'coming-soon'
    ? '<span class="pill pill-coming">Coming Soon</span>'
    : '<span class="pill pill-live">Live</span>';

  const html = template
    .replaceAll('{{TITLE}}',          escape(demo.title))
    .replaceAll('{{SLUG}}',           demo.slug)
    .replaceAll('{{DESC}}',           escape(demo.desc))
    .replaceAll('{{CATEGORY_SLUG}}',  cat.slug)
    .replaceAll('{{CATEGORY_TITLE}}', escape(cat.title))
    .replaceAll('{{DURATION}}',       escape(demo.duration))
    .replaceAll('{{STATUS_PILL}}',    statusPill)
    .replaceAll('{{STEP_1}}',         escape(steps[0]))
    .replaceAll('{{STEP_2}}',         escape(steps[1] || ''))
    .replaceAll('{{STEP_3}}',         escape(steps[2] || ''))
    .replaceAll('{{PREV_HREF}}',      `/sandbox/demos/${prev.slug}.html`)
    .replaceAll('{{PREV_TITLE}}',     escape(prev.title))
    .replaceAll('{{NEXT_HREF}}',      `/sandbox/demos/${next.slug}.html`)
    .replaceAll('{{NEXT_TITLE}}',     escape(next.title));

  const outPath = path.join(OUT_DIR, `${demo.slug}.html`);
  await fs.writeFile(outPath, html, 'utf8');
  written++;
}

console.log(`✓ Generated ${written} demo detail pages from ${data.demos.length} demos in data/demos.json`);
console.log(`  Output: sandbox/demos/<slug>.html`);
console.log(`  Skipped: ${skipped}`);

function escape(s) {
  return (s || '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
}
