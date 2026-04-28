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

  // ── SECTION 3: Popular apps carousel ────────────────────────────────
  // Card vocabulary = .rp-commands-card derivative (.app-card.dark-card).
  // Each card surfaces real PNG logo + apps.json headline_claim.
  const appsCarousel = renderAppsCarousel(apps);

  // ── SECTION 7: Agentic services — TRUTH ONLY ───────────────────────
  // Source: sandbox/data/agentic-services.json. Three managed
  // services (kind="Agentic Module") + four email services
  // (kind="Email Service"). NO fabricated entries — the 3 invented
  // services from the previous build (Procurement / Resource /
  // Compliance) are explicitly excluded by filtering on real slugs.
  const realManagedSlugs = ['finances', 'project-management', 'document-controller'];
  const realEmailSlugs   = ['email-cobie', 'email-revit-modelling', 'email-schematics', 'email-specifications'];
  const managed = realManagedSlugs.map(slug => services.find(s => s.slug === slug)).filter(Boolean);
  const emails  = realEmailSlugs.map(slug => services.find(s => s.slug === slug)).filter(Boolean);
  const agenticServices = renderAgenticServices(managed, emails);

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

  // Defensive token-occurrence audit. The home template once had
  // `{{agentic_services}}` mentioned twice — once as the real injection
  // point and once inside an explanatory HTML comment. replaceAll()
  // doesn't know about HTML comment boundaries, so the entire Section 7
  // block was being injected twice and shipped to users. This audit
  // runs at build time and fails loudly if any non-trivial token
  // (anything that injects a multi-line block) appears more than once
  // in the template source.
  const blockTokens = [
    'apps_carousel', 'agentic_services',
    'revit_copilot_combined',
    'tier4_coord', 'tier5_chat_banner', 'tier6_build',
    'tier7_autocad_banner', 'tier8_integrations',
    'tier9_email', 'tier10_agentic',
  ];
  for (const t of blockTokens) {
    const literal = `{{${t}}}`;
    const matches = tmpl.split(literal).length - 1;
    if (matches > 1) {
      throw new Error(`build-home: token "${literal}" appears ${matches} times in templates/home.html — block tokens MUST appear exactly once or replaceAll() will duplicate the block (likely a token-mentioned-in-a-comment bug). Rephrase any HTML comments to avoid the literal token.`);
    }
  }

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
    .replaceAll('{{apps_carousel}}',            appsCarousel)
    .replaceAll('{{agentic_services}}',         agenticServices)
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

/* ─────────────────────────────────────────────  POPULAR APPS CAROUSEL
   Built per /opt/cursor/artifacts/PLAN.md Phase 1.
   Card style = .rp-commands-card derivative (single-law: same dark
   #2f2f2f surface as Section 2, white type, agent spinner where
   meaningful). Each card carries the real PNG logo + the apps.json
   headline_claim verbatim. No "Available" stamps, no one-word names. */
function renderAppsCarousel(apps) {
  const order = [
    'revit-copilot', 'specbuilder', 'cobie-manager', 'schedule-builder',
    'qa-manager', 'adelphos-chat', 'document-controller', 'autocad-copilot',
    'report-builder', 'word-add-in', 'excel-add-in'
  ];
  const findApp = (slug) => apps.find(a => a.slug === slug);
  const liveCards = order.map(findApp).filter(Boolean).map(a => appCard(a)).join('');

  // Roadmap entries — surfaced as .app-card.roadmap (light teal-bordered ghost
  // versions of the dark card; same shape, single accent, NOT a different
  // card style). Names from sandbox plan Section 3.
  const roadmap = [
    { title: '2D-to-3D Floorplan from PDF',  blurb: 'Architectural floorplans rebuilt as a Revit model from a PDF.' },
    { title: 'Plantroom Generator',           blurb: 'Boilers, pumps and AHUs placed and connected from the brief.' },
    { title: 'AutoRouting — Pipework',        blurb: 'Header drops and branch runs through corridors and risers.' },
    { title: 'AutoCAD CoPilot',               blurb: 'Same agent, native to AutoCAD MEP.' },
    { title: 'Report Builder — IESVE',        blurb: 'IESVE outputs assembled into client-ready energy reports.' },
    { title: 'Arch Floorplan Editing',        blurb: 'Architectural floorplan generation and editing features.' },
    { title: 'MEP Design Modules',            blurb: 'Editing surfaces for routing, sizing and coordination.' }
  ];
  const roadmapCards = roadmap.map(r => roadmapCard(r)).join('');

  return `
    <div class="apps-carousel-wrap">
      <button class="carousel-arrow carousel-arrow-left" type="button" aria-label="Scroll left" tabindex="0">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
      </button>
      <div class="apps-scroll">${liveCards}<div class="carousel-divider">Coming after</div>${roadmapCards}</div>
      <button class="carousel-arrow carousel-arrow-right" type="button" aria-label="Scroll right" tabindex="0">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
      </button>
    </div>
    <a class="apps-roadmap-link" href="/sandbox/roadmap/">See the full roadmap →</a>`;
}

