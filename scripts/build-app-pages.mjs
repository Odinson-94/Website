/**
 * scripts/build-app-pages.mjs
 *
 * Generates one detail page per app from sandbox/data/apps.json.
 * Output: /apps/<slug>/index.html
 *
 * Also exports buildAppsInventory() for the apps landing page.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { ROOT, loadJson } from './lib/registry.mjs';
import { renderSeoHead, renderJsonLd, buildAutoFaqs, renderFaqBlock, renderRelatedBlock, gitLastMod } from './lib/seo.mjs';

const T = (n) => path.join(ROOT, 'templates', n);
const O = (...p) => path.join(ROOT, 'dist', ...p);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

/* Phase 7.5: small inline SVG glyph for an install platform. Keyed by
   case-insensitive substring match on the platform name. Falls back to
   a generic terminal/box glyph. All glyphs are 22×22, currentColor
   stroke, 1.5 width — they pick up the .install-tile color = teal. */
function platformGlyph(rawName) {
  const n = String(rawName || '').toLowerCase();
  let path;
  if (/revit/.test(n)) {
    path = '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 17V8h5a3 3 0 0 1 0 6H7m6 3-3-3"/>';
  } else if (/autocad/.test(n)) {
    path = '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 16l5-9 5 9M9 13h6"/>';
  } else if (/word/.test(n)) {
    path = '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M6 8l2 9 3-7 3 7 2-9"/>';
  } else if (/excel/.test(n)) {
    path = '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 8l8 8M16 8l-8 8"/>';
  } else if (/(macos|mac os|apple)/.test(n)) {
    path = '<path d="M16 9c-1 0-3 1-4 1s-3-1-4-1c-3 0-4 3-4 5 0 4 3 8 5 8 1 0 1.5-.5 3-.5s2 .5 3 .5c2 0 5-4 5-8 0-2-1-5-4-5z"/><path d="M13 6c0-1 1-3 2-3"/>';
  } else if (/win|windows/.test(n)) {
    path = '<path d="M3 5l8-1v8H3zM12 4l9-1v9h-9zM3 13h8v8l-8-1zM12 13h9v9l-9-1z"/>';
  } else if (/linux|ubuntu/.test(n)) {
    path = '<circle cx="12" cy="12" r="9"/><circle cx="9" cy="10" r="0.6"/><circle cx="15" cy="10" r="0.6"/><path d="M9 14c1 1 5 1 6 0"/>';
  } else if (/web|browser|chrome|firefox|safari/.test(n)) {
    path = '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>';
  } else if (/(addsource|appsource|microsoft 365|m365)/.test(n)) {
    path = '<rect x="3" y="3" width="9" height="9"/><rect x="12" y="12" width="9" height="9"/><rect x="12" y="3" width="9" height="9"/><rect x="3" y="12" width="9" height="9"/>';
  } else if (/server|service|daemon|background/.test(n)) {
    path = '<rect x="3" y="4" width="18" height="6" rx="1"/><rect x="3" y="14" width="18" height="6" rx="1"/><circle cx="7" cy="7" r="0.6"/><circle cx="7" cy="17" r="0.6"/>';
  } else if (/iphone|ios|mobile|android/.test(n)) {
    path = '<rect x="6" y="2" width="12" height="20" rx="2"/><path d="M11 19h2"/>';
  } else {
    path = '<rect x="3" y="4" width="18" height="14" rx="2"/><path d="M3 10h18M7 4v14"/>';
  }
  return `<svg class="install-glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
}

export async function buildAppPage(slug) {
  const data = await loadJson('sandbox/data/apps.json');
  const app = data.apps.find(a => a.slug === slug);
  if (!app) throw new Error(`app "${slug}" not found in sandbox/data/apps.json`);
  return await renderApp(app);
}

async function renderApp(app) {
  const tmpl = await fs.readFile(T('app-page.html'), 'utf8');

  // Pull-quote: per-app `pullquote` wins; brand.json is the fallback.
  let brand = {};
  try { brand = await loadJson('sandbox/data/brand.json'); } catch {}
  const pullquote = app.pullquote || brand.pullquote || '';

  // Detail body: prefer the multi-paragraph array; fall back to legacy
  // single-paragraph or the short blurb.
  const paragraphs = Array.isArray(app.detail_paragraphs) && app.detail_paragraphs.length
    ? app.detail_paragraphs
    : [app.detail_paragraph || app.blurb || ''];
  const detailParagraphsHtml = paragraphs
    .filter(Boolean)
    .map(p => `<p>${esc(p)}</p>`)
    .join('\n      ');

  // Features — supports both grouped (`feature_groups`) and flat (`features`).
  const featuresBlock = renderFeatures(app);
  const installBlock  = renderInstall(app);

  // ── SEO / AEO ──────────────────────────────────────────────────────────
  const pagePath = `/apps/${app.slug}/index.html`;
  const lastmod = await gitLastMod(`sandbox/data/apps.json`);
  const seoHead = await renderSeoHead({
    title: `${app.title} — Apps`,
    description: app.headline_claim || app.tagline,
    path: pagePath, type: 'product',
    keywords: [
      'Adelphos AI', app.title, 'MEP', 'Revit',
      ...(app.seo_keywords || []),
      ...(app.best_for || [])
    ],
    lastmod
  });
  const faqs = Array.isArray(app.custom_faqs) && app.custom_faqs.length
    ? app.custom_faqs
    : buildAutoFaqs(app, 'app');
  const faqBlock = renderFaqBlock(faqs);
  const breadcrumbs = [
    { name: 'Home', url: '/' },
    { name: 'Apps', url: '/apps/index.html' },
    { name: app.title, url: pagePath }
  ];
  const jsonLd = await renderJsonLd({
    kind: 'app', path: pagePath,
    title: app.title,
    description: app.detail_paragraphs?.[0] || app.tagline,
    surface: app.surface,
    features: app.features || (app.feature_groups || []).flatMap(g => g.features),
    faqs, breadcrumbs
  });
  const related = await loadAppRelated(app);
  const relatedBlock = renderRelatedBlock(related);

  const heroVideo = app.hero_video ? `
    <div class="hero-video" id="watch">
      <video autoplay muted loop playsinline preload="auto"
             data-src="${esc(app.hero_video)}"
             onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'poster-fallback',innerText:'demo video — drop hero.mp4 in for play'}));"></video>
    </div>
  ` : '';

  // Inline stat line (Phase 7.2): replaces the 4-tile outcomes-strip
  // dashboard cliché. tabular-nums on numbers, mid-dot separators.
  const outcomesStrip = (app.key_outcomes || []).length
    ? `<p class="ap-stats-inline">${app.key_outcomes.map(o => `
        <span><span class="ap-stat-num">${esc(o.stat)}</span>${esc(o.label)}</span>`).join('<span aria-hidden="true">·</span>')}</p>`
    : '';

  const shiftLeftHtml = app.the_shift ? `<p>${esc(app.the_shift.before || '')}</p>` : '';
  const shiftRightHtml = app.the_shift ? `<p>${esc(app.the_shift.after || '')}</p>` : '';

  const audience = (app.best_for || []).map(b => `<span class="ap">${esc(b)}</span>`).join('');

  const ctaLabel  = (app.primary_cta   && app.primary_cta.label)   || 'Download';
  const ctaHref   = (app.primary_cta   && app.primary_cta.href)    || '/downloads/index.html';
  const cta2Label = (app.secondary_cta && app.secondary_cta.label) || 'See it in action';
  const cta2Href  = (app.secondary_cta && app.secondary_cta.href)  || '/demos/index.html';
  const endCtaBlurb = (app.primary_cta && /^download/i.test(app.primary_cta.label))
    ? 'Self-serve install. No sales call, no walkthrough required.'
    : `Open ${app.title} in your browser — no install needed.`;

  // SEO/AEO H3 phrases (with auto-derived defaults if not provided)
  const seo = app.seo || {};
  const seoWhy     = seo.why_h3     || `What ${app.title} changes for MEP teams`;
  const seoShift   = seo.shift_h3   || `Manual workflow vs ${app.title}-led workflow`;
  const seoSpecial = seo.special_h3 || `What makes ${app.title} different`;
  const seoWho     = seo.who_h3     || `Who ${app.title} is built for`;

  const html = tmpl
    .replaceAll('{{title}}',                  esc(app.title))
    .replaceAll('{{slug}}',                   esc(app.slug))
    .replaceAll('{{headline_claim}}',         esc(app.headline_claim || app.tagline || ''))
    .replaceAll('{{tagline}}',                esc(app.tagline || ''))
    .replaceAll('{{blurb}}',                  esc(app.blurb || ''))
    .replaceAll('{{surface}}',                esc(app.surface || ''))
    .replaceAll('{{icon}}',                   esc(app.icon || 'logos/Node Logo.png'))
    .replaceAll('{{tone}}',                   esc(app.tone || 'blue'))
    .replaceAll('{{what_makes_it_special}}',  esc(app.what_makes_it_special || ''))
    .replaceAll('{{cta_label}}',              esc(ctaLabel))
    .replaceAll('{{cta_href}}',               esc(ctaHref))
    .replaceAll('{{cta2_label}}',             esc(cta2Label))
    .replaceAll('{{cta2_href}}',              esc(cta2Href))
    .replaceAll('{{end_cta_blurb}}',          esc(endCtaBlurb))
    .replaceAll('{{outcomes_strip}}',         outcomesStrip)
    .replaceAll('{{detail_paragraphs_html}}', detailParagraphsHtml)
    .replaceAll('{{pullquote}}',              esc(pullquote).replace(/\{\{accent\}\}/g, '<span class="accent">').replace(/\{\{\/accent\}\}/g, '</span>'))
    .replaceAll('{{features_block}}',         featuresBlock)
    .replaceAll('{{install_block}}',          installBlock)
    .replaceAll('{{hero_video_block}}',       heroVideo)
    .replaceAll('{{seo_head}}',               seoHead)
    .replaceAll('{{json_ld}}',                jsonLd)
    .replaceAll('{{faq_block}}',              faqBlock)
    .replaceAll('{{related_block}}',          relatedBlock)
    .replaceAll('{{shift_left_html}}',         shiftLeftHtml)
    .replaceAll('{{shift_right_html}}',        shiftRightHtml)
    .replaceAll('{{audience_html}}',          audience)
    .replaceAll('{{seo_why_h3}}',             esc(seoWhy))
    .replaceAll('{{seo_shift_h3}}',           esc(seoShift))
    .replaceAll('{{seo_special_h3}}',         esc(seoSpecial))
    .replaceAll('{{seo_who_h3}}',             esc(seoWho))
    .replaceAll('{{generated_at}}',           new Date().toISOString());

  const out = O('apps', app.slug, 'index.html');
  await fs.mkdir(path.dirname(out), { recursive: true });
  await fs.writeFile(out, html, 'utf8');
  return out;
}

export async function buildAppsInventory() {
  const data = await loadJson('sandbox/data/apps.json');
  const tmpl = await fs.readFile(T('apps-inventory.html'), 'utf8');

  const TILE_ORDER = [
    'revit-copilot', 'adelphos-chat', 'specbuilder',
    'report-builder', 'document-controller', 'qa-manager',
    'schedule-builder', 'cobie-manager', 'autocad-copilot',
    'word-add-in', 'excel-add-in'
  ];
  const allApps = [...data.apps].sort((a, b) => {
    const ai = TILE_ORDER.indexOf(a.slug);
    const bi = TILE_ORDER.indexOf(b.slug);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });

  const tilesHtml = allApps.map(a => renderTile(a)).join('');

  const seoHead = await renderSeoHead({
    title: 'Apps — Adelphos AI',
    description: data.section_blurb,
    path: '/apps/index.html',
    type: 'website',
    keywords: ['Adelphos AI apps', 'MEP software', 'Revit add-in', ...data.apps.map(a => a.title)]
  });
  const jsonLd = await renderJsonLd({
    kind: 'inventory', path: '/apps/index.html',
    title: 'Adelphos AI Apps', description: data.section_blurb,
    items: data.apps.map(a => ({ name: a.title, url: `/apps/${a.slug}/index.html` })),
    breadcrumbs: [{ name: 'Home', url: '/' }, { name: 'Apps', url: '/apps/index.html' }]
  });

  const html = tmpl
    .replaceAll('{{section_lead}}',  esc(data.section_lead || data.section_title || 'Apps'))
    .replaceAll('{{section_blurb}}', esc(data.section_blurb || ''))
    .replaceAll('{{count}}',         String(data.apps.length))
    .replaceAll('{{tiles_html}}',    tilesHtml)
    .replaceAll('{{seo_head}}',      seoHead)
    .replaceAll('{{json_ld}}',       jsonLd)
    .replaceAll('{{generated_at}}',  new Date().toISOString());

  const out = O('apps', 'index.html');
  await fs.mkdir(path.dirname(out), { recursive: true });
  await fs.writeFile(out, html, 'utf8');
  return { out, count: data.apps.length };
}

// Flagship card matches templates/apps-inventory.html .ai-flagship —
// 2-col copy LEFT + painted artsy frame RIGHT with the 240px PNG logo.
// Single-law: direct Section 2 derivative.
function renderFlagship(a) {
  return `
    <a class="ai-flagship" href="/apps/${esc(a.slug)}/index.html">
      <div class="copy">
        <span class="badge">Flagship · ${esc(a.surface ? a.surface.split('·')[0].trim() : 'Live')}</span>
        <h2>${esc(a.title)}</h2>
        <p class="claim">${esc(a.headline_claim || a.tagline || '')}</p>
        <span class="arrow">Open ${esc(a.title)} →</span>
      </div>
      <div class="visual">
        <img src="/${esc(a.icon || 'logos/Node Logo.png')}" alt="${esc(a.title)} logo" onerror="this.style.opacity=0">
      </div>
    </a>`;
}

// Tile = .app-tile (dark .rp-commands-card derivative, same vocab as
// the home Section 3 .app-card carousel, just here in a grid).
const SVG_ICON_MAP = {
  'revit-copilot':       'images/app-logos/revit-copilot-sparkles.svg',
  'adelphos-chat':       'images/app-logos/adelphos-chat.svg',
  'specbuilder':         'images/app-logos/specbuilder.svg',
  'report-builder':      'images/app-logos/report-builder.svg',
  'document-controller': 'images/app-logos/document-controller.svg',
  'qa-manager':          'images/app-logos/qa-manager.svg',
  'schedule-builder':    'images/app-logos/schedule-builder.svg',
  'cobie-manager':       'images/app-logos/cobie-manager.svg',
  'autocad-copilot':     'images/app-logos/autocad-copilot-sparkles.svg',
};

function renderTile(a) {
  const surfLabel = a.surface
    ? a.surface.split('·').slice(0, 2).map(s => s.trim()).join(' · ')
    : 'App';
  const icon = SVG_ICON_MAP[a.slug] || a.icon || 'logos/Node Logo.png';
  return `
    <a class="app-tile" href="/apps/${esc(a.slug)}/index.html">
      <div class="icon-wrap">
        <img src="/${esc(icon)}" alt="${esc(a.title)}">
      </div>
      <h3>${esc(a.title)}</h3>
      <span class="surf">${esc(surfLabel)}</span>
      <p class="claim">${esc(a.headline_claim || a.tagline || '')}</p>
      <span class="arrow">Open →</span>
    </a>`;
}

function renderFeatures(entity) {
  const renderItems = items => items.map(f => `
    <div class="rp-feat-item">
      <div class="rp-feat-copy">
        <span class="rp-feat-title">${esc(f.name)}</span>
        <span class="rp-feat-desc">${esc(f.desc)}</span>
      </div>
      <div class="rp-agent-spinner"></div>
    </div>`).join('');

  let body = '';
  if (Array.isArray(entity.feature_groups) && entity.feature_groups.length) {
    body = entity.feature_groups.map(g => `
      <p class="ap-feat-group-label">${esc(g.title)} · ${(g.features || []).length}</p>
      <div class="rp-feat-list">${renderItems(g.features || [])}</div>`).join('');
  } else if (Array.isArray(entity.features) && entity.features.length) {
    body = `<div class="rp-feat-list">${renderItems(entity.features)}</div>`;
  } else {
    return '';
  }

  return `
    <div class="ap-features-card rp-commands-card">
      <h2 class="rp-card-header">${esc(entity.title)} features</h2>
      ${body}
    </div>`;
}

// Renders the Install section body:
//   • a 3+ column platform strip (top)
//   • a 2-column meta block (Requirements + Sign-in)
//   • a CTA row (primary + secondary)
function renderInstall(entity) {
  const i = entity.install;
  if (!i) return '';

  const strip = (i.platforms || []).length ? `
    <div class="install-strip">
      ${i.platforms.map(p => `
        <div class="install-tile">
          ${platformGlyph(p.name)}
          <span class="pname">${esc(p.name)}</span>
          <span class="pspec">${esc(p.spec)}</span>
        </div>`).join('')}
    </div>` : '';

  const meta = (i.requirements || i.auth) ? `
    <div class="install-meta">
      ${(i.requirements || []).length ? `
        <div class="meta-block">
          <h4>Requirements</h4>
          <ul>${i.requirements.map(r => `<li>${esc(r)}</li>`).join('')}</ul>
        </div>` : '<div></div>'}
      ${i.auth ? `
        <div class="meta-block">
          <h4>Sign-in</h4>
          <p class="auth-text">${esc(i.auth)}</p>
        </div>` : ''}
    </div>` : '';

  const cta = i.download_label ? `
    <div class="install-cta-row">
      <a class="cta-primary" href="${esc(i.download_href || '/downloads/index.html')}">${esc(i.download_label)} →</a>
      <a class="cta-secondary" href="/docs/index.html">Read the docs first</a>
    </div>` : '';

  return strip + meta + cta;
}

// Build the "Related" block: 2 sibling apps (excluding self) + 1 agentic service.
async function loadAppRelated(currentApp) {
  const apps = (await loadJson('sandbox/data/apps.json')).apps;
  const services = (await loadJson('sandbox/data/agentic-services.json')).services;
  const siblings = apps.filter(a => a.slug !== currentApp.slug).slice(0, 2);
  const matchedService = services.find(s =>
    s.title.toLowerCase().includes(currentApp.title.toLowerCase().split(' ')[0])
  ) || services.find(s => s.is_flagship) || services[0];

  return [
    ...siblings.map(a => ({
      kind: 'App', title: a.title,
      desc: a.tagline || a.headline_claim,
      url:  `/apps/${a.slug}/index.html`
    })),
    matchedService && {
      kind: 'Agentic service', title: matchedService.title,
      desc: matchedService.tagline,
      url:  `/agentic-services/${matchedService.slug}/index.html`
    }
  ].filter(Boolean);
}

export async function buildAllAppPages() {
  const data = await loadJson('sandbox/data/apps.json');
  const outs = [];
  for (const a of data.apps) outs.push(await renderApp(a));
  return outs;
}
