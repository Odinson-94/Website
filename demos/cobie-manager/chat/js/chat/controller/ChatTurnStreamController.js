/**
 * ChatTurnStreamController — bridge-driven ordering of one assistant turn:
 * thinking chrome, tool HTML, streamed text (via AssistantMessage), agent blocks, and response finalization.
 *
 * Held by ChatStructure (`js/chat/structure/ChatStructure.js`); segment order: CHAT_TURN_ORDER.
 * ChatApp wires bridge handlers to `chatStructure.stream.*`.
 *
 * CHANGELOG:
 * 2026-03-26 | Chat containerization: Added setSurface(), _captureEpoch(),
 *            | _epochValid() for session-epoch guard pattern. Every handler
 *            | (onToken, onThought, onThinkingDelta, onResponse, onError,
 *            | onThinkingComplete, onStatusGenerationStopped, onAgentSpawned,
 *            | onAgentCompleted, onAgentCancelled, onAgentStep, foldAndReset)
 *            | now checks epoch before DOM writes; async chains bail on
 *            | mismatch. _foldThinking() now skips sleep(500) when there is
 *            | no activeContainer (fixes first-message suggestions). Added
 *            | 2s timeout fallback on transitionend promise in onResponse().
 */
import { sleep } from '../messages/ThinkingStepMessage.js';
import { isWriteTool } from '../messages/AssistantMessage.js';

const MIN_TOTAL_TIME = 1000;

