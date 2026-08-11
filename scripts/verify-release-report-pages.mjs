import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const routes = [
  '/reports/',
  '/reports/tm59-overheating-assessment/',
  '/reports/tm52-overheating-assessment/',
  '/reports/natural-ventilation-calculation-report/',
  '/reports/thermal-modelling-report/',
  '/calculations/',
  '/calculations/lighting-calculations/',
  '/report-templates/',
  '/report-templates/tm59-overheating-report-template/',
  '/report-templates/tm52-overheating-report-template/',
  '/report-templates/natural-ventilation-report-template/',
  '/report-templates/thermal-modelling-report-template/',
  '/report-templates/lighting-calculation-report-template/',
];

const errors = [];
const titles = new Map();
const descriptions = new Map();

function routeFile(route) {
  return join(root, route.replace(/^\//, ''), 'index.html');
}

function internalTarget(href) {
  const clean = href.split('#')[0].split('?')[0];
  if (!clean || clean === '/') return join(root, 'index.html');
  const target = join(root, clean.replace(/^\//, ''));
  return clean.endsWith('/') ? join(target, 'index.html') : (/\.[a-z0-9]+$/i.test(clean) ? target : join(target, 'index.html'));
}

for (const route of routes) {
  const file = routeFile(route);
  if (!existsSync(file)) {
    errors.push(`${route}: missing index.html`);
    continue;
  }
  const html = readFileSync(file, 'utf8');
  const title = html.match(/<title>([^<]+)<\/title>/)?.[1];
  const description = html.match(/<meta name="description" content="([^"]+)">/)?.[1];
  const canonical = html.match(/<link rel="canonical" href="([^"]+)">/)?.[1];
  const h1Count = (html.match(/<h1(?:\s[^>]*)?>/g) || []).length;
  const jsonLd = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];

  if (!title || title.length < 25 || title.length > 68) errors.push(`${route}: title length is ${title?.length ?? 0}`);
  if (!description || description.length < 120 || description.length > 165) errors.push(`${route}: meta description length is ${description?.length ?? 0}`);
  if (canonical !== `https://adelphos.ai${route.replace(/\/$/, '') || '/'}`) errors.push(`${route}: canonical mismatch (${canonical})`);
  if (h1Count !== 1) errors.push(`${route}: expected one H1, found ${h1Count}`);
  if (!jsonLd.length) errors.push(`${route}: missing JSON-LD`);
  for (const [, block] of jsonLd) {
    try { JSON.parse(block); } catch (error) { errors.push(`${route}: invalid JSON-LD (${error.message})`); }
  }

  if (title) {
    if (titles.has(title)) errors.push(`${route}: duplicate title with ${titles.get(title)}`);
    titles.set(title, route);
  }
  if (description) {
    if (descriptions.has(description)) errors.push(`${route}: duplicate description with ${descriptions.get(description)}`);
    descriptions.set(description, route);
  }

  for (const match of html.matchAll(/href="([^"]+)"/g)) {
    const href = match[1];
    if (!href.startsWith('/') || href.startsWith('//')) continue;
    const target = internalTarget(href);
    if (!existsSync(target)) errors.push(`${route}: missing internal target ${href}`);
  }
}

const sitemap = readFileSync(join(root, 'sitemap.xml'), 'utf8');
for (const route of routes) {
  const url = `https://adelphos.ai${route.replace(/\/$/, '') || '/'}`;
  const count = sitemap.split(`<loc>${url}</loc>`).length - 1;
  if (count !== 1) errors.push(`sitemap: ${url} occurs ${count} times`);
}

