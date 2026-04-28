/**
 * ChatApp — entry point that wires all chat components together.
 *
 * Loaded as type="module". Replaces the monolithic view6-chat.js IIFE.
 * Each component is imported, instantiated, and connected via EventBus
 * and bridge message routing.
 *
 * CHANGELOG:
 * 2026-03-28 | Project chats: request_project_chats on init, project_chats_blob / import merge;
 *            | Settings buttons + _wireProjectChatArchiveUi.
 * 2026-03-27 | undo_response / undo_tool include SessionManager.getUndoBridgePayload()
 *            | (design-option fork + linked Revit option id). Handle session_revit_design_option_linked.
 * 2026-03-26 | Chat containerization: Creates ChatSurface in constructor,
 *            | wires it to ChatTurnStreamController.setSurface() and
 *            | SessionManager. Calls surface.bind() + syncMainTab() after
 *            | initialize(). Added epoch guards to auto_continue and
 *            | buildX.restoreMessage bridge handlers.
 */
import { EventBus } from '../../shared/EventBus.js';
import { WebViewBridge, J3Toggle } from '../bridge/WebViewBridge.js';
import { ChatState } from '../state/ChatState.js';
import { MessageList, EDIT_BTN_HTML, REDO_BTN_HTML } from '../messages/MessageList.js';
import { MessageParser, escapeHtml } from '../messages/MessageParser.js';
import { UserMessage } from '../messages/UserMessage.js';
import { AssistantMessage } from '../messages/AssistantMessage.js';
import { ThinkingStepMessage } from '../messages/ThinkingStepMessage.js';
import { ErrorMessage } from '../messages/ErrorMessage.js';
import { ChatInput } from '../input/ChatInput.js';
import { AttachmentDock } from '../input/AttachmentDock.js';
import { SendButton } from '../input/SendButton.js';
import { StopButton } from '../input/StopButton.js';
import { AgentDropdown } from '../input/AgentDropdown.js';
import { ModelDropdown } from '../input/ModelDropdown.js';
import { InputToolbar } from '../input/InputToolbar.js';
import { UploadButton } from '../input/UploadButton.js';
import { SidebarTabController } from '../sidebar/SidebarTabController.js';
import { AgentPanel } from '../sidebar/AgentPanel.js';
import { FileTreePanel } from '../sidebar/FileTreePanel.js';
import { DesignOptionsBar } from '../sidebar/DesignOptionsBar.js';
import { SettingsPanel } from '../sidebar/SettingsPanel.js';
import { CreateToolButton } from '../sidebar/CreateToolButton.js';
import { SessionManager } from '../session/SessionManager.js';
import { SessionList } from '../session/SessionList.js';
import { NewChatButton } from '../session/NewChatButton.js';
import { PromptLibrary } from '../session/PromptLibrary.js';
import { NeuralNode } from '../animation/NeuralNode.js';
import { ThinkingAnimation } from '../animation/ThinkingAnimation.js';
import { CommandSuggestions } from '../commands/CommandSuggestions.js';
import { SkillPalette } from '../commands/SkillPalette.js';
import { CreatePalette } from '../commands/CreatePalette.js';
import { MentionPalette } from '../commands/MentionPalette.js';
import { RightClickMenu } from '../context/RightClickMenu.js';
import { UiDebugContextMenu } from '../context/UiDebugContextMenu.js';
import { KeyboardShortcuts } from '../context/KeyboardShortcuts.js';
import { ToolProgressBlock } from '../messages/ToolProgressBlock.js';
import { BlockReviewBlock } from '../messages/BlockReviewBlock.js';
import { ChatStructure } from '../structure/ChatStructure.js';
import { ChatSurface } from '../surface/ChatSurface.js';
import { ChatFeedbackBar } from '../ui/ChatFeedbackBar.js';
import { ErrorLogPanel } from '../ui/ErrorLogPanel.js';
import { GrindProgressBar } from '../ui/GrindProgressBar.js';
import { TokenStatusBar } from '../ui/TokenStatusBar.js';
import { CodeBlockResult } from '../ui/CodeBlockResult.js';
import { ContinuationModeSelector } from './ContinuationModeSelector.js';

// Jupiter content blocks — optional, gracefully degrades if folder is deleted
let _tryRenderContentBlock = null;
try {
  const jb = await import('../ui/jupiter-blocks/JupiterBlockDispatcher.js');
  _tryRenderContentBlock = jb.tryRenderContentBlock;
} catch(e) { /* jupiter-blocks not available — tools still work, just no inline UI */ }

// ═══════════════════════════════════════════════════════════════
// MessageQueueView — visual queue at bottom of chat
// (kept inline until extracted to its own module)
// ═══════════════════════════════════════════════════════════════

class MessageQueueView {
  constructor(chatContainer, bridge, app) {
    this.chatContainer = chatContainer;
    this._bridge = bridge;
    /** @type {ChatApp|null} */
    this._app = app || null;
    this.queuedMessages = [];
    this.containerEl = null;
  }

  addMessage(text) {
    const id = 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    this.queuedMessages.push({ id, text, addedAt: Date.now() });
    this.render();
    return id;
  }

  removeMessage(id) {
    const idx = this.queuedMessages.findIndex(m => m.id === id);
    if (idx !== -1) {
      this.queuedMessages.splice(idx, 1);
      this._bridge.postMessage('remove_queued', JSON.stringify({ index: idx }));
    }
    this.render();
  }

  editMessage(index, newText) {
    if (index < 0 || index >= this.queuedMessages.length) return;
    this.queuedMessages[index].text = newText;
    this._bridge.postMessage('edit_queued', JSON.stringify({ index, text: newText }));
    this.render();
  }

