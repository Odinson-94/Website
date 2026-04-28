import fs from 'node:fs/promises';
import path from 'node:path';
import { ROOT, parseSimpleYaml, loadJson } from './lib/registry.mjs';

const TEMPLATE = path.join(ROOT, 'templates', 'command-page.html');
const PRE_LAUNCH = true;  // flip to false to reveal real names + descriptions

export async function buildCommandPage(slug) {
  // Find the matching command in the registry by slugified class name
  let reg = await loadJson('data/registries/command_registry.json');
  if (!Array.isArray(reg)) reg = [reg];
  const cmd = reg.find(c => slugify(c.class) === slug || c.class === slug);
  if (!cmd) throw new Error(`command "${slug}" not found in command_registry.json`);

  const jsonPath = path.join(ROOT, 'data', 'commands', `${slug}.json`);
  const yaml = JSON.parse(await fs.readFile(jsonPath, 'utf8'));
  const tmpl = await fs.readFile(TEMPLATE, 'utf8');

  const display = yaml.class_display || cmd.class.replace(/Command$/, '').replace(/([A-Z])/g, ' $1').trim();
  const restPill = yaml.has_restapi
    ? `<span class="pill pill-live">Public API</span>`
    : `<span class="pill pill-coming">Public API · not yet exposed</span>`;

  const before = cmd.precondition  ? callout('pre',  'Before you run this', cmd.precondition)  : '';
  const after  = cmd.postcondition ? callout('post', 'After it runs',       cmd.postcondition) : '';
  const notfor = cmd.notfor        ? callout('warn', 'Don\'t use this when', cmd.notfor)        : '';
  const sef    = cmd.sideeffects   ? callout('side', 'Side effects',         cmd.sideeffects)   : '';

  const usecaseBullets = (cmd.usecase || '').split(/(?<=[.!?])\s+/).filter(Boolean).slice(0, 5);
  const usecase = usecaseBullets.length
    ? `<h2 id="when-to-use">When to use this</h2>\n  <ul style="padding-left:22px;">\n    ${usecaseBullets.map(b => `<li>${esc(b)}</li>`).join('\n    ')}\n  </ul>`
    : '';

  // Inputs table — combines selection + config
  const sel = (cmd.selection_inputs || []).map(i => row(i.name, 'selection', i.type, true, '—', i.description, i.prompt));
  const cfg = (cmd.config_inputs || []).map(i => row(i.name, 'config', `${i.type}`, false, i.default || '—', i.description, ''));
  const inputs = (sel.length || cfg.length)
    ? `<h2 id="inputs">Inputs</h2>
  <table class="ref-table">
    <thead><tr><th>Name</th><th>Kind</th><th>Type</th><th>Required</th><th>Default</th><th>Description</th></tr></thead>
    <tbody>${[...sel, ...cfg].join('')}</tbody>
  </table>`
    : '';

  const outs = (cmd.outputs || []).map(o => `<tr><td><code>${esc(o.name)}</code></td><td><code>${esc(o.type)}</code></td><td>${esc(o.description)}</td></tr>`).join('');
  const returns = outs
    ? `<h2 id="returns">Returns</h2>
  <table class="ref-table">
    <thead><tr><th>Name</th><th>Type</th><th>Description</th></tr></thead>
    <tbody>${outs}</tbody>
  </table>`
    : '';

  // Decision flow (logictree)
  const decisionFlow = cmd.logictree
    ? `<h2 id="decision-flow">Decision flow</h2>\n  <pre class="logictree">${highlightLogicTree(cmd.logictree)}</pre>`
    : '';

  // Sample dialogue (aiprompts)
  const ai = cmd.aiprompts;
  const sampleDialogue = (ai && (ai.preprompts?.length || ai.thinkingsteps?.length || ai.successprompts?.length))
    ? `<h2 id="what-youll-see">What you'll see in the chat</h2>
  <div class="ai-dialogue">
    ${ai.preprompts?.length      ? `<div class="lab">on start</div><div class="msg">${ai.preprompts.map(p => esc(p)).join('<br>')}</div>` : ''}
    ${ai.thinkingsteps?.length   ? `<div class="lab">thinking</div><div class="msg">${ai.thinkingsteps.map(p => esc(p)).join('<br>')}</div>` : ''}
    ${ai.successprompts?.length  ? `<div class="lab">on success</div><div class="msg">${highlightPlaceholders(esc(ai.successprompts[0]))}</div>` : ''}
    ${ai.failureprompts?.length  ? `<div class="lab">on failure</div><div class="msg">${highlightPlaceholders(esc(ai.failureprompts[0]))}</div>` : ''}
  </div>`
    : '';

  // REST API block (always show — placeholder if not yet exposed)
  const restApi = `<h2 id="rest-api">REST API</h2>
  <div class="callout callout-warn">
    <strong>Not yet exposed</strong>
    <p>This command does not carry a <code>[RestApi]</code> attribute today. Once tagged, this section will auto-populate with:</p>
    <ul style="padding-left:22px;margin-top:8px;">
      <li><code>POST /api/v1/commands/${esc(slugify(cmd.class).replace(/-/g, '_'))}</code></li>
      <li>Request body schema (from <code>[RestApiParam]</code>)</li>
      <li>Response schema (from <code>[RestApiResponse]</code>)</li>
      <li>curl / JS / Python code examples</li>
    </ul>
  </div>`;

  const kw = (cmd.keywords || []).slice(0, 8);
  const ip = (cmd.intent_patterns || []).slice(0, 5);
  const keywords = kw.length
    ? `<h2 id="keywords">Keywords &amp; intent patterns</h2>
  <p style="color:var(--text-muted);font-size:14px;">${kw.map(esc).join(' · ')}${ip.length ? `<br><span style="font-size:12px;">Patterns: ${ip.map(p => `<code>${esc(p)}</code>`).join(' · ')}</span>` : ''}</p>`
    : '';

  // Related table
  const rel = cmd.related_commands || [];
  const relatedRows = [];
  if (rel.length) relatedRows.push(`<tr><th style="width:140px;">Related commands</th><td>${rel.map(r => `<code>${esc(r)}</code>`).join(' · ')}</td></tr>`);
  relatedRows.push(`<tr><th>Pillar</th><td>${esc(yaml.pillar || cmd.pillar)}</td></tr>`);
  const related = `<h2 id="related">Related</h2>
  <table class="ref-table"><tbody>${relatedRows.join('')}</tbody></table>`;

  const html = tmpl
    .replaceAll('{{title}}',                  esc(display))
    .replaceAll('{{slug}}',                   esc(slug))
    .replaceAll('{{pillar}}',                 esc(yaml.pillar || cmd.pillar || ''))
    .replaceAll('{{rest_pill}}',              restPill)
    .replaceAll('{{lead}}',                   esc(PRE_LAUNCH ? 'Coming soon' : (yaml.lead || cmd.summary || '')))
    .replaceAll('{{before_callout}}',         before)
    .replaceAll('{{after_callout}}',          after)
    .replaceAll('{{usecase_block}}',          usecase)
    .replaceAll('{{notfor_callout}}',         notfor)
    .replaceAll('{{sideeffects_callout}}',    sef)
    .replaceAll('{{inputs_block}}',           inputs)
    .replaceAll('{{returns_block}}',          returns)
    .replaceAll('{{decision_flow_block}}',    decisionFlow)
    .replaceAll('{{sample_dialogue_block}}',  sampleDialogue)
    .replaceAll('{{rest_api_block}}',         restApi)
    .replaceAll('{{keywords_block}}',         keywords)
    .replaceAll('{{related_block}}',          related)
    .replaceAll('{{generated_at}}',           esc(yaml.generated_at || ''))
    .replaceAll('{{generated_by}}',           esc(yaml.generated_by || ''))
    .replaceAll('{{source_sha}}',             esc(yaml.source_sha || ''));

  const out = path.join(ROOT, 'dist', 'docs', 'commands', slug, 'index.html');
  await fs.mkdir(path.dirname(out), { recursive: true });
  await fs.writeFile(out, html, 'utf8');
  return out;
}

