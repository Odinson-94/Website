/**
 * WebViewBridge — C# <-> JS message protocol.
 * Wraps WebView2 postMessage / addEventListener and provides typed dispatch.
 */
export class WebViewBridge {
  constructor(eventBus) {
    this._eventBus = eventBus;
    this._handlers = {};
    this.isWebView2 = !!(window.chrome && window.chrome.webview);
  }

  init() {
    if (!this.isWebView2) return;

    window.chrome.webview.addEventListener('message', (event) => {
      try {
        const data = JSON.parse(event.data);
        this.dispatch(data);
      } catch (e) {
        console.error('[WebViewBridge] Failed to parse message:', e);
      }
    });

    console.log('[WebViewBridge] Initialized');
  }

  /** Register a handler for a message type from C#. */
  on(type, handler) {
    (this._handlers[type] ??= []).push(handler);
  }

  /** Send a typed message to C# via WebView2. */
  postMessage(type, payload) {
    if (!this.isWebView2) return false;

    const msg = JSON.stringify({ type, payload });
    try {
      window.chrome.webview.postMessage(msg);
    } catch (err) {
      console.error('[WebViewBridge] postMessage error:', err);
    }
    return true;
  }

  /** Dispatch an incoming C# message to registered handlers. */
  dispatch(data) {
    const { type, ...rest } = data;
    const handlers = this._handlers[type];
    if (handlers) {
      handlers.forEach(h => h(rest, data));
    }
    // Also emit on the EventBus so any component can listen
    this._eventBus.emit(`bridge:${type}`, data);
  }
}

/**
 * J3Toggle — universal toggle helper for the J3 patch panel.
 * Sends j3_toggle messages through the WebView2 bridge to C# → J3 backend.
 * One method for all 27 cable signals: POST /v1/toggle/{cable_id}.
 *
 * Works in BOTH Claude-direct and J3 chat modes — toggles are shared backend services.
 */
const J3Toggle = {
  /** @type {WebViewBridge|null} */
  _bridge: null,

  /** Bind to a WebViewBridge instance. Call once during init. */
  init(bridge) {
    this._bridge = bridge;
  },

  /**
   * Fire a toggle signal.
   * @param {string} cableId  Cable ID (e.g. 'IM-0001')
   * @param {string} value    New value
   * @param {object} [options={}] Optional signal parameters
   */
  set(cableId, value, options = {}) {
    if (!this._bridge) {
      console.error('[J3Toggle] Not initialised — call J3Toggle.init(bridge) first');
      return false;
    }
    return this._bridge.postMessage('j3_toggle', JSON.stringify({
      cable_id: cableId,
      value,
      options
    }));
  },

  setModel:       (model)  => J3Toggle.set('IM-0001', model),
  setEffort:      (effort) => J3Toggle.set('IM-0004', effort),
  setGrind:       (action, task = '') => J3Toggle.set('IE-0040', action, { task }),
  setPermission:  (mode)   => J3Toggle.set('IE-0001', mode),
  setSandbox:     (on)     => J3Toggle.set('IE-0020', on ? 'on' : 'off'),
  setThinking:    (config) => J3Toggle.set('IM-0003', config),
  setMaxTurns:    (turns)  => J3Toggle.set('IM-0006', String(turns)),
  triggerNewChat:      ()  => J3Toggle.set('IS-0001', 'trigger'),
  triggerCompaction:   ()  => J3Toggle.set('IH-0007', 'trigger'),
};

export { J3Toggle };
