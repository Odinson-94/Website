/**
 * DesignOptionsBar — Design option tabs that fork the conversation at exact points.
 *
 * Each tab maps 1:1 to a session (via SessionManager). Switching tabs swaps
 * the chat message stream AND tells C# to switch the active CallClaudeApi.
 *
 * DOM targets:
 *   .design-options-bar          — container
 *   .design-tabs                 — tab row
 *   .design-tab                  — individual tab buttons
 *   .design-option-add           — "+" add button
 *
 * CHANGELOG:
 * 2026-03-26 | Part 3a+3b: Rewrote to fork via SessionManager.branch(),
 *            | bind tabs to sessionIds, switch tabs swaps messages + C#
 *            | CallClaudeApi. Close tab triggers merge/revert via bridge.
 *            | See Sequential Agent DE Pipeline plan Part 3.
 * 2026-03-26 | Chat containerization: Added syncMainTab() + session-changed
 *            | listener to keep main tab data-session-id in sync after
 *            | SessionManager.initialize(). Replaced dead _closeTab event
 *            | pattern (design-option-closing had zero listeners) with inline
 *            | Merge/Discard confirm popover that directly closes the tab.
 */
let nextOptionNumber = 2;

export class DesignOptionsBar {
  /**
   * @param {import('../state/ChatState.js').ChatState} state
   * @param {import('../../shared/EventBus.js').EventBus} eventBus
   * @param {import('../session/SessionManager.js').SessionManager} [sessionManager]
   */
  constructor(state, eventBus, sessionManager) {
    this._state = state;
    this._eventBus = eventBus;
    this._sessionManager = sessionManager;

    this._bar = document.querySelector('.design-options-bar');
    this._tabsContainer = this._bar?.querySelector('.design-tabs');
    this._addBtn = this._bar?.querySelector('.design-option-add');

    this._initMainTab();
    this._attachDelegated();
    this._attachAdd();

    this._eventBus.on('branch_delegated_tab', (data) => this._addBranchTab(data));
    this._eventBus.on('branch_merged_tab', (data) => this._markTabCompleted(data));
    this._eventBus.on('session-changed', (data) => {
      const active = this.getActiveOption();
      if (!active || active === 'main') {
        const sid = data?.sessionId && this._sessionManager
          ? this._sessionManager.getRootSessionId(data.sessionId)
          : data?.sessionId;
        this.syncMainTab(sid);
      }
    });
  }

  // CHANGELOG: 2026-03-27 | 6K.4 | setSessionManager now calls _initMainTab() to bind
  // the main tab to the current session. Previously _initMainTab ran in the constructor
  // before SessionManager was available, so the main tab never got its data-session-id.
  /** Lazily connect to SessionManager (set after construction). */
  setSessionManager(sm) {
    this._sessionManager = sm;
    this._initMainTab();
  }

  /** Sync the main tab's data-session-id to the given session. */
  syncMainTab(sessionId) {
    const mainTab = this._tabsContainer?.querySelector('.design-tab[data-tab="main"]');
    if (mainTab && sessionId) {
      mainTab.dataset.sessionId = sessionId;
    }
  }

  // ── Public API ──────────────────────────────────────────────

  /**
   * Fork the conversation at the current message point and create a new tab.
   * Returns the created tab element, or null if fork failed.
   */
  addOption() {
    if (!this._tabsContainer || !this._addBtn) return null;
    const sm = this._sessionManager;
    if (!sm) {
      console.warn('[DesignOptionsBar] No SessionManager — cannot fork');
      return null;
    }

    const chatEl = document.getElementById('chatMessagesIndex6');
    const allMessages = chatEl?.querySelectorAll('[data-msg-index]');
    const lastIndex = allMessages?.length
      ? parseInt(allMessages[allMessages.length - 1].getAttribute('data-msg-index'), 10)
      : 0;

    const sessionId = sm.branch(lastIndex);
    if (!sessionId) return null;

    const tab = this._createTab(`Option ${nextOptionNumber}`, sessionId);
    nextOptionNumber++;
    this._tabsContainer.insertBefore(tab, this._addBtn);
    this._switchToTab(tab);

    this._eventBus.emit('design-option-added', { tabEl: tab, tabId: tab.dataset.tab, sessionId });
    return tab;
  }

  /**
   * Add a tab for a C#-created branch (agentic window branch).
   * Called when the orchestrator delegates to a window.
   */
  addBranchTab(sessionId, label) {
    if (!this._tabsContainer || !this._addBtn) return null;
    const tab = this._createTab(label || 'Branch', sessionId);
    tab.classList.add('branch-tab');
    this._tabsContainer.insertBefore(tab, this._addBtn);
    return tab;
  }

  /** Switch the active design option to the given tab element. */
  switchOption(tabEl) {
    this._switchToTab(tabEl);
  }

