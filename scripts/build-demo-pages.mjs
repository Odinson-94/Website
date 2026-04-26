import fs from 'node:fs/promises';
import path from 'node:path';
import { ROOT, loadJson } from './lib/registry.mjs';

const TEMPLATE = path.join(ROOT, 'templates', 'demo-page.html');

export async function buildDemoPage(slug) {
  const jsonPath = path.join(ROOT, 'data', 'demos', `${slug}.json`);
  const demo = JSON.parse(await fs.readFile(jsonPath, 'utf8'));

  // Lookup category title from demos.json
  const all = await loadJson('sandbox/data/demos.json');
  const cat = all.categories.find(c => c.slug === demo.category) || { title: demo.category || 'Demo' };

  const tmpl = await fs.readFile(TEMPLATE, 'utf8');
  const stepsHtml = (demo.steps || []).map(s => `<li>${esc(s)}</li>`).join('\n    ');

  // Phase 8.3: pick up to 3 sibling demos in the same category for the
  // Related strip at the bottom. Falls back to first 3 demos overall if
  // the category has only one demo.
  const sameCat = (all.demos || []).filter(d => d.slug !== demo.slug && d.category === demo.category);
  const fallback = (all.demos || []).filter(d => d.slug !== demo.slug).slice(0, 3);
  const related = (sameCat.length ? sameCat : fallback).slice(0, 3);
  const relatedHtml = related.length
    ? related.map(d => `
      <a class="dm-related-card" href="/dist/demos/${esc(d.slug)}/index.html">
        <div class="dm-related-poster" aria-hidden="true">
          <span class="dm-related-duration">${esc(d.duration || '')}</span>
        </div>
        <div class="dm-related-body">
          <span class="dm-related-cat">${esc((all.categories.find(c => c.slug === d.category) || {}).title || d.category || '')}</span>
          <span class="dm-related-title">${esc(d.title)}</span>
          <span class="dm-related-desc">${esc((d.desc || '').slice(0, 90))}${(d.desc || '').length > 90 ? '…' : ''}</span>
        </div>
      </a>`).join('')
    : '';

  const html = tmpl
    .replaceAll('{{slug}}',              esc(demo.slug))
    .replaceAll('{{title}}',             esc(demo.title))
    .replaceAll('{{desc}}',              esc(demo.desc))
    .replaceAll('{{duration}}',          esc(demo.duration || ''))
    .replaceAll('{{category_title}}',    esc(cat.title))
    .replaceAll('{{steps_html}}',        stepsHtml)
    .replaceAll('{{related_demos_html}}', relatedHtml)
    .replaceAll('{{generated_at}}',      esc(demo.generated_at || ''))
    .replaceAll('{{generated_by}}',      esc(demo.generated_by || ''));

  const out = path.join(ROOT, 'dist', 'demos', slug, 'index.html');
  await fs.mkdir(path.dirname(out), { recursive: true });
  await fs.writeFile(out, html, 'utf8');
  return out;
}

function esc(s) { return String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
