'use strict';

const crypto = require('node:crypto');
const watchlist = require('../../data/seo-keywords.generated.json');
const researchInventory = require('../../data/seo-research.generated.json');
const backlinkSnapshot = require('../../data/seo-backlinks.generated.json');
const internalLinkSnapshot = require('../../data/seo-link-graph.generated.json');
const pageAuditSnapshot = require('../../data/seo-page-audit.generated.json');

const DAY_MS = 86_400_000;
const SUPABASE_URL = String(process.env.SUPABASE_URL || 'https://owebjrorrthysyeodkku.supabase.co').replace(/\/$/, '');

function sendJson(response, status, body) {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'private, no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.end(JSON.stringify(body));
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left || ''));
  const b = Buffer.from(String(right || ''));
  return a.length === b.length && a.length > 0 && crypto.timingSafeEqual(a, b);
}

function bearer(request) {
  return String(request.headers.authorization || '').replace(/^Bearer\s+/i, '');
}

function cookies(request) {
  return String(request.headers.cookie || '').split(';').reduce((values, pair) => {
    const index = pair.indexOf('=');
    if (index < 1) return values;
    values[pair.slice(0, index).trim()] = decodeURIComponent(pair.slice(index + 1).trim());
    return values;
  }, {});
}

function signPortalSession(expiresAt) {
  const payload = Buffer.from(JSON.stringify({ exp: expiresAt })).toString('base64url');
  const signature = crypto.createHmac('sha256', String(process.env.SEO_PORTAL_TOKEN || '')).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

function validPortalSession(request) {
  const [payload, signature] = String(cookies(request).adelphos_seo_session || '').split('.');
  if (!payload || !signature || !process.env.SEO_PORTAL_TOKEN) return false;
  const expected = crypto.createHmac('sha256', process.env.SEO_PORTAL_TOKEN).update(payload).digest('base64url');
  if (!safeEqual(signature, expected)) return false;
  try {
    return Number(JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')).exp) > Date.now();
  } catch {
    return false;
  }
}

function portalSessionCookie(maxAgeSeconds = 604800) {
  const expiresAt = Date.now() + maxAgeSeconds * 1000;
  return `adelphos_seo_session=${signPortalSession(expiresAt)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAgeSeconds}`;
}

function isPortalRequest(request) {
  return safeEqual(bearer(request), process.env.SEO_PORTAL_TOKEN) || validPortalSession(request);
}

function isCollectorRequest(request) {
  if (request.method === 'GET') return safeEqual(bearer(request), process.env.CRON_SECRET);
  return isPortalRequest(request);
}

function serviceKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.ADELPHOS_SUPABASE_SERVICE_ROLE_KEY || '';
}

function configuration() {
  return {
    database: Boolean(serviceKey()),
    google_search_console: Boolean(process.env.GSC_SERVICE_ACCOUNT_JSON && process.env.GSC_PROPERTY),
    dataforseo: Boolean(process.env.DATAFORSEO_LOGIN && process.env.DATAFORSEO_PASSWORD),
    google_ads_keyword_planner: Boolean(process.env.GOOGLE_ADS_DEVELOPER_TOKEN && process.env.GOOGLE_ADS_CUSTOMER_ID && process.env.GSC_SERVICE_ACCOUNT_JSON),
    portal_access: Boolean(process.env.SEO_PORTAL_TOKEN),
    schedule: 'Daily at 03:15 UTC',
    serp_depth: Math.min(100, Math.max(10, Number(process.env.SEO_SERP_DEPTH) || 20)),
    run_limit: Math.min(100, Math.max(1, Number(process.env.SEO_MAX_KEYWORDS_PER_RUN) || 25)),
    research_markets: googleAdsTargets().map(({ country, country_code }) => ({ country, code: country_code })),
  };
}

async function supabase(path, options = {}) {
  const key = serviceKey();
  if (!key) throw new Error('Supabase service-role access is not configured.');
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: 'application/json',
      ...(options.headers || {}),
    },
    signal: options.signal || AbortSignal.timeout(25_000),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`SEO database request failed (${response.status}): ${detail.slice(0, 300)}`);
  }
  if (response.status === 204) return null;
  const body = await response.text();
  return body ? JSON.parse(body) : null;
}

async function upsertWatchlist() {
  const rows = watchlist.keywords.map(({ keyword, location_name, language_code, device, target_url, tag, page_title, source_path, enabled }) => ({
    keyword, location_name, language_code, device, target_url, tag, page_title, source_path, enabled,
    updated_at: new Date().toISOString(),
  }));
  await supabase('seo_keywords?on_conflict=keyword,location_name,device', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(rows),
  });
  const currentKeys = new Set(rows.map((row) => `${row.keyword}\n${row.location_name}\n${row.device}`));
  const enabledRows = await supabase('seo_keywords?select=id,keyword,location_name,device&enabled=eq.true');
  const staleIds = enabledRows.filter((row) => !currentKeys.has(`${row.keyword}\n${row.location_name}\n${row.device}`)).map((row) => row.id);
  if (staleIds.length) {
    await supabase(`seo_keywords?id=in.(${staleIds.join(',')})`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ enabled: false, updated_at: new Date().toISOString() }),
    });
  }
  return supabase('seo_keywords?select=*&enabled=eq.true&order=keyword.asc');
}