function appCard(a) {
  const claim = (a.headline_claim || a.tagline || '').trim();
  const surface = (a.surface || '').split('·')[0].trim();
  const tone = a.tone || 'blue';
  return `
    <a class="app-card" data-tone="${esc(tone)}" href="/dist/apps/${esc(a.slug)}/index.html">
      <div class="app-logo-wrap">
        <img class="app-logo-img" src="/${esc(a.icon)}" alt="${esc(a.title)} logo" loading="lazy">
      </div>
      <div class="app-card-body">
        <div class="app-card-title">${esc(a.title)}</div>
        <div class="app-card-claim">${esc(claim)}</div>
      </div>
      <div class="app-card-foot">
        <span class="app-card-surf">${esc(surface)}</span>
        <span class="app-card-status">Available</span>
      </div>
    </a>`;
}

function roadmapCard(r) {
  return `
    <div class="app-card roadmap">
      <div class="app-logo-wrap roadmap-logo">
        <span class="app-logo-placeholder">+</span>
      </div>
      <div class="app-card-body">
        <div class="app-card-title">${esc(r.title)}</div>
        <div class="app-card-claim">${esc(r.blurb)}</div>
      </div>
      <div class="app-card-foot">
        <span class="app-card-surf">Roadmap</span>
      </div>
    </div>`;
}

/* ──────────────────────────────  AGENTIC SERVICES  (Section 7)
   Truth-only: every card lifts copy verbatim from the JSON.
   Card vocabulary = .rp-commands-card. Two layouts:
     Row A: 3-up of dark managed-service cards
     Row B: 1 full-width dark card "Just email us — we handle it"
            with 4 email service rows (each row = .rp-feat-item with
            mailto link in mono in the right slot). */
function renderAgenticServices(managed, emails) {
  const managedCards = managed.map(s => managedServiceCard(s)).join('');
  const emailRows    = emails.map(s => emailServiceRow(s)).join('');
  return `
    <div class="agentic-row agentic-managed-row">${managedCards}</div>

    <div class="agentic-email-card rp-commands-card">
      <h3 class="agentic-email-header">Just email us — we handle it.</h3>
      <p class="agentic-email-tagline">Four agent-run services that work over email. Forward the brief or the model, receive the deliverable.</p>
      <div class="rp-feat-list">${emailRows}</div>
    </div>`;
}

function managedServiceCard(s) {
  const claim = (s.headline_claim || s.tagline || '').trim();
  const features = (s.features || []).slice(0, 3);
  const featRows = features.map(f => `
    <div class="rp-feat-item">
      <div class="rp-feat-copy">
        <span class="rp-feat-title">${esc(f.title || f.name)}</span>
        <span class="rp-feat-desc">${esc(f.desc)}</span>
      </div>
      <div class="rp-agent-spinner"></div>
    </div>`).join('');
  return `
    <a class="agentic-card rp-commands-card" href="/dist/agentic-services/${esc(s.slug)}/index.html">
      <span class="agentic-card-kicker">Agentic module</span>
      <h3 class="agentic-card-title">${esc(s.title)}</h3>
      <p class="agentic-card-claim">${esc(claim)}</p>
      <div class="rp-feat-list">${featRows}</div>
      <span class="agentic-card-cta">${esc(s.cta_label || 'Request a walkthrough')} →</span>
    </a>`;
}

function emailServiceRow(s) {
  const email = s.email || '';
  return `
    <div class="rp-feat-item agentic-email-row">
      <div class="rp-feat-copy">
        <span class="rp-feat-title">${esc(s.title)}</span>
        <span class="rp-feat-desc">${esc(s.tagline || s.headline_claim || '')}</span>
      </div>
      <a class="agentic-email-mailto" href="mailto:${esc(email)}">${esc(email)}</a>
    </div>`;
}

function missingTile(surf) {
  return `<div class="logo-tile" style="opacity:0.55;">
    <div class="logo-area"><span style="font-family:var(--font-mono);font-size:11px;color:var(--text-muted);">missing</span></div>
    <div class="body"><span class="surf">${esc(surf || '')}</span><h3>—</h3></div>
  </div>`;
}
