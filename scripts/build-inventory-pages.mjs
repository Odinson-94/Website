/**
 * scripts/build-inventory-pages.mjs
 *
 * Generates the four hierarchical index pages from the live registries:
 *   /docs/tools/index.html       — all MCP tools
 *   /docs/commands/index.html    — all Revit commands
 *   /demos/index.html             — categorised demo gallery
 *   /docs/index.html              — top-level docs landing
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { ROOT, loadJson } from './lib/registry.mjs';

const T = (n) => path.join(ROOT, 'templates', n);
const O = (...p) => path.join(ROOT, 'dist', ...p);

const PRE_LAUNCH = true;  // flip to false to reveal full names, descriptions, and crawlability
const redact = (s) => PRE_LAUNCH ? 'Coming soon' : s;
let _toolIdx = 0;
let _cmdIdx = 0;
const redactToolName = (name) => PRE_LAUNCH ? `Tool ${String(++_toolIdx).padStart(3, '0')}` : name;
const redactCmdName  = (name) => PRE_LAUNCH ? `Command ${String(++_cmdIdx).padStart(3, '0')}` : name;

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

/* ─────────────────────────────────────────────────────────────────  TOOLS  */
export async function buildToolsInventory() {
  let tools = await loadJson('sandbox/data/tools.json');
  if (!Array.isArray(tools)) tools = [tools];

  const bridges    = [...new Set(tools.map(t => t.bridge || ''))].filter(Boolean).sort();
  const categories = [...new Set(tools.map(t => t.category))].sort();
  const counts = [
    { n: tools.length,                          l: 'Tools' },
    { n: tools.filter(t => t.always).length,    l: 'Always available' },
    { n: tools.filter(t => t.category === 'context').length, l: 'Context (read)' },
    { n: tools.filter(t => t.category === 'action').length,  l: 'Action (write)' },
    { n: bridges.length + 1,                    l: 'Bridges' },
  ];
  const countsHtml = counts.map(c => `<div class="inv-count"><strong>${c.n}</strong><span class="label">${c.l}</span></div>`).join('');

  const bridgeOpts   = bridges.map(b => `<option value="${esc(b)}">${esc(prettyBridge(b))}</option>`).join('');
  const categoryOpts = categories.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');

  _toolIdx = 0;
  const rowsHtml = tools.map(t => {
    const displayName = redactToolName(t.name);
    return `
    <tr data-bridge="${esc(t.bridge || '')}" data-category="${esc(t.category)}" data-always="${t.always}" data-search="${esc((displayName + ' ' + redact(t.desc||'')).toLowerCase())}">
      <td><code>${esc(displayName)}</code></td>
      <td style="color:var(--text-muted);">${esc(redact(t.desc || ''))}</td>
      <td>${t.bridge ? `<span class="pill pill-bridge">${esc(prettyBridge(t.bridge))}</span>` : '<span style="color:var(--text-muted);">—</span>'}</td>
      <td><span class="pill pill-category">${esc(t.category)}</span></td>
      <td>${t.always ? '<span class="pill pill-always">always</span>' : '<span style="color:var(--text-muted);">on demand</span>'}</td>
      <td style="color:var(--text-muted);">${t.param_count || 0}</td>
    </tr>`;
  }).join('');

  const html = (await fs.readFile(T('tools-inventory.html'), 'utf8'))
    .replaceAll('{{count}}',            String(tools.length))
    .replaceAll('{{counts_html}}',      countsHtml)
    .replaceAll('{{bridge_options}}',   bridgeOpts)
    .replaceAll('{{category_options}}', categoryOpts)
    .replaceAll('{{rows_html}}',        rowsHtml)
    .replaceAll('{{generated_at}}',     new Date().toISOString());

  const out = O('docs', 'tools', 'index.html');
  await fs.mkdir(path.dirname(out), { recursive: true });
  await fs.writeFile(out, html, 'utf8');
  return { out, count: tools.length };
}