function base64url(value) {
  return Buffer.from(value).toString('base64url');
}

async function googleAccessToken(scope = 'https://www.googleapis.com/auth/webmasters.readonly') {
  let account;
  try {
    const raw = process.env.GSC_SERVICE_ACCOUNT_JSON;
    account = JSON.parse(raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8'));
  } catch {
    throw new Error('GSC_SERVICE_ACCOUNT_JSON is not valid JSON or base64-encoded JSON.');
  }
  if (!account.client_email || !account.private_key) throw new Error('The GSC service account is missing client_email or private_key.');
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: account.private_key_id }));
  const claims = base64url(JSON.stringify({
    iss: account.client_email,
    scope,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }));
  const unsigned = `${header}.${claims}`;
  const signature = crypto.sign('RSA-SHA256', Buffer.from(unsigned), account.private_key).toString('base64url');
  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion: `${unsigned}.${signature}`,
  });
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    signal: AbortSignal.timeout(20_000),
  });
  const payload = await response.json();
  if (!response.ok || !payload.access_token) throw new Error(payload.error_description || 'Google authentication failed.');
  return payload.access_token;
}

const GOOGLE_ADS_MARKETS = {
  AU: { country: 'Australia', id: '2036' }, CA: { country: 'Canada', id: '2124' },
  GB: { country: 'United Kingdom', id: '2826' }, IE: { country: 'Ireland', id: '2372' },
  IN: { country: 'India', id: '2356' }, NZ: { country: 'New Zealand', id: '2554' },
  SG: { country: 'Singapore', id: '2702' }, AE: { country: 'United Arab Emirates', id: '2784' },
  US: { country: 'United States', id: '2840' },
};

function googleAdsTargets(requestedCodes = []) {
  const configuredCodes = String(process.env.GOOGLE_ADS_MARKETS || Object.keys(GOOGLE_ADS_MARKETS).join(','))
    .split(',').map((value) => value.trim().toUpperCase()).filter((code) => GOOGLE_ADS_MARKETS[code]);
  const requested = Array.isArray(requestedCodes) ? requestedCodes.map((value) => String(value).toUpperCase()) : [];
  const selected = requested.length ? configuredCodes.filter((code) => requested.includes(code)) : configuredCodes;
  return selected.map((code) => ({ ...GOOGLE_ADS_MARKETS[code], country_code: code }));
}

async function googleAdsRequest(action, body) {
  const accessToken = await googleAccessToken('https://www.googleapis.com/auth/adwords');
  const apiVersion = String(process.env.GOOGLE_ADS_API_VERSION || 'v25').replace(/[^a-zA-Z0-9]/g, '');
  const customerId = String(process.env.GOOGLE_ADS_CUSTOMER_ID || '').replace(/\D/g, '');
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
    'developer-token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
  };
  const managerId = String(process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID || '').replace(/\D/g, '');
  if (managerId) headers['login-customer-id'] = managerId;
  const response = await fetch(`https://googleads.googleapis.com/${apiVersion}/customers/${customerId}:${action}`, {
    method: 'POST', headers, body: JSON.stringify(body), signal: AbortSignal.timeout(55_000),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = (payload.error?.details || []).flatMap((item) => item?.errors || [])[0] || {};
    const errorCode = Object.entries(detail.errorCode || {}).map(([group, code]) => `${group}.${code}`)[0];
    const reasons = [payload.error?.message, errorCode, detail.message].filter(Boolean);
    throw new Error([...new Set(reasons)].join(' · ') || `Google Ads ${action} failed (${response.status}).`);
  }
  return payload;
}

function googleAdsMetricRow(item, target, source) {
  const metrics = item.keywordMetrics || item.keywordIdeaMetrics || {};
  return {
    keyword: String(item.text || '').trim(),
    country_code: target.country_code,
    country: target.country,
    language_code: 'en',
    source,
    monthly_searches: metrics.avgMonthlySearches == null ? null : Number(metrics.avgMonthlySearches),
    competition: metrics.competition || null,
    competition_index: metrics.competitionIndex == null ? null : Number(metrics.competitionIndex),
    low_top_page_bid_micros: metrics.lowTopOfPageBidMicros == null ? null : Number(metrics.lowTopOfPageBidMicros),
    high_top_page_bid_micros: metrics.highTopOfPageBidMicros == null ? null : Number(metrics.highTopOfPageBidMicros),
    monthly_search_volumes: metrics.monthlySearchVolumes || [],
    captured_at: new Date().toISOString(),
  };
}

