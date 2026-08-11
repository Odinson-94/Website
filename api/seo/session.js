'use strict';

const { isPortalRequest, portalSessionCookie, sendJson } = require('./_lib');

module.exports = function handler(request, response) {
  if (request.method === 'DELETE') {
    response.setHeader('Set-Cookie', 'adelphos_seo_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0');
    return sendJson(response, 200, { ok: true });
  }
  if (request.method !== 'POST') return sendJson(response, 405, { ok: false, detail: 'Method not allowed.' });
  if (!isPortalRequest(request)) return sendJson(response, 401, { ok: false, detail: 'The portal token is invalid.' });
  response.setHeader('Set-Cookie', portalSessionCookie());
  return sendJson(response, 200, { ok: true });
};
