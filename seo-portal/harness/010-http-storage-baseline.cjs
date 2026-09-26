'use strict';

// Actual production HTTP handlers; synthetic loopback PostgREST only.
const assert = require('node:assert/strict');
const http = require('node:http');
const crypto = require('node:crypto');
const { test } = require('node:test');

for (const key of Object.keys(process.env)) {
  if (/^(SUPABASE_|ADELPHOS_SUPABASE_|SEO_|GSC_|GOOGLE_ADS_|DATAFORSEO_|CRON_SECRET$)/.test(key)) delete process.env[key];
}
process.env.SEO_PORTAL_TOKEN = 'synthetic-local-portal-token';
process.env.CRON_SECRET = 'synthetic-local-cron-token';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'synthetic-local-service-role';
const nativeFetch = globalThis.fetch;
globalThis.fetch = (input, options) => {
  const url = new URL(typeof input === 'string' ? input : input.url || input);
  assert.equal(url.hostname, '127.0.0.1', 'External network is forbidden');
  assert.equal(url.protocol, 'http:');
  return nativeFetch(input, options);
};
const sha = (value) => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const readBody = async (req) => {
  let body = '';
  for await (const chunk of req) body += chunk;
  return body;
};
const listen = async (server) => {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return `http://127.0.0.1:${server.address().port}`;
};
const close = (server) => new Promise((resolve) => {
  server.close(resolve);
  server.closeAllConnections();
});