async function collectKeywordResearch(requestedMarkets = []) {
  if (!configuration().google_ads_keyword_planner) {
    return { provider: 'google_ads_keyword_planner', skipped: true, reason: 'not configured', succeeded: 0 };
  }
  const phrases = [...new Set((researchInventory.keywords || []).map((item) => String(item.keyword || '').trim()).filter(Boolean))];
  const targets = googleAdsTargets(requestedMarkets);
  if (!targets.length) throw new Error('Select at least one supported keyword-research market.');
  const saved = [];
  for (const target of targets) {
    for (let offset = 0; offset < phrases.length; offset += 500) {
      const payload = await googleAdsRequest('generateKeywordHistoricalMetrics', {
        keywords: phrases.slice(offset, offset + 500),
        language: 'languageConstants/1000',
        geoTargetConstants: [`geoTargetConstants/${target.id}`],
        keywordPlanNetwork: 'GOOGLE_SEARCH',
      });
      saved.push(...(payload.results || []).map((item) => googleAdsMetricRow(item, target, 'google_ads_historical')));
    }
    const ideas = await googleAdsRequest('generateKeywordIdeas', {
      language: 'languageConstants/1000',
      geoTargetConstants: [`geoTargetConstants/${target.id}`],
      includeAdultKeywords: false,
      keywordPlanNetwork: 'GOOGLE_SEARCH',
      pageSize: 1000,
      siteSeed: { site: 'https://adelphos.ai' },
    });
    saved.push(...(ideas.results || []).map((item) => googleAdsMetricRow(item, target, 'google_ads_related')));
  }
  const deduped = [...new Map(saved.filter((row) => row.keyword).map((row) => [`${row.keyword.toLowerCase()}\n${row.country_code}`, row])).values()];
  for (let offset = 0; offset < deduped.length; offset += 500) {
    await supabase('seo_keyword_research?on_conflict=keyword,country_code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(deduped.slice(offset, offset + 500)),
    });
  }
  return { provider: 'google_ads_keyword_planner', requested: phrases.length * targets.length, succeeded: deduped.length, cost: 0 };
}

function isoDate(value) {
  return new Date(value).toISOString().slice(0, 10);
}

async function collectGsc() {
  if (!configuration().google_search_console) return { provider: 'gsc', skipped: true, reason: 'not configured' };
  const accessToken = await googleAccessToken();
  const end = new Date();
  const start = new Date(end.getTime() - (89 * DAY_MS));
  const rows = [];
  let startRow = 0;
  do {
    const response = await fetch(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(process.env.GSC_PROPERTY)}/searchAnalytics/query`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        startDate: isoDate(start), endDate: isoDate(end),
        dimensions: ['date', 'query', 'page', 'device', 'country'],
        dataState: 'all', rowLimit: 25000, startRow,
      }),
      signal: AbortSignal.timeout(30_000),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error?.message || `Search Console query failed (${response.status}).`);
    const pageRows = payload.rows || [];
    rows.push(...pageRows);
    startRow += pageRows.length;
    if (pageRows.length < 25000 || rows.length >= 100000) break;
  } while (true);

  const records = rows.map((row) => ({
    row_key: crypto.createHash('sha256').update(row.keys.join('\n')).digest('hex'),
    search_date: row.keys[0], query: row.keys[1], page: row.keys[2] || '',
    device: String(row.keys[3] || '').toLowerCase(), country: row.keys[4] || '',
    clicks: row.clicks || 0, impressions: row.impressions || 0,
    ctr: row.ctr || 0, position: row.position || 0, updated_at: new Date().toISOString(),
  }));
  for (let index = 0; index < records.length; index += 500) {
    await supabase('seo_gsc_daily?on_conflict=row_key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(records.slice(index, index + 500)),
    });
  }
  return { provider: 'gsc', requested: rows.length, succeeded: records.length, cost: 0 };
}

function normalizeDomain(value) {
  return String(value || '').toLowerCase().replace(/^www\./, '');
}

function matchesDomain(value, target) {
  const domain = normalizeDomain(value);
  return domain === target || domain.endsWith(`.${target}`);
}

async function collectRanks(keywords) {
  if (!configuration().dataforseo) return { provider: 'dataforseo', skipped: true, reason: 'not configured' };
  const config = configuration();
  const selected = keywords.slice(0, config.run_limit);
  // A stable daily timestamp makes retries and duplicate cron deliveries idempotent.
  const checkedAt = `${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`;
  const credentials = Buffer.from(`${process.env.DATAFORSEO_LOGIN}:${process.env.DATAFORSEO_PASSWORD}`).toString('base64');
  const tasks = selected.map((item) => ({
    keyword: item.keyword,
    location_name: item.location_name,
    language_code: item.language_code,
    device: item.device,
    os: item.device === 'mobile' ? 'android' : 'windows',
    depth: config.serp_depth,
    tag: String(item.id),
  }));
  const response = await fetch('https://api.dataforseo.com/v3/serp/google/organic/live/advanced', {
    method: 'POST',
    headers: { Authorization: `Basic ${credentials}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(tasks),
    signal: AbortSignal.timeout(55_000),
  });
  const payload = await response.json();
  if (!response.ok || Number(payload.status_code) >= 40000) {
    throw new Error(payload.status_message || `DataForSEO request failed (${response.status}).`);
  }
  const target = normalizeDomain(watchlist.target_domain);
  let totalCost = 0;
  const snapshots = (payload.tasks || []).map((task, index) => {
    totalCost += Number(task.cost) || 0;
    const result = task.result?.[0] || {};
    const organic = (result.items || []).find((item) => item.type === 'organic' && matchesDomain(item.domain, target));
    return {
      keyword_id: selected[index]?.id || Number(task.data?.tag),
      checked_at: checkedAt,
      organic_position: organic?.rank_group ?? null,
      ranking_url: organic?.url ?? null,
      result_type: organic?.type ?? null,
      serp_depth: config.serp_depth,
      result_count: result.items_count ?? (result.items || []).length,
      cost_usd: Number(task.cost) || 0,
    };
  }).filter((row) => row.keyword_id);
  if (snapshots.length) {
    await supabase('seo_rank_snapshots?on_conflict=keyword_id,checked_at', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(snapshots),
    });
  }
  return { provider: 'dataforseo', requested: selected.length, succeeded: snapshots.length, cost: totalCost };
}

