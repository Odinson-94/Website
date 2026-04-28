/**
 * scripts/lib/seo.mjs
 *
 * Central SEO + AEO (Answer Engine Optimization) helpers used by every
 * page generator. One import, one call site per template:
 *
 *   import { renderSeoHead, renderJsonLd, renderFaqBlock } from './lib/seo.mjs';
 *   const head = await renderSeoHead({ ...pageMeta });
 *   const jsonLd = await renderJsonLd({ kind: 'app', ...data });
 *   const faq = renderFaqBlock(faqItems);
 *
 * SOURCE OF TRUTH: sandbox/data/site.json
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { ROOT } from './registry.mjs';

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const escAttr = s => esc(s).replace(/'/g, '&#39;');

let _site = null;
async function loadSite() {
  if (_site) return _site;
  try {
    const raw = await fs.readFile(path.join(ROOT, 'sandbox', 'data', 'site.json'), 'utf8');
    _site = JSON.parse(raw.replace(/^\uFEFF/, ''));
  } catch { _site = {}; }
  return _site;
}

/**
 * Renders the full <head> SEO/social block.
 * Returns an HTML string of meta tags ready to inject into a template head.
 *
 * @param {object} m
 * @param {string} m.title          — page title (without site name suffix)
 * @param {string} m.description    — meta description (≤160 chars)
 * @param {string} m.path           — site-root-relative path (e.g. '/apps/revit-copilot/index.html')
 * @param {string} [m.image]        — OG image URL (absolute or root-relative)
 * @param {string} [m.type]         — 'website' | 'article' | 'product'
 * @param {string[]} [m.keywords]
 * @param {string} [m.lastmod]      — ISO date for article:modified_time
 */
export async function renderSeoHead({ title, description, path: pagePath, image, type = 'website', keywords = [], lastmod }) {
  const s = await loadSite();
  const site = s.site_name || 'Adelphos AI';
  const url  = (s.site_url || '') + (pagePath || '/');
  const fullTitle = title ? `${title} — ${site}` : site;
  const desc = (description || s.default_description || '').slice(0, 300);
  const ogImg = image || s.default_og_image || '/images/og/default.png';
  const ogImgAbs = /^https?:/.test(ogImg) ? ogImg : (s.site_url || '') + ogImg;
  const tw = s.twitter_handle || '@adelphos_ai';

  const lines = [
    `<title>${esc(fullTitle)}</title>`,
    `<meta name="description" content="${escAttr(desc)}">`,
    keywords.length ? `<meta name="keywords" content="${escAttr(keywords.join(', '))}">` : '',
    `<link rel="canonical" href="${escAttr(url)}">`,
    `<meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1">`,
    `<meta name="theme-color" content="#156082">`,
    // Open Graph
    `<meta property="og:type" content="${esc(type)}">`,
    `<meta property="og:title" content="${escAttr(fullTitle)}">`,
    `<meta property="og:description" content="${escAttr(desc)}">`,
    `<meta property="og:url" content="${escAttr(url)}">`,
    `<meta property="og:image" content="${escAttr(ogImgAbs)}">`,
    `<meta property="og:site_name" content="${esc(site)}">`,
    `<meta property="og:locale" content="en_GB">`,
    lastmod ? `<meta property="article:modified_time" content="${esc(lastmod)}">` : '',
    // Twitter
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:site" content="${esc(tw)}">`,
    `<meta name="twitter:title" content="${escAttr(fullTitle)}">`,
    `<meta name="twitter:description" content="${escAttr(desc)}">`,
    `<meta name="twitter:image" content="${escAttr(ogImgAbs)}">`,
  ].filter(Boolean);

  return lines.join('\n');
}

/**
 * Renders one or more <script type="application/ld+json"> blocks.
 *
 * Supported `kind` values:
 *   'app'             — SoftwareApplication + Organization + (optional) FAQPage
 *   'agentic-service' — Service + Organization + FAQPage
 *   'tool'            — TechArticle + (optional) HowTo
 *   'command'         — TechArticle + HowTo
 *   'demo'            — VideoObject
 *   'workflow'        — HowTo
 *   'website'         — WebSite + Organization
 *   'inventory'       — CollectionPage + ItemList
 */
