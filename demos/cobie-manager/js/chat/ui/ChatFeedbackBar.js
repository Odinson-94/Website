import { REDO_BTN_HTML } from '../messages/MessageList.js';

/**
 * Response-actions strip for the last completed assistant turn (Redo always; Keep/Undo/Review only after a write tool).
 * Anchored in `.chat-composer-stack`: `position:absolute; bottom:100%` over the input row,
 * slides up (CSS) when `.chat-feedback-bar--open` is set — not inside #chatMessagesIndex6.
 * Shown when assistantMessage:finalized fires.
 */
export class ChatFeedbackBar {
  /**
   * @param {import('../../shared/EventBus.js').EventBus} eventBus
   */
  constructor(eventBus) {
    this._bar = document.getElementById('chatFeedbackBar');
    this._inner = this._bar?.querySelector('.chat-feedback-bar-inner');
    if (!this._bar || !this._inner) return;

    eventBus.on('assistantMessage:finalized', (data) => {
      const idx = data?.turnIndex;
      if (idx == null) return;
      this._show(String(idx));
    });

    this._bar.addEventListener('click', (e) => {
      const t = e.target;
      if (t.closest('.chat-feedback-bar-collapse')) {
        this._bar.classList.toggle('collapsed');
      }
    });
  }

  hide() {
    if (!this._bar) return;
    const bar = this._bar;
    if (!bar.classList.contains('chat-feedback-bar--open')) {
      bar.removeAttribute('data-assistant-turn-index');
      bar.setAttribute('aria-hidden', 'true');
      return;
    }
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      bar.removeEventListener('transitionend', onEnd);
      clearTimeout(fallback);
      bar.removeAttribute('data-assistant-turn-index');
      bar.setAttribute('aria-hidden', 'true');
    };
    const onEnd = (e) => {
      if (e.propertyName !== 'transform' && e.propertyName !== 'opacity') return;
      finish();
    };
    bar.addEventListener('transitionend', onEnd);
    const fallback = window.setTimeout(finish, 400);
    bar.classList.remove('chat-feedback-bar--open');
  }

  _show(turnIndex) {
    const hasWriteTools = this._bar.dataset.hasWriteTools === 'true';
    // §B-1: honour the live undo count broadcast by CallClaudeApi's
    // __UNDO_SUMMARY__ message so the button can't silently no-op.
    const undoCountRaw = parseInt(this._bar.dataset.undoCount || '0', 10);
    const undoCount = Number.isFinite(undoCountRaw) ? undoCountRaw : 0;
    const hasNonRevitWrites = this._bar.dataset.hasNonRevitWrites === 'true';

    let buttonsHtml = REDO_BTN_HTML;
    if (hasWriteTools) {
      const undoDisabled = undoCount <= 0;
      const undoTitle = undoDisabled
        ? (hasNonRevitWrites
            ? 'Nothing to undo in Revit (file / web writes aren\u2019t rolled back automatically)'
            : 'Nothing to undo for this response')
        : 'Undo changes from this response';
      buttonsHtml +=
        '<div class="msg-feedback-row">' +
        '<button type="button" class="msg-feedback-btn keep" title="Keep these changes">\u2713</button>' +
        '<button type="button" class="msg-feedback-btn undo' + (undoDisabled ? ' is-disabled' : '') + '"' +
        (undoDisabled ? ' disabled="disabled"' : '') +
        ' title="' + undoTitle + '">\u21A9</button>' +
        '<button type="button" class="msg-feedback-btn review" title="Review what changed">\uD83D\uDC41</button>' +
        '</div>';
    }

    this._inner.innerHTML =
      '<button type="button" class="chat-feedback-bar-collapse" title="Collapse" aria-expanded="true">▾</button>' +
      '<span class="chat-feedback-bar-label">Response actions</span>' +
      buttonsHtml;
    this._bar.dataset.assistantTurnIndex = turnIndex;
    this._bar.setAttribute('aria-hidden', 'false');
    this._bar.classList.remove('chat-feedback-bar--open');
    void this._bar.offsetWidth;
    window.requestAnimationFrame(() => {
      this._bar.classList.add('chat-feedback-bar--open');
    });
  }
}
