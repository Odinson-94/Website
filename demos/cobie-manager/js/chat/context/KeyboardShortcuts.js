/**
 * KeyboardShortcuts — global keyboard shortcut manager.
 *
 * Extracted from index.html inline script (Ctrl+Q → open QA Manager)
 * and view6-chat.js keydown handlers (Enter-to-send is handled by ChatInput).
 *
 * Extensible: call register() to add shortcuts from any module.
 */
export class KeyboardShortcuts {
  constructor(state, bridge, eventBus) {
    this._state = state;
    this._bridge = bridge;
    this._eventBus = eventBus;
    this._shortcuts = [];
    this._handler = null;
  }

  init() {
    this.register('q', { ctrl: true }, () => {
      // Ctrl+Q should open the modern React QA Manager hosted in the Revit
      // WPF window, not the legacy qa-manager.html prototype. The chat-side
      // helper asks the host to open it via the same bridge the ribbon uses.
      try {
        if (window.chrome?.webview?.postMessage) {
          window.chrome.webview.postMessage({ action: 'openQaManagerWindow' });
        } else {
          // Dev fallback: open the built React bundle as a normal popup.
          window.open('qa-manager-react.html', 'QAManager', 'width=1400,height=900');
        }
      } catch (err) {
        console.error('[QA Manager] Ctrl+Q shortcut failed:', err);
      }
    });

    this._handler = (e) => {
      for (const s of this._shortcuts) {
        const keyMatch = e.key.toLowerCase() === s.key;
        const ctrlMatch = !!s.ctrl === e.ctrlKey;
        const shiftMatch = !!s.shift === e.shiftKey;
        const altMatch = !!s.alt === e.altKey;

        if (keyMatch && ctrlMatch && shiftMatch && altMatch) {
          e.preventDefault();
          s.action(e);
          return;
        }
      }
    };

    document.addEventListener('keydown', this._handler);
  }

  /**
   * Register a keyboard shortcut.
   * @param {string} key — key name (lowercase), e.g. 'q', 'enter'
   * @param {{ ctrl?: boolean, shift?: boolean, alt?: boolean }} modifiers
   * @param {Function} action
   */
  register(key, modifiers, action) {
    this._shortcuts.push({ key: key.toLowerCase(), ...modifiers, action });
  }

  destroy() {
    if (this._handler) {
      document.removeEventListener('keydown', this._handler);
      this._handler = null;
    }
    this._shortcuts = [];
  }
}
