import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputPath = path.join(root, 'data', 'seo-link-graph.generated.json');
const sitemapUrl = process.env.SEO_SITEMAP_URL || 'https://adelphos.ai/sitemap.xml';
const allowedHosts = new Set(['adelphos.ai', 'www.adelphos.ai']);
const concurrency = Math.max(1, Number(process.env.SEO_CRAWL_CONCURRENCY) || 16);

function decodeXml(value = '') {
  return String(value)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function normalizeUrl(value, base) {
  try {
    const url = new URL(value, base);
    if (!['http:', 'https:'].includes(url.protocol) || !allowedHosts.has(url.hostname.toLowerCase())) return null;
    url.protocol = 'https:';
    url.hostname = 'adelphos.ai';
    url.hash = '';
    url.search = '';
    url.pathname = url.pathname.replace(/\/{2,}/g, '/');
    if (url.pathname !== '/') url.pathname = url.pathname.replace(/\/$/, '');
    return url.href;
  } catch {
    return null;
  }
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'AdelphosSEOAudit/1.0 (+https://adelphos.ai/seo-portal)' },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return { text: await response.text(), contentType: response.headers.get('content-type') || '' };
}

async function sitemapUrls(url, seen = new Set()) {
  if (seen.has(url)) return [];
  seen.add(url);
  const { text } = await fetchText(url);
  const locations = [...text.matchAll(/<loc>\s*([\s\S]*?)\s*<\/loc>/gi)].map((match) => decodeXml(match[1].trim()));
  if (/<sitemapindex\b/i.test(text)) {
    const nested = await Promise.all(locations.map((location) => sitemapUrls(location, seen)));
    return nested.flat();
  }
  return locations.map((location) => normalizeUrl(location, url)).filter(Boolean);
}

const listedUrls = [...new Set(await sitemapUrls(sitemapUrl))];
const sourceSet = new Set(listedUrls);
const uniqueEdges = new Set();
const uniqueTargets = new Set();
const targetCounts = new Map();
const failures = [];
let linkOccurrences = 0;
let crawledPages = 0;
let nonHtmlResponses = 0;
let cursor = 0;

async function worker() {
  while (cursor < listedUrls.length) {
    const index = cursor++;
    const source = listedUrls[index];
    try {
      const { text, contentType } = await fetchText(source);
      if (contentType && !/html|xhtml/i.test(contentType)) {
        nonHtmlResponses += 1;
        continue;
      }
      crawledPages += 1;
      for (const match of text.matchAll(/<a\b[^>]*\bhref\s*=\s*["']([^"']+)["']/gi)) {
        const target = normalizeUrl(decodeXml(match[1]), source);
        if (!target) continue;
        linkOccurrences += 1;
        uniqueEdges.add(`${source}\n${target}`);
        uniqueTargets.add(target);
        targetCounts.set(target, (targetCounts.get(target) || 0) + 1);
      }
    } catch (error) {
      failures.push({ url: source, error: error.message });
    }
  }
}

await Promise.all(Array.from({ length: concurrency }, () => worker()));

const payload = {
  captured_at: new Date().toISOString(),
  source: 'Live adelphos.ai sitemap crawl',
  source_scope: 'All URLs listed in sitemap.xml; HTML anchor hrefs only. Client-rendered links and URLs absent from the sitemap are not included.',
  sitemap_url: sitemapUrl,
  sitemap_urls: listedUrls.length,
  crawled_pages: crawledPages,
  failed_pages: failures.length,
  non_html_responses: nonHtmlResponses,
  internal_link_occurrences: linkOccurrences,
  unique_internal_edges: uniqueEdges.size,
  unique_internal_targets: uniqueTargets.size,
  orphaned_sitemap_pages: listedUrls.filter((url) => !uniqueTargets.has(url) && url !== 'https://adelphos.ai/').length,
  top_internal_targets: [...targetCounts.entries()]
    .map(([url, links]) => ({ url, links, listed_in_sitemap: sourceSet.has(url) }))
    .sort((left, right) => right.links - left.links || left.url.localeCompare(right.url))
    .slice(0, 20),
  failures: failures.slice(0, 50),
};

await fs.writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(payload, null, 2));
