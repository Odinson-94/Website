/* Verifies a returned Stripe Checkout Session before the website shows success. */
'use strict';

function sendJson(response, status, body) {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'private, no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.end(JSON.stringify(body));
}

function sessionIdFrom(request) {
  const parsed = new URL(request.url || '/', 'https://adelphos.ai');
  return String(parsed.searchParams.get('session_id') || '');
}

async function retrieveSession(sessionId) {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) throw new Error('Stripe Checkout is not configured.');
  const stripeResponse = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, {
    headers: { 'Authorization': `Bearer ${secret}`, 'Accept': 'application/json' },
  });
  const payload = await stripeResponse.json().catch(() => ({}));
  if (!stripeResponse.ok) throw new Error(payload?.error?.message || 'Stripe could not verify the checkout session.');
  return payload;
}

async function handler(request, response) {
  if (request.method !== 'GET') return sendJson(response, 405, { ok: false, detail: 'Method not allowed.' });
  const sessionId = sessionIdFrom(request);
  if (!/^cs_(?:test_|live_)?[A-Za-z0-9]+$/.test(sessionId)) {
    return sendJson(response, 400, { ok: false, detail: 'Checkout session reference is invalid.' });
  }
  try {
    const session = await retrieveSession(sessionId);
    const confirmed = session.status === 'complete' && ['paid', 'no_payment_required'].includes(session.payment_status);
    return sendJson(response, 200, {
      ok: true,
      confirmed,
      mode: session.mode === 'payment' ? 'payment' : 'subscription',
      status: session.status,
      paymentStatus: session.payment_status,
      planCode: String(session.metadata?.plan_code || ''),
    });
  } catch (error) {
    const configurationError = /not configured/i.test(error.message);
    return sendJson(response, configurationError ? 503 : 502, { ok: false, detail: error.message });
  }
}

module.exports = handler;
module.exports._test = { sessionIdFrom, retrieveSession };
