/**
 * SearchResultsBlock — renders web_search results as compact inline cards.
 * Deletable: if removed, web_search results render as plain JSON text.
 */

function _esc(s) { return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function _domain(url) {
  try { return new URL(url).hostname.replace('www.',''); } catch(e) { return url; }
}

export class SearchResultsBlock {
  static render(data, bridge) {
    const el = document.createElement('div');
    el.className = 'jb-search-results';

    const results = data.results || [];
    const query = data.query || '';
    const duration = data.duration_ms || 0;
    const fromCache = data.from_cache ? ' · cached' : '';

    const visibleCount = 3;
    const hasMore = results.length > visibleCount;

    el.innerHTML = `
      <div class="jb-search-header">
        <span class="jb-search-icon">&#128269;</span>
        <span class="jb-search-query">${_esc(query)}</span>
        <span class="jb-search-meta">${results.length} results · ${duration}ms${fromCache}</span>
      </div>
      <div class="jb-search-list">
        ${results.map((r, i) => `
          <div class="jb-search-item${i >= visibleCount ? ' jb-search-item--hidden' : ''}" data-url="${_esc(r.url)}">
            <div class="jb-search-title">${_esc(r.title)}</div>
            <div class="jb-search-domain">${_esc(_domain(r.url))}</div>
            <div class="jb-search-snippet">${_esc(r.snippet || r.body || '')}</div>
          </div>
        `).join('')}
      </div>
      ${hasMore ? `<button class="jb-search-toggle" data-expanded="false">&#9660; ${results.length - visibleCount} more results</button>` : ''}
    `;

    el.querySelectorAll('.jb-search-item').forEach(item => {
      item.addEventListener('click', () => {
        const url = item.dataset.url;
        if (url && bridge) bridge.postMessage('open_url', url);
      });
    });

    const toggle = el.querySelector('.jb-search-toggle');
    if (toggle) {
      toggle.addEventListener('click', () => {
        const expanded = toggle.dataset.expanded === 'true';
        el.querySelectorAll('.jb-search-item--hidden').forEach(h => {
          h.style.display = expanded ? 'none' : 'block';
        });
        toggle.dataset.expanded = expanded ? 'false' : 'true';
        toggle.innerHTML = expanded
          ? `&#9660; ${results.length - visibleCount} more results`
          : '&#9650; Show fewer';
      });
    }

    return el;
  }
}
