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

  // Inline stat line (Phase 7.2 / 8.1): no dashboard tile cliché.
  const outcomesStrip = (f.key_outcomes || []).length
    ? `<p class="ap-stats-inline">${f.key_outcomes.map(o => `
        <span><span class="ap-stat-num">${esc(o.stat)}</span>${esc(o.label)}</span>`).join('<span aria-hidden="true">·</span>')}</p>`
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

  // Phase 8.1: feature hero painted frame should hold a CSS schematic
  // mockup keyed to the feature, NOT the misleading PNG (the icon
  // paths in features.json point to app-logo PNGs that don't represent
  // the feature — flagged as a P3 in CRITIQUE.md). Replace the
  // <img class="ap-hero-logo"> with a per-slug CSS mockup overlay.
  // The Three.js scene at full inventory tile scale is too small for
  // the 240×240 hero slot; the larger CSS mockup reads cleaner.
  const heroVisual = featureHeroMockup(f.slug);
  let template = tmpl;
  // Replace ANY <img class="ap-hero-logo" ...> in the template with the
  // mockup. Surgical regex — match the whole tag including a self-
  // closing or onerror trailing attribute set.
  template = template.replace(
    /<img class="ap-hero-logo"[^>]*>/g,
    heroVisual
  );

  const html = template
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
  } else {
    body = `
      <div class="feat-mock feat-mock-generic" aria-hidden="true">
        <div class="feat-mock-line feat-mock-line-1"></div>
        <div class="feat-mock-line feat-mock-line-2"></div>
      </div>`;
  }
  // Wrap in a hero-sized panel that fills the .ap-hero-frame interior.
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

// Same vocabulary as apps-inventory: .ai-flagship + .app-tile.
function renderFlagship(f) {
  return `
    <a class="ai-flagship" href="/dist/features/${esc(f.slug)}/index.html">
      <div class="copy">
        <span class="badge">Flagship feature</span>
        <h2>${esc(f.title)}</h2>
        <p class="claim">${esc(f.headline_claim || f.tagline || '')}</p>
        <span class="arrow">Open ${esc(f.title)} →</span>
      </div>
      <div class="visual">
        <img src="/${esc(f.icon || 'logos/Node Logo.png')}" alt="${esc(f.title)} logo" onerror="this.style.opacity=0">
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
  let visual;
  if (f.slug === 'clash-solver') {
    // CSS schematic: a horizontal duct + a pipe ramping over it (the
    // signature Clash Solver geometry).
    visual = `
      <div class="feat-mock feat-mock-clash" aria-hidden="true">
        <div class="feat-mock-duct"></div>
        <div class="feat-mock-pipe-ramp"></div>
        <div class="feat-mock-marker feat-mock-marker-1"></div>
        <div class="feat-mock-marker feat-mock-marker-2"></div>
      </div>`;
  } else if (f.slug === 'autoroute') {
    // CSS schematic mockup: pipe routes turning through a corridor void.
    visual = `
      <div class="feat-mock feat-mock-autoroute" aria-hidden="true">
        <div class="feat-mock-pipe feat-mock-pipe-1"></div>
        <div class="feat-mock-pipe feat-mock-pipe-2"></div>
        <div class="feat-mock-elbow feat-mock-elbow-1"></div>
        <div class="feat-mock-elbow feat-mock-elbow-2"></div>
      </div>`;
  } else if (f.slug === 'plantroom-designer-3d') {
    // CSS schematic mockup: equipment rectangles connected by header pipes.
    visual = `
      <div class="feat-mock feat-mock-plantroom" aria-hidden="true">
        <div class="feat-mock-eq feat-mock-eq-1"></div>
        <div class="feat-mock-eq feat-mock-eq-2"></div>
        <div class="feat-mock-eq feat-mock-eq-3"></div>
        <div class="feat-mock-header"></div>
      </div>`;
  } else {
    // Generic schematic mockup for any other feature added later.
    visual = `
      <div class="feat-mock feat-mock-generic" aria-hidden="true">
        <div class="feat-mock-line feat-mock-line-1"></div>
        <div class="feat-mock-line feat-mock-line-2"></div>
      </div>`;
  }
  return `
    <a class="app-tile feat-tile" href="/dist/features/${esc(f.slug)}/index.html">
      <div class="feat-tile-frame">
        ${visual}
      </div>
      <div class="body">
        <span class="surf">Feature</span>
        <h3>${esc(f.title)}</h3>
        <p class="claim">${esc(f.headline_claim || f.tagline || '')}</p>
        <span class="more">Open ${esc(f.title)} →</span>
      </div>
    </a>`;
}

export async function buildAllFeaturePages() {
  const data = await loadJson('sandbox/data/features.json');
  const outs = [];
  for (const f of data.features) outs.push(await renderFeature(f));
  return outs;
}
