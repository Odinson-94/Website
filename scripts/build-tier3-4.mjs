/**
 * scripts/build-tier3-4.mjs
 *
 * Generates the Tier 3 + 4 SEO pages:
 *   /compare/index.html              — comparison hub
 *   /compare/<slug>/index.html       — one comparison page per competitor
 *   /changelog/index.html            — release history with SoftwareApplication JSON-LD
 *   /glossary/index.html             — glossary with anchor links per term
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { ROOT, loadJson } from './lib/registry.mjs';
import { renderSeoHead, renderJsonLd } from './lib/seo.mjs';

const O = (...p) => path.join(ROOT, 'dist', ...p);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

async function pageShell({ title, description, pagePath, contentHtml, jsonLd = '' }) {
  const seoHead = await renderSeoHead({ title, description, path: pagePath, type: 'article' });
  return `<!DOCTYPE html>
<html lang="en">
<head>
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-FZLH4EJC6X"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-FZLH4EJC6X');
</script>
<script>
document.addEventListener('click', function(e) {
  var btn = e.target.closest('.signup-btn, .ap-cta-primary, .ap-cta-ghost, .fs-cta-primary, .fs-cta-ghost, .ap-end-cta a, .fs-end-cta a, .end-cta a, .install-cta-row a, .svc-btn-primary, .email-strip');
  if (!btn) return;
  var label = btn.textContent.trim().substring(0, 60);
  var category = btn.className.indexOf('signup-btn') !== -1 ? 'signup_click' : 'cta_click';
  gtag('event', category, { event_label: label, page_path: location.pathname });
});
</script>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${seoHead}
<link rel="icon" type="image/png" href="/logos/Node%20Logo.png">
<script>
  (function(){
    const c = document.cookie.match(/(?:^|; )darkMode=([^;]*)/);
    const dark = (c && c[1] === 'true') || localStorage.getItem('darkMode') === 'true';
    if (dark) document.documentElement.classList.add('dark-mode');
  })();
</script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=block">
<link rel="stylesheet" href="/css/shared-styles.css">
<link rel="stylesheet" href="/sandbox.css">
${jsonLd}
</head>
<body>
<script src="/shell.js"></script>
<div class="docs-layout wide">
<aside class="docs-left"></aside>
<main class="docs-content">
${contentHtml}
</main>
<aside class="docs-right"></aside>
</div>
<script src="/docs-shell.js"></script>
</body>
</html>`;
}

/* ─────────────────────────────────────────────────────────  COMPARISON  */
export async function buildComparisons() {
  const data = await loadJson('sandbox/data/comparisons.json');
  const out = [];

  // Hub page
  const hubCards = data.competitors.map(c => `
    <a class="related-card" href="/compare/${esc(c.slug)}/index.html">
      <span class="related-kind">Comparison</span>
      <strong>Adelphos vs ${esc(c.competitor_short)}</strong>
      <span class="related-desc">${esc(c.summary.slice(0, 140))}…</span>
    </a>`).join('');
  const hubHtml = `
    <h1 style="font-size:44px;font-weight:500;letter-spacing:-0.025em;margin:0 0 12px;">How Adelphos compares</h1>
    <p style="font-size:18px;line-height:1.55;color:var(--text-muted);max-width:880px;margin-bottom:24px;">
      Honest comparisons against the tools you're probably already using. We don't compete with everything — we sit in a different layer.
    </p>
    <div class="related-grid">${hubCards}</div>`;
  const hubFile = O('compare', 'index.html');
  await fs.mkdir(path.dirname(hubFile), { recursive: true });
  await fs.writeFile(hubFile, await pageShell({
    title: 'How Adelphos compares', description: 'Adelphos vs Revit, Autodesk Build, Bluebeam, Procore — honest comparisons.',
    pagePath: '/compare/index.html', contentHtml: hubHtml
  }), 'utf8');
  out.push(hubFile);

  // Per-competitor page
  for (const c of data.competitors) {
    const rows = c.rows.map(r => `
      <tr>
        <td><strong>${esc(r.feature)}</strong></td>
        <td style="color:var(--brand-teal);">${esc(r.us)}</td>
        <td style="color:var(--text-muted);">${esc(r.them)}</td>
      </tr>`).join('');
    const html = `
      <div class="crumbs"><a href="/compare/index.html">Compare</a> &nbsp;›&nbsp; vs ${esc(c.competitor_short)}</div>
      <h1 style="font-size:40px;font-weight:500;letter-spacing:-0.02em;margin:0 0 12px;">Adelphos vs ${esc(c.competitor)}</h1>
      <p style="font-size:18px;line-height:1.55;color:var(--text);max-width:880px;margin-bottom:24px;">${esc(c.summary)}</p>
      <table class="ref-table" style="margin-top:16px;">
        <thead><tr><th>Capability</th><th>Adelphos</th><th>${esc(c.competitor_short)}</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="margin-top:32px;color:var(--text-muted);font-size:13px;">Comparison generated ${new Date().toISOString().slice(0,10)} from <code>sandbox/data/comparisons.json</code>.</p>`;
    const jsonLd = await renderJsonLd({
      kind: 'inventory', path: `/compare/${c.slug}/index.html`,
      title: `Adelphos vs ${c.competitor}`, description: c.summary,
      items: c.rows.map(r => ({ name: r.feature, url: `/compare/${c.slug}/index.html` }))
    });
    const file = O('compare', c.slug, 'index.html');
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, await pageShell({
      title: `Adelphos vs ${c.competitor}`, description: c.summary,
      pagePath: `/compare/${c.slug}/index.html`, contentHtml: html, jsonLd
    }), 'utf8');
    out.push(file);
  }
  return { outs: out, count: data.competitors.length };
}

