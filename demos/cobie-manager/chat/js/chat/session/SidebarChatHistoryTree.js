import { escapeHtml } from '../messages/MessageParser.js';
import { animateSidebarHistoryRow } from '../sidebar/DesignerSidebarAnimator.js';
import {
  subscribeSessionHistoryBusy,
  syncSessionHistoryBusy,
} from '../sidebar/ActiveAgentSidebar.js';
import {
  compareRootSessionsForSidebar,
  compareChildSessionsForSidebar,
} from './ChatHistoryOrder.js';

/**
 * SidebarChatHistoryTree — renders #chatHistoryIndex6 (full tree). AgentPanel replaces
 * this container only while the user is searching (flat list); clearing
 * search emits session-list-dirty to restore this tree.
 *
 * Listens for session-changed / session-created events and re-renders
 * the #chatHistoryIndex6 container with sorted session items.
 * Sort comparators: ./ChatHistoryOrder.js only (do not duplicate .sort elsewhere).
 *
 * Source: view6-chat.js lines 1466-1498
 *
 * CHANGELOG:
 * 2026-03-29 | ActiveAgentSidebar: busy ring + session-row-busy sync;
 *            | full render calls _updateHighlight() for parent-active.
 * 2026-03-26 | Chat containerization: Replaced immediate delete in
 *            | _initDeleteHandler with two-step confirm popover
 *            | ("Delete" / "Delete + Clear History"). Added
 *            | _showDeleteConfirm() and _dismissDeleteConfirm().
 */
export class SidebarChatHistoryTree {
  constructor(state, eventBus) {
    this._state = state;
    this._eventBus = eventBus;

    eventBus.on('session-changed', () => this._updateHighlight());
    eventBus.on('session-created', (data) => {
      if (data?.sessionId && this._tryPrependNewSession(data.sessionId)) return;
      this.render();
    });
    eventBus.on('session-list-dirty', () => this.render());

    subscribeSessionHistoryBusy(this._state, this._eventBus);

    this._initDeleteHandler();
  }

  /**
   * Lightweight active-class update — avoids a full DOM rebuild when the user
   * simply switches between sessions.
   * Also highlights the parent session when a child (design option / branch) is active.
   */
  _updateHighlight() {
    const container = document.getElementById('chatHistoryIndex6');
    if (!container) return;
    const currentId = this._state.currentSessionId;

    // Find the parent session ID of the current session (if it's a child/option)
    const sm = this._state.chatSessionsStore;
    const sessions = sm ? sm.getAll() : (this._state.sessions ?? {});
    const currentSession = sessions[currentId];
    const parentId = currentSession?.parentSessionId || null;

    container.querySelectorAll('.demo-history-item').forEach(item => {
      const itemId = item.getAttribute('data-session-id');
      const isActive = itemId === currentId;
      const isParentOfActive = parentId && itemId === parentId;

      item.classList.toggle('active', isActive);
      item.classList.toggle('parent-active', !!isParentOfActive);
    });

    syncSessionHistoryBusy(this._state);
  }

  /**
   * Insert the new session row at the top with animation (avoids full list flash).
   * @returns {boolean} true if handled
   */
  _tryPrependNewSession(sessionId) {
    const sessions = this._state.sessions ?? {};
    const session = sessions[sessionId];
    if (!session) return false;

    const container = document.getElementById('chatHistoryIndex6');
    if (!container) return false;

    const item = this._createHistoryItemElement(session);
    container.insertBefore(item, container.firstChild);
    this._updateHighlight();
    animateSidebarHistoryRow(item);
    return true;
  }

