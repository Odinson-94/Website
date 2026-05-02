#!/usr/bin/env node
/**
 * seo-build-og-cards.mjs
 *
 * Renders branded 1200x630 Open Graph cards as PNGs using Puppeteer.
 * Outputs land in images/og/<slug>.png. Icons are inlined (SVG inline
 * or PNG base64) so the rendered HTML has no external loads.
 *
 * Manifest = list of { slug, title, tagline, iconRef }. iconRef is one of:
 *   - { kind: 'brand' }                              -> neural-node-logo.svg
 *   - { kind: 'svg',  path: '<repo-rel>' }           -> embed inline SVG
 *   - { kind: 'png',  path: '<repo-rel>' }           -> embed as data: URL
 *
 * Usage:
 *   node scripts/seo-build-og-cards.mjs              # render every card
 *   node scripts/seo-build-og-cards.mjs <slug>       # render one card
 *
 * Note: Puppeteer is resolved from global npm install — this script
 * only runs locally before commits, generated PNGs are what ships.
 */

import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const OG_DIR    = path.join(REPO_ROOT, 'images', 'og');

// Resolve global puppeteer (no local node_modules in this repo).
let puppeteer;
try { puppeteer = require('puppeteer'); }
catch {
  const globalPath = 'C:/Users/RPC/AppData/Roaming/npm/node_modules/puppeteer';
  puppeteer = require(globalPath);
}

/* -------------------------------------------------------------------------- */
/* Manifest                                                                    */
/* -------------------------------------------------------------------------- */

const BRAND_TAGLINE = 'Apps, agentic services and bespoke automations for MEP — built on the MEP Bridge platform.';

const CARDS = [
  // The catch-all card. Used for home, demos, workflows, inventory pages, etc.
  { slug: 'default', title: 'Adelphos AI', tagline: BRAND_TAGLINE, iconRef: { kind: 'brand' }, eyebrow: '' },

  // 11 app pages
  { slug: 'app-revit-copilot',     title: 'Revit Copilot',       tagline: 'An AI engineer that lives inside Revit and runs the model with you.',                                       iconRef: { kind: 'png', path: 'images/app-logos/revit-copilot.png' },              eyebrow: 'Apps' },
  { slug: 'app-adelphos-chat',     title: 'Adelphos Chat',       tagline: "Your project's brain — without Revit, without a desk.",                                                    iconRef: { kind: 'svg', path: 'images/og/icons/adelphos-chat.svg' },               eyebrow: 'Apps' },
  { slug: 'app-specbuilder',       title: 'Specbuilder',         tagline: 'The MEP specification, drafted from your live model in minutes.',                                          iconRef: { kind: 'svg', path: 'images/og/icons/spec-builder.svg' },                eyebrow: 'Apps' },
  { slug: 'app-report-builder',    title: 'Report Builder',      tagline: 'Every recurring report — composed, formatted, and traceable to source.',                                   iconRef: { kind: 'svg', path: 'images/og/icons/report-builder.svg' },              eyebrow: 'Apps' },
  { slug: 'app-document-controller', title: 'Document Controller', tagline: 'Single source of truth for every drawing, every revision, every transmittal.',                            iconRef: { kind: 'svg', path: 'images/og/icons/document-controller.svg' },         eyebrow: 'Apps' },
  { slug: 'app-qa-manager',        title: 'QA Manager',          tagline: 'Automated QA across drawings, schedules, specs, the model — and ACC clash issues, in one dashboard.',     iconRef: { kind: 'svg', path: 'images/og/icons/qa-manager.svg' },                  eyebrow: 'Apps' },
  { slug: 'app-schedule-builder',  title: 'Schedule Builder',    tagline: 'Production-ready Revit schedules in minutes — cross-checked against the model and your calcs.',           iconRef: { kind: 'svg', path: 'images/og/icons/schedule-builder.svg' },            eyebrow: 'Apps' },
  { slug: 'app-cobie-manager',     title: 'COBie Manager',       tagline: 'A live, audit-ready COBie deliverable, populated from the model — never a panic before hand-over again.', iconRef: { kind: 'svg', path: 'images/og/icons/cobie-manager.svg' },               eyebrow: 'Apps' },
  { slug: 'app-autocad-copilot',   title: 'AutoCAD Copilot',     tagline: 'An AI engineer that lives inside AutoCAD MEP — same agent, same tools, same project memory.',             iconRef: { kind: 'png', path: 'images/app-logos/autocad-copilot.png' },            eyebrow: 'Apps' },
  { slug: 'app-word-add-in',       title: 'Adelphos for Word',   tagline: 'The Adelphos agent inside Word — drafts, reviews, and finishes documents on your house template.',         iconRef: { kind: 'png', path: 'images/app-logos/word-add-in.png' },                eyebrow: 'Apps' },
  { slug: 'app-excel-add-in',      title: 'Adelphos for Excel',  tagline: 'The Adelphos agent inside Excel — connects calc workbooks to the live Revit model.',                       iconRef: { kind: 'png', path: 'images/app-logos/excel-add-in.png' },               eyebrow: 'Apps' },

  // 7 agentic service pages — no per-service icons exist, use brand mark
  { slug: 'svc-finances',                   title: 'AI Finances',           tagline: 'Automated bookkeeping, invoicing and cash-flow forecasting — driven by your live project data.', iconRef: { kind: 'brand' }, eyebrow: 'Agentic Services' },
  { slug: 'svc-project-management',         title: 'AI Project Management', tagline: 'Programme tracking, risk registers and reporting — the agent keeps the project on rails.',       iconRef: { kind: 'brand' }, eyebrow: 'Agentic Services' },
  { slug: 'svc-document-controller-managed', title: 'AI Document Controller', tagline: 'Transmittals, registers, revision tracking — the agent runs your document control.',           iconRef: { kind: 'brand' }, eyebrow: 'Agentic Services' },
  { slug: 'svc-email-specifications',       title: 'Specification Writer',   tagline: 'Forward a brief, receive a complete MEP specification section.',                                iconRef: { kind: 'brand' }, eyebrow: 'Agentic Services' },
  { slug: 'svc-email-revit-modelling',      title: 'Revit Modelling Agent',  tagline: 'Email a markup, receive the Revit model update.',                                              iconRef: { kind: 'brand' }, eyebrow: 'Agentic Services' },
  { slug: 'svc-email-cobie',                title: 'COBie Generator',        tagline: 'Forward the model, receive a validated COBie deliverable.',                                    iconRef: { kind: 'brand' }, eyebrow: 'Agentic Services' },
  { slug: 'svc-email-schematics',           title: 'Schematic Designer',     tagline: 'Describe the system, receive a production-ready schematic.',                                   iconRef: { kind: 'brand' }, eyebrow: 'Agentic Services' },
];

