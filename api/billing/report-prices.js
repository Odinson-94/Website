/* Session 01a0b8b9: website reads the published central report catalogue only. */
'use strict';
function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('CDN-Cache-Control', 'no-store');
  res.setHeader('Vercel-CDN-Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(JSON.stringify(body));
}
module.exports = async function reportPrices(req, res) {
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return send(res, 405, { message: 'Method not allowed.' }); }
  const base = String(process.env.SUPABASE_URL || process.env.ADELPHOS_SUPABASE_URL || '').replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.ADELPHOS_SUPABASE_SERVICE_KEY;
  if (!base || !key) return send(res, 503, { message: 'Report prices are temporarily unavailable.' });
  try {
    const response = await fetch(`${base}/rest/v1/rpc/adelphos_published_report_prices`, {
      method: 'POST', headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: '{}', signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error('Published report prices could not be read.');
    const published = await response.json();
    if (!published) return send(res, 200, { contractVersion: 3, available: false, message: 'Report prices will appear here when published.' });
    // Project only the public contract, even if a future RPC adds private fields.
    const products = {};
    if (!published.products || typeof published.products !== 'object' || Array.isArray(published.products)) throw new Error('Invalid published catalogue.');
    for (const [code, price] of Object.entries(published.products)) {
      if (price?.mode === 'internal') continue;
      if (!/^[a-z][a-z0-9]*$/.test(code) || !['report', 'usage', 'included'].includes(price?.mode) ||
          typeof price.name !== 'string' || typeof price.appKey !== 'string' || typeof price.unit !== 'string' ||
          (price.mode === 'report' ? !Number.isFinite(price.usageCredits) || price.usageCredits < 0 : price.usageCredits !== null) ||
          !Array.isArray(price.batches)) throw new Error('Invalid published catalogue.');
      products[code] = { name: price.name, appKey: price.appKey, unit: price.unit, mode: price.mode, usageCredits: price.usageCredits,
        batches: price.batches.map(t => {
          if (!Number.isInteger(t.quantity) || t.quantity < 2 || !Number.isFinite(t.usageCredits) || t.usageCredits < 0) throw new Error('Invalid batch price.');
          return { quantity: t.quantity, usageCredits: t.usageCredits };
        }) };
    }
    const retail = published.retail;
    if (!retail || retail.currency !== 'GBP' || !Number.isSafeInteger(retail.packPriceMinor) || retail.packPriceMinor < 50 || retail.packCredits !== 15 || !Array.isArray(published.tokenRates)) throw new Error('Invalid published economics.');
    const tokenRates = published.tokenRates.map(p => {
      if (![p.code,p.model,p.tier,p.component,p.context].every(v=>typeof v==='string') || !Number.isFinite(p.usageCreditsPerMillion) || p.usageCreditsPerMillion < 0) throw new Error('Invalid token price.');
      return {code:p.code,model:p.model,tier:p.tier,component:p.component,context:p.context,usageCreditsPerMillion:p.usageCreditsPerMillion};
    });
    return send(res, 200, { contractVersion: 3, available: true, version: published.version, publishedAt: published.publishedAt, products, retail:{currency:retail.currency,packCredits:retail.packCredits,packPriceMinor:retail.packPriceMinor}, tokenRates, identicalDownloadsFree: true });
  } catch (error) {
    console.error('[report_prices.read_failed]', error.name || 'Error');
    return send(res, 503, { message: 'Report prices are temporarily unavailable. Please retry shortly.' });
  }
};
