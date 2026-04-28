/**
 * PagePreviewBlock — renders web_fetch results as collapsible page preview card.
 * Deletable: if removed, web_fetch results render as plain JSON text.
 */

function _esc(s) { return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function _domain(url) { try { return new URL(url).hostname.replace('www.',''); } catch(e) { return url; } }

export class PagePreviewBlock {
  static render(data, bridge) {
    const el = document.createElement('div');
    el.className = 'jb-page-preview';

    const url = data.url || '';
    const text = data.text || '';
    const status = data.status || 0;
    const truncated = data.truncated || false;
    const duration = data.duration_ms || 0;
    const preview = text.substring(0, 500);
    const hasMore = text.length > 500;

    const statusClass = status >= 200 && status < 300 ? 'jb-status-ok'
      : status >= 300 && status < 400 ? 'jb-status-redirect'
      : 'jb-status-error';

    el.innerHTML = `
      <div class="jb-preview-header">
        <span class="jb-preview-icon">&#127760;</span>
        <span class="jb-preview-url" data-url="${_esc(url)}">${_esc(_domain(url))}</span>
        <span class="jb-preview-status ${statusClass}">${status}</span>
        <span class="jb-preview-meta">${duration}ms</span>
      </div>
      <div class="jb-preview-body">
        <div class="jb-preview-text">${_esc(preview)}</div>
        ${hasMore ? `<div class="jb-preview-full" style="display:none">${_esc(text)}</div>` : ''}
      </div>
      <div class="jb-preview-footer">
        ${hasMore ? '<button class="jb-preview-toggle">&#9660; Show more</button>' : ''}
        ${truncated ? '<span class="jb-preview-truncated">&#9888; Truncated at 50K</span>' : ''}
      </div>
    `;

    el.querySelector('.jb-preview-url')?.addEventListener('click', () => {
      if (url && bridge) bridge.postMessage('open_url', url);
    });

    const toggleBtn = el.querySelector('.jb-preview-toggle');
    if (toggleBtn) {
      let expanded = false;
      toggleBtn.addEventListener('click', () => {
        expanded = !expanded;
        const shortEl = el.querySelector('.jb-preview-text');
        const fullEl = el.querySelector('.jb-preview-full');
        if (expanded) {
          if (shortEl) shortEl.style.display = 'none';
          if (fullEl) fullEl.style.display = 'block';
          toggleBtn.innerHTML = '&#9650; Show less';
        } else {
          if (shortEl) shortEl.style.display = 'block';
          if (fullEl) fullEl.style.display = 'none';
          toggleBtn.innerHTML = '&#9660; Show more';
        }
      });
    }

    return el;
  }
}
