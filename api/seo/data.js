'use strict';

const {
  buildDashboard, configuration, isPortalRequest, sendJson, supabase, watchlist,
} = require('./_lib');

function seedDashboard() {
  const keywords = watchlist.keywords.map((keyword, index) => ({
    id: index + 1,
    ...keyword,
    position: null,
    previous_position: null,
    movement: null,
    ranking_url: null,
    checked_at: null,
    clicks: 0,
    impressions: 0,
    gsc_position: null,
  }));
  return {
    summary: { tracked: keywords.length, visible: 0, top_10: 0, average_position: null, visibility: 0, clicks: 0, impressions: 0, ctr: 0, gsc_position: null, rank_source: 'gsc' },
    inventory: watchlist.inventory || {}, keywords, searches: [], trend: [], gsc_daily: [], runs: [],
  };
}

async function handler(request, response) {
  if (request.method !== 'GET') return sendJson(response, 405, { ok: false, detail: 'Method not allowed.' });
  if (!isPortalRequest(request)) return sendJson(response, 401, { ok: false, detail: 'Enter the SEO portal access token.' });
  const config = configuration();
  try {
    if (!config.database) {
      return sendJson(response, 200, {
        ok: true, configured: config, onboarding: true, generated_at: new Date().toISOString(), ...seedDashboard(),
      });
    }
    const [keywords, snapshots, gscRows, runs, researchRows] = await Promise.all([
      supabase('seo_keywords?select=*&enabled=eq.true&order=keyword.asc'),
      supabase('seo_rank_snapshots?select=*&order=checked_at.desc&limit=5000'),
      supabase('seo_gsc_daily?select=search_date,query,page,device,country,clicks,impressions,ctr,position&order=search_date.desc&limit=25000'),
      supabase('seo_collection_runs?select=*&order=started_at.desc&limit=20'),
      supabase('seo_keyword_research?select=*&order=monthly_searches.desc.nullslast&limit=10000').catch(() => []),
    ]);
    const dashboard = buildDashboard(keywords.length ? keywords : seedDashboard().keywords, snapshots, gscRows, runs, researchRows);
    return sendJson(response, 200, { ok: true, configured: config, onboarding: !keywords.length, generated_at: new Date().toISOString(), inventory: watchlist.inventory || {}, ...dashboard });
  } catch (error) {
    return sendJson(response, 502, { ok: false, detail: error.message, configured: config });
  }
}

module.exports = handler;
