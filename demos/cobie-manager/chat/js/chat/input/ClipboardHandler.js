/**
 * ClipboardHandler — all clipboard operations for the chat input.
 *
 * Single source of truth for:
 *   - Plain text paste (strip formatting)
 *   - Long text paste (>1000 words → file upload as .txt)
 *   - Image paste (base64 → bridge)
 *   - HTML table paste (→ markdown conversion)
 *   - Programmatic paste from right-click menu (reads clipboard API)
 */

const LONG_TEXT_WORD_THRESHOLD = 1000;

export class ClipboardHandler {
  /**
   * @param {import('../bridge/WebViewBridge.js').WebViewBridge} bridge
   * @param {HTMLElement} inputEl  The contenteditable input element
   */
  constructor(bridge, inputEl) {
    this._bridge = bridge;
    this._el = inputEl;
  }

  /**
   * Attach to the native paste event on the input element.
   * Called once during ChatInput init.
   */
  attachPasteListener() {
    if (!this._el) return;
    this._el.addEventListener('paste', (e) => this._onPaste(e));
  }

  /**
   * Programmatic paste — read from clipboard API and process.
   * Used by right-click Paste menu item.
   * @returns {Promise<{action: string, wordCount?: number, error?: string}>}
   */
  async pasteFromClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) return { action: 'empty' };

      if (!this._el) return { action: 'error', error: 'no input element' };

      const result = this._processText(text);

      if (result.action === 'file_upload') {
        this._sendAsFile(text);
      } else {
        this._el.focus();
        document.execCommand('insertText', false, text);
      }

      return result;
    } catch (err) {
      console.warn('[ClipboardHandler] Clipboard read failed:', err);
      return { action: 'error', error: err.message };
    }
  }

  /**
   * Handle the native paste event (Ctrl+V).
   * @param {ClipboardEvent} e
   */
  _onPaste(e) {
    const items = e.clipboardData?.items;
    if (!items) return;

    if (this._handleImagePaste(e, items)) return;

    const plain = e.clipboardData.getData('text/plain') || '';

    if (this._handleLongTextPaste(e, plain)) return;

    if (this._handleTablePaste(e)) return;

    e.preventDefault();
    if (plain) {
      document.execCommand('insertText', false, plain);
    }
  }

  /**
   * Check if text exceeds word threshold.
   * @param {string} text
   * @returns {{action: 'file_upload'|'insert', wordCount: number}}
   */
  _processText(text) {
    const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
    return {
      action: wordCount > LONG_TEXT_WORD_THRESHOLD ? 'file_upload' : 'insert',
      wordCount
    };
  }

  /**
   * @returns {boolean} true if handled
   */
  _handleImagePaste(e, items) {
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const blob = item.getAsFile();
        if (!blob) continue;

        const reader = new FileReader();
        reader.onload = () => {
          const base64 = reader.result.split(',')[1];
          this._bridge.postMessage('image_paste', JSON.stringify({
            base64,
            mimeType: item.type,
            size: blob.size
          }));
          this._showImagePreview(reader.result);
        };
        reader.readAsDataURL(blob);
        return true;
      }
    }
    return false;
  }

  /**
   * @returns {boolean} true if handled (>1000 words → file upload)
   */
  _handleLongTextPaste(e, plain) {
    if (!plain || plain.trim().length === 0) return false;

    const { action, wordCount } = this._processText(plain);

    if (action === 'file_upload') {
      e.preventDefault();
      this._sendAsFile(plain);
      return true;
    }
    return false;
  }

  /**
   * @returns {boolean} true if handled (HTML table → markdown)
   */
  _handleTablePaste(e) {
    const html = e.clipboardData.getData('text/html');
    if (html && html.includes('<table')) {
      e.preventDefault();
      const markdown = this._htmlTableToMarkdown(html);
      document.execCommand('insertText', false, markdown);
      return true;
    }
    return false;
  }

  /**
   * Encode text as base64 and send as file_upload to bridge.
   */
  _sendAsFile(text) {
    const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
    const bytes = new TextEncoder().encode(text);
    let binary = '';
    bytes.forEach(b => { binary += String.fromCharCode(b); });
    const fileBase64 = btoa(binary);
    this._bridge.postMessage('file_upload', JSON.stringify({
      name: 'Pasted text.txt',
      size: bytes.length,
      type: 'text/plain',
      fileBase64
    }));
  }

  _showImagePreview(dataUrl) {
    const existing = document.querySelector('.paste-image-preview');
    if (existing) existing.remove();

    const preview = document.createElement('div');
    preview.className = 'paste-image-preview';
    preview.innerHTML =
      `<img src="${dataUrl}" style="max-height:60px;border-radius:4px;" />` +
      `<button class="paste-remove">\u2715</button>`;

    preview.querySelector('.paste-remove').addEventListener('click', () => {
      preview.remove();
      this._bridge.postMessage('image_paste_cancel', '');
    });

    const inputWrapper = this._el.closest('.chat-input-wrapper')
      || this._el.closest('.demo-chat-input-row');
    if (inputWrapper) inputWrapper.insertBefore(preview, inputWrapper.firstChild);
  }

  _htmlTableToMarkdown(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const table = doc.querySelector('table');
    if (!table) return html;

    const rows = Array.from(table.rows);
    if (rows.length === 0) return '';

    let md = '';
    rows.forEach((row, i) => {
      const cells = Array.from(row.cells).map(c => c.textContent.trim());
      md += '| ' + cells.join(' | ') + ' |\n';
      if (i === 0) md += '| ' + cells.map(() => '---').join(' | ') + ' |\n';
    });
    return md;
  }
}
