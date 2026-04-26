/**
 * scripts/build-home.mjs
 *
 * Builds the homepage at /dist/index.html.
 * Hierarchy with two tile styles:
 *   • banner-card  — cinematic, full-width, per-tone gradient (Revit Copilot,
 *                    Clash Solver, Adelphos Chat, Document Controller)
 *   • logo-tile    — compact, colour band, 3 feature bullets (everything else)
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { ROOT, loadJson } from './lib/registry.mjs';
import { renderSeoHead, renderJsonLd } from './lib/seo.mjs';
import { patchHome } from './patch-dist-home.mjs';

const T = (n) => path.join(ROOT, 'templates', n);
const O = (...p) => path.join(ROOT, 'dist', ...p);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

export async function buildHome() {
  const apps     = (await loadJson('sandbox/data/apps.json')).apps;
  const features = (await loadJson('sandbox/data/features.json')).features;
  const services = (await loadJson('sandbox/data/agentic-services.json')).services;
  const brand    = await loadJson('sandbox/data/brand.json').catch(() => ({}));

  // Tool + command counts (auto-populated from registries)
  const toolsData = await loadJson('sandbox/data/tools.json').catch(() => []);
  const toolCount = Array.isArray(toolsData) ? toolsData.length : 0;
  const cmdsData = await loadJson('data/registries/command_registry.json').catch(() => []);
  const cmdCount = Array.isArray(cmdsData) ? cmdsData.length : (cmdsData.commandCount || (Array.isArray(cmdsData.commands) ? cmdsData.commands.length : 0));

  const findApp     = slug => apps.find(a => a.slug === slug);
  const findFeature = slug => features.find(f => f.slug === slug);
  const findService = slug => services.find(s => s.slug === slug);

  // ── HERO ───────────────────────────────────────────────────────────────
  const brandQuote = brand.pullquote ||
    "Adelphos will be the only building services software provider that addresses the entire process, start to finish — designed and built by industry professionals who have experienced the gap in the market.";
  const brandQuoteHtml = esc(brandQuote)
    .replace('the only', '<span class="accent">the only</span>')
    .replace('start to finish', '<span class="accent">start to finish</span>');

  // ── COMBINED FLAGSHIP — Revit Copilot hero + 3 inner features ─────────
  const revitCopilotCombined = combinedBanner(findApp('revit-copilot'), [
    findFeature('autoroute'),
    findFeature('plantroom-designer-3d'),
    findFeature('clash-solver')
  ], { badge: 'Flagship · Revit add-in', divider: 'Three bespoke automations, all inside the Copilot' });

  // ── Tier 4: CoBie + QA (small tiles) ─────────────────────────────────
  const tier4 = [
    smallTile(findApp('cobie-manager'), { kind: 'app', surf: 'BIM hand-over' }),
    smallTile(findApp('qa-manager'),     { kind: 'app', surf: 'Quality dashboard' })
  ].join('');

  // ── Tier 5: Adelphos Chat as a banner ────────────────────────────────
  const tier5 = bannerCard(findApp('adelphos-chat'), {
    kind: 'app', badge: 'Companion · Web · Desktop · Mobile'
  });

  // ── Tier 6: Build apps (3-up small tiles) ────────────────────────────
  const tier6 = [
    smallTile(findApp('specbuilder'),       { kind: 'app', surf: 'Spec authoring' }),
    smallTile(findApp('report-builder'),    { kind: 'app', surf: 'Report authoring' }),
    smallTile(findApp('schedule-builder'),  { kind: 'app', surf: 'Schedule authoring' })
  ].join('');

  // ── Tier 7: AutoCAD Copilot as a banner ──────────────────────────────
  const tier7 = bannerCard(findApp('autocad-copilot'), {
    kind: 'app', badge: 'Companion · AutoCAD MEP add-in'
  });

  // ── Tier 8: Document Controller + Word + Excel (3-up small tiles) ───
  const tier8 = [
    smallTile(findApp('document-controller'), { kind: 'app', surf: 'Document control' }),
    smallTile(findApp('word-add-in'),         { kind: 'app', surf: 'Word add-in' }),
    smallTile(findApp('excel-add-in'),        { kind: 'app', surf: 'Excel add-in' })
  ].join('');

  // ── Tier 9: email services (2-up tiles) ──────────────────────────────
  const emailSvc = services.filter(s => s.kind === 'email-service');
  const tier9 = emailSvc.map(s => smallTile(s, { kind: 'service', surf: 'Email service' })).join('');

  // ── Tier 10: agentic modules (3-up tiles) ────────────────────────────
  const managedSvc = services.filter(s => s.kind !== 'email-service');
  const tier10 = managedSvc.map(s => smallTile(s, { kind: 'service', surf: 'Managed service' })).join('');

  // Count summary
  const countSummary =
    `${apps.length} apps · ${features.length} bespoke automations · ${managedSvc.length} agentic modules · ${emailSvc.length} email services.`;

  // SEO
  const seoHead = await renderSeoHead({
    title: 'Adelphos AI — apps, agentic services and bespoke automations for MEP',
    description: brandQuote,
    path: '/dist/index.html',
    type: 'website',
    keywords: ['Adelphos AI', 'MEP automation', 'Revit AI', 'AutoRoute', 'Clash Solver', '3D plantroom designer', 'AutoCAD Copilot']
  });
  const jsonLd = await renderJsonLd({
    kind: 'website', path: '/dist/index.html',
    title: 'Adelphos AI', description: brandQuote
  });

  const tmpl = await fs.readFile(T('home.html'), 'utf8');
  const html = tmpl
    .replaceAll('{{brand_quote_html}}',         brandQuoteHtml)
    .replaceAll('{{count_summary}}',            esc(countSummary))
    .replaceAll('{{revit_copilot_combined}}',   revitCopilotCombined)
    .replaceAll('{{tier4_coord}}',              tier4)
    .replaceAll('{{tier5_chat_banner}}',        tier5)
    .replaceAll('{{tier6_build}}',              tier6)
    .replaceAll('{{tier7_autocad_banner}}',     tier7)
    .replaceAll('{{tier8_integrations}}',       tier8)
    .replaceAll('{{tier9_email}}',              tier9)
    .replaceAll('{{tier10_agentic}}',           tier10)
    .replaceAll('{{command_count}}',          String(cmdCount))
    .replaceAll('{{tool_count}}',             String(toolCount))
    .replaceAll('{{seo_head}}',                 seoHead)
    .replaceAll('{{json_ld}}',                  jsonLd);

  const out = O('index.html');
  await fs.mkdir(path.dirname(out), { recursive: true });
  await fs.writeFile(out, html, 'utf8');

  // ── SANDBOX POST-PATCH ───────────────────────────────────────────────
  // Re-applies the sandbox-only modifications to dist/index.html:
  //   • hero <video> swapped for the artsy painting + draggable MEP chat
  //   • extra row of three "open chat / 500 commands / built-in utilities"
  //     cards added inside the Revit Copilot bundle
  // Without this the chat panel disappears every time the build runs,
  // because templates/home.html still has the original <video> hard-coded.
  // patchHome() is idempotent — safe to call on every build.
  try {
    await patchHome();
  } catch (err) {
    console.error('build-home: post-patch failed:', err.message);
    throw err;
  }

  return { out };
}

/* ─────────────────────────────────────────────────  BANNER CARD (cinematic)  */
function bannerCard(entity, { kind, badge, hero = false } = {}) {
  if (!entity) return '';
  const root = kind === 'feature' ? '/dist/features/'
             : kind === 'service' ? '/dist/agentic-services/'
             : '/dist/apps/';
  const tone = entity.tone || 'blue';
  const heroCls = hero ? ' hero-banner' : '';
  const bullets = bulletList(entity, 4);

  return `
    <a class="banner-card${heroCls}" data-tone="${esc(tone)}" href="${root}${esc(entity.slug)}/index.html">
      <div class="copy">
        <span class="badge">${esc(badge || (kind === 'feature' ? 'Feature' : 'App'))}</span>
        <h2>${esc(entity.title)}</h2>
        <p class="claim">${esc(entity.headline_claim || entity.tagline || '')}</p>
        ${bullets ? `<ul class="feat-bullets">${bullets}</ul>` : ''}
        <span class="arrow">Open ${esc(entity.title)}  →</span>
      </div>
      <div class="visual">
        <img src="/${esc(entity.icon || 'logos/Node Logo.png')}" alt="${esc(entity.title)} logo" onerror="this.style.opacity=0">
      </div>
    </a>`;
}

