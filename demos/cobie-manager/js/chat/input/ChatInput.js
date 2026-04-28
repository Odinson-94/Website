/**
 * ChatInput — Manages the contenteditable chat input field (#chatInputIndex6).
 *
 * Responsibilities:
 *   - Enter-to-send (delegates via SendButton click)
 *   - "/" skill palette trigger (emits slash-trigger / slash-dismiss on EventBus)
 *   - "@" mention palette trigger (emits mention-trigger / mention-dismiss on EventBus)
 *   - Arrow key navigation when skill/mention palette is open
 *   - Focus / placeholder / cursor-position behavior
 *   - getText / clear / disable / enable API
 *
 * Clipboard operations (paste, image, long-text file upload) are handled
 * by ClipboardHandler, which is attached during init.
 */
import { ClipboardHandler } from './ClipboardHandler.js';

export class ChatInput {
  /** @param {import('../state/ChatState.js').ChatState} state */
  /** @param {import('../bridge/WebViewBridge.js').WebViewBridge} bridge */
  constructor(state, bridge) {
    this._state = state;
    this._bridge = bridge;
    this._el = document.getElementById('chatInputIndex6');
    this._disabled = false;
    this.clipboard = null;
    this._eventBus = null;
    this._skillPalette = null;
    this._mentionPalette = null;

    if (this._el) this._attach();
  }

  /**
   * Late-bind EventBus + palettes after ChatApp wires everything.
   * @param {import('../../shared/EventBus.js').EventBus} eventBus
   * @param {import('../commands/SkillPalette.js').SkillPalette} skillPalette
   * @param {import('../commands/MentionPalette.js').MentionPalette} [mentionPalette]
   */
  setEventBus(eventBus, skillPalette, mentionPalette) {
    this._eventBus = eventBus;
    this._skillPalette = skillPalette;
    this._mentionPalette = mentionPalette || null;
  }

  getText() {
    if (!this._el) return '';
    return (this._el.value ?? this._el.textContent ?? '').trim();
  }

  clear() {
    if (!this._el) return;
    if (this._el.value !== undefined && this._el.tagName === 'INPUT') {
      this._el.value = '';
    } else {
      this._el.textContent = '';
    }
  }

  focus() {
    this._el?.focus();
  }

  disable() {
    this._disabled = true;
    if (this._el) {
      this._el.setAttribute('contenteditable', 'false');
      this._el.style.opacity = '0.5';
    }
  }

  enable() {
    this._disabled = false;
    if (this._el) {
      this._el.setAttribute('contenteditable', 'true');
      this._el.style.opacity = '';
    }
  }

  _attach() {
    const el = this._el;

    el.setAttribute('spellcheck', 'true');
    el.setAttribute('lang', 'en');

    el.addEventListener('click', () => el.focus());

    el.addEventListener('focus', () => {
      if (el.textContent.trim() !== '') return;
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    });

    el.addEventListener('keydown', (e) => {
      if (this._disabled) return;

      if (this._skillPalette?.isVisible) {
        if (e.key === 'ArrowUp') { e.preventDefault(); this._skillPalette.navigateUp(); return; }
        if (e.key === 'ArrowDown') { e.preventDefault(); this._skillPalette.navigateDown(); return; }
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          if (!this._skillPalette.confirmSelection()) {
            this._skillPalette.navigateDown();
            this._skillPalette.confirmSelection();
          }
          return;
        }
        if (e.key === 'Escape') { e.preventDefault(); this._skillPalette.hide(); return; }
      }

      if (this._mentionPalette?.isVisible) {
        if (e.key === 'ArrowUp') { e.preventDefault(); this._mentionPalette.navigateUp(); return; }
        if (e.key === 'ArrowDown') { e.preventDefault(); this._mentionPalette.navigateDown(); return; }
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          if (!this._mentionPalette.confirmSelection()) {
            this._mentionPalette.navigateDown();
            this._mentionPalette.confirmSelection();
          }
          return;
        }
        if (e.key === 'Escape') { e.preventDefault(); this._mentionPalette.hide(); return; }
      }

      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const sendBtn = document.getElementById('chatSendIndex6');
        if (sendBtn) sendBtn.click();
      }
    });

    el.addEventListener('input', () => {
      this._checkSlash();
      this._checkMention();
    });

    this.clipboard = new ClipboardHandler(this._bridge, el);
    this.clipboard.attachPasteListener();
  }

  _checkSlash() {
    if (!this._eventBus) {
      console.error('[ChatInput] SLASH-H1: _eventBus is null in _checkSlash — setEventBus() not called');
      return;
    }
    const text = (this._el.textContent || '').trimStart();
    if (text.startsWith('/')) {
      const query = text.slice(1);
      this._eventBus.emit('slash-trigger', { query });
      console.error('[ChatInput] SLASH-TRACE: emitted slash-trigger, query=' + query.substring(0, 30));
    } else {
      this._eventBus.emit('slash-dismiss');
    }
  }

  _checkMention() {
    if (!this._eventBus) return;
    const text = this._el.textContent || '';
    const atIndex = text.lastIndexOf('@');
    if (atIndex >= 0) {
      const afterAt = text.substring(atIndex + 1);
      if (!/\s/.test(afterAt) || afterAt.length === 0) {
        this._eventBus.emit('mention-trigger', { query: afterAt });
        return;
      }
    }
    this._eventBus.emit('mention-dismiss');
  }
}
