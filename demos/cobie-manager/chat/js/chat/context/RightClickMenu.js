/**
 * RightClickMenu — context menus for chat messages and the input field.
 *
 * Contextual actions per target:
 *   • User message:  Copy, Edit, Branch
 *   • Bot message:   Copy, Regenerate, Quote in input, Expand/collapse thinking
 *   • Input field:   Paste, Clear, Insert saved prompt (submenu), Recent prompts (submenu)
 */
export class RightClickMenu {
  constructor(state, bridge) {
    this._state = state;
    this._bridge = bridge;
    this._menuEl = null;
    this._chatApp = null;
    this._targetEl = null;
    this._targetType = null; // 'user-message', 'bot-message', 'input'
    this._pendingSpellSuggestions = null;
    this._lastMenuPos = null;

    bridge.on('spell_suggestions', (_rest, data) => {
      try {
        const spell = typeof data.message === 'string' ? JSON.parse(data.message) : data.message;
        this._pendingSpellSuggestions = spell;

        // If the input menu is already showing, rebuild it with the spell suggestions
        if (this._targetType === 'input' && this._menuEl?.classList.contains('visible') && this._lastMenuPos) {
          this._showInputMenu(this._lastMenuPos.x, this._lastMenuPos.y);
        }
      } catch { this._pendingSpellSuggestions = null; }
    });
  }

  /**
   * Check if there is a non-collapsed text selection inside the given element.
   * @param {HTMLElement} el
   * @returns {{hasSelection: boolean, selectedText: string}}
   */
  static _getTextSelection(el) {
    const sel = document.getSelection();
    if (!sel || sel.isCollapsed) return { hasSelection: false, selectedText: '' };
    try {
      if (el.contains(sel.anchorNode) && el.contains(sel.focusNode)) {
        return { hasSelection: true, selectedText: sel.toString() };
      }
    } catch { /* cross-origin or detached node */ }
    return { hasSelection: false, selectedText: '' };
  }

  /**
   * @param {object} chatApp — the ChatApp instance (provides chatInput, promptLibrary, etc.)
   */
  init(chatApp) {
    this._chatApp = chatApp;
    this._createMenuElement();
    this._attachListeners();
  }

  // ═══════════════════════════════════════════════════════════════
  // DOM creation
  // ═══════════════════════════════════════════════════════════════

  _createMenuElement() {
    this._menuEl = document.createElement('div');
    this._menuEl.className = 'chat-context-menu';
    document.body.appendChild(this._menuEl);
  }

  // ═══════════════════════════════════════════════════════════════
  // Event listeners
  // ═══════════════════════════════════════════════════════════════

  _attachListeners() {
    const chatMessages = document.getElementById('chatMessagesIndex6');
    const chatInput = document.getElementById('chatInputIndex6');

    if (chatMessages) {
      chatMessages.addEventListener('contextmenu', (e) => {
        const userMsg = e.target.closest('.demo-msg-user');
        const botMsg = e.target.closest('.demo-msg-bot') || e.target.closest('.assistant-text-block');

        if (userMsg) {
          e.preventDefault();
          this._targetEl = userMsg;
          this._targetType = 'user-message';
          this._showUserMessageMenu(e.clientX, e.clientY);
        } else if (botMsg) {
          e.preventDefault();
          this._targetEl = botMsg;
          this._targetType = 'bot-message';
          this._showBotMessageMenu(e.clientX, e.clientY);
        }
      });
    }

    // Input field: native browser context menu handles spell check + paste.
    // No custom menu override — native gives us everything for free.

    document.addEventListener('click', (e) => {
      if (this._menuEl && !this._menuEl.contains(e.target)) {
        this.hide();
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.hide();
    });

    document.addEventListener('scroll', () => this.hide(), true);
  }

  // ═══════════════════════════════════════════════════════════════
  // Show / hide
  // ═══════════════════════════════════════════════════════════════

  /**
   * Render menu items at (x, y) viewport coordinates.
   * @param {number} x
   * @param {number} y
   * @param {Array<{label?:string, icon?:string, shortcut?:string, action?:Function, divider?:boolean, submenu?:Array}>} items
   */
  show(x, y, items) {
    this._menuEl.innerHTML = '';

    for (const item of items) {
      if (item.divider) {
        const div = document.createElement('div');
        div.className = 'chat-context-menu-divider';
        this._menuEl.appendChild(div);
        continue;
      }

      const el = document.createElement('div');
      el.className = 'chat-context-menu-item';

      if (item.icon) {
        const iconSpan = document.createElement('span');
        iconSpan.className = 'chat-context-menu-icon';
        iconSpan.textContent = item.icon;
        el.appendChild(iconSpan);
      }

      const labelSpan = document.createElement('span');
      labelSpan.className = 'chat-context-menu-label';
      labelSpan.textContent = item.label;
      el.appendChild(labelSpan);

      if (item.shortcut) {
        const shortcutSpan = document.createElement('span');
        shortcutSpan.className = 'chat-context-menu-shortcut';
        shortcutSpan.textContent = item.shortcut;
        el.appendChild(shortcutSpan);
      }

      if (item.submenu) {
        const arrow = document.createElement('span');
        arrow.className = 'chat-context-menu-arrow';
        arrow.textContent = '▸';
        el.appendChild(arrow);
        el.classList.add('has-submenu');

        const sub = document.createElement('div');
        sub.className = 'chat-context-menu-submenu';

        if (item.submenu.length === 0) {
          const empty = document.createElement('div');
          empty.className = 'chat-context-menu-item disabled';
          empty.textContent = 'None';
          sub.appendChild(empty);
        } else {
          for (const subItem of item.submenu) {
            const subEl = document.createElement('div');
            subEl.className = 'chat-context-menu-item';
            subEl.textContent = subItem.label;
            subEl.addEventListener('click', (e) => {
              e.stopPropagation();
              subItem.action();
              this.hide();
            });
            sub.appendChild(subEl);
          }
        }

        el.appendChild(sub);
      } else if (item.action) {
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          item.action();
          this.hide();
        });
      }

      this._menuEl.appendChild(el);
    }