/* ──────────────────────────────────────────────────────────────  COMMANDS  */
export async function buildCommandsInventory() {
  let cmds = await loadJson('data/registries/command_registry.json');
  if (!Array.isArray(cmds)) cmds = [cmds];

  // Pillar / mini-project blurbs (could be moved to its own JSON later)
  const PILLAR_BLURB = {
    'Drainage':         'Soil, vent and waste pipework — sizing, layout, schedules.',
    'Lighting':         'Luminaires, controls, lux calc and emergency lighting.',
    'Ventilation':      'Supply, extract and AHU duct routing and balancing.',
    'Mechanical Power': 'Pipework for heating, cooling and chilled water systems.',
    'Small Power':      'Containment, sockets and small-power distribution.',
    'Containment':      'Cable tray, basket, conduit and trunking design.',
    'Fire Alarm':       'Detection, sounders, panels and BS 5839 compliance.',
    'Combined':         'Cross-discipline commands that touch multiple services.',
    'General':          'Platform-wide utilities used across every discipline.',
    'Uncategorised':    'Pending classification — will be sorted into a mini-project.'
  };

  const counts = [
    { n: cmds.length,                                                  l: 'Commands' },
    { n: cmds.filter(c => c.usecase && c.notfor && c.aiprompts).length, l: 'fully documented' },
    { n: cmds.filter(c => (c.outputs || []).length > 0).length,        l: 'with documented returns' },
    { n: cmds.filter(c => c.has_restapi).length,                       l: 'public REST API' },
  ];
  const countsHtml = counts.map(c => `<div class="inv-count"><strong>${c.n}<span> /${cmds.length}</span></strong><span class="label">${c.l}</span></div>`).join('');

  // Group by pillar / mini-project
  const groups = {};
  for (const c of cmds) {
    const p = (c.pillar && c.pillar.replace(/\s+/g, ' ').trim()) || 'Uncategorised';
    (groups[p] = groups[p] || []).push(c);
  }
  // Order: most populous first, with "General" + "Uncategorised" at the bottom.
  const orderedPillars = Object.keys(groups).sort((a, b) => {
    const sysA = (a === 'General' || a === 'Uncategorised') ? 1 : 0;
    const sysB = (b === 'General' || b === 'Uncategorised') ? 1 : 0;
    if (sysA !== sysB) return sysA - sysB;
    return groups[b].length - groups[a].length;
  });

  const pillarOptions = orderedPillars
    .map(p => `<option value="${esc(p)}">${esc(p)} (${groups[p].length})</option>`).join('');

  _cmdIdx = 0;
  const renderRow = (c) => {
    const realDisplay = c.command_display || c.class.replace(/Command$/, '').replace(/([A-Z])/g, ' $1').trim();
    const display = redactCmdName(realDisplay);
    const slug = c.class.replace(/Command$/, '').replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
    const inputCount = (c.selection_inputs?.length || 0) + (c.config_inputs?.length || 0);
    const outCount = (c.outputs || []).length;
    const ck = b => b ? '<span class="check">✓</span>' : '<span class="cross">✗</span>';
    return `
    <tr data-rest="${c.has_restapi}" data-search="${esc((display + ' ' + redact(c.desc||'')).toLowerCase())}">
      <td><code>${esc(display)}</code></td>
      <td style="color:var(--text-muted);max-width:540px;">${esc(redact(c.desc || '—'))}</td>
      <td style="text-align:center;">${inputCount > 0 ? `<span class="check">${inputCount}</span>` : '<span style="color:var(--text-muted);">—</span>'}</td>
      <td style="text-align:center;">${outCount    > 0 ? `<span class="check">${outCount}</span>`    : '<span style="color:var(--text-muted);">—</span>'}</td>
      <td style="text-align:center;">${ck(c.has_restapi)}</td>
    </tr>`;
  };

  const groupsHtml = orderedPillars.map(p => {
    const blurb = PILLAR_BLURB[p] || `Commands tagged "${p}".`;
    return `
      <section class="cmd-group" data-pillar="${esc(p)}" id="pillar-${esc(p.toLowerCase().replace(/\s+/g,'-'))}" style="margin:32px 0;">
        <header style="display:flex;align-items:baseline;gap:12px;margin-bottom:6px;">
          <h2 style="margin:0;font-size:22px;font-weight:600;letter-spacing:-0.01em;color:var(--text);">${esc(p)}</h2>
          <span style="font-size:12px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.06em;font-weight:600;">${groups[p].length} commands</span>
        </header>
        <p style="margin:0 0 12px;color:var(--text-muted);font-size:13px;">${esc(blurb)}</p>
        <div style="overflow-x:auto;">
          <table class="ref-table" style="min-width:680px;">
            <thead><tr><th>Command</th><th>Description</th><th>Inputs</th><th>Returns</th><th>Public&nbsp;API</th></tr></thead>
            <tbody>${groups[p].map(renderRow).join('')}</tbody>
          </table>
        </div>
      </section>`;
  }).join('');

  const html = (await fs.readFile(T('commands-inventory.html'), 'utf8'))
    .replaceAll('{{count}}',           String(cmds.length))
    .replaceAll('{{counts_html}}',     countsHtml)
    .replaceAll('{{pillar_options}}',  pillarOptions)
    .replaceAll('{{groups_html}}',     groupsHtml)
    .replaceAll('{{generated_at}}',    new Date().toISOString());

  const out = O('docs', 'commands', 'index.html');
  await fs.mkdir(path.dirname(out), { recursive: true });
  await fs.writeFile(out, html, 'utf8');
  return { out, count: cmds.length };
}