  /**
   * @param {object} session
   * @returns {HTMLDivElement}
   */
  _createHistoryItemElement(session) {
    const currentId = this._state.currentSessionId;
    const item = document.createElement('div');
    item.className = 'demo-history-item'
      + (session.id === currentId ? ' active' : '')
      + (session.isAgent ? ' agent-session' : '');
    item.setAttribute('data-session-id', session.id);

    let prefix = '';
    if (session.isAgent) {
      const statusColor = session.agentStatus === 'completed' ? '#4CD964'
        : session.agentStatus === 'failed' ? '#f85149'
        : session.agentStatus === 'cancelled' ? '#666'
        : '#4a9bb8';
      prefix = '<span style="margin-right:4px;display:inline-flex;align-items:center;gap:3px;" title="Sub-agent: ' + escapeHtml(session.agentTask || '') + '">'
        + '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="' + statusColor + '" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 4-7 8-7s8 3 8 7"/><path d="M2 12h3M19 12h3M12 2v3"/></svg>'
        + '</span>';
    } else if (session.isCSharpBranch) {
      // Agentic branch from C# — show status dot + indent
      const statusColor = session.agenticStatus === 'completed' ? '#4CD964'
        : session.agenticStatus === 'failed' ? '#f85149'
        : session.agenticStatus === 'cancelled' ? '#666'
        : session.agenticStatus === 'active' ? '#f0a500'
        : '#4a9bb8';
      const depth = session.agenticDepth || 1;
      item.style.paddingLeft = (8 + depth * 16) + 'px';
      prefix = '<span style="display:inline-flex;align-items:center;gap:4px;margin-right:4px;" title="' + escapeHtml(session.agenticPurpose || 'Branch') + '">'
        + '<span style="width:8px;height:8px;border-radius:50%;background:' + statusColor + ';display:inline-block;"></span>'
        + '⑂'
        + '</span>';
    } else if (session.parentSessionId) {
      prefix = '<span style="color:#4a9bb8;margin-right:4px;" title="Branched conversation">⑂</span>';
    }

    const agentBadge = session.isAgent
      ? '<span style="font-size:9px;color:#555;background:#2a2a2a;border-radius:3px;padding:1px 4px;margin-left:auto;">' + escapeHtml(session.agentMode || 'Build') + '</span>'
      : '';

    // Agentic branch action buttons
    let branchActions = '';
    if (session.isCSharpBranch) {
      if (session.agenticStatus === 'completed') {
        branchActions = '<button class="branch-merge-btn" data-session-id="' + session.id + '" title="Merge branch results" style="font-size:10px;padding:1px 4px;border-radius:3px;background:#2d5a2d;color:#4CD964;border:1px solid #4CD964;cursor:pointer;margin-left:4px;">Merge</button>';
      }
      if (session.agenticStatus !== 'cancelled') {
        branchActions += '<button class="branch-revert-btn" data-session-id="' + session.id + '" title="Revert branch" style="font-size:10px;padding:1px 4px;border-radius:3px;background:#5a2d2d;color:#f85149;border:1px solid #f85149;cursor:pointer;margin-left:2px;">Revert</button>';
      }
    }

    // Use lastMessageAt (when last message was sent/received), not created (when session was first created).
    // Falls back to lastUpdated then created for sessions that haven't had markActivity() called yet.
    const timestamp = session.lastMessageAt || session.lastUpdated || session.created;

    item.innerHTML = `
      <div class="demo-history-item-title" style="display:flex;align-items:center;gap:2px;">${prefix}${escapeHtml(session.title)}${agentBadge}${branchActions}</div>
      <div class="demo-history-item-preview">${this.formatTimeAgo(timestamp)}${session.resultSummary ? ' — ' + escapeHtml(session.resultSummary).substring(0, 40) : ''}</div>
      <span class="demo-history-item-busy-ring" aria-hidden="true"></span>
      <button class="chat-delete-btn" data-session-id="${session.id}" title="Delete chat">✕</button>
    `;
    return item;
  }

  /**
   * Populates #chatHistoryIndex6 using a recursive tree structure.
   * Root sessions (no parent) are H1, their children are H2, grandchildren H3.
   * This gives the user a proper tree navigation view of the conversation hierarchy.
   */
  render() {
    const container = document.getElementById('chatHistoryIndex6');
    if (!container) return;

    container.innerHTML = '';

    const sm = this._state.chatSessionsStore;
    const sessions = sm ? sm.getForCurrentSurface() : (this._state.sessions ?? {});

    const roots = Object.values(sessions)
      .filter(s => !s.parentSessionId)
      .sort((a, b) => compareRootSessionsForSidebar(a, b, sessions));

    // Detect orphan branches (parent deleted) — log as diagnostic
    const orphans = Object.values(sessions)
      .filter(s => s.parentSessionId && !sessions[s.parentSessionId]);
    if (orphans.length > 0) {
      console.warn('[SidebarChatHistoryTree] failure - yes: orphan branches detected:', orphans.map(s => s.id));
    }

    // Render tree recursively
    roots.forEach(root => {
      this._renderNode(container, root, sessions, 0);
    });

    // Orphans (missing parent): show at end, ordered by last activity
    orphans.sort(compareChildSessionsForSidebar);
    orphans.forEach(orphan => {
      this._renderNode(container, orphan, sessions, 1);
    });

    this._updateHighlight();
  }

  /**
   * Recursively render a session node and its children.
   * @param {HTMLElement} container
   * @param {object} session
   * @param {object} allSessions
   * @param {number} depth - 0=H1 (root), 1=H2 (branch), 2+=H3 (sub-branch)
   */
  _renderNode(container, session, allSessions, depth) {
    const heading = depth === 0 ? 'h1' : depth === 1 ? 'h2' : 'h3';
    const item = this._createHistoryItemElement(session);
    item.setAttribute('data-depth', depth);
    item.setAttribute('data-heading', heading);

    // Apply heading-level styles
    if (heading === 'h1') {
      item.style.fontWeight = '600';
      item.style.fontSize = '12px';
    } else if (heading === 'h2') {
      item.style.paddingLeft = (8 + 16) + 'px';
      item.style.fontSize = '11px';
      item.style.borderLeft = '2px solid #3c3c3c';
    } else {
      item.style.paddingLeft = (8 + 32) + 'px';
      item.style.fontSize = '10px';
      item.style.borderLeft = '2px solid #333';
    }

    container.appendChild(item);

    // Render children after parent (BUG-006: by last message time, newest first)
    const children = Object.values(allSessions)
      .filter(s => s.parentSessionId === session.id)
      .sort(compareChildSessionsForSidebar);

    children.forEach(child => {
      this._renderNode(container, child, allSessions, depth + 1);
    });
  }

