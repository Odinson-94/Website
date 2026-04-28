/**
 * AssistantMessage — streaming assistant output as sequential blocks in the chat
 * container. Each completed paragraph (`\n\n`) becomes its own
 * `.assistant-text-block` appended to `chatEl` so tools/agents can interleave.
 *
 * CHANGELOG:
 * 2026-03-26 | Chat containerization: Added _typingAnimationEnabled toggle
 *            | (default true) + setTypingAnimation(). Revived _ensureCursor()
 *            | to return a real blinking cursor span when enabled. Flushed
 *            | paragraph blocks get .animate-in class for fade-in entrance.
 */
import { EventBus } from '../../shared/EventBus.js';

const RENDER_DEBOUNCE_MS = 30;

const WRITE_TOOL_PATTERNS = [
  'execute_command', 'write_file',
  'update', 'apply', 'create', 'delete', 'set_',
  'parameter_editor_update', 'parameter_editor_apply',
  'family_swap',
];

export function isWriteTool(toolName) {
  if (!toolName) return false;
  const lower = toolName.toLowerCase();
  return WRITE_TOOL_PATTERNS.some(p => lower.includes(p));
}

export class AssistantMessage {
  /**
   * @param {import('../state/ChatState.js').ChatState} state
   * @param {import('./MessageParser.js').MessageParser} messageParser
   * @param {EventBus} eventBus
   */
  constructor(state, messageParser, eventBus) {
    this._state = state;
    this._parser = messageParser;
    this._eventBus = eventBus;
    /** @type {import('./MessageList.js').MessageList|null} */
    this._messageList = null;

    this._isStreaming = false;
    /** @type {string|null} Reserved message index for this assistant turn. */
    this._turnIndex = null;
    this._rawText = '';
    /** Number of complete `\n\n`-delimited paragraphs flushed to the DOM. */
    this._flushedParagraphCount = 0;
    /** @type {number|null} Debounce timer for incremental renders. */
    this._renderTimer = null;
    /** @type {HTMLDivElement|null} In-progress trailing paragraph + cursor. */
    this._liveBlockEl = null;
    /** @type {HTMLSpanElement|null} */
    this._cursorEl = null;

    this._typingAnimationEnabled = true;
  }

  /** Toggle typing animation (paragraph fade-in + blinking cursor). */
  setTypingAnimation(enabled) {
    this._typingAnimationEnabled = !!enabled;
  }

  get isStreaming() {
    return this._isStreaming;
  }

  /** Message index for the current turn (tools/agents tag DOM with this). */
  get turnIndex() {
    return this._turnIndex;
  }

  _chatEl() {
    return this._messageList?.element ?? null;
  }

  /**
   * Called when a new assistant response cycle starts (with `thinking`).
   * Reserves `data-msg-index` / `data-assistant-msg-index` for this turn.
   */
  beginTurn() {
    if (!this._messageList?.element) return;
    this._turnIndex = String(this._messageList.nextIndex());
    this._rawText = '';
    this._flushedParagraphCount = 0;
    this._clearLiveBlock();
    if (this._renderTimer) clearTimeout(this._renderTimer);
    this._renderTimer = null;
  }

  _clearLiveBlock() {
    if (this._liveBlockEl?.parentNode) {
      this._liveBlockEl.remove();
    }
    this._liveBlockEl = null;
    this._cursorEl = null;
  }

  /**
   * Marks streaming active (call on first token). No container element.
   */
  createBubble() {
    this._isStreaming = true;
    if (this._turnIndex == null && this._messageList) {
      this._turnIndex = String(this._messageList.nextIndex());
    }
    this._rawText = '';
    this._flushedParagraphCount = 0;
    this._clearLiveBlock();
    if (this._renderTimer) clearTimeout(this._renderTimer);
    this._renderTimer = null;
  }

  animateIn() {
    // Blocks animate individually; nothing to do for a virtual bubble.
  }

  /**
   * @param {string} text  Token fragment from the bridge.
   */
  appendToken(text) {
    if (!this._isStreaming || !this._chatEl()) return;

    this._rawText += text;

    if (this._renderTimer) clearTimeout(this._renderTimer);
    this._renderTimer = setTimeout(() => this._renderIncremental(), RENDER_DEBOUNCE_MS);
  }

  /**
   * Strip <thinking>...</thinking> blocks from text before rendering.
   * Handles complete blocks and truncates partial opening tags at the end.
   * @param {string} text
   * @returns {string}
   */
  _stripThinking(text) {
    let result = text.replace(/<thinking>[\s\S]*?<\/thinking>/g, '');
    const openIdx = result.lastIndexOf('<thinking>');
    if (openIdx !== -1 && result.indexOf('</thinking>', openIdx) === -1) {
      result = result.substring(0, openIdx);
    }
    return result;
  }

  _ensureCursor() {
    if (!this._typingAnimationEnabled) return null;
    if (!this._cursorEl) {
      this._cursorEl = document.createElement('span');
      this._cursorEl.className = 'streaming-cursor';
    }
    return this._cursorEl;
  }

