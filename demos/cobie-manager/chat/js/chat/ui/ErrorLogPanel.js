/**
 * ErrorLogPanel — slide-out panel showing captured errors.
 * Triggered by clicking the QA error badge. Requests error data from C#
 * via bridge, renders a scrollable list.
 */
export class ErrorLogPanel {
  constructor(bridge) {
    this._bridge = bridge;
    this._panelEl = null;
    this._visible = false;
  }

  init() {
    this._createPanel();
    this._bridge.on('error_log', (_rest, data) => {
      this._renderErrors(data.message);
    });
  }

  toggle() {
    if (this._visible) {
      this.hide();
    } else {
      this._bridge.postMessage('get_error_log', '');
      this.show();
    }
  }

  show() {
    if (!this._panelEl) return;
    this._panelEl.classList.add('error-log-panel--open');
    this._visible = true;
  }

  hide() {
    if (!this._panelEl) return;
    this._panelEl.classList.remove('error-log-panel--open');
    this._visible = false;
  }

  _createPanel() {
    const panel = document.createElement('div');
    panel.id = 'errorLogPanel';
    panel.className = 'error-log-panel';
    panel.innerHTML = `
      <div class="error-log-header">
        <span class="error-log-title">Captured Errors</span>
        <button class="error-log-close">\u00d7</button>
      </div>
      <div class="error-log-body"></div>
    `;
    document.body.appendChild(panel);
    panel.querySelector('.error-log-close').addEventListener('click', () => this.hide());
    this._panelEl = panel;
  }

  _renderErrors(json) {
    const body = this._panelEl?.querySelector('.error-log-body');
    if (!body) return;

    try {
      const data = typeof json === 'string' ? JSON.parse(json) : json;
      if (!data.errors || data.errors.length === 0) {
        body.innerHTML = '<div class="error-log-empty">No errors captured.</div>';
        return;
      }

      body.innerHTML = data.errors.map(e => `
        <div class="error-log-entry">
          <div class="error-log-time">${this._esc(e.timestamp)}</div>
          <div class="error-log-cmd">${this._esc(e.command)}</div>
          <div class="error-log-msg">${this._esc(e.error)}</div>
          ${e.context ? `<div class="error-log-ctx">${this._esc(e.context)}</div>` : ''}
        </div>
      `).join('');
    } catch {
      body.innerHTML = '<div class="error-log-empty">Failed to parse error log.</div>';
    }
  }

  _esc(text) {
    const d = document.createElement('div');
    d.textContent = text || '';
    return d.innerHTML;
  }
}
