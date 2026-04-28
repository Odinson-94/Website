/**
 * SettingsPanel — Loads/saves user preferences via C# bridge.
 *
 * On init, sends 'get_preferences' to C# which returns all prefs as JSON.
 * Populates <select data-pref="user_pref_..."> elements with current values.
 * On change, sends 'set_preference' with { key, value } to persist.
 */
export class SettingsPanel {
  /**
   * @param {import('../state/ChatState.js').ChatState} state
   * @param {import('../bridge/WebViewBridge.js').WebViewBridge} bridge
   */
  constructor(state, bridge) {
    this._state = state;
    this._bridge = bridge;
    this._selects = document.querySelectorAll('.settings-select[data-pref]');
    this._loaded = false;

    this._attachChangeHandlers();
    this._requestPreferences();
  }

  _requestPreferences() {
    this._bridge.on('preferences_loaded', (_rest, data) => {
      if (!data.preferences) return;
      this._applyValues(data.preferences);
      this._loaded = true;
    });

    this._bridge.postMessage('get_preferences', '');
  }

  _applyValues(prefs) {
    this._selects.forEach(select => {
      const key = select.dataset.pref;
      if (key && prefs[key] !== undefined) {
        select.value = prefs[key];
      }
    });
  }

  _attachChangeHandlers() {
    this._selects.forEach(select => {
      select.addEventListener('change', () => {
        const key = select.dataset.pref;
        const value = select.value;
        if (!key) return;

        this._bridge.postMessage('set_preference', JSON.stringify({ key, value }));
        console.log(`[SettingsPanel] ${key} → ${value}`);
      });
    });
  }
}
