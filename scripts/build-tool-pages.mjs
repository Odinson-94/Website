/**
 * scripts/build-tool-pages.mjs
 *
 * Reads:    data/tools/<slug>.yaml  (one per tool, promoted from drafts/)
 * Writes:   dist/docs/tools/<slug>/index.html
 *
 * For the dry run: takes a single --slug flag and builds just that one page.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { ROOT, parseSimpleYaml } from './lib/registry.mjs';
import { safeWriteFile } from './lib/backup.mjs';

const TEMPLATE_PATH = path.join(ROOT, 'templates', 'tool-page.html');
const PRE_LAUNCH = true;  // flip to false to reveal real names + descriptions

export async function buildToolPage(slug) {
  const jsonPath = path.join(ROOT, 'data', 'tools', `${slug}.json`);
  const tool = JSON.parse(await fs.readFile(jsonPath, 'utf8').catch(() => '{}'));

  let sourceTxt = await fs.readFile(path.join(ROOT, 'sandbox/data/tools.json'), 'utf8').catch(() => '[]');
  if (sourceTxt.charCodeAt(0) === 0xFEFF) sourceTxt = sourceTxt.slice(1);
  const sourceTools = JSON.parse(sourceTxt);
  const sourceTool  = sourceTools.find(t => t.name === slug) || {};
  const params      = sourceTool.parameters || [];
  const keywords    = sourceTool.keywords || [];

  // Fall back to registry data when the promoted data file is empty/stub
  if (!tool.title)            tool.title = sourceTool.name || slug;
  if (!tool.display_title)    tool.display_title = tool.title;
  if (!tool.description)      tool.description = sourceTool.desc || '';
  if (PRE_LAUNCH) {
    tool.title = tool.title;
    tool.display_title = tool.display_title;
    tool.description = 'Coming soon';
  }
  if (!tool.category_label)   tool.category_label = sourceTool.category || 'context';
  if (!tool.bridge_label && sourceTool.bridge) tool.bridge_label = sourceTool.bridge;
  if (tool.always_available == null) tool.always_available = sourceTool.always || false;

  const tmpl = await fs.readFile(TEMPLATE_PATH, 'utf8');

  const bridgePill = tool.bridge_label
    ? `<span class="pill pill-bridge">${esc(tool.bridge_label)}</span>`
    : '';
  const alwaysPill = tool.always_available
    ? `<span class="pill pill-always">always available</span>`
    : `<span class="pill pill-category">on demand</span>`;

  // Parameters table — rendered from source data (not the YAML)
  const parametersBlock = params.length
    ? `<h2 id="parameters">Parameters</h2>
  <table class="ref-table">
    <thead><tr><th>Name</th><th>Type</th><th>Required</th><th>Description</th></tr></thead>
    <tbody>
      ${params.map(p => `<tr>
        <td><code>${esc(p.name)}</code></td>
        <td><code>${esc(p.type)}</code></td>
        <td class="${p.required ? 'req-yes' : 'req-no'}">${p.required ? 'yes' : 'no'}</td>
        <td>${esc(p.description || '')}</td>
      </tr>`).join('\n      ')}
    </tbody>
  </table>`
    : `<h2 id="parameters">Parameters</h2>\n  <p style="color:var(--text-muted);">This tool takes no parameters.</p>`;

  const returnsBlock = tool.what_it_returns
    ? `<h2 id="returns">Returns</h2>\n  <pre class="logictree" style="background:#0d1117;color:#e6edf3;border-color:#0d1117;">${esc(tool.what_it_returns.trimEnd())}</pre>`
    : '';

  const promptsHtml = (tool.example_prompts || [])
    .map(p => `<li>${esc(p)}</li>`).join('\n    ');

  const keywordsBlock = keywords.length
    ? `<h2 id="keywords">Keywords</h2>\n  <p style="color:var(--text-muted);font-size:14px;">${keywords.map(esc).join(' · ')}</p>`
    : '';

  const r = tool.related || {};
  const relatedRows = [];
  if ((r.tools || []).length)   relatedRows.push(`<tr><th style="width:120px;">Tools</th><td>${(r.tools).map(t => `<code>${esc(t)}</code>`).join(' · ')}</td></tr>`);
  if ((r.skills || []).length)  relatedRows.push(`<tr><th>Skills</th><td>${(r.skills).map(esc).join(' · ')}</td></tr>`);
  if ((r.demos || []).length)   relatedRows.push(`<tr><th>Demos</th><td>${(r.demos).map(d => `<a href="/demos/#cat-${esc(d)}">${esc(d)}</a>`).join(' · ')}</td></tr>`);
  const relatedBlock = relatedRows.length
    ? `<h2 id="related">Related</h2>\n  <table class="ref-table"><tbody>${relatedRows.join('')}</tbody></table>`
    : '';

  const html = tmpl
    .replaceAll('{{title}}',                esc(tool.title))
    .replaceAll('{{display_title}}',        esc(tool.display_title))
    .replaceAll('{{description}}',          esc(tool.description))
    .replaceAll('{{category_label}}',       esc(tool.category_label))
    .replaceAll('{{bridge_pill}}',          bridgePill)
    .replaceAll('{{always_pill}}',          alwaysPill)
    .replaceAll('{{parameters_block}}',     parametersBlock)
    .replaceAll('{{returns_block}}',        returnsBlock)
    .replaceAll('{{example_prompts_html}}', promptsHtml)
    .replaceAll('{{keywords_block}}',       keywordsBlock)
    .replaceAll('{{related_block}}',        relatedBlock)
    .replaceAll('{{generated_at}}',         esc(tool.generated_at || ''))
    .replaceAll('{{generated_by}}',         esc(tool.generated_by || ''))
    .replaceAll('{{source_sha}}',           esc(tool.source_sha || ''));

  const outPath = path.join(ROOT, 'dist', 'docs', 'tools', slug, 'index.html');
  await safeWriteFile(outPath, html, 'utf8');
  return outPath;
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
}

// CLI entry
if (process.argv[1] && import.meta.url === `file://${process.argv[1].replace(/\\/g,'/')}`) {
  const slugIdx = process.argv.indexOf('--slug');
  const slug    = slugIdx > 0 ? process.argv[slugIdx + 1] : null;
  if (!slug) { console.error('usage: build-tool-pages.mjs --slug <name>'); process.exit(1); }
  buildToolPage(slug).then(p => console.log(`✓ wrote ${p}`));
}
