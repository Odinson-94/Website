import { escapeHtml } from '../messages/MessageParser.js';
import { formatTimeAgo } from '../session/SidebarChatHistoryTree.js';
import { compareSessionsByLastActivity } from '../session/ChatHistoryOrder.js';

/**
 * AgentPanel — Agent / designer conversation list panel.
 *
 * Extracted from view6-chat.js:
 *   - updateHistorySidebar()    (lines 1466-1488) — renders session list
 *   - formatTimeAgo()           (lines 1490-1499) — relative timestamps
 *   - designerCount / search    (index.html lines 197-208)
 *
 * DOM targets:
 *   .sidebar-panel[data-panel="agents"]
 *   #chatHistoryIndex6      — session list container
 *   #agentHistorySearch6    — search input
 *   #designerCount          — footer count label
 *   .new-agent-btn          — "New Designer" button
 *
 * Responsibilities:
 *   - Filter/search sessions by title (flat list only while searching)
 *   - Update the "N chats" footer count
 *
 * Search-result order: ../session/ChatHistoryOrder.js (compareSessionsByLastActivity).
 * Full tree order: SidebarChatHistoryTree + same module.
 */
export class AgentPanel {
  /** @param {import('../state/ChatState.js').ChatState} state */
  /** @param {import('../../shared/EventBus.js').EventBus} eventBus */
  constructor(state, eventBus) {
    this._state = state;
    this._eventBus = eventBus;

    this._listEl = document.getElementById('chatHistoryIndex6');
    this._searchEl = document.getElementById('agentHistorySearch6');
    this._countEl = document.getElementById('designerCount');
    this._newBtn = document.querySelector('.new-agent-btn');
    this._query = '';

    this._attachSearch();
    this._attachNewBtn();
  }

  // ── Public API ──────────────────────────────────────────────

  /** Re-render the session list from current state. */
  render() {
    if (!this._listEl) return;

    const sessions = this._getSessions();
    this._listEl.innerHTML = '';

    const sorted = Object.values(sessions)
      .filter(s => this._matchesSearch(s))
      .sort(compareSessionsByLastActivity);

    sorted.forEach(session => {
      const item = document.createElement('div');
      const isActive = session.id === this._state.currentSessionId;
      item.className = 'demo-history-item' + (isActive ? ' active' : '');
      item.setAttribute('data-session-id', session.id);
      const timestamp = session.lastMessageAt || session.lastUpdated || session.created;
      item.innerHTML = `
        <div class="demo-history-item-title">${escapeHtml(session.title)}</div>
        <div class="demo-history-item-preview">${formatTimeAgo(timestamp)}</div>
      `;
      this._listEl.appendChild(item);
    });

    this.updateCount();
  }

  /** Filter sessions by search query. */
  search(query) {
    this._query = (query || '').trim().toLowerCase();
    if (!this._query) {
      // When search is cleared, restore the full session list via SidebarChatHistoryTree
      // (which uses chatSessionsStore.getForCurrentSurface() — the correct data source).
      // AgentPanel's flat render would lose the tree structure and branch indentation.
      this._eventBus.emit('session-list-dirty');
      this.updateCount();
      return;
    }
    this.render();
  }

  /** Update the designer count footer. */
  updateCount() {
    if (!this._countEl) return;
    const sessions = this._getSessions();
    const count = Object.keys(sessions).length;
    this._countEl.textContent = `${count} chat${count !== 1 ? 's' : ''}`;
  }

  // ── Private ─────────────────────────────────────────────────

  _getSessions() {
    return this._state.chatSessions || window.chatSessions || {};
  }

  _matchesSearch(session) {
    if (!this._query) return true;
    return (session.title || '').toLowerCase().includes(this._query);
  }

  _attachSearch() {
    if (!this._searchEl) return;
    this._searchEl.addEventListener('input', () => {
      this.search(this._searchEl.value);
    });
  }

  _attachNewBtn() {
    if (!this._newBtn) return;
    this._newBtn.addEventListener('click', (e) => {
      e.preventDefault();
      this._eventBus.emit('new-chat-requested');
    });
  }

}