function callout(kind, title, body) {
  return `<div class="callout callout-${kind}"><strong>${esc(title)}</strong><p>${esc(body)}</p></div>`;
}
function row(name, kind, type, required, def, desc, prompt) {
  const promptHtml = prompt ? `<br><em style="font-size:12px;color:var(--text-muted);">"${esc(prompt)}"</em>` : '';
  return `<tr>
    <td><code>${esc(name)}</code></td>
    <td><span class="pill pill-category">${kind}</span></td>
    <td><code>${esc(type)}</code></td>
    <td class="${required ? 'req-yes' : 'req-no'}">${required ? 'yes' : 'no'}</td>
    <td>${esc(def)}</td>
    <td>${esc(desc)}${promptHtml}</td>
  </tr>`;
}
function slugify(s) {
  return String(s)
    .replace(/Command$/, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
function esc(s) { return String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
function highlightLogicTree(s) {
  return esc(s)
    .replace(/^(\s*)(check):/gm,   '$1<span class="lt-check">$2:</span>')
    .replace(/^(\s*)(action):/gm,  '$1<span class="lt-action">$2:</span>')
    .replace(/^(\s*)(resolve):/gm, '$1<span class="lt-resolve">$2:</span>');
}
function highlightPlaceholders(s) {
  return s.replace(/\{(\w+)\}/g, '<span class="placeholder">{$1}</span>');
}
