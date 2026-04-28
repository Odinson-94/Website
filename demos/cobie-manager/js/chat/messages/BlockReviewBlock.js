// ═══════════════════════════════════════════════════════════════════════
// BlockReviewBlock.js
// STATUS: UNLOCKED
// ═══════════════════════════════════════════════════════════════════════
//
// DESIGN:  Inline document/parameter/schedule block-diff review panel
//          for the BUILD X chat. Renders accept/reject/skip per block
//          with keyboard shortcuts, bulk actions, and auto-sends results
//          as a chat message so the AI receives the user's decisions.
//
//          Single file, zero dependencies, drop-in ready.
//          Dark mode inherits from html.dark-mode via CSS variables.
//
// ─────────────────────────────────────────────────────────────────────
// CALLS:    sendFn callback (auto-injects chat message with results)
// CALLED BY: ChatApp.js → window.buildX.showBlockReview(config)
//            MCPConfirmAnyTextAndParameterEditsWithUser (C# MCP tool)
//
// BLOCK FORMAT (from Python difflib or manual diff):
//   {
//     id:        "block-4",
//     label:     "Block 4",
//     type:      "paragraph" | "heading" | "table_row" | "list_item" | "parameter",
//     operation: "modified" | "added" | "removed" | "unchanged",
//     oldText:   "Previous text..." | null,
//     newText:   "New text..."      | null,
//     section:   "5.3.4"  (optional reference)
//   }
//
// RESULT FORMAT (sent back to AI via auto-injected chat message):
//   {
//     reviewId, title,
//     accepted: N, rejected: N, skipped: N,
//     results: [
//       { id, label, type, operation, status, oldText, newText, section }
//     ]
//   }
//
// API:
//   BlockReviewBlock.show(chatEl, config, sendFn) → instance
//   instance.destroy()
// ═══════════════════════════════════════════════════════════════════════

export class BlockReviewBlock {

  // ── Constructor ──────────────────────────────────────────────────────

  /**
   * @param {HTMLElement} chatEl  The #chatMessagesIndex6 container
   * @param {object}      config  { title, subtitle, blocks, reviewId }
   * @param {Function}    sendFn  Callback to auto-send results as a chat message
   */
  constructor(chatEl, config, sendFn) {
    this._chatEl = chatEl;
    this._config = config;
    this._sendFn = sendFn;
    this._blocks = config.blocks || [];
    this._statuses = {};      // id → 'accepted' | 'rejected' | 'skipped' | null
    this._changedIds = [];    // ordered list of block ids needing review
    this._focusIndex = 0;     // index into _changedIds for keyboard nav
    this._root = null;        // mounted DOM element

    for (const b of this._blocks) {
      if (b.operation !== 'unchanged') {
        this._statuses[b.id] = null;
        this._changedIds.push(b.id);
      }
    }
  }

  // ── Lifecycle ────────────────────────────────────────────────────────

  mount() {
    this._root = document.createElement('div');
    this._root.className = 'br-review-panel';
    this._root.setAttribute('data-review-id', this._config.reviewId || '');
    this._chatEl.appendChild(this._root);
    this._render();
    this._root.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }

  destroy() {
    // cleanup hook — no listeners to remove (button-only interaction)
  }

  // ── Counters ─────────────────────────────────────────────────────────

  _countByOp(op) { return this._blocks.filter(b => b.operation === op).length; }

  _countByStatus(s) {
    let n = 0;
    for (const id of this._changedIds) { if (this._statuses[id] === s) n++; }
    return n;
  }

  _totalReviewed() {
    let n = 0;
    for (const id of this._changedIds) { if (this._statuses[id] !== null) n++; }
    return n;
  }

  _allReviewed() { return this._totalReviewed() === this._changedIds.length; }

  // ── Rendering ────────────────────────────────────────────────────────

