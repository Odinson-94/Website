'use strict';

const crypto = require('node:crypto');
const { sealPayload } = require('../_billing-session');

const HANDOFF_COOKIE = 'adelphos_handoff_state';

function safeReturn(value) {
  const result = String(value || '/calculators/');
  return /^\/(?!\/)[^\\\r\n]*$/.test(result) && !/%(?:5c|0d|0a)/i.test(result) ? result : '/calculators/';
}

module.exports = function handoffStart(request, response) {
  if (request.method !== 'GET') return response.status(405).json({ error: 'Method not allowed.' });
  try {
    const siteOrigin = new URL(process.env.ADELPHOS_SITE_URL || 'https://adelphos.ai').origin;
    const state = crypto.randomBytes(32).toString('base64url');
    const verifier = crypto.randomBytes(32).toString('base64url');
    const challenge = crypto.createHash('sha256').update(verifier).digest('hex');
    const returnPath = safeReturn(request.query?.return);
    const cookie = sealPayload({ state, verifier, return_path: returnPath, return_origin: siteOrigin }, 15 * 60);
    response.setHeader('Set-Cookie', `${HANDOFF_COOKIE}=${encodeURIComponent(cookie)}; Path=/api/billing/handoff; Max-Age=900; HttpOnly; Secure; SameSite=Lax`);
    const chatOrigin = new URL(process.env.ADELPHOS_CHAT_URL || 'https://chat.adelphos.ai').origin;
    const handoff = new URL('/account/website-handoff', chatOrigin);
    handoff.searchParams.set('return_url', `${siteOrigin}/api/billing/handoff`);
    handoff.searchParams.set('state', state);
    handoff.searchParams.set('code_challenge', challenge);
    const chat = new URL('/login', chatOrigin);
    chat.searchParams.set('redirect_to', `${handoff.pathname}${handoff.search}`);
    response.setHeader('Cache-Control', 'no-store');
    return response.redirect(303, chat.toString());
  } catch {
    return response.status(503).json({ error: 'Secure sign-in handoff is unavailable.' });
  }
};

module.exports._test = { HANDOFF_COOKIE, safeReturn };