  /** Return the dataset.tab id of the currently active option. */
  getActiveOption() {
    const active = this._tabsContainer?.querySelector('.design-tab.active');
    return active?.dataset.tab ?? null;
  }

  /** Return the sessionId of the currently active tab. */
  getActiveSessionId() {
    const active = this._tabsContainer?.querySelector('.design-tab.active');
    return active?.dataset.sessionId ?? null;
  }

  // ── Private ─────────────────────────────────────────────────

  _initMainTab() {
    const mainTab = this._tabsContainer?.querySelector('.design-tab[data-tab="main"]');
    if (mainTab && this._sessionManager) {
      const cur = this._sessionManager.getCurrent();
      mainTab.dataset.sessionId = this._sessionManager.getRootSessionId(cur) || cur || '';
    }
  }

  _createTab(label, sessionId) {
    const tab = document.createElement('button');
    tab.className = 'design-tab';
    tab.dataset.tab = `option-${nextOptionNumber}`;
    tab.dataset.sessionId = sessionId;
    tab.innerHTML = `${label} <span class="tab-close">\u00d7</span>`;
    return tab;
  }

  _switchToTab(tabEl) {
    if (!tabEl || !this._tabsContainer) return;

    this._tabsContainer.querySelectorAll('.design-tab').forEach(t => t.classList.remove('active'));
    tabEl.classList.add('active');

    const sessionId = tabEl.dataset.sessionId;
    if (sessionId && this._sessionManager) {
      this._sessionManager.load(sessionId);
    }

    this._eventBus.emit('design-option-changed', { tabId: tabEl.dataset.tab, sessionId });
  }

  _closeTab(tab) {
    if (!tab || tab.dataset.tab === 'main') return;

    if (tab.querySelector('.tab-close-confirm')) return;
    this._dismissTabConfirm();

    const confirm = document.createElement('div');
    confirm.className = 'tab-close-confirm';
    confirm.innerHTML =
      '<button class="tab-confirm-btn tab-confirm-merge" title="Merge changes">Merge</button>' +
      '<button class="tab-confirm-btn tab-confirm-discard" title="Discard changes">Discard</button>';
    tab.appendChild(confirm);
    tab.classList.add('confirming');

    const sessionId = tab.dataset.sessionId;
    const wasActive = tab.classList.contains('active');

    const finish = (action) => {
      if (sessionId && this._sessionManager?._bridge) {
        this._sessionManager._bridge.postMessage(
          action === 'merged' ? 'merge_branch' : 'revert_branch', sessionId);
      }
      tab.remove();
      if (wasActive) this._switchToMainTab();
      this._eventBus.emit('design-option-removed', { tabId: tab.dataset.tab, sessionId, action });
    };

    confirm.querySelector('.tab-confirm-merge').addEventListener('click', (e) => {
      e.stopPropagation();
      finish('merged');
    });
    confirm.querySelector('.tab-confirm-discard').addEventListener('click', (e) => {
      e.stopPropagation();
      finish('reverted');
    });

    const dismiss = (e) => {
      if (tab.contains(e.target)) return;
      document.removeEventListener('click', dismiss, true);
      confirm.remove();
      tab.classList.remove('confirming');
    };
    setTimeout(() => document.addEventListener('click', dismiss, true), 0);
  }

  _dismissTabConfirm() {
    this._tabsContainer?.querySelectorAll('.tab-close-confirm').forEach(el => {
      el.closest('.design-tab')?.classList.remove('confirming');
      el.remove();
    });
  }

  _switchToMainTab() {
    const mainTab = this._tabsContainer?.querySelector('.design-tab[data-tab="main"]');
    if (mainTab) this._switchToTab(mainTab);
  }

  _addBranchTab(data) {
    if (data?.sessionId && data?.windowType) {
      this.addBranchTab(data.sessionId, data.windowType);
    }
  }

  _markTabCompleted(data) {
    if (!data?.sessionId) return;
    const tab = this._tabsContainer?.querySelector(`[data-session-id="${data.sessionId}"]`);
    if (tab) tab.classList.add('completed');
  }

  _attachDelegated() {
    if (!this._tabsContainer) return;

    this._tabsContainer.addEventListener('click', (e) => {
      const closeBtn = e.target.closest('.tab-close');
      if (closeBtn) {
        e.stopPropagation();
        const tab = closeBtn.closest('.design-tab');
        this._closeTab(tab);
        return;
      }

      const tab = e.target.closest('.design-tab');
      if (tab) {
        this._switchToTab(tab);
      }
    });
  }

  _attachAdd() {
    if (!this._addBtn) return;
    this._addBtn.addEventListener('click', (e) => {
      e.preventDefault();
      this.addOption();
    });
  }
}