/* ─────────────────────────────────────────────────────────  CHANGELOG  */
export async function buildChangelog() {
  const data = await loadJson('sandbox/data/changelog.json');
  const sections = data.releases.map(r => `
    <section style="margin-bottom:var(--space-2xl);padding-bottom:var(--space-xl);border-bottom:1px solid var(--border);">
      <header style="display:flex;align-items:baseline;gap:14px;margin-bottom:6px;">
        <h2 style="margin:0;font-size:24px;font-weight:600;color:var(--brand-teal);">v${esc(r.version)}</h2>
        <time style="font-size:14px;color:var(--text-muted);">${esc(r.date)}</time>
      </header>
      <p style="font-size:18px;font-weight:400;margin:0 0 12px;">${esc(r.title)}</p>
      <ul style="margin:0;padding-left:20px;">${r.items.map(i => `<li style="margin-bottom:6px;">${esc(i)}</li>`).join('')}</ul>
    </section>`).join('');
  const html = `
    <h1 style="font-size:44px;font-weight:500;letter-spacing:-0.025em;margin:0 0 12px;">Changelog</h1>
    <p style="font-size:18px;line-height:1.55;color:var(--text-muted);max-width:880px;margin-bottom:32px;">
      Every release of the Adelphos suite. ${data.releases.length} releases logged.
    </p>
    ${sections}`;
  const site = await loadJson('sandbox/data/site.json');
  const jsonLd = `<script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Adelphos AI',
    softwareVersion: data.releases[0]?.version,
    releaseNotes: data.releases.map(r => `v${r.version} (${r.date}): ${r.title}`).join('\n'),
    publisher: site.organization
  }, null, 2)}</script>`;
  const file = O('changelog', 'index.html');
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, await pageShell({
    title: 'Changelog', description: `Release history for the Adelphos AI suite — ${data.releases.length} releases.`,
    pagePath: '/changelog/index.html', contentHtml: html, jsonLd
  }), 'utf8');
  return { out: file, count: data.releases.length };
}

/* ─────────────────────────────────────────────────────────  GLOSSARY  */
export async function buildGlossary() {
  const data = await loadJson('sandbox/data/glossary.json');
  const sorted = [...data.terms].sort((a, b) => a.term.localeCompare(b.term));
  const items = sorted.map(t => `
    <article id="${esc(t.term.toLowerCase().replace(/\s+/g,'-'))}" style="padding:var(--space-md) 0;border-bottom:1px solid var(--border);">
      <h3 style="margin:0 0 6px;font-size:18px;font-weight:600;color:var(--brand-teal);">${esc(t.term)}</h3>
      <p style="margin:0;color:var(--text);line-height:1.6;">${esc(t.definition)}</p>
    </article>`).join('');
  const tocHtml = sorted.map(t =>
    `<a href="#${esc(t.term.toLowerCase().replace(/\s+/g,'-'))}" style="margin-right:14px;color:var(--brand-teal);text-decoration:none;font-size:13px;">${esc(t.term)}</a>`
  ).join('');
  const html = `
    <h1 style="font-size:44px;font-weight:500;letter-spacing:-0.025em;margin:0 0 12px;">Glossary</h1>
    <p style="font-size:18px;line-height:1.55;color:var(--text-muted);max-width:880px;margin-bottom:24px;">
      MEP, BIM and AI terms used across the Adelphos docs. ${data.terms.length} terms.
    </p>
    <p style="margin-bottom:24px;">${tocHtml}</p>
    <div>${items}</div>`;

  const jsonLd = `<script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'DefinedTermSet',
    name: 'Adelphos AI glossary',
    hasDefinedTerm: data.terms.map(t => ({
      '@type': 'DefinedTerm',
      name: t.term,
      description: t.definition,
      url: `https://adelphos.ai/glossary/index.html#${t.term.toLowerCase().replace(/\s+/g,'-')}`
    }))
  }, null, 2)}</script>`;

  const file = O('glossary', 'index.html');
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, await pageShell({
    title: 'Glossary', description: 'MEP, BIM and AI terms used across the Adelphos AI documentation.',
    pagePath: '/glossary/index.html', contentHtml: html, jsonLd
  }), 'utf8');
  return { out: file, count: data.terms.length };
}
