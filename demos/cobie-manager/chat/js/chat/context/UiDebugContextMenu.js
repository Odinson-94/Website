/**
 * UiDebugContextMenu — capture-phase context menu for [data-buildx-debug-id] when UI debug is on.
 * Runs before bubble handlers (e.g. RightClickMenu on messages).
 */
export class UiDebugContextMenu {
  /** @param {import('../bridge/WebViewBridge.js').WebViewBridge} bridge */
  constructor(bridge) {
    this._bridge = bridge;
    this._menuEl = null;
    this._onCapture = this._onCapture.bind(this);
  }

  init() {
    this._menuEl = document.createElement('div');
    this._menuEl.className = 'chat-context-menu';
    document.body.appendChild(this._menuEl);
    document.addEventListener('contextmenu', this._onCapture, true);
    document.addEventListener('click', () => this._hide());
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') this._hide(); });
  }

  _onCapture(e) {
    if (!window.__BUILDX_UI_DEBUG__) return;
    const el = e.target && e.target.closest && e.target.closest('[data-buildx-debug-id]');
    if (!el) return;
    e.preventDefault();
    e.stopPropagation();
    const elementId = el.getAttribute('data-buildx-debug-id') || '';
    const label = el.getAttribute('data-buildx-debug-label') || '';
    this._show(e.clientX, e.clientY, elementId, label);
  }

  _show(x, y, elementId, label) {
    this._menuEl.innerHTML = '';
    const report = document.createElement('div');
    report.className = 'chat-context-menu-item';
    report.textContent = 'Report bug…';
    report.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const payload = JSON.stringify({
        surface: 'AIChat',
        elementId,
        label,
        timestamp: new Date().toISOString(),
      });
      this._bridge.postMessage('report_bug', payload);
      this._hide();
    });
    const copyId = document.createElement('div');
    copyId.className = 'chat-context-menu-item';
    copyId.textContent = 'Copy element ID';
    copyId.addEventListener('click', (ev) => {
      ev.stopPropagation();
      navigator.clipboard.writeText(elementId).catch(() => {});
      this._hide();
    });
    this._menuEl.appendChild(report);
    this._menuEl.appendChild(copyId);
    this._menuEl.classList.add('visible');
    requestAnimationFrame(() => {
      const rect = this._menuEl.getBoundingClientRect();
      let posX = x;
      let posY = y;
      if (x + rect.width > window.innerWidth) posX = window.innerWidth - rect.width - 4;
      if (y + rect.height > window.innerHeight) posY = window.innerHeight - rect.height - 4;
      this._menuEl.style.left = Math.max(4, posX) + 'px';
      this._menuEl.style.top = Math.max(4, posY) + 'px';
    });
  }

  _hide() {
    if (this._menuEl) this._menuEl.classList.remove('visible');
  }
}
