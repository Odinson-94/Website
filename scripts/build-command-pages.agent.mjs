#!/usr/bin/env node
/**
 * build-command-pages.mjs
 *
 * Reads data/registries/command_registry.json (produced by generate_command_registry.py
 * in the MEPBridge repo) and emits:
 *   - dist/docs/commands/<slug>/index.html   × N  (one per command)
 *   - dist/docs/commands/index.html                (inventory page)
 *
 * Templates live in templates/command-page.html and templates/commands-inventory.html.
 * Substitution uses {{token}} placeholders — no runtime template engine.
 *
 * Usage:
 *   node scripts/build-command-pages.mjs [--registry path] [--out dir] [--dry-run]
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const ROOT       = join(__dirname, '..');

const args = process.argv.slice(2);
const flagIdx = (f) => args.indexOf(f);
const flagVal = (f) => { const i = flagIdx(f); return i >= 0 && args[i + 1] ? args[i + 1] : null; };
const dryRun  = flagIdx('--dry-run') >= 0;

const REGISTRY_PATH = flagVal('--registry') || join(ROOT, 'data/registries/command_registry.json');
const OUT_DIR       = flagVal('--out')      || join(ROOT, 'dist/docs/commands');
const TPL_PAGE      = join(ROOT, 'templates/command-page.html');
const TPL_INV       = join(ROOT, 'templates/commands-inventory.html');

/* ─── Helpers ────────────────────────────────────────────────────────── */

