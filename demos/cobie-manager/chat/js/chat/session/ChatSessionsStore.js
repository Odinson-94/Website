/**
 * SessionManager — core CRUD for chat sessions.
 *
 * Owns the session data store (chatSessions map, currentSessionId, counter).
 * Persists session HTML snapshots so users can switch between conversations.
 * Sessions survive page reloads via localStorage.
 *
 * Source: view6-chat.js lines 73-128, 1414-1507
 *
 * CHANGELOG:
 * 2026-03-28 | Project archive: debounced project_chats_save (sidecar JSON next to RVT);
 *            | mergeProjectSessionsFromJson for load/import.
 * 2026-03-27 | Design-option undo: revitDesignOptionElementId, getUndoBridgePayload,
 *            | linkRevitDesignOptionForSession; migration + C# branch sessions default id.
 * 2026-03-26 | Chat containerization: Constructor now accepts optional
 *            | ChatSurface. save() delegates to surface.snapshot() when
 *            | available. load() calls surface.teardown() before switch
 *            | (stops C# generation, clears timers, increments epoch),
 *            | then surface.snapshot() / surface.restore() instead of
 *            | direct getElementById. Eliminates all raw DOM access in
 *            | the session switch path.
 */

const STORAGE_KEY = 'buildx_sessions';

// Chat transcripts persist in WebView2 localStorage under this key (origin: https://app.local).
// They are per Windows user profile + browser profile. When the RVT is saved, the same payload
// is mirrored next to the file as {base}.mepbridge_buildx_chats.json (see ChatProjectArchive + project_chats_save).

