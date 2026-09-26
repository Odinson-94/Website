/* Authenticated bridge to the canonical Stripe Checkout function. */
'use strict';

const { session } = require('../_billing-session');

const PURCHASE_CODES = new Set(['everyday', 'standard', 'business', 'payg-20']);

function sendJson(response, status, body) {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'private, no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.end(JSON.stringify(body));
}

function allowedOrigins() {
  return new Set(String(process.env.ADELPHOS_CHECKOUT_ORIGINS || 'https://adelphos.ai,https://www.adelphos.ai')
    .split(',').map((value) => value.trim()).filter(Boolean));
}

function validOrigin(request) {
  const origin = String(request.headers.origin || '');
  return !origin || allowedOrigins().has(origin);
}

module.exports = async function checkout(request, response) {
  if (request.method !== 'POST') return sendJson(response, 405, { error: 'Method not allowed.' });
  if (!validOrigin(request)) return sendJson(response, 403, { error: 'Checkout origin is not allowed.' });
  const account = session(request);
  if (!account) return sendJson(response, 401, { error: 'Sign in to Adelphos before checkout.' });
  const planCode = String(request.body?.plan_code || '').trim().toLowerCase();
  if (!PURCHASE_CODES.has(planCode)) return sendJson(response, 400, { error: 'Choose an available Adelphos plan.' });

  const base = String(process.env.ADELPHOS_BILLING_FUNCTIONS_URL || '').replace(/\/$/, '');
  const token = process.env.ADELPHOS_BILLING_BRIDGE_TOKEN;
  if (!base || !token) return sendJson(response, 503, { error: 'Checkout is not configured.' });
  try {
    const upstream = await fetch(`${base}/stripe-checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        plan_code: planCode,
        identity_email: account.email,
        identity_user_id: account.user_id,
        identity_tenant_id: account.tenant_id,
      }),
      signal: AbortSignal.timeout(20_000),
    });
    const result = await upstream.json().catch(() => ({}));
    return sendJson(response, upstream.status, result);
  } catch {
    return sendJson(response, 503, { error: 'Checkout is temporarily unavailable.' });
  }
};

module.exports._test = { validOrigin, PURCHASE_CODES };
