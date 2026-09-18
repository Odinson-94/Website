'use strict';

const crypto = require('node:crypto');

const COOKIE_NAME = 'adelphos_usage_session';
const SESSION_SECONDS = 60 * 60;

function secret() {
  const value = process.env.ADELPHOS_CALCULATOR_SESSION_SECRET;
  if (!value || value.length < 32) throw new Error('Calculator session signing is not configured.');
  return crypto.createHash('sha256').update(value).digest();
}

function sealPayload(identity, lifetimeSeconds = SESSION_SECONDS) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', secret(), iv);
  const payload = Buffer.from(JSON.stringify({ ...identity, exp: Math.floor(Date.now() / 1000) + lifetimeSeconds }));
  const encrypted = Buffer.concat([cipher.update(payload), cipher.final()]);
  return ['v1', iv.toString('base64url'), encrypted.toString('base64url'), cipher.getAuthTag().toString('base64url')].join('.');
}

function openPayload(value) {
  const [version, iv, encrypted, tag] = String(value || '').split('.');
  if (version !== 'v1' || !iv || !encrypted || !tag) return null;
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', secret(), Buffer.from(iv, 'base64url'));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    const payload = JSON.parse(Buffer.concat([decipher.update(Buffer.from(encrypted, 'base64url')), decipher.final()]).toString('utf8'));
    if (payload.exp <= Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

function seal(identity) { return sealPayload(identity); }
function open(value) {
  const payload = openPayload(value);
  return payload?.email && payload?.user_id && payload?.tenant_id ? payload : null;
}

function cookieValue(request, name) {
  const cookies = String(request.headers?.cookie || '').split(';');
  const match = cookies.map((item) => item.trim()).find((item) => item.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : '';
}

function session(request) {
  return open(cookieValue(request, COOKIE_NAME));
}

function setSessionCookie(response, identity) {
  response.setHeader('Set-Cookie', `${COOKIE_NAME}=${encodeURIComponent(seal(identity))}; Path=/; Max-Age=${SESSION_SECONDS}; HttpOnly; Secure; SameSite=Lax`);
}

async function meter(body) {
  const base = String(process.env.ADELPHOS_BILLING_FUNCTIONS_URL || '').replace(/\/$/, '');
  const token = process.env.ADELPHOS_METERING_SERVICE_TOKEN;
  if (!base || !token) throw new Error('Usage Credit service is not configured.');
  const response = await fetch(`${base}/credit-meter`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  const result = await response.json().catch(() => ({}));
  return { status: response.status, result };
}

module.exports = { COOKIE_NAME, meter, seal, open, sealPayload, openPayload, cookieValue, session, setSessionCookie };
