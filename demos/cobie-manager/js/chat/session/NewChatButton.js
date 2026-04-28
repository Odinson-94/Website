/**
 * NewChatButton — wires the ".new-agent-btn" click to start a fresh session.
 *
 * Source: view6-chat.js lines 2114-2119
 */
export class NewChatButton {
  constructor(state, bridge) {
    this._state = state;
    this._bridge = bridge;
    this._el = document.querySelector('.new-agent-btn');

    if (this._el) {
      this._el.addEventListener('click', (e) => {
        e.preventDefault();
        this._state.chatSessionsStore?.startNew();
      });
    }
  }

  disable() {
    if (this._el) {
      this._el.disabled = true;
      this._el.classList.add('disabled');
    }
  }

  enable() {
    if (this._el) {
      this._el.disabled = false;
      this._el.classList.remove('disabled');
    }
  }
}
