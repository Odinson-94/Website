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

// Phase 7.5: install platform glyph (same set as build-app-pages.mjs).
function platformGlyph(rawName) {
  const n = String(rawName || '').toLowerCase();
  let path;
  if (/revit/.test(n))                         path = '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 17V8h5a3 3 0 0 1 0 6H7m6 3-3-3"/>';
  else if (/autocad/.test(n))                  path = '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 16l5-9 5 9M9 13h6"/>';
  else if (/word/.test(n))                     path = '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M6 8l2 9 3-7 3 7 2-9"/>';
  else if (/excel/.test(n))                    path = '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 8l8 8M16 8l-8 8"/>';
  else if (/(macos|mac os|apple)/.test(n))     path = '<path d="M16 9c-1 0-3 1-4 1s-3-1-4-1c-3 0-4 3-4 5 0 4 3 8 5 8 1 0 1.5-.5 3-.5s2 .5 3 .5c2 0 5-4 5-8 0-2-1-5-4-5z"/><path d="M13 6c0-1 1-3 2-3"/>';
  else if (/win|windows/.test(n))              path = '<path d="M3 5l8-1v8H3zM12 4l9-1v9h-9zM3 13h8v8l-8-1zM12 13h9v9l-9-1z"/>';
  else if (/web|browser|chrome|firefox|safari/.test(n)) path = '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>';
  else if (/server|service|daemon|background/.test(n)) path = '<rect x="3" y="4" width="18" height="6" rx="1"/><rect x="3" y="14" width="18" height="6" rx="1"/><circle cx="7" cy="7" r="0.6"/><circle cx="7" cy="17" r="0.6"/>';
  else                                          path = '<rect x="3" y="4" width="18" height="14" rx="2"/><path d="M3 10h18M7 4v14"/>';
  return `<svg class="install-glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
}

export async function buildFeaturePage(slug) {
  const data = await loadJson('sandbox/data/features.json');
  const f = data.features.find(x => x.slug === slug);
  if (!f) throw new Error(`feature "${slug}" not found in sandbox/data/features.json`);
  return await renderFeature(f);
}

async function renderFeature(f) {
  const tmpl = await fs.readFile(T('feature-showcase.html'), 'utf8');

  const ctaLabel  = 'Open Revit Copilot';
  const ctaHref   = '/dist/apps/revit-copilot/index.html';
  const cta2Label = 'See all apps';
  const cta2Href  = '/dist/apps/index.html';
  const endCtaBlurb = 'Built into the Adelphos platform. Available through the Revit Copilot.';

  const outcomesStrip = (f.key_outcomes || []).length
    ? `<p class="fs-stats">${f.key_outcomes.map(o => `
        <span><span class="num">${esc(o.stat)}</span>${esc(o.label)}</span>`).join('<span aria-hidden="true">\u00b7</span>')}</p>`
    : '';

  const heroVideoInner = f.hero_video
    ? `<video autoplay muted loop playsinline preload="auto" data-src="${esc(f.hero_video)}" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'fs-video-placeholder',innerText:'demo video \u2014 coming soon'}));"></video>
       <script>document.querySelectorAll('video[data-src]').forEach(v=>{if(!v.src)v.src=v.dataset.src;});</script>`
    : `<div class="fs-video-placeholder">demo video \u2014 coming soon</div>`;

  const rows = (f.showcase_rows || []).map((row, i) => {
    const flipClass = i % 2 === 1 ? ' flip' : '';
    const delayClass = `fs-reveal d${Math.min(i + 2, 4)}`;
    return `
  <div class="fs-row${flipClass} ${delayClass}">
    <div class="fs-row-media">
      <div class="fs-video-placeholder">video ${i + 1} \u2014 coming soon</div>
    </div>
    <div class="fs-row-copy">
      <p class="fs-display">${esc(row.display)}</p>
      <p class="fs-body">${esc(row.body)}</p>
    </div>
  </div>`;
  }).join('\n');

  const breadcrumbHtml = `<a href="/">Home</a> &rsaquo; <a href="/dist/apps/revit-copilot/index.html">Revit Copilot</a> &rsaquo; ${esc(f.title)}`;

  // SEO
  const pagePath = `/dist/features/${f.slug}/index.html`;
  const lastmod = await gitLastMod('sandbox/data/features.json');
  const seoHead = await renderSeoHead({
    title: `${f.title} \u2014 Features`,
    description: f.hero_statement || f.headline_claim || f.tagline,
    path: pagePath, type: 'product',
    keywords: ['Adelphos AI', f.title, 'MEP automation', 'AI engineering', ...(f.best_for || [])],
    lastmod
  });
  const faqs = buildAutoFaqs(f, 'app');
  const faqBlock = renderShowcaseFaq(faqs);
  const breadcrumbs = [
    { name: 'Home',     url: '/' },
    { name: 'Features', url: '/dist/features/index.html' },
    { name: f.title,    url: pagePath }
  ];
  const jsonLd = await renderJsonLd({
    kind: 'app', path: pagePath,
    title: f.title,
    description: f.detail_paragraphs?.[0] || f.tagline,
    surface: 'Feature',
    features: f.features || f.showcase_rows?.map(r => ({ name: r.display.slice(0, 60), desc: r.body })),
    faqs, breadcrumbs
  });

  // Related apps
  const apps = (await loadJson('sandbox/data/apps.json')).apps;
  const relatedApps = apps.filter(a => ['revit-copilot', 'adelphos-chat', 'schedule-builder'].includes(a.slug)).slice(0, 3);
  const relatedBlock = renderShowcaseRelated(relatedApps);

  const html = tmpl
    .replaceAll('{{title}}',              esc(f.title))
    .replaceAll('{{hero_statement}}',     esc(f.hero_statement || f.headline_claim || ''))
    .replaceAll('{{outcomes_strip}}',     outcomesStrip)
    .replaceAll('{{cta_label}}',          esc(ctaLabel))
    .replaceAll('{{cta_href}}',           esc(ctaHref))
    .replaceAll('{{cta2_label}}',         esc(cta2Label))
    .replaceAll('{{cta2_href}}',          esc(cta2Href))
    .replaceAll('{{hero_video_inner}}',   heroVideoInner)
    .replaceAll('{{showcase_rows}}',      rows)
    .replaceAll('{{breadcrumb_html}}',    breadcrumbHtml)
    .replaceAll('{{end_cta_heading}}',    esc(f.end_cta_heading || `Try ${f.title}`))
    .replaceAll('{{end_cta_blurb}}',      esc(endCtaBlurb))
    .replaceAll('{{seo_head}}',           seoHead)
    .replaceAll('{{json_ld}}',            jsonLd)
    .replaceAll('{{faq_block}}',          faqBlock)
    .replaceAll('{{related_block}}',      relatedBlock)
    .replaceAll('{{generated_at}}',       new Date().toISOString());

  const out = O('features', f.slug, 'index.html');
  await fs.mkdir(path.dirname(out), { recursive: true });
  await fs.writeFile(out, html, 'utf8');
  return out;
}

function renderShowcaseFaq(faqs) {
  if (!faqs || !faqs.length) return '';
  const items = faqs.map((faq, i) => `
    <details class="fs-faq-item"${i === 0 ? ' open' : ''}>
      <summary>${esc(faq.question || faq.name)}</summary>
      <div class="answer"><p>${esc(faq.answer || faq.acceptedAnswer?.text || '')}</p></div>
    </details>`).join('');
  return `
  <section class="fs-faq" id="faq" aria-label="Frequently asked questions">
    <h2>Frequently asked questions</h2>
    <div class="fs-faq-list">${items}</div>
  </section>`;
}

function renderShowcaseRelated(apps) {
  if (!apps || !apps.length) return '';
  const cards = apps.map(a => `
    <a class="fs-related-card" href="/dist/apps/${esc(a.slug)}/index.html">
      <span class="kind">App</span>
      <strong>${esc(a.title)}</strong>
      <span class="desc">${esc(a.tagline || '')}</span>
    </a>`).join('');
  return `
  <section class="fs-related" id="related" aria-label="Runs inside these apps">
    <h2>Runs inside these apps</h2>
    <div class="fs-related-grid">${cards}</div>
  </section>`;
}

// Phase 8.1: per-slug CSS schematic mockup for the feature-page hero
// painted-frame (replaces the misleading PNG hero). Same shape as the
// .feat-mock CSS already in templates/apps-inventory.html, just sized
// up for the larger 240-square hero slot.
function featureHeroMockup(slug) {
  let body;
  if (slug === 'clash-solver') {
    body = `
      <div class="feat-mock feat-mock-clash" aria-hidden="true">
        <div class="feat-mock-duct"></div>
        <div class="feat-mock-pipe-ramp"></div>
        <div class="feat-mock-marker feat-mock-marker-1"></div>
        <div class="feat-mock-marker feat-mock-marker-2"></div>
      </div>`;
  } else if (slug === 'autoroute') {
    body = `
      <div class="feat-mock feat-mock-autoroute" aria-hidden="true">
        <div class="feat-mock-pipe feat-mock-pipe-1"></div>
        <div class="feat-mock-pipe feat-mock-pipe-2"></div>
        <div class="feat-mock-elbow feat-mock-elbow-1"></div>
        <div class="feat-mock-elbow feat-mock-elbow-2"></div>
      </div>`;
  } else if (slug === 'plantroom-designer-3d') {
    body = `
      <div class="feat-mock feat-mock-plantroom" aria-hidden="true">
        <div class="feat-mock-eq feat-mock-eq-1"></div>
        <div class="feat-mock-eq feat-mock-eq-2"></div>
        <div class="feat-mock-eq feat-mock-eq-3"></div>
        <div class="feat-mock-header"></div>
      </div>`;
  } else if (slug === 'pdf-to-3d') {
    body = `
      <div class="feat-mock feat-mock-pdf" aria-hidden="true">
        <div class="feat-mock-doc">
          <div class="feat-mock-doc-line feat-mock-doc-line-1"></div>
          <div class="feat-mock-doc-line feat-mock-doc-line-2"></div>
          <div class="feat-mock-doc-line feat-mock-doc-line-3"></div>
          <div class="feat-mock-doc-line feat-mock-doc-line-4"></div>
        </div>
        <div class="feat-mock-arrow"></div>
        <div class="feat-mock-cube">
          <div class="feat-mock-cube-face feat-mock-cube-front"></div>
          <div class="feat-mock-cube-face feat-mock-cube-top"></div>
          <div class="feat-mock-cube-face feat-mock-cube-side"></div>
        </div>
      </div>`;
  } else {
    body = `
      <div class="feat-mock feat-mock-generic" aria-hidden="true">
        <div class="feat-mock-line feat-mock-line-1"></div>
        <div class="feat-mock-line feat-mock-line-2"></div>
      </div>`;
  }
  return `<div class="feat-hero-mock">${body}</div>`;
}

// Same dark .ap-features-card.rp-commands-card vocabulary as app-page.
// No spinners (Phase 7.4); static teal '›' chevron per row instead.
function renderCapabilities(entity) {
  const items = Array.isArray(entity.features) ? entity.features : [];
  if (!items.length) return '';
  const rows = items.map(f => `
    <div class="rp-feat-item">
      <div class="rp-feat-copy">
        <span class="rp-feat-title">${esc(f.name)}</span>
        <span class="rp-feat-desc">${esc(f.desc)}</span>
      </div>
      <span class="ap-feat-chev" aria-hidden="true">›</span>
    </div>`).join('');
  return `
    <div class="ap-features-card rp-commands-card">
      <h3 class="ap-features-header">${esc(entity.title)} capabilities</h3>
      <div class="rp-feat-list">${rows}</div>
    </div>`;
}

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
    title: 'Features',
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

// Same vocabulary as apps-inventory: .ai-flagship + .app-tile.
function renderFlagship(f) {
  return `
    <a class="ai-flagship fi-reveal d2" href="/dist/features/${esc(f.slug)}/index.html">
      <div class="copy">
        <span class="badge">Flagship feature</span>
        <h2>${esc(f.title)}</h2>
        <p class="claim">${esc(f.hero_statement || f.headline_claim || f.tagline || '')}</p>
        <span class="arrow">Open ${esc(f.title)} \u2192</span>
      </div>
      <div class="visual">
        <div class="flagship-video-placeholder">demo video \u2014 coming soon</div>
      </div>
    </a>`;
}

// Phase 8.4: feature tile uses a painted-frame 16:9 strip at the top.
// Each feature gets a per-slug CSS schematic mockup inside the painted
// frame — AutoRoute (corridor pipework), Plantroom (equipment +
// headers), Clash Solver (the canonical pipe-over-duct ramp). The
// LIVE Three.js scene only mounts on the feature detail page (linked
// from the tile's anchor). Same dark .rp-commands-card surface across
// all tiles.
function renderTile(f) {
  return `
    <a class="app-tile feat-tile" href="/dist/features/${esc(f.slug)}/index.html">
      <div class="feat-tile-frame">
        <div class="feat-video-placeholder">demo video \u2014 coming soon</div>
      </div>
      <div class="body">
        <span class="surf">Feature</span>
        <h3>${esc(f.title)}</h3>
        <p class="claim">${esc(f.hero_statement || f.headline_claim || f.tagline || '')}</p>
        <span class="more">Open ${esc(f.title)} \u2192</span>
      </div>
    </a>`;
}

export async function buildAllFeaturePages() {
  const data = await loadJson('sandbox/data/features.json');
  const outs = [];
  for (const f of data.features) outs.push(await renderFeature(f));
  return outs;
}