const calculators = readFileSync(join(root, 'calculators', 'index.html'), 'utf8');
const publicLinks = [...calculators.matchAll(/href="\/calculators\/([^"/]+)"/g)];
const chatLinks = [...calculators.matchAll(/href="https:\/\/chat\.adelphos\.ai(\/[^"#?]*)"/g)];
if (publicLinks.length !== 18) errors.push(`calculators: expected 18 public links, found ${publicLinks.length}`);
if (chatLinks.length !== 48) errors.push(`calculators: expected 48 registered app links, found ${chatLinks.length}`);
if (new Set(chatLinks.map((match) => match[1])).size !== 48) errors.push('calculators: app routes must be unique');
if (/VT Slope/i.test(calculators)) errors.push('calculators: VT Slope must not be published');
if ((calculators.match(/<h1(?:\s[^>]*)?>/g) || []).length !== 1) errors.push('calculators: expected one H1');
if (!calculators.includes('<title>Free Engineering Calculators | Adelphos</title>')) errors.push('calculators: SEO title mismatch');
if (!calculators.includes('<link rel="canonical" href="https://adelphos.ai/calculators">')) errors.push('calculators: canonical mismatch');
const calculatorDescription = calculators.match(/<meta name="description" content="([^"]+)">/)?.[1] || '';
if (calculatorDescription.length < 150 || calculatorDescription.length > 160) errors.push(`calculators: meta description length is ${calculatorDescription.length}`);
for (const match of publicLinks) {
  const target = internalTarget(`/calculators/${match[1]}/`);
  if (!existsSync(target)) errors.push(`calculators: missing public calculator /calculators/${match[1]}/`);
}
const calculatorJsonLd = [...calculators.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
if (!calculatorJsonLd.length) errors.push('calculators: missing JSON-LD');
for (const [, block] of calculatorJsonLd) {
  try { JSON.parse(block); } catch (error) { errors.push(`calculators: invalid JSON-LD (${error.message})`); }
}

for (const homeFile of ['index.html', 'templates/home.html']) {
  const home = readFileSync(join(root, homeFile), 'utf8');
  const calculatorHubLinks = [...home.matchAll(/href="\/calculators\/"/g)].length;
  if (calculatorHubLinks < 8) errors.push(`${homeFile}: expected all calculator badges and CTA to link to /calculators/`);
  if (home.includes('/docs/calc-engines/index.html')) errors.push(`${homeFile}: still links to the superseded calculator docs page`);
}

const docsShell = readFileSync(join(root, 'docs-shell.js'), 'utf8');
if (!docsShell.includes("href: '/calculators/'")) errors.push('docs-shell.js: calculator navigation does not use /calculators/');
if (docsShell.includes("href: '/docs/calc-engines/index.html'")) errors.push('docs-shell.js: calculator navigation still uses the old docs route');

const appCatalogue = join(root, '..', 'Adelphos Chat', 'adelphos-chat', 'chat-frontend', '332-calculators-catalogue', '010-render-calculators-catalogue.tsx');
if (existsSync(appCatalogue)) {
  const registeredRoutes = readFileSync(appCatalogue, 'utf8')
    .split(/\r?\n/)
    .filter((line) => line.includes("status: 'done'"))
    .map((line) => line.match(/route: '([^']+)'/)?.[1])
    .filter(Boolean);
  const websiteRoutes = chatLinks.map((match) => match[1]);
  const missingRoutes = registeredRoutes.filter((route) => !websiteRoutes.includes(route));
  const extraRoutes = websiteRoutes.filter((route) => !registeredRoutes.includes(route));
  if (missingRoutes.length) errors.push(`calculators: missing registered app routes ${missingRoutes.join(', ')}`);
  if (extraRoutes.length) errors.push(`calculators: website routes absent from app catalogue ${extraRoutes.join(', ')}`);
}

for (const jsonFile of ['data/nav.json', 'data/apps.json']) {
  try { JSON.parse(readFileSync(join(root, jsonFile), 'utf8')); }
  catch (error) { errors.push(`${jsonFile}: invalid JSON (${error.message})`); }
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}

console.log(`PASS: ${routes.length} SEO pages, unique metadata, valid JSON-LD, internal links, sitemap entries and calculator counts.`);