  /** Delegated click handler for delete buttons. */
  _initDeleteHandler() {
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.chat-delete-btn');
      if (!btn) return;
      e.stopPropagation();
      const sessionId = btn.dataset.sessionId;
      this._showDeleteConfirm(btn, sessionId);
    });

    document.addEventListener('click', (e) => {
      const action = e.target.closest('.delete-confirm-action');
      if (!action) return;
      e.stopPropagation();
      const sessionId = action.dataset.sessionId;
      const sm = this._state.chatSessionsStore;
      if (action.dataset.action === 'delete') {
        if (sm) sm.delete(sessionId);
      } else if (action.dataset.action === 'delete-history') {
        if (window.chrome?.webview) {
          window.chrome.webview.postMessage(JSON.stringify({ type: 'clear_history', payload: sessionId }));
        }
        if (sm) sm.delete(sessionId);
      }
      this._dismissDeleteConfirm();
    });

    document.addEventListener('click', (e) => {
      if (e.target.closest('.delete-confirm-popover')) return;
      if (e.target.closest('.chat-delete-btn')) return;
      this._dismissDeleteConfirm();
    });

    // Agentic branch merge button
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.branch-merge-btn');
      if (!btn) return;
      e.stopPropagation();
      const sessionId = btn.dataset.sessionId;
      if (window.chrome?.webview) {
        window.chrome.webview.postMessage(JSON.stringify({ type: 'merge_branch', payload: sessionId }));
      }
      // Return to parent after merge
      const app = window.ChatApp;
      if (app?._branchReturnSessionId) {
        app.chatSessionsStore.load(app._branchReturnSessionId);
        app._branchReturnSessionId = null;
      }
    });

    // Agentic branch revert button
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.branch-revert-btn');
      if (!btn) return;
      e.stopPropagation();
      const sessionId = btn.dataset.sessionId;
      if (window.chrome?.webview) {
        window.chrome.webview.postMessage(JSON.stringify({ type: 'revert_branch', payload: sessionId }));
      }
      // Return to parent after revert
      const app = window.ChatApp;
      if (app?._branchReturnSessionId) {
        app.chatSessionsStore.load(app._branchReturnSessionId);
        app._branchReturnSessionId = null;
      }
    });

    // Branch "Return to Parent" button
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.branch-return-btn');
      if (!btn) return;
      e.stopPropagation();
      const returnTo = btn.dataset.returnTo;
      const app = window.ChatApp;
      if (returnTo && app?.chatSessionsStore) {
        app.chatSessionsStore.load(returnTo);
        app._branchReturnSessionId = null;
        // Tell C# to switch back to root
        if (window.chrome?.webview) {
          window.chrome.webview.postMessage(JSON.stringify({ type: 'switch_session', payload: returnTo }));
        }
      } else {
        console.warn('[SidebarChatHistoryTree] failure - yes: Return to parent failed, no returnTo session ID');
      }
    });
  }

  _showDeleteConfirm(anchorEl, sessionId) {
    this._dismissDeleteConfirm();
    const popover = document.createElement('div');
    popover.className = 'delete-confirm-popover';
    popover.innerHTML =
      '<span class="delete-confirm-title">Delete this chat?</span>' +
      '<button class="delete-confirm-action delete-confirm-delete" data-action="delete" data-session-id="' + sessionId + '">Delete</button>' +
      '<button class="delete-confirm-action delete-confirm-clear" data-action="delete-history" data-session-id="' + sessionId + '">Delete + Clear History</button>';
    const item = anchorEl.closest('.demo-history-item');
    if (item) {
      item.style.position = 'relative';
      item.appendChild(popover);
    }
  }

  _dismissDeleteConfirm() {
    document.querySelectorAll('.delete-confirm-popover').forEach(el => el.remove());
  }

  /** Human-readable relative time string. */
  formatTimeAgo(date) {
    return formatTimeAgo(date);
  }

}

/** Human-readable relative time string. */
export function formatTimeAgo(date) {
  const now = new Date();
  const diff = now - new Date(date);
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return minutes + 'm ago';
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours + 'h ago';
  return Math.floor(hours / 24) + 'd ago';
}
