/**
 * ModelDropdown — LLM / model selector dropdown (.chat-model-dropdown).
 *
 * Extracted from index.html initDropdowns() — the model-selection portion:
 *   - Label click toggles .model-menu visibility
 *   - .model-option click selects a model, updates brand display
 *   - Updates .brand-variant and .model-version-display in the label
 *
 * Models: "Build X 0.1", "Build MEP 0.1", "Build A 0.1" (+ disabled LLM options)
 * J3 Models: "j3-fast", "j3-reasoning" (routed via J3 backend)
 */
import { J3Toggle } from '../bridge/WebViewBridge.js';

/** @type {Object<string, {variant: string, version: string}>} */
const J3_MODEL_DISPLAY = {
  'j3-fast':      { variant: 'J3', version: 'Fast' },
  'j3-reasoning': { variant: 'J3', version: 'Reasoning' },
};

export class ModelDropdown {
  /** @param {import('../state/ChatState.js').ChatState} state */
  /** @param {import('../bridge/WebViewBridge.js').WebViewBridge} bridge */
  constructor(state, bridge) {
    this._state = state;
    this._bridge = bridge;

    this._dropdown = document.querySelector('.chat-model-dropdown');
    this._label = this._dropdown?.querySelector('.chat-model-label');
    this._menu = this._dropdown?.querySelector('.chat-dropdown-menu');
    this._options = this._dropdown?.querySelectorAll('.model-option') ?? [];

    if (this._label && this._menu) this._attach();
  }

  // ── Public API ──────────────────────────────────────────────

  /** Return the data-model value of the currently active option. */
  getSelectedModel() {
    for (const opt of this._options) {
      if (opt.classList.contains('active')) return opt.dataset.model;
    }
    return 'Build X 0.1'; // default
  }

  /** @returns {boolean} Whether the current model is a J3 backend model. */
  isJ3Model() {
    return this.getSelectedModel() in J3_MODEL_DISPLAY;
  }

  /** Programmatically select a model by its data-model name. */
  setModel(name) {
    for (const opt of this._options) {
      const isTarget = opt.dataset.model === name;
      opt.classList.toggle('active', isTarget);
    }
    this._updateBrandDisplay(name);
  }

  // ── Private ─────────────────────────────────────────────────

  _attach() {
    // Toggle menu visibility
    this._label.addEventListener('click', (e) => {
      e.stopPropagation();
      document.querySelectorAll('.chat-dropdown-menu.show').forEach(m => {
        if (m !== this._menu) m.classList.remove('show');
      });
      this._menu.classList.toggle('show');
    });

    // LLM toggle
    const llmToggle = document.querySelector('#llmModeToggle6');
    if (llmToggle) {
      llmToggle.addEventListener('change', () => {
        const enabled = llmToggle.checked;
        this._bridge.postMessage('llm_toggle', enabled ? 'true' : 'false');
        document.querySelectorAll('.llm-option').forEach(el => {
          el.classList.toggle('disabled', !enabled);
        });
      });
    }

    // Option selection
    this._options.forEach(option => {
      option.addEventListener('click', (e) => {
        e.stopPropagation();
        if (option.classList.contains('disabled')) return;

        const modelName = option.dataset.model;

        // Update active state — only ONE model active at a time
        this._options.forEach(o => o.classList.remove('active'));
        option.classList.add('active');

        // Update the brand display in the label
        this._updateBrandDisplay(modelName);

        // Notify bridge so C# can switch model (handles Claude vs J3 backend routing)
        this._bridge.postMessage('set_model', modelName);

        // For J3 models, also fire the IM-0001 toggle through the J3 backend
        if (modelName in J3_MODEL_DISPLAY) {
          J3Toggle.setModel(modelName);
        }

        // Close the menu after selection
        this._menu.classList.remove('show');
      });
    });
  }

  /**
   * Parse a model name and update the label's brand-variant and
   * model-version-display spans. Supports both "Build X 0.1" format
   * and J3 model IDs ("j3-fast", "j3-reasoning").
   */
  _updateBrandDisplay(modelName) {
    const j3 = J3_MODEL_DISPLAY[modelName];
    if (j3) {
      const variantEl = this._label.querySelector('.brand-variant');
      const versionEl = this._label.querySelector('.model-version-display');
      if (variantEl) variantEl.textContent = j3.variant;
      if (versionEl) versionEl.textContent = j3.version;
      return;
    }

    const parts = (modelName || '').split(' ');
    const variant = parts[1] ?? 'X';
    const version = parts[2] ?? '0.1';

    const variantEl = this._label.querySelector('.brand-variant');
    const versionEl = this._label.querySelector('.model-version-display');

    if (variantEl) variantEl.textContent = variant;
    if (versionEl) versionEl.textContent = version;
  }
}
