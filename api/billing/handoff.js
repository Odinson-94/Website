'use strict';

const { meter, setSessionCookie, cookieValue, openPayload } = require('../_billing-session');

const HANDOFF_COOKIE = 'adelphos_handoff_state';

function safeReturn(value) {
  const result = String(value || '/calculators/');
  return /^\/(?!\/)[^\\\r\n]*$/.test(result) && !/%(?:5c|0d|0a)/i.test(result) ? result : '/calculators/';
}

module.exports = async function handoff(request, response) {
  if (request.method !== 'GET') return response.status(405).json({ error: 'Method not allowed.' });
  const code = String(request.query?.code || '').trim();
  const state = String(request.query?.state || '').trim();
  const pending = openPayload(cookieValue(request, HANDOFF_COOKIE));
  if (!code || !state || !pending || pending.state !== state) return response.status(400).json({ error: 'Secure handoff state is invalid.' });
  try {
    const consumed = await meter({
      action: 'consume_handoff', code, state,
      pkce_verifier: pending.verifier, return_origin: pending.return_origin,
    });
    if (consumed.status !== 200 || !consumed.result?.email) return response.status(401).json({ error: 'Secure handoff is invalid or expired.' });
    setSessionCookie(response, consumed.result);
    const sessionCookie = response.getHeader('Set-Cookie');
    response.setHeader('Set-Cookie', [sessionCookie, `${HANDOFF_COOKIE}=; Path=/api/billing/handoff; Max-Age=0; HttpOnly; Secure; SameSite=Lax`]);
    response.setHeader('Cache-Control', 'no-store');
    response.redirect(303, safeReturn(pending.return_path));
  } catch {
    response.status(503).json({ error: 'Secure sign-in handoff is unavailable.' });
  }
};

module.exports._test = { safeReturn };
