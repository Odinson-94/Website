import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const registerPath = path.join(root, 'sandbox', 'regional-seo', 'delivery-harness', 'toolbox-register.json');
const watchlistPath = path.join(root, 'data', 'seo-keywords.generated.json');
const outputPath = path.join(root, 'data', 'seo-research.generated.json');
const trackerCandidates = [
  path.join('C:', 'Users', 'RPC', 'source', 'repos', 'Adelphos Chat', 'How-To-Edit', 'adelphos-website-toolbox', 'docs', 'SEO_KEYWORD_TRACKER.md'),
  path.join(root, 'SEO_KEYWORD_TRACKER.md'),
];

function clean(value = '') {
  return String(value).replace(/\*\*/g, '').replace(/`/g, '').replace(/<br\s*\/?>/gi, ' ').replace(/\s+/g, ' ').trim();
}

function key(value) {
  return clean(value).toLowerCase();
}

function parseNumber(value) {
  const raw = clean(value).toLowerCase().replace(/[,£$~+]/g, '');
  const match = raw.match(/\d+(?:\.\d+)?/);
  if (!match) return null;
  const number = Number(match[0]);
  return Math.round(number * (raw.includes('k') ? 1000 : 1));
}

function opportunity(volume, difficulty) {
  if (volume == null) return null;
  const volumePoints = Math.min(65, (Math.log10(volume + 1) / 5) * 65);
  const difficultyPoints = difficulty == null ? 17.5 : ((100 - difficulty) / 100) * 35;
  return Math.round((volumePoints + difficultyPoints) * 10) / 10;
}

let trackerPath = null;
for (const candidate of trackerCandidates) {
  try {
    await fs.access(candidate);
    trackerPath = candidate;
    break;
  } catch {}
}

const register = JSON.parse(await fs.readFile(registerPath, 'utf8'));
const watchlist = JSON.parse(await fs.readFile(watchlistPath, 'utf8'));
const terms = new Map();

function add(item) {
  const keyword = clean(item.keyword);
  if (!keyword || keyword.length > 160 || /^cluster\s+\d+/i.test(keyword) || /^\d+\.\s/.test(keyword) || /grand total/i.test(keyword)) return;
  const id = key(keyword);
  const current = terms.get(id) || { keyword, country: item.country || 'United Kingdom', sources: [] };
  for (const [field, value] of Object.entries(item)) {
    if (field === 'keyword' || field === 'sources' || value == null || value === '') continue;
    if (current[field] == null || current[field] === '') current[field] = value;
  }
  for (const source of item.sources || []) if (!current.sources.includes(source)) current.sources.push(source);
  terms.set(id, current);
}

if (trackerPath) {
  const lines = (await fs.readFile(trackerPath, 'utf8')).split(/\r?\n/);
  let cluster = 'Toolbox keyword tracker';
  let headers = null;
  for (const line of lines) {
    const heading = line.match(/^#{2,3}\s+(CLUSTER[^\n]+)/i);
    if (heading) cluster = clean(heading[1]);
    if (/^#{2,3}\s+RUNNING TOTALS/i.test(line)) headers = null;
    if (!line.trim().startsWith('|')) continue;
    const cells = line.trim().replace(/^\||\|$/g, '').split('|').map(clean);
    if (cells.every((cell) => /^:?-{3,}:?$/.test(cell))) continue;
    if (cells.some((cell) => /^keyword$/i.test(cell))) {
      headers = cells.map((cell) => cell.toLowerCase());
      continue;
    }
    if (/^(cluster|pages)$/i.test(cells[0])) {
      headers = null;
      continue;
    }
    if (!headers || cells.length < 2) continue;
    const row = Object.fromEntries(headers.map((header, index) => [header, cells[index] || '']));
    const keywordCell = row.keyword || '';
    if (!keywordCell || /subtotal/i.test(keywordCell)) continue;
    const volume = parseNumber(row['vol/mo'] || row['est. monthly'] || row.volume || '');
    const difficulty = parseNumber(row.diff || row.difficulty || '');
    const targetPage = clean(row['target page'] || '');
    const status = clean(row.status || 'planned');
    for (const keyword of keywordCell.split(/\s+\/\s+/)) add({
      keyword, country: 'United Kingdom', cluster, target_page_label: targetPage,
      monthly_searches: volume, difficulty, status,
      volume_source: 'Adelphos toolbox tracker snapshot', sources: ['toolbox-tracker'],
    });
  }
}

for (const record of register.records || []) {
  const recordTerms = [record.primary_keyword, ...(record.secondary_keywords || []), ...(record.questions || [])];
  for (const keyword of recordTerms) add({
    keyword, country: 'United Kingdom', cluster: `Toolbox ${record.folder || record.contentSection || 'inventory'}`,
    target_page_label: record.title, status: record.page_worthy ? 'page-worthy' : record.status,
    sources: ['toolbox-record'],
  });
}

for (const record of watchlist.keywords || []) add({
  keyword: record.keyword, country: record.location_name?.startsWith('Australia') ? 'Australia' : 'United Kingdom',
  cluster: record.tag, target_url: record.target_url, target_page_label: record.page_title,
  status: 'published', sources: ['published-watchlist'],
});

const keywords = [...terms.values()].map((item) => ({
  ...item,
  opportunity_score: opportunity(item.monthly_searches, item.difficulty),
})).sort((a, b) => (b.monthly_searches || -1) - (a.monthly_searches || -1) || a.keyword.localeCompare(b.keyword));

const payload = {
  generated_at: new Date().toISOString(),
  tracker_source: trackerPath,
  methodology: 'Monthly searches and difficulty are historical toolbox values unless a future Google Ads refresh replaces them. Blank values are never invented.',
  counts: {
    keywords: keywords.length,
    with_monthly_volume: keywords.filter((item) => item.monthly_searches != null).length,
    published: keywords.filter((item) => item.status === 'published').length,
    countries: new Set(keywords.map((item) => item.country)).size,
  },
  keywords,
};

await fs.writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
console.log(`Wrote ${keywords.length} research keywords (${payload.counts.with_monthly_volume} with volume) to ${path.relative(root, outputPath)}`);
