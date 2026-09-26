'use strict';
// Synthetic transport only. Serves exact packaged portal HTML without script injection.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = __dirname;
const fixture = JSON.parse(fs.readFileSync(path.join(root, '030-fixture-data.json'), 'utf8'));
const records = [];
const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
function json(res, status, value) { res.writeHead(status, headers); res.end(JSON.stringify(value)); }
http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  if (url.pathname === '/__evidence') return json(res, 200, records);
  if (url.pathname.startsWith('/api/seo/')) {
    const ref = new URL(req.headers.referer || 'http://127.0.0.1');
    const scenario = ref.searchParams.get('scenario') || 'populated';
    let raw = ''; for await (const chunk of req) raw += chunk;
    const accepted = req.headers.authorization === 'Bearer synthetic-seo-ui-token';
    records.push({ variant: ref.pathname, scenario, method: req.method, path: url.pathname, body: raw ? JSON.parse(raw) : null, token: accepted ? 'synthetic-valid' : 'absent-or-invalid' });
    if (url.pathname.endsWith('/session') && req.method === 'DELETE') return json(res, 200, { ok: true });
    if (!accepted || scenario === 'denied') return json(res, 401, { detail: 'Synthetic portal access denied.' });
    if (scenario === 'error') return json(res, 503, { detail: 'Synthetic database unavailable.' });
    if (scenario === 'loading') await new Promise((resolve) => setTimeout(resolve, 1200));
    if (url.pathname.endsWith('/session')) return json(res, 200, { ok: true });
    if (url.pathname.endsWith('/collect')) return json(res, scenario === 'collect-error' ? 503 : 200, scenario === 'collect-error' ? { detail: 'Synthetic collection failed.' } : { ok: true });
    if (url.pathname.endsWith('/research')) return json(res, scenario === 'research-error' ? 503 : 200, scenario === 'research-error' ? { detail: 'Synthetic research provider unavailable.' } : { ok: true, result: { succeeded: 3 } });
    const value = structuredClone(fixture);
    if (scenario === 'empty') {
      for (const key of ['keywords','searches','countries','trend','gsc_daily','runs']) value[key] = [];
      value.pages.pages = []; value.research.keywords = [];
      for (const obj of [value.summary, value.pages.counts, value.research.counts]) for (const key of Object.keys(obj)) if (typeof obj[key] === 'number') obj[key] = 0;
      value.backlinks = {};
    }
    return json(res, 200, value);
  }
  const file = path.resolve(root, '.' + decodeURIComponent(url.pathname));
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); res.end('Local fixture route not found'); return; }
  const ext = path.extname(file);
  res.writeHead(200, { 'Content-Type': ({ '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.woff2': 'font/woff2', '.json': 'application/json' })[ext] || 'application/octet-stream', 'Cache-Control': 'no-store', 'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'" });
  res.end(fs.readFileSync(file));
}).listen(62593, '127.0.0.1', () => console.log('SEO synthetic UI preview http://127.0.0.1:62593/seo-portal/current.html'));
