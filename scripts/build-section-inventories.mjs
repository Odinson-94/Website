/**
 * scripts/build-section-inventories.mjs
 *
 * Builds the simple inventory pages for sections that are JSON-driven only:
 *   /dist/workflows/index.html
 *   /dist/resources/index.html
 *   /dist/downloads/index.html
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { ROOT, loadJson } from './lib/registry.mjs';

const T = (n) => path.join(ROOT, 'templates', n);
const O = (...p) => path.join(ROOT, 'dist', ...p);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

export async function buildWorkflowsInventory() {
  // Discover workflow JSON files in data/workflows/
  const dir = path.join(ROOT, 'data', 'workflows');
  let files = [];
  try { files = (await fs.readdir(dir)).filter(f => f.endsWith('.json')); } catch {}
  const wfs = [];
  for (const f of files) {
    try {
      const raw = await fs.readFile(path.join(dir, f), 'utf8');
      const wf = JSON.parse(raw.replace(/^\uFEFF/, ''));
      if (!wf.slug) wf.slug = f.replace(/\.json$/, '');
      wfs.push(wf);
    } catch (e) { console.warn('  skipping', f, e.message); }
  }

  const cards = wfs.map(wf => `
    <a class="wf-card" href="/dist/workflows/${esc(wf.slug)}/index.html">
      <h3>${esc(wf.title || wf.slug)}</h3>
      <p class="lead">${esc((wf.lead || '').slice(0, 200))}${(wf.lead || '').length > 200 ? '…' : ''}</p>
      <div class="meta">
        <span class="pill pill-pillar">${esc(wf.category_label || 'Workflow')}</span>
        <span class="pill pill-category">${(wf.phases || []).length || (wf.how_it_flows || []).length} steps</span>
      </div>
    </a>`).join('');

  const tmpl = await fs.readFile(T('workflows-inventory.html'), 'utf8');
  const html = tmpl
    .replaceAll('{{count}}',        String(wfs.length))
    .replaceAll('{{cards_html}}',   cards || '<p style="color:var(--text-muted);">No workflows have been promoted yet. Run <code>adelphos_CLI auto workflow &lt;slug&gt;</code> to add one.</p>')
    .replaceAll('{{generated_at}}', new Date().toISOString());

  const out = O('workflows', 'index.html');
  await fs.mkdir(path.dirname(out), { recursive: true });
  await fs.writeFile(out, html, 'utf8');
  return { out, count: wfs.length };
}

export async function buildResourcesInventory() {
  const data = await loadJson('sandbox/data/resources.json');
  const cards = data.categories.map(c => `
    <div class="res-card">
      ${c.status === 'coming-soon' ? '<span class="badge">Coming Soon</span>' : ''}
      <h3>${esc(c.title)}</h3>
      <p>${esc(c.blurb)}</p>
    </div>`).join('');

  const tmpl = await fs.readFile(T('resources-inventory.html'), 'utf8');
  const html = tmpl
    .replaceAll('{{section_blurb}}', esc(data.section_blurb || ''))
    .replaceAll('{{cards_html}}',    cards)
    .replaceAll('{{generated_at}}',  new Date().toISOString());

  const out = O('resources', 'index.html');
  await fs.mkdir(path.dirname(out), { recursive: true });
  await fs.writeFile(out, html, 'utf8');
  return { out, count: data.categories.length };
}

export async function buildDownloadsInventory() {
  const data = await loadJson('sandbox/data/downloads.json');
  const cards = data.items.map(d => `
    <div class="dl-card">
      ${d.status === 'coming-soon' ? '<span class="badge">Coming Soon</span>' : ''}
      <h3>${esc(d.title)}</h3>
      <p>${esc(d.blurb)}</p>
      <div class="platforms">${(d.platforms || []).map(p => `<span>${esc(p)}</span>`).join('')}</div>
    </div>`).join('');

  const tmpl = await fs.readFile(T('downloads-inventory.html'), 'utf8');
  const html = tmpl
    .replaceAll('{{section_blurb}}', esc(data.section_blurb || ''))
    .replaceAll('{{cards_html}}',    cards)
    .replaceAll('{{generated_at}}',  new Date().toISOString());

  const out = O('downloads', 'index.html');
  await fs.mkdir(path.dirname(out), { recursive: true });
  await fs.writeFile(out, html, 'utf8');
  return { out, count: data.items.length };
}
