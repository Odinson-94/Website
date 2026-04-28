/**
 * ChatHistoryOrder.js — **only** place that defines how chat sessions are ordered.
 *
 * Use this file when changing sidebar history order, “next session” after delete,
 * or search-result ordering. Do not add ad-hoc `.sort((a,b) => …)` elsewhere.
 *
 * Consumers:
 *   - SidebarChatHistoryTree — root trees (H1), child branches (H2+), orphans
 *   - ChatSessionsStore — pick next session after delete / migration repair
 *   - AgentPanel — flat filtered list while searching
 *
 * Policy:
 *   - Roots: sort by latest activity in the whole subtree (branch work bumps parent).
 *   - Siblings: sort by this session’s last activity (lastMessageAt → lastUpdated → created).
 *   - Flat lists: compareSessionsByLastActivity.
 *   - DOM: SidebarChatHistoryTree still walks parent-first; this module only supplies comparators.
 */

/** @param {object} session */
export function sessionActivityTime(session) {
  if (!session) return 0;
  const t = session.lastMessageAt || session.lastUpdated || session.created;
  return t ? new Date(t).getTime() : 0;
}

/**
 * Max timestamp for this session or any descendant (nested branches).
 * @param {object} session
 * @param {Record<string, object>} allSessionsById
 */
export function effectiveSubtreeActivity(session, allSessionsById) {
  let max = sessionActivityTime(session);
  for (const s of Object.values(allSessionsById)) {
    if (s.parentSessionId === session.id) {
      max = Math.max(max, effectiveSubtreeActivity(s, allSessionsById));
    }
  }
  return max;
}

/** Descending: most recently active root trees first. */
export function compareRootSessionsForSidebar(a, b, allSessions) {
  return effectiveSubtreeActivity(b, allSessions) - effectiveSubtreeActivity(a, allSessions);
}

/** Descending among siblings under the same parent. */
export function compareChildSessionsForSidebar(a, b) {
  return sessionActivityTime(b) - sessionActivityTime(a);
}

/** Descending for a flat list (e.g. pick next session after delete). */
export function compareSessionsByLastActivity(a, b) {
  return sessionActivityTime(b) - sessionActivityTime(a);
}

/**
 * Single namespace for “where is chat order?” — use named imports in hot paths,
 * or `ChatHistoryOrder.compareSessionsByLastActivity` when readability beats tree-shaking.
 */
export const ChatHistoryOrder = Object.freeze({
  sessionActivityTime,
  effectiveSubtreeActivity,
  compareRootSessionsForSidebar,
  compareChildSessionsForSidebar,
  compareSessionsByLastActivity,
});
