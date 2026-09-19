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
    if (!published) return send(res, 200, { contractVersion: 1, available: false, message: 'Report prices will appear here when published.' });
    // Project only the public contract, even if a future RPC adds private fields.
    const products = {};
    for (const code of ['cable', 'sap', 'lighting']) {
      const price = published.products?.[code];
      if (!price || !Number.isFinite(price.usageCredits) || !Array.isArray(price.batches)) throw new Error('Invalid published catalogue.');
      products[code] = { usageCredits: price.usageCredits, batches: price.batches.map(t => ({ quantity: t.quantity, usageCredits: t.usageCredits })) };
    }
    return send(res, 200, { contractVersion: 1, available: true, version: published.version, publishedAt: published.publishedAt, products, identicalDownloadsFree: true });
  } catch (error) {
    console.error('[report_prices.read_failed]', error.name || 'Error');
    return send(res, 503, { message: 'Report prices are temporarily unavailable. Please retry shortly.' });
  }
};
