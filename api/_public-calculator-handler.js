/* Server-only public calculator bridge for the static Adelphos website. */
'use strict';

const crypto = require('node:crypto');
const config = require('../data/public-calculator-config.json');
const sapFormSchema = require('../data/sap-public-form-schema.json');

// The controlled SAP form permits up to 930 bounded schedule rows.  A complete
// valid assessment and its opaque PDF state can exceed 64 KiB, so keep a
// server-enforced ceiling without rejecting inputs the published form allows.
const MAX_BODY_BYTES = 1024 * 1024;
const TOKEN_TTL_SECONDS = 5 * 60;
const UPSTREAM_TIMEOUT_MS = 120 * 1000;
const RATE_WINDOW_MS = 60 * 1000;
const RATE_LIMIT = 15;
const rateWindows = new Map();
const usedReportTokens = new Map();
const PRIVATE_RESULT_KEYS = /^(?:export_request|inline_tool_result|steps?|debug|trace|formula|equation|method|calculation_method|calculation_basis|algorithm|expression|derivation|working|coefficients?|constants?|rules?|lookup|tables?|table_data|data_tables?|database|dataset|source_data|reference_data|standards_data|curves?|raw|internal|source_code)$/i;
const PRIVATE_RESULT_TEXT = /(?:\bformula\b|\bequation\b|\blookup table\b|\bcoefficient(?:s| dataset)?\b|\bdatabase query\b|\bselect\b[\s\S]*\bfrom\b|[A-Za-z_][A-Za-z0-9_]*\s*=\s*[^,;]+(?:[*/^]|[A-Za-z_]+\s*\())/i;
const calculators = new Map(config.calculators.map((calculator) => [calculator.id, calculator.id === 'calc-sap'
  ? { ...calculator, fields: sapFormSchema.fields, sections: sapFormSchema.sections, sectioned: true }
  : calculator]));
const ZONE_MODE_TO_TOOL = Object.freeze({
  heat_loss: 'calc_zone_heat_loss_per_room',
  ventilation: 'calc_zone_ventilation_per_room',
  small_power: 'calc_zone_small_power_per_room',
});

class CalculatorHttpError extends Error {
  constructor(statusCode, message, reason) {
    super(message);
    this.statusCode = statusCode;
    this.reason = reason;
  }
}

function sendJson(response, status, body) {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'private, no-store');
  response.end(JSON.stringify(body));
}

function safeFilename(value, fallback) {
  const cleaned = String(value || '').replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  return cleaned.toLowerCase().endsWith('.pdf') ? cleaned : fallback;
}

function publicCalculationResult(value, depth = 0) {
  if (depth > 8) return '[nested result]';
  if (Array.isArray(value)) return value.slice(0, 250).map((item) => publicCalculationResult(item, depth + 1));
  if (typeof value === 'string' && PRIVATE_RESULT_TEXT.test(value)) return '[protected engine detail]';
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !PRIVATE_RESULT_KEYS.test(key))
    .map(([key, item]) => [key, publicCalculationResult(item, depth + 1)]));
}

function base64url(value) {
  return Buffer.from(value).toString('base64url');
}

function sign(payload, secret) {
  const key = crypto.createHash('sha256').update(secret).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()]);
  return `v1.${base64url(iv)}.${base64url(encrypted)}.${base64url(cipher.getAuthTag())}`;
}

function verify(token, secret) {
  const [version, ivValue, encryptedValue, tagValue] = String(token || '').split('.');
  if (version !== 'v1' || !ivValue || !encryptedValue || !tagValue) throw new Error('The report token is invalid.');
  let payload;
  try {
    const key = crypto.createHash('sha256').update(secret).digest();
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivValue, 'base64url'));
    decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));
    const decrypted = Buffer.concat([decipher.update(Buffer.from(encryptedValue, 'base64url')), decipher.final()]);
    payload = JSON.parse(decrypted.toString('utf8'));
  } catch {
    throw new Error('The report token is invalid.');
  }
  if (!Number.isFinite(payload.exp) || payload.exp < Math.floor(Date.now() / 1000)) throw new Error('The report token has expired.');
  return payload;
}

