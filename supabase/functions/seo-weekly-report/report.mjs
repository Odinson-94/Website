// Deterministic reporting from stored Search Console observations; no paid APIs.
const DAY = 86400000;
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function periodKey(now = new Date()) {
  const perth = new Date(now.getTime() + 8 * 3600000);
  perth.setUTCDate(perth.getUTCDate() - perth.getUTCDay());
  return perth.toISOString().slice(0, 10);
}
export function buildReport(rows, now = new Date()) {
  const latest = rows.map(r => r.search_date).filter(Boolean).sort().at(-1);
  const end = latest ? new Date(latest + 'T00:00:00Z') : null;
  const start = end ? new Date(end.getTime() - 6 * DAY).toISOString().slice(0,10) : null;
  const previousStart = end ? new Date(end.getTime() - 13 * DAY).toISOString().slice(0,10) : null;
  const current = rows.filter(r => start && r.search_date >= start && r.search_date <= latest);
  const previous = rows.filter(r => previousStart && r.search_date >= previousStart && r.search_date < start);
  const sum = records => records.reduce((a,r) => { const i=Number(r.impressions)||0; a.clicks+=Number(r.clicks)||0; a.impressions+=i; a.weighted+=i*(Number(r.position)||0); return a; }, {clicks:0,impressions:0,weighted:0});
  const totals = sum(current), prior = sum(previous);
  const queries = new Map();
  for (const row of current) { const list=queries.get(row.query)||[]; list.push(row); queries.set(row.query,list); }
  const ranked = [...queries].map(([query,records]) => { const t=sum(records); return {query,...t,position:t.impressions?t.weighted/t.impressions:null}; }).sort((a,b)=>b.impressions-a.impressions);
  const stale = !end || now.getTime()-end.getTime()>4*DAY;
  const tips = [];
  if (stale) tips.push('Check the Search Console collector: the most recent data is more than four days old or missing. Treat these figures as historical.');
  const near = ranked.filter(r=>r.position>10&&r.position<=20).slice(0,3);
  if (near.length) tips.push('Improve the pages serving these queries near page one: '+near.map(r=>`${r.query} (average position ${r.position.toFixed(1)})`).join('; ')+'. Strengthen relevant headings, answers and internal links.');
  const lowCtr = ranked.filter(r=>r.impressions>=20&&r.position<=10&&r.clicks/r.impressions<0.02).slice(0,3);
  if (lowCtr.length) tips.push('Review search titles and descriptions for high-visibility, low-click queries: '+lowCtr.map(r=>r.query).join('; ')+'. Make the page benefit and intent clearer.');
  if (!tips.length) tips.push('Keep monitoring observed queries and improve the pages with the most impressions. This report does not run a paid ranking scan.');
  const subject = `Adelphos SEO report — ${now.toISOString().slice(0,10)}`;
  const html = `<html><body style="margin:0;background:#f4f7fb;font-family:Arial,sans-serif;color:#182b49"><main style="max-width:720px;margin:24px auto;background:white;padding:32px;border-radius:16px"><div style="color:#2878e4;font-weight:bold;letter-spacing:2px">ADELPHOS</div><h1>Weekly SEO report</h1><p>${start?`${esc(start)} to ${esc(latest)}`:'No Search Console observations available'}</p>${stale?'<p><strong>Data freshness needs attention.</strong></p>':''}<h2>${totals.clicks} clicks · ${totals.impressions} impressions</h2><p>CTR: ${totals.impressions?(100*totals.clicks/totals.impressions).toFixed(2)+'%':'not available'} · Impression-weighted average position: ${totals.impressions?(totals.weighted/totals.impressions).toFixed(1):'not available'}</p><p>${previous.length?`Previous seven-day window: ${prior.clicks} clicks and ${prior.impressions} impressions. Change: ${totals.clicks-prior.clicks} clicks; ${totals.impressions-prior.impressions} impressions.`:'No observations in the previous window; a comparison is unavailable.'}</p><h2>Top observed queries</h2><table style="width:100%;border-collapse:collapse;text-align:left"><tr><th>Query</th><th>Avg. position</th><th>Impressions</th><th>Clicks</th></tr>${ranked.slice(0,10).map(r=>`<tr><td style="padding:9px 0;border-bottom:1px solid #e8edf5">${esc(r.query)}</td><td>${r.position===null?'—':r.position.toFixed(1)}</td><td>${r.impressions}</td><td>${r.clicks}</td></tr>`).join('')}</table><h2>What could be better</h2><ul>${tips.map(t=>`<li style="margin:12px 0">${esc(t)}</li>`).join('')}</ul><p><a style="color:#2878e4" href="https://adelphos.ai/seo-portal">Open SEO dashboard</a></p><p style="font-size:12px;color:#627086">Source: stored Google Search Console query/page observations, including countries and devices. Aggregates may differ from property totals because Google omits some queries. Positions are averages, not fixed live ranks. Missing queries do not prove missing indexing. No paid SEO or AI calls are used. Sent Sundays at 9am Australia/Perth.</p></main></body></html>`;
  return {subject,html,latest,start,stale,totals,queries:ranked};
}
