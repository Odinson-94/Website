/**
 * ImageGalleryBlock — renders list_screenshots as horizontal scrollable thumbnail strip.
 * Deletable: if removed, list_screenshots results render as plain JSON.
 */

function _esc(s) { return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

export class ImageGalleryBlock {
  static render(data, bridge) {
    const el = document.createElement('div');
    el.className = 'jb-image-gallery';

    const images = data.images || [];
    if (!images.length) {
      el.innerHTML = '<div class="jb-gallery-empty">No screenshots found.</div>';
      return el;
    }

    el.innerHTML = `
      <div class="jb-gallery-header">
        <span>&#128247; Recent Screenshots</span>
        <span class="jb-gallery-count">${images.length}</span>
      </div>
      <div class="jb-gallery-strip">
        ${images.map(img => `
          <div class="jb-gallery-thumb" data-path="${_esc(img.path)}">
            <div class="jb-gallery-thumb-placeholder">&#128444;</div>
            <div class="jb-gallery-thumb-time">${_esc((img.timestamp||'').substring(11,16))}</div>
          </div>
        `).join('')}
      </div>
    `;

    el.querySelectorAll('.jb-gallery-thumb').forEach(thumb => {
      thumb.addEventListener('click', () => {
        const path = thumb.dataset.path;
        if (path && bridge) {
          bridge.postMessage('send_screenshot', JSON.stringify({ path }));
        }
      });
    });

    return el;
  }
}