function leafPaths(value, prefix = '', output = []) {
  if (Array.isArray(value)) {
    if (!value.length && prefix) output.push(prefix);
    value.forEach((item, index) => leafPaths(item, `${prefix}.${index}`.replace(/^\./, ''), output));
  } else if (value && typeof value === 'object') {
    const entries = Object.entries(value);
    if (!entries.length && prefix) output.push(prefix);
    entries.forEach(([key, item]) => leafPaths(item, `${prefix}.${key}`.replace(/^\./, ''), output));
  } else {
    output.push(prefix);
  }
  return output;
}

function getPath(value, fieldPath) {
  return fieldPath.split('.').reduce((current, part) => current == null ? undefined : current[part], value);
}

function activeField(field, selectedMode, values) {
  const modeActive = !Array.isArray(field.modes) || field.modes.includes(selectedMode);
  const dependencyActive = !field.dependsOn || (field.dependsOn.values || []).some(
    (value) => String(value) === String(getPath(values, field.dependsOn.path)),
  );
  return modeActive && dependencyActive;
}

function isMissing(value) {
  return value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
}

function validateScalarField(field, value, label) {
  if (field.required && isMissing(value)) throw new Error(`${label} is required.`);
  if (isMissing(value)) return;
  if (field.type === 'empty-array') {
    if (!Array.isArray(value) || value.length !== 0) throw new Error(`${label} must be the explicitly confirmed empty list.`);
    return;
  }
  if (field.type === 'number' || ['number', 'integer'].includes(field.valueType)) {
    if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${label} must be a finite number.`);
    if (field.valueType === 'integer' && !Number.isInteger(value)) throw new Error(`${label} must be a whole number.`);
    if (field.min !== undefined && value < field.min) throw new Error(`${label} is below its permitted minimum.`);
    if (field.max !== undefined && value > field.max) throw new Error(`${label} is above its permitted maximum.`);
  } else if (field.valueType === 'boolean') {
    if (typeof value !== 'boolean') throw new Error(`${label} must be true or false.`);
  } else if (field.type === 'text') {
    if (typeof value !== 'string') throw new Error(`${label} must be text.`);
    if (field.maxLength !== undefined && value.length > field.maxLength) throw new Error(`${label} is too long.`);
  } else if (field.type === 'date') {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`${label} must be a date in YYYY-MM-DD format.`);
  }
  if (field.type === 'select' && !field.options.some((option) => option.value === value)) throw new Error(`${label} is not an allowed option.`);
}

function validateRepeaterField(field, value) {
  if (field.required && isMissing(value)) throw new Error(`${field.label} is required.`);
  if (isMissing(value)) return;
  if (!Array.isArray(value)) throw new Error(`${field.label} must be a list.`);
  if (field.minItems !== undefined && value.length < field.minItems) throw new Error(`${field.label} has too few entries.`);
  if (field.maxItems !== undefined && value.length > field.maxItems) throw new Error(`${field.label} has too many entries.`);
  const itemFields = field.itemFields || [];
  value.forEach((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error(`${field.label} entry ${index + 1} must be an object.`);
    for (const suppliedPath of leafPaths(item)) {
      if (!itemFields.some((itemField) => itemFieldAllowsPath(itemField, suppliedPath))) {
        throw new Error(`Unexpected calculator input: ${field.path}.${index}.${suppliedPath}.`);
      }
    }
    itemFields.filter((itemField) => activeField(itemField, undefined, item)).forEach((itemField) => {
      const itemValue = getPath(item, itemField.path);
      if (itemField.type === 'repeater') validateRepeaterField(itemField, itemValue);
      else validateScalarField(itemField, itemValue, `${field.label} entry ${index + 1} ${itemField.label}`);
    });
  });
}

function itemFieldAllowsPath(field, suppliedPath) {
  if (field.type !== 'repeater') return field.path === suppliedPath;
  if (field.path === suppliedPath) return true;
  const match = suppliedPath.match(new RegExp(`^${field.path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.(\\d+)\\.(.+)$`));
  return Boolean(match && (field.itemFields || []).some((itemField) => itemFieldAllowsPath(itemField, match[2])));
}

function fieldAllowsPath(field, suppliedPath) {
  if (field.type !== 'repeater') return field.path === suppliedPath;
  if (field.path === suppliedPath) return true;
  const match = suppliedPath.match(new RegExp(`^${field.path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.(\\d+)\\.(.+)$`));
  return Boolean(match && (field.itemFields || []).some((itemField) => itemFieldAllowsPath(itemField, match[2])));
}

function validateInputs(calculator, inputs) {
  if (!inputs || typeof inputs !== 'object' || Array.isArray(inputs)) throw new Error('Inputs must be a JSON object.');
  const selectedMode = calculator.modeField ? getPath(inputs, calculator.modeField) : undefined;
  const fields = calculator.fields;
  for (const suppliedPath of leafPaths(inputs)) {
    const allowed = fields.some((field) => {
      if (!activeField(field, selectedMode, inputs)) return false;
      return fieldAllowsPath(field, suppliedPath);
    });
    if (!allowed) {
      throw new Error(`Unexpected calculator input: ${suppliedPath}.`);
    }
  }
  for (const field of fields.filter((item) => activeField(item, selectedMode, inputs))) {
    const value = getPath(inputs, field.path);
    if (field.type === 'repeater') validateRepeaterField(field, value);
    else validateScalarField(field, value, field.label);
  }
}

function validateBody(body, action) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('The request body must be a JSON object.');
  const allowed = action === 'calculate' ? new Set(['inputs']) : new Set(['calculationToken']);
  for (const key of Object.keys(body)) if (!allowed.has(key)) throw new Error(`Unexpected request property: ${key}.`);
}

function resolveCanonicalTool(calculator, inputs) {
  if (calculator.id !== 'calc-zone') return calculator.canonicalTool;
  const selectedMode = getPath(inputs, calculator.modeField);
  const tool = ZONE_MODE_TO_TOOL[selectedMode];
  if (!tool) throw new Error('Calculation mode is required and must be an allowed option.');
  return tool;
}

function canonicalInputs(calculator, inputs) {
  const clean = structuredClone(inputs);
  for (const field of calculator.fields.filter((item) => item.submit === false)) deletePath(clean, field.path);
  if (calculator.id === 'calc-zone') {
    delete clean[calculator.modeField];
    const fabricByRoom = {};
    for (const room of clean.rooms || []) {
      if (Array.isArray(room.fabric) && room.fabric.length) fabricByRoom[room.room_ref] = room.fabric;
      delete room.fabric;
    }
    if (Object.keys(fabricByRoom).length) clean.fabric_overrides_by_room = fabricByRoom;
    if (Array.isArray(clean.ventilation_overrides)) {
      clean.overrides = {};
      for (const item of clean.ventilation_overrides) {
        clean.overrides[item.category] ||= {};
        clean.overrides[item.category][item.room_type] = item.ach;
      }
      delete clean.ventilation_overrides;
    }
  }
  return clean;
}

function deletePath(target, fieldPath) {
  const parts = fieldPath.split('.');
  const key = parts.pop();
  const parent = parts.reduce((value, part) => value == null ? undefined : value[part], target);
  if (parent && key !== undefined) delete parent[key];
}

function calculatorAllowsTool(calculator, tool) {
  return calculator.id === 'calc-zone'
    ? Object.values(ZONE_MODE_TO_TOOL).includes(tool)
    : calculator.canonicalTool === tool;
}

function memoryRateLimit(request) {
  const key = String(request.headers['x-forwarded-for'] || request.socket?.remoteAddress || 'unknown').split(',')[0].trim();
  const now = Date.now();
  const current = rateWindows.get(key);
  if (!current || current.resetAt <= now) {
    rateWindows.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  current.count += 1;
  return current.count > RATE_LIMIT;
}

async function supabaseRpc(settings, functionName, body) {
  const response = await fetch(`${settings.supabaseUrl.replace(/\/$/, '')}/rest/v1/rpc/${functionName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'apikey': settings.supabaseServiceKey,
      'Authorization': `Bearer ${settings.supabaseServiceKey}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10 * 1000),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`The calculator runtime guard failed (${response.status}).`);
  return result;
}

async function rateLimit(request, settings) {
  if (settings.guardMode === 'memory') return memoryRateLimit(request);
  const address = String(request.headers['x-forwarded-for'] || request.socket?.remoteAddress || 'unknown').split(',')[0].trim();
  const agent = String(request.headers['user-agent'] || '').slice(0, 256);
  const clientKey = crypto.createHash('sha256').update(`${address}\n${agent}`).digest('hex');
  return Boolean(await supabaseRpc(settings, 'website_calculator_check_rate_limit', {
    p_client_key: clientKey,
    p_limit: RATE_LIMIT,
    p_window_seconds: Math.floor(RATE_WINDOW_MS / 1000),
  }));
}

async function claimReportToken(tokenId, token, settings) {
  if (settings.guardMode === 'memory') {
    const now = Math.floor(Date.now() / 1000);
    for (const [key, expiry] of usedReportTokens) if (expiry < now) usedReportTokens.delete(key);
    if (usedReportTokens.has(tokenId)) return false;
    usedReportTokens.set(tokenId, token.exp);
    return true;
  }
  return Boolean(await supabaseRpc(settings, 'website_calculator_claim_report_token', {
    p_token_hash: tokenId,
    p_expires_at: new Date(token.exp * 1000).toISOString(),
  }));
}

async function releaseReportToken(tokenId, settings) {
  if (settings.guardMode === 'memory') {
    usedReportTokens.delete(tokenId);
    return;
  }
  await supabaseRpc(settings, 'website_calculator_release_report_token', { p_token_hash: tokenId });
}

async function readRequestBody(request) {
  const declared = Number(request.headers['content-length'] || 0);
  if (declared > MAX_BODY_BYTES) throw new Error('The request is too large.');
  if (request.body && typeof request.body === 'object') return request.body;
  if (typeof request.body === 'string') return JSON.parse(request.body);
  const chunks = [];
  let bytes = 0;
  for await (const chunk of request) {
    bytes += chunk.length;
    if (bytes > MAX_BODY_BYTES) throw new Error('The request is too large.');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

function routeParts(request) {
  const queryPath = request.query && request.query.path;
  if (Array.isArray(queryPath)) return queryPath;
  if (queryPath) return String(queryPath).split('/').filter(Boolean);
  const match = String(request.url || '').match(/\/api\/public-calculators\/([^/?]+)\/([^/?]+)/);
  return match ? [decodeURIComponent(match[1]), decodeURIComponent(match[2])] : [];
}

async function callTool(tool, inputs, apiKey, baseUrl) {
  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/v1/public/tools/${encodeURIComponent(tool)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'X-API-Key': apiKey },
    body: JSON.stringify({ inputs }),
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || !body || !body.result) throw new Error(`The canonical calculator service failed (${response.status}).`);
  return body.result;
}

async function invokePublicTool(tool, inputs, settings) {
  return callTool(tool, inputs, settings.apiKey, settings.baseUrl);
}

async function calculate(response, calculator, body, settings) {
  validateBody(body, 'calculate');
  validateInputs(calculator, body.inputs);
  const canonicalTool = resolveCanonicalTool(calculator, body.inputs);
  const toolInputs = canonicalInputs(calculator, body.inputs);
  const result = await settings.invokePublicTool(canonicalTool, toolInputs, settings);
  if (result.ok !== true) throw new Error('The canonical calculator rejected these inputs.');
  const exportRequest = result.export_request;
  if (!exportRequest || exportRequest.tool_name !== 'calc_export_pdf' || !exportRequest.inputs) {
    throw new Error('The canonical calculator returned no approved PDF handoff.');
  }
  const stateHash = String(result.state_hash || result.stateHash || crypto.createHash('sha256').update(JSON.stringify(result)).digest('hex'));
  const token = sign({
    v: 1,
    calculatorId: calculator.id,
    canonicalTool,
    stateHash,
    exportInputs: exportRequest.inputs,
    exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
    nonce: crypto.randomUUID(),
  }, settings.tokenSecret);
  sendJson(response, 200, {
    ok: true,
    calculation: { calculatorId: calculator.id, result: publicCalculationResult(result) },
    report: { calculationToken: token, filename: `${calculator.slug}-adelphos-report.pdf` },
  });
}

async function report(response, calculator, body, settings) {
  validateBody(body, 'report.pdf');
  const token = verify(body.calculationToken, settings.tokenSecret);
  if (token.calculatorId !== calculator.id || !calculatorAllowsTool(calculator, token.canonicalTool)) throw new Error('The report token does not belong to this calculator.');
  const tokenId = crypto.createHash('sha256').update(String(body.calculationToken)).digest('hex');
  if (!await claimReportToken(tokenId, token, settings)) throw new Error('The report token has already been used.');
  try {
    const delivered = await settings.invokePublicTool('calc_export_pdf', token.exportInputs, settings);
    const downloadTicketId = delivered.download_ticket_id
      || delivered.download?.download_ticket_id
      || delivered.download?.ticket_id;
    if (!downloadTicketId || !/^[A-Za-z0-9._~-]+$/.test(String(downloadTicketId))) {
      throw new Error('The report exporter returned no valid public download ticket.');
    }
    const absoluteDownload = new URL(
      `/v1/public/downloads/${encodeURIComponent(String(downloadTicketId))}`,
      settings.baseUrl,
    ).toString();
    const pdfResponse = await fetch(absoluteDownload, {
      headers: { 'Accept': 'application/pdf', 'X-API-Key': settings.apiKey },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
    const contentType = pdfResponse.headers.get('content-type') || '';
    if (!pdfResponse.ok || !contentType.toLowerCase().startsWith('application/pdf')) throw new Error('The report ticket did not return a PDF.');
    const bytes = Buffer.from(await pdfResponse.arrayBuffer());
    if (!bytes.subarray(0, 5).equals(Buffer.from('%PDF-'))) throw new Error('The report response is not a valid PDF.');
    response.statusCode = 200;
    response.setHeader('Content-Type', 'application/pdf');
    response.setHeader('Content-Disposition', `attachment; filename="${safeFilename(delivered.filename, `${calculator.slug}-adelphos-report.pdf`)}"`);
    response.setHeader('Cache-Control', 'private, no-store');
    response.end(bytes);
  } catch (error) {
    await releaseReportToken(tokenId, settings).catch(() => undefined);
    throw error;
  }
}

function createHandler(dependencies = {}) {
  return async function handler(request, response) {
  if (request.method !== 'POST') return sendJson(response, 405, { ok: false, detail: 'Method not allowed.' });
  const [calculatorId, action] = routeParts(request);
  const calculator = calculators.get(calculatorId);
  if (!calculator || !['calculate', 'report.pdf'].includes(action)) return sendJson(response, 404, { ok: false, detail: 'Calculator route not found.' });
  const settings = {
    apiKey: process.env.ADELPHOS_PUBLIC_TOOL_API_KEY,
    tokenSecret: process.env.ADELPHOS_CALCULATOR_TOKEN_SECRET,
    baseUrl: process.env.ADELPHOS_PUBLIC_TOOL_BASE_URL || 'https://chat.adelphos.ai',
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    guardMode: process.env.ADELPHOS_CALCULATOR_RUNTIME_GUARD_MODE || 'supabase',
    invokePublicTool: dependencies.invokePublicTool || invokePublicTool,
  };
  const durableGuardConfigured = settings.guardMode === 'memory' || (settings.supabaseUrl && settings.supabaseServiceKey);
  if (!settings.apiKey || !settings.tokenSecret || settings.tokenSecret.length < 32 || !durableGuardConfigured) return sendJson(response, 503, { ok: false, detail: 'Calculator service is not configured.' });
  try {
    if (await rateLimit(request, settings)) return sendJson(response, 429, { ok: false, detail: 'Too many calculator requests. Please try again shortly.' });
    const body = await readRequestBody(request);
    if (action === 'calculate') return await calculate(response, calculator, body, settings);
    return await report(response, calculator, body, settings);
  } catch (error) {
    if (error instanceof CalculatorHttpError) return sendJson(response, error.statusCode, { ok: false, detail: error.message, reason: error.reason });
    const clientError = /required|allowed|permitted|finite|whole|unexpected|invalid|rejected|expired|belong|already been used|too large|too (?:few|many) entries|must be (?:a list|an object|text|true or false|a date)|explicitly confirmed empty list|too long/i.test(error.message);
    return sendJson(response, clientError ? 400 : 502, { ok: false, detail: error.message });
  }
  };
}

const handler = createHandler();
module.exports = handler;
module.exports._test = { sign, verify, validateInputs, validateBody, resolveCanonicalTool, canonicalInputs, publicCalculationResult, routeParts, calculators, ZONE_MODE_TO_TOOL, createHandler, callTool, invokePublicTool, CalculatorHttpError };
