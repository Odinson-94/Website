/**
 * AgentDropdown — Agent / mode selector dropdown (.chat-agent-dropdown).
 *
 * Modes: Build | Designer | QA | Query — single-select (radio semantics).
 * Self Debug toggle: independent checkbox, enables/disables debug tools.
 */
export class AgentDropdown {
  /** @param {import('../state/ChatState.js').ChatState} state */
  /** @param {import('../bridge/WebViewBridge.js').WebViewBridge} bridge */
  constructor(state, bridge) {
    this._state = state;
    this._bridge = bridge;

    this._dropdown = document.querySelector('.chat-agent-dropdown');
    this._badge = this._dropdown?.querySelector('.chat-agent-badge');
    this._menu = this._dropdown?.querySelector('.chat-dropdown-menu');
    this._modeRows = this._dropdown?.querySelectorAll('.mode-toggle-row') ?? [];
    this._modeDisplay = this._badge?.querySelector('.agent-mode-display');
    this._debugToggle = document.getElementById('selfDebugToggle');

    if (this._badge && this._menu) this._attach();
  }

  getSelectedMode() {
    for (const row of this._modeRows) {
      const cb = row.querySelector('input[type="checkbox"]');
      if (cb?.checked) return row.dataset.mode;
    }
    return 'Build';
  }

  setMode(mode) {
    this._modeRows.forEach(row => {
      const cb = row.querySelector('input[type="checkbox"]');
      if (cb) cb.checked = (row.dataset.mode === mode);
    });
    if (this._modeDisplay) this._modeDisplay.textContent = mode;
  }

  /** Enforce exactly one mode checked; optionally notify host. */
  _selectSingleMode(selectedRow, notify) {
    const mode = selectedRow.dataset.mode;
    this._modeRows.forEach(row => {
      const cb = row.querySelector('input[type="checkbox"]');
      if (cb) cb.checked = row === selectedRow;
    });
    if (this._modeDisplay) this._modeDisplay.textContent = mode;
    if (notify) this._bridge.postMessage('set_mode', mode);
  }

  _attach() {
    this._badge.addEventListener('click', (e) => {
      e.stopPropagation();
      document.querySelectorAll('.chat-dropdown-menu.show').forEach(m => {
        if (m !== this._menu) m.classList.remove('show');
      });
      this._menu.classList.toggle('show');
    });

    this._modeRows.forEach(row => {
      const checkbox = row.querySelector('input[type="checkbox"]');
      if (checkbox) {
        checkbox.addEventListener('change', () => {
          if (checkbox.checked) {
            this._selectSingleMode(row, true);
          } else {
            checkbox.checked = true;
          }
        });
      }

      row.addEventListener('click', (e) => {
        if (e.target.closest('.mode-toggle')) return;
        this._selectSingleMode(row, true);
        this._menu.classList.remove('show');
      });
    });

    if (this._debugToggle) {
      this._debugToggle.addEventListener('change', () => {
        const enabled = this._debugToggle.checked;
        this._bridge.postMessage('toggle_debug', enabled ? 'true' : 'false');
      });
    }
  }

  get isDebugEnabled() {
    return this._debugToggle?.checked ?? false;
  }

  setDebugEnabled(enabled) {
    if (this._debugToggle) this._debugToggle.checked = enabled;
  }
}
