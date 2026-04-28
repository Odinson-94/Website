/**
 * InlineImageBlock — renders screenshots/captures as inline images with lightbox.
 * Deletable: if removed, screenshot results render as plain JSON (base64 string).
 */

function _esc(s) { return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

export class InlineImageBlock {
  static render(data, bridge) {
    const el = document.createElement('div');
    el.className = 'jb-inline-image';

    const b64 = data.base64 || '';
    const caption = data.caption || '';
    const source = data.source || '';
    const width = data.width || '';
    const height = data.height || '';

    if (!b64) {
      el.innerHTML = `<div class="jb-image-placeholder">${_esc(data.error || 'No image data')}</div>`;
      return el;
    }

    const src = b64.startsWith('data:') ? b64 : `data:image/png;base64,${b64}`;

    el.innerHTML = `
      <div class="jb-image-container">
        <img class="jb-image" src="${src}" alt="${_esc(caption)}" loading="lazy" />
      </div>
      <div class="jb-image-footer">
        <span class="jb-image-caption">${_esc(caption)}</span>
        ${width && height ? `<span class="jb-image-dims">${width}\u00d7${height}</span>` : ''}
      </div>
    `;

    const img = el.querySelector('.jb-image');
    if (img) {
      img.addEventListener('click', () => InlineImageBlock._openLightbox(src, caption));
    }

    return el;
  }

  static _openLightbox(src, caption) {
    let overlay = document.getElementById('jb-lightbox-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'jb-lightbox-overlay';
      overlay.className = 'jb-lightbox-overlay';
      overlay.innerHTML = `
        <div class="jb-lightbox-content">
          <img class="jb-lightbox-img" />
          <div class="jb-lightbox-caption"></div>
        </div>
      `;
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.style.display = 'none';
      });
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && overlay.style.display !== 'none') {
          overlay.style.display = 'none';
        }
      });
      document.body.appendChild(overlay);
    }

    overlay.querySelector('.jb-lightbox-img').src = src;
    overlay.querySelector('.jb-lightbox-caption').textContent = caption;
    overlay.style.display = 'flex';
  }
}
