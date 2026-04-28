/**
 * VisualizeBlock — renders inline SVG/HTML widget in sandboxed iframe.
 * Deletable: if removed, visualize results render as plain JSON.
 */

function _esc(s) { return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

export class VisualizeBlock {
  static render(data, bridge) {
    const el = document.createElement('div');
    el.className = 'jb-visualize';

    const title = data.title || 'widget';
    const code = data.widget_code || '';
    const loadingMsgs = data.loading_messages || ['Rendering...'];

    if (!code) {
      el.innerHTML = '<div class="jb-viz-empty">No widget code provided.</div>';
      return el;
    }

    el.innerHTML = `
      <div class="jb-viz-header">&#128202; ${_esc(title)}</div>
      <div class="jb-viz-loading">${_esc(loadingMsgs[0])}</div>
      <div class="jb-viz-frame-container" style="display:none">
        <iframe class="jb-viz-iframe" sandbox="allow-scripts" style="width:100%;border:none;max-height:500px;"></iframe>
      </div>
    `;

    const iframe = el.querySelector('.jb-viz-iframe');
    const loading = el.querySelector('.jb-viz-loading');
    const container = el.querySelector('.jb-viz-frame-container');

    if (iframe) {
      iframe.srcdoc = code;
      iframe.addEventListener('load', () => {
        if (loading) loading.style.display = 'none';
        if (container) container.style.display = 'block';
        try {
          const body = iframe.contentDocument?.body;
          if (body) {
            iframe.style.height = Math.min(body.scrollHeight + 20, 500) + 'px';
          }
        } catch(e) { /* sandbox blocks cross-origin access, expected */ }
      });
    }

    return el;
  }
}
