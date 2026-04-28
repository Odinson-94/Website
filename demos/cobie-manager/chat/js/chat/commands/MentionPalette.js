// ═══════════════════════════════════════════════════════════════════════
// MentionPalette.js
// STATUS: UNLOCKED
// ═══════════════════════════════════════════════════════════════════════
//
// DESIGN:  Floating mention picker triggered by "@" in the chat input.
//          Requests mentionable items (sheets, views, legends, schedules)
//          from C# via the bridge, scores queries with substring matching,
//          groups results by category, and pastes the selected mention
//          into the input.
//
// ─────────────────────────────────────────────────────────────────────
// CALLS:    EventBus (mention-trigger, mention-dismiss), WebViewBridge
// CALLED BY: ChatApp.js (instantiates + wires EventBus)
//            ChatInput.js (emits mention-trigger / mention-dismiss)
// ═══════════════════════════════════════════════════════════════════════

export class MentionPalette {

  /**
   * @param {import('../../shared/EventBus.js').EventBus} eventBus
   * @param {import('../bridge/WebViewBridge.js').WebViewBridge} bridge
   */
  constructor(eventBus, bridge) {
    this._bus = eventBus;
    this._bridge = bridge;
    this._items = [];
    this._revitItems = [];
    this._workspaceItems = [];
    this._el = null;
    this._visible = false;
    this._selectedIndex = -1;
    this._onInsert = null;
    this._pendingQuery = null;
    this._requestedOnce = false;

    this._bus.on('mention-trigger', (data) => this._onTrigger(data));
    this._bus.on('mention-dismiss', () => this.hide());

    this._bridge.on('mentionables', (_rest, data) => this._onMentionables(data));

    this._requestMentionables();
  }

  // ── Data loading ───────────────────────────────────────────────────

  _requestMentionables() {
    this._bridge.postMessage('get_mentionables', '');
    console.error('[MentionPalette] MENTION-INIT: requested mentionables from C#');
  }

  _onMentionables(data) {
    try {
      const raw = data.message || data.payload || data;
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      const revitItems = Array.isArray(parsed) ? parsed : (parsed.items || []);
      this._revitItems = revitItems;
      this._items = [...revitItems, ...this._workspaceItems];
      console.error('[MentionPalette] MENTION-INIT-OK: received ' + revitItems.length + ' mentionables + ' + this._workspaceItems.length + ' workspace files');
    } catch (e) {
      console.error('[MentionPalette] MENTION-INIT: failed to parse mentionables: ' + e.message);
      this._revitItems = [];
      this._items = [...this._workspaceItems];
    }

    if (this._pendingQuery !== null) {
      this._show(this._pendingQuery);
      this._pendingQuery = null;
    }
  }

  setWorkspaceFiles(files) {
    this._workspaceItems = (files || []).map(f => ({
      type: 'File',
      name: f.name || f,
      id: f.path || f.name || f,
      path: f.path || ''
    }));
    this._items = [...(this._revitItems || []), ...this._workspaceItems];
  }

  // ── Lifecycle ──────────────────────────────────────────────────────

  /**
   * @param {HTMLElement} anchorEl  Element to anchor the palette above
   * @param {Function}    onInsert  Called with mention string when user picks an item
   */
  bind(anchorEl, onInsert) {
    if (!anchorEl) {
      console.error('[MentionPalette] MENTION-BIND: bind() called with null anchorEl');
      return;
    }
    this._anchorEl = anchorEl;
    this._onInsert = onInsert;

    this._el = document.createElement('div');
    this._el.className = 'mention-palette';
    this._el.style.display = 'none';
    this._el.addEventListener('mousedown', (e) => e.preventDefault());
    this._el.addEventListener('click', (e) => this._onClick(e));

    anchorEl.insertBefore(this._el, anchorEl.firstChild);

    document.addEventListener('click', (e) => {
      if (this._visible && !this._el.contains(e.target) && !this._anchorEl.contains(e.target)) {
        this.hide();
      }
    });
  }

