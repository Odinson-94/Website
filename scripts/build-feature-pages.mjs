/**
 * scripts/build-feature-pages.mjs
 *
 * Generates one detail page per feature (3D Plantroom Designer, PDF to 3D,
 * AutoRoute, Clash Solver) from sandbox/data/features.json — plus a
 * features inventory page.
 *
 * Reuses the app-page template + renderApp pipeline because features share
 * the same crown-jewel layout. The only differences are the URL prefix
 * (/dist/features/...) and a section label of "Feature".
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { ROOT, loadJson } from './lib/registry.mjs';
import { renderSeoHead, renderJsonLd, buildAutoFaqs, renderFaqBlock, renderRelatedBlock, gitLastMod } from './lib/seo.mjs';

const T = (n) => path.join(ROOT, 'templates', n);
const O = (...p) => path.join(ROOT, 'dist', ...p);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

export async function buildFeaturePage(slug) {
  const data = await loadJson('sandbox/data/features.json');
  const f = data.features.find(x => x.slug === slug);
  if (!f) throw new Error(`feature "${slug}" not found in sandbox/data/features.json`);
  return await renderFeature(f);
}

async function renderFeature(f) {
  // We re-use the app-page template — features share its crown-jewel structure.
  const tmpl = await fs.readFile(T('app-page.html'), 'utf8');

  let brand = {};
  try { brand = await loadJson('sandbox/data/brand.json'); } catch {}
  const pullquote = f.pullquote || brand.pullquote || '';

  const paragraphs = Array.isArray(f.detail_paragraphs) && f.detail_paragraphs.length
    ? f.detail_paragraphs
    : [f.detail_paragraph || f.blurb || ''];
  const detailParagraphsHtml = paragraphs
    .filter(Boolean)
    .map(p => `<p>${esc(p)}</p>`)
    .join('\n      ');

  const featuresBlock = renderCapabilities(f);
  const installBlock  = renderInstall(f);

  const heroVideo = f.hero_video ? `
    <div class="hero-video" id="watch">
      <video controls preload="metadata"
             poster="/sandbox/feature-assets/${esc(f.slug)}/hero.svg"
             data-src="${esc(f.hero_video)}"
             onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'poster-fallback',innerText:'demo video — drop hero.mp4 in /Videos/ to play'}));"></video>
    </div>
    <script>document.querySelectorAll('video[data-src]').forEach(v => { if (!v.src) v.src = v.dataset.src; });</script>
  ` : '';

  const outcomesStrip = (f.key_outcomes || []).length
    ? `<div class="outcomes-strip">${f.key_outcomes.map(o => `
        <div class="ostat"><span class="num">${esc(o.stat)}</span><span class="lbl">${esc(o.label)}</span></div>`).join('')}</div>`
    : '';

  const shiftBlock = f.the_shift
    ? `<div class="shift-grid">
         <div class="shift before"><p class="lab">Before</p><p>${esc(f.the_shift.before || '')}</p></div>
         <div class="shift after"><p class="lab">After ${esc(f.title)}</p><p>${esc(f.the_shift.after || '')}</p></div>
       </div>`
    : '';

  const audience = (f.best_for || []).map(b => `<span class="ap">${esc(b)}</span>`).join('');

  const ctaLabel  = (f.install && f.install.download_label) || 'Try this feature';
  const ctaHref   = (f.install && f.install.download_href)  || '/contact/';
  const cta2Label = 'See related apps';
  const cta2Href  = '/dist/apps/index.html';
  const endCtaBlurb = 'Built into the Adelphos platform. Self-serve where possible, managed where useful.';

  // SEO / AEO
  const pagePath = `/dist/features/${f.slug}/index.html`;
  const lastmod = await gitLastMod('sandbox/data/features.json');
  const seoHead = await renderSeoHead({
    title: `${f.title} — Features`,
    description: f.headline_claim || f.tagline,
    path: pagePath, type: 'product',
    keywords: ['Adelphos AI', f.title, 'MEP automation', ...(f.best_for || [])],
    lastmod
  });
  const faqs = buildAutoFaqs(f, 'app');
  const faqBlock = renderFaqBlock(faqs);
  const breadcrumbs = [
    { name: 'Home',     url: '/' },
    { name: 'Features', url: '/dist/features/index.html' },
    { name: f.title,    url: pagePath }
  ];
  const jsonLd = await renderJsonLd({
    kind: 'app', path: pagePath,
    title: f.title,
    description: f.detail_paragraphs?.[0] || f.tagline,
    surface: (f.install && f.install.platforms?.[0]?.spec) || 'Service',
    features: f.features,
    faqs, breadcrumbs
  });

  // Related: 1 sibling feature + 2 most-relevant apps
  const apps    = (await loadJson('sandbox/data/apps.json')).apps;
  const others  = (await loadJson('sandbox/data/features.json')).features.filter(x => x.slug !== f.slug);
  const sibling = others[0];
  const relatedApps = apps.slice(0, 2);
  const related = [
    sibling && { kind: 'Feature', title: sibling.title, desc: sibling.tagline,
                 url: `/dist/features/${sibling.slug}/index.html` },
    ...relatedApps.map(a => ({ kind: 'App', title: a.title, desc: a.tagline,
                               url: `/dist/apps/${a.slug}/index.html` }))
  ].filter(Boolean);
  const relatedBlock = renderRelatedBlock(related);

  const html = tmpl
    .replaceAll('{{title}}',                  esc(f.title))
    .replaceAll('{{headline_claim}}',         esc(f.headline_claim || f.tagline || ''))
    .replaceAll('{{tagline}}',                esc(f.tagline || ''))
    .replaceAll('{{blurb}}',                  esc(f.blurb || ''))
    .replaceAll('{{surface}}',                esc((f.install && f.install.platforms?.[0]?.name) || 'Adelphos service'))
    .replaceAll('{{icon}}',                   esc(f.icon || 'logos/Node Logo.png'))
    .replaceAll('{{what_makes_it_special}}',  esc(f.what_makes_it_special || ''))
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
    .replaceAll('{{shift_block}}',            shiftBlock)
    .replaceAll('{{audience_html}}',          audience)
    .replaceAll('{{seo_why_h3}}',             esc(f.seo?.why_h3     || `What ${f.title} changes`))
    .replaceAll('{{seo_shift_h3}}',           esc(f.seo?.shift_h3   || `Manual workflow vs ${f.title}`))
    .replaceAll('{{seo_special_h3}}',         esc(f.seo?.special_h3 || `What makes ${f.title} different`))
    .replaceAll('{{seo_who_h3}}',             esc(f.seo?.who_h3     || `Who ${f.title} is built for`))
    .replaceAll('{{seo_head}}',               seoHead)
    .replaceAll('{{json_ld}}',                jsonLd)
    .replaceAll('{{faq_block}}',              faqBlock)
    .replaceAll('{{related_block}}',          relatedBlock)
    .replaceAll('{{generated_at}}',           new Date().toISOString());

  const out = O('features', f.slug, 'index.html');
  await fs.mkdir(path.dirname(out), { recursive: true });
  await fs.writeFile(out, html, 'utf8');
  return out;
}

function renderCapabilities(entity) {
  const renderList = items => `<ul class="feat-list">${items.map(f => `
    <li>
      <span class="name">${esc(f.name)}</span>
      <span class="desc">${esc(f.desc)}</span>
    </li>`).join('')}</ul>`;
  if (Array.isArray(entity.features) && entity.features.length) return renderList(entity.features);
  return '';
}

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
      <a class="cta-primary" href="${esc(i.download_href || '/contact/')}">${esc(i.download_label)} →</a>
      <a class="cta-secondary" href="/dist/docs/index.html">Read the docs first</a>
    </div>` : '';
  return strip + meta + cta;
}

export async function buildFeaturesInventory() {
  const data = await loadJson('sandbox/data/features.json');
  const tmpl = await fs.readFile(T('apps-inventory.html'), 'utf8');

  const flagship = data.features.find(f => f.is_flagship);
  const others   = data.features.filter(f => !f.is_flagship);

  const flagshipHtml = flagship ? renderFlagship(flagship) : '';
  const tilesHtml = others.map(f => renderTile(f)).join('');

  const seoHead = await renderSeoHead({
    title: 'Features — Adelphos AI',
    description: data.section_blurb,
    path: '/dist/features/index.html',
    type: 'website',
    keywords: ['Adelphos AI features', 'MEP automation', 'plantroom design', 'auto-route', 'clash solver', 'PDF to Revit']
  });
  const jsonLd = await renderJsonLd({
    kind: 'inventory', path: '/dist/features/index.html',
    title: 'Adelphos AI Features', description: data.section_blurb,
    items: data.features.map(f => ({ name: f.title, url: `/dist/features/${f.slug}/index.html` })),
    breadcrumbs: [{ name: 'Home', url: '/' }, { name: 'Features', url: '/dist/features/index.html' }]
  });

  const html = tmpl
    .replaceAll('{{section_lead}}',  esc(data.section_lead  || data.section_title || 'Features'))
    .replaceAll('{{section_blurb}}', esc(data.section_blurb || ''))
    .replaceAll('{{count}}',         String(data.features.length))
    .replaceAll('{{flagship_html}}', flagshipHtml)
    .replaceAll('{{tiles_html}}',    tilesHtml)
    .replaceAll('{{seo_head}}',      seoHead)
    .replaceAll('{{json_ld}}',       jsonLd)
    .replaceAll('{{generated_at}}',  new Date().toISOString());

  const out = O('features', 'index.html');
  await fs.mkdir(path.dirname(out), { recursive: true });
  await fs.writeFile(out, html, 'utf8');
  return { out, count: data.features.length };
}

function renderFlagship(f) {
  const stats = (f.key_outcomes || []).slice(0, 4).map(o => `
    <div class="stat"><span class="num">${esc(o.stat)}</span><span class="lbl">${esc(o.label)}</span></div>`).join('');
  return `
    <a class="flagship" href="/dist/features/${esc(f.slug)}/index.html">
      <div class="copy">
        <span class="badge">Flagship Feature</span>
        <h2>${esc(f.title)}</h2>
        <p class="claim">${esc(f.headline_claim || f.tagline || '')}</p>
        <div class="stats">${stats}</div>
        <span class="arrow">Explore ${esc(f.title)}  →</span>
      </div>
      <div class="visual"><span class="play">▶</span></div>
    </a>`;
}

function renderTile(f) {
  const outcomes = (f.key_outcomes || []).slice(0, 3).map(o => `
    <div class="stat"><span class="num">${esc(o.stat)}</span><span class="lbl">${esc(o.label)}</span></div>`).join('');
  return `
    <a class="app-tile" href="/dist/features/${esc(f.slug)}/index.html">
      <div class="visual">
        <img src="/${esc(f.icon || 'logos/Node Logo.png')}" alt="" onerror="this.style.opacity=0">
      </div>
      <div class="body">
        <span class="surf">Feature</span>
        <h3>${esc(f.title)}</h3>
        <p class="claim">${esc(f.headline_claim || f.tagline || '')}</p>
        <div class="outcomes">${outcomes}</div>
        <span class="more">See ${esc(f.title)} </span>
      </div>
    </a>`;
}

export async function buildAllFeaturePages() {
  const data = await loadJson('sandbox/data/features.json');
  const outs = [];
  for (const f of data.features) outs.push(await renderFeature(f));
  return outs;
}