function escHtml(s) {
  if (!s) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
                   .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function slugify(name) {
  return name.replace(/Command$/, '')
             .replace(/([a-z])([A-Z])/g, '$1-$2')
             .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
             .toLowerCase()
             .replace(/[^a-z0-9]+/g, '-')
             .replace(/^-|-$/g, '');
}

function displayName(className) {
  return className.replace(/Command$/, '')
                  .replace(/([a-z])([A-Z])/g, '$1 $2')
                  .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
}

function pillarSlug(serviceType) {
  if (!serviceType) return 'model-setup';
  const map = {
    'SoilDrainage': 'drainage', 'Drainage': 'drainage',
    'Heating': 'heating', 'Cooling': 'cooling',
    'Ventilation': 'ventilation', 'Lighting': 'lighting',
    'Power': 'power', 'Communications': 'comms', 'Comms': 'comms',
    'FireDetection': 'fire-alarm', 'FireAlarm': 'fire-alarm',
    'Sprinklers': 'sprinklers', 'PublicHealth': 'drainage',
    'HotColdWater': 'drainage', 'ModelSetUp': 'model-setup',
  };
  return map[serviceType] || serviceType.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

function pillarLabel(slug) {
  const labels = {
    'drainage': 'Drainage', 'heating': 'Heating', 'cooling': 'Cooling',
    'ventilation': 'Ventilation', 'lighting': 'Lighting', 'power': 'Power',
    'comms': 'Communications', 'fire-alarm': 'Fire Alarm',
    'sprinklers': 'Sprinklers', 'model-setup': 'Model Setup',
  };
  return labels[slug] || slug;
}

function replace(tpl, tokens) {
  let out = tpl;
  for (const [k, v] of Object.entries(tokens)) {
    out = out.replaceAll(`{{${k}}}`, v ?? '');
  }
  return out;
}

function conditionalBlock(html, tag, show) {
  const open  = `{{#if ${tag}}}`;
  const close = `{{/if}}`;
  let result = html;
  let idx = 0;
  while (true) {
    const start = result.indexOf(open, idx);
    if (start < 0) break;
    const end = result.indexOf(close, start + open.length);
    if (end < 0) break;
    if (show) {
      result = result.slice(0, start) +
               result.slice(start + open.length, end) +
               result.slice(end + close.length);
    } else {
      result = result.slice(0, start) + result.slice(end + close.length);
    }
    idx = start;
  }
  return result;
}

/* ─── Build one command detail page ──────────────────────────────────── */

function buildCommandPage(tpl, cmd) {
  const slug  = cmd.slug || slugify(cmd.class_name || cmd.name);
  const dname = cmd.display_name || displayName(cmd.class_name || cmd.name);
  const pSlug = pillarSlug(cmd.service_type);
  const pLabel = pillarLabel(pSlug);

  const hasSel    = (cmd.selection_inputs || []).length > 0;
  const hasCfg    = (cmd.config_inputs || []).length > 0;
  const hasOut    = (cmd.outputs || []).length > 0;
  const hasTree   = !!cmd.logictree;
  const hasAI     = !!(cmd.aiprompts && (cmd.aiprompts.preprompt || cmd.aiprompts.successprompt));
  const hasUC     = !!cmd.usecase;
  const hasNF     = !!cmd.notfor;
  const hasPre    = !!cmd.precondition;
  const hasPost   = !!cmd.postcondition;
  const hasSide   = !!cmd.sideeffects;
  const hasKW     = (cmd.keywords || []).length > 0;
  const hasRel    = !!(cmd.related_commands?.length || cmd.related_tools?.length || cmd.related_demos?.length);

  let html = tpl;

  html = conditionalBlock(html, 'usecase', hasUC);
  html = conditionalBlock(html, 'notfor', hasNF);
  html = conditionalBlock(html, 'precondition', hasPre);
  html = conditionalBlock(html, 'postcondition', hasPost);
  html = conditionalBlock(html, 'sideeffects', hasSide);
  html = conditionalBlock(html, 'selection_inputs', hasSel);
  html = conditionalBlock(html, 'config_inputs', hasCfg);
  html = conditionalBlock(html, 'outputs', hasOut);
  html = conditionalBlock(html, 'logictree', hasTree);
  html = conditionalBlock(html, 'aiprompts', hasAI);
  html = conditionalBlock(html, 'preprompt', !!(cmd.aiprompts?.preprompt));
  html = conditionalBlock(html, 'thinkingsteps', !!(cmd.aiprompts?.thinkingsteps?.length));
  html = conditionalBlock(html, 'successprompt', !!(cmd.aiprompts?.successprompt));
  html = conditionalBlock(html, 'failureprompt', !!(cmd.aiprompts?.failureprompt));
  html = conditionalBlock(html, 'keywords', hasKW);
  html = conditionalBlock(html, 'related', hasRel);
  html = conditionalBlock(html, 'related_commands', !!(cmd.related_commands?.length));
  html = conditionalBlock(html, 'related_tools', !!(cmd.related_tools?.length));
  html = conditionalBlock(html, 'related_demos', !!(cmd.related_demos?.length));
  html = conditionalBlock(html, 'bridge_label', !!cmd.bridge);

  const selRows = (cmd.selection_inputs || []).map(i => `
        <tr>
          <td class="col-name">${escHtml(i.name)}</td>
          <td class="col-type">${escHtml(i.type)}</td>
          <td>${escHtml(i.prompt || '')}</td>
          <td>${escHtml(i.example || '')}</td>
        </tr>`).join('');

  const cfgRows = (cmd.config_inputs || []).map(i => `
        <tr>
          <td class="col-name">${escHtml(i.name)}</td>
          <td class="col-type">${escHtml(i.type)}</td>
          <td class="col-default">${escHtml(i.default_value ?? '—')}</td>
          <td>${escHtml(i.description || '')}${
            i.resolver_prompt ? `<span class="resolver-prompt">"${escHtml(i.resolver_prompt)}"</span>` : ''
          }</td>
        </tr>`).join('');

  const outItems = (cmd.outputs || []).map(o => `
      <div class="feat-item">
        <div class="feat-item-copy">
          <span class="feat-item-title">${escHtml(o.name)}</span>
          <span class="feat-item-desc">${escHtml(o.description || '')}</span>
        </div>
        <span class="feat-item-meta">${escHtml(o.type || '')}</span>
      </div>`).join('');

  const ucItems = cmd.usecase
    ? cmd.usecase.split(/\.\s+/).filter(Boolean).map(s =>
        `<li>${escHtml(s.replace(/\.$/, ''))}</li>`).join('\n      ')
    : '';

  const kwPills = (cmd.keywords || []).map(k =>
    `<span class="kw-pill">${escHtml(k)}</span>`).join('');

  const thinkMsgs = (cmd.aiprompts?.thinkingsteps || []).map(s => `
        <div class="ai-msg">
          <span class="ai-msg-role role-agent">Agent</span>
          <span class="ai-msg-text">${escHtml(s)}</span>
        </div>`).join('');

  function buildLogicTreeHtml(tree) {
    if (!tree) return '';
    if (typeof tree === 'string') {
      return tree.split('\n').map(line => {
        const trimmed = line.trim();
        if (trimmed.startsWith('check:'))
          return `<div><span class="lt-check">CHECK</span> ${escHtml(trimmed.slice(6).trim())}</div>`;
        if (trimmed.startsWith('action:'))
          return `<div><span class="lt-action">ACTION</span> ${escHtml(trimmed.slice(7).trim())}</div>`;
        if (trimmed.startsWith('resolve:'))
          return `<div><span class="lt-resolve">RESOLVE</span> ${escHtml(trimmed.slice(8).trim())}</div>`;
        if (trimmed.startsWith('  ') || trimmed.startsWith('\t'))
          return `<div class="lt-indent">${escHtml(trimmed)}</div>`;
        return `<div>${escHtml(trimmed)}</div>`;
      }).join('\n');
    }
    return escHtml(JSON.stringify(tree, null, 2));
  }

  function relatedCards(items, type) {
    if (!items?.length) return '';
    return items.map(r => {
      const name = typeof r === 'string' ? r : r.name;
      const desc = typeof r === 'string' ? '' : (r.description || '');
      const href = type === 'command' ? `/docs/commands/${slugify(name)}/`
                 : type === 'tool'    ? `/docs/tools/${name}/`
                 : `/demos/${name}/`;
      return `
      <a class="related-card" href="${href}">
        <span class="rc-type">${type}</span>
        <span class="rc-name">${escHtml(name)}</span>
        <span class="rc-desc">${escHtml(desc)}</span>
      </a>`;
    }).join('');
  }

  const navPillarLinks = [
    'drainage','heating','cooling','ventilation','lighting','power',
    'comms','fire-alarm','sprinklers','model-setup'
  ].map(p => `<a class="nav-link${p === pSlug ? ' active' : ''}" href="/docs/commands/?pillar=${p}">${pillarLabel(p)}</a>`).join('\n  ');

  const navRelatedLinks = (cmd.related_commands || []).slice(0, 6).map(r => {
    const n = typeof r === 'string' ? r : r.name;
    return `<a class="nav-link" href="/docs/commands/${slugify(n)}/">${displayName(n)}</a>`;
  }).join('\n  ');

  const highlightPlaceholders = (s) =>
    s ? escHtml(s).replace(/\{(\w+)\}/g, '<code class="placeholder">{$1}</code>') : '';

  html = replace(html, {
    slug,
    display_name:         escHtml(dname),
    meta_description:     escHtml((cmd.summary || cmd.description || '').slice(0, 155)),
    description:          escHtml(cmd.summary || cmd.description || ''),
    pillar_slug:          pSlug,
    pillar_label:         escHtml(pLabel),
    category_label:       escHtml(cmd.category || 'Command'),
    bridge_label:         escHtml(cmd.bridge || ''),
    usecase_items:        ucItems,
    notfor:               escHtml(cmd.notfor || ''),
    precondition:         escHtml(cmd.precondition || ''),
    postcondition:        escHtml(cmd.postcondition || ''),
    sideeffects:          escHtml(cmd.sideeffects || ''),
    selection_input_rows: selRows,
    config_input_rows:    cfgRows,
    output_items:         outItems,
    logictree_html:       buildLogicTreeHtml(cmd.logictree),
    preprompt:            highlightPlaceholders(cmd.aiprompts?.preprompt),
    thinkingstep_messages: thinkMsgs,
    successprompt:        highlightPlaceholders(cmd.aiprompts?.successprompt),
    failureprompt:        highlightPlaceholders(cmd.aiprompts?.failureprompt),
    keyword_pills:        kwPills,
    related_command_cards: relatedCards(cmd.related_commands, 'command'),
    related_tool_cards:    relatedCards(cmd.related_tools, 'tool'),
    related_demo_cards:    relatedCards(cmd.related_demos, 'demo'),
    nav_pillar_links:      navPillarLinks,
    nav_related_links:     navRelatedLinks,
  });

  return { slug, html };
}

/* ─── Build inventory page ───────────────────────────────────────────── */

function buildInventoryPage(tpl, commands) {
  const total = commands.length;
  const count = (fn) => commands.filter(fn).length;
  const pct   = (fn) => total ? Math.round(count(fn) / total * 100) : 0;

  const pillars = [...new Set(commands.map(c => pillarSlug(c.service_type)))].sort();
  const bridges = [...new Set(commands.map(c => c.bridge).filter(Boolean))].sort();

  const pillarOpts = pillars.map(p =>
    `<option value="${p}">${pillarLabel(p)}</option>`).join('\n      ');
  const bridgeOpts = bridges.map(b =>
    `<option value="${escHtml(b)}">${escHtml(b)}</option>`).join('\n      ');

  const navPillarLinks = pillars.map(p =>
    `<a class="nav-link" href="/docs/commands/?pillar=${p}">${pillarLabel(p)}</a>`).join('\n  ');

  const covDot = (v) => `<span class="cov-dot ${v ? 'yes' : 'no'}" title="${v ? 'Yes' : 'No'}"></span>`;

  const rows = commands.map(cmd => {
    const slug  = cmd.slug || slugify(cmd.class_name || cmd.name);
    const dname = cmd.display_name || displayName(cmd.class_name || cmd.name);
    const pSlg  = pillarSlug(cmd.service_type);
    const hasSel = (cmd.selection_inputs || []).length > 0;
    const hasCfg = (cmd.config_inputs || []).length > 0;
    const hasOut = (cmd.outputs || []).length > 0;
    const hasTree = !!cmd.logictree;
    const hasAI  = !!(cmd.aiprompts && (cmd.aiprompts.preprompt || cmd.aiprompts.successprompt));
    const hasAPI = !!cmd.restapi;
    const hasUC  = !!cmd.usecase;
    const desc   = (cmd.summary || cmd.description || '').slice(0, 120);
    const kws    = (cmd.keywords || []).join(' ');

    return `<tr data-name="${escHtml(dname)}" data-pillar="${pSlg}" data-bridge="${escHtml(cmd.bridge || '')}"
    data-desc="${escHtml(desc)}" data-keywords="${escHtml(kws)}"
    data-has-usecase="${hasUC ? 1 : 0}" data-has-aiprompts="${hasAI ? 1 : 0}"
    data-has-logictree="${hasTree ? 1 : 0}" data-has-restapi="${hasAPI ? 1 : 0}"
    data-has-selinput="${hasSel ? 1 : 0}" data-has-cfginput="${hasCfg ? 1 : 0}"
    data-has-outputs="${hasOut ? 1 : 0}">
          <td class="col-name"><a href="/docs/commands/${slug}/">${escHtml(dname)}</a></td>
          <td><span class="pill pill-pillar" data-pillar="${pSlg}">${escHtml(pillarLabel(pSlg))}</span></td>
          <td class="col-desc" title="${escHtml(desc)}">${escHtml(desc)}</td>
          <td>${covDot(hasSel)}</td>
          <td>${covDot(hasCfg)}</td>
          <td>${covDot(hasOut)}</td>
          <td>${covDot(hasTree)}</td>
          <td>${covDot(hasAI)}</td>
          <td>${covDot(hasAPI)}</td>
        </tr>`;
  }).join('\n        ');

  let html = replace(tpl, {
    command_count: String(total),
    tool_count:    '191',
    pct_usecase:   String(pct(c => !!c.usecase)),
    pct_aiprompts: String(pct(c => !!(c.aiprompts?.preprompt || c.aiprompts?.successprompt))),
    pct_outputs:   String(pct(c => (c.outputs || []).length > 0)),
    pct_logictree: String(pct(c => !!c.logictree)),
    pct_restapi:   String(pct(c => !!c.restapi)),
    pillar_options:   pillarOpts,
    bridge_options:   bridgeOpts,
    nav_pillar_links: navPillarLinks,
    command_rows:     rows,
  });

  return html;
}

/* ─── Main ───────────────────────────────────────────────────────────── */

function main() {
  if (!existsSync(REGISTRY_PATH)) {
    console.error(`Registry not found: ${REGISTRY_PATH}`);
    console.error('Run generate_command_registry.py in the MEPBridge repo first,');
    console.error('then copy the output to data/registries/command_registry.json.');
    process.exit(1);
  }

  const registry = JSON.parse(readFileSync(REGISTRY_PATH, 'utf-8'));
  const commands = Array.isArray(registry) ? registry : registry.commands || [];
  console.log(`Loaded ${commands.length} commands from registry.`);

  const tplPage = readFileSync(TPL_PAGE, 'utf-8');
  const tplInv  = readFileSync(TPL_INV, 'utf-8');

  let wrote = 0;

  for (const cmd of commands) {
    const { slug, html } = buildCommandPage(tplPage, cmd);
    const outPath = join(OUT_DIR, slug, 'index.html');

    if (dryRun) {
      console.log(`  [dry] ${outPath}`);
    } else {
      mkdirSync(dirname(outPath), { recursive: true });
      writeFileSync(outPath, html, 'utf-8');
    }
    wrote++;
  }

  const invHtml = buildInventoryPage(tplInv, commands);
  const invPath = join(OUT_DIR, 'index.html');

  if (dryRun) {
    console.log(`  [dry] ${invPath}`);
  } else {
    mkdirSync(dirname(invPath), { recursive: true });
    writeFileSync(invPath, invHtml, 'utf-8');
  }

  console.log(`Done. ${wrote} command pages + 1 inventory page${dryRun ? ' (dry run)' : ' written'}.`);
}

main();
