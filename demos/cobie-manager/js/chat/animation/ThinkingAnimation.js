/**
 * ThinkingAnimation — thin ES-module wrapper around the global ThinkingAnimation
 * IIFE exposed by js/thinking-animation.js (+ thinking-animation.css).
 *
 * The heavy lifting (step reveals, pulsing node, collapse/expand) is CSS-driven.
 * This class provides a start/stop/isActive interface so ChatApp can manage
 * the animation lifecycle without touching the global directly.
 */
export class ThinkingAnimation {
  constructor(state, eventBus) {
    this._state = state;
    this._eventBus = eventBus;
    this._active = false;
    this._container = null;
  }

  /**
   * Reference to the global ThinkingAnimation IIFE, or null if not loaded.
   * @private
   */
  get _global() {
    return window.ThinkingAnimation || null;
  }

  /**
   * Start the thinking animation on a container element.
   * If no container is provided, looks for `.thinking-container` inside
   * the chat messages panel.
   * @param {HTMLElement} [container]
   * @param {Object} [options] — forwarded to ThinkingAnimation.run()
   */
  start(container, options = {}) {
    if (this._active) return;

    this._container = container
      || document.querySelector('#chatMessagesIndex6 .thinking-container');

    if (!this._container) return;

    this._active = true;

    const global = this._global;
    if (global) {
      global.show(this._container);
    } else {
      this._container.classList.remove('hidden', 'collapsing');
      this._container.classList.add('visible');
    }

    this._eventBus.emit('thinking:started');
  }

  /**
   * Stop / hide the thinking animation.
   */
  async stop() {
    if (!this._active || !this._container) return;

    const global = this._global;
    if (global) {
      await global.hide(this._container);
    } else {
      this._container.classList.add('collapsing');
      await new Promise(r => setTimeout(r, 300));
      this._container.classList.remove('visible');
      this._container.classList.add('hidden');
      this._container.classList.remove('collapsing');
    }

    this._active = false;
    this._eventBus.emit('thinking:stopped');
  }

  /**
   * Whether the animation is currently running.
   * @returns {boolean}
   */
  isActive() {
    return this._active;
  }

  /**
   * Run the full animated sequence (step reveals → done → collapse).
   * Delegates to the global ThinkingAnimation.run() when available.
   * @param {HTMLElement} container
   * @param {Object} [options]
   */
  async run(container, options = {}) {
    this._container = container;
    this._active = true;
    this._eventBus.emit('thinking:started');

    const global = this._global;
    if (global) {
      await global.run(container, {
        ...options,
        onComplete: () => {
          this._active = false;
          this._eventBus.emit('thinking:stopped');
          options.onComplete?.();
        }
      });
    }

    this._active = false;
  }

  /**
   * Reset the container to its initial state.
   * @param {HTMLElement} [container]
   */
  reset(container) {
    const el = container || this._container;
    if (!el) return;

    const global = this._global;
    if (global) {
      global.reset(el);
    } else {
      el.classList.remove('visible', 'collapsing', 'hidden');
      const header = el.querySelector('.thinking-header');
      if (header) header.classList.remove('done');
      const toggle = el.querySelector('.steps-toggle');
      if (toggle) toggle.classList.remove('expanded');
      const list = el.querySelector('.steps-list');
      if (list) list.classList.remove('expanded');
      list?.querySelectorAll('li').forEach(li => li.classList.remove('visible'));
    }

    this._active = false;
  }
}
