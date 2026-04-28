#!/usr/bin/env node
/**
 * build-workflow-pages.mjs
 *
 * Reads YAML workflow definitions from data/workflows/, hydrates
 * templates/workflow-page.html and templates/workflows-inventory.html,
 * and writes the output into dist/workflows/.
 *
 * Usage:  node scripts/build-workflow-pages.mjs
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { join, basename, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT      = join(__dirname, '..');

const DATA_DIR         = join(ROOT, 'data', 'workflows');
const TEMPLATE_DETAIL  = join(ROOT, 'templates', 'workflow-page.html');
const TEMPLATE_INDEX   = join(ROOT, 'templates', 'workflows-inventory.html');
const DIST_DIR         = join(ROOT, 'dist', 'workflows');

/* ── Recursive-descent YAML parser (handles nested arrays/objects) ── */
function parseYaml(text) {
  const raw = text.split('\n').map(l => l.replace(/\r$/, ''));
  let pos = 0;

  function indent(i) {
    const m = raw[i]?.match(/^(\s*)/);
    return m ? m[1].length : -1;
  }

  function parseValue(minIndent) {
    while (pos < raw.length) {
      const line = raw[pos];
      if (!line || !line.trim() || line.trim().startsWith('#')) { pos++; continue; }
      if (indent(pos) < minIndent) return undefined;
      if (line.trim().startsWith('- ')) return parseArray(minIndent);
      return parseMap(minIndent);
    }
    return undefined;
  }

  function parseMap(minIndent) {
    const obj = {};
    while (pos < raw.length) {
      const line = raw[pos];
      if (!line || !line.trim() || line.trim().startsWith('#')) { pos++; continue; }
      const ci = indent(pos);
      if (ci < minIndent) break;
      const trimmed = line.trim();
      if (trimmed.startsWith('- ')) break;

      const colonIdx = trimmed.indexOf(':');
      if (colonIdx === -1) { pos++; continue; }

      const key = trimmed.slice(0, colonIdx).trim();
      const rest = trimmed.slice(colonIdx + 1).trim();
      pos++;

      if (rest && rest !== '|' && rest !== '>') {
        obj[key] = rest.replace(/^["']|["']$/g, '');
      } else {
        const child = parseValue(ci + 1);
        obj[key] = child !== undefined ? child : '';
      }
    }
    return obj;
  }

  function parseArray(minIndent) {
    const arr = [];
    while (pos < raw.length) {
      const line = raw[pos];
      if (!line || !line.trim() || line.trim().startsWith('#')) { pos++; continue; }
      const ci = indent(pos);
      if (ci < minIndent) break;
      const trimmed = line.trim();
      if (!trimmed.startsWith('- ')) break;

      const after = trimmed.slice(2).trim();
      const dashIndent = ci;

      if (after.includes(':')) {
        const colonIdx = after.indexOf(':');
        const key = after.slice(0, colonIdx).trim();
        const val = after.slice(colonIdx + 1).trim();
        const item = {};
        if (val && val !== '|' && val !== '>') {
          item[key] = val.replace(/^["']|["']$/g, '');
        } else {
          pos++;
          const child = parseValue(dashIndent + 2);
          item[key] = child !== undefined ? child : '';
          const moreMap = parseMap(dashIndent + 2);
          if (moreMap) Object.assign(item, moreMap);
          arr.push(item);
          continue;
        }
        pos++;
        const moreMap = parseMap(dashIndent + 2);
        if (moreMap) Object.assign(item, moreMap);
        arr.push(item);
      } else {
        arr.push(after.replace(/^["']|["']$/g, ''));
        pos++;
      }
    }
    return arr;
  }

  return parseMap(0);
}

/* ── Template interpolation ───────────────────────────────────────── */
function render(template, vars) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '');
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

/* ── Load all workflow YAML files ─────────────────────────────────── */
function loadWorkflows() {
  if (!existsSync(DATA_DIR)) { mkdirSync(DATA_DIR, { recursive: true }); return []; }
  return readdirSync(DATA_DIR)
    .filter(f => /\.(ya?ml)$/i.test(f))
    .map(f => {
      const text = readFileSync(join(DATA_DIR, f), 'utf-8');
      const wf = parseYaml(text);
      wf._slug = wf.slug || basename(f, extname(f));
      return wf;
    })
    .sort((a, b) => (a.sort_order || 999) - (b.sort_order || 999));
}

/* ── Build one detail page ────────────────────────────────────────── */
function buildDetailPage(wf, allWorkflows, template) {
  const phases = Array.isArray(wf.phases) ? wf.phases : [];
  const totalSteps = phases.reduce((n, p) => {
    const steps = Array.isArray(p.steps) ? p.steps : [];
    return n + steps.length;
  }, 0);

  const phaseNavHtml = phases.map((p, i) =>
    `<a href="#phase-${i + 1}">${escHtml(p.title || `Phase ${i + 1}`)}</a>`
  ).join('\n        ');

  const phasesHtml = phases.map((p, i) => {
    const steps = Array.isArray(p.steps) ? p.steps : [];
    const tools = Array.isArray(p.tools) ? p.tools : [];
    const stepsHtml = steps.map((s, si) => `
          <div class="wf-step">
            <div class="wf-step-number">${si + 1}</div>
            <div class="wf-step-copy">
              <span class="wf-step-title">${escHtml(s.title || s)}</span>
              ${s.description ? `<span class="wf-step-desc">${escHtml(s.description)}</span>` : ''}
            </div>
          </div>`
    ).join('');

    const toolsHtml = tools.map(t =>
      `<li>${escHtml(typeof t === 'string' ? t : t.name || t)}</li>`
    ).join('');

    return `
    <div class="wf-phase" id="phase-${i + 1}">
      <div class="wf-phase-rail">
        <div class="wf-phase-dot"></div>
        <div class="wf-phase-line"></div>
      </div>
      <div class="wf-phase-body">
        <div class="wf-phase-head">
          <span class="wf-phase-kicker">Phase ${i + 1} of ${phases.length}</span>
          <h3>${escHtml(p.title || `Phase ${i + 1}`)}</h3>
          ${p.description ? `<p>${escHtml(p.description)}</p>` : ''}
        </div>
        <div class="wf-phase-content">
          <div class="wf-steps">${stepsHtml}
          </div>
          <div class="wf-phase-aside">
            <div class="wf-phase-media">
              <div class="wf-media-play">
                <svg viewBox="0 0 24 24"><polygon points="6,3 20,12 6,21"/></svg>
              </div>
            </div>
            ${tools.length ? `
            <div class="wf-tools-used">
              <div class="wf-tools-used-label">Tools used</div>
              <ul class="wf-tools-list">${toolsHtml}</ul>
            </div>` : ''}
          </div>
        </div>
      </div>
    </div>`;
  }).join('');

  const prereqs = Array.isArray(wf.prerequisites) ? wf.prerequisites : [];
  const outputs = Array.isArray(wf.outputs) ? wf.outputs : [];
  const prereqsHtml = prereqs.map(p => `<li>${escHtml(typeof p === 'string' ? p : p.name || p)}</li>`).join('');
  const outputsHtml = outputs.map(o => `<li>${escHtml(typeof o === 'string' ? o : o.name || o)}</li>`).join('');

  const related = allWorkflows.filter(w => w._slug !== wf._slug).slice(0, 3);
  const relatedHtml = related.map(r => {
    const rPhases = Array.isArray(r.phases) ? r.phases.length : 0;
    return `
      <a class="wf-related-card" href="/workflows/${r._slug}/index.html">
        <span class="wf-rc-title">${escHtml(r.title || r._slug)}</span>
        <span class="wf-rc-desc">${escHtml(r.description || '')}</span>
        <span class="wf-rc-phases">${rPhases} phases</span>
      </a>`;
  }).join('');

  const status = (wf.status || 'planned').toLowerCase();
  const statusLabels = { live: 'Live', beta: 'Beta', planned: 'Planned' };

  return render(template, {
    seo_head:             `<title>${escHtml(wf.title || wf._slug)} — Workflow | Adelphos AI</title>`,
    json_ld:              '',
    workflow_title:       escHtml(wf.title || wf._slug),
    workflow_description: escHtml(wf.description || ''),
    status:               status,
    status_label:         statusLabels[status] || 'Planned',
    phase_count:          String(phases.length),
    total_steps:          String(totalSteps),
    try_url:              wf.try_url || '#',
    hero_video_label:     wf.hero_video_label || 'Walkthrough coming soon',
    prerequisites_html:   prereqsHtml || '<li>None specified</li>',
    outputs_html:         outputsHtml || '<li>None specified</li>',
    phase_nav_html:       phaseNavHtml,
    phases_html:          phasesHtml,
    related_html:         relatedHtml || '<p style="color:var(--wf-text-muted);font-size:14px;">No related workflows yet.</p>',
  });
}

/* ── Build the inventory page ─────────────────────────────────────── */
function buildInventoryPage(allWorkflows, template) {
  const liveCount = allWorkflows.filter(w => (w.status || '').toLowerCase() === 'live').length;

  const rowsHtml = allWorkflows.map(wf => {
    const phases = Array.isArray(wf.phases) ? wf.phases.length : 0;
    const status = (wf.status || 'planned').toLowerCase();
    const statusLabels = { live: 'Live', beta: 'Beta', planned: 'Planned' };
    return `
    <a class="wi-row" href="/workflows/${wf._slug}/index.html" data-wf-status="${status}">
      <div class="wi-row-info">
        <span class="wi-row-title">${escHtml(wf.title || wf._slug)}</span>
        <span class="wi-row-desc">${escHtml(wf.description || '')}</span>
      </div>
      <span class="wi-row-phases">${phases} phases</span>
      <div class="wi-row-status"><span class="wi-badge" data-status="${status}">${statusLabels[status] || 'Planned'}</span></div>
      <span class="wi-row-arrow">→</span>
    </a>`;
  }).join('');

  const cardsHtml = allWorkflows.map(wf => {
    const phases = Array.isArray(wf.phases) ? wf.phases.length : 0;
    const totalSteps = (Array.isArray(wf.phases) ? wf.phases : []).reduce((n, p) => {
      return n + (Array.isArray(p.steps) ? p.steps.length : 0);
    }, 0);
    const status = (wf.status || 'planned').toLowerCase();
    const statusLabels = { live: 'Live', beta: 'Beta', planned: 'Planned' };
    return `
    <a class="wi-card" href="/workflows/${wf._slug}/index.html" data-wf-status="${status}">
      <div class="wi-card-visual">
        <div class="wi-card-icon">
          <svg viewBox="0 0 24 24"><path d="M12 2v4m0 12v4m-6-14l-3-3m18 0l-3 3m-6 8a4 4 0 100-8 4 4 0 000 8z"/></svg>
        </div>
      </div>
      <div class="wi-card-body">
        <div class="wi-card-badge-row">
          <span class="wi-badge" data-status="${status}">${statusLabels[status] || 'Planned'}</span>
        </div>
        <h3>${escHtml(wf.title || wf._slug)}</h3>
        <p>${escHtml(wf.description || '')}</p>
        <div class="wi-card-meta">
          <span>${phases} phases</span>
          <span>${totalSteps} steps</span>
        </div>
      </div>
    </a>`;
  }).join('');

  return render(template, {
    seo_head:            '<title>Workflows — Adelphos AI</title>',
    json_ld:             '',
    workflow_count:      String(allWorkflows.length),
    live_count:          String(liveCount),
    workflow_rows_html:  rowsHtml || '<div style="padding:28px;color:var(--wi-text-muted);font-size:14px;">No workflows defined yet. Add YAML files to data/workflows/.</div>',
    workflow_cards_html: cardsHtml || '<div style="padding:28px;color:var(--wi-text-muted);font-size:14px;">No workflows defined yet.</div>',
  });
}

/* ── Main ─────────────────────────────────────────────────────────── */
function main() {
  const workflows = loadWorkflows();
  console.log(`[build-workflow-pages] Found ${workflows.length} workflow(s) in ${DATA_DIR}`);

  const detailTemplate = readFileSync(TEMPLATE_DETAIL, 'utf-8');
  const indexTemplate  = readFileSync(TEMPLATE_INDEX,  'utf-8');

  for (const wf of workflows) {
    const outDir = join(DIST_DIR, wf._slug);
    mkdirSync(outDir, { recursive: true });
    const html = buildDetailPage(wf, workflows, detailTemplate);
    const outPath = join(outDir, 'index.html');
    writeFileSync(outPath, html, 'utf-8');
    console.log(`  → ${outPath}`);
  }

  mkdirSync(DIST_DIR, { recursive: true });
  const inventoryHtml = buildInventoryPage(workflows, indexTemplate);
  const inventoryPath = join(DIST_DIR, 'index.html');
  writeFileSync(inventoryPath, inventoryHtml, 'utf-8');
  console.log(`  → ${inventoryPath}`);
  console.log('[build-workflow-pages] Done.');
}

main();
