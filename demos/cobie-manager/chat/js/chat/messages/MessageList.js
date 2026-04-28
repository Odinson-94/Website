/**
 * MessageList — manages the scrollable message container (`#chatMessagesIndex6`).
 *
 * Extracted from view6-chat.js `addMessageWithAnimation()` (≈line 2015).
 * Provides DOM-level add / scroll / clear for any message type.
 *
 * CHANGELOG:
 * 2026-03-26 | addMessage() now strips inline animation styles (opacity,
 *            | transform, transition) via transitionend listener after the
 *            | entrance animation completes. Prevents stale opacity:0 /
 *            | scale(0.98) from persisting in session HTML snapshots, which
 *            | caused restored messages to appear collapsed ("folded up").
 */
import { EventBus } from '../../shared/EventBus.js';

const EDIT_BTN_HTML = '<button class="msg-edit-btn" title="Edit message"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg></button>';
const REDO_BTN_HTML = '<button class="msg-redo-btn" title="Redo message"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg></button>';

export { EDIT_BTN_HTML, REDO_BTN_HTML };

export class MessageList {
  /**
   * @param {import('../state/ChatState.js').ChatState} state
   * @param {EventBus} eventBus
   */
  constructor(state, eventBus) {
    this._state = state;
    this._eventBus = eventBus;
    this._el = document.getElementById('chatMessagesIndex6');
    this._msgCounter = 0;
    this._userOrdinal = 0;
  }

  /** @returns {HTMLElement|null} The chat message container. */
  get element() { return this._el; }

  /**
   * Create a message div with a slide-up-and-fade-in entrance animation.
   *
   * Mirrors the monolith's `addMessageWithAnimation(chatEl, className, html)`.
   *
   * @param {string} className  CSS class for the bubble (e.g. 'demo-msg-user')
   * @param {string} html       Inner HTML content
   * @returns {HTMLDivElement}   The appended element
   */
  addMessage(className, html) {
    if (!this._el) return null;

    if (className.includes('demo-msg-user')) {
      const row = document.createElement('div');
      row.className = 'user-msg-row';
      const inner = document.createElement('div');
      inner.className = className;
      inner.setAttribute('data-msg-index', String(this._msgCounter++));
      inner.setAttribute('data-user-ordinal', String(this._userOrdinal++));
      inner.innerHTML = html;
      row.appendChild(inner);
      row.insertAdjacentHTML('beforeend', EDIT_BTN_HTML);
      row.style.opacity = '0';
      row.style.transform = 'translateY(12px) scale(0.98)';
      this._el.appendChild(row);
      row.offsetHeight;
      row.style.transition =
        'opacity 0.5s cubic-bezier(0.4, 0, 0.2, 1), ' +
        'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)';
      row.style.opacity = '1';
      row.style.transform = 'translateY(0) scale(1)';
      row.addEventListener('transitionend', function cleanup(e) {
        if (e.propertyName !== 'opacity') return;
        row.removeEventListener('transitionend', cleanup);
        row.style.removeProperty('opacity');
        row.style.removeProperty('transform');
        row.style.removeProperty('transition');
      });
      this._eventBus.emit('messageList:added', { className, element: row });
      return row;
    }

    const msg = document.createElement('div');
    msg.className = className;
    msg.setAttribute('data-msg-index', String(this._msgCounter++));

    if (className.includes('demo-msg-bot') || className.includes('assistant-response')) {
      html += REDO_BTN_HTML;
      html += '<div class="msg-feedback-row">' +
        '<button class="msg-feedback-btn keep" title="Keep these changes">\u2713</button>' +
        '<button class="msg-feedback-btn undo" title="Undo changes from this response">\u21A9</button>' +
        '<button class="msg-feedback-btn review" title="Review what changed">\uD83D\uDC41</button>' +
        '</div>';
    }

    msg.style.opacity = '0';
    msg.style.transform = 'translateY(12px) scale(0.98)';
    msg.innerHTML = html;
    this._el.appendChild(msg);

    msg.offsetHeight;

    msg.style.transition =
      'opacity 0.5s cubic-bezier(0.4, 0, 0.2, 1), ' +
      'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)';
    msg.style.opacity = '1';
    msg.style.transform = 'translateY(0) scale(1)';
    msg.addEventListener('transitionend', function cleanup(e) {
      if (e.propertyName !== 'opacity') return;
      msg.removeEventListener('transitionend', cleanup);
      msg.style.removeProperty('opacity');
      msg.style.removeProperty('transform');
      msg.style.removeProperty('transition');
    });

    this._eventBus.emit('messageList:added', { className, element: msg });
    return msg;
  }

  /**
   * Smooth-scroll to the bottom of the message container.
   * @param {'smooth'|'auto'} [behavior='smooth']
   */
  scrollToBottom(behavior = 'smooth') {
    if (!this._el) return;
    this._el.scrollTo({ top: this._el.scrollHeight, behavior });
  }

  /** Remove all child elements from the container. */
  clear() {
    if (!this._el) return;
    this._el.innerHTML = '';
    this._msgCounter = 0;
    this._userOrdinal = 0;
    this._eventBus.emit('messageList:cleared');
  }

  /** Returns and increments the message counter (used by external addMessageWithAnimation). */
  nextIndex() {
    return this._msgCounter++;
  }

  /** Returns and increments the user ordinal counter. */
  nextUserOrdinal() {
    return this._userOrdinal++;
  }

  /** Recount from the current DOM state (call after edit/redo removes messages). */
  recountFromDOM() {
    if (!this._el) return;
    this._msgCounter = this._el.querySelectorAll(
      '.demo-msg-user, .demo-msg-bot, .assistant-stream-footer'
    ).length;
    this._userOrdinal = this._el.querySelectorAll('.demo-msg-user').length;
  }

  /** Sets the counter (used when restoring a branched session). */
  setCounter(value) {
    this._msgCounter = value;
  }
}
