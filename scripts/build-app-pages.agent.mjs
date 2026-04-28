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
    keywords: ['Adelphos AI', app.title, 'MEP', 'Revit', ...(app.best_for || [])],
    lastmod
  });
  const faqs = buildAutoFaqs(app, 'app');
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
      <video controls preload="metadata"
             poster="/app-assets/${esc(app.slug)}/hero.svg"
             data-src="${esc(app.hero_video)}"
             onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'poster-fallback',innerText:'demo video — drop hero.mp4 in for play'}));"></video>
    </div>
  ` : '';

  const outcomesStrip = (app.key_outcomes || []).length
    ? `<div class="outcomes-strip">${app.key_outcomes.map(o => `
        <div class="ostat"><span class="num">${esc(o.stat)}</span><span class="lbl">${esc(o.label)}</span></div>`).join('')}</div>`
    : '';

  const shiftBlock = app.the_shift
    ? `<div class="shift-grid">
         <div class="shift before"><p class="lab">Before</p><p>${esc(app.the_shift.before || '')}</p></div>
         <div class="shift after"><p class="lab">After {{title}}</p><p>${esc(app.the_shift.after || '')}</p></div>
       </div>`.replaceAll('{{title}}', esc(app.title))
    : '';

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
    .replaceAll('{{pullquote}}',              esc(pullquote))
    .replaceAll('{{features_block}}',         featuresBlock)
    .replaceAll('{{install_block}}',          installBlock)
    .replaceAll('{{hero_video_block}}',       heroVideo)
    .replaceAll('{{seo_head}}',               seoHead)
    .replaceAll('{{json_ld}}',                jsonLd)
    .replaceAll('{{faq_block}}',              faqBlock)
    .replaceAll('{{related_block}}',          relatedBlock)
    .replaceAll('{{shift_block}}',            shiftBlock)
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

  const flagship = data.apps.find(a => a.is_flagship);
  const others   = data.apps.filter(a => !a.is_flagship);

  const flagshipHtml = flagship ? renderFlagship(flagship) : '';
  const tilesHtml = others.map(a => renderTile(a)).join('');

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
    .replaceAll('{{flagship_html}}', flagshipHtml)
    .replaceAll('{{tiles_html}}',    tilesHtml)
    .replaceAll('{{seo_head}}',      seoHead)
    .replaceAll('{{json_ld}}',       jsonLd)
    .replaceAll('{{generated_at}}',  new Date().toISOString());

  const out = O('apps', 'index.html');
  await fs.mkdir(path.dirname(out), { recursive: true });
  await fs.writeFile(out, html, 'utf8');
  return { out, count: data.apps.length };
}

function renderFlagship(a) {
  const stats = (a.key_outcomes || []).slice(0, 4).map(o => `
    <div class="stat">
      <span class="num">${esc(o.stat)}</span>
      <span class="lbl">${esc(o.label)}</span>
    </div>`).join('');
  return `
    <a class="flagship" href="/apps/${esc(a.slug)}/index.html">
      <div class="copy">
        <span class="badge">Flagship · ${esc(a.surface ? a.surface.split('·')[0].trim() : 'Live')}</span>
        <h2>${esc(a.title)}</h2>
        <p class="claim">${esc(a.headline_claim || a.tagline || '')}</p>
        <div class="stats">${stats}</div>
        <span class="arrow">Explore ${esc(a.title)}  →</span>
      </div>
      <div class="visual"><span class="play">▶</span></div>
    </a>`;
}

function renderTile(a) {
  const outcomes = (a.key_outcomes || []).slice(0, 3).map(o => `
    <div class="stat"><span class="num">${esc(o.stat)}</span><span class="lbl">${esc(o.label)}</span></div>`).join('');
  return `
    <a class="app-tile" href="/apps/${esc(a.slug)}/index.html">
      <div class="visual">
        <img src="/${esc(a.icon || 'logos/Node Logo.png')}" alt="" onerror="this.style.opacity=0">
      </div>
      <div class="body">
        <span class="surf">${esc(a.surface || '')}</span>
        <h3>${esc(a.title)}</h3>
        <p class="claim">${esc(a.headline_claim || a.tagline || '')}</p>
        <div class="outcomes">${outcomes}</div>
        <span class="more">See ${esc(a.title)} </span>
      </div>
    </a>`;
}

// Renders features as rp-feat-item separator rows with agent spinners.
// Two variants:
//   • Flat features[]      → single .rp-feat-list
//   • feature_groups[]     → grouped sections; each group has its own .rp-feat-list
function renderFeatures(entity) {
  const renderList = items => `<div class="rp-feat-list">${items.map(f => `
    <div class="rp-feat-item">
      <div class="rp-feat-copy">
        <span class="rp-feat-title">${esc(f.name)}</span>
        <span class="rp-feat-desc">${esc(f.desc)}</span>
      </div>
      <div class="rp-agent-spinner"></div>
    </div>`).join('')}</div>`;

  if (Array.isArray(entity.feature_groups) && entity.feature_groups.length) {
    return entity.feature_groups.map(g => `
      <section class="ap-group">
        <h3 class="ap-group-label">${esc(g.title)} <span class="ap-group-count">${(g.features || []).length}</span></h3>
        ${renderList(g.features || [])}
      </section>`).join('');
  }
  if (Array.isArray(entity.features) && entity.features.length) {
    return renderList(entity.features);
  }
  return '';
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
        <div class="platform">
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
