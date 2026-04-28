/**
 * AttachmentDock — shows file chips above the chat input for attached documents.
 *
 * Each chip displays: file type icon, filename, size, and a remove button.
 * Chips persist until the user sends a message or clicks remove.
 */

const FILE_ICONS = {
  '.txt': '📄', '.md': '📄', '.csv': '📊', '.json': '📋',
  '.pdf': '📕', '.doc': '📘', '.docx': '📘', '.xls': '📗', '.xlsx': '📗',
  '.png': '🖼️', '.jpg': '🖼️', '.jpeg': '🖼️', '.gif': '🖼️', '.webp': '🖼️',
};

export class AttachmentDock {
  /**
   * @param {import('../bridge/WebViewBridge.js').WebViewBridge} bridge
   */
  constructor(bridge) {
    this._bridge = bridge;
    this._files = [];
    this._el = null;
    this._createDock();
  }

  /**
   * Add a file chip to the dock.
   * @param {{name: string, size: number, tokens?: number}} file
   */
  add(file) {
    this._files.push(file);
    this._render();
  }

  /** Clear all attachments (called after send). */
  clear() {
    this._files = [];
    this._render();
  }

  /** Remove a specific file by index. */
  remove(index) {
    this._files.splice(index, 1);
    this._bridge.postMessage('remove_file_context', JSON.stringify({ index }));
    this._render();
  }

  /** @returns {number} Number of attached files */
  get count() { return this._files.length; }

  _createDock() {
    this._el = document.createElement('div');
    this._el.className = 'attachment-dock';
    this._el.style.display = 'none';

    const inputRow = document.querySelector('.demo-chat-input-row')
      || document.querySelector('.chat-composer-stack');
    if (inputRow) {
      inputRow.parentElement.insertBefore(this._el, inputRow);
    }
  }

  _render() {
    if (!this._el) return;

    if (this._files.length === 0) {
      this._el.style.display = 'none';
      this._el.innerHTML = '';
      return;
    }

    this._el.style.display = 'flex';
    this._el.innerHTML = this._files.map((f, i) => {
      const ext = (f.name.match(/\.[^.]+$/) || ['.txt'])[0].toLowerCase();
      const icon = FILE_ICONS[ext] || '📎';
      const sizeLabel = f.size > 1024
        ? `${(f.size / 1024).toFixed(1)} KB`
        : `${f.size} B`;
      const tokenLabel = f.tokens ? ` · ~${f.tokens.toLocaleString()} tokens` : '';
      return `<div class="attachment-chip" data-index="${i}">
        <span class="attachment-chip-icon">${icon}</span>
        <span class="attachment-chip-name">${this._esc(f.name)}</span>
        <span class="attachment-chip-meta">${sizeLabel}${tokenLabel}</span>
        <button class="attachment-chip-remove" data-index="${i}" title="Remove">\u2715</button>
      </div>`;
    }).join('');

    this._el.querySelectorAll('.attachment-chip-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.remove(parseInt(btn.dataset.index));
      });
    });
  }

  _esc(text) {
    const d = document.createElement('div');
    d.textContent = text || '';
    return d.innerHTML;
  }
}