  // ── Show / Hide ────────────────────────────────────────────────────

  _onTrigger(data) {
    const query = (data?.query || '').trim();
    this._show(query);
  }

  _show(query) {
    if (!this._el) {
      console.error('[MentionPalette] MENTION-SHOW: _el is null — bind() never called');
      return;
    }

    if (this._items.length === 0) {
      if (!this._requestedOnce) {
        this._pendingQuery = query;
        this._requestedOnce = true;
        this._requestMentionables();
      } else {
        this._showEmpty();
      }
      return;
    }

    const scored = this._scoreAll(query);
    const grouped = this._groupByType(scored);

    let html = '<div class="mention-palette-results">';
    html += '<div class="mention-palette-header">Mention a view</div>';

    if (grouped.length === 0) {
      html += '<div class="mention-palette-empty">No matching items</div>';
    } else {
      for (const group of grouped) {
        html += `<div class="mention-palette-group">`;
        html += `<div class="mention-palette-group-label">${this._esc(group.type)}</div>`;
        for (const item of group.items) {
          const displayName = this._truncate(item.name, 25);
          // `extra` carries the inline-mention annotation — only used by
          // the QA Error type today, but a free-form string any future
          // mention source can populate. Falls back to empty when absent.
          const extra = item.extra ? this._esc(item.extra) : '';
          html += `<div class="mention-palette-item" data-id="${this._esc(item.id)}" data-type="${this._esc(item.type)}" data-name="${this._esc(item.name)}" data-extra="${extra}">`;
          html += `<span class="mention-palette-item-icon">${this._typeIcon(item.type)}</span>`;
          html += `<span class="mention-palette-item-name">${this._esc(displayName)}</span>`;
          html += `<span class="mention-palette-item-type">(${this._esc(item.type)})</span>`;
          html += `</div>`;
        }
        html += `</div>`;
      }
    }

    html += '</div>';
    this._el.innerHTML = html;
    this._el.style.display = '';
    this._visible = true;
    this._selectedIndex = -1;
  }

  _showEmpty() {
    if (!this._el) return;
    this._el.innerHTML = '<div class="mention-palette-results">' +
      '<div class="mention-palette-header">Mention a view</div>' +
      '<div class="mention-palette-empty">No views loaded. Open a Revit document or connect a workspace.</div>' +
      '</div>';
    this._el.style.display = '';
    this._visible = true;
  }

  hide() {
    if (!this._el) return;
    this._el.style.display = 'none';
    this._visible = false;
    this._selectedIndex = -1;
  }

  get isVisible() { return this._visible; }

  // ── Click handling ─────────────────────────────────────────────────

  _onClick(e) {
    const item = e.target.closest('.mention-palette-item');
    if (!item) return;
    const type = item.dataset.type;
    const name = item.dataset.name;
    const id = item.dataset.id;
    this.hide();
    if (!this._onInsert) return;

    // For QA findings we insert `@ERR-001 (Duct/Level 03, error — 12mm
    // clearance, 50mm required)` so the AI has the full context inline
    // without having to call get_error_context_by_id. The extra metadata
    // is piped in via GetMentionablesJson — any missing fields degrade
    // gracefully to the same `@Type: Name` shape as the other types.
    if (type === 'Error') {
      const extra = item.dataset.extra;
      if (extra) {
        this._onInsert(`@${id} (${extra})`);
      } else if (id) {
        this._onInsert(`@${id}`);
      } else {
        this._onInsert(`@${name}`);
      }
      return;
    }

    this._onInsert(`@${type}: ${name}`);
  }

  // ── Arrow key navigation ───────────────────────────────────────────

  navigateUp() {
    if (!this._visible) return false;
    const items = this._el.querySelectorAll('.mention-palette-item');
    if (items.length === 0) return false;
    this._selectedIndex = Math.max(0, this._selectedIndex - 1);
    this._highlightItem(items);
    return true;
  }

