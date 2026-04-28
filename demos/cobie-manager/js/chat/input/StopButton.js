/**
 * StopButton — Stop / cancel an in-progress AI generation.
 *
 * Swaps visibility with the send button: when the model is generating
 * the stop button shows and the send button hides, and vice-versa.
 *
 * On click, posts 'stop' to the C# bridge and resets the sending state.
 */
export class StopButton {
  /** @param {import('../state/ChatState.js').ChatState} state */
  /** @param {import('../bridge/WebViewBridge.js').WebViewBridge} bridge */
  constructor(state, bridge) {
    this._state = state;
    this._bridge = bridge;
    this._el = document.querySelector('.chat-stop-btn');
    this._sendBtn = document.querySelector('.chat-send-btn');

    if (!this._el) this._create();
    if (this._el) this._attach();
  }

  show() {
    if (this._el) this._el.style.display = 'flex';
    if (this._sendBtn) this._sendBtn.style.display = 'none';
  }

  hide() {
    if (this._el) this._el.style.display = 'none';
    if (this._sendBtn) this._sendBtn.style.display = '';
  }

  // ── Private ─────────────────────────────────────────────────

  _create() {
    const right = document.querySelector('.chat-input-right');
    if (!right) return;

    this._el = document.createElement('button');
    this._el.className = 'chat-stop-btn';
    this._el.id = 'chatStopIndex6';
    this._el.title = 'Stop generation';
    this._el.textContent = '\u25A0'; // ■
    this._el.style.display = 'none';

    if (this._sendBtn) {
      right.insertBefore(this._el, this._sendBtn);
    } else {
      right.appendChild(this._el);
    }
  }

  _attach() {
    this._el.setAttribute('data-buildx-debug-id', 'chat.input.stop');
    this._el.setAttribute('data-buildx-debug-label', 'Stop generation');
    this._el.addEventListener('click', (e) => {
      e.preventDefault();
      this._bridge.postMessage('stop', '');
      this._state.setSending(false);
    });
  }
}
