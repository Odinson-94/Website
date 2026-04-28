/**
 * ActiveAgentSidebar — sidebar “active work” state for #chatHistoryIndex6 rows.
 *
 * When the current session is generating, sending, or has a live sub-agent /
 * agentic branch, the selected row gets `session-row-busy` + buffering ring
 * (styles in chat-sidebar.css → “Active agent / busy session row”).
 *
 * Selection alone stays a calm highlight; shimmer applies only while busy.
 */

/**
 * @param {import('../state/ChatState.js').ChatState} state
 * @param {string} sessionId
 * @param {object} [session] ChatSessionsStore record for this id (optional)
 * @returns {boolean}
 */
export function isSessionHistoryRowBusy(state, sessionId, session) {
  if (!sessionId || sessionId !== state.currentSessionId) return false;

  if (state.isGenerating) return true;
  if (state.isSending) return true;

  if (typeof state.getAgentsByParent === 'function') {
    const agents = state.getAgentsByParent(sessionId);
    if (agents.some(a => a.status === 'running')) return true;
  }

  if (session?.isAgent && session.agentStatus) {
    const t = session.agentStatus;
    if (t !== 'completed' && t !== 'failed' && t !== 'cancelled') return true;
  }

  if (session?.isCSharpBranch && session.agenticStatus === 'active') return true;

  return false;
}

/**
 * Toggle `session-row-busy` on each `.demo-history-item` under #chatHistoryIndex6.
 * @param {import('../state/ChatState.js').ChatState} state
 */
export function syncSessionHistoryBusy(state) {
  const container = document.getElementById('chatHistoryIndex6');
  if (!container) return;

  const sm = state.chatSessionsStore;
  const sessions = sm ? sm.getAll() : (state.sessions ?? {});

  container.querySelectorAll('.demo-history-item').forEach(item => {
    const id = item.getAttribute('data-session-id');
    if (!id) return;
    const session = sessions[id];
    const busy = isSessionHistoryRowBusy(state, id, session);
    item.classList.toggle('session-row-busy', busy);
  });
}

/**
 * Re-sync when generation / agents / send guard changes without a full list render.
 * @param {import('../state/ChatState.js').ChatState} state
 * @param {import('../../shared/EventBus.js').EventBus} eventBus
 */
export function subscribeSessionHistoryBusy(state, eventBus) {
  const run = () => syncSessionHistoryBusy(state);
  eventBus.on('state:generating', run);
  eventBus.on('state:agent:spawned', run);
  eventBus.on('state:agent:updated', run);
  eventBus.on('state:sending', run);
}
