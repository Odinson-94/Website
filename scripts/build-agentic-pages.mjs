/**
 * scripts/build-agentic-pages.mjs
 *
 * Generates one detail page per agentic service from sandbox/data/agentic-services.json.
 * Output: /dist/agentic-services/<slug>/index.html
 *
 * Crown-jewel layout: cinematic hero, outcomes strip, before/after shift,
 * "what we offer" list, "how it becomes agentic" maturity ladder,
 * "what makes it special" panel, engagement card, end CTA.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { ROOT, loadJson } from './lib/registry.mjs';
import { renderSeoHead, renderJsonLd, buildAutoFaqs, renderFaqBlock, renderRelatedBlock, gitLastMod } from './lib/seo.mjs';

const T = (n) => path.join(ROOT, 'templates', n);
const O = (...p) => path.join(ROOT, 'dist', ...p);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

export async function buildAgenticServicePage(slug) {
  const data = await loadJson('sandbox/data/agentic-services.json');
  const svc = data.services.find(s => s.slug === slug);
  if (!svc) throw new Error(`service "${slug}" not found`);
  return await renderService(svc);
}

async function renderService(svc) {
  const tmpl = await fs.readFile(T('agentic-service-page.html'), 'utf8');

  // Per-service pullquote wins; brand.json is the fallback.
  let brand = {};
  try { brand = await loadJson('sandbox/data/brand.json'); } catch {}
  const pullquote = svc.pullquote || brand.pullquote || '';

  // Multi-paragraph body.
  const paragraphs = Array.isArray(svc.detail_paragraphs) && svc.detail_paragraphs.length
    ? svc.detail_paragraphs
    : [svc.detail_paragraph || svc.blurb || ''];
  const detailParagraphsHtml = paragraphs
    .filter(Boolean)
    .map(p => `<p>${esc(p)}</p>`)
    .join('\n      ');

  const featuresBlock = renderFeatures(svc);

  // ── SEO / AEO ──────────────────────────────────────────────────────────
  const pagePath = `/dist/agentic-services/${svc.slug}/index.html`;
  const lastmod = await gitLastMod(`sandbox/data/agentic-services.json`);
  const seoHead = await renderSeoHead({
    title: `${svc.title} — Agentic Services`,
    description: svc.headline_claim || svc.tagline,
    path: pagePath, type: 'product',
    keywords: ['Adelphos AI', svc.title, 'managed service', 'AI agent', 'engineering'],
    lastmod
  });
  const faqs = buildAutoFaqs(svc, 'agentic-service');
  const faqBlock = renderFaqBlock(faqs);
  const breadcrumbs = [
    { name: 'Home', url: '/' },
    { name: 'Agentic Services', url: '/dist/agentic-services/index.html' },
    { name: svc.title, url: pagePath }
  ];
  const jsonLd = await renderJsonLd({
    kind: 'agentic-service', path: pagePath,
    title: svc.title,
    description: svc.detail_paragraphs?.[0] || svc.tagline,
    features: svc.features,
    faqs, breadcrumbs
  });
  // Related: 1 sibling service + 2 apps that share keywords (or all apps' flagship if nothing matches)
  const apps = (await loadJson('sandbox/data/apps.json')).apps;
  const services = (await loadJson('sandbox/data/agentic-services.json')).services;
  const sibling = services.find(s => s.slug !== svc.slug);
  const matchedApps = apps.filter(a =>
    (a.title.toLowerCase().includes(svc.title.toLowerCase().split(' ')[0]) ||
     svc.title.toLowerCase().includes(a.title.toLowerCase().split(' ')[0]))
  ).slice(0, 2);
  const flagshipApp = apps.find(a => a.is_flagship);
  const relatedApps = matchedApps.length ? matchedApps : (flagshipApp ? [flagshipApp] : apps.slice(0, 2));
  const related = [
    sibling && { kind: 'Agentic service', title: sibling.title, desc: sibling.tagline,
                 url: `/dist/agentic-services/${sibling.slug}/index.html` },
    ...relatedApps.map(a => ({ kind: 'App', title: a.title, desc: a.tagline,
                               url: `/dist/apps/${a.slug}/index.html` }))
  ].filter(Boolean);
  const relatedBlock = renderRelatedBlock(related);

  // Inline stat line (Phase 8.2): no dashboard tile cliché.
  const outcomesStrip = (svc.key_outcomes || []).length
    ? `<p class="ap-stats-inline">${svc.key_outcomes.map(o => `
        <span><span class="ap-stat-num">${esc(o.stat)}</span>${esc(o.label)}</span>`).join('<span aria-hidden="true">·</span>')}</p>`
    : '';

  const shiftBlock = svc.the_shift
    ? `<div class="shift-grid">
         <div class="shift before"><p class="lab">Before</p><p>${esc(svc.the_shift.before || '')}</p></div>
         <div class="shift after"><p class="lab">After ${esc(svc.title)}</p><p>${esc(svc.the_shift.after || '')}</p></div>
       </div>`
    : '';

  const offers = (svc.what_we_offer || []).map(o => `<li>${esc(o)}</li>`).join('');
  const stages = (svc.how_it_becomes_agentic || []).map((s, i) => {
    // Each stage may be a plain string OR an object {title, desc}.
    if (typeof s === 'string') {
      return `<div class="stage">
        <span class="stage-num">Stage ${String(i + 1).padStart(2, '0')}</span>
        <h4>${esc(s)}</h4>
      </div>`;
    }
    return `<div class="stage">
      <span class="stage-num">Stage ${String(i + 1).padStart(2, '0')}</span>
      <h4>${esc(s.title || s.name || '')}</h4>
      ${s.desc ? `<p>${esc(s.desc)}</p>` : ''}
    </div>`;
  }).join('');

  // Short engagement label for the hero ("Monthly subscription + ...")
  const engagementShort = (svc.engagement || '').split('+')[0].trim() || 'Managed service';

  // Email-service flavour: bespoke email address + SLA + mailto CTA
  // Real services use kind="Email Service" (capital E, capital S) per
  // sandbox/data/agentic-services.json, with email field at svc.email.
  const isEmail = (svc.kind || '').toLowerCase().includes('email');
  const emailAddr = svc.email_address || svc.email || '';
  const emailStrip = isEmail && emailAddr ? `
    <div class="email-strip">
      <span class="es-label">Email this in</span>
      <a class="es-mail" href="mailto:${esc(emailAddr)}">${esc(emailAddr)}</a>
    </div>` : '';
  const primaryCtaLabel = isEmail
    ? (svc.cta_label || `Email ${emailAddr || 'us'}`)
    : (svc.cta_label || `Request a walkthrough`);
  const primaryCtaHref = isEmail && emailAddr
    ? `mailto:${emailAddr}?subject=${encodeURIComponent('New project — ' + svc.title)}`
    : '/contact/';

  // SEO/AEO H3 phrases (with auto-derived defaults)
  const seo = svc.seo || {};
  const seoWhy     = seo.why_h3     || `What the ${svc.title} agentic service changes`;
  const seoShift   = seo.shift_h3   || `Manual ${svc.title.toLowerCase()} vs agent-led ${svc.title.toLowerCase()}`;
  const seoSpecial = seo.special_h3 || `What makes the ${svc.title} service different`;
  const seoWho     = seo.who_h3     || `Who the ${svc.title} service is for`;

  const html = tmpl
    .replaceAll('{{title}}',                  esc(svc.title))
    .replaceAll('{{headline_claim}}',         esc(svc.headline_claim || svc.tagline || ''))
    .replaceAll('{{tagline}}',                esc(svc.tagline || ''))
    .replaceAll('{{blurb}}',                  esc(svc.blurb || ''))
    .replaceAll('{{icon}}',                   esc(svc.icon || 'logos/Node Logo.png'))
    .replaceAll('{{outcomes_strip}}',         outcomesStrip)
    .replaceAll('{{detail_paragraphs_html}}', detailParagraphsHtml)
    .replaceAll('{{pullquote}}',              esc(pullquote))
    .replaceAll('{{features_block}}',         featuresBlock)
    .replaceAll('{{shift_block}}',            shiftBlock)
    .replaceAll('{{seo_head}}',               seoHead)
    .replaceAll('{{json_ld}}',                jsonLd)
    .replaceAll('{{faq_block}}',              faqBlock)
    .replaceAll('{{related_block}}',          relatedBlock)
    .replaceAll('{{offers_html}}',            offers)
    .replaceAll('{{stages_html}}',            stages)
    .replaceAll('{{what_makes_it_special}}',  esc(svc.what_makes_it_special || ''))
    .replaceAll('{{engagement}}',             esc(svc.engagement || 'Tailored to your project'))
    .replaceAll('{{engagement_short}}',       esc(engagementShort))
    .replaceAll('{{email_strip}}',            emailStrip)
    .replaceAll('{{primary_cta_label}}',      esc(primaryCtaLabel))
    .replaceAll('{{primary_cta_href}}',       primaryCtaHref)
    .replaceAll('{{seo_why_h3}}',             esc(seoWhy))
    .replaceAll('{{seo_shift_h3}}',           esc(seoShift))
    .replaceAll('{{seo_special_h3}}',         esc(seoSpecial))
    .replaceAll('{{seo_who_h3}}',             esc(seoWho))
    .replaceAll('{{generated_at}}',           new Date().toISOString());

  const out = O('agentic-services', svc.slug, 'index.html');
  await fs.mkdir(path.dirname(out), { recursive: true });
  await fs.writeFile(out, html, 'utf8');
  return out;
}

export async function buildAgenticServicesInventory() {
  const data = await loadJson('sandbox/data/agentic-services.json');
  const tmpl = await fs.readFile(T('agentic-services-inventory.html'), 'utf8');

  // Truth-only: real services from the JSON only. The 3 fabricated
  // services from the previous build (Procurement / Resource /
  // Compliance) are not in the JSON so they can't appear here.
  const isEmail = s => (s.kind || '').toLowerCase().includes('email');
  const managed = data.services.filter(s => !isEmail(s));
  const emails  = data.services.filter(s => isEmail(s));

  // Flagship = first non-email service marked is_flagship; falls back
  // to the first managed service.
  const flagship = managed.find(s => s.is_flagship) || managed[0];
  const remainingManaged = managed.filter(s => s.slug !== (flagship && flagship.slug));

  const flagshipHtml      = flagship ? renderFlagship(flagship) : '';
  const managedTilesHtml  = remainingManaged.map(s => renderTile(s)).join('');
  const emailTilesHtml    = emails.map(s => renderEmailTile(s)).join('');

  const seoHead = await renderSeoHead({
    title: 'Agentic Services — Adelphos AI',
    description: data.section_blurb,
    path: '/dist/agentic-services/index.html',
    type: 'website',
    keywords: ['Adelphos AI agentic services', 'managed AI service', 'engineering practice services', ...data.services.map(s => s.title)]
  });
  const jsonLd = await renderJsonLd({
    kind: 'inventory', path: '/dist/agentic-services/index.html',
    title: 'Adelphos Agentic Services', description: data.section_blurb,
    items: data.services.map(s => ({ name: s.title, url: `/dist/agentic-services/${s.slug}/index.html` })),
    breadcrumbs: [{ name: 'Home', url: '/' }, { name: 'Agentic Services', url: '/dist/agentic-services/index.html' }]
  });

  const html = tmpl
    .replaceAll('{{section_lead}}',         esc(data.section_lead  || data.section_title || 'Agentic Services'))
    .replaceAll('{{section_blurb}}',        esc(data.section_blurb || ''))
    .replaceAll('{{count}}',                String(data.services.length))
    .replaceAll('{{flagship_html}}',        flagshipHtml)
    .replaceAll('{{managed_tiles_html}}',   managedTilesHtml)
    .replaceAll('{{email_tiles_html}}',     emailTilesHtml)
    .replaceAll('{{seo_head}}',             seoHead)
    .replaceAll('{{json_ld}}',              jsonLd)
    .replaceAll('{{generated_at}}',         new Date().toISOString());

  const out = O('agentic-services', 'index.html');
  await fs.mkdir(path.dirname(out), { recursive: true });
  await fs.writeFile(out, html, 'utf8');
  return { out, count: data.services.length };
}

// SVG glyph for service tiles (services don't have a PNG logo).
const SERVICE_GLYPH = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>`;
const EMAIL_GLYPH = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <rect x="3" y="5" width="18" height="14" rx="2"/>
    <path d="M3 7l9 6 9-6"/>
  </svg>`;

function renderFlagship(s) {
  return `
    <a class="ai-flagship" href="/dist/agentic-services/${esc(s.slug)}/index.html">
      <div class="copy">
        <span class="badge">Flagship · Managed by Adelphos</span>
        <h2>${esc(s.title)}</h2>
        <p class="claim">${esc(s.headline_claim || s.tagline || '')}</p>
        <span class="arrow">Open ${esc(s.title)} →</span>
      </div>
      <div class="visual">
        <img src="/${esc(s.icon || 'logos/Node Logo.png')}" alt="${esc(s.title)} logo" onerror="this.style.opacity=0">
      </div>
    </a>`;
}

function renderTile(s) {
  return `
    <a class="svc-tile" href="/dist/agentic-services/${esc(s.slug)}/index.html">
      <div class="visual">${SERVICE_GLYPH}</div>
      <div class="body">
        <span class="surf">Managed service</span>
        <h3>${esc(s.title)}</h3>
        <p class="claim">${esc(s.headline_claim || s.tagline || '')}</p>
        <span class="more">Open ${esc(s.title)} →</span>
      </div>
    </a>`;
}

function renderEmailTile(s) {
  const email = s.email_address || s.email || '';
  return `
    <a class="svc-tile" href="/dist/agentic-services/${esc(s.slug)}/index.html">
      <div class="visual">${EMAIL_GLYPH}</div>
      <div class="body">
        <span class="surf">Email service</span>
        <h3>${esc(s.title)}</h3>
        <p class="claim">${esc(s.tagline || s.headline_claim || '')}</p>
        ${email ? `<span class="email-line">${esc(email)}</span>` : ''}
        <span class="more">Open ${esc(s.title)} →</span>
      </div>
    </a>`;
}

// Same dark .ap-features-card.rp-commands-card vocabulary as app-page.
// JSON has features[] with .title + .desc (not .name like apps.json),
// so we accept both. No spinner — static teal '›' chevron per row.
function renderFeatures(entity) {
  const norm = items => items.map(f => ({
    name: f.name || f.title || '',
    desc: f.desc || ''
  }));
  const renderRows = items => norm(items).map(f => `
    <div class="rp-feat-item">
      <div class="rp-feat-copy">
        <span class="rp-feat-title">${esc(f.name)}</span>
        <span class="rp-feat-desc">${esc(f.desc)}</span>
      </div>
      <span class="ap-feat-chev" aria-hidden="true">›</span>
    </div>`).join('');

  let body = '';
  if (Array.isArray(entity.feature_groups) && entity.feature_groups.length) {
    body = entity.feature_groups.map(g => `
      <p class="ap-feat-group-label">${esc(g.title)} · ${(g.features || []).length}</p>
      <div class="rp-feat-list">${renderRows(g.features || [])}</div>`).join('');
  } else if (Array.isArray(entity.features) && entity.features.length) {
    body = `<div class="rp-feat-list">${renderRows(entity.features)}</div>`;
  } else {
    return '';
  }

  return `
    <div class="ap-features-card rp-commands-card">
      <h3 class="ap-features-header">${esc(entity.title)} features</h3>
      ${body}
    </div>`;
}

export async function buildAllAgenticServicePages() {
  const data = await loadJson('sandbox/data/agentic-services.json');
  const outs = [];
  for (const s of data.services) outs.push(await renderService(s));
  return outs;
}
