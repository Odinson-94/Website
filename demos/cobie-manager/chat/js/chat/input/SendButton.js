/**
 * SendButton — Manages the send button (#chatSendIndex6).
 *
 * Extracted from view6-chat.js: init() click handler + handleChatSend().
 *
 * Responsibilities:
 *   - Click handler that reads input text, debounces, clears input,
 *     queues the message visually, and posts 'chat' to the bridge.
 *   - disable / enable API for external control (e.g. while streaming).
 */
const SEND_DEBOUNCE_MS = 500;

export class SendButton {
  /** @param {import('../state/ChatState.js').ChatState} state */
  /** @param {import('../bridge/WebViewBridge.js').WebViewBridge} bridge */
  constructor(state, bridge) {
    this._state = state;
    this._bridge = bridge;
    this._el = document.getElementById('chatSendIndex6');
    this._lastSendTime = 0;
    this._disabled = false;

    if (this._el) this._attach();
  }

  // ── Public API ──────────────────────────────────────────────

  disable() {
    this._disabled = true;
    if (this._el) {
      this._el.disabled = true;
      this._el.style.opacity = '0.4';
    }
  }

  enable() {
    this._disabled = false;
    if (this._el) {
      this._el.disabled = false;
      this._el.style.opacity = '';
    }
  }

  // ── Private ─────────────────────────────────────────────────

  _attach() {
    this._el.setAttribute('data-buildx-debug-id', 'chat.input.send');
    this._el.setAttribute('data-buildx-debug-label', 'Send message');
    this._el.addEventListener('click', (e) => this._handleSend(e));
  }

  _handleSend(e) {
    if (e) {
      e.stopImmediatePropagation();
      e.preventDefault();
    }

    if (this._disabled) return;

    const inputEl = document.getElementById('chatInputIndex6');
    const inputVal = (inputEl?.value ?? inputEl?.textContent ?? '').trim();
    if (!inputVal) return;

    if (inputVal.startsWith('/')) {
      console.error('[SendButton] SLASH-H4: sending slash text to C#, inputVal=' + inputVal.substring(0, 40));
    }

    // Debounce rapid clicks
    const now = Date.now();
    if (now - this._lastSendTime < SEND_DEBOUNCE_MS) return;
    this._lastSendTime = now;

    // Clear input immediately so user gets visual feedback
    if (inputEl.value !== undefined && inputEl.tagName === 'INPUT') {
      inputEl.value = '';
    } else {
      inputEl.textContent = '';
    }

    // Queue view (legacy window global – if present)
    if (typeof window.initMessageQueueView === 'function') {
      window.initMessageQueueView();
    }
    if (window.messageQueueView) {
      window.messageQueueView.addMessage(inputVal);
    }

    // Update session title on first message
    if (this._state && typeof this._state.updateSessionTitle === 'function') {
      this._state.updateSessionTitle(inputVal);
    }

    // Stamp activity time so sidebar timestamp reflects actual message time
    const sm = this._state?.chatSessionsStore;
    if (sm) sm.markActivity();

    // §A-4: record structured user turn into session.messages[] alongside HTML.
    if (sm && typeof sm.recordUserMessage === 'function') {
      try { sm.recordUserMessage(inputVal); } catch { /* best effort */ }
    }

    // Send to Revit via bridge
    this._bridge.postMessage('chat', inputVal);

    // Track in recent prompts
    if (window.promptLibrary) window.promptLibrary.addRecent(inputVal);

    // Mark sending state (legacy flags kept for C# injected scripts)
    window.isSending = true;
  }
}