  _startInlineEdit(index) {
    if (index < 0 || index >= this.queuedMessages.length) return;
    const item = this.containerEl?.querySelectorAll('.queued-message-item')[index];
    if (!item) return;

    const textEl = item.querySelector('.queued-message-text');
    if (!textEl) return;

    window.__buildxQueueEditing = true;

    const currentText = this.queuedMessages[index].text;
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'queued-message-edit-input';
    input.value = currentText;
    input.style.cssText = 'flex:1;background:#2a2a2a;border:1px solid #4a9bb8;color:#fff;font-size:12px;padding:2px 6px;border-radius:4px;outline:none;font-family:inherit;';

    let editFinished = false;
    const finishEdit = () => {
      if (editFinished) return;
      editFinished = true;
      window.__buildxQueueEditing = false;
      this._app?.flushDeferredQueueReady?.();
    };

    let commitOnce = false;
    const commit = () => {
      if (commitOnce) return;
      commitOnce = true;
      const val = input.value.trim();
      if (val && val !== currentText) {
        this.editMessage(index, val);
      } else {
        this.render();
      }
      finishEdit();
    };

    const cancel = () => {
      if (commitOnce) return;
      commitOnce = true;
      this.render();
      finishEdit();
    };

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); commit(); }
      if (e.key === 'Escape') { e.preventDefault(); cancel(); }
    });
    input.addEventListener('blur', () => commit());

    textEl.replaceWith(input);
    input.focus();
    input.select();
  }

  clearAll() {
    this.queuedMessages = [];
    this.render();
    this._bridge.postMessage('clear_queue', '');
  }

  render() {
    if (this.containerEl) {
      this.containerEl.remove();
      this.containerEl = null;
    }

    if (this.queuedMessages.length === 0) return;

    this.containerEl = document.createElement('div');
    this.containerEl.className = 'message-queue-container';

    const header = document.createElement('div');
    header.className = 'message-queue-header';
    header.innerHTML = `
      <span class="message-queue-title">${this.queuedMessages.length} message${this.queuedMessages.length > 1 ? 's' : ''} queued</span>
      <button class="message-queue-clear">Clear all</button>
    `;
    header.querySelector('.message-queue-clear').addEventListener('click', () => this.clearAll());
    this.containerEl.appendChild(header);

    const list = document.createElement('div');
    list.className = 'message-queue-list';

    this.queuedMessages.forEach((msg, index) => {
      const item = document.createElement('div');
      item.className = 'queued-message-item';
      item.innerHTML = `
        <div class="queued-message-preview">
          <span class="queued-message-icon">${index + 1}</span>
          <span class="queued-message-text">${escapeHtml(msg.text)}</span>
          <span class="queued-message-status">${index === 0 && this.isProcessing ? 'sending...' : 'waiting'}</span>
        </div>
        <div class="queued-message-actions">
          <button class="queue-action-btn edit" data-index="${index}" title="Edit message">✎</button>
          <button class="queue-action-btn cancel" data-id="${msg.id}">Cancel</button>
        </div>
      `;
      item.querySelector('.queue-action-btn.edit').addEventListener('click', (e) => {
        e.stopPropagation();
        this._startInlineEdit(parseInt(e.target.dataset.index, 10));
      });
      item.querySelector('.queue-action-btn.cancel').addEventListener('click', (e) => {
        this.removeMessage(e.target.dataset.id);
      });
      list.appendChild(item);
    });

    this.containerEl.appendChild(list);

    const nodeWrapper = document.querySelector('.chat-persistent-node-wrapper');
    const chatMain = document.querySelector('.demo-chat-main');

    if (nodeWrapper && chatMain) {
      nodeWrapper.insertAdjacentElement('afterend', this.containerEl);
    } else if (chatMain) {
      const inputRow = document.querySelector('.demo-chat-input-row');
      if (inputRow) {
        chatMain.insertBefore(this.containerEl, inputRow);
      } else {
        chatMain.appendChild(this.containerEl);
      }
    } else if (this.chatContainer) {
      this.chatContainer.appendChild(this.containerEl);
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// ChatApp
// ═══════════════════════════════════════════════════════════════

class ChatApp {
  constructor() {
    // Core infrastructure
    this.eventBus = new EventBus();
    this.bridge = new WebViewBridge(this.eventBus);
    this.state = new ChatState(this.eventBus);

    // Message rendering
    this.messageParser = new MessageParser();
    this.messageList = new MessageList(this.state, this.eventBus);
    this.userMessage = new UserMessage(this.state, this.messageParser);
    this.assistantMessage = new AssistantMessage(this.state, this.messageParser, this.eventBus);
    this.assistantMessage._messageList = this.messageList;
    this.thinkingStep = new ThinkingStepMessage(this.state, this.eventBus);
    this.errorMessage = new ErrorMessage(this.state);
    this.toolProgress = new ToolProgressBlock();

    // Commands
    this.commandSuggestions = new CommandSuggestions(this.state, this.bridge);

    // "Create…" quick-actions palette. Shell component — dormant until a
    // native [McpTool] create-action is registered via the palette's static
    // registry (see CreatePalette.js). The mount() call is a no-op today
    // because CreatePalette.hasRegisteredItems() returns false.
    this.createPalette = new CreatePalette(this.bridge);
    try { this.createPalette.mount(); } catch (e) { console.warn('[ChatApp] CreatePalette mount failed', e?.message); }

    this.chatStructure = new ChatStructure({
      app: this,
      bridge: this.bridge,
      messageList: this.messageList,
      assistantMessage: this.assistantMessage,
      thinkingStep: this.thinkingStep,
      messageParser: this.messageParser,
      toolProgress: this.toolProgress,
      errorMessage: this.errorMessage,
      commandSuggestions: this.commandSuggestions
    });

    // Surface — session-scoped container for the viewport
    this.surface = new ChatSurface({
      app: this,
      bridge: this.bridge,
      messageList: this.messageList,
      chatStructure: this.chatStructure,
    });
    this.chatStructure.stream.setSurface(this.surface);

    // Input controls
    this.chatInput = new ChatInput(this.state, this.bridge);
    this.attachmentDock = new AttachmentDock(this.bridge);
    this.sendButton = new SendButton(this.state, this.bridge);
    this.stopButton = new StopButton(this.state, this.bridge);
    this.agentDropdown = new AgentDropdown(this.state, this.bridge);
    this.modelDropdown = new ModelDropdown(this.state, this.bridge);
    this.inputToolbar = new InputToolbar(this.state, this.bridge);
    this.uploadButton = new UploadButton(this.state, this.bridge);

    // Sidebar
    this.sidebarTabs = new SidebarTabController(this.state, this.eventBus);
    this.agentPanel = new AgentPanel(this.state, this.eventBus);
    this.fileTree = new FileTreePanel(this.state, this.bridge);
    this.designOptions = new DesignOptionsBar(this.state, this.eventBus);
    this.settingsPanel = new SettingsPanel(this.state, this.bridge);
    this.createToolBtn = new CreateToolButton(this.state, this.bridge);

    // Sessions
    this.sessionManager = new SessionManager(this.state, this.bridge, this.surface);
    this.designOptions.setSessionManager(this.sessionManager);
    this.sessionList = new SessionList(this.state, this.eventBus);
    this.newChatBtn = new NewChatButton(this.state, this.bridge);
    this.promptLibrary = new PromptLibrary();

    // Agentic mode selector (Fix 5)
    this.continuationMode = new ContinuationModeSelector(this.bridge);

    // Animation
    this.neuralNode = new NeuralNode(this.state, this.eventBus);
    this.thinkingAnim = new ThinkingAnimation(this.state, this.eventBus);

    // Context menus & keyboard
    this.rightClick = new RightClickMenu(this.state, this.bridge);
    this.keyboard = new KeyboardShortcuts(this.state, this.bridge, this.eventBus);

    // Internal state
    this._thinkingBuffer = '';
    this._messageQueueView = null;
    this._tokenCount = 0;
    this._streamStartTime = null;
    /** When true, response finished while user was editing a queued message — send `ready` after edit ends. */
    this._deferredQueueReady = false;

    // J3 rendering components (lazily bound to DOM in init)
    this._grindBar = null;
    this._tokenBar = null;
  }

  init(mode = 'full') {
    this.state.mode = mode;
    this.bridge.init();
    J3Toggle.init(this.bridge);

    if (this.inputToolbar) this.inputToolbar.init({
      chatInput: this.chatInput,
      sendButton: this.sendButton,
      stopButton: this.stopButton,
      agentDropdown: this.agentDropdown,
      modelDropdown: this.modelDropdown,
    });

    if (this.rightClick) this.rightClick.init(this);
    if (this.uiDebugMenu) this.uiDebugMenu.init();
    if (this.keyboard) this.keyboard.init();

    this._wireBridgeHandlers();
    this._wireEventBus();
    this._exposeGlobals();
    this._wireHistoryClicks();
    this._wireChatSessionLinkClicks();
    this._wireEditRedoClicks();

    if (this.thinkingStep && this.messageList) this.thinkingStep.initThinkingContainerHandlers(this.messageList.element);
    this._initMessageQueueView();
    if (this.sessionManager) {
      this.sessionManager.initialize();
      this.surface.bind(this.sessionManager.getCurrent());
      this.designOptions.syncMainTab(this.sessionManager.getCurrent());
    }

    this._wireSavePromptButton();
    this._wireDragDrop();

    this._initSkillPalette();
    this._initMentionPalette();

    this.chatFeedbackBar = new ChatFeedbackBar(this.eventBus);

    const chatMain = document.querySelector('.demo-chat-main');
    if (chatMain) {
      this._grindBar = new GrindProgressBar(chatMain);
      this._tokenBar = new TokenStatusBar(chatMain);
    }

    console.log(`[ChatApp] Initialized (mode: ${mode})`);

    try {
      const chatMsgs = document.querySelector('.demo-chat-messages');
      const userBubble = document.querySelector('.demo-msg-user');
      const botBubble = document.querySelector('.demo-msg-bot');
      const cs = (el) => el ? JSON.stringify({
        padding: getComputedStyle(el).padding,
        gap: getComputedStyle(el).gap,
        background: getComputedStyle(el).background,
        overflowWrap: getComputedStyle(el).overflowWrap,
        maxWidth: getComputedStyle(el).maxWidth,
        minWidth: getComputedStyle(el).minWidth,
      }) : 'null';
      console.error('[ChatApp] CSS-EVIDENCE: .demo-chat-messages=' + cs(chatMsgs));
      console.error('[ChatApp] CSS-EVIDENCE: .demo-msg-user=' + cs(userBubble));
      console.error('[ChatApp] CSS-EVIDENCE: .demo-msg-bot=' + cs(botBubble));
    } catch(e) { console.error('[ChatApp] CSS-EVIDENCE: dump failed: ' + e.message); }
  }

  // ═══════════════════════════════════════════════════════════════
  // Bridge message routing — maps every C# message type to the
  // appropriate component method(s).
  // ═══════════════════════════════════════════════════════════════

  _wireBridgeHandlers() {
    const app = this;
    const { bridge, messageList, commandSuggestions, messageParser } = this;
    const ts = app.chatStructure.stream;

    const chatEl = () => messageList.element;

    const foldAndReset = (fn) => app.chatStructure.stream.foldAndReset(fn);

    // ── thinking / stream turn (via ChatStructure → ChatTurnStreamController) ──

    bridge.on('thinking', () => {
      ts.onThinking();
      if (app.chatFeedbackBar) app.chatFeedbackBar.hide();
      if (app.attachmentDock) app.attachmentDock.clear();
    });

    bridge.on('thought', (_rest, data) => ts.onThought(data));

    bridge.on('thinking_delta', (_rest, data) => ts.onThinkingDelta(data));

    bridge.on('thinking_step', (_rest, data) => ts.onThinkingStep(data));

    bridge.on('thinking_complete', () => ts.onThinkingComplete());

    bridge.on('token', (_rest, data) => ts.onToken(data));

    bridge.on('response_chunk', (_rest, data) => ts.onResponseChunk(data));

    bridge.on('response', (_rest, data) => ts.onResponse(data));

    bridge.on('error', (_rest, data) => ts.onError(data));

    const stripToolUndoUi = () => {
      const el = document.getElementById('chatMessagesIndex6');
      if (!el) return;
      el.querySelectorAll('.tool-progress-stack[data-undo-slot]').forEach((stack) => {
        stack.querySelector('.tool-progress-undo-row')?.remove();
        stack.removeAttribute('data-undo-slot');
      });
    };

    bridge.on('undo_tool_done', (rest) => {
      const fromSlot = typeof rest.fromSlot === 'number' ? rest.fromSlot : parseInt(rest.fromSlot, 10);
      if (Number.isNaN(fromSlot)) return;
      const el = document.getElementById('chatMessagesIndex6');
      if (!el) return;
      el.querySelectorAll('.tool-progress-stack[data-undo-slot]').forEach((stack) => {
        const s = parseInt(stack.getAttribute('data-undo-slot'), 10);
        if (!Number.isNaN(s) && s >= fromSlot) {
          stack.querySelector('.tool-progress-undo-row')?.remove();
          stack.removeAttribute('data-undo-slot');
        }
      });
    });

    bridge.on('undo_strip_done', () => stripToolUndoUi());

    // ── error_intercepted (QA mode error capture badge) ───

    if (!app._errorLogPanel) {
      app._errorLogPanel = new ErrorLogPanel(bridge);
      app._errorLogPanel.init();
    }

    bridge.on('error_intercepted', (_rest, data) => {
      const fullText = (data.message || 'Error captured').toString();
      let badge = document.getElementById('qaErrorBadge');
      if (!badge) {
        badge = document.createElement('div');
        badge.id = 'qaErrorBadge';
        badge.className = 'qa-error-badge';
        badge.innerHTML =
          '<button type="button" class="qa-error-badge-toggle" aria-expanded="false" title="Show error detail">' +
          '<span class="qa-error-badge-label">Error</span>' +
          '<span class="qa-error-badge-chevron" aria-hidden="true">\u25b8</span>' +
          '</button>' +
          '<div class="qa-error-badge-detail" hidden></div>';
        const btn = badge.querySelector('.qa-error-badge-toggle');
        const detail = badge.querySelector('.qa-error-badge-detail');
        btn.addEventListener('click', (ev) => {
          ev.stopPropagation();
          const open = btn.getAttribute('aria-expanded') === 'true';
          btn.setAttribute('aria-expanded', open ? 'false' : 'true');
          detail.hidden = open;
          badge.classList.toggle('qa-error-badge--open', !open);
        });
        document.body.appendChild(badge);
      }
      const detailEl = badge.querySelector('.qa-error-badge-detail');
      if (detailEl) {
        detailEl.textContent = '';
        const pre = document.createElement('pre');
        pre.className = 'qa-error-badge-detail-text';
        pre.textContent = fullText;
        const logBtn = document.createElement('button');
        logBtn.type = 'button';
        logBtn.className = 'qa-error-open-log';
        logBtn.textContent = 'Open captured errors';
        logBtn.addEventListener('click', (ev) => {
          ev.stopPropagation();
          if (app._errorLogPanel) app._errorLogPanel.toggle();
        });
        detailEl.appendChild(pre);
        detailEl.appendChild(logBtn);
      }
      badge.style.opacity = '1';
      clearTimeout(badge._hideTimer);
      badge._hideTimer = setTimeout(() => { badge.style.opacity = '0.85'; }, 4000);
    });

    // ── status ───────────────────────────────────────────────

    bridge.on('status', (_rest, data) => {
      console.log('[ChatApp] Status:', data.message);
      if (data.message === 'Generation stopped') {
        ts.onStatusGenerationStopped();
      }
      if (data.message && (data.message.includes('Processed:') || data.message.includes('Attached') || data.message.includes('truncated') || data.message.includes('Image captured'))) {
        app._showStatusToast(data.message);

        if (data.message.includes('Processed:') || data.message.includes('Attached')) {
          const tokMatch = data.message.match(/~(\d+)\s*tokens/);
          const tokens = tokMatch ? parseInt(tokMatch[1]) : undefined;
          const nameMatch = data.message.match(/(?:Processed|Attached[^:]*): (.+?)(?:\s*\(|$)/);
          let name = nameMatch ? nameMatch[1].trim() : 'Attached file';
          name = name.replace(/mepbridge_upload_[a-f0-9]+\./, 'Pasted text.');
          app.attachmentDock.add({ name, size: 0, tokens });
        }
      }
    });

    // ── warmup_status ────────────────────────────────────────

    bridge.on('warmup_status', (_rest, data) => {
      const banner = document.getElementById('buildxWarmupBanner');
      if (!banner) return;

      const msg = data.message || '';
      if (!msg || /ready/i.test(msg)) {
        banner.style.display = 'none';
        banner.textContent = '';
      } else {
        banner.style.display = 'block';
        banner.textContent = msg;
      }
    });

    // ── suggestions / command_suggestions ─────────────────────

    const handleSuggestions = (_rest, data) => {
      foldAndReset(() => {
        commandSuggestions.showCommandSuggestions(
          chatEl(), data.commands, data.originalQuery, data.message);
      });
    };
    bridge.on('suggestions', handleSuggestions);
    bridge.on('command_suggestions', handleSuggestions);

    // ── clarify ──────────────────────────────────────────────

    bridge.on('clarify', (_rest, data) => {
      foldAndReset(() => {
        commandSuggestions.showClarifyMessage(chatEl(), data.message, data.suggestions);
      });
    });

    // ── commandOrder / command_order ─────────────────────────

    const handleCommandOrder = (_rest, data) => {
      foldAndReset(() => {
        commandSuggestions.showCommandOrder(chatEl(), data);
      });
    };
    bridge.on('commandOrder', handleCommandOrder);
    bridge.on('command_order', handleCommandOrder);

    // ── fallback ─────────────────────────────────────────────

    bridge.on('fallback', (_rest, data) => {
      foldAndReset(() => {
        const safe = messageParser.escapeHtml(data.message || 'No matching command found.');
        messageList.addMessage('demo-msg-bot',
          `<p style="color:#888;">🤔 ${safe}</p>`);
        messageList.scrollToBottom();
      });
    });

    // ── prompt_missing ───────────────────────────────────────

    bridge.on('prompt_missing', (_rest, data) => {
      foldAndReset(() => {
        commandSuggestions.showPromptEngineeringBox(
          chatEl(), data.commandName, data.commandClass);
      });
    });

    // ── prompt_saved ─────────────────────────────────────────

    bridge.on('prompt_saved', (_rest, data) => {
      const keywordsLine = data.keywords
        ? `<p style="font-size:12px;color:#888;">Keywords: ${messageParser.escapeHtml(data.keywords)}</p>`
        : '';
      messageList.addMessage('demo-msg-bot',
        `<p style="color:#4ade80;">✓ Prompt saved for <strong>${messageParser.escapeHtml(data.commandName || 'Command')}</strong></p>${keywordsLine}`);
      messageList.scrollToBottom('auto');
      app._resetSendingState();
    });

    // ── task_list ────────────────────────────────────────────

    bridge.on('task_list', (_rest, data) => {
      app._handleTaskList(data);
    });

    // ── memory_updated ───────────────────────────────────────

    bridge.on('memory_updated', (_rest, data) => {
      app._handleMemoryUpdated(data);
    });

    // ── theme ────────────────────────────────────────────────

    bridge.on('theme', (_rest, data) => {
      const theme = data.theme || data.message;
      if (theme === 'light') {
        document.documentElement.classList.remove('dark-mode');
      } else {
        document.documentElement.classList.add('dark-mode');
      }
    });

    bridge.on('ui_debug_mode', (_rest, data) => {
      try {
        const raw = data.message;
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        window.__BUILDX_UI_DEBUG__ = !!(parsed && parsed.enabled);
      } catch {
        window.__BUILDX_UI_DEBUG__ = false;
      }
    });

    // ── session_loaded ───────────────────────────────────────

    bridge.on('session_loaded', (_rest, data) => {
      if (data.sessionId) {
        app.sessionManager.load(data.sessionId);
      }
      console.log('[ChatApp] Session loaded:', data.sessionId);
    });

    bridge.on('session_title', (_rest, data) => {
      const sid = data.sessionId || app.sessionManager?.getCurrent();
      if (sid && data.title) {
        app.sessionManager?.setTitle(sid, data.title);
      }
    });

    // ── Link fork tab ↔ Revit Design Option (after save-as-option succeeds) ──

    bridge.on('session_revit_design_option_linked', (_rest, data) => {
      const sid = data?.sessionId;
      const eid = data?.revitDesignOptionElementId;
      if (typeof eid !== 'number' || Number.isNaN(eid)) return;
      app.sessionManager?.linkRevitDesignOptionForSession(sid, eid);
    });

    bridge.on('project_chats_blob', (_rest, data) => {
      if (!data?.json || typeof data.json !== 'string' || !app.sessionManager) return;
      const stats = app.sessionManager.mergeProjectSessionsFromJson(data.json);
      if (stats.added > 0 || stats.updated > 0) {
        app._showStatusToast(`Project chats merged (${stats.added} new, ${stats.updated} updated from file).`);
      }
    });

    bridge.on('project_chats_import_blob', (_rest, data) => {
      if (!data?.json || typeof data.json !== 'string' || !app.sessionManager) return;
      const stats = app.sessionManager.mergeProjectSessionsFromJson(data.json);
      app._showStatusToast(`Import complete (${stats.added} new sessions, ${stats.updated} updated).`);
    });

    // ── queue_status ─────────────────────────────────────────

    bridge.on('queue_status', (_rest, data) => {
      console.log('[ChatApp] Queue status:', data.message, data);
    });

    // ── prompt_engineering (alias for prompt_missing) ─────────

    bridge.on('prompt_engineering', (_rest, data) => {
      foldAndReset(() => {
        commandSuggestions.showPromptEngineeringBox(
          chatEl(), data.commandName, data.commandClass);
      });
    });

    bridge.on('agent_spawned', (_rest, data) => ts.onAgentSpawned(data));

    bridge.on('agent_completed', (_rest, data) => ts.onAgentCompleted(data));

    bridge.on('agent_cancelled', (_rest, data) => ts.onAgentCancelled(data));

    // CHANGELOG: 2026-03-27 | REQ-11 | Agent step streaming for live thinking/tool visibility
    bridge.on('agent_step', (_rest, data) => ts.onAgentStep(data));

    // ── Agentic branch tree messages ───────────────────────

    bridge.on('branch_tree_update', (_rest, data) => {
      app.sessionManager?.handleBranchTreeUpdate(data);
    });

    bridge.on('branch_merged', (_rest, data) => {
      app.sessionManager?.handleBranchMerged(data);
      const statusEl = document.getElementById('branch-delegation-status');
      if (statusEl) statusEl.remove();
      if (data?.summary) {
        messageList.addMessage('demo-msg-bot',
          '<p><strong>Branch completed:</strong> ' + escapeHtml(data.summary) + '</p>');
        messageList.scrollToBottom();
      }
      app.eventBus?.emit('branch_merged_tab', data);
    });

    bridge.on('branch_reverted', (_rest, data) => {
      app.sessionManager?.handleBranchReverted(data);
    });

    bridge.on('branch_delegated', (_rest, data) => {
      app.sessionManager?.handleBranchDelegated(data);
      if (data?.windowType) {
        const existingStatus = document.getElementById('branch-delegation-status');
        if (existingStatus) existingStatus.remove();
        const statusEl = document.createElement('div');
        statusEl.id = 'branch-delegation-status';
        statusEl.className = 'demo-msg-bot';
        statusEl.innerHTML = '<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:rgba(74,155,184,0.06);border-left:3px solid #4a9bb8;border-radius:0 6px 6px 0;font-size:12px;color:#ccc;">'
          + '<div class="shimmer-bar" style="width:24px;height:24px;border-radius:50%;flex-shrink:0;"></div>'
          + '<div>'
          + '<div style="font-weight:600;color:#e8e8e8;margin-bottom:2px;">Working in ' + escapeHtml(data.windowType) + '</div>'
          + '<div style="color:#888;font-size:11px;">' + escapeHtml(data.purpose || '') + '</div>'
          + '<div id="branch-delegation-steps" style="color:#4a9bb8;font-size:10px;margin-top:4px;font-family:Consolas,monospace;"></div>'
          + '</div></div>';
        const chatEl = document.getElementById('chatMessagesIndex6');
        if (chatEl) { chatEl.appendChild(statusEl); chatEl.scrollTo({ top: chatEl.scrollHeight, behavior: 'smooth' }); }
        app.designOptions?.addBranchTab(data.sessionId, data.windowType);
      }
    });

    bridge.on('agent_step', (_rest, data) => {
      const stepsEl = document.getElementById('branch-delegation-steps');
      if (stepsEl && data?.step) {
        stepsEl.textContent = data.step.length > 80 ? data.step.substring(0, 77) + '...' : data.step;
      }
    });

    // Sequential agent: auto-continue after branch merge
    // 2026-03-26 | Part 2e: After a branch merges, the parent chat auto-continues
    // with remaining tasks. The continuation prompt is injected and sent through
    // the normal WebView message path (UI-thread safe).
    bridge.on('auto_continue', (_rest, data) => {
      if (!app.surface.epochValid()) return;
      if (!data?.prompt) return;
      console.log('[ChatApp] Auto-continue after branch merge:', data.prompt.substring(0, 80));
      const inputEl = document.getElementById('chatInputIndex6');
      if (inputEl) {
        inputEl.value = data.prompt;
        const sendBtn = document.getElementById('chatSendBtnIndex6');
        if (sendBtn) sendBtn.click();
      }
    });

    // ── tool_created (custom tool feedback panel) ──────────

    bridge.on('tool_created', (_rest, data) => {
      const toolName = escapeHtml(data.toolName || data.tool_name || 'Tool');
      const html =
        '<div class="tool-feedback-panel">' +
          '<p>Tool "<strong>' + toolName + '</strong>" has been created. Test it and let us know:</p>' +
          '<div class="tool-feedback-buttons">' +
            '<button class="tool-feedback-btn working" data-tool="' + toolName + '" data-action="working">Working</button>' +
            '<button class="tool-feedback-btn buggy" data-tool="' + toolName + '" data-action="buggy">Still Buggy</button>' +
          '</div>' +
        '</div>';
      messageList.addMessage('demo-msg-bot', html);
      messageList.scrollToBottom();
    });

    // ── tool feedback delegated click handler ───────────────

    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.tool-feedback-btn');
      if (!btn) return;
      const toolName = btn.dataset.tool;
      const action = btn.dataset.action;
      bridge.postMessage('tool_feedback', JSON.stringify({ toolName, action }));
      const panel = btn.closest('.tool-feedback-panel');
      if (panel) {
        panel.innerHTML = action === 'working'
          ? '<p style="color:#22C55E;">\u2713 Marked as working. Submitted for review.</p>'
          : '<p style="color:#F59E0B;">\u26A0 Marked as buggy. Our team will investigate.</p>';
      }
    });

    // ── Per-tool Revit undo (tool-progress-stack) ───────────

    document.addEventListener('click', (e) => {
      const ubtn = e.target.closest('.tool-progress-undo-btn');
      if (!ubtn || ubtn.disabled) return;
      const stack = ubtn.closest('.tool-progress-stack');
      const slotStr = stack?.getAttribute('data-undo-slot');
      if (slotStr == null) return;
      const slot = parseInt(slotStr, 10);
      if (Number.isNaN(slot)) return;
      ubtn.disabled = true;
      ubtn.textContent = 'Undoing…';
      const doPayload = app.sessionManager?.getUndoBridgePayload?.() || {
        designOptionForkChat: false,
        revitDesignOptionElementId: null
      };
      app.bridge.postMessage('undo_tool', JSON.stringify({ slot, ...doPayload }));
    });

    // ── message feedback (Keep / Undo / Review) ───────────

    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.msg-feedback-btn');
      if (!btn) return;

      const bar = btn.closest('#chatFeedbackBar');
      const msgEl = btn.closest('.assistant-response, .demo-msg-bot, .thinking-container');
      const msgIndex = bar?.dataset?.assistantTurnIndex
        ?? msgEl?.getAttribute('data-msg-index');

      const feedbackRow = btn.closest('.msg-feedback-row');
      if (btn.classList.contains('keep')) {
        app.bridge.postMessage('keep_response', JSON.stringify({ messageIndex: msgIndex }));
        if (feedbackRow) feedbackRow.innerHTML = '<span class="feedback-confirmed">\u2713 Kept</span>';
      } else if (btn.classList.contains('undo')) {
        const doPayload = app.sessionManager?.getUndoBridgePayload?.() || {
          designOptionForkChat: false,
          revitDesignOptionElementId: null
        };
        app.bridge.postMessage('undo_response', JSON.stringify({ messageIndex: msgIndex, ...doPayload }));
        if (feedbackRow) feedbackRow.innerHTML = '<span class="feedback-confirmed" style="color:#EF4444;">\u21A9 Undone</span>';
        if (msgEl) msgEl.style.opacity = '0.4';
      } else if (btn.classList.contains('review')) {
        const reviewAnchor = msgEl || chatEl().querySelector(`[data-assistant-msg-index="${msgIndex}"]`);
        app._lastReviewTarget = reviewAnchor;
        app.bridge.postMessage('review_response', JSON.stringify({ messageIndex: msgIndex }));
      }
    });

    // ── review_data (C# sends back recent tool calls) ───

    bridge.on('review_data', (_rest, data) => {
      const target = app._lastReviewTarget;
      if (!target) return;

      let existing = target.querySelector('.review-panel');
      if (existing) {
        existing.classList.toggle('collapsed');
        return;
      }

      const panel = document.createElement('div');
      panel.className = 'review-panel';

      const tools = data.tools || [];
      if (tools.length === 0) {
        panel.innerHTML = '<div class="review-panel-empty">No tool activity recorded for this interaction.</div>';
      } else {
        let html = '<div class="review-panel-header">Tool Activity</div><ul class="review-panel-list">';
        for (const t of tools) {
          html += '<li class="review-panel-item">';
          html += '<span class="review-tool-name">' + escapeHtml(t.name || t.toolName || 'unknown') + '</span>';
          if (t.parameters || t.input) {
            const params = typeof (t.parameters || t.input) === 'string'
              ? (t.parameters || t.input)
              : JSON.stringify(t.parameters || t.input, null, 2);
            html += '<pre class="review-tool-params">' + escapeHtml(params) + '</pre>';
          }
          if (t.result) {
            const short = t.result.length > 200 ? t.result.substring(0, 200) + '...' : t.result;
            html += '<div class="review-tool-result">' + escapeHtml(short) + '</div>';
          }
          html += '</li>';
        }
        html += '</ul>';
        panel.innerHTML = html;
      }

      target.appendChild(panel);
      messageList.scrollToBottom();
    });

    // ── grind_status (J3 Grind mode progress) ─────────────────

    bridge.on('grind_status', (_rest, data) => {
      if (app._grindBar) {
        app._grindBar.show(data.round || 0, data.tokens || 0, data.message || '');
      }
      const isActive = data.active !== undefined ? !!data.active : (data.round || 0) > 0;
      if (app.inputToolbar) app.inputToolbar.setGrindState(isActive);
    });

    // ── token_stats (post-response token usage) ───────────────

    bridge.on('token_stats', (_rest, data) => {
      if (app._grindBar) app._grindBar.hide();
      if (app._tokenBar) app._tokenBar.update(data);
    });

    // ── code_result (sandbox execution output) ────────────────

    bridge.on('code_result', (_rest, data) => {
      const codeBlocks = chatEl().querySelectorAll('pre code');
      const lastCodeBlock = codeBlocks.length > 0 ? codeBlocks[codeBlocks.length - 1].closest('pre') : null;
      if (lastCodeBlock) {
        CodeBlockResult.render(lastCodeBlock, data);
        messageList.scrollToBottom();
      }
    });

    // ── jupiter_content_block (inline content blocks from Jupiter tools) ──
    // Self-contained: if jupiter-blocks folder is deleted, this handler is a no-op.
    // C# GenericContextTool detects __content_block__ in tool results and sends this.

    bridge.on('jupiter_content_block', (_rest, data) => {
      if (!_tryRenderContentBlock) return;
      try {
        const payload = typeof data.message === 'string' ? JSON.parse(data.message) : data;
        const lastMsg = chatEl().querySelector('.demo-msg-assistant:last-child .assistant-text-block:last-child')
          || chatEl().querySelector('.demo-msg-assistant:last-child')
          || chatEl().lastElementChild;
        if (lastMsg && _tryRenderContentBlock(payload, lastMsg, bridge)) {
          messageList.scrollToBottom();
        }
      } catch(e) {
        console.warn('[Jupiter] Content block render failed:', e);
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // task_list handler — renders sticky task panel
  // ═══════════════════════════════════════════════════════════════

  _handleTaskList(data) {
    if (!data.tasks || !Array.isArray(data.tasks)) return;

    const chatEl = this.messageList.element;
    if (!chatEl) return;

    const tasks = data.tasks;
    const completed = tasks.filter(t => t.status === 'completed').length;
    const failed = tasks.filter(t => t.status === 'failed').length;
    const total = tasks.length;
    const allDone = completed + failed === total;
    const currentTask = tasks.find(t => t.status === 'in_progress');

    let panel = document.getElementById('stickyTaskPanel');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'stickyTaskPanel';
      panel.className = 'task-panel';

      const chatMain = chatEl.parentNode;
      chatMain.insertBefore(panel, chatEl);

      panel.addEventListener('click', (e) => {
        e.stopPropagation();
        const isCollapsed = panel.dataset.collapsed === 'true';
        const listEl = panel.querySelector('.task-items');
        if (isCollapsed) {
          panel.dataset.collapsed = 'false';
          if (listEl) listEl.style.display = '';
        } else {
          panel.dataset.collapsed = 'true';
          if (listEl) listEl.style.display = 'none';
        }
      });
    }

    const isCollapsed = panel.dataset.collapsed === 'true';
    const countText = completed + '/' + total;

    let html = '<div style="display:flex;align-items:center;justify-content:space-between;padding:2px 0;">';
    html += '<div style="display:flex;align-items:center;gap:8px;">';
    html += '<div style="width:7px;height:7px;border-radius:50%;background:' + (allDone ? '#4CD964' : '#4a9bb8') + ';flex-shrink:0;"></div>';
    html += '<span style="font-family:\'Inter Display\',\'Inter\',sans-serif;font-size:10px;font-weight:300;color:#777;">' + countText + ' tasks</span>';
    if (currentTask && isCollapsed) {
      html += '<span style="font-size:0.60rem;font-weight:200;color:#999;margin-left:4px;">— ' + escapeHtml(currentTask.label) + '</span>';
    }
    html += '</div>';
    html += '<span class="task-panel-chevron" style="font-size:10px;color:#555;transform:rotate(' + (isCollapsed ? '180' : '0') + 'deg);transition:transform 0.2s ease;">⌃</span>';
    html += '</div>';

    html += '<ul class="task-items" style="list-style:none;margin:6px 0 0 0;padding:0 0 0 7px;font-size:0.60rem;font-weight:200;line-height:1.5;position:relative;' + (isCollapsed ? 'display:none;' : '') + '">';
    for (const task of tasks) {
      let dotBg = '#666';
      let textStyle = 'color:#999;';
      if (task.status === 'completed') { dotBg = '#4CD964'; textStyle = 'color:#666;text-decoration:line-through;opacity:0.5;'; }
      else if (task.status === 'failed') { dotBg = '#f85149'; textStyle = 'color:#f85149;'; }
      else if (task.status === 'in_progress') { dotBg = '#4a9bb8'; textStyle = 'color:#ccc;font-weight:400;'; }

      html += '<li style="padding:4px 0;padding-left:14px;position:relative;display:flex;align-items:flex-start;' + textStyle + '">';
      html += '<div style="position:absolute;left:3px;top:0;bottom:0;width:1px;background:#444;"></div>';
      html += '<div style="position:absolute;left:0;top:50%;transform:translateY(-50%);width:7px;height:7px;border-radius:50%;background:' + dotBg + ';z-index:1;"></div>';
      html += '<span>' + escapeHtml(task.label) + '</span>';
      html += '</li>';
    }
    html += '</ul>';

    panel.innerHTML = html;

    // CHANGELOG: 2026-03-27 | REQ-9 | Store task data on panel for per-chat persistence.
    panel.dataset.taskData = JSON.stringify(data);

    if (!isCollapsed) {
      clearTimeout(panel._collapseTimer);
      panel._collapseTimer = setTimeout(() => {
        panel.dataset.collapsed = 'true';
        const listEl = panel.querySelector('.task-items');
        if (listEl) listEl.style.display = 'none';
        const chevron = panel.querySelector('.task-panel-chevron');
        if (chevron) chevron.style.transform = 'rotate(180deg)';
      }, 5000);
    }

    chatEl.scrollTo({ top: chatEl.scrollHeight, behavior: 'smooth' });
  }

  // ═══════════════════════════════════════════════════════════════
  // memory_updated handler — toast notification
  // ═══════════════════════════════════════════════════════════════

  _handleMemoryUpdated(data) {
    if (!data.target) return;

    const toast = document.createElement('div');
    toast.className = 'chat-toast';
    const scope = data.scope === 'domain' ? '📂' : data.scope === 'chat' ? '💬' : '💾';
    toast.innerHTML = scope + ' <span style="color:#4a9bb8;">' + escapeHtml(data.target) + '</span> updated';
    document.body.appendChild(toast);

    requestAnimationFrame(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateY(0)';
    });
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(8px)';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  // ═══════════════════════════════════════════════════════════════
  // EventBus cross-wiring between components
  // ═══════════════════════════════════════════════════════════════

  _wireEventBus() {
    this.eventBus.on('state:generating', (isGenerating) => {
      if (isGenerating) {
        this.stopButton.show();
      } else {
        this.stopButton.hide();
      }
    });

    // CHANGELOG: 2026-03-27 | REQ-9 | Re-render task panel on session switch
    this.eventBus.on('task-list-restore', (data) => {
      if (data && data.tasks) this._handleTaskList(data);
    });
  }

  _showStatusToast(message) {
    let toast = document.getElementById('chatStatusToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'chatStatusToast';
      toast.className = 'chat-status-toast';
      const inputRow = document.querySelector('.demo-chat-input-row') || document.querySelector('.chat-composer-stack');
      if (inputRow) inputRow.parentElement.insertBefore(toast, inputRow);
      else document.body.appendChild(toast);
    }
    const friendly = message
      .replace(/mepbridge_upload_[a-f0-9]+\./g, 'Pasted text.')
      .replace(/Processed: /, '📎 ')
      .replace(/Attached for Claude: /, '📎 ')
      .replace(/Image captured/, '🖼️ Image captured')
      .replace(/Large file truncated: /, '📎 Trimmed: ');
    toast.textContent = friendly;
    toast.classList.add('chat-status-toast--visible');
    clearTimeout(toast._hideTimer);
    toast._hideTimer = setTimeout(() => toast.classList.remove('chat-status-toast--visible'), 5000);
  }

  // ═══════════════════════════════════════════════════════════════
  // Expose globals for C# ExecuteScriptAsync compatibility
  // ═══════════════════════════════════════════════════════════════

  _exposeGlobals() {
    const app = this;

    // renderUserMarkdown — renders user text with markdown when detected
    window.renderUserMarkdown = function(text) {
      return app.userMessage.render(text);
    };

    // addMessageWithAnimation — C# calls this to inject user/bot messages
    window.addMessageWithAnimation = function(chatEl, className, html) {
      let container;

      if (className.includes('demo-msg-user')) {
        const row = document.createElement('div');
        row.className = 'user-msg-row';

        const msg = document.createElement('div');
        msg.className = className;
        msg.setAttribute('data-msg-index', String(app.messageList.nextIndex()));
        msg.setAttribute('data-user-ordinal', String(app.messageList.nextUserOrdinal()));
        msg.innerHTML = html;
        row.appendChild(msg);
        row.insertAdjacentHTML('beforeend', EDIT_BTN_HTML);
        container = row;
      } else {
        const msg = document.createElement('div');
        msg.className = className;
        msg.setAttribute('data-msg-index', String(app.messageList.nextIndex()));
        if (className.includes('demo-msg-bot')) {
          html += REDO_BTN_HTML;
          html += '<div class="msg-feedback-row"><button class="msg-feedback-btn keep" title="Keep these changes">\u2713</button><button class="msg-feedback-btn undo" title="Undo changes from this response">\u21A9</button><button class="msg-feedback-btn review" title="Review what changed">\uD83D\uDC41</button></div>';
        }
        msg.innerHTML = html;
        container = msg;
      }

      container.style.opacity = '0';
      container.style.transform = 'translateY(12px) scale(0.98)';
      chatEl.appendChild(container);

      container.offsetHeight;

      container.style.transition =
        'opacity 0.5s cubic-bezier(0.4, 0, 0.2, 1), ' +
        'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)';
      container.style.opacity = '1';
      container.style.transform = 'translateY(0) scale(1)';
      return container;
    };

    // escapeHtml — used by C# injected scripts
    window.escapeHtml = escapeHtml;

    // isSending flag — read by C# injected scripts
    window.isSending = false;

    // PromptLibrary — accessible by other modules via window.ChatApp
    window.promptLibrary = app.promptLibrary;

    // MessageQueueView globals
    window.initMessageQueueView = () => app._initMessageQueueView();
    window.messageQueueView = null;

    // Legacy View6Chat API surface (backward compat)
    window.View6Chat = {
      loadConversation: () => {},
      getActiveConversation: () => app.state.activeConversation,
      conversations: {}
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // History item click delegation
  // ═══════════════════════════════════════════════════════════════

  _wireHistoryClicks() {
    document.addEventListener('click', (e) => {
      // Ignore clicks on branch action buttons (merge/revert/return) — they have their own handlers
      if (e.target.closest('.branch-merge-btn') || e.target.closest('.branch-revert-btn') || e.target.closest('.branch-return-btn')) return;

      const historyItem = e.target.closest('#chatHistoryIndex6 .demo-history-item');
      if (!historyItem) return;

      const sessionId = historyItem.getAttribute('data-session-id');
      if (!sessionId || sessionId === this.sessionManager.getCurrent()) return;

      const sessions = this.sessionManager.getAll();
      const session = sessions[sessionId];

      // If it's a C# agentic branch, show the branch view panel instead of swapping innerHTML
      if (session?.isCSharpBranch) {
        this._showBranchView(session);
        // Tell C# which session is now active
        this.bridge.postMessage('switch_session', sessionId);
        return;
      }

      this.sessionManager.load(sessionId);
    });
  }

  /**
   * Show a branch info panel in the chat area when user clicks a C# branch.
   * Displays status, purpose, and action buttons (Return to Parent, Merge, Revert).
   */
  _showBranchView(session) {
    const chatEl = document.getElementById('chatMessagesIndex6');
    if (!chatEl) {
      console.warn('[ChatApp._showBranchView] failure - yes: chatMessagesIndex6 not found');
      return;
    }

    // Save current chat so we can return to it
    this.sessionManager.save();
    this._branchReturnSessionId = this.sessionManager.getCurrent();

    const statusColor = session.agenticStatus === 'completed' ? '#4CD964'
      : session.agenticStatus === 'failed' ? '#f85149'
      : session.agenticStatus === 'cancelled' ? '#666'
      : session.agenticStatus === 'active' ? '#f0a500'
      : '#4a9bb8';

    const statusLabel = (session.agenticStatus || 'unknown').charAt(0).toUpperCase() + (session.agenticStatus || 'unknown').slice(1);

    chatEl.innerHTML = `
      <div class="branch-view-panel" data-branch-id="${session.id}" style="padding:24px;display:flex;flex-direction:column;gap:16px;height:100%;">
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="width:12px;height:12px;border-radius:50%;background:${statusColor};display:inline-block;"></span>
          <span style="font-size:14px;font-weight:600;color:#fff;">Branch: ${this._esc(session.agenticPurpose || session.title || 'Branch')}</span>
        </div>

        <div style="background:#2a2a2a;border-radius:8px;padding:12px;display:flex;flex-direction:column;gap:8px;">
          <div style="display:flex;justify-content:space-between;"><span style="color:#888;font-size:11px;">Status</span><span style="color:${statusColor};font-size:11px;font-weight:600;">${statusLabel}</span></div>
          <div style="display:flex;justify-content:space-between;"><span style="color:#888;font-size:11px;">Mode</span><span style="color:#ccc;font-size:11px;">${this._esc(session.agenticMode || 'Build')}</span></div>
          <div style="display:flex;justify-content:space-between;"><span style="color:#888;font-size:11px;">Created</span><span style="color:#ccc;font-size:11px;">${new Date(session.created).toLocaleTimeString()}</span></div>
          ${session.resultSummary ? '<div style="margin-top:4px;padding-top:8px;border-top:1px solid #3c3c3c;"><span style="color:#888;font-size:11px;">Result:</span><p style="color:#ccc;font-size:12px;margin:4px 0 0;">' + this._esc(session.resultSummary) + '</p></div>' : ''}
        </div>

        <div style="display:flex;gap:8px;margin-top:auto;">
          <button class="branch-return-btn" data-return-to="${this._branchReturnSessionId || ''}" style="flex:1;padding:8px 12px;border-radius:6px;background:#2d2d2d;color:#ccc;border:1px solid #444;cursor:pointer;font-size:11px;">← Return to Parent</button>
          ${session.agenticStatus === 'completed' || session.agenticStatus === 'active' ? '<button class="branch-merge-btn" data-session-id="' + session.id + '" style="flex:1;padding:8px 12px;border-radius:6px;background:#2d5a2d;color:#4CD964;border:1px solid #4CD964;cursor:pointer;font-size:11px;">✓ Merge & Close</button>' : ''}
          ${session.agenticStatus !== 'cancelled' ? '<button class="branch-revert-btn" data-session-id="' + session.id + '" style="flex:1;padding:8px 12px;border-radius:6px;background:#5a2d2d;color:#f85149;border:1px solid #f85149;cursor:pointer;font-size:11px;">✕ Revert</button>' : ''}
        </div>
      </div>
    `;

    // Update the sidebar highlight
    this.sessionManager._currentId = session.id;
    this.state.setCurrentSession(session.id);
    this.eventBus.emit('session-changed', { sessionId: session.id });

    console.log('[ChatApp] Switched to branch view:', session.id, session.agenticPurpose);
  }

  /** Simple HTML escape helper for branch view. */
  _esc(str) {
    return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /**
   * Past-chat search results: load session when user clicks a chat-session-link in bot messages.
   */
  _wireChatSessionLinkClicks() {
    const app = this;
    document.addEventListener('click', (e) => {
      const link = e.target.closest('.chat-session-link');
      if (!link) return;
      const sessionId = link.dataset.sessionId;
      if (sessionId && app.sessionManager) {
        e.preventDefault();
        app.sessionManager.load(sessionId);
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // Edit / Redo click delegation
  // ═══════════════════════════════════════════════════════════════

  _wireEditRedoClicks() {
    const app = this;
    const chatEl = this.messageList.element;
    if (!chatEl) return;

    const getUserBubble = (editBtn) => {
      const row = editBtn.closest('.user-msg-row');
      return row?.querySelector('.demo-msg-user') || editBtn.closest('.demo-msg-user');
    };

    document.addEventListener('click', (e) => {
      const editBtn = e.target.closest('.msg-edit-btn');
      if (editBtn && chatEl.contains(editBtn)) {
        const msgEl = getUserBubble(editBtn);
        if (!msgEl || msgEl.querySelector('.user-msg-edit-wrap')) return;

        const row = msgEl.closest('.user-msg-row');
        const idxEl = row?.querySelector('[data-msg-index]') || msgEl;
        const msgIndexAttr = idxEl.getAttribute('data-msg-index');
        if (msgIndexAttr == null || msgIndexAttr === '') return;

        const originalHtml = msgEl.innerHTML;
        const textEl = msgEl.querySelector('p');
        const text = textEl ? textEl.textContent : '';

        msgEl.innerHTML =
          '<div class="user-msg-edit-wrap">' +
            '<textarea class="user-msg-edit-textarea" rows="4">' + escapeHtml(text) + '</textarea>' +
            '<div class="user-msg-edit-actions">' +
              '<button type="button" class="user-msg-edit-send">Send</button>' +
              '<button type="button" class="user-msg-edit-branch">Start new branch</button>' +
              '<button type="button" class="user-msg-edit-cancel">Cancel</button>' +
            '</div>' +
          '</div>';
        const ta = msgEl.querySelector('.user-msg-edit-textarea');
        ta?.focus();
        ta?.select();

        const finishCancel = () => {
          msgEl.innerHTML = originalHtml;
        };

        msgEl.querySelector('.user-msg-edit-cancel')?.addEventListener('click', (ev) => {
          ev.preventDefault();
          finishCancel();
        });
        // CHANGELOG: 2026-03-26 | ChatApp.js edit buttons | Both "Send" and "Start new branch"
        // now route through SessionManager.branch(msgIdx, editedText). This creates a proper
        // option-scoped branch (parent preserved) instead of destructively rewriting history.
        // The branch's parentSessionId = current session, so edit branches inside Option A
        // never leak into Option B.
        msgEl.querySelector('.user-msg-edit-branch')?.addEventListener('click', (ev) => {
          ev.preventDefault();
          const newText = (ta?.value ?? '').trim();
          const msgIdx = parseInt(msgIndexAttr, 10);
          finishCancel();
          app.sessionManager.branch(msgIdx, newText || null);
        });
        msgEl.querySelector('.user-msg-edit-send')?.addEventListener('click', (ev) => {
          ev.preventDefault();
          const newText = (ta?.value ?? '').trim();
          if (!newText) {
            finishCancel();
            return;
          }
          const msgIdx = parseInt(msgIndexAttr, 10);
          finishCancel();
          app.sessionManager.branch(msgIdx, newText);
        });
        ta?.addEventListener('keydown', (ev) => {
          if (ev.key === 'Escape') {
            ev.preventDefault();
            finishCancel();
          }
        });
        ['.user-msg-edit-send', '.user-msg-edit-branch', '.user-msg-edit-cancel'].forEach(sel => {
          msgEl.querySelector(sel)?.addEventListener('mousedown', (ev) => ev.preventDefault());
        });
        ta?.addEventListener('blur', () => {
          setTimeout(() => {
            if (!msgEl.querySelector('.user-msg-edit-wrap')) return;
            const ae = document.activeElement;
            if (ae && msgEl.contains(ae)) return;
            finishCancel();
          }, 200);
        });
        return;
      }

      const redoBtn = e.target.closest('.msg-redo-btn');
      if (!redoBtn) return;

      const fromBar = redoBtn.closest('#chatFeedbackBar');
      let turnIdx = fromBar?.dataset?.assistantTurnIndex;
      const msgEl = redoBtn.closest('.demo-msg-bot, .assistant-response');
      if (!turnIdx && msgEl) {
        turnIdx = msgEl.getAttribute('data-assistant-msg-index')
          || msgEl.getAttribute('data-msg-index');
      }
      if (!turnIdx) return;

      const byAssistant = chatEl.querySelectorAll(`[data-assistant-msg-index="${turnIdx}"]`);
      if (byAssistant.length > 0) {
        byAssistant.forEach(el => el.remove());
      } else if (msgEl) {
        while (msgEl.nextElementSibling) msgEl.nextElementSibling.remove();
        msgEl.remove();
      }

      app.messageList.recountFromDOM();
      app.state.setSending(true);
      app.bridge.postMessage('redo_message', '');
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // MessageQueueView initialization
  // ═══════════════════════════════════════════════════════════════

  _initMessageQueueView() {
    const chatEl = this.messageList.element;
    if (chatEl && !this._messageQueueView) {
      this._messageQueueView = new MessageQueueView(chatEl, this.bridge, this);
      window.messageQueueView = this._messageQueueView;
    }
    return this._messageQueueView;
  }

  /** Settings: import chats from another project's sidecar file; reload merge from current RVT folder. */
  _wireProjectChatArchiveUi() {
    const importBtn = document.getElementById('importProjectChatsBtn');
    if (importBtn) {
      importBtn.addEventListener('click', () => {
        this.bridge.postMessage('import_project_chats_pick', '');
      });
    }
    const reloadBtn = document.getElementById('reloadProjectChatsBtn');
    if (reloadBtn) {
      reloadBtn.addEventListener('click', () => {
        this.bridge.postMessage('request_project_chats', '');
      });
    }
  }

  /** Called when inline queue edit finishes — flushes a pending C# queue advance if the response already completed. */
  flushDeferredQueueReady() {
    if (!this._deferredQueueReady) return;
    this._deferredQueueReady = false;
    this.bridge.postMessage('ready', '');
  }

  // ═══════════════════════════════════════════════════════════════
  // Save Prompt button — bookmarks current input text
  // ═══════════════════════════════════════════════════════════════

  _wireSavePromptButton() {
    const btn = document.querySelector('.chat-save-prompt-btn');
    if (!btn) return;

    btn.addEventListener('click', () => {
      const inputEl = document.getElementById('chatInputIndex6');
      const text = (inputEl?.value ?? inputEl?.textContent ?? '').trim();
      if (!text) return;

      this.promptLibrary.save(text);

      btn.textContent = '★';
      btn.classList.add('saved');
      setTimeout(() => {
        btn.textContent = '☆';
        btn.classList.remove('saved');
      }, 1200);
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // Skill Palette — "/" trigger for browsing released skills
  // ═══════════════════════════════════════════════════════════════

  _initSkillPalette() {
    this.skillPalette = new SkillPalette(this.eventBus, 'data/skill_manifest.json');
    const composerArea = document.querySelector('.chat-composer-stack') || document.querySelector('.demo-chat-input-row');
    if (!composerArea) {
      console.error('[ChatApp] SLASH-H3: composerArea null — neither .chat-composer-stack nor .demo-chat-input-row found');
    }
    if (composerArea) {
      this.skillPalette.bind(composerArea, (content) => {
        const inputEl = document.getElementById('chatInputIndex6');
        if (inputEl) {
          if (inputEl.textContent !== undefined) inputEl.textContent = content;
          else inputEl.value = content;
          inputEl.dispatchEvent(new Event('input', { bubbles: true }));
          inputEl.focus();
        }
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // Mention Palette — "@" trigger for mentioning views/sheets/etc.
  // ═══════════════════════════════════════════════════════════════

  _initMentionPalette() {
    this.mentionPalette = new MentionPalette(this.eventBus, this.bridge);
    const composerArea = document.querySelector('.chat-composer-stack') || document.querySelector('.demo-chat-input-row');
    if (composerArea) {
      this.mentionPalette.bind(composerArea, (mentionText) => {
        const inputEl = document.getElementById('chatInputIndex6');
        if (inputEl) {
          const text = inputEl.textContent || '';
          const atIndex = text.lastIndexOf('@');

          const prefix = atIndex >= 0 ? text.substring(0, atIndex) : text;
          inputEl.textContent = '';

          if (prefix) {
            inputEl.appendChild(document.createTextNode(prefix));
          }

          const parts = mentionText.match(/^@(\w+):\s*(.+)$/);
          const chip = document.createElement('span');
          chip.className = 'mention-chip';
          chip.contentEditable = 'false';
          chip.dataset.mentionType = parts ? parts[1] : '';
          chip.dataset.mentionName = parts ? parts[2] : mentionText;
          const icon = document.createElement('span');
          icon.className = 'mention-chip-icon';
          icon.textContent = this.mentionPalette._typeIcon(parts ? parts[1] : '');
          chip.appendChild(icon);
          const chipLabel = parts ? parts[2] : mentionText;
          const chipDisplay = chipLabel.length > 25 ? chipLabel.substring(0, 24) + '\u2026' : chipLabel;
          chip.appendChild(document.createTextNode(chipDisplay));
          chip.title = chipLabel;
          inputEl.appendChild(chip);

          inputEl.appendChild(document.createTextNode('\u00A0'));

          inputEl.dispatchEvent(new Event('input', { bubbles: true }));
          inputEl.focus();
          const range = document.createRange();
          range.selectNodeContents(inputEl);
          range.collapse(false);
          const sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(range);
        }
      });
    }
    if (this.chatInput) {
      this.chatInput.setEventBus(this.eventBus, this.skillPalette, this.mentionPalette);
    }

    this._wireWorkspaceConnect();
  }

  _wireWorkspaceConnect() {
    const btn = document.getElementById('connectWorkspaceBtn');
    const btn2 = document.getElementById('connectWorkspaceBtnDesigners');
    const pathDisplay = document.getElementById('workspacePathDisplay');
    const nodeFiles = document.getElementById('workspaceNodeFiles');
    const nodeDesigners = document.getElementById('workspaceNodeDesigners');
    
    const triggerPick = () => this.bridge.postMessage('pick_workspace_folder', '');

    if (btn) btn.addEventListener('click', triggerPick);
    if (btn2) btn2.addEventListener('click', triggerPick);

    this.bridge.on('workspace_connected', (_rest, data) => {
      const folderPath = data.message || data.path || '';
      if (!folderPath) return;

      if (btn) { btn.classList.add('connected'); btn.querySelector('span:last-child').textContent = 'Connected'; }
      if (btn2) { btn2.classList.add('connected'); btn2.querySelector('span:last-child').textContent = 'Connected'; }
      if (pathDisplay) pathDisplay.textContent = folderPath;
      if (nodeFiles) nodeFiles.classList.add('connected');
      if (nodeDesigners) nodeDesigners.classList.add('connected');

      this.bridge.postMessage('list_workspace_files', folderPath);
    });

    this.bridge.on('workspace_files', (_rest, data) => {
      try {
        const raw = data.message || data.payload || data;
        const files = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (this.mentionPalette && Array.isArray(files)) {
          this.mentionPalette.setWorkspaceFiles(files);
        }
        if (this.fileTree && Array.isArray(files)) {
          this.fileTree.render(files);
        }
      } catch (e) {
        console.error('[ChatApp] workspace_files parse error:', e.message);
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // Drag & drop file upload onto chat window
  // ═══════════════════════════════════════════════════════════════

  _wireDragDrop() {
    const chatArea = document.getElementById('chatMessagesIndex6');
    if (!chatArea) return;

    const overlay = document.createElement('div');
    overlay.className = 'drag-overlay';
    overlay.innerHTML = '<div class="drag-overlay-content"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg><span>Drop files here</span></div>';
    overlay.style.display = 'none';
    chatArea.parentElement.appendChild(overlay);

    let dragCounter = 0;
    const chatMain = chatArea.closest('.demo-chat-main');
    if (!chatMain) return;

    chatMain.addEventListener('dragenter', (e) => { e.preventDefault(); dragCounter++; overlay.style.display = 'flex'; });
    chatMain.addEventListener('dragleave', (e) => { e.preventDefault(); dragCounter--; if (dragCounter <= 0) { dragCounter = 0; overlay.style.display = 'none'; } });
    chatMain.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; });
    chatMain.addEventListener('drop', (e) => {
      e.preventDefault();
      dragCounter = 0;
      overlay.style.display = 'none';
      if (e.dataTransfer.files.length > 0) {
        this.uploadButton._handleFiles(e.dataTransfer.files);
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // Reset sending state + signal C# queue ready
  // ═══════════════════════════════════════════════════════════════

  _resetSendingState() {
    this.state.setSending(false);
    this.state.setGenerating(false);
    if (window.__buildxQueueEditing) {
      this._deferredQueueReady = true;
      return;
    }
    this._deferredQueueReady = false;
    this.bridge.postMessage('ready', '');
  }
}

// ═══════════════════════════════════════════════════════════════
// Bootstrap
// ═══════════════════════════════════════════════════════════════

const app = new ChatApp();
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => app.init());
} else {
  app.init();
}

window.ChatApp = app;

// ═══════════════════════════════════════════════════════════════
// window.buildX — C# callable API for branch UI restore + agentic hooks
// ═══════════════════════════════════════════════════════════════

window.buildX = window.buildX || {};

/**
 * Show a block-diff review panel inline in the chat.
 * Called from MCPConfirmAnyTextAndParameterEditsWithUser via ExecuteScriptAsync.
 * @param {object} config - { title, subtitle, blocks, reviewId }
 */
window.buildX.showBlockReview = function(config) {
  const chatEl = document.getElementById('chatMessagesIndex6');
  if (!chatEl) {
    console.warn('[buildX.showBlockReview] chatMessagesIndex6 not found');
    return;
  }
  const sendFn = (msg) => {
    const inputEl = document.getElementById('chatInputIndex6');
    const sendBtn = document.getElementById('chatSendIndex6');
    if (inputEl && sendBtn) {
      if (inputEl.textContent !== undefined) inputEl.textContent = msg;
      else inputEl.value = msg;
      inputEl.dispatchEvent(new Event('input', { bubbles: true }));
      setTimeout(() => sendBtn.click(), 100);
    }
  };
  BlockReviewBlock.show(chatEl, config, sendFn);
};

/**
 * Restore a message bubble in the chat DOM without triggering a send.
 * Called from C# RestoreConversationUI to render seeded branch history.
 * @param {string} role - 'user' or 'bot'
 * @param {string} text - The message text content
 */
window.buildX.restoreMessage = function(role, text) {
  if (!app.surface.epochValid()) return;
  const chatEl = document.getElementById('chatMessagesIndex6');
  if (!chatEl) {
    console.warn('[buildX.restoreMessage] failure - yes: chatMessagesIndex6 not found');
    return;
  }

  const div = document.createElement('div');
  div.className = role === 'user' ? 'demo-msg-user' : 'demo-msg-bot';

  if (role === 'user') {
    div.innerHTML = typeof window.renderUserMarkdown === 'function'
      ? window.renderUserMarkdown(text)
      : '<p>' + text.replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</p>';
  } else {
    let html = text
      .replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>');
    div.innerHTML = '<p>' + html + '</p>';
  }

  div.style.opacity = '0.75';
  div.setAttribute('data-restored', 'true');

  if (role === 'user') {
    const msgIdx = chatEl.querySelectorAll('.demo-msg-user').length;
    div.setAttribute('data-msg-index', String(chatEl.querySelectorAll('[data-msg-index]').length));
    div.setAttribute('data-user-ordinal', String(msgIdx));
    const row = document.createElement('div');
    row.className = 'user-msg-row';
    row.appendChild(div);
    row.insertAdjacentHTML('beforeend', EDIT_BTN_HTML);
    chatEl.appendChild(row);
  } else {
    chatEl.appendChild(div);
  }
};
