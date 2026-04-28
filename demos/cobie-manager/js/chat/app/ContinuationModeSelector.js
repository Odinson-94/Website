/**
 * ContinuationModeSelector — dropdown for agentic continuation mode.
 *
 * Renders a compact dropdown in the chat header that lets the user
 * switch between Default / AutoVerify / ProposeNext / FullAuto modes.
 * Posts `set_continuation_mode` to C# via the bridge.
 */
export class ContinuationModeSelector {
  constructor(bridge) {
    this._bridge = bridge;
    this._currentMode = 'Default';
    this._el = null;
    this._render();
  }

  _render() {
    // Find the header controls area
    const header = document.querySelector('.demo-topbar-right')
                || document.querySelector('.chat-header-controls');
    if (!header) {
      // No header container in this host (topbar is WPF chrome, not HTML).
      // This is expected in the standalone Revit chat. Selector is only
      // visible when embedded in a web host with .demo-topbar-right.
      return;
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'continuation-mode-wrapper';
    wrapper.style.cssText = 'display:inline-flex;align-items:center;gap:4px;margin-left:8px;';

    const label = document.createElement('span');
    label.textContent = 'Agent:';
    label.style.cssText = 'font-size:10px;color:#888;';

    const select = document.createElement('select');
    select.className = 'continuation-mode-select';
    select.title = 'Agentic continuation mode — controls what happens after each tool execution';
    select.style.cssText = `
      font-size:10px;
      padding:2px 4px;
      border-radius:4px;
      background:#2d2d2d;
      color:#ccc;
      border:1px solid #444;
      outline:none;
      cursor:pointer;
    `.trim();

    select.innerHTML = `
      <option value="Default">Default</option>
      <option value="AutoVerify">Auto-Verify</option>
      <option value="ProposeNext">Propose Next</option>
      <option value="FullAuto">Full Auto</option>
    `;
    select.value = this._currentMode;

    select.addEventListener('change', () => {
      this._currentMode = select.value;
      this._bridge.postMessage('set_continuation_mode', select.value);
      console.log('[ContinuationModeSelector] Mode changed to:', select.value);
    });

    wrapper.appendChild(label);
    wrapper.appendChild(select);
    header.appendChild(wrapper);
    this._el = select;
  }

  /** Set mode programmatically (e.g., from C# notification). */
  setMode(mode) {
    this._currentMode = mode;
    if (this._el) this._el.value = mode;
  }

  /** Get the current mode. */
  getMode() {
    return this._currentMode;
  }
}
