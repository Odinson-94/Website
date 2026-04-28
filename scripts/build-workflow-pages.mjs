import fs from 'node:fs/promises';
import path from 'node:path';
import { ROOT } from './lib/registry.mjs';

const TEMPLATE = path.join(ROOT, 'templates', 'workflow-page.html');

export async function buildWorkflowPage(slug) {
  // Prefer JSON (more robust for nested structures); fallback to YAML
  const jsonPath = path.join(ROOT, 'data', 'workflows', `${slug}.json`);
  const wf = JSON.parse(await fs.readFile(jsonPath, 'utf8'));
  const tmpl = await fs.readFile(TEMPLATE, 'utf8');

  const phases = wf.phases || [];

  const phasesHtml = phases.map((p, i) => {
    const phaseNum = i + 1;
    const stepsHtml = (p.steps || []).map((s) => {
      const mediaPathBase = `/workflow-assets/${esc(wf.slug)}/phase-${phaseNum}-step-${esc(s.num)}`;
      return `
        <div class="step" id="phase-${phaseNum}-step-${esc(s.num)}">
          <h4><span class="step-num">${esc(s.num)}.</span> ${esc(s.title)}</h4>
          ${s.tools_called?.length ? `<div class="tools-row"><span class="lab">tools</span>${s.tools_called.map(t => `<code>${esc(t)}</code>`).join(' ')}</div>` : ''}
          ${s.agent_quote ? `<div class="agent-says"><span class="lab">Agent says</span>${esc(s.agent_quote)}</div>` : ''}
          ${s.user_prompt ? `<div class="try-prompt"><span class="lab">Try</span>"${esc(s.user_prompt)}"</div>` : ''}
          ${s.conditions?.length ? `<div class="conditions"><strong>Branches when:</strong> ${s.conditions.map(esc).join(' · ')}</div>` : ''}
          <div class="step-media">
            <img src="${mediaPathBase}.svg"
                 alt="screenshot for ${esc(s.title)}"
                 onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'ph',innerText:'screenshot · drop phase-${phaseNum}-step-${esc(s.num)}.jpg in'}));">
          </div>
        </div>
      `;
    }).join('');

    return `
    <section class="phase" id="phase-${phaseNum}">
      <h3 class="phase-title"><span class="phase-num">Phase ${phaseNum}</span>${esc(p.title)}</h3>

      <div class="phase-video">
        <video controls preload="none"
               poster="/workflow-assets/${esc(wf.slug)}/phase-${phaseNum}.svg"
               data-src="/workflow-assets/${esc(wf.slug)}/phase-${phaseNum}.mp4"
               onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'poster-fallback',innerText:'phase overview · drop ${esc(wf.slug)}/phase-${phaseNum}.mp4 in to play'}));"></video>
      </div>

      ${p.when_triggers ? `<div class="when-triggers"><strong>When this triggers</strong>${esc(p.when_triggers)}</div>` : ''}

      ${stepsHtml}
    </section>`;
  }).join('');

  const prereq = (wf.prerequisites || []).length
    ? `<h2 id="prerequisites">Before you start</h2>\n  <ul>${(wf.prerequisites || []).map(p => `<li>${esc(p)}</li>`).join('')}</ul>`
    : '';

  // How it flows — narrative paragraphs with screenshots interleaved
  const flow = (wf.how_it_flows || []);
  const howItFlows = flow.length
    ? `<h2 id="how-it-flows">How it flows</h2>
  ${flow.map((p, idx) => `
    <p>${esc(p)}</p>
    ${idx < flow.length - 1 && idx % 2 === 0 ? `
    <div class="step-media" style="margin: var(--space-md) 0 var(--space-xl);">
      <img src="/workflow-assets/${esc(wf.slug)}/flow-${idx + 1}.svg"
           alt="flow screenshot ${idx + 1}"
           onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'ph',innerText:'screenshot · drop flow-${idx + 1}.jpg in'}));">
    </div>` : ''}
  `).join('')}`
    : '';

  // Settings & options
  const settings = (wf.settings || []);
  const settingsBlock = settings.length
    ? `<h2 id="settings">Settings &amp; options</h2>
  <p style="color:var(--text-muted);font-size:14px;max-width:720px;">
    Per-workflow toggles. Defined in the skill markdown so the page and the live behaviour stay in sync.
  </p>
  <table class="ref-table">
    <thead><tr><th>Option</th><th>Default</th><th>What it does</th></tr></thead>
    <tbody>
      ${settings.map(s => `<tr>
        <td><strong>${esc(s.option)}</strong></td>
        <td><code>${esc(s.default)}</code></td>
        <td>${esc(s.description)}</td>
      </tr>`).join('')}
    </tbody>
  </table>`
    : '';

  const html = tmpl
    .replaceAll('{{slug}}',                esc(wf.slug))
    .replaceAll('{{title}}',               esc(wf.title || ''))
    .replaceAll('{{category}}',            esc(wf.category_label || 'Workflow'))
    .replaceAll('{{lead}}',                esc(wf.lead || ''))
    .replaceAll('{{phase_count}}',         String(phases.length))
    .replaceAll('{{phases_html}}',         phasesHtml)
    .replaceAll('{{prerequisites_block}}', prereq)
    .replaceAll('{{how_it_flows_block}}',  howItFlows)
    .replaceAll('{{settings_block}}',      settingsBlock)
    .replaceAll('{{source_skill}}',        esc(wf.source_skill || ''))
    .replaceAll('{{generated_at}}',        esc(wf.generated_at || ''))
    .replaceAll('{{generated_by}}',        esc(wf.generated_by || ''));

  const out = path.join(ROOT, 'dist', 'workflows', slug, 'index.html');
  await fs.mkdir(path.dirname(out), { recursive: true });
  await fs.writeFile(out, html, 'utf8');
  return out;
}

function esc(s) { return String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