  navigateDown() {
    if (!this._visible) return false;
    const items = this._el.querySelectorAll('.mention-palette-item');
    if (items.length === 0) return false;
    this._selectedIndex = Math.min(items.length - 1, this._selectedIndex + 1);
    this._highlightItem(items);
    return true;
  }

  confirmSelection() {
    if (!this._visible) return false;
    const items = this._el.querySelectorAll('.mention-palette-item');
    if (this._selectedIndex < 0 || this._selectedIndex >= items.length) return false;
    items[this._selectedIndex].click();
    return true;
  }

  _highlightItem(items) {
    items.forEach((el, i) => {
      el.classList.toggle('mention-palette-item-active', i === this._selectedIndex);
    });
    if (this._selectedIndex >= 0 && items[this._selectedIndex]) {
      items[this._selectedIndex].scrollIntoView({ block: 'nearest' });
    }
  }

  // ── Scoring ────────────────────────────────────────────────────────

  _scoreAll(query) {
    if (!query) {
      return this._items.map(s => ({ ...s, _score: 0 }));
    }

    const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 0);
    return this._items.map(item => {
      let score = 0;
      const nameLow = (item.name || '').toLowerCase();
      const typeLow = (item.type || '').toLowerCase();

      for (const w of words) {
        if (nameLow === query.toLowerCase()) { score += 100; continue; }
        if (nameLow.startsWith(w)) score += 80;
        else if (nameLow.includes(w)) score += 60;
        if (typeLow.startsWith(w)) score += 40;
        else if (typeLow.includes(w)) score += 20;
      }

      return { ...item, _score: score };
    }).sort((a, b) => b._score - a._score);
  }

  // ── Grouping ───────────────────────────────────────────────────────

  _groupByType(scored) {
    const hasQuery = scored.some(s => s._score > 0);
    const filtered = hasQuery ? scored.filter(s => s._score > 0) : scored.slice(0, 50);

    const map = new Map();
    for (const s of filtered) {
      const type = s.type || 'Other';
      if (!map.has(type)) map.set(type, []);
      map.get(type).push(s);
    }

    // Errors float to the top — when a QA Manager window is open the user
    // almost always wants to tag the finding they just clicked, then fall
    // back to sheets/views as secondary references.
    const typeOrder = ['Error', 'Sheet', 'FloorPlan', 'CeilingPlan', 'Section', 'Elevation', 'ThreeD', 'Legend', 'Schedule'];
    const groups = [];
    for (const [type, items] of map) {
      const topScore = Math.max(...items.map(i => i._score));
      const order = typeOrder.indexOf(type);
      groups.push({ type, items: items.slice(0, 20), _topScore: topScore, _order: order >= 0 ? order : 99 });
    }

    return groups.sort((a, b) => {
      if (a._topScore !== b._topScore) return b._topScore - a._topScore;
      return a._order - b._order;
    });
  }

  // ── Helpers ────────────────────────────────────────────────────────

  _typeIcon(type) {
    switch (type) {
      case 'Sheet': return '\u{1F4C4}';
      case 'FloorPlan': return '\u{1F5FA}';
      case 'CeilingPlan': return '\u{2B06}';
      case 'Section': return '\u{2702}';
      case 'Elevation': return '\u{1F3D7}';
      case 'ThreeD': return '\u{1F4E6}';
      case 'Legend': return '\u{1F4CB}';
      case 'Schedule': return '\u{1F4CA}';
      case 'File': return '\u{1F4CE}';
      // QA Manager findings. Warning sign for 'error' / 'warning' / 'info';
      // the palette renders the same icon for any QA severity so the list
      // reads cleanly. Severity is still reflected in the item label
      // (e.g. "ERR-001 [error]"), picked up by _scoreAll via item.name.
      case 'Error': return '\u{26A0}\uFE0F';
      default: return '\u{1F4C1}';
    }
  }

  _truncate(str, max) {
    if (!str || str.length <= max) return str;
    return str.substring(0, max - 1) + '\u2026';
  }

  _esc(str) {
    if (!str) return '';
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }
}
