/**
 * MessageVariantBlock — renders message_compose results as tab-style variant picker.
 * Deletable: if removed, message_compose results render as plain JSON.
 */

function _esc(s) { return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

export class MessageVariantBlock {
  static render(data, bridge) {
    const el = document.createElement('div');
    el.className = 'jb-msg-variants';

    const kind = data.kind || 'other';
    const variants = data.variants || [];
    if (!variants.length) {
      el.innerHTML = '<div class="jb-variants-empty">No variants provided.</div>';
      return el;
    }

    el.innerHTML = `
      <div class="jb-variants-header">&#128221; Draft: ${_esc(kind)}</div>
      <div class="jb-variants-tabs">
        ${variants.map((v, i) => `
          <button class="jb-variant-tab${i === 0 ? ' jb-variant-tab--active' : ''}" data-idx="${i}">
            ${_esc(v.label)}
          </button>
        `).join('')}
      </div>
      <div class="jb-variants-body">
        ${variants.map((v, i) => `
          <div class="jb-variant-content${i === 0 ? '' : ' jb-variant-content--hidden'}" data-idx="${i}">
            ${v.subject ? `<div class="jb-variant-subject">Subject: ${_esc(v.subject)}</div>` : ''}
            <div class="jb-variant-text">${_esc(v.body)}</div>
            <div class="jb-variant-actions">
              <button class="jb-variant-copy" data-idx="${i}">&#128203; Copy</button>
              <button class="jb-variant-use" data-idx="${i}">&#10003; Use This</button>
            </div>
          </div>
        `).join('')}
      </div>
    `;

    el.querySelectorAll('.jb-variant-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const idx = tab.dataset.idx;
        el.querySelectorAll('.jb-variant-tab').forEach(t => t.classList.remove('jb-variant-tab--active'));
        el.querySelectorAll('.jb-variant-content').forEach(c => c.classList.add('jb-variant-content--hidden'));
        tab.classList.add('jb-variant-tab--active');
        el.querySelector(`.jb-variant-content[data-idx="${idx}"]`)?.classList.remove('jb-variant-content--hidden');
      });
    });

    el.querySelectorAll('.jb-variant-copy').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx);
        const v = variants[idx];
        const text = v.subject ? `Subject: ${v.subject}\n\n${v.body}` : v.body;
        navigator.clipboard?.writeText(text);
        btn.textContent = 'Copied!';
        setTimeout(() => btn.textContent = '\u{1F4CB} Copy', 1500);
      });
    });

    el.querySelectorAll('.jb-variant-use').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx);
        const v = variants[idx];
        if (bridge) {
          bridge.postMessage('chat', JSON.stringify({
            text: `Selected variant: ${v.label}\n\n${v.body}`
          }));
        }
      });
    });

    return el;
  }
}
