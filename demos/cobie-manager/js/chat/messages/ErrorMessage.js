/**
 * ErrorMessage — renders error and warning bubbles in the chat.
 *
 * Extracted from view6-chat.js error handling (lines 533–547, 670–677).
 * Stream errors use a compact “Error” row with a fold-out detail so long
 * messages do not overlap debug / neural UI.
 *
 * CHANGELOG:
 * 2026-03-28 | appendTo: compact toggle + chevron; full text in collapsible detail.
 */
import { escapeHtml } from './ThinkingStepMessage.js';

export class ErrorMessage {
  constructor(state) {
    this._state = state;
  }

  /**
   * Render an error or warning message bubble.
   * @param {string} message — the error text to display
   * @param {'error'|'warning'|'info'} [type='error'] — severity level
   * @returns {string} HTML string for the message bubble
   */
  render(message, type = 'error') {
    const safe = escapeHtml(message || 'An error occurred');
    const { icon, colour } = TYPE_STYLES[type] || TYPE_STYLES.error;

    return `<p style="color:${colour};">${icon} ${safe}</p>`;
  }

  /**
   * Create a fully animated message element and append it to the chat.
   * @param {HTMLElement} chatEl — the chat messages container
   * @param {string} message — the error text
   * @param {'error'|'warning'|'info'} [type='error']
   * @returns {HTMLElement} the appended message div
   */
  appendTo(chatEl, message, type = 'error') {
    const fullText = (message || 'An error occurred').toString();
    const div = document.createElement('div');
    div.className = 'chat-stream-error-fold chat-stream-error-inline';

    const { colour } = TYPE_STYLES[type] || TYPE_STYLES.error;

    const head = document.createElement('div');
    head.className = 'chat-stream-error-head';

    const label = document.createElement('span');
    label.className = 'chat-stream-error-label';
    label.style.color = colour;
    label.textContent = type === 'error' ? 'Error' : (type === 'warning' ? 'Warning' : 'Info');

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'chat-stream-error-toggle';
    toggle.setAttribute('aria-expanded', 'false');
    toggle.title = 'Show details';
    toggle.innerHTML = '<span class="chat-stream-error-chevron" aria-hidden="true">\u25b8</span>';

    const detail = document.createElement('div');
    detail.className = 'chat-stream-error-detail';
    detail.hidden = true;

    const pre = document.createElement('pre');
    pre.className = 'chat-stream-error-detail-text';
    pre.textContent = fullText;

    detail.appendChild(pre);
    head.appendChild(label);
    head.appendChild(toggle);
    div.appendChild(head);
    div.appendChild(detail);

    toggle.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const open = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', open ? 'false' : 'true');
      detail.hidden = open;
      toggle.title = open ? 'Show details' : 'Hide details';
      div.classList.toggle('chat-stream-error-fold--open', !open);
    });

    div.style.opacity = '0';
    div.style.transform = 'translateY(12px) scale(0.98)';
    chatEl.appendChild(div);

    div.offsetHeight; // force reflow

    div.style.transition = 'opacity 0.5s cubic-bezier(0.4, 0, 0.2, 1), transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)';
    div.style.opacity = '1';
    div.style.transform = 'translateY(0) scale(1)';

    chatEl.scrollTop = chatEl.scrollHeight;
    return div;
  }
}

// ── Style map ──────────────────────────────────────────────────────
const TYPE_STYLES = {
  error:   { icon: '⚠️', colour: '#ff6b6b' },
  warning: { icon: '🤔', colour: '#888' },
  info:    { icon: 'ℹ️', colour: '#4a9bb8' }
};