    this._menuEl.classList.add('visible');

    requestAnimationFrame(() => {
      const rect = this._menuEl.getBoundingClientRect();
      let posX = x;
      let posY = y;

      if (x + rect.width > window.innerWidth) {
        posX = window.innerWidth - rect.width - 4;
      }
      if (y + rect.height > window.innerHeight) {
        posY = window.innerHeight - rect.height - 4;
      }
      if (posX < 0) posX = 4;
      if (posY < 0) posY = 4;

      this._menuEl.style.left = posX + 'px';
      this._menuEl.style.top = posY + 'px';
    });
  }

  hide() {
    if (this._menuEl) {
      this._menuEl.classList.remove('visible');
    }
    this._targetEl = null;
    this._targetType = null;
  }

  // ═══════════════════════════════════════════════════════════════
  // Menu builders — one per target type
  // ═══════════════════════════════════════════════════════════════

  _showUserMessageMenu(x, y) {
    const text = this._targetEl.textContent.trim();
    this.show(x, y, [
      {
        icon: '📋', label: 'Copy message', shortcut: 'Ctrl+C',
        action: () => navigator.clipboard.writeText(text),
      },
      { divider: true },
      {
        icon: '✏️', label: 'Edit message',
        action: () => this._editMessage(text),
      },
      {
        icon: '⑂', label: 'Branch from here',
        action: () => this._branchFromMessage(),
      },
      { divider: true },
      {
        icon: '🔍', label: 'Inspect Element', shortcut: 'F12',
        action: () => {
          // Request C# to open DevTools via bridge message
          if (window.chrome?.webview) {
            window.chrome.webview.postMessage(JSON.stringify({ type: 'open_devtools', payload: '' }));
          }
        },
      },
    ]);
  }

  _showBotMessageMenu(x, y) {
    const text = this._targetEl.textContent.trim();

    // Look for a thinking container immediately before this bot message
    const prev = this._targetEl.previousElementSibling;
    const thinkingContainer =
      prev && prev.classList && prev.classList.contains('thinking-container')
        ? prev
        : this._targetEl.querySelector('.thinking-container');

    const items = [
      {
        icon: '📋', label: 'Copy message', shortcut: 'Ctrl+C',
        action: () => navigator.clipboard.writeText(text),
      },
      { divider: true },
      {
        icon: '↻', label: 'Regenerate',
        action: () => this._regenerate(),
      },
      {
        icon: '❝', label: 'Quote in input',
        action: () => this._quoteInInput(text),
      },
    ];

    if (thinkingContainer) {
      const isExpanded = thinkingContainer.querySelector('.steps-list.fully-expanded');
      items.push({ divider: true });
      items.push({
        icon: isExpanded ? '▾' : '▸',
        label: isExpanded ? 'Collapse thinking' : 'Expand thinking',
        action: () => this._toggleThinking(thinkingContainer),
      });
    }

    items.push({ divider: true });
    items.push({
      icon: '🔍', label: 'Inspect Element', shortcut: 'F12',
      action: () => {
        if (window.chrome?.webview) {
          window.chrome.webview.postMessage(JSON.stringify({ type: 'open_devtools', payload: '' }));
        }
      },
    });

    this.show(x, y, items);
  }

  _showInputMenu(x, y) {
    this._lastMenuPos = { x, y };
    const promptLib = this._chatApp?.promptLibrary;
    const saved = promptLib ? promptLib.getSaved() : [];
    const recent = promptLib ? promptLib.getRecent() : [];
    const { hasSelection, selectedText } = RightClickMenu._getTextSelection(this._targetEl);

    const items = [];

    const spell = this._pendingSpellSuggestions;
    this._pendingSpellSuggestions = null;
    if (spell && spell.misspelledWord && spell.suggestions?.length > 0) {
      for (const suggestion of spell.suggestions.slice(0, 5)) {
        items.push({
          icon: '✓', label: suggestion,
          action: () => {
            document.execCommand('insertText', false, suggestion);
          },
        });
      }
      items.push({ divider: true });
    }

    if (hasSelection) {
      items.push({
        icon: '✂', label: 'Cut', shortcut: 'Ctrl+X',
        action: () => { navigator.clipboard.writeText(selectedText); document.execCommand('delete'); },
      });
      items.push({
        icon: '📋', label: 'Copy', shortcut: 'Ctrl+C',
        action: () => navigator.clipboard.writeText(selectedText),
      });
    }

    items.push({
      icon: '📋', label: 'Paste', shortcut: 'Ctrl+V',
      action: () => this._pasteFromClipboard(),
    });

    items.push({
      icon: '⎁', label: 'Select All', shortcut: 'Ctrl+A',
      action: () => {
        const range = document.createRange();
        range.selectNodeContents(this._targetEl);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
      },
    });

    items.push({
      icon: '✕', label: 'Clear input',
      action: () => this._clearInput(),
    });

    items.push({ divider: true });

    items.push({
      icon: '☆', label: 'Insert saved prompt',
      submenu: saved.map((p) => ({
        label: p.name || p.text.substring(0, 40),
        action: () => this._insertPrompt(p.text),
      })),
    });

    items.push({
      icon: '↺', label: 'Recent prompts',
      submenu: recent.slice(0, 10).map((p) => ({
        label: p.text.substring(0, 50) + (p.text.length > 50 ? '…' : ''),
        action: () => this._insertPrompt(p.text),
      })),
    });

    this.show(x, y, items);
  }

  // ═══════════════════════════════════════════════════════════════
  // Actions
  // ═══════════════════════════════════════════════════════════════

  // CHANGELOG: 2026-03-27 | BUG-1 fix | RightClickMenu edit_message now includes ordinal
  // index so C# handler can truncate history at the correct point before resending.
  _editMessage(text) {
    const chatInput = this._chatApp?.chatInput;
    if (!chatInput) return;

    const el = chatInput._el;
    if (!el) return;

    if (el.value !== undefined && el.tagName === 'INPUT') {
      el.value = text;
    } else {
      el.textContent = text;
    }
    el.focus();

    const msgEl = this._targetEl;
    const ordinal = msgEl ? parseInt(msgEl.getAttribute('data-user-ordinal') || '0', 10) : 0;
    this._bridge.postMessage('edit_message', JSON.stringify({ index: ordinal, text }));
  }

  _branchFromMessage() {
    const msgEl = this._targetEl;
    if (!msgEl) return;

    const chatMessages = document.getElementById('chatMessagesIndex6');
    if (!chatMessages) return;

    const allMessages = [...chatMessages.children];
    const index = allMessages.indexOf(msgEl);

    this._bridge.postMessage('branch_conversation', JSON.stringify({
      messageIndex: index,
    }));
  }

  _regenerate() {
    this._bridge.postMessage('regenerate', '');
  }

  _quoteInInput(text) {
    const chatInput = this._chatApp?.chatInput;
    if (!chatInput) return;

    const el = chatInput._el;
    if (!el) return;

    const quoted = text.split('\n').map(line => '> ' + line).join('\n') + '\n';

    if (el.value !== undefined && el.tagName === 'INPUT') {
      el.value = quoted;
    } else {
      el.textContent = quoted;
    }
    el.focus();
  }

  _toggleThinking(container) {
    if (!container) return;

    const stepsList = container.querySelector('.steps-list');
    if (!stepsList) return;

    if (stepsList.classList.contains('fully-expanded')) {
      stepsList.classList.remove('fully-expanded');
    } else {
      stepsList.classList.add('fully-expanded');
    }
  }

  async _pasteFromClipboard() {
    const chatInput = this._chatApp?.chatInput;
    if (!chatInput?.clipboard) {
      // Fallback: direct clipboard read if ClipboardHandler not available
      try {
        const text = await navigator.clipboard.readText();
        if (text) {
          const el = document.getElementById('chatInputIndex6');
          if (el) { el.focus(); document.execCommand('insertText', false, text); }
        }
      } catch (err) {
        console.warn('[RightClickMenu] Paste fallback failed:', err);
      }
      return;
    }
    try {
      const result = await chatInput.clipboard.pasteFromClipboard();
    } catch (err) {
    }
  }

  _clearInput() {
    const chatInput = this._chatApp?.chatInput;
    if (chatInput) chatInput.clear();
  }

  _insertPrompt(text) {
    const chatInput = this._chatApp?.chatInput;
    if (!chatInput) return;

    const el = chatInput._el;
    if (!el) return;

    if (el.value !== undefined && el.tagName === 'INPUT') {
      el.value = text;
    } else {
      el.textContent = text;
    }
    el.focus();
  }
}