export class SessionManager {
  /**
   * @param {import('../state/ChatState.js').ChatState} state
   * @param {import('../bridge/WebViewBridge.js').WebViewBridge} bridge
   * @param {import('../surface/ChatSurface.js').ChatSurface} [surface]
   */
  constructor(state, bridge, surface) {
    this._state = state;
    this._bridge = bridge;
    /** @type {import('../surface/ChatSurface.js').ChatSurface|null} */
    this._surface = surface || null;

    this._sessions = {};
    this._currentId = null;
    this._counter = 0;
    this._surfaceId = 'main';
    /** @type {ReturnType<typeof setTimeout>|null} */
    this._projectArchiveTimer = null;
    /** @type {ReturnType<typeof setTimeout>|null} */
    this._autoSaveTimer = null;

    state.sessionManager = this;

    // §A-4 fix: hook the message event bus so every assistant turn is
    // captured as a structured entry in session.messages (not just DOM HTML).
    // This unblocks proper C# history restore on session switch and
    // Supabase chat_messages mirroring (§C-3).
    const bus = state?._eventBus || state?.eventBus;
    if (bus && typeof bus.on === 'function') {
      try {
        bus.on('assistantMessage:finalized', (payload) => {
          this.recordAssistantMessage(payload?.text ?? '', { turnIndex: payload?.turnIndex });
          // §A-2: commit a save after every finalised assistant turn so
          // mid-stream content never gets lost on a hard close.
          try { this.save(); } catch { /* best effort */ }
        });
      } catch (e) {
        console.warn('[SessionManager] Could not bind to assistantMessage:finalized', e?.message);
      }
    }

    // §A-2: flush on tab/WebView close so the last few seconds' messages
    // always land in localStorage (and therefore the project sidecar).
    try {
      if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
        const saveNow = () => {
          try {
            if (this._autoSaveTimer) { clearTimeout(this._autoSaveTimer); this._autoSaveTimer = null; }
            this.save();
          } catch { /* best effort */ }
        };
        window.addEventListener('beforeunload', saveNow);
        window.addEventListener('pagehide', saveNow);
        // WebView2 panels sometimes just go invisible instead of unloading
        // (dockable pane docking). Snapshot on visibility change too.
        if (typeof document !== 'undefined') {
          document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') saveNow();
          });
        }
        // Exposed so C# OnUnloaded can force a flush synchronously just
        // before the WebView tears down (see AIChatPanelView.xaml.cs).
        window.__buildx_force_save = saveNow;
      }
    } catch { /* host may not expose window (SSR etc.) */ }
  }

  // ── Structured message recording (§A-4) ────────────────────────────
  /**
   * Push a user turn into the current session's structured messages[].
   * Called from SendButton (and any other place that posts 'chat' to C#).
   * @param {string} text
   */
  recordUserMessage(text) {
    const t = (text || '').toString();
    if (!t.trim()) return;
    const sid = this._currentId;
    if (!sid || !this._sessions[sid]) return;
    if (!Array.isArray(this._sessions[sid].messages)) this._sessions[sid].messages = [];
    this._sessions[sid].messages.push({
      role: 'user',
      text: t,
      timestamp: new Date().toISOString(),
    });
    this._sessions[sid].lastMessageAt = new Date();
    this._scheduleAutoSave();
  }

  /**
   * Push an assistant turn into the current session's structured messages[].
   * Wired automatically to assistantMessage:finalized.
   * @param {string} text
   * @param {object} [meta]
   */
  recordAssistantMessage(text, meta) {
    const t = (text || '').toString();
    if (!t.trim()) return;
    const sid = this._currentId;
    if (!sid || !this._sessions[sid]) return;
    if (!Array.isArray(this._sessions[sid].messages)) this._sessions[sid].messages = [];
    this._sessions[sid].messages.push({
      role: 'assistant',
      text: t,
      turnIndex: meta?.turnIndex,
      timestamp: new Date().toISOString(),
    });
    this._sessions[sid].lastMessageAt = new Date();
    this._scheduleAutoSave();

    // Mirror to Supabase chat_messages (§C-3.4). Debounced via the existing
    // project-archive timer path. C# side listens for 'append_chat_message'.
    try {
      this._bridge?.postMessage?.('append_chat_message', JSON.stringify({
        sessionId: sid,
        role: 'assistant',
        text: t,
        turnIndex: meta?.turnIndex ?? null,
      }));
    } catch { /* non-critical */ }
  }

  /** Small debounced save trigger — reuses the same 800ms cadence as the project-archive sync. */
  _scheduleAutoSave() {
    clearTimeout(this._autoSaveTimer);
    this._autoSaveTimer = setTimeout(() => {
      try { this.save(); } catch { /* best effort */ }
    }, 400);
  }

  /**
   * Set the surface ID for this WebView2 instance.
   * Called from C# after NavigationCompleted with the detected window type.
   * @param {string} surfaceId - 'main', 'de_embedded', or 'pe_embedded'
   */
  setSurface(surfaceId) {
    this._surfaceId = surfaceId || 'main';
  }

  get surfaceId() { return this._surfaceId; }

  /** Returns a unique session id. */
  generateId() {
    this._counter++;
    return 'chat_' + Date.now() + '_' + this._counter;
  }

  /**
   * Build the four-part address for a session entity.
   * Format: {chat_id}.{option_id}.{branch_id}@{surface_id}
   */
  getAddress(sessionId, optionId, branchId) {
    const chat = sessionId || this._currentId || 'unknown';
    const option = optionId || 'opt_main';
    const branch = branchId || 'br_root';
    return `${chat}.${option}.${branch}@${this._surfaceId}`;
  }

  // CHANGELOG: 2026-03-27 | REQ-7 | Session model restructured.
  // Added: draft (per-chat), taskList (per-chat), options map (design options).
  // messages[] now built alongside messagesHtml for structured access.
  // Version bumped to 3. Migration in _restore() upgrades v2 payloads.

  /** Creates a new session object, stores it, returns its id. */
  create(opts = {}) {
    const id = this.generateId();
    const now = new Date();
    const session = {
      id,
      title: opts.title || 'New Chat',
      messages: [],
      created: now,
      lastUpdated: now,
      lastMessageAt: now,
      surfaceOrigin: this._surfaceId,
      activeOptionId: 'opt_main',
      activeBranchId: 'br_root',
      draft: '',
      taskList: null,
      options: {
        opt_main: { messages: [], activeBranch: 'br_root' }
      },
      /** When set, chat Undo requires this Revit DesignOption element id to match GetActiveDesignOptionId (fork tabs). */
      revitDesignOptionElementId: null
    };
    if (opts.parentSessionId) {
      session.parentSessionId = opts.parentSessionId;
    }
    this._sessions[id] = session;
    this._state.addSession(session);
    this._persist();
    return id;
  }

  // CHANGELOG: 2026-03-27 | REQ-8 | save() now persists draft text from input.
  // CHANGELOG: 2026-03-27 | REQ-9 | save() now persists taskList from sticky panel.

  /** Persists current session state (chat HTML snapshot, draft, tasks). */
  save(sessionId) {
    const sid = sessionId ?? this._currentId;
    if (!sid || !this._sessions[sid]) return;

    if (this._surface) {
      const snap = this._surface.snapshot();
      const contentChanged = this._sessions[sid].messagesHtml !== snap.html;
      this._sessions[sid].messagesHtml = snap.html;
      this._sessions[sid].draft = snap.draft;
      if (snap.taskData) {
        try { this._sessions[sid].taskList = JSON.parse(snap.taskData); } catch {}
      }
      if (contentChanged) {
        this._sessions[sid].lastUpdated = new Date();
      }
    } else {
      const chatEl = document.getElementById('chatMessagesIndex6');
      if (chatEl) {
        const newHtml = chatEl.innerHTML;
        const contentChanged = this._sessions[sid].messagesHtml !== newHtml;
        this._sessions[sid].messagesHtml = newHtml;
        if (contentChanged) {
          this._sessions[sid].lastUpdated = new Date();
        }
      }
      const inputEl = document.getElementById('chatInputIndex6');
      if (inputEl) {
        this._sessions[sid].draft = (inputEl.textContent || inputEl.value || '').trim();
      }
      const taskPanel = document.getElementById('stickyTaskPanel');
      if (taskPanel && taskPanel.dataset.taskData) {
        try { this._sessions[sid].taskList = JSON.parse(taskPanel.dataset.taskData); } catch {}
      }
    }

    this._persist();
  }

  /**
   * Stamps lastMessageAt to *now* for the given (or current) session.
   * Call this at the moment a message is actually sent/received so the
   * sidebar timestamp reflects real activity, not save-time.
   */
  markActivity(sessionId) {
    const sid = sessionId ?? this._currentId;
    if (!sid || !this._sessions[sid]) return;
    this._sessions[sid].lastMessageAt = new Date();
  }

  // CHANGELOG: 2026-03-27 | REQ-8 | load() restores per-chat draft into input.
  // CHANGELOG: 2026-03-27 | REQ-9 | load() restores per-chat task list panel.

  /** Restores a session — tears down active stream, swaps DOM, updates current pointer. */
  load(sessionId) {
    if (!this._sessions[sessionId]) return;
    if (sessionId === this._currentId) return;

    if (this._surface) {
      this._surface.teardown();
      const snap = this._surface.snapshot();
      if (this._currentId && this._sessions[this._currentId]) {
        this._sessions[this._currentId].messagesHtml = snap.html;
        this._sessions[this._currentId].draft = snap.draft;
        if (snap.taskData) {
          try { this._sessions[this._currentId].taskList = JSON.parse(snap.taskData); } catch {}
        }
      }
    } else {
      this.save();
    }

    this._currentId = sessionId;
    this._state.setCurrentSession(sessionId);
    const session = this._sessions[sessionId];

    if (this._surface) {
      this._surface.restore({
        html: session.messagesHtml || '',
        draft: session.draft || '',
        msgCounter: 0,
        userOrdinal: 0,
      });
      this._surface.bind(sessionId);
      this._surface.messageList.recountFromDOM();
    } else {
      const chatEl = document.getElementById('chatMessagesIndex6');
      if (chatEl && session.messagesHtml) {
        chatEl.innerHTML = session.messagesHtml;
      } else if (chatEl) {
        chatEl.innerHTML = '';
      }
      const inputEl = document.getElementById('chatInputIndex6');
      if (inputEl) {
        if (inputEl.textContent !== undefined) inputEl.textContent = session.draft || '';
        else inputEl.value = session.draft || '';
      }
    }

    this._restoreTaskPanel(session);

    this._bridge.postMessage('switch_session', sessionId);

    this._persist();
    this._emit('session-changed', { sessionId });
  }

  _restoreTaskPanel(session) {
    const taskPanel = document.getElementById('stickyTaskPanel');
    if (!taskPanel) return;

    if (session.taskList && session.taskList.tasks && session.taskList.tasks.length > 0) {
      taskPanel.style.display = '';
      taskPanel.dataset.taskData = JSON.stringify(session.taskList);
      this._emit('task-list-restore', session.taskList);
    } else {
      taskPanel.style.display = 'none';
      taskPanel.dataset.taskData = '';
    }
  }

  /** Returns the current session id. */
  getCurrent() {
    return this._currentId;
  }

  /**
   * Payload merged into undo_response / undo_tool for Revit design-option consistency checks.
   * Fork tab = session has parentSessionId (design option bar branch).
   */
  getUndoBridgePayload() {
    const sid = this._currentId;
    const s = sid ? this._sessions[sid] : null;
    if (!s) {
      return { designOptionForkChat: false, revitDesignOptionElementId: null };
    }
    const el = s.revitDesignOptionElementId;
    return {
      designOptionForkChat: !!s.parentSessionId,
      revitDesignOptionElementId: typeof el === 'number' ? el : null
    };
  }

  /**
   * Link a chat session to a Revit Design Option element id (set from MCP / C# when save-as-option is wired).
   * @param {string} [sessionId] defaults to current
   * @param {number} elementId Revit element id integer
   */
  linkRevitDesignOptionForSession(sessionId, elementId) {
    const sid = sessionId || this._currentId;
    if (!sid || !this._sessions[sid]) return false;
    if (typeof elementId !== 'number' || Number.isNaN(elementId)) return false;
    this._sessions[sid].revitDesignOptionElementId = elementId;
    this._persist();
    return true;
  }

  /**
   * Walk parentSessionId chain to the root of the fork tree (for design-option Main tab).
   * @param {string} [sessionId]
   * @returns {string|null}
   */
  getRootSessionId(sessionId) {
    let id = sessionId ?? this._currentId;
    if (!id || !this._sessions[id]) return id;
    const seen = new Set();
    let current = this._sessions[id];
    while (current?.parentSessionId && this._sessions[current.parentSessionId]) {
      if (seen.has(current.id)) break;
      seen.add(current.id);
      current = this._sessions[current.parentSessionId];
    }
    return current?.id ?? id;
  }

  /** Returns all sessions (object keyed by id). */
  getAll() {
    return this._sessions;
  }

  /** Returns sessions that belong to the current surface (for sidebar rendering). */
  getForCurrentSurface() {
    const result = {};
    for (const [id, session] of Object.entries(this._sessions)) {
      if (!session.surfaceOrigin || session.surfaceOrigin === this._surfaceId) {
        result[id] = session;
      }
    }
    return result;
  }

  /** Deletes a session by id.  Switches away if it was the active session. */
  delete(sessionId) {
    if (!this._sessions[sessionId]) return;

    delete this._sessions[sessionId];
    this._state.removeSession(sessionId);

    if (this._currentId === sessionId) {
      const remaining = Object.values(this._sessions)
        .sort((a, b) => new Date(b.created) - new Date(a.created));
      if (remaining.length > 0) {
        this.load(remaining[0].id);
      } else {
        this.startNew();
      }
      this._emit('session-list-dirty');
      return;
    }

    this._persist();
    this._emit('session-list-dirty');
  }

  /**
   * Plain-text excerpt from a session's saved HTML for model continuity on the next chat.
   * @param {string} sessionId
   * @returns {string}
   */
  _buildPreviousChatSummary(sessionId) {
    const s = this._sessions[sessionId];
    if (!s) return '';
    if (s.messagesHtml && s.messagesHtml.trim().length > 0) {
      try {
        const doc = new DOMParser().parseFromString(s.messagesHtml, 'text/html');
        let text = (doc.body.textContent || '').replace(/\s+/g, ' ').trim();
        if (text.length > 4000) text = text.slice(-4000);
        return text;
      } catch {
        /* fall through */
      }
    }
    if (s.title && s.title !== 'New Chat') {
      return `Prior chat title: "${s.title}".`;
    }
    return '';
  }

  /**
   * Saves the current session, tells C# to reset, creates a fresh session,
   * clears the chat DOM, and shows a welcome message.
   */
  startNew() {
    const priorId = this._currentId;
    const previousSummary = priorId ? this._buildPreviousChatSummary(priorId) : '';

    this.save();

    this._bridge.postMessage('clear', '');
    if (previousSummary) {
      this._bridge.postMessage('previous_chat_summary', JSON.stringify({ text: previousSummary }));
    }

    const sessionId = this.create();
    this._currentId = sessionId;
    this._state.setCurrentSession(sessionId);

    const chatEl = document.getElementById('chatMessagesIndex6');
    if (chatEl) {
      chatEl.innerHTML = '';
      const welcome = document.createElement('div');
      welcome.className = 'chat-welcome-text';
      const summaryNote = previousSummary
        ? '<p class="chat-previous-summary-hint">The model has the <strong>previous chat summary</strong> in context for your next message.</p>'
        : '';
      welcome.innerHTML = summaryNote + '<p>New conversation started. How can I help you?</p>';
      welcome.style.opacity = '0';
      welcome.style.transform = 'translateY(8px)';
      chatEl.appendChild(welcome);
      requestAnimationFrame(() => {
        welcome.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
        welcome.style.opacity = '1';
        welcome.style.transform = 'translateY(0)';
      });
    }

    const inputEl = document.getElementById('chatInputIndex6');
    if (inputEl) inputEl.focus();

    this._persist();
    this._emit('session-created', { sessionId });
    this._emit('session-changed', { sessionId });

    console.log('[SessionManager] New chat session created:', sessionId);
  }

  /** Creates the first session on startup and renders the welcome message. */
  initialize() {
    const restored = this._restore();

    if (Object.keys(this._sessions).length === 0) {
      const sessionId = this.create();
      this._currentId = sessionId;
      this._state.setCurrentSession(sessionId);
    }

    const chatEl = document.getElementById('chatMessagesIndex6');

    if (restored && this._currentId && this._sessions[this._currentId]?.messagesHtml) {
      if (chatEl) {
        chatEl.innerHTML = this._sessions[this._currentId].messagesHtml;
      }
      console.log('[SessionManager] Restored', Object.keys(this._sessions).length, 'session(s) from storage');
    } else {
      if (chatEl) {
        chatEl.innerHTML = '';
        const welcome = document.createElement('div');
        welcome.className = 'chat-welcome-text';
        welcome.innerHTML = '<p>Hello! I\'m your AI assistant for Revit MEP coordination. How can I help you today?</p>';
        welcome.style.opacity = '0';
        welcome.style.transform = 'translateY(8px)';
        chatEl.appendChild(welcome);
        requestAnimationFrame(() => {
          welcome.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
          welcome.style.opacity = '1';
          welcome.style.transform = 'translateY(0)';
        });
      }
    }

    this._emit('session-list-dirty');
    this._emit('session-changed', { sessionId: this._currentId });

    // §C-3.4: notify C# of the initial active session so it can pull history
    // from Supabase if needed (mirrors what load() does for an explicit switch).
    if (this._currentId && this._bridge?.postMessage) {
      try { this._bridge.postMessage('switch_session', this._currentId); } catch { /* best effort */ }
    }
  }

  /** Generates a concise title from the first user message. */
  updateTitle(sessionId, firstMessage) {
    if (!this._sessions[sessionId]) return;

    const title = this._generateTitle(firstMessage);
    this._sessions[sessionId].title = title;

    this._persist();
    this._emit('session-list-dirty', { sessionId });
  }

  /** Sets an explicit title (e.g. from C# via session_title message). */
  setTitle(sessionId, title) {
    if (!this._sessions[sessionId]) return;
    this._sessions[sessionId].title = title;
    this._persist();
    this._emit('session-list-dirty', { sessionId });
  }

  _generateTitle(text) {
    if (!text || text.length < 3) return 'New Chat';

    let clean = text.replace(/\[.*?\]/g, '').trim();
    const firstSentenceEnd = clean.search(/[.!?\n]/);
    if (firstSentenceEnd > 5 && firstSentenceEnd < 60)
      clean = clean.substring(0, firstSentenceEnd);

    const stopWords = ['hi', 'hello', 'hey', 'just', 'testing', 'test', 'please', 'can you'];
    const lower = clean.toLowerCase().trim();
    const isGreeting = stopWords.some(w => lower === w || lower.startsWith(w + ' '));

    if (isGreeting && clean.length < 15) return 'New Chat';

    const maxLen = 40;
    if (clean.length > maxLen) {
      const spaceIdx = clean.lastIndexOf(' ', maxLen);
      clean = clean.substring(0, spaceIdx > 20 ? spaceIdx : maxLen) + '...';
    }

    return clean.charAt(0).toUpperCase() + clean.slice(1);
  }

  /**
   * Updates an agent session's status.
   * @param {string} agentId
   * @param {string} status - 'completed' | 'failed' | 'cancelled'
   * @param {string} [result]
   */
  updateAgentStatus(agentId, status, result) {
    this._state.updateAgent(agentId, status, result);

    const session = Object.values(this._sessions).find(s => s.agentId === agentId);
    if (!session) return;

    session.agentStatus = status;
    if (result) session.agentResult = result;
    session.lastUpdated = new Date();

    this._persist();
    this._emit('session-list-dirty', { sessionId: session.id });
  }

  // ── Branching ──────────────────────────────────────────────

  /**
   * Fork the current conversation at the given message index.
   * Saves the current session, creates a new child session with the chat
   * DOM truncated to the branch point, and tells C# to truncate history.
   *
   * @param {number} atMessageIndex - The data-msg-index value to branch at (inclusive).
   * @param {string|null} editedText - Optional edited message text. When provided,
   *   the last user message in the branch DOM is updated and the text is forwarded
   *   to C# so it can auto-send on the truncated history. This makes every edit
   *   create a proper branch (parent preserved) instead of a destructive rewrite.
   *   CHANGELOG: 2026-03-26 | branch() | Added editedText param so edit-send
   *   creates an option-scoped branch instead of destroying history.
   */
  branch(atMessageIndex, editedText = null) {
    this.save();

    const parentId = this._currentId;
    const parentSession = this._sessions[parentId];
    const parentTitle = parentSession?.title || 'Chat';

    const chatEl = document.getElementById('chatMessagesIndex6');
    if (!chatEl) return null;

    const allMessages = chatEl.querySelectorAll('[data-msg-index]');
    const keepHtml = [];
    let historyCount = 0;
    for (const el of allMessages) {
      const idx = parseInt(el.getAttribute('data-msg-index'), 10);
      if (idx > atMessageIndex) break;
      const row = el.closest('.user-msg-row');
      keepHtml.push(row ? row.outerHTML : el.outerHTML);
      historyCount++;
    }

    const sessionId = this.create({
      title: '⑂ ' + parentTitle,
      parentSessionId: parentId
    });

    this._sessions[sessionId].messagesHtml = keepHtml.join('');
    this._currentId = sessionId;
    this._state.setCurrentSession(sessionId);

    chatEl.innerHTML = this._sessions[sessionId].messagesHtml;

    // If edited text provided, update the last user message in the branch DOM
    // so it shows the edited version, then re-save the HTML snapshot.
    if (editedText) {
      const userMsgs = chatEl.querySelectorAll('.demo-msg-user');
      const lastUser = userMsgs[userMsgs.length - 1];
      if (lastUser) {
        const p = lastUser.querySelector('p');
        if (p) p.textContent = editedText;
      }
      this._sessions[sessionId].messagesHtml = chatEl.innerHTML;
    }

    const payload = { index: historyCount };
    if (editedText) payload.text = editedText;
    this._bridge.postMessage('branch', JSON.stringify(payload));

    this._persist();
    this._emit('session-created', { sessionId, parentSessionId: parentId });
    this._emit('session-changed', { sessionId });

    const inputEl = document.getElementById('chatInputIndex6');
    if (inputEl) inputEl.focus();

    console.log('[SessionManager] Branched at message', atMessageIndex, '→', sessionId);
    return sessionId;
  }

  // ── Persistence ─────────────────────────────────────────────

  // CHANGELOG: 2026-03-27 | REQ-7 | Version bumped to 3. Adds draft, taskList, options fields.
  // CHANGELOG: 2026-04-20 | A-4 | Version bumped to 4. session.messages[] now carries
  //            structured {role,text,turnIndex,timestamp} entries alongside messagesHtml.
  /** Writes all session data to localStorage. */
  _persist() {
    try {
      const payload = {
        version: 4,
        sessions: this._sessions,
        currentId: this._currentId,
        counter: this._counter
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      this._scheduleProjectArchiveSync();
    } catch (e) {
      console.warn('[SessionManager] Failed to persist sessions:', e.message);
    }
  }

  /**
   * Mirror localStorage payload to a JSON file next to the saved .rvt (C# debounced write).
   */
  _scheduleProjectArchiveSync() {
    if (!this._bridge) return;
    clearTimeout(this._projectArchiveTimer);
    this._projectArchiveTimer = setTimeout(() => {
      try {
        const payload = {
          version: 3,
          sessions: this._sessions,
          currentId: this._currentId,
          counter: this._counter
        };
        this._bridge.postMessage(
          'project_chats_save',
          JSON.stringify({ json: JSON.stringify(payload) })
        );
      } catch (e) {
        console.warn('[SessionManager] Project archive sync:', e.message);
      }
    }, 800);
  }

  /**
   * Merge sessions from project sidecar or imported file. New ids are added; same id keeps newer lastUpdated.
   * @param {string} jsonStr
   * @returns {{ added: number, updated: number }}
   */
  mergeProjectSessionsFromJson(jsonStr) {
    let added = 0;
    let updated = 0;
    if (!jsonStr || typeof jsonStr !== 'string') return { added, updated };
    let data;
    try {
      data = JSON.parse(jsonStr);
    } catch {
      return { added, updated };
    }
    if (!data || !data.sessions || typeof data.sessions !== 'object') return { added, updated };

    const normalize = (session) => {
      if (!session || typeof session !== 'object') return null;
      if (session.revitDesignOptionElementId === undefined) session.revitDesignOptionElementId = null;
      session.created = session.created ? new Date(session.created) : new Date();
      session.lastUpdated = session.lastUpdated ? new Date(session.lastUpdated) : session.created;
      session.lastMessageAt = session.lastMessageAt ? new Date(session.lastMessageAt) : session.lastUpdated;
      if (!session.draft) session.draft = '';
      if (!session.taskList) session.taskList = null;
      if (!session.options) session.options = { opt_main: { messages: [], activeBranch: 'br_root' } };
      if (!session.surfaceOrigin) session.surfaceOrigin = this._surfaceId || 'main';
      if (!session.activeOptionId) session.activeOptionId = 'opt_main';
      if (!session.activeBranchId) session.activeBranchId = 'br_root';
      return session;
    };

    for (const id of Object.keys(data.sessions)) {
      const raw = { ...data.sessions[id] };
      if (!raw.id) raw.id = id;
      const remote = normalize(raw);
      if (!remote || !remote.id) continue;
      const rTime = new Date(remote.lastUpdated).getTime();
      const local = this._sessions[id];
      if (!local) {
        this._sessions[id] = remote;
        this._state.addSession(remote);
        added++;
        continue;
      }
      const lTime = new Date(local.lastUpdated || local.created).getTime();
      if (rTime > lTime) {
        this._sessions[id] = { ...local, ...remote };
        this._state.addSession(this._sessions[id]);
        updated++;
      }
    }

    this._emit('session-list-dirty');
    this._persist();
    return { added, updated };
  }

  /**
   * Reads sessions back from localStorage.
   * Returns true if sessions were successfully restored.
   */
  _restore() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;

      const data = JSON.parse(raw);
      if (!data || !data.sessions || Object.keys(data.sessions).length === 0) return false;

      this._sessions = data.sessions;
      this._currentId = data.currentId;
      this._counter = data.counter || 0;

      const version = data.version || 1;

      // CHANGELOG: 2026-03-27 | REQ-7 | Migration: v1 strips agent sessions,
      // v2→v3 adds draft, taskList, options fields to existing sessions.
      if (version < 2) {
        for (const id of Object.keys(this._sessions)) {
          if (this._sessions[id].isAgent) {
            delete this._sessions[id];
          }
        }
        if (this._currentId && !this._sessions[this._currentId]) {
          const remaining = Object.values(this._sessions)
            .sort((a, b) => new Date(b.created) - new Date(a.created));
          this._currentId = remaining.length > 0 ? remaining[0].id : null;
        }
      }
      if (version < 3) {
        for (const session of Object.values(this._sessions)) {
          if (!session.draft) session.draft = '';
          if (!session.taskList) session.taskList = null;
          if (!session.options) session.options = { opt_main: { messages: [], activeBranch: 'br_root' } };
          if (!session.surfaceOrigin) session.surfaceOrigin = 'main';
          if (!session.activeOptionId) session.activeOptionId = 'opt_main';
          if (!session.activeBranchId) session.activeBranchId = 'br_root';
        }
      }
      if (version < 4) {
        // v4 introduces structured messages[] on the session root. Pre-v4
        // sessions only have messagesHtml — we don't retro-fit because any
        // attempt to parse HTML back into structured turns is fragile.
        // New messages from here on will populate messages[]; the restore
        // path (C# ChatHistoryRepository) will use messages[] when present
        // and fall back to messagesHtml when not.
        for (const session of Object.values(this._sessions)) {
          if (!Array.isArray(session.messages)) session.messages = [];
        }
      }

      for (const session of Object.values(this._sessions)) {
        if (session.revitDesignOptionElementId === undefined) session.revitDesignOptionElementId = null;
        session.created = new Date(session.created);
        session.lastUpdated = new Date(session.lastUpdated);
        if (session.lastMessageAt) {
          session.lastMessageAt = new Date(session.lastMessageAt);
        } else {
          session.lastMessageAt = session.lastUpdated;
        }
        this._state.addSession(session);
      }

      if (this._currentId) {
        this._state.setCurrentSession(this._currentId);
      }

      return true;
    } catch (e) {
      console.warn('[SessionManager] Failed to restore sessions:', e.message);
      return false;
    }
  }

  // ── Agentic Branch Tree ─────────────────────────────────────

  /**
   * Handle branch_tree_update from C# (agentic modelling).
   * Creates/updates local session entries for C#-owned branch sessions
   * without overwriting root or user-created sessions.
   *
   * @param {object} payload - { branches: [...], rootId, activeId, totalCount }
   */
  handleBranchTreeUpdate(payload) {
    if (!payload?.branches) return;

    let changed = false;
    for (const branch of payload.branches) {
      const existing = this._sessions[branch.sessionId];
      if (existing) {
        // Update status of existing branch
        existing.agenticStatus = branch.status;
        existing.agenticPurpose = branch.purpose;
        existing.resultSummary = branch.resultSummary;
        existing.lastUpdated = new Date();
        changed = true;
      } else {
        // Create new local session for the C# branch
        this._sessions[branch.sessionId] = {
          id: branch.sessionId,
          title: '⑂ ' + (branch.purpose || 'Branch'),
          messages: [],
          created: new Date(branch.createdAt),
          lastUpdated: new Date(),
          lastMessageAt: new Date(),
          parentSessionId: branch.parentSessionId,
          isCSharpBranch: true,
          agenticStatus: branch.status,
          agenticPurpose: branch.purpose,
          agenticDepth: branch.depth,
          agenticMode: branch.mode,
          resultSummary: branch.resultSummary,
          revitDesignOptionElementId:
            typeof branch.revitDesignOptionElementId === 'number'
              ? branch.revitDesignOptionElementId
              : null
        };
        this._state.addSession(this._sessions[branch.sessionId]);
        changed = true;
      }
    }

    // Remove branches that no longer exist in C# tree
    for (const [id, session] of Object.entries(this._sessions)) {
      if (session.isCSharpBranch && !payload.branches.find(b => b.sessionId === id)) {
        delete this._sessions[id];
        this._state.removeSession(id);
        changed = true;
      }
    }

    if (changed) {
      this._persist();
      this._emit('session-list-dirty');
    }

    console.log('[SessionManager] Branch tree updated:', payload.branches.length, 'branches');
  }

  /**
   * Handle branch_merged from C# — update the branch session status.
   * @param {object} payload - { sessionId, parentSessionId, summary }
   */
  handleBranchMerged(payload) {
    const session = this._sessions[payload?.sessionId];
    if (session) {
      session.agenticStatus = 'completed';
      session.resultSummary = payload.summary;
      session.lastUpdated = new Date();
      this._persist();
      this._emit('session-list-dirty');
    }
  }

  /**
   * Handle branch_reverted from C# — remove the branch session.
   * @param {object} payload - { sessionId }
   */
  handleBranchReverted(payload) {
    const id = payload?.sessionId;
    if (id && this._sessions[id]) {
      delete this._sessions[id];
      this._state.removeSession(id);
      this._persist();
      this._emit('session-list-dirty');
    }
  }

  /**
   * Handle branch_delegated from C# — mark a new active branch.
   * @param {object} payload - { sessionId, parentSessionId, windowType, purpose }
   */
  handleBranchDelegated(payload) {
    // The branch will be created via handleBranchTreeUpdate, but we can
    // show a visual notification here
    console.log('[SessionManager] Branch delegated:', payload?.windowType, payload?.purpose);
  }

  /** Emit an event via the state's EventBus. */
  _emit(event, data) {
    this._state._eventBus?.emit(event, data);
  }
}
