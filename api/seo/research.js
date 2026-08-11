'use strict';

const {
  collectKeywordResearch, configuration, isPortalRequest, sendJson,
} = require('./_lib');

async function handler(request, response) {
  if (request.method !== 'POST') return sendJson(response, 405, { ok: false, detail: 'Method not allowed.' });
  if (!isPortalRequest(request)) return sendJson(response, 401, { ok: false, detail: 'Enter the SEO portal access token.' });
  const configured = configuration();
  if (!configured.google_ads_keyword_planner) {
    return sendJson(response, 503, {
      ok: false,
      detail: 'Google Ads Keyword Planner is not connected yet. Add the developer token and customer ID; the existing Google service account is reused.',
      configured,
    });
  }
  try {
    const rawBody = typeof request.body === 'string' ? JSON.parse(request.body || '{}') : (request.body || {});
    const markets = Array.isArray(rawBody.markets) ? rawBody.markets.slice(0, 9) : [];
    const result = await collectKeywordResearch(markets);
    return sendJson(response, 200, { ok: true, result, configured });
  } catch (error) {
    return sendJson(response, 502, { ok: false, detail: error.message, configured });
  }
}

module.exports = handler;
module.exports.config = { maxDuration: 60 };