function rankScore(position, depth = 20) {
  if (!position || position > depth) return 0;
  return ((depth + 1 - position) / depth) * 100;
}

function samePage(left, right) {
  try {
    const a = new URL(left);
    const b = new URL(right);
    return normalizeDomain(a.hostname) === normalizeDomain(b.hostname)
      && a.pathname.replace(/\/$/, '') === b.pathname.replace(/\/$/, '');
  } catch {
    return null;
  }
}

const COUNTRY_NAMES = {
  are: 'United Arab Emirates', aus: 'Australia', aut: 'Austria', bel: 'Belgium', bra: 'Brazil',
  can: 'Canada', che: 'Switzerland', chn: 'China', deu: 'Germany', dnk: 'Denmark', esp: 'Spain',
  fin: 'Finland', fra: 'France', gbr: 'United Kingdom', hkg: 'Hong Kong', idn: 'Indonesia',
  ind: 'India', irl: 'Ireland', ita: 'Italy', jpn: 'Japan', mys: 'Malaysia', nld: 'Netherlands',
  nor: 'Norway', nzl: 'New Zealand', phl: 'Philippines', pol: 'Poland', prt: 'Portugal',
  sgp: 'Singapore', swe: 'Sweden', tha: 'Thailand', usa: 'United States', vnm: 'Vietnam',
  zaf: 'South Africa',
};

function countryName(value) {
  const code = String(value || '').toLowerCase();
  return COUNTRY_NAMES[code] || (code ? code.toUpperCase() : 'Unknown');
}

function countryBreakdown(search) {
  return [...(search.countries || new Map()).entries()].map(([code, value]) => ({
    code: code.toUpperCase(), country: countryName(code), clicks: value.clicks,
    impressions: value.impressions,
    position: value.impressions ? value.weightedPosition / value.impressions : null,
  })).sort((a, b) => b.impressions - a.impressions);
}