/* ─────────────────────────────────────────────────────────────────  DEMOS  */
export async function buildDemosGallery() {
  const data = await loadJson('sandbox/data/demos.json');
  const demos = data.demos;
  const cats  = data.categories;

  // Group demos by category
  const byCat = Object.fromEntries(cats.map(c => [c.slug, []]));
  demos.forEach(d => { (byCat[d.category] = byCat[d.category] || []).push(d); });

  const sectionsHtml = cats
    .filter(c => byCat[c.slug] && byCat[c.slug].length)
    .map(c => `
      <section class="demo-cat-section" id="cat-${esc(c.slug)}">
        <h2 id="cat-${esc(c.slug)}-h">${esc(c.title)}</h2>
        <p class="cat-blurb">${esc(c.blurb)}</p>
        <div class="demo-cat-grid">
          ${byCat[c.slug].map(d => `
            <a class="demo-card${d.status === 'coming-soon' ? ' coming-soon' : ''}"
               id="demo-${esc(d.slug)}"
               data-toc data-toc-label="${esc(d.title)}" data-toc-level="h3"
               href="/demos/${esc(d.slug)}/index.html">
              <div class="video-wrap">
                <div class="poster-fallback" style="background:url(/demo-assets/${esc(d.slug)}/thumbnail.svg) center/cover, linear-gradient(135deg,#1f3340,#0e1c25);"></div>
                <span class="duration">${esc(d.duration)}</span>
              </div>
              <div class="body">
                <div class="title">${esc(d.title)}</div>
                <div class="desc">${esc(d.desc)}</div>
                <div class="meta">
                  <span class="pill pill-pillar">${esc(c.title)}</span>
                  ${d.status === 'live' ? '<span class="pill pill-live">Live</span>' : '<span class="pill pill-coming">Coming Soon</span>'}
                </div>
              </div>
            </a>
          `).join('')}
        </div>
      </section>
    `).join('');

  // Sticky category nav (Phase 8.3): one anchor link per category that
  // actually has demos. Reduces 60+ tile cognitive load to N category
  // entry points.
  const catnavHtml = `
    <nav class="dg-catnav" aria-label="Demo categories">
      ${cats.filter(c => byCat[c.slug] && byCat[c.slug].length).map(c =>
        `<a href="#cat-${esc(c.slug)}">${esc(c.title)} <span style="opacity:0.55;">${byCat[c.slug].length}</span></a>`
      ).join('')}
    </nav>`;

  const html = (await fs.readFile(T('demos-gallery.html'), 'utf8'))
    .replaceAll('{{count}}',        String(demos.length))
    .replaceAll('{{cat_count}}',    String(cats.length))
    .replaceAll('{{catnav_html}}',  catnavHtml)
    .replaceAll('{{sections_html}}', sectionsHtml)
    .replaceAll('{{generated_at}}', new Date().toISOString());

  const out = O('demos', 'index.html');
  await fs.mkdir(path.dirname(out), { recursive: true });
  await fs.writeFile(out, html, 'utf8');
  return { out, count: demos.length };
}

/* ──────────────────────────────────────────────────────────  DOCS  INDEX  */
export async function buildDocsIndex() {
  let tools = await loadJson('sandbox/data/tools.json').catch(() => []);
  if (!Array.isArray(tools)) tools = [tools];
  let cmds  = await loadJson('data/registries/command_registry.json').catch(() => []);
  if (!Array.isArray(cmds)) cmds = [cmds];
  const demos = (await loadJson('sandbox/data/demos.json')).demos;
  const apps  = (await loadJson('sandbox/data/apps.json')).apps;
  const services = (await loadJson('sandbox/data/agentic-services.json')).services;
  // workflows count — may not exist
  let workflows = [];
  try { workflows = (await loadJson('sandbox/data/workflows.json')).workflows || []; } catch {}

  const html = (await fs.readFile(T('docs-index.html'), 'utf8'))
    .replaceAll('{{tools_count}}',     String(tools.length))
    .replaceAll('{{commands_count}}',  String(cmds.length))
    .replaceAll('{{demos_count}}',     String(demos.length))
    .replaceAll('{{workflows_count}}', String(workflows.length))
    .replaceAll('{{apps_count}}',      String(apps.length))
    .replaceAll('{{services_count}}',  String(services.length))
    .replaceAll('{{generated_at}}',    new Date().toISOString());

  const out = O('docs', 'index.html');
  await fs.mkdir(path.dirname(out), { recursive: true });
  await fs.writeFile(out, html, 'utf8');
  return { out };
}

function prettyBridge(b) {
  return ({ 'RevitContext':'Revit', 'DrawingExporter':'Drawing exporter', 'ParameterEditor':'Parameter editor', 'SelfDebug':'Debug', 'Snapshot':'Snapshot' })[b] || b;
}
