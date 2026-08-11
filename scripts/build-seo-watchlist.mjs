import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputPath = path.join(root, 'data', 'seo-keywords.generated.json');
const toolboxRegisterPath = path.join(root, 'sandbox', 'regional-seo', 'delivery-harness', 'toolbox-register.json');
const ignoredDirectories = new Set(['.git', '.playwright-cli', '_archive', 'node_modules', 'output', 'sandbox', 'tmp']);
const publishedSections = new Set(['ai-developers', 'apps', 'calculators', 'documents', 'products', 'tools']);

async function htmlFiles(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await htmlFiles(absolute));
    if (entry.isFile() && entry.name === 'index.html') files.push(absolute);
  }
  return files;
}

function text(value = '') {
  return value
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&ndash;/g, '–')
    .replace(/&mdash;/g, '—')
    .replace(/\s+/g, ' ')
    .trim();
}

function match(html, pattern) {
  return text(html.match(pattern)?.[1] || '');
}

function cleanTitle(value) {
  return value.replace(/\s*[|—–-]\s*(?:Apps\s*[|—–-]\s*)?Adelphos(?: AI)?\s*$/i, '').trim();
}

function normalized(value) {
  return String(value || '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, ' ').trim();
}

function toolboxSlug(value) {
  return String(value || '').replace(/^(?:app|calc|doc|feat)-/i, '');
}

function locationFor(route) {
  if (route.startsWith('/ai-developers/australia')) return 'Australia';
  if (route.includes('/scotland')) return 'Scotland,United Kingdom';
  return 'United Kingdom';
}

const pages = [];
for (const filename of await htmlFiles(root)) {
  const html = await fs.readFile(filename, 'utf8');
  const relative = path.relative(root, filename).replace(/\\/g, '/');
  const route = `/${relative.replace(/\/index\.html$/i, '')}`;
  const parts = route.split('/').filter(Boolean);
  const primaryIntent = match(html, /Primary search intent<\/span>\s*<strong>([\s\S]*?)<\/strong>/i);
  const eligiblePublishedPage = parts.length > 1 && publishedSections.has(parts[0]) && !route.includes('/preview');
  if (!primaryIntent && !eligiblePublishedPage) continue;
  const canonical = match(html, /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)/i)
    || match(html, /<meta[^>]+property=["']og:url["'][^>]+content=["']([^"']+)/i)
    || `https://adelphos.ai${route}`;
  if (!canonical.startsWith('https://adelphos.ai')) continue;
  const pageTitle = cleanTitle(match(html, /<title>([\s\S]*?)<\/title>/i));
  pages.push({
    route, relative, parts, canonical, pageTitle,
    slug: parts.at(-1),
    primaryIntent,
    location_name: locationFor(route),
    tag: primaryIntent && route.startsWith('/resources/epc') ? 'epc' : parts[0],
  });
}

let toolbox = { counts: {}, records: [], keywordTargets: [] };
try {
  toolbox = JSON.parse(await fs.readFile(toolboxRegisterPath, 'utf8'));
} catch (error) {
  console.warn(`Toolbox register unavailable: ${error.message}`);
}

const records = [];
const seen = new Set();
function addKeyword(keyword, page) {
  const cleanKeyword = text(keyword);
  if (!cleanKeyword || cleanKeyword.length > 160) return;
  const key = `${cleanKeyword.toLowerCase()}\n${page.location_name}\ndesktop`;
  if (seen.has(key)) return;
  seen.add(key);
  records.push({
    keyword: cleanKeyword,
    location_name: page.location_name,
    language_code: 'en',
    device: 'desktop',
    target_url: page.canonical,
    tag: page.tag,
    page_title: page.pageTitle || cleanKeyword,
    source_path: page.relative,
    enabled: true,
  });
}

for (const page of pages) {
  if (page.primaryIntent) addKeyword(page.primaryIntent, page);
  if (page.pageTitle && normalized(page.pageTitle) !== normalized(page.primaryIntent)) addKeyword(page.pageTitle, page);
}

const focusedKeywordTargets = {
  '/apps/cable-calcs-ui': [
    'cable calcs',
    'cable calculations',
    'cable-calcs ui',
  ],
  '/tools/project-programme': [
    'project programme',
    'construction project programme',
    'construction programme template',
    'how to write a project programme',
    'construction phase plan template word',
  ],
  '/documents/construction-contracts': [
    'construction contracts',
    'construction contract review',
    'write a construction contract',
    'review construction contracts',
  ],
  '/documents/types-of-construction-contracts': [
    'types of construction contracts',
    'construction contract types',
    'JCT construction contract',
    'NEC construction contract',
    'design and build contract',
  ],
};

for (const [route, keywords] of Object.entries(focusedKeywordTargets)) {
  const page = pages.find((candidate) => candidate.route === route);
  if (!page) continue;
  for (const keyword of keywords) addKeyword(keyword, page);
}

let includedToolboxTerms = 0;
for (const item of toolbox.records || []) {
  const id = normalized(toolboxSlug(item.id));
  const title = normalized(String(item.title || '').replace(/\s*\([^)]*\)\s*$/g, ''));
  const matchingPages = pages.filter((page) => normalized(page.slug) === id || normalized(page.pageTitle) === title);
  if (matchingPages.length !== 1) continue;
  const terms = [item.primary_keyword, ...(item.secondary_keywords || []), ...(item.questions || [])];
  for (const term of terms) {
    const before = records.length;
    addKeyword(term, matchingPages[0]);
    if (records.length > before) includedToolboxTerms += 1;
  }
}

const toolboxTerms = (toolbox.records || []).flatMap((item) => [
  item.primary_keyword, ...(item.secondary_keywords || []), ...(item.questions || []),
]).filter((value) => typeof value === 'string' && value.trim());

records.sort((a, b) => a.keyword.localeCompare(b.keyword));
const payload = {
  generated_at: new Date().toISOString(),
  target_domain: 'adelphos.ai',
  source: 'Published Adelphos pages, explicit page intents, and unambiguous toolbox-to-page keyword matches.',
  inventory: {
    published_focus_pages: pages.length,
    tracked_keywords: records.length,
    toolbox_live_records: toolbox.counts?.liveRecords || toolbox.records?.length || 0,
    toolbox_keyword_target_groups: toolbox.counts?.keywordTargets || toolbox.keywordTargets?.length || 0,
    toolbox_unique_terms: new Set(toolboxTerms.map((value) => value.toLowerCase().trim())).size,
    included_toolbox_terms: includedToolboxTerms,
  },
  keywords: records,
};
await fs.writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
console.log(`Wrote ${records.length} keywords from ${pages.length} published focus pages to ${path.relative(root, outputPath)}`);