/* ─────────────────────────────────────────────────  COMPACT LOGO TILE  */
function smallTile(entity, { kind, surf } = {}) {
  if (!entity) return missingTile(surf);
  const root = kind === 'feature' ? '/dist/features/'
             : kind === 'service' ? '/dist/agentic-services/'
             : '/dist/apps/';
  const tone = entity.tone || 'blue';
  const features = entity.features || (entity.feature_groups?.[0]?.features || []);
  const bullets = features.slice(0, 3).map(f => `<li>${esc(f.name)}</li>`).join('');
  const email = entity.email_address ? `<span class="email">${esc(entity.email_address)}</span>` : '';

  return `
    <a class="logo-tile" data-tone="${esc(tone)}" href="${root}${esc(entity.slug)}/index.html">
      <div class="logo-area">
        <img src="/${esc(entity.icon || 'logos/Node Logo.png')}" alt="${esc(entity.title)} logo" onerror="this.style.opacity=0">
      </div>
      <div class="body">
        <span class="surf">${esc(surf || 'App')}</span>
        <h3>${esc(entity.title)}</h3>
        <p class="claim">${esc(entity.headline_claim || entity.tagline || '')}</p>
        ${bullets ? `<ul class="feat-mini">${bullets}</ul>` : ''}
        ${email}
      </div>
    </a>`;
}

