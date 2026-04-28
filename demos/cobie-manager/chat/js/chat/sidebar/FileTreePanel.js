import { escapeHtml } from '../messages/MessageParser.js';

/**
 * FileTreePanel — Project file tree in the sidebar.
 *
 * Extracted from index.html:
 *   - Static .sidebar-panel[data-panel="files"] markup (lines 211-238)
 *   - .tree-folder / .tree-file DOM structure
 *
 * No matching JS existed in view6-chat.js — the tree was purely static HTML.
 * This module adds dynamic rendering and interactive folder expand/collapse.
 *
 * DOM targets:
 *   .sidebar-panel[data-panel="files"] .demo-outputs-tree  — tree root
 *   .sidebar-panel[data-panel="files"] .footer-text        — file count
 *
 * Responsibilities:
 *   - Render a file tree from structured data
 *   - Toggle folder expand/collapse on click
 *   - Update the "N files" footer count
 */
export class FileTreePanel {
  /** @param {import('../state/ChatState.js').ChatState} state */
  /** @param {import('../bridge/WebViewBridge.js').WebViewBridge} bridge */
  constructor(state, bridge) {
    this._state = state;
    this._bridge = bridge;

    this._treeRoot = document.querySelector('.sidebar-panel[data-panel="files"] .demo-outputs-tree');
    this._footerText = document.querySelector('.sidebar-panel[data-panel="files"] .footer-text');

    this._attachDelegatedClick();
  }

  // ── Public API ──────────────────────────────────────────────

  /**
   * Render a file tree from structured data.
   * @param {Array<TreeNode>} data — array of { name, type:'folder'|'file', ext?, children? }
   */
  render(data) {
    if (!this._treeRoot) return;

    this._treeRoot.innerHTML = '';
    let fileCount = 0;

    const buildNode = (node) => {
      if (node.type === 'folder') {
        const folder = document.createElement('div');
        folder.className = 'tree-folder expanded';

        const header = document.createElement('div');
        header.className = 'tree-folder-header';
        header.innerHTML = `<span class="folder-icon">▼</span> ${escapeHtml(node.name)}`;
        folder.appendChild(header);

        const content = document.createElement('div');
        content.className = 'tree-folder-content';
        if (node.children) {
          node.children.forEach(child => content.appendChild(buildNode(child)));
        }
        folder.appendChild(content);
        return folder;
      }

      fileCount++;
      const file = document.createElement('div');
      file.className = 'tree-file';
      const ext = node.ext || node.name.split('.').pop().toLowerCase();
      file.innerHTML = `<span class="file-icon ${ext}"></span>${escapeHtml(node.name)}`;
      return file;
    };

    if (Array.isArray(data)) {
      data.forEach(node => this._treeRoot.appendChild(buildNode(node)));
    }

    if (this._footerText) {
      this._footerText.textContent = `${fileCount} file${fileCount !== 1 ? 's' : ''}`;
    }
  }

  /** Toggle a folder element between expanded and collapsed. */
  toggleFolder(el) {
    if (!el) return;
    const folder = el.closest('.tree-folder');
    if (!folder) return;

    const icon = folder.querySelector(':scope > .tree-folder-header .folder-icon');
    const isExpanded = folder.classList.contains('expanded');

    if (isExpanded) {
      folder.classList.remove('expanded');
      if (icon) icon.textContent = '▶';
    } else {
      folder.classList.add('expanded');
      if (icon) icon.textContent = '▼';
    }
  }

  // ── Private ─────────────────────────────────────────────────

  _attachDelegatedClick() {
    if (!this._treeRoot) return;

    this._treeRoot.addEventListener('click', (e) => {
      const header = e.target.closest('.tree-folder-header');
      if (header) {
        this.toggleFolder(header);
        return;
      }

      const fileEl = e.target.closest('.tree-file');
      if (fileEl) {
        const filename = fileEl.textContent.trim();
        this._bridge.postMessage('open_file', filename);
      }
    });
  }

}
