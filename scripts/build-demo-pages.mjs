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

  const html = tmpl
    .replaceAll('{{slug}}',          esc(demo.slug))
    .replaceAll('{{title}}',         esc(demo.title))
    .replaceAll('{{desc}}',          esc(demo.desc))
    .replaceAll('{{duration}}',      esc(demo.duration || ''))
    .replaceAll('{{category_title}}',esc(cat.title))
    .replaceAll('{{steps_html}}',    stepsHtml)
    .replaceAll('{{generated_at}}',  esc(demo.generated_at || ''))
    .replaceAll('{{generated_by}}',  esc(demo.generated_by || ''));

  const out = path.join(ROOT, 'dist', 'demos', slug, 'index.html');
  await fs.mkdir(path.dirname(out), { recursive: true });
  await fs.writeFile(out, html, 'utf8');
  return out;
}

function esc(s) { return String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
