/**
 * ChatSurface — session-scoped container for the chat viewport.
 *
 * Owns MessageList + ChatStructure, holds a monotonic epoch counter that
 * increments on every session switch, and exposes teardown/snapshot/restore
 * so ChatSessionsStore never touches the DOM directly.
 *
 * The epoch pattern kills ALL async bleed vectors: every bridge handler
 * captures the epoch at entry, and bails if it has changed by the time
 * an async gap completes.
 *
 * CHANGELOG:
 * 2026-03-26 | Created. Owns epoch counter, teardown() (stops C# stream,
 *            | clears all timers/intervals, resets AssistantMessage /
 *            | ThinkingStep / NeuralNode state), snapshot(), restore(),
 *            | bind(), epochValid(). Wired into ChatApp constructor and
 *            | ChatSessionsStore.load() for bleed-free session switching.
 */
export class ChatSurface {
  /**
   * @param {object} deps
   * @param {object}  deps.app             ChatApp instance
   * @param {object}  deps.bridge          WebViewBridge
   * @param {object}  deps.messageList     MessageList
   * @param {object}  deps.chatStructure   ChatStructure
   */
  constructor({ app, bridge, messageList, chatStructure }) {
    this._app = app;
    this._bridge = bridge;
    this._messageList = messageList;
    this._chatStructure = chatStructure;
    this._activeSessionId = null;
    this._epoch = 0;
  }

  get epoch()           { return this._epoch; }
  get activeSessionId() { return this._activeSessionId; }
  get messageList()     { return this._messageList; }
  get stream()          { return this._chatStructure.stream; }

  /** Returns true when the captured epoch still matches the current one. */
  epochValid(captured) {
    return (captured ?? this._epoch) === this._epoch;
  }

  /** Bind a session id to this surface (called after restore). */
  bind(sessionId) {
    this._activeSessionId = sessionId;
  }

  /**
   * Tear down all in-flight streaming state before a session switch.
   * Increments epoch so stale async chains self-cancel.
   */
  teardown() {
    this._epoch++;

    this._bridge.postMessage('stop', '');

    const ctrl = this._chatStructure.stream;
    const am = ctrl._assistantMessage;
    if (am._renderTimer) clearTimeout(am._renderTimer);
    am._renderTimer = null;
    am._isStreaming = false;
    am._rawText = '';
    am._liveBlockEl = null;
    am._cursorEl = null;
    am._flushedParagraphCount = 0;

    const ts = ctrl._thinkingStep;
    if (ts.activeContainer) {
      clearInterval(ts.activeContainer._durationInterval);
      clearInterval(ts.activeContainer._phaseInterval);
      ts.activeContainer = null;
    }
    ts._stepQueue = [];
    ts._isProcessingSteps = false;
    ts.thinkingStartTime = null;

    if (ctrl._thinkingFlushTimer) {
      clearTimeout(ctrl._thinkingFlushTimer);
      ctrl._thinkingFlushTimer = null;
    }

    ctrl._agentBatch = null;
    ctrl._needNewThinkingContainer = false;
    ctrl._turnHasWriteTools = false;

    const node = document.getElementById('chatPersistentNodeIndex6');
    if (node) node.classList.remove('processing', 'left');

    this._app._thinkingBuffer = '';
    this._app._streamStartTime = null;
    this._app._tokenCount = 0;
    this._app._charCount = 0;
    this._app.state.setGenerating(false);
    this._app.state.setSending(false);
  }

  /**
   * Snapshot the current viewport state for the outgoing session.
   * @returns {{ html: string, draft: string, taskData: string, msgCounter: number, userOrdinal: number }}
   */
  snapshot() {
    const el = this._messageList.element;
    const inputEl = document.getElementById('chatInputIndex6');
    const taskPanel = document.getElementById('stickyTaskPanel');
    return {
      html: el?.innerHTML ?? '',
      draft: (inputEl?.textContent ?? inputEl?.value ?? '').trim(),
      taskData: taskPanel?.dataset?.taskData ?? '',
      msgCounter: this._messageList._msgCounter,
      userOrdinal: this._messageList._userOrdinal,
    };
  }

  /**
   * Restore an incoming session's state into the viewport.
   * @param {{ html?: string, draft?: string, msgCounter?: number, userOrdinal?: number }} snap
   */
  restore(snap) {
    const el = this._messageList.element;
    if (el) el.innerHTML = snap.html || '';

    const inputEl = document.getElementById('chatInputIndex6');
    if (inputEl) {
      if (inputEl.textContent !== undefined) inputEl.textContent = snap.draft || '';
      else inputEl.value = snap.draft || '';
    }

    this._messageList._msgCounter = snap.msgCounter || 0;
    this._messageList._userOrdinal = snap.userOrdinal || 0;
  }
}
