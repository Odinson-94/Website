'use strict';

const crypto = require('node:crypto');
const {
  collectGsc, collectRanks, configuration, isCollectorRequest, sendJson, supabase, upsertWatchlist,
} = require('./_lib');

async function recordRun(record) {
  try {
    await supabase('seo_collection_runs?on_conflict=id', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(record),
    });
  } catch (error) {
    console.error('SEO run log could not be saved:', error.message);
  }
}

async function handler(request, response) {
  if (!['GET', 'POST'].includes(request.method)) return sendJson(response, 405, { ok: false, detail: 'Method not allowed.' });
  if (!isCollectorRequest(request)) return sendJson(response, 401, { ok: false, detail: 'Collector authorization failed.' });
  const config = configuration();
  if (!config.database) return sendJson(response, 503, { ok: false, detail: 'Supabase service-role access is not configured.', configured: config });

  const run = {
    id: crypto.randomUUID(), provider: config.dataforseo ? 'gsc+dataforseo' : 'gsc', started_at: new Date().toISOString(),
    status: 'running', items_requested: 0, items_succeeded: 0, cost_usd: 0,
  };
  await recordRun(run);
  try {
    const keywords = await upsertWatchlist();
    const results = await Promise.allSettled([collectGsc(), collectRanks(keywords)]);
    const completed = results.filter((result) => result.status === 'fulfilled').map((result) => result.value);
    const errors = results.filter((result) => result.status === 'rejected').map((result) => result.reason?.message || 'Unknown collection error');
    const requested = completed.reduce((sum, item) => sum + (item.requested || 0), 0);
    const succeeded = completed.reduce((sum, item) => sum + (item.succeeded || 0), 0);
    const cost = completed.reduce((sum, item) => sum + (item.cost || 0), 0);
    const finalRun = {
      ...run,
      finished_at: new Date().toISOString(),
      status: errors.length ? (completed.length ? 'partial' : 'failed') : 'complete',
      items_requested: requested,
      items_succeeded: succeeded,
      cost_usd: cost,
      error: errors.length ? errors.join(' | ').slice(0, 2000) : null,
    };
    await recordRun(finalRun);
    return sendJson(response, errors.length && !completed.length ? 502 : 200, {
      ok: errors.length === 0, run: finalRun, collectors: completed, errors, configured: config,
    });
  } catch (error) {
    const failed = { ...run, finished_at: new Date().toISOString(), status: 'failed', error: error.message.slice(0, 2000) };
    await recordRun(failed);
    return sendJson(response, 502, { ok: false, detail: error.message, run: failed, configured: config });
  }
}

module.exports = handler;
module.exports.config = { maxDuration: 60 };