  _render() {
    const e = (s) => this._esc(s);
    const total = this._changedIds.length;
    const reviewed = this._totalReviewed();
    const accepted = this._countByStatus('accepted');
    let h = '';

    // ── Header
    h += '<div class="br-header">';
    h += `<div><div class="br-title">${e(this._config.title || 'Document review')}</div>`;
    h += `<div class="br-subtitle">${e(this._config.subtitle || '')} &middot; ${total} blocks changed</div></div>`;
    h += `<div class="br-progress">${reviewed} / ${total} reviewed${accepted > 0 ? ' (' + accepted + ' accepted)' : ''}</div>`;
    h += '</div>';

    // ── Stats pills
    const mods = this._countByOp('modified');
    const adds = this._countByOp('added');
    const dels = this._countByOp('removed');
    const unch = this._countByOp('unchanged');
    h += '<div class="br-stats">';
    if (mods) h += `<span class="br-pill br-pill-modified">${mods} modified</span>`;
    if (adds) h += `<span class="br-pill br-pill-added">${adds} added</span>`;
    if (dels) h += `<span class="br-pill br-pill-removed">${dels} removed</span>`;
    if (unch) h += `<span class="br-pill br-pill-unchanged">${unch} unchanged</span>`;
    h += '</div>';

    // ── Block cards + unchanged summaries
    let unchangedRun = 0;
    let unchangedStart = '';

    for (let i = 0; i < this._blocks.length; i++) {
      const b = this._blocks[i];

      if (b.operation === 'unchanged') {
        if (unchangedRun === 0) unchangedStart = b.section || b.label || `Block ${i + 1}`;
        unchangedRun++;
        if (i === this._blocks.length - 1 || this._blocks[i + 1].operation !== 'unchanged') {
          const end = b.section || b.label || `Block ${i + 1}`;
          const label = unchangedRun === 1
            ? `1 unchanged paragraph (${unchangedStart})`
            : `${unchangedRun} unchanged paragraphs (${unchangedStart} — ${end})`;
          h += `<div class="br-unchanged">${e(label)}</div>`;
          unchangedRun = 0;
        }
        continue;
      }

      const s = this._statuses[b.id];
      const resolved = s !== null;

      h += `<div class="br-card${resolved ? ' br-resolved' : ''}" id="br-card-${b.id}">`;

      // Card head — label + operation tag
      h += '<div class="br-card-head">';
      h += `<span class="br-card-label">${e(b.label || b.id)} &middot; ${e(b.type || 'paragraph')}</span>`;
      h += `<span class="br-tag br-tag-${b.operation}">${b.operation}</span>`;
      h += '</div>';

      // Card body — old/new text diff
      h += '<div class="br-card-body">';
      if (b.oldText) h += `<div class="br-line-old">${e(b.oldText)}</div>`;
      if (b.newText) h += `<div class="br-line-new">${e(b.newText)}</div>`;
      h += '</div>';

      // Card actions — buttons or resolved badge
      h += `<div class="br-card-actions">`;
      if (resolved) {
        const cls = s === 'accepted' ? 'br-badge-accepted' : s === 'rejected' ? 'br-badge-rejected' : 'br-badge-skipped';
        h += `<span class="br-badge ${cls}">${s.charAt(0).toUpperCase() + s.slice(1)}</span>`;
        h += `<span class="br-undo" data-br-id="${b.id}">Undo</span>`;
      } else {
        if (b.operation === 'removed') {
          h += `<button class="br-btn br-btn-accept" data-br-id="${b.id}" data-br-action="accepted">Accept removal</button>`;
          h += `<button class="br-btn br-btn-reject" data-br-id="${b.id}" data-br-action="rejected">Keep</button>`;
        } else {
          h += `<button class="br-btn br-btn-accept" data-br-id="${b.id}" data-br-action="accepted">Accept</button>`;
          h += `<button class="br-btn br-btn-reject" data-br-id="${b.id}" data-br-action="rejected">Reject</button>`;
        }
        h += `<button class="br-btn br-btn-skip" data-br-id="${b.id}" data-br-action="skipped">Skip</button>`;
      }
      h += '</div></div>';
    }

    // ── Bottom toolbar — bulk actions + apply
    h += '<div class="br-toolbar">';
    h += '<div class="br-toolbar-left">';
    h += '<button class="br-toolbar-btn br-btn-accept-all" data-br-bulk="accept-all">Accept all</button>';
    h += '<button class="br-toolbar-btn br-btn-reject-all" data-br-bulk="reject-all">Reject all</button>';
    h += '<button class="br-toolbar-btn br-btn-reset" data-br-bulk="reset">Reset</button>';
    h += '</div>';
    h += '<div class="br-toolbar-right">';
    h += `<button class="br-toolbar-btn br-btn-apply" data-br-bulk="apply"${this._allReviewed() ? '' : ' disabled'}>Apply ${accepted} accepted changes</button>`;
    h += '</div></div>';

    this._root.innerHTML = h;
    this._bindEvents();
    this._scrollToFocus();
  }