test('SEO production HTTP baseline — synthetic database, no tenant-security certification', async (t) => {
  const requests = [];
  const keyword = {
    id: 901, keyword: 'synthetic SEO fixture', enabled: true, device: 'desktop',
    location_name: 'United Kingdom', target_url: 'https://example.invalid/fixture',
    tag: 'synthetic', page_title: 'Synthetic SEO fixture',
  };
  let failTable = '';
  let keywords = [keyword];
  const runs = new Map();
  const db = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    const table = url.pathname.replace('/rest/v1/', '');
    const raw = await readBody(req);
    const body = raw ? JSON.parse(raw) : null;
    requests.push({ method: req.method, path: url.pathname + url.search, body,
      serviceRole: req.headers.apikey === 'synthetic-local-service-role',
      identityForwarded: Boolean(req.headers['x-tenant-id'] || req.headers['x-user-id']) });
    res.setHeader('Content-Type', 'application/json');
    if (table === failTable) { res.statusCode = 503; res.end('{"detail":"synthetic database unavailable"}'); return; }
    if (req.method === 'POST' && table === 'seo_keywords') keywords = body.map((row, i) => ({ ...row, id: i + 1 }));
    if (req.method === 'POST' && table === 'seo_collection_runs') runs.set(body.id, body);
    if (req.method !== 'GET') { res.statusCode = 204; res.end(); return; }
    const values = table === 'seo_keywords' ? keywords : table === 'seo_collection_runs' ? [...runs.values()] : [];
    res.end(JSON.stringify(values));
  });
  const dbOrigin = await listen(db);
  process.env.SUPABASE_URL = dbOrigin;
  const handlers = Object.fromEntries(['data', 'session', 'collect', 'research'].map((name) => [name, require(`../../api/seo/${name}.js`)]));
  const lib = require('../../api/seo/_lib.js');
  const app = http.createServer(async (req, res) => {
    const name = new URL(req.url, 'http://127.0.0.1').pathname.split('/').pop();
    req.body = await readBody(req);
    try { await handlers[name](req, res); }
    catch (error) { res.statusCode = 500; res.end(JSON.stringify({ detail: error.message })); }
  });
  const origin = await listen(app);
  t.after(async () => { await close(app); await close(db); globalThis.fetch = nativeFetch; });
  const call = async (name, options = {}) => {
    const response = await fetch(`${origin}/api/seo/${name}`, options);
    return { status: response.status, headers: response.headers, body: await response.json() };
  };
  const auth = { authorization: 'Bearer synthetic-local-portal-token' };
  let cookie;

  await t.test('anonymous and wrong-token reads are rejected before database access', async () => {
    const before = requests.length;
    assert.equal((await call('data')).status, 401);
    assert.equal((await call('data', { headers: { authorization: 'Bearer wrong' } })).status, 401);
    assert.equal(requests.length, before);
  });
  await t.test('method guards and unauthorized write endpoints reject without a database request', async () => {
    const before = requests.length;
    assert.equal((await call('data', { method: 'POST', headers: auth })).status, 405);
    assert.equal((await call('session')).status, 405);
    assert.equal((await call('collect', { method: 'POST' })).status, 401);
    assert.equal((await call('research', { method: 'POST' })).status, 401);
    assert.equal(requests.length, before);
  });
  await t.test('valid shared bearer reads five actual database queries with private no-store response', async () => {
    const before = requests.length;
    const result = await call('data', { headers: auth });
    assert.equal(result.status, 200);
    assert.equal(result.headers.get('cache-control'), 'private, no-store');
    assert.equal(result.headers.get('x-content-type-options'), 'nosniff');
    assert.deepEqual(result.body.keywords.map((row) => row.id), [901]);
    assert.equal(requests.length - before, 5);
    assert.ok(requests.slice(before).every((row) => row.serviceRole));
  });
  await t.test('different supplied identities receive the same fixture and unscoped query set', async () => {
    const records = [];
    for (const tenant of ['company-a', 'company-b']) {
      const before = requests.length;
      const result = await call('data', { headers: { ...auth, 'x-tenant-id': tenant, 'x-user-id': `${tenant}-user` } });
      assert.equal(result.status, 200);
      records.push({ keywords: result.body.keywords, queries: requests.slice(before) });
    }
    assert.deepEqual(records[0], records[1]);
    assert.ok(records[0].queries.every((row) => !row.identityForwarded && !/tenant|company|user/i.test(row.path)));
    console.log('TARGET_GAP shared token grants identical global dataset; synthetic headers are not authenticated membership');
  });
  await t.test('session creates signed seven-day HttpOnly Secure SameSite=Lax cookie accepted without bearer', async () => {
    const result = await call('session', { method: 'POST', headers: auth });
    assert.equal(result.status, 200);
    const header = result.headers.get('set-cookie');
    assert.match(header, /HttpOnly; Secure; SameSite=Lax; Path=\/; Max-Age=604800/);
    cookie = header.split(';')[0];
    assert.equal((await call('data', { headers: { cookie } })).status, 200);
  });
  await t.test('tampered and expired session cookies are rejected before database access', async () => {
    const before = requests.length;
    const tampered = cookie.slice(0, -1) + (cookie.endsWith('A') ? 'B' : 'A');
    assert.equal((await call('data', { headers: { cookie: tampered } })).status, 401);
    const expired = lib.portalSessionCookie(-10).split(';')[0];
    assert.equal((await call('data', { headers: { cookie: expired } })).status, 401);
    assert.equal(requests.length, before);
  });
  await t.test('logout expires client cookie but a previously copied cookie remains accepted', async () => {
    const result = await call('session', { method: 'DELETE', headers: { cookie } });
    assert.equal(result.status, 200);
    assert.match(result.headers.get('set-cookie'), /Max-Age=0/);
    assert.equal((await call('data', { headers: { cookie } })).status, 200);
    console.log('TARGET_GAP copied session survives logout; no per-session or tenant revocation was observed');
  });
  await t.test('rotating the shared token invalidates old bearer and cookie together', async () => {
    process.env.SEO_PORTAL_TOKEN = 'synthetic-rotated-token';
    try {
      assert.equal((await call('data', { headers: auth })).status, 401);
      assert.equal((await call('data', { headers: { cookie } })).status, 401);
    } finally { process.env.SEO_PORTAL_TOKEN = 'synthetic-local-portal-token'; }
  });
  await t.test('required database failure returns 502 and optional research-table failure remains tolerated', async () => {
    failTable = 'seo_keywords';
    assert.equal((await call('data', { headers: auth })).status, 502);
    failTable = 'seo_keyword_research';
    assert.equal((await call('data', { headers: auth })).status, 200);
    failTable = '';
  });
  await t.test('missing service role returns onboarding data and blocks collection without database access', async () => {
    const before = requests.length;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    try {
      const result = await call('data', { headers: auth });
      assert.equal(result.status, 200);
      assert.equal(result.body.onboarding, true);
      assert.equal(result.body.configured.database, false);
      assert.ok(result.body.keywords.length > 0);
      assert.equal((await call('collect', { method: 'POST', headers: auth })).status, 503);
      assert.equal(requests.length, before);
    } finally { process.env.SUPABASE_SERVICE_ROLE_KEY = 'synthetic-local-service-role'; }
  });
  await t.test('research reports absent provider configuration and performs no collection', async () => {
    const before = requests.length;
    const result = await call('research', { method: 'POST', headers: { ...auth, 'content-type': 'application/json' }, body: '{"markets":["AU"]}' });
    assert.equal(result.status, 503);
    assert.equal(result.body.configured.google_ads_keyword_planner, false);
    assert.equal(requests.length, before);
  });
  await t.test('cron authorization differs from portal bearer on GET collector', async () => {
    const before = requests.length;
    assert.equal((await call('collect', { headers: auth })).status, 401);
    assert.equal(requests.length, before);
    const result = await call('collect', { headers: { authorization: 'Bearer synthetic-local-cron-token' } });
    assert.equal(result.status, 200);
    assert.ok(result.body.collectors.every((item) => item.skipped));
    assert.equal(result.body.run.items_succeeded, 0);
    assert.equal(result.body.run.cost_usd, 0);
  });
  await t.test('manual collector sends real watchlist and running/completed run writes to synthetic database', async () => {
    const before = requests.length;
    const result = await call('collect', { method: 'POST', headers: auth });
    assert.equal(result.status, 200);
    const writes = requests.slice(before).filter((row) => row.method === 'POST');
    const watchWrite = writes.find((row) => row.path.startsWith('/rest/v1/seo_keywords?'));
    assert.equal(watchWrite.body.length, lib.watchlist.keywords.length);
    assert.deepEqual(writes.filter((row) => row.path.includes('seo_collection_runs')).map((row) => row.body.status), ['running', 'complete']);
    const records = writes.flatMap((row) => Array.isArray(row.body) ? row.body : [row.body]);
    assert.ok(records.every((record) => !Object.keys(record).some((key) => /tenant|company|user/i.test(key))));
    const dashboard = await call('data', { headers: auth });
    assert.equal(dashboard.status, 200);
    assert.ok(dashboard.body.runs.some((run) => run.id === result.body.run.id));
    console.log('COLLECTOR_WATCHLIST', JSON.stringify({ count: watchWrite.body.length, payloadSha256: sha(watchWrite.body.map(({ updated_at, ...row }) => row)), database: 'synthetic in-memory loopback only' }));
  });
  await t.test('malformed cookie currently produces an uncaught handler error', async () => {
    const before = requests.length;
    const result = await call('data', { headers: { cookie: 'adelphos_seo_session=%ZZ' } });
    assert.equal(result.status, 500);
    assert.equal(result.body.detail, 'URI malformed');
    assert.equal(requests.length, before);
    console.log('EXISTING_DEFECT malformed percent-encoded cookie throws before authentication response');
  });
  console.log('SEO_STORAGE_BASELINE_COMPLETE: 14 current-behavior cases; tenant isolation and revocation NOT PASSED');
});
