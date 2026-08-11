import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const watchlist = JSON.parse(await fs.readFile(path.join(root, 'data', 'seo-keywords.generated.json'), 'utf8'));
const outputPath = path.join(root, 'data', 'seo-page-audit.generated.json');

function decode(value = '') {
  return String(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function captured(html, pattern) {
  return decode(html.match(pattern)?.[1] || '');
}

function attribute(tag, name) {
  return decode(tag.match(new RegExp(`\\b${name}=["']([^"']*)`, 'i'))?.[1] || '');
}

function normalized(value) {
  return decode(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function includesIntent(value, keyword) {
  const target = normalized(keyword);
  const source = normalized(value);
  return Boolean(target && source && (source.includes(target) || target.includes(source)));
}

function addIssue(issues, severity, code, message, action) {
  issues.push({ severity, code, message, action });
}

function inspectPage(html, page) {
  const title = captured(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
  const description = captured(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)/i)
    || captured(html, /<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i);
  const canonical = captured(html, /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']*)/i)
    || captured(html, /<link[^>]+href=["']([^"']*)["'][^>]+rel=["']canonical["']/i);
  const robots = captured(html, /<meta[^>]+name=["']robots["'][^>]+content=["']([^"']*)/i);
  const h1s = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map((match) => decode(match[1])).filter(Boolean);
  const imageTags = [...html.matchAll(/<img\b[^>]*>/gi)].map((match) => match[0]);
  const missingAlt = imageTags.filter((tag) => !/\balt\s*=/i.test(tag) || !attribute(tag, 'alt')).length;
  const internalLinks = [...html.matchAll(/<a\b[^>]+href=["']([^"']+)/gi)]
    .map((match) => match[1])
    .filter((href) => href.startsWith('/') || href.startsWith('https://adelphos.ai')).length;
  const schemaTypes = [...html.matchAll(/["']@type["']\s*:\s*["']([^"']+)/gi)].map((match) => match[1]);
  const body = decode((html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1] || '')
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' '));
  const wordCount = body ? body.split(/\s+/).length : 0;
  const keywords = page.keywords;
  const primaryKeyword = keywords[0] || page.page_title;
  const issues = [];

  if (!title) addIssue(issues, 'critical', 'missing-title', 'The page has no title tag.', `Add a unique title led by “${primaryKeyword}”.`);
  else if (title.length < 30 || title.length > 65) addIssue(issues, 'warning', 'title-length', `Title length is ${title.length} characters.`, 'Keep the title between roughly 30 and 65 characters without truncating the intent.');
  if (title && !includesIntent(title, primaryKeyword)) addIssue(issues, 'warning', 'title-intent', 'The primary tracked intent is not clear in the title.', `Work “${primaryKeyword}” naturally into the title.`);
  if (!description) addIssue(issues, 'critical', 'missing-description', 'The page has no meta description.', 'Add a specific, benefit-led description for the search result.');
  else if (description.length < 70 || description.length > 170) addIssue(issues, 'warning', 'description-length', `Meta description length is ${description.length} characters.`, 'Aim for a useful description of roughly 70–170 characters.');
  if (!canonical) addIssue(issues, 'critical', 'missing-canonical', 'The page has no canonical URL.', 'Add a self-referencing canonical URL.');
  else if (canonical.replace(/\/$/, '') !== page.target_url.replace(/\/$/, '')) addIssue(issues, 'warning', 'canonical-mismatch', 'The canonical does not match the tracked target URL.', 'Confirm the intended canonical and update the watchlist or page.');
  if (/noindex/i.test(robots)) addIssue(issues, 'critical', 'noindex', 'The page asks search engines not to index it.', 'Remove noindex if this page is intended to rank.');
  if (h1s.length !== 1) addIssue(issues, 'critical', 'h1-count', `The page has ${h1s.length} H1 headings.`, 'Use one descriptive H1 for the main page topic.');
  else if (!includesIntent(h1s[0], primaryKeyword)) addIssue(issues, 'warning', 'h1-intent', 'The H1 does not clearly match the primary tracked intent.', `Align the H1 with “${primaryKeyword}”.`);
  if (wordCount < 250) addIssue(issues, 'warning', 'thin-copy', `The page contains about ${wordCount} visible words.`, 'Add genuinely useful explanatory copy, examples and FAQs where the topic needs them.');
  if (missingAlt > 0) addIssue(issues, 'warning', 'missing-alt', `${missingAlt} image${missingAlt === 1 ? '' : 's'} lack descriptive alt text.`, 'Add concise alt text to informative images; use empty alt only for decoration.');
  if (internalLinks < 3) addIssue(issues, 'warning', 'few-internal-links', `Only ${internalLinks} internal links were found.`, 'Add contextual links from and to related Adelphos pages.');
  if (!schemaTypes.length) addIssue(issues, 'opportunity', 'missing-schema', 'No JSON-LD schema type was detected.', 'Add the most specific valid schema supported by visible page content.');

  const deductions = issues.reduce((sum, issue) => sum + (issue.severity === 'critical' ? 16 : issue.severity === 'warning' ? 7 : 3), 0);
  return {
    ...page,
    primary_keyword: primaryKeyword,
    title,
    title_length: title.length,
    description,
    description_length: description.length,
    canonical,
    robots: robots || 'index, follow (implicit)',
    h1: h1s[0] || '',
    h1_count: h1s.length,
    word_count: wordCount,
    images: imageTags.length,
    images_missing_alt: missingAlt,
    internal_links: internalLinks,
    schema_types: [...new Set(schemaTypes)],
    score: Math.max(0, 100 - deductions),
    issues,
  };
}

const grouped = new Map();
for (const keyword of watchlist.keywords || []) {
  const key = keyword.source_path;
  const page = grouped.get(key) || {
    source_path: key,
    target_url: keyword.target_url,
    page_title: keyword.page_title,
    tag: keyword.tag,
    keywords: [],
  };
  if (!page.keywords.includes(keyword.keyword)) page.keywords.push(keyword.keyword);
  grouped.set(key, page);
}

const pages = [];
for (const page of grouped.values()) {
  try {
    const html = await fs.readFile(path.join(root, page.source_path), 'utf8');
    pages.push(inspectPage(html, page));
  } catch (error) {
    pages.push({
      ...page,
      primary_keyword: page.keywords[0] || page.page_title,
      score: 0,
      issues: [{ severity: 'critical', code: 'source-missing', message: 'The tracked source page could not be read.', action: error.message }],
    });
  }
}

pages.sort((left, right) => left.score - right.score || left.page_title.localeCompare(right.page_title));
const payload = {
  generated_at: new Date().toISOString(),
  source: 'Repository HTML audit. Search performance is joined at request time from Google Search Console.',
  counts: {
    pages: pages.length,
    critical: pages.filter((page) => page.issues.some((issue) => issue.severity === 'critical')).length,
    healthy: pages.filter((page) => page.score >= 85).length,
    average_score: pages.length ? Math.round((pages.reduce((sum, page) => sum + page.score, 0) / pages.length) * 10) / 10 : null,
  },
  pages,
};

await fs.writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
console.log(`Wrote ${pages.length} audited pages to ${path.relative(root, outputPath)}`);