function buildDashboard(keywords, snapshots, gscRows, runs, liveResearch = []) {
  const byKeyword = new Map();
  for (const snapshot of snapshots) {
    const list = byKeyword.get(snapshot.keyword_id) || [];
    list.push(snapshot);
    byKeyword.set(snapshot.keyword_id, list);
  }
  const gscByQuery = new Map();
  for (const row of gscRows) {
    const key = String(row.query).toLowerCase();
    const value = gscByQuery.get(key) || { clicks: 0, impressions: 0, weightedPosition: 0, dates: new Map(), pages: new Map(), countries: new Map() };
    const impressions = Number(row.impressions) || 0;
    value.clicks += Number(row.clicks) || 0;
    value.impressions += impressions;
    value.weightedPosition += (Number(row.position) || 0) * impressions;
    const date = value.dates.get(row.search_date) || { impressions: 0, weightedPosition: 0 };
    date.impressions += impressions;
    date.weightedPosition += (Number(row.position) || 0) * impressions;
    value.dates.set(row.search_date, date);
    value.pages.set(row.page, (value.pages.get(row.page) || 0) + impressions);
    const country = value.countries.get(row.country) || { clicks: 0, impressions: 0, weightedPosition: 0 };
    country.clicks += Number(row.clicks) || 0;
    country.impressions += impressions;
    country.weightedPosition += (Number(row.position) || 0) * impressions;
    value.countries.set(row.country, country);
    gscByQuery.set(key, value);
  }
  const rows = keywords.map((keyword) => {
    const history = (byKeyword.get(keyword.id) || []).sort((a, b) => new Date(b.checked_at) - new Date(a.checked_at));
    const current = history[0] || {};
    const previous = history[1] || {};
    const search = gscByQuery.get(keyword.keyword.toLowerCase()) || { clicks: 0, impressions: 0, weightedPosition: 0, dates: new Map(), pages: new Map(), countries: new Map() };
    const gscDates = [...search.dates.entries()].sort(([left], [right]) => right.localeCompare(left));
    const gscCurrent = gscDates[0]?.[1];
    const gscPrevious = gscDates[1]?.[1];
    const gscCurrentPosition = gscCurrent?.impressions ? gscCurrent.weightedPosition / gscCurrent.impressions : null;
    const gscPreviousPosition = gscPrevious?.impressions ? gscPrevious.weightedPosition / gscPrevious.impressions : null;
    const hasSerpSnapshot = current.organic_position != null;
    const serpPosition = hasSerpSnapshot ? Number(current.organic_position) : null;
    const previousSerpPosition = previous.organic_position == null ? null : Number(previous.organic_position);
    const position = hasSerpSnapshot ? serpPosition : gscCurrentPosition;
    const previousPosition = hasSerpSnapshot ? previousSerpPosition : gscPreviousPosition;
    const gscRankingUrl = [...search.pages.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null;
    const rankingUrl = current.ranking_url || gscRankingUrl;
    const countries = countryBreakdown(search);
    return {
      ...keyword,
      position,
      previous_position: previousPosition,
      movement: position != null && previousPosition != null ? previousPosition - position : null,
      ranking_url: rankingUrl,
      owner_match: rankingUrl ? samePage(rankingUrl, keyword.target_url) : null,
      checked_at: current.checked_at || gscDates[0]?.[0] || null,
      rank_source: hasSerpSnapshot ? 'dataforseo' : (gscCurrentPosition != null ? 'gsc' : null),
      clicks: search.clicks,
      impressions: search.impressions,
      gsc_position: search.impressions ? search.weightedPosition / search.impressions : null,
      country: countries[0]?.country || null,
      country_breakdown: countries,
    };
  });
  const trackedQueries = new Set(rows.map((row) => row.keyword.toLowerCase()));
  const discovered = [...gscByQuery.entries()].filter(([query]) => !trackedQueries.has(query)).map(([query, search]) => {
    const gscDates = [...search.dates.entries()].sort(([left], [right]) => right.localeCompare(left));
    const current = gscDates[0]?.[1];
    const previous = gscDates[1]?.[1];
    const position = current?.impressions ? current.weightedPosition / current.impressions : null;
    const previousPosition = previous?.impressions ? previous.weightedPosition / previous.impressions : null;
    const rankingUrl = [...search.pages.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null;
    const countries = countryBreakdown(search);
    return {
      id: `gsc:${query}`,
      keyword: query,
      location_name: 'Google Search Console',
      language_code: 'en',
      device: 'all',
      target_url: rankingUrl,
      tag: 'gsc-discovered',
      page_title: rankingUrl ? new URL(rankingUrl).pathname : 'Google-discovered query',
      enabled: false,
      position,
      previous_position: previousPosition,
      movement: position != null && previousPosition != null ? previousPosition - position : null,
      ranking_url: rankingUrl,
      owner_match: true,
      checked_at: gscDates[0]?.[0] || null,
      rank_source: 'gsc',
      clicks: search.clicks,
      impressions: search.impressions,
      gsc_position: search.impressions ? search.weightedPosition / search.impressions : null,
      country: countries[0]?.country || null,
      country_breakdown: countries,
    };
  });
  const searches = [...rows.filter((row) => row.impressions > 0), ...discovered]
    .sort((a, b) => b.impressions - a.impressions);
  const depth = configuration().serp_depth;
  const ranked = rows.filter((row) => row.position != null);
  const visible = ranked.filter((row) => row.position <= depth);
  const gscTotals = gscRows.reduce((sum, row) => {
    const impressions = Number(row.impressions) || 0;
    sum.clicks += Number(row.clicks) || 0;
    sum.impressions += impressions;
    sum.weightedPosition += (Number(row.position) || 0) * impressions;
    return sum;
  }, { clicks: 0, impressions: 0, weightedPosition: 0 });
  const countries = aggregateCountries(gscRows);
  const dates = snapshots.length ? rankSnapshotTrend(snapshots, depth) : gscVisibilityTrend(gscRows, keywords, depth);
  const trend = [...dates.values()].sort((a, b) => a.date.localeCompare(b.date)).map((point) => ({
    date: point.date,
    visibility: point.scoreTotal / Math.max(1, point.denominator),
    average_position: point.impressions ? point.weightedPosition / point.impressions : null,
  }));
  return {
    summary: {
      tracked: rows.length,
      visible: visible.length,
      top_10: rows.filter((row) => row.position != null && row.position <= 10).length,
      average_position: ranked.length ? ranked.reduce((sum, row) => sum + row.position, 0) / ranked.length : null,
      visibility: rows.reduce((sum, row) => sum + rankScore(row.position, depth), 0) / Math.max(1, rows.length),
      clicks: gscTotals.clicks,
      impressions: gscTotals.impressions,
      ctr: gscTotals.impressions ? gscTotals.clicks / gscTotals.impressions : 0,
      gsc_position: gscTotals.impressions ? gscTotals.weightedPosition / gscTotals.impressions : null,
      rank_source: snapshots.length ? 'dataforseo' : 'gsc',
      discovered: discovered.length,
    },
    keywords: rows,
    searches,
    countries,
    backlinks: authoritySnapshot(backlinkSnapshot, gscTotals, rows),
    research: buildResearch(researchInventory, rows, searches, liveResearch),
    pages: buildPageAudit(pageAuditSnapshot, gscRows, rows),
    trend,
    gsc_daily: aggregateGscDaily(gscRows),
    runs,
  };
}

function normalizedPageUrl(value) {
  try {
    const url = new URL(String(value || ''), 'https://adelphos.ai');
    return `${url.origin}${url.pathname.replace(/\/$/, '') || '/'}`;
  } catch {
    return String(value || '').replace(/\/$/, '');
  }
}

function buildPageAudit(snapshot, gscRows, trackedKeywords) {
  const performanceByPage = new Map();
  for (const row of gscRows) {
    const pageKey = normalizedPageUrl(row.page);
    const value = performanceByPage.get(pageKey) || { clicks: 0, impressions: 0, weightedPosition: 0, queries: new Map() };
    const impressions = Number(row.impressions) || 0;
    value.clicks += Number(row.clicks) || 0;
    value.impressions += impressions;
    value.weightedPosition += (Number(row.position) || 0) * impressions;
    const query = value.queries.get(row.query) || { query: row.query, clicks: 0, impressions: 0, weightedPosition: 0 };
    query.clicks += Number(row.clicks) || 0;
    query.impressions += impressions;
    query.weightedPosition += (Number(row.position) || 0) * impressions;
    value.queries.set(row.query, query);
    performanceByPage.set(pageKey, value);
  }
  const trackedByPage = new Map();
  for (const keyword of trackedKeywords) {
    const pageKey = normalizedPageUrl(keyword.target_url);
    const values = trackedByPage.get(pageKey) || [];
    values.push(keyword);
    trackedByPage.set(pageKey, values);
  }
  const pages = (snapshot.pages || []).map((page) => {
    const key = normalizedPageUrl(page.target_url);
    const performance = performanceByPage.get(key) || { clicks: 0, impressions: 0, weightedPosition: 0, queries: new Map() };
    const tracked = trackedByPage.get(key) || [];
    const topQueries = [...performance.queries.values()].map((query) => ({
      ...query,
      position: query.impressions ? query.weightedPosition / query.impressions : null,
    })).sort((left, right) => right.impressions - left.impressions).slice(0, 5);
    const position = performance.impressions ? performance.weightedPosition / performance.impressions : null;
    const rankPositions = tracked.map((keyword) => keyword.position).filter((value) => value != null);
    const bestTrackedPosition = rankPositions.length ? Math.min(...rankPositions) : null;
    const critical = (page.issues || []).filter((issue) => issue.severity === 'critical').length;
    const status = performance.impressions > 0 ? 'Visible in Google'
      : bestTrackedPosition != null ? 'Rank observed'
        : 'Awaiting first impression';
    const opportunity = position != null && position > 7 && position <= 30 ? 'Striking distance'
      : performance.impressions === 0 ? 'Build relevance and authority'
        : page.score < 85 ? 'Fix on-page foundations'
          : 'Defend and improve CTR';
    return {
      ...page,
      clicks: performance.clicks,
      impressions: performance.impressions,
      ctr: performance.impressions ? performance.clicks / performance.impressions : 0,
      gsc_position: position,
      best_tracked_position: bestTrackedPosition,
      ranking_queries: topQueries,
      tracked_keyword_count: tracked.length,
      status,
      opportunity,
      campaign_priority: critical > 0 || (position != null && position <= 20) ? 'High' : (performance.impressions > 0 || page.score < 85 ? 'Medium' : 'Build'),
    };
  }).sort((left, right) => {
    const priority = { High: 0, Medium: 1, Build: 2 };
    return priority[left.campaign_priority] - priority[right.campaign_priority]
      || right.impressions - left.impressions
      || left.score - right.score;
  });
  return {
    generated_at: snapshot.generated_at,
    source: snapshot.source,
    counts: {
      ...snapshot.counts,
      visible: pages.filter((page) => page.impressions > 0).length,
      awaiting_impression: pages.filter((page) => page.impressions === 0).length,
      high_priority: pages.filter((page) => page.campaign_priority === 'High').length,
    },
    pages,
  };
}

function aggregateCountries(rows) {
  const values = new Map();
  for (const row of rows) {
    const impressions = Number(row.impressions) || 0;
    const value = values.get(row.country) || { code: String(row.country || '').toUpperCase(), country: countryName(row.country), clicks: 0, impressions: 0, weightedPosition: 0 };
    value.clicks += Number(row.clicks) || 0;
    value.impressions += impressions;
    value.weightedPosition += (Number(row.position) || 0) * impressions;
    values.set(row.country, value);
  }
  return [...values.values()].map((value) => ({
    code: value.code, country: value.country, clicks: value.clicks, impressions: value.impressions,
    position: value.impressions ? value.weightedPosition / value.impressions : null,
  })).sort((a, b) => b.impressions - a.impressions);
}

function authoritySnapshot(snapshot, gscTotals, keywords) {
  const domains = Number(snapshot.referring_domains) || 0;
  const links = Number(snapshot.external_links) || 0;
  const impressions = Number(gscTotals.impressions) || 0;
  const topTen = keywords.filter((item) => item.position != null && item.position <= 10).length;
  const linkBreadth = Math.min(40, (Math.log10(domains + 1) / Math.log10(101)) * 40);
  const linkVolume = Math.min(20, (Math.log10(links + 1) / Math.log10(10001)) * 20);
  const organicProof = Math.min(25, (Math.log10(impressions + 1) / Math.log10(100001)) * 25);
  const rankingProof = Math.min(15, (topTen / Math.max(1, keywords.length)) * 150);
  return {
    ...snapshot,
    internal_links: internalLinkSnapshot.unique_internal_edges,
    internal_link_occurrences: internalLinkSnapshot.internal_link_occurrences,
    internal_link_targets: internalLinkSnapshot.unique_internal_targets,
    internal_link_pages_crawled: internalLinkSnapshot.crawled_pages,
    internal_link_pages_listed: internalLinkSnapshot.sitemap_urls,
    internal_link_failed_pages: internalLinkSnapshot.failed_pages,
    internal_link_captured_at: internalLinkSnapshot.captured_at,
    internal_link_source: internalLinkSnapshot.source,
    internal_link_scope: internalLinkSnapshot.source_scope,
    gsc_reported_internal_links: snapshot.internal_links,
    authority_score: Math.round((linkBreadth + linkVolume + organicProof + rankingProof) * 10) / 10,
    authority_label: 'Adelphos Authority Score',
    authority_method: '0-100 logarithmic score using referring-domain breadth (40%), external-link volume (20%), Google impressions (25%) and top-10 tracked coverage (15%). This is not Moz Domain Authority.',
  };
}

function buildResearch(inventory, keywords, searches, liveResearch = []) {
  const performance = new Map([...keywords, ...searches].map((item) => [item.keyword.toLowerCase(), item]));
  const live = new Map(liveResearch.map((item) => [`${String(item.keyword).toLowerCase()}\n${item.country}`, item]));
  const inventoryKeys = new Set((inventory.keywords || []).map((item) => `${String(item.keyword).toLowerCase()}\n${item.country}`));
  const rows = (inventory.keywords || []).map((item) => {
    const current = performance.get(item.keyword.toLowerCase());
    const metric = live.get(`${item.keyword.toLowerCase()}\n${item.country}`);
    const position = current?.position ?? null;
    const rankOpportunity = position == null ? 0 : position <= 3 ? 0 : position <= 10 ? 4 : position <= 20 ? 12 : 8;
    const demandOpportunity = metric?.monthly_searches == null ? null
      : Math.min(70, Math.log10(Number(metric.monthly_searches) + 1) * 18)
        + Math.max(0, 20 - ((Number(metric.competition_index) || 0) / 5));
    const baseOpportunity = item.opportunity_score ?? demandOpportunity;
    return {
      ...item,
      monthly_searches: metric?.monthly_searches ?? item.monthly_searches,
      competition: metric?.competition ?? null,
      competition_index: metric?.competition_index ?? item.difficulty ?? null,
      volume_source: metric ? 'Google Ads Keyword Planner' : item.volume_source,
      volume_captured_at: metric?.captured_at || item.volume_captured_at || null,
      current_position: position,
      movement: current?.movement ?? null,
      clicks: current?.clicks || 0,
      impressions: current?.impressions || 0,
      ranking_url: current?.ranking_url || current?.target_url || null,
      top_country: current?.country || null,
      opportunity_score: baseOpportunity == null ? null : Math.min(100, Math.round((baseOpportunity + rankOpportunity) * 10) / 10),
    };
  });
  for (const item of liveResearch) {
    const key = `${String(item.keyword).toLowerCase()}\n${item.country}`;
    if (inventoryKeys.has(key)) continue;
    const current = performance.get(String(item.keyword).toLowerCase());
    rows.push({
      keyword: item.keyword, country: item.country, cluster: 'Google-related idea', sources: ['Google Ads Keyword Planner'],
      monthly_searches: item.monthly_searches, difficulty: null, competition: item.competition,
      competition_index: item.competition_index, current_position: current?.position ?? null,
      movement: current?.movement ?? null, clicks: current?.clicks || 0, impressions: current?.impressions || 0,
      ranking_url: current?.ranking_url || null, top_country: current?.country || null,
      opportunity_score: item.monthly_searches == null ? null : Math.min(100, Math.round(Math.log10(item.monthly_searches + 1) * 18)),
      status: 'Related idea', volume_source: 'Google Ads Keyword Planner', volume_captured_at: item.captured_at,
    });
  }
  return {
    ...inventory,
    counts: {
      ...inventory.counts, keywords: rows.length,
      with_monthly_volume: rows.filter((item) => item.monthly_searches != null).length,
      ranked: rows.filter((item) => item.current_position != null).length,
      countries: new Set(rows.map((item) => item.country).filter(Boolean)).size,
    },
    keywords: rows.sort((a, b) => (b.opportunity_score || -1) - (a.opportunity_score || -1) || (b.monthly_searches || -1) - (a.monthly_searches || -1)),
  };
}

function rankSnapshotTrend(snapshots, depth) {
  const dates = new Map();
  for (const snapshot of snapshots) {
    const day = String(snapshot.checked_at).slice(0, 10);
    const point = dates.get(day) || { date: day, scoreTotal: 0, denominator: 0, impressions: 0, weightedPosition: 0 };
    const position = snapshot.organic_position == null ? null : Number(snapshot.organic_position);
    point.scoreTotal += rankScore(position, depth);
    point.denominator += 1;
    if (position != null) {
      point.impressions += 1;
      point.weightedPosition += position;
    }
    dates.set(day, point);
  }
  return dates;
}

function gscVisibilityTrend(gscRows, keywords, depth) {
  const tracked = new Set(keywords.map((keyword) => keyword.keyword.toLowerCase()));
  const grouped = new Map();
  for (const row of gscRows) {
    const query = String(row.query).toLowerCase();
    if (!tracked.has(query)) continue;
    const key = `${row.search_date}\n${query}`;
    const impressions = Number(row.impressions) || 0;
    const value = grouped.get(key) || { date: row.search_date, query, impressions: 0, weightedPosition: 0 };
    value.impressions += impressions;
    value.weightedPosition += (Number(row.position) || 0) * impressions;
    grouped.set(key, value);
  }
  const dates = new Map();
  for (const value of grouped.values()) {
    const point = dates.get(value.date) || {
      date: value.date, scoreTotal: 0, denominator: keywords.length, impressions: 0, weightedPosition: 0,
    };
    const position = value.impressions ? value.weightedPosition / value.impressions : null;
    point.scoreTotal += rankScore(position, depth);
    point.impressions += value.impressions;
    point.weightedPosition += value.weightedPosition;
    dates.set(value.date, point);
  }
  return dates;
}

function aggregateGscDaily(rows) {
  const dates = new Map();
  for (const row of rows) {
    const point = dates.get(row.search_date) || { date: row.search_date, clicks: 0, impressions: 0, weightedPosition: 0 };
    const impressions = Number(row.impressions) || 0;
    point.clicks += Number(row.clicks) || 0;
    point.impressions += impressions;
    point.weightedPosition += (Number(row.position) || 0) * impressions;
    dates.set(row.search_date, point);
  }
  return [...dates.values()].sort((a, b) => a.date.localeCompare(b.date)).map((point) => ({
    date: point.date, clicks: point.clicks, impressions: point.impressions,
    position: point.impressions ? point.weightedPosition / point.impressions : null,
  }));
}

module.exports = {
  buildDashboard, collectGsc, collectKeywordResearch, collectRanks, configuration, isCollectorRequest,
  isPortalRequest, portalSessionCookie, sendJson, supabase, upsertWatchlist, watchlist,
};