export class ChatTurnStreamController {
  /**
   * @param {object} deps
   * @param {object} deps.app  ChatApp instance
   * @param {import('../bridge/WebViewBridge.js').WebViewBridge} deps.bridge
   * @param {import('../messages/MessageList.js').MessageList} deps.messageList
   * @param {import('../messages/AssistantMessage.js').AssistantMessage} deps.assistantMessage
   * @param {import('../messages/ThinkingStepMessage.js').ThinkingStepMessage} deps.thinkingStep
   * @param {import('../messages/MessageParser.js').MessageParser} deps.messageParser
   * @param {import('../messages/ToolProgressBlock.js').ToolProgressBlock} deps.toolProgress
   * @param {import('../messages/ErrorMessage.js').ErrorMessage} deps.errorMessage
   * @param {import('../commands/CommandSuggestions.js').CommandSuggestions} deps.commandSuggestions
   */
  constructor(deps) {
    this._app = deps.app;
    this._bridge = deps.bridge;
    this._messageList = deps.messageList;
    this._assistantMessage = deps.assistantMessage;
    this._thinkingStep = deps.thinkingStep;
    this._messageParser = deps.messageParser;
    this._toolProgress = deps.toolProgress;
    this._errorMessage = deps.errorMessage;
    this._commandSuggestions = deps.commandSuggestions;
    /** @type {import('../surface/ChatSurface.js').ChatSurface|null} */
    this._surface = null;

    // Handle visibility change — scroll to bottom when user returns to the app
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        // Small delay to let WebView2 re-render
        setTimeout(() => {
          this._messageList.scrollToBottom();
          // If we were streaming, force a render of current state
          if (this._assistantMessage.isStreaming) {
            this._assistantMessage._renderIncremental?.();
          }
        }, 100);
      }
    });
  }

  /** @param {import('../surface/ChatSurface.js').ChatSurface} surface */
  setSurface(surface) { this._surface = surface; }

  _captureEpoch() { return this._surface ? this._surface.epoch : -1; }
  _epochValid(captured) { return this._surface ? this._surface.epochValid(captured) : true; }

  _chatEl() {
    return this._messageList.element;
  }

  _nodeEl() {
    return document.getElementById('chatPersistentNodeIndex6');
  }

  async _waitForSteps() {
    const ts = this._thinkingStep;
    while (ts._stepQueue.length > 0 || ts._isProcessingSteps) {
      await sleep(50);
    }
  }

  async _foldThinking() {
    const ts = this._thinkingStep;
    if (ts.activeContainer) {
      const dur = ts.thinkingStartTime ? Date.now() - ts.thinkingStartTime : 0;
      ts.finishThinkingIndicator(ts.activeContainer, dur);
      ts.activeContainer = null;
      await sleep(500);
    }
  }

  _resetNode() {
    const node = this._nodeEl();
    if (node) node.classList.remove('processing', 'left');
  }

  /**
   * @param {() => void|Promise<void>} [fn]
   */
  async foldAndReset(fn) {
    const epoch = this._captureEpoch();
    await this._waitForSteps();
    if (!this._epochValid(epoch)) return;
    await this._foldThinking();
    if (!this._epochValid(epoch)) return;
    this._resetNode();
    if (fn) await fn();
    if (!this._epochValid(epoch)) return;
    this._thinkingStep.thinkingStartTime = null;
    this._app._resetSendingState();
  }

  flushThinkingBuffer() {
    if (this._thinkingFlushTimer) {
      clearTimeout(this._thinkingFlushTimer);
      this._thinkingFlushTimer = null;
    }
    const app = this._app;
    const ts = this._thinkingStep;
    if (app._thinkingBuffer && app._thinkingBuffer.trim().length > 0 && ts.activeContainer) {
      ts.queueStep(app._thinkingBuffer.trim());
    }
    app._thinkingBuffer = '';
  }

  onThinking() {
    const app = this._app;
    const assistantMessage = this._assistantMessage;
    const thinkingStep = this._thinkingStep;
    const chatEl = this._chatEl();

    app.state.setGenerating(true);
    thinkingStep.resetQueue();
    this._turnHasWriteTools = false;
    app._thinkingBuffer = '';
    app._tokenCount = 0;
    app._charCount = 0;
    app._streamStartTime = null;

    if (assistantMessage.isStreaming) assistantMessage.discard();

    assistantMessage.beginTurn();

    thinkingStep.thinkingStartTime = Date.now();
    thinkingStep.activeContainer = thinkingStep.createThinkingIndicator(chatEl);

    const node = this._nodeEl();
    if (node) {
      node.classList.add('processing');
      setTimeout(() => node.classList.add('left'), 150);
    }
  }

  onThought(data) {
    if (!this._epochValid(this._captureEpoch())) return;
    const app = this._app;
    const assistantMessage = this._assistantMessage;
    const thinkingStep = this._thinkingStep;
    const chatEl = this._chatEl();

    if (data.message && data.message.startsWith('__TOOL_START__')) {
      if (assistantMessage.isStreaming) {
        assistantMessage.flushSegment();
      }

      const payload = data.message.replace('__TOOL_START__', '');
      const sep = payload.indexOf('|');
      const toolName = sep >= 0 ? payload.slice(0, sep) : payload;
      const desc = sep >= 0 ? payload.slice(sep + 1) : '';
      const blockHtml = this._toolProgress.createBlockHtml(
        toolName,
        desc || toolName,
        assistantMessage.turnIndex
      );
      chatEl.insertAdjacentHTML('beforeend', blockHtml);
      this._messageList.scrollToBottom();
      return;
    }
    if (data.message && data.message.startsWith('__TOOL_END__')) {
      const payload = data.message.replace('__TOOL_END__', '');
      const sep = payload.indexOf('|');
      const toolName = sep >= 0 ? payload.slice(0, sep) : payload;
      const summary = sep >= 0 ? payload.slice(sep + 1) : '';
      const block = this._toolProgress.completeBlock(
        chatEl,
        toolName,
        summary || 'Done'
      );
      if (isWriteTool(toolName) && block) {
        this._turnHasWriteTools = true;
        this._toolProgress.appendFeedbackButtons(block);
      }
      this._needNewThinkingContainer = true;
      return;
    }
    if (data.message && data.message.startsWith('__TOOL_CACHED_HIT__')) {
      // §B-2 polish: annotate a cache-hit write-like tool so the absence of
      // an Undo button doesn't look like a bug.
      const toolName = data.message.replace('__TOOL_CACHED_HIT__', '').trim();
      try {
        const blocks = chatEl.querySelectorAll('.tool-progress-stack');
        const block = blocks[blocks.length - 1];
        if (block && (!toolName || (block.getAttribute('data-tool') || '').toLowerCase() === toolName.toLowerCase())) {
          const note = document.createElement('div');
          note.className = 'tool-progress-cached-note';
          note.style.cssText = 'font-size:11px;opacity:0.65;margin-top:4px;font-style:italic';
          note.textContent = '(cached \u2014 nothing to undo in Revit)';
          block.appendChild(note);
        }
      } catch (e) { console.warn('[ChatTurnStreamController] cached-hit annotate failed:', e?.message); }
      return;
    }
    if (data.message && data.message.startsWith('__TOOL_UNDO_REF__')) {
      const payload = data.message.replace('__TOOL_UNDO_REF__', '');
      const sep = payload.indexOf('|');
      const toolName = sep >= 0 ? payload.slice(0, sep) : payload;
      const slot = sep >= 0 ? parseInt(payload.slice(sep + 1), 10) : NaN;
      if (!Number.isNaN(slot)) {
        this._toolProgress.attachUndoRef(chatEl, toolName, slot);
        this._messageList.scrollToBottom();
      }
      return;
    }
    if (data.message && data.message.startsWith('__TOOL_STATUS__')) {
      const payload = data.message.replace('__TOOL_STATUS__', '');
      const sep = payload.indexOf('|');
      const toolName = sep >= 0 ? payload.slice(0, sep) : payload;
      const statusText = sep >= 0 ? payload.slice(sep + 1) : '';
      if (statusText) {
        this._toolProgress.updateStatus(chatEl, toolName, statusText);
        this._messageList.scrollToBottom();
      }
      return;
    }
    // §B-1: end-of-turn summary from CallClaudeApi. Format: __UNDO_SUMMARY__{count}|{hasNonRevitWrites}
    if (data.message && data.message.startsWith('__UNDO_SUMMARY__')) {
      try {
        const payload = data.message.replace('__UNDO_SUMMARY__', '');
        const sep = payload.indexOf('|');
        const count = parseInt(sep >= 0 ? payload.slice(0, sep) : payload, 10);
        const hasNonRevit = sep >= 0 && payload.slice(sep + 1) === '1';
        // Expose on the feedback bar element so ChatFeedbackBar can honour it
        // even if the bar is rendered before this event fires.
        const bar = document.getElementById('chatFeedbackBar');
        if (bar) {
          bar.dataset.undoCount = String(Number.isFinite(count) ? count : 0);
          bar.dataset.hasWriteTools = count > 0 ? 'true' : bar.dataset.hasWriteTools || 'false';
          bar.dataset.hasNonRevitWrites = hasNonRevit ? 'true' : 'false';
        }
        // Live toggle any existing Undo buttons (belt + braces if the bar already rendered).
        document.querySelectorAll('.msg-feedback-btn.undo').forEach((btn) => {
          if (!Number.isFinite(count) || count <= 0) {
            btn.setAttribute('disabled', 'disabled');
            btn.title = hasNonRevit
              ? 'Nothing to undo in Revit (file / web writes aren\u2019t rolled back automatically)'
              : 'Nothing to undo for this response';
            btn.classList.add('is-disabled');
          } else {
            btn.removeAttribute('disabled');
            btn.classList.remove('is-disabled');
            btn.title = 'Undo changes from this response';
          }
        });
      } catch (e) {
        console.warn('[ChatTurnStreamController] __UNDO_SUMMARY__ parse failed:', e?.message);
      }
      return;
    }
    if (data.message) {
      if (this._needNewThinkingContainer || !thinkingStep.activeContainer) {
        if (thinkingStep.activeContainer) thinkingStep.completeThinkingIndicator();
        thinkingStep.activeContainer = thinkingStep.createThinkingIndicator(chatEl);
        this._needNewThinkingContainer = false;
      }
      thinkingStep.queueStep(data.message);
    }
  }

  onThinkingDelta(data) {
    if (!this._epochValid(this._captureEpoch())) return;
    const app = this._app;
    const thinkingStep = this._thinkingStep;
    if (!data.message) return;

    if (this._needNewThinkingContainer || !thinkingStep.activeContainer) {
      const chatEl = this._chatEl();
      if (thinkingStep.activeContainer) thinkingStep.completeThinkingIndicator();
      thinkingStep.activeContainer = thinkingStep.createThinkingIndicator(chatEl);
      this._needNewThinkingContainer = false;
    }

    app._thinkingBuffer += data.message;

    const lines = app._thinkingBuffer.split('\n');
    app._thinkingBuffer = lines.pop();

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.length > 0) {
        const cleaned = trimmed.replace(/^\d+\.\s*/, '').replace(/^[-*]\s*/, '');
        if (cleaned.length > 0) {
          thinkingStep.queueStep(cleaned);
        }
      }
    }

    if (this._thinkingFlushTimer) clearTimeout(this._thinkingFlushTimer);
    this._thinkingFlushTimer = setTimeout(() => {
      if (app._thinkingBuffer && app._thinkingBuffer.trim().length > 0 && thinkingStep.activeContainer) {
        thinkingStep.queueStep(app._thinkingBuffer.trim());
        app._thinkingBuffer = '';
      }
      this._thinkingFlushTimer = null;
    }, 500);
  }

  onThinkingStep(data) {
    const thinkingStep = this._thinkingStep;
    if (thinkingStep.activeContainer && data.message) {
      thinkingStep.queueStep(data.message);
    }
  }

  onThinkingComplete() {
    (async () => {
      const epoch = this._captureEpoch();
      await this._waitForSteps();
      if (!this._epochValid(epoch)) return;
      await this._foldThinking();
      if (!this._epochValid(epoch)) return;
      this._resetNode();
      this._thinkingStep.thinkingStartTime = null;
      this._app.state.setGenerating(false);
    })();
  }

  onToken(data) {
    if (!this._epochValid(this._captureEpoch())) return;
    const app = this._app;
    const bridge = this._bridge;
    const assistantMessage = this._assistantMessage;

    this.flushThinkingBuffer();

    if (data.message) {
      if (!app._streamStartTime) app._streamStartTime = Date.now();
      if (!app._charCount) app._charCount = 0;
      app._charCount += data.message.length;
      app._tokenCount = Math.round(app._charCount / 4);
      const elapsed = (Date.now() - app._streamStartTime) / 1000;
      const speed = elapsed > 0 ? app._tokenCount / elapsed : 0;
      bridge.postMessage('token_stats', JSON.stringify({ used: app._tokenCount, speed }));

      if (!assistantMessage.isStreaming) {
        assistantMessage.createBubble();
      }
      assistantMessage.appendToken(data.message);
      this._messageList.scrollToBottom();
    }
  }

  onResponseChunk(data) {
    this.onToken(data);
  }

  onResponse(data) {
    const app = this._app;
    const bridge = this._bridge;
    const assistantMessage = this._assistantMessage;
    const thinkingStep = this._thinkingStep;
    const messageList = this._messageList;
    const messageParser = this._messageParser;

    (async () => {
      const epoch = this._captureEpoch();

      if (app._streamStartTime && app._tokenCount > 0) {
        const elapsed = (Date.now() - app._streamStartTime) / 1000;
        const speed = elapsed > 0 ? app._tokenCount / elapsed : 0;
        bridge.postMessage('token_stats', JSON.stringify({ used: app._tokenCount, speed }));
      }

      const elapsed = thinkingStep.thinkingStartTime
        ? Date.now() - thinkingStep.thinkingStartTime : 0;
      const remainingMin = Math.max(0, MIN_TOTAL_TIME - elapsed);

      await this._waitForSteps();
      if (!this._epochValid(epoch)) return;
      if (remainingMin > 0) await sleep(remainingMin);
      if (!this._epochValid(epoch)) return;

      const thinkDuration = thinkingStep.thinkingStartTime
        ? Date.now() - thinkingStep.thinkingStartTime : 0;

      if (thinkingStep.activeContainer) {
        thinkingStep.finishThinkingIndicator(thinkingStep.activeContainer, thinkDuration);
        thinkingStep.activeContainer = null;
      }
      await sleep(500);
      if (!this._epochValid(epoch)) return;

      if (assistantMessage.isStreaming) {
        const feedbackBar = document.getElementById('chatFeedbackBar');
        if (feedbackBar) {
          feedbackBar.dataset.hasWriteTools = String(this._turnHasWriteTools || false);
        }
        assistantMessage.finalize();
        messageList.scrollToBottom();
      } else if (data.message) {
        messageList.addMessage('demo-msg-bot',
          '<p>' + messageParser.renderMarkdown(data.message) + '</p>');
        messageList.scrollToBottom();
      }

      await sleep(600);
      if (!this._epochValid(epoch)) return;

      const node = this._nodeEl();
      if (node) {
        const nodeArrivedRight = new Promise(resolve => {
          const timeout = setTimeout(resolve, 2000);
          const onArrived = (e) => {
            if (e.propertyName !== 'margin-left') return;
            node.removeEventListener('transitionend', onArrived);
            clearTimeout(timeout);
            resolve();
          };
          node.addEventListener('transitionend', onArrived);
        });

        node.classList.remove('left');
        await nodeArrivedRight;
        if (!this._epochValid(epoch)) return;
        await sleep(800);
        if (!this._epochValid(epoch)) return;
        node.classList.remove('processing');
      }

      thinkingStep.thinkingStartTime = null;
      app.state.setGenerating(false);
      app._resetSendingState();
    })();
  }

  onError(data) {
    if (!this._epochValid(this._captureEpoch())) return;
    const assistantMessage = this._assistantMessage;
    const thinkingStep = this._thinkingStep;
    const chatEl = this._chatEl();

    this._toolProgress.failOpenBlocks(chatEl, data.message || 'Error');

    const node = this._nodeEl();
    if (node) node.classList.remove('processing', 'left');

    if (thinkingStep.activeContainer) {
      thinkingStep.activeContainer.remove();
      thinkingStep.activeContainer = null;
    }

    this._errorMessage.appendTo(chatEl, data.message || 'Error');
    thinkingStep.thinkingStartTime = null;
    this._app.state.setGenerating(false);
    this._app._resetSendingState();
  }

  onStatusGenerationStopped() {
    (async () => {
      const epoch = this._captureEpoch();
      this._toolProgress.failOpenBlocks(this._chatEl(), 'Generation stopped');
      await this._waitForSteps();
      if (!this._epochValid(epoch)) return;
      await this._foldThinking();
      if (!this._epochValid(epoch)) return;
      this._resetNode();
      this._thinkingStep.thinkingStartTime = null;
      if (this._assistantMessage.isStreaming) {
        const feedbackBar = document.getElementById('chatFeedbackBar');
        if (feedbackBar) {
          feedbackBar.dataset.hasWriteTools = String(this._turnHasWriteTools || false);
        }
        this._assistantMessage.finalize();
      }
      this._app._resetSendingState();
    })();
  }

  onAgentSpawned(data) {
    if (!this._epochValid(this._captureEpoch())) return;
    const app = this._app;
    const thinkingStep = this._thinkingStep;
    const assistantMessage = this._assistantMessage;

    if (!data.agentId || !data.task) return;

    if (!this._agentBatch) this._agentBatch = { ids: [], turn: null };
    this._agentBatch.ids.push(data.agentId);
    this._agentBatch.turn = assistantMessage.turnIndex ?? '';

    app.state.addAgent({
      agentId: data.agentId,
      task: data.task,
      mode: data.mode || 'Build',
      status: 'running',
      parentSessionId: app.chatSessionsStore.getCurrent()
    });

    const chatContainer = this._chatEl();
    if (!chatContainer) return;

    const turn = assistantMessage.turnIndex ?? '';
    const idxAttr = turn !== '' ? ` data-assistant-msg-index="${turn}"` : '';

    let batchContainer = chatContainer.querySelector('.agent-batch-container:not(.batch-complete)');
    if (!batchContainer) {
      const batchHtml =
        `<div class="agent-batch-container"${idxAttr}>` +
          '<div class="agent-batch-header">' +
            '<div class="pulsing-node"></div>' +
            '<span class="agent-batch-title">Employing agents</span>' +
            '<span class="agent-batch-count"></span>' +
          '</div>' +
          '<div class="agent-batch-list"></div>' +
          '<div class="agent-batch-summary" style="display:none"></div>' +
        '</div>';
      chatContainer.insertAdjacentHTML('beforeend', batchHtml);
      batchContainer = chatContainer.querySelector('.agent-batch-container:not(.batch-complete)');
    }

    const batchList = batchContainer.querySelector('.agent-batch-list');
    const taskEsc = app.messageParser.escapeHtml(data.task);
    const modeEsc = app.messageParser.escapeHtml(data.mode || 'Build');
    const agentIdAttr = String(data.agentId).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    const agentHtml =
      `<div class="agent-batch-item agent-employ-card" data-agent-id="${agentIdAttr}">` +
        `<div class="thinking-container visible agent-employ-thinking" data-agent-id="${agentIdAttr}">` +
          '<div class="thinking-header">' +
            '<div class="thinking-header-left">' +
              '<div class="pulsing-node"></div>' +
              '<span class="steps-count agent-employ-label">Employing agent</span>' +
            '</div>' +
            '<div class="steps-toggle">' +
              '<span class="chevron">\u2303</span>' +
            '</div>' +
          '</div>' +
          '<ul class="steps-list"></ul>' +
          '<div class="thought-trail expanded">' +
            '<div class="thought-trail-header">' +
              '<span class="thought-trail-label">Thought process</span>' +
              '<span class="thought-trail-expand">\u25BC</span>' +
            '</div>' +
            '<div class="thought-trail-content">' +
              `<p class="agent-task-line"><strong>Task</strong> (${modeEsc})</p>` +
              `<p class="agent-task-line">${taskEsc}</p>` +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';
    batchList.insertAdjacentHTML('beforeend', agentHtml);

    const count = batchContainer.querySelectorAll('.agent-batch-item').length;
    const countEl = batchContainer.querySelector('.agent-batch-count');
    if (countEl) countEl.textContent = `(${count} agent${count > 1 ? 's' : ''})`;

    this._messageList.scrollToBottom();
    console.log('[ChatTurnStreamController] Agent spawned:', data.agentId, data.task);
  }

  onAgentCompleted(data) {
    if (!this._epochValid(this._captureEpoch())) return;
    const app = this._app;
    if (!data.agentId) return;

    app.chatSessionsStore.updateAgentStatus(data.agentId, 'completed', data.result);

    const item = this._chatEl()?.querySelector(`.agent-batch-item[data-agent-id="${data.agentId}"]`);
    if (item) {
      item.classList.add('agent-done');
      const wrap = item.querySelector('.agent-employ-thinking');
      if (wrap) {
        wrap.classList.add('complete', 'tool-progress-done');
        const header = wrap.querySelector('.thinking-header');
        if (header) header.classList.add('done');
        const label = wrap.querySelector('.agent-employ-label');
        if (label) {
          label.textContent = '\u2713 Done';
        }
      }

      if (data.result) {
        const trail = item.querySelector('.thought-trail-content');
        if (trail) {
          const p = document.createElement('p');
          p.className = 'agent-result-line';
          p.innerHTML = '<strong>Result</strong> ';
          p.appendChild(document.createTextNode(data.result));
          trail.appendChild(p);
        } else {
          const resultEl = document.createElement('div');
          resultEl.className = 'agent-item-result';
          resultEl.textContent = data.result;
          item.appendChild(resultEl);
        }
      }

      const batchContainer = item.closest('.agent-batch-container');
      if (batchContainer) {
        this._checkBatchComplete(batchContainer, app);
      }
      this._messageList.scrollToBottom();
      return;
    }

    const container = this._chatEl()?.querySelector(`.thinking-container[data-agent-id="${data.agentId}"]`);
    if (container) {
      container.classList.add('complete');
      const header = container.querySelector('.thinking-header');
      if (header) header.classList.add('done');

      const stepsCount = container.querySelector('.steps-count');
      if (stepsCount) {
        stepsCount.textContent = '\u2713 Done';
      }

      if (data.result) {
        const stepsList = container.querySelector('.steps-list');
        if (stepsList) {
          const li = document.createElement('li');
          li.className = 'visible';
          li.innerHTML = '<span class="step-icon check"></span>' +
            '<span class="step-content"><span class="step-text">' +
            app.messageParser.escapeHtml(data.result) + '</span></span>';
          stepsList.appendChild(li);
        }
        this._messageList.scrollToBottom();
      }
    }
  }

  _checkBatchComplete(batchContainer, app) {
    const items = batchContainer.querySelectorAll('.agent-batch-item');
    const doneItems = batchContainer.querySelectorAll('.agent-batch-item.agent-done');
    if (doneItems.length < items.length) return;

    batchContainer.classList.add('batch-complete');
    const title = batchContainer.querySelector('.agent-batch-title');
    if (title) title.textContent = 'Done';
    const node = batchContainer.querySelector('.agent-batch-header > .pulsing-node');
    if (node) node.classList.add('done');

    const total = items.length;
    const succeeded = doneItems.length;
    const summaryEl = batchContainer.querySelector('.agent-batch-summary');
    if (summaryEl) {
      summaryEl.style.display = '';
      summaryEl.innerHTML =
        `<span class="batch-summary-text">${succeeded}/${total} agents completed successfully</span>`;
    }

    this._agentBatch = null;
  }

  onAgentCancelled(data) {
    if (!this._epochValid(this._captureEpoch())) return;
    const app = this._app;
    if (!data.agentId) return;

    app.chatSessionsStore.updateAgentStatus(data.agentId, 'cancelled');

    const item = this._chatEl()?.querySelector(`.agent-batch-item[data-agent-id="${data.agentId}"]`);
    const wrap = item?.querySelector('.agent-employ-thinking');
    if (wrap) {
      wrap.classList.add('complete', 'tool-progress-done', 'tool-progress-failed');
      const header = wrap.querySelector('.thinking-header');
      if (header) header.classList.add('done');
      const label = wrap.querySelector('.agent-employ-label');
      if (label) label.textContent = '\u2717 Cancelled';
      return;
    }

    const container = this._chatEl()?.querySelector(`.thinking-container[data-agent-id="${data.agentId}"]`);
    if (container) {
      container.classList.add('complete');
      const header = container.querySelector('.thinking-header');
      if (header) header.classList.add('done');

      const stepsCount = container.querySelector('.steps-count');
      if (stepsCount) {
        stepsCount.textContent = 'Agent cancelled';
      }
    }
  }

  onAgentStep(data) {
    if (!this._epochValid(this._captureEpoch())) return;
    if (!data.agentId || !data.step) return;
    const app = this._app;
    const stepKind = data.stepType === 'tool' ? 'tool' : 'thinking';

    const item = this._chatEl()?.querySelector(`.agent-batch-item[data-agent-id="${data.agentId}"]`);
    if (item) {
      const esc = app.messageParser.escapeHtml(data.step);
      const wrap = item.querySelector('.agent-employ-thinking');
      if (wrap && stepKind === 'tool') {
        const stepsList = wrap.querySelector('.steps-list');
        const toggle = wrap.querySelector('.steps-toggle');
        if (stepsList && toggle && !toggle.classList.contains('expanded')) {
          toggle.classList.add('expanded');
          stepsList.classList.add('expanded', 'fully-expanded');
        }
        if (stepsList) {
          const li = document.createElement('li');
          li.className = 'visible';
          li.innerHTML =
            '<span class="step-icon check"></span>' +
            '<span class="step-content"><span class="step-text">' + esc + '</span></span>';
          stepsList.appendChild(li);
        }
      } else if (wrap && stepKind === 'thinking') {
        const trail = wrap.querySelector('.thought-trail-content');
        if (trail) {
          const p = document.createElement('p');
          p.className = 'agent-thought-line';
          p.textContent = data.step;
          trail.appendChild(p);
        }
      }

      let stepsEl = item.querySelector('.agent-item-steps');
      if (!wrap && !stepsEl) {
        stepsEl = document.createElement('div');
        stepsEl.className = 'agent-item-steps';
        item.appendChild(stepsEl);
      }
      if (!wrap && stepsEl) {
        const stepEl = document.createElement('div');
        stepEl.className = 'agent-step-entry';
        const icon = stepKind === 'tool' ? '\uD83D\uDD27' : '\u25B6';
        stepEl.innerHTML = `<span class="agent-step-icon">${icon}</span><span class="agent-step-text">${esc}</span>`;
        stepsEl.appendChild(stepEl);
      }

      this._messageList.scrollToBottom();
      return;
    }

    const container = this._chatEl()?.querySelector(`.thinking-container[data-agent-id="${data.agentId}"]`);
    if (container) {
      const stepsList = container.querySelector('.steps-list');
      if (stepsList) {
        const li = document.createElement('li');
        li.className = 'visible';
        const icon = data.type === 'tool' ? 'action' : 'check';
        li.innerHTML = `<span class="step-icon ${icon}"></span><span class="step-content"><span class="step-text">${app.messageParser.escapeHtml(data.step)}</span></span>`;
        stepsList.appendChild(li);
        this._messageList.scrollToBottom();
      }
    }
  }
}
