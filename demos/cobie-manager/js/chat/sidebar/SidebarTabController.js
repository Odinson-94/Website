/**
 * SidebarTabController — Tab switching (Designers / Files / QA) + sidebar resize.
 *
 * Extracted from index.html inline <script>: init() sidebar tab switching
 * (lines 369-391) and sidebar resize handler (lines 401-426).
 * Also references view6-chat.js initResizeHandler() (lines 2188-2226).
 *
 * Responsibilities:
 *   - Click handlers on .sidebar-tab[data-panel] buttons
 *   - Active-class toggling on tabs and .sidebar-panel[data-panel] elements
 *   - QA tab opens external qa-manager.html window (Ctrl+Q shortcut)
 *   - Sidebar drag-resize via .chat-sidebar-resize handle
 */
const MIN_SIDEBAR_WIDTH = 120;
const MAX_SIDEBAR_WIDTH = 400;

export class SidebarTabController {
  /** @param {import('../state/ChatState.js').ChatState} state */
  /** @param {import('../../shared/EventBus.js').EventBus} eventBus */
  constructor(state, eventBus) {
    this._state = state;
    this._eventBus = eventBus;
    this._activePanel = 'agents';

    this._tabs = document.querySelectorAll('.sidebar-tab[data-panel]');
    this._panels = document.querySelectorAll('.sidebar-panel[data-panel]');

    this._attachTabs();
    this._attachKeyboardShortcut();
    this._attachResize();
  }

  // ── Public API ──────────────────────────────────────────────

  /** Switch to a specific panel by id ('agents', 'files', 'qa'). */
  switchTo(panelId) {
    if (panelId === 'qa') {
      // QA Manager not yet wired — do nothing
      return;
    }

    this._tabs.forEach(t => t.classList.remove('active'));
    this._panels.forEach(p => p.classList.remove('active'));

    const tab = document.querySelector(`.sidebar-tab[data-panel="${panelId}"]`);
    const panel = document.querySelector(`.sidebar-panel[data-panel="${panelId}"]`);

    if (tab) tab.classList.add('active');
    if (panel) panel.classList.add('active');

    this._activePanel = panelId;
    this._eventBus.emit('sidebar-tab-changed', { panelId });
  }

  /** Return the currently active panel id. */
  getActiveTab() {
    return this._activePanel;
  }

  // ── Private ─────────────────────────────────────────────────

  _attachTabs() {
    this._tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        this.switchTo(tab.dataset.panel);
      });
    });
  }

  _attachKeyboardShortcut() {
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key === 'q') {
        e.preventDefault();
        // QA Manager not yet wired — do nothing
      }
    });
  }

  _attachResize() {
    const resizer = document.querySelector('.chat-sidebar-resize');
    const sidebar = document.querySelector('.demo-chat-history-sidebar');
    if (!resizer || !sidebar) return;

    let isResizing = false;
    let startX = 0;
    let startWidth = 0;

    resizer.addEventListener('mousedown', (e) => {
      isResizing = true;
      startX = e.clientX;
      startWidth = sidebar.offsetWidth;
      document.body.style.cursor = 'ew-resize';
      document.body.style.userSelect = 'none';
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!isResizing) return;
      const deltaX = e.clientX - startX;
      const newWidth = Math.max(MIN_SIDEBAR_WIDTH, Math.min(MAX_SIDEBAR_WIDTH, startWidth + deltaX));
      sidebar.style.width = newWidth + 'px';
      sidebar.style.flex = 'none';
    });

    document.addEventListener('mouseup', () => {
      if (isResizing) {
        isResizing = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    });
  }
}