/* -------------------------------------------------------------------------- */
/* Icon resolver                                                               */
/* -------------------------------------------------------------------------- */

async function resolveIconHtml(iconRef) {
  if (iconRef.kind === 'brand') {
    const svg = await fs.readFile(path.join(REPO_ROOT, 'logos', 'neural-node-logo.svg'), 'utf8');
    // Strip XML decl, return inner svg
    return svg.replace(/<\?xml[^>]*\?>\s*/, '').replace(/<!--[\s\S]*?-->\s*/g, '');
  }
  if (iconRef.kind === 'svg') {
    const svg = await fs.readFile(path.join(REPO_ROOT, iconRef.path), 'utf8');
    return svg.replace(/<\?xml[^>]*\?>\s*/, '').replace(/<!--[\s\S]*?-->\s*/g, '');
  }
  if (iconRef.kind === 'png') {
    const buf = await fs.readFile(path.join(REPO_ROOT, iconRef.path));
    const b64 = buf.toString('base64');
    return `<img src="data:image/png;base64,${b64}" alt="">`;
  }
  throw new Error(`Unknown iconRef kind: ${iconRef.kind}`);
}

/* -------------------------------------------------------------------------- */
/* HTML template                                                               */
/* -------------------------------------------------------------------------- */

function cardHtml({ title, tagline, iconHtml, eyebrow }) {
  // 1200×630 viewport, brand teal gradient, icon left, text right.
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  *,*::before,*::after { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    width: 1200px; height: 630px;
    background: linear-gradient(135deg, #0a1518 0%, #122a35 35%, #1a4358 70%, #156082 100%);
    color: #f5f3ef;
    font-family: -apple-system, 'Segoe UI', system-ui, 'Inter', sans-serif;
    position: relative;
    overflow: hidden;
    -webkit-font-smoothing: antialiased;
    text-rendering: geometricPrecision;
  }
  /* Subtle radial glow behind icon for depth */
  body::before {
    content: '';
    position: absolute;
    top: 50%; left: 280px;
    transform: translate(-50%, -50%);
    width: 700px; height: 700px;
    background: radial-gradient(circle, rgba(21, 96, 130, 0.45) 0%, rgba(21, 96, 130, 0) 70%);
    pointer-events: none;
  }
  /* Subtle dot grid texture, very low opacity */
  body::after {
    content: '';
    position: absolute; inset: 0;
    background-image: radial-gradient(circle, rgba(245, 243, 239, 0.04) 1px, transparent 1px);
    background-size: 24px 24px;
    pointer-events: none;
  }
  .layout {
    position: relative;
    z-index: 1;
    width: 100%; height: 100%;
    display: grid;
    grid-template-columns: 380px 1fr;
    grid-template-rows: 1fr;
    column-gap: 64px;
    padding: 88px 88px 72px 88px;
    align-items: center;
  }
  .icon-wrap {
    width: 320px; height: 320px;
    display: flex; align-items: center; justify-content: center;
    background: rgba(245, 243, 239, 0.04);
    border: 1px solid rgba(245, 243, 239, 0.10);
    border-radius: 36px;
    padding: 28px;
    backdrop-filter: blur(8px);
  }
  .icon-wrap > svg, .icon-wrap > img {
    width: 100%; height: 100%;
    object-fit: contain;
  }
  .text { display: flex; flex-direction: column; justify-content: center; min-width: 0; }
  .eyebrow {
    font-size: 18px; font-weight: 600;
    letter-spacing: 0.32em; text-transform: uppercase;
    color: rgba(245, 243, 239, 0.55);
    margin-bottom: 20px;
  }
  .title {
    font-size: 84px; font-weight: 700;
    line-height: 0.98; letter-spacing: -0.025em;
    margin: 0 0 28px 0;
  }
  .title.long { font-size: 64px; }
  .tagline {
    font-size: 26px; font-weight: 400;
    line-height: 1.35;
    color: rgba(245, 243, 239, 0.82);
    margin: 0;
    max-width: 660px;
  }
  .footer {
    position: absolute;
    left: 88px; right: 88px; bottom: 44px;
    display: flex; align-items: center; justify-content: space-between;
    z-index: 2;
  }
  .brand-row { display: flex; align-items: center; gap: 14px; }
  .brand-dot {
    width: 14px; height: 14px; border-radius: 50%;
    background: linear-gradient(135deg, #1a7a9e, #156082);
    box-shadow: 0 0 16px rgba(21, 96, 130, 0.6);
  }
  .brand-text {
    font-size: 22px; font-weight: 500;
    letter-spacing: 0.18em; text-transform: uppercase;
    color: rgba(245, 243, 239, 0.85);
  }
  .url {
    font-size: 22px; font-weight: 500;
    color: rgba(245, 243, 239, 0.55);
    letter-spacing: 0.04em;
  }
</style>
</head>
<body>
  <div class="layout">
    <div class="icon-wrap">${iconHtml}</div>
    <div class="text">
      ${eyebrow ? `<div class="eyebrow">${escapeHtml(eyebrow)}</div>` : ''}
      <h1 class="title${title.length > 22 ? ' long' : ''}">${escapeHtml(title)}</h1>
      <p class="tagline">${escapeHtml(tagline)}</p>
    </div>
  </div>
  <div class="footer">
    <div class="brand-row">
      <div class="brand-dot"></div>
      <div class="brand-text">Adelphos AI</div>
    </div>
    <div class="url">adelphos.ai</div>
  </div>
</body>
</html>`;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* -------------------------------------------------------------------------- */
/* Render                                                                      */
/* -------------------------------------------------------------------------- */

async function renderCard(browser, card) {
  const iconHtml = await resolveIconHtml(card.iconRef);
  const html = cardHtml({
    title: card.title,
    tagline: card.tagline,
    iconHtml,
    eyebrow: card.eyebrow,
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: 'networkidle0' });
  // Give the layout/font a moment to settle before screenshot
  await new Promise(r => setTimeout(r, 250));

  const out = path.join(OG_DIR, `${card.slug}.png`);
  await page.screenshot({ path: out, type: 'png', omitBackground: false, fullPage: false });
  await page.close();
  return out;
}

async function main() {
  const onlySlug = process.argv[2];
  const cards = onlySlug ? CARDS.filter(c => c.slug === onlySlug) : CARDS;
  if (onlySlug && cards.length === 0) {
    console.error(`No card matches slug: ${onlySlug}`);
    process.exit(1);
  }

  await fs.mkdir(OG_DIR, { recursive: true });

  console.log(`Rendering ${cards.length} OG card(s) to ${path.relative(REPO_ROOT, OG_DIR)}/`);
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });

  try {
    for (const card of cards) {
      const out = await renderCard(browser, card);
      const stat = await fs.stat(out);
      console.log(`  ✓ ${card.slug}.png  (${(stat.size / 1024).toFixed(1)} KB)`);
    }
  } finally {
    await browser.close();
  }

  console.log('\nDone.');
}

main().catch(e => { console.error('FATAL', e); process.exit(1); });
