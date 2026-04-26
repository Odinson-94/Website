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

  const outcomesStrip = (svc.key_outcomes || []).length
    ? `<div class="outcomes-strip">${svc.key_outcomes.map(o => `
        <div class="ostat"><span class="num">${esc(o.stat)}</span><span class="lbl">${esc(o.label)}</span></div>`).join('')}</div>`
    : '';

  const shiftBlock = svc.the_shift
    ? `<div class="shift-grid">
         <div class="shift before"><p class="lab">Before</p><p>${esc(svc.the_shift.before || '')}</p></div>
         <div class="shift after"><p class="lab">After ${esc(svc.title)}</p><p>${esc(svc.the_shift.after || '')}</p></div>
       </div>`
    : '';

  const offers = (svc.what_we_offer || []).map(o => `<li>${esc(o)}</li>`).join('');
  const stages = (svc.how_it_becomes_agentic || []).map(s => `<div class="stage">${esc(s)}</div>`).join('');

  // Short engagement label for the hero ("Monthly subscription + ...")
  const engagementShort = (svc.engagement || '').split('+')[0].trim() || 'Managed service';

  // Email-service flavour: bespoke email address + SLA + mailto CTA
  const isEmail = svc.kind === 'email-service';
  const emailStrip = isEmail && svc.email_address ? `
    <div class="email-strip">
      <span class="lab">Email</span>
      <span class="addr">${esc(svc.email_address)}</span>
      ${svc.sla ? `<span class="sla">SLA: ${esc(svc.sla)}</span>` : ''}
    </div>` : '';
  const primaryCtaLabel = isEmail
    ? `Send a brief to ${svc.email_address || 'us'}`
    : `Talk to us about deploying ${svc.title}`;
  const primaryCtaHref = isEmail && svc.email_address
    ? `mailto:${svc.email_address}?subject=${encodeURIComponent('New project — ' + svc.title)}`
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

  const flagship = data.services.find(s => s.is_flagship);
  const others   = data.services.filter(s => !s.is_flagship);

  const flagshipHtml = flagship ? renderFlagship(flagship) : '';
  const tilesHtml    = others.map(s => renderTile(s)).join('');

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
    .replaceAll('{{section_lead}}',  esc(data.section_lead  || data.section_title || 'Agentic Services'))
    .replaceAll('{{section_blurb}}', esc(data.section_blurb || ''))
    .replaceAll('{{count}}',         String(data.services.length))
    .replaceAll('{{flagship_html}}', flagshipHtml)
    .replaceAll('{{tiles_html}}',    tilesHtml)
    .replaceAll('{{seo_head}}',      seoHead)
    .replaceAll('{{json_ld}}',       jsonLd)
    .replaceAll('{{generated_at}}',  new Date().toISOString());

  const out = O('agentic-services', 'index.html');
  await fs.mkdir(path.dirname(out), { recursive: true });
  await fs.writeFile(out, html, 'utf8');
  return { out, count: data.services.length };
}

function renderFlagship(s) {
  const stats = (s.key_outcomes || []).slice(0, 4).map(o => `
    <div class="stat">
      <span class="num">${esc(o.stat)}</span>
      <span class="lbl">${esc(o.label)}</span>
    </div>`).join('');
  return `
    <a class="flagship-svc" href="/dist/agentic-services/${esc(s.slug)}/index.html">
      <div class="copy">
        <span class="badge">Flagship Service · Managed by Adelphos</span>
        <h2>${esc(s.title)}</h2>
        <p class="claim">${esc(s.headline_claim || s.tagline || '')}</p>
        <div class="stats">${stats}</div>
        <span class="arrow">Explore ${esc(s.title)}  →</span>
      </div>
      <div class="visual">
        <div class="seal">
          <span class="big">Adelphos</span>
          <span class="small">Managed Service</span>
        </div>
      </div>
    </a>`;
}

function renderTile(s) {
  const outcomes = (s.key_outcomes || []).slice(0, 3).map(o => `
    <div class="stat"><span class="num">${esc(o.stat)}</span><span class="lbl">${esc(o.label)}</span></div>`).join('');
  return `
    <a class="svc-tile" href="/dist/agentic-services/${esc(s.slug)}/index.html">
      <div class="visual">
        <img src="/${esc(s.icon || 'logos/Node Logo.png')}" alt="" onerror="this.style.opacity=0">
      </div>
      <div class="body">
        <span class="badge">Managed service</span>
        <h3>${esc(s.title)}</h3>
        <p class="claim">${esc(s.headline_claim || s.tagline || '')}</p>
        <div class="outcomes">${outcomes}</div>
      </div>
    </a>`;
}

// Same editorial 2-column capability list as the apps template.
function renderFeatures(entity) {
  const renderList = items => `<ul class="feat-list">${items.map(f => `
    <li>
      <span class="name">${esc(f.name)}</span>
      <span class="desc">${esc(f.desc)}</span>
    </li>`).join('')}</ul>`;
  if (Array.isArray(entity.feature_groups) && entity.feature_groups.length) {
    return entity.feature_groups.map(g => `
      <section class="features-group">
        <h3 style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.10em;color:#2e8b6f;margin:var(--space-lg) 0 var(--space-sm);">${esc(g.title)} <span style="color:var(--text-muted);font-weight:500;letter-spacing:0;">${(g.features || []).length}</span></h3>
        ${renderList(g.features || [])}
      </section>`).join('');
  }
  if (Array.isArray(entity.features) && entity.features.length) {
    return renderList(entity.features);
  }
  return '';
}

export async function buildAllAgenticServicePages() {
  const data = await loadJson('sandbox/data/agentic-services.json');
  const outs = [];
  for (const s of data.services) outs.push(await renderService(s));
  return outs;
}