/* ─────────────────────────────────────────────────  helpers  */
function bulletList(entity, max = 4) {
  const features = entity.features || (entity.feature_groups?.[0]?.features || []);
  return features.slice(0, max).map(f => `<li>${esc(f.name)}</li>`).join('');
}

/* ─────────────────────────────────────────────  COMBINED BANNER  */
/* Cinematic hero AND inner-card grid in one banner.
   Top half: parent app hero (logo, title, claim, CTA) on its tone gradient.
   Bottom half: N inner mini-cards (each a feature shipped inside the parent).
   Used for Revit Copilot wrapping AutoRoute + 3D Plantroom + Clash Solver. */
function combinedBanner(parent, children, { badge, divider } = {}) {
  if (!parent) return '';
  const tone = parent.tone || 'blue';
  const parentHref = `/dist/apps/${esc(parent.slug)}/index.html`;

  const inner = (children || []).filter(Boolean).map(c => {
    const href = `/dist/features/${esc(c.slug)}/index.html`;
    return `
      <a class="inner-card" href="${href}">
        <div class="scene-3d" data-scene="${esc(c.slug)}" role="img" aria-label="${esc(c.title)} 3D preview"></div>
        <div class="ic-body">
          <span class="ic-surf">Inside ${esc(parent.title)}</span>
          <h4>${esc(c.title)}</h4>
          <p class="ic-claim">${esc(c.tagline || c.headline_claim || '')}</p>
          <span class="ic-more">Open ${esc(c.title)}</span>
        </div>
      </a>`;
  }).join('');

  return `
    <div class="bundle-banner" data-tone="${esc(tone)}">
      <a class="bundle-hero" href="${parentHref}" style="text-decoration:none;color:inherit;">
        <div class="copy">
          <span class="badge">${esc(badge || 'Flagship')}</span>
          <h2>${esc(parent.title)}</h2>
          <p class="claim">${esc(parent.headline_claim || parent.tagline || '')}</p>
          <span class="arrow">Open ${esc(parent.title)}  →</span>
        </div>
        <div class="visual">
          <img src="/${esc(parent.icon || 'logos/Node Logo.png')}" alt="${esc(parent.title)} logo" onerror="this.style.opacity=0">
        </div>
      </a>
      ${divider ? `<div class="bundle-divider">${esc(divider)}</div>` : ''}
      <div class="bundle-grid">${inner}</div>
    </div>`;
}

function missingTile(surf) {
  return `<div class="logo-tile" style="opacity:0.55;">
    <div class="logo-area"><span style="font-family:var(--font-mono);font-size:11px;color:var(--text-muted);">missing</span></div>
    <div class="body"><span class="surf">${esc(surf || '')}</span><h3>—</h3></div>
  </div>`;
}