  // ── Event binding (delegated) ────────────────────────────────────────

  _bindEvents() {
    this._root.addEventListener('click', (ev) => {
      const btn = ev.target.closest('[data-br-action]');
      if (btn) { this._resolve(btn.dataset.brId, btn.dataset.brAction); return; }

      const undo = ev.target.closest('.br-undo');
      if (undo) { this._unresolve(undo.dataset.brId); return; }

      const bulk = ev.target.closest('[data-br-bulk]');
      if (bulk) {
        const action = bulk.dataset.brBulk;
        if (action === 'accept-all') this._resolveAll('accepted');
        else if (action === 'reject-all') this._resolveAll('rejected');
        else if (action === 'reset') this._resetAll();
        else if (action === 'apply') this._apply();
      }
    });
  }

  // ── Actions ──────────────────────────────────────────────────────────

  _resolve(id, action) {
    this._statuses[id] = action;
    this._advanceFocus(id);
    this._render();
  }

  _unresolve(id) {
    this._statuses[id] = null;
    const idx = this._changedIds.indexOf(id);
    if (idx >= 0) this._focusIndex = idx;
    this._render();
  }

  _resolveAll(action) {
    for (const id of this._changedIds) this._statuses[id] = action;
    this._render();
  }

  _resetAll() {
    for (const id of this._changedIds) this._statuses[id] = null;
    this._focusIndex = 0;
    this._render();
  }

  _advanceFocus(fromId) {
    const idx = this._changedIds.indexOf(fromId);
    for (let i = idx + 1; i < this._changedIds.length; i++) {
      if (this._statuses[this._changedIds[i]] === null) { this._focusIndex = i; return; }
    }
    for (let i = 0; i < idx; i++) {
      if (this._statuses[this._changedIds[i]] === null) { this._focusIndex = i; return; }
    }
  }

  _scrollToFocus() {
    if (this._focusIndex >= this._changedIds.length) return;
    const el = this._root.querySelector(`#br-card-${this._changedIds[this._focusIndex]}`);
    if (el) {
      const rect = el.getBoundingClientRect();
      if (rect.top < 0 || rect.bottom > window.innerHeight) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }

  // ── Apply — collects results and auto-sends as chat message ──────────

  _apply() {
    if (!this._allReviewed()) return;

    const results = [];
    for (const b of this._blocks) {
      if (b.operation === 'unchanged') continue;
      results.push({
        id: b.id, label: b.label, type: b.type,
        operation: b.operation, status: this._statuses[b.id],
        oldText: b.oldText, newText: b.newText, section: b.section
      });
    }

    const accepted = results.filter(r => r.status === 'accepted');
    const rejected = results.filter(r => r.status === 'rejected');
    const skipped  = results.filter(r => r.status === 'skipped');

    // Collapse panel to a summary badge
    this._root.classList.add('br-resolved');
    this._root.innerHTML =
      '<div class="br-applied-summary">' +
      `<strong>Review complete:</strong> ${accepted.length} accepted, ${rejected.length} rejected, ${skipped.length} skipped` +
      '</div>';
    this.destroy();

    // Build payload and auto-inject as a chat message
    const payload = {
      reviewId: this._config.reviewId,
      title: this._config.title,
      accepted: accepted.length,
      rejected: rejected.length,
      skipped: skipped.length,
      results
    };

    const msg =
      `[Review complete] ${accepted.length} accepted, ${rejected.length} rejected, ${skipped.length} skipped.\n` +
      '```json\n' + JSON.stringify(payload, null, 2) + '\n```';

    if (this._sendFn) this._sendFn(msg);
  }

  // ── Helpers ──────────────────────────────────────────────────────────

  _esc(str) {
    if (!str) return '';
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  // ── Static entry point ───────────────────────────────────────────────

  /**
   * Show a block review panel inline in the chat.
   * Called via window.buildX.showBlockReview(config) from C#.
   *
   * @param {HTMLElement} chatEl   #chatMessagesIndex6
   * @param {object}      config   { title, subtitle, blocks, reviewId }
   * @param {Function}    sendFn   Callback to auto-send a chat message with results
   * @returns {BlockReviewBlock}
   */
  static show(chatEl, config, sendFn) {
    const instance = new BlockReviewBlock(chatEl, config, sendFn);
    instance.mount();
    return instance;
  }
}