export async function renderJsonLd({ kind, ...d }) {
  const s = await loadSite();
  const site = s.site_name || 'Adelphos AI';
  const siteUrl = s.site_url || '';
  const org = s.organization || { '@type': 'Organization', name: site, url: siteUrl };

  const url = siteUrl + (d.path || '/');
  const blocks = [];

  // Always include WebSite + Organization on every page (helps AI engines understand the publisher)
  blocks.push({
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: site,
    url: siteUrl,
    publisher: org
  });

  if (kind === 'app') {
    blocks.push({
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: d.title,
      description: d.description,
      url,
      applicationCategory: 'BusinessApplication',
      applicationSubCategory: 'BIM / MEP Engineering',
      operatingSystem: d.surface || 'Windows / Web',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'GBP', availability: 'https://schema.org/InStock' },
      publisher: org,
      featureList: (d.features || []).map(f => f.name).join(', '),
      softwareHelp: { '@type': 'CreativeWork', url: siteUrl + '/docs/index.html' }
    });
  } else if (kind === 'agentic-service') {
    blocks.push({
      '@context': 'https://schema.org',
      '@type': 'Service',
      serviceType: 'Managed AI service for engineering practices',
      name: d.title,
      description: d.description,
      url,
      provider: org,
      areaServed: { '@type': 'Country', name: 'United Kingdom' },
      hasOfferCatalog: {
        '@type': 'OfferCatalog',
        name: d.title + ' offerings',
        itemListElement: (d.features || []).map(f => ({
          '@type': 'Offer',
          itemOffered: { '@type': 'Service', name: f.name, description: f.desc }
        }))
      }
    });
  } else if (kind === 'tool' || kind === 'command') {
    blocks.push({
      '@context': 'https://schema.org',
      '@type': 'TechArticle',
      headline: d.title,
      description: d.description,
      url,
      author: org,
      publisher: org,
      proficiencyLevel: 'Expert',
      dependencies: 'Adelphos MEP Bridge'
    });
  } else if (kind === 'demo') {
    blocks.push({
      '@context': 'https://schema.org',
      '@type': 'VideoObject',
      name: d.title,
      description: d.description,
      url,
      uploadDate: d.uploadDate || new Date().toISOString().slice(0, 10),
      publisher: org
    });
  } else if (kind === 'workflow') {
    blocks.push({
      '@context': 'https://schema.org',
      '@type': 'HowTo',
      name: d.title,
      description: d.description,
      url,
      totalTime: d.totalTime || 'PT30M',
      step: (d.steps || []).map((s, i) => ({
        '@type': 'HowToStep',
        position: i + 1,
        name: s.name || `Step ${i + 1}`,
        text: s.text || s
      }))
    });
  } else if (kind === 'inventory') {
    blocks.push({
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: d.title,
      description: d.description,
      url,
      mainEntity: {
        '@type': 'ItemList',
        numberOfItems: (d.items || []).length,
        itemListElement: (d.items || []).map((it, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: it.name,
          url: siteUrl + it.url
        }))
      }
    });
  }

  // FAQ block — added on top of any page kind that supplies `faqs`.
  if (Array.isArray(d.faqs) && d.faqs.length) {
    blocks.push({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: d.faqs.map(f => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a }
      }))
    });
  }

  // BreadcrumbList — small payoff, easy win.
  if (Array.isArray(d.breadcrumbs) && d.breadcrumbs.length) {
    blocks.push({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: d.breadcrumbs.map((b, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: b.name,
        item: siteUrl + b.url
      }))
    });
  }

  return blocks.map(b =>
    `<script type="application/ld+json">\n${JSON.stringify(b, null, 2)}\n</script>`
  ).join('\n');
}

/**
 * Build FAQ Q/A pairs for a page entity.
 *
 * Phase 7.6 / 8.1 / 8.2: the entity's `.faq[]` array (if present and
 * non-empty) is the single source of truth — every Q/A is lifted
 * verbatim. When the JSON has no `.faq[]`, fall back to auto-derived
 * questions from the existing fields (tagline, detail_paragraphs,
 * the_shift, key_outcomes, surface, best_for, primary_cta,
 * engagement).
 *
 * Returns [{q, a}]; the renderer hides the FAQ section when the
 * array is empty.
 */
