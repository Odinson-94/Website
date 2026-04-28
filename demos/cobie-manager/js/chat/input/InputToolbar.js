/**
 * InputToolbar — Thin coordinator for all input-row controls.
 *
 * Owns the .demo-chat-input-row container and orchestrates:
 *   ChatInput, SendButton, StopButton, AgentDropdown, ModelDropdown
 */
import { J3Toggle } from '../bridge/WebViewBridge.js';

export class InputToolbar {
  /** @param {import('../state/ChatState.js').ChatState} state */
  /** @param {import('../bridge/WebViewBridge.js').WebViewBridge} bridge */
  constructor(state, bridge) {
    this._state = state;
    this._bridge = bridge;
    this._el = document.querySelector('.demo-chat-input-row');
    this._grindActive = false;
    this._grindToggle = null;
  }

  /** Wire up child components after construction. */
  init({ chatInput, sendButton, stopButton, agentDropdown, modelDropdown } = {}) {
    this._chatInput = chatInput ?? null;
    this._sendButton = sendButton ?? null;
    this._stopButton = stopButton ?? null;
    this._agentDropdown = agentDropdown ?? null;
    this._modelDropdown = modelDropdown ?? null;

    this._injectGrindToggle();
  }

  _injectGrindToggle() {
    const llmRow = document.querySelector('.llm-toggle-row');
    if (!llmRow) return;

    const row = document.createElement('div');
    row.className = 'dropdown-item llm-toggle-row';
    row.title = 'Grind mode — server-side auto-continuation loop';
    row.innerHTML = `
      <span>Grind</span>
      <label class="llm-toggle">
        <input type="checkbox" id="grindModeToggle">
        <span class="toggle-slider"></span>
      </label>
    `;
    llmRow.parentNode.insertBefore(row, llmRow);

    this._grindToggle = row.querySelector('#grindModeToggle');
    this._grindToggle.addEventListener('change', () => {
      const next = this._grindToggle.checked ? 'on' : 'off';
      J3Toggle.setGrind(next, '');
      this._grindActive = this._grindToggle.checked;
    });
  }

  /** Update grind toggle state from external events. */
  setGrindState(active) {
    this._grindActive = !!active;
    if (this._grindToggle) this._grindToggle.checked = active;
  }

  /** Disable the entire toolbar (e.g. while streaming). */
  disable() {
    this._chatInput?.disable();
    this._sendButton?.disable();
  }

  /** Re-enable the toolbar after a response completes. */
  enable() {
    this._chatInput?.enable();
    this._sendButton?.enable();
  }
}
