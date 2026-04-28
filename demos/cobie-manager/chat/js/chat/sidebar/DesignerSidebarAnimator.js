/**
 * Entrance animation for a new row in the sidebar chat history tree (#chatHistoryIndex6).
 */
export function animateSidebarHistoryRow(element) {
  if (!element) return;
  element.classList.add('session-list-item-enter');
  requestAnimationFrame(() => {
    element.classList.add('session-list-item-enter-active');
  });
}