  _renderIncremental() {
    const chatEl = this._chatEl();
    if (!chatEl || !this._isStreaming) return;

    const text = this._stripThinking(this._rawText);
    const lastBreak = text.lastIndexOf('\n\n');
    const completePrefix = lastBreak >= 0 ? text.substring(0, lastBreak) : '';
    const trailing = lastBreak >= 0 ? text.substring(lastBreak + 2) : text;

    const paragraphs = completePrefix.length > 0 ? completePrefix.split(/\n\n/) : [];

    while (this._flushedParagraphCount < paragraphs.length) {
      const chunk = paragraphs[this._flushedParagraphCount];
      this._flushedParagraphCount++;
      if (!chunk.trim()) continue;
      const div = document.createElement('div');
      div.className = 'assistant-text-block';
      if (this._typingAnimationEnabled) div.classList.add('animate-in');
      if (this._turnIndex != null) {
        div.setAttribute('data-msg-index', this._turnIndex);
        div.setAttribute('data-assistant-msg-index', this._turnIndex);
      }
      div.innerHTML = this._parser.renderMarkdown(chunk);
      if (this._liveBlockEl) {
        chatEl.insertBefore(div, this._liveBlockEl);
      } else {
        chatEl.appendChild(div);
      }
    }

    if (!trailing.length) {
      this._clearLiveBlock();
      return;
    }

    if (!this._liveBlockEl) {
      this._liveBlockEl = document.createElement('div');
      this._liveBlockEl.className = 'assistant-text-block streaming-live';
      if (this._turnIndex != null) {
        this._liveBlockEl.setAttribute('data-msg-index', this._turnIndex);
        this._liveBlockEl.setAttribute('data-assistant-msg-index', this._turnIndex);
      }
      chatEl.appendChild(this._liveBlockEl);
    }

    const cursor = this._ensureCursor();
    const p = document.createElement('p');
    p.className = 'streaming-trailing';
    p.innerHTML = this._parser.renderMarkdown(trailing);
    this._liveBlockEl.innerHTML = '';
    this._liveBlockEl.appendChild(p);
    if (cursor) this._liveBlockEl.appendChild(cursor);
  }

  /**
   * @param {string} [fullText]  Optional full response (non-streaming path).
   */
  finalize(fullText) {
    if (this._renderTimer) clearTimeout(this._renderTimer);
    this._renderTimer = null;

    const chatEl = this._chatEl();
    const raw = this._stripThinking(fullText ?? this._rawText);

    if (chatEl && this._turnIndex != null) {
      this._clearLiveBlock();

      const paragraphs = raw.length > 0 ? raw.split(/\n\n/) : [];
      while (this._flushedParagraphCount < paragraphs.length) {
        const chunk = paragraphs[this._flushedParagraphCount];
        this._flushedParagraphCount++;
        if (!chunk.trim()) continue;
        const div = document.createElement('div');
        div.className = 'assistant-text-block';
        div.setAttribute('data-msg-index', this._turnIndex);
        div.setAttribute('data-assistant-msg-index', this._turnIndex);
        div.innerHTML = this._parser.renderMarkdown(chunk);
        chatEl.appendChild(div);
      }

      const turnIdx = this._turnIndex;
      this._eventBus.emit('assistantMessage:finalized', { turnIndex: turnIdx, text: raw });
    }

    this._isStreaming = false;
    this._turnIndex = null;
    this._rawText = '';
    this._flushedParagraphCount = 0;
    this._cursorEl = null;
  }

  /**
   * Flush accumulated text to the DOM without ending the turn.
   * Used when a tool block needs to be inserted chronologically between text segments.
   */
  flushSegment() {
    if (this._renderTimer) clearTimeout(this._renderTimer);
    this._renderTimer = null;

    const chatEl = this._chatEl();
    if (!chatEl) return;

    this._clearLiveBlock();

    const raw = this._stripThinking(this._rawText);
    const paragraphs = raw.length > 0 ? raw.split(/\n\n/) : [];
    while (this._flushedParagraphCount < paragraphs.length) {
      const chunk = paragraphs[this._flushedParagraphCount];
      this._flushedParagraphCount++;
      if (!chunk.trim()) continue;
      const div = document.createElement('div');
      div.className = 'assistant-text-block';
      if (this._turnIndex != null) {
        div.setAttribute('data-msg-index', this._turnIndex);
        div.setAttribute('data-assistant-msg-index', this._turnIndex);
      }
      div.innerHTML = this._parser.renderMarkdown(chunk);
      chatEl.appendChild(div);
    }

    this._rawText = '';
    this._flushedParagraphCount = 0;
  }

  /**
   * Remove all DOM nodes for the current turn and reset state.
   */
  discard() {
    if (this._renderTimer) clearTimeout(this._renderTimer);
    this._renderTimer = null;

    const chatEl = this._chatEl();
    const idx = this._turnIndex;
    if (chatEl && idx != null) {
      chatEl.querySelectorAll(`[data-assistant-msg-index="${idx}"]`)
        .forEach(el => el.remove());
    } else if (this._liveBlockEl?.parentNode) {
      this._liveBlockEl.remove();
    }

    this._isStreaming = false;
    this._turnIndex = null;
    this._rawText = '';
    this._flushedParagraphCount = 0;
    this._liveBlockEl = null;
    this._cursorEl = null;
  }
}
