#!/usr/bin/env node
/**
 * build-agentic-pages.mjs
 *
 * Reads sandbox/data/agentic-services.json, fills two templates and writes:
 *   dist/agentic-services/index.html          (inventory listing)
 *   dist/agentic-services/<slug>/index.html    (one per service)
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = join(__dirname, '..');

const DATA_PATH          = join(ROOT, 'sandbox', 'data', 'agentic-services.json');
const TPL_SERVICE        = join(ROOT, 'templates', 'agentic-service-page.html');
const TPL_INVENTORY      = join(ROOT, 'templates', 'agentic-services-inventory.html');
const DIST_BASE          = join(ROOT, 'dist', 'agentic-services');

const services = JSON.parse(readFileSync(DATA_PATH, 'utf-8'));
const tplService   = readFileSync(TPL_SERVICE, 'utf-8');
const tplInventory = readFileSync(TPL_INVENTORY, 'utf-8');

/* ── helpers ──────────────────────────────────────────────────────── */

function replace(html, token, value) {
  return html.replaceAll(`{{${token}}}`, value);
}

function featureHtml(features) {
  return features.map(f => `
        <div class="svc-feat-item">
          <div class="svc-feat-copy">
            <span class="svc-feat-title">${esc(f.title)}</span>
            <span class="svc-feat-desc">${esc(f.desc)}</span>
          </div>
          <div class="svc-agent-spinner"></div>
        </div>`).join('\n');
}

function tileHtml(svc) {
  const feats = svc.features.slice(0, 3).map(f =>
    `<li>${esc(f.title)}</li>`
  ).join('\n            ');

  const emailTag = svc.email
    ? `\n      <span class="tile-email">${esc(svc.email)}</span>`
    : '';

  return `
    <a class="inv-tile" data-tone="${esc(svc.tone)}" href="/agentic-services/${esc(svc.slug)}/index.html">
      <div class="tile-logo-area">
        <img src="${esc(svc.logo)}" alt="${esc(svc.name)}" onerror="this.style.opacity=0">
      </div>
      <div class="tile-body">
        <span class="tile-surf">${esc(svc.kind)}</span>
        <h3>${esc(svc.name)}</h3>
        <p class="tile-claim">${esc(svc.tagline)}</p>
        <ul class="tile-feats">
            ${feats}
        </ul>${emailTag}
        <span class="tile-arrow">Learn more</span>
      </div>
    </a>`;
}

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ── build individual service pages ───────────────────────────────── */

let builtCount = 0;

for (const svc of services) {
  let html = tplService;

  html = replace(html, 'name',         esc(svc.name));
  html = replace(html, 'kind',         esc(svc.kind));
  html = replace(html, 'tone',         esc(svc.tone));
  html = replace(html, 'tagline',      esc(svc.tagline));
  html = replace(html, 'description',  esc(svc.description));
  html = replace(html, 'logo',         esc(svc.logo));
  html = replace(html, 'pricing_note', esc(svc.pricing_note));

  const emailPill = svc.email
    ? `<span class="email-pill">${esc(svc.email)}</span>`
    : '';
  html = replace(html, 'email_pill', emailPill);

  html = replace(html, 'features_html', featureHtml(svc.features));

  const ctaPrimary = svc.cta_action === 'contact'
    ? `<a class="svc-cta-btn primary" href="/contact/">${esc(svc.cta_label)}</a>`
    : `<a class="svc-cta-btn primary" href="${esc(svc.cta_action)}">${esc(svc.cta_label)}</a>`;
  html = replace(html, 'cta_html', ctaPrimary);

  const dir = join(DIST_BASE, svc.slug);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), html, 'utf-8');
  builtCount++;
}

/* ── build inventory page ─────────────────────────────────────────── */

const modules = services.filter(s => s.kind === 'Agentic Module');
const emails  = services.filter(s => s.kind === 'Email Service');

let invHtml = tplInventory;
invHtml = replace(invHtml, 'modules_grid', modules.map(tileHtml).join('\n'));
invHtml = replace(invHtml, 'email_grid',   emails.map(tileHtml).join('\n'));

mkdirSync(DIST_BASE, { recursive: true });
writeFileSync(join(DIST_BASE, 'index.html'), invHtml, 'utf-8');

console.log(`[build-agentic-pages] wrote ${builtCount} service pages + 1 inventory page`);