export function buildAutoFaqs(entity, kind = 'app') {
  // Verbatim FAQ from JSON wins.
  if (Array.isArray(entity.faq) && entity.faq.length) {
    return entity.faq
      .filter(f => f && (f.q || f.question) && (f.a || f.answer))
      .map(f => ({ q: f.q || f.question, a: f.a || f.answer }));
  }

  const out = [];
  const name = entity.title;
  const isApp = kind === 'app';

  if (entity.tagline) {
    out.push({ q: `What is ${name}?`, a: entity.tagline });
  }
  if (entity.detail_paragraphs && entity.detail_paragraphs[0]) {
    out.push({ q: `What does ${name} do?`, a: entity.detail_paragraphs[0] });
  }
  if (entity.the_shift && entity.the_shift.before && entity.the_shift.after) {
    out.push({
      q: `How is ${name} different from the manual workflow?`,
      a: `Without ${name}: ${entity.the_shift.before} With ${name}: ${entity.the_shift.after}`
    });
  }
  if (entity.key_outcomes && entity.key_outcomes.length) {
    const stats = entity.key_outcomes.map(o => `${o.stat} (${o.label})`).join('; ');
    out.push({
      q: `How much time does ${name} save?`,
      a: `Headline outcomes for ${name}: ${stats}.`
    });
  }
  if (entity.surface) {
    out.push({ q: `What platform does ${name} run on?`, a: entity.surface });
  }
  if (entity.best_for && entity.best_for.length) {
    out.push({ q: `Who is ${name} for?`, a: entity.best_for.join('; ') + '.' });
  }
  if (isApp && entity.primary_cta) {
    out.push({
      q: `How do I get ${name}?`,
      a: `Self-serve: ${entity.primary_cta.label} at ${entity.primary_cta.href}. No sales call required.`
    });
  }
  if (!isApp && entity.engagement) {
    out.push({
      q: `What's the engagement model for ${name}?`,
      a: entity.engagement
    });
  }
  return out;
}

/**
 * Renders the visible FAQ HTML block (drops below the main content on every detail page).
 * The same items also feed FAQPage JSON-LD (call renderJsonLd with `faqs`).
 */
export function renderFaqBlock(faqs) {
  if (!faqs || !faqs.length) return '';
  const items = faqs.map((f, i) => `
    <details class="faq-item"${i === 0 ? ' open' : ''}>
      <summary>${esc(f.q)}</summary>
      <div class="faq-answer"><p>${esc(f.a)}</p></div>
    </details>`).join('');
  return `
    <section class="faq-section" id="faq" aria-label="Frequently asked questions">
      <h2>Frequently asked questions</h2>
      <p style="color:var(--text-muted);max-width:880px;margin:0 0 var(--space-md);">Quick answers AI engines (and humans) can pull from.</p>
      <div class="faq-list">${items}</div>
    </section>`;
}

/**
 * Build a related-content block from an entity's tags / keywords.
 * Returns an HTML string: a small grid of "Related" cards.
 */
export function renderRelatedBlock(related) {
  if (!related || !related.length) return '';
  const items = related.map(r =>
    `<a class="related-card" href="${escAttr(r.url)}">
       <span class="related-kind">${esc(r.kind || 'Related')}</span>
       <strong>${esc(r.title)}</strong>
       <span class="related-desc">${esc(r.desc || '')}</span>
     </a>`
  ).join('');
  return `
    <section class="related-section" id="related" aria-label="Related content">
      <h2>Related</h2>
      <div class="related-grid">${items}</div>
    </section>`;
}

/** Returns the last-modified ISO timestamp from git for a file path, or now. */
export async function gitLastMod(filePath) {
  try {
    const { execSync } = await import('node:child_process');
    const ts = execSync(`git log -1 --format=%cI -- "${filePath}"`, { cwd: ROOT, encoding: 'utf8' }).trim();
    return ts || new Date().toISOString();
  } catch { return new Date().toISOString(); }
}
