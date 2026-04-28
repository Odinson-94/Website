// ═══════════════════════════════════════════════════════════════════════
// SkillPalette.js
// STATUS: UNLOCKED
// ═══════════════════════════════════════════════════════════════════════
//
// DESIGN:  Floating skill picker triggered by "/" in the chat input.
//          Loads skill_manifest.json, scores queries with a multi-signal
//          relevance algorithm (not simple substring), groups results by
//          category, and pastes the selected skill content into the input.
//
// ─────────────────────────────────────────────────────────────────────
// CALLS:    EventBus (slash-trigger, slash-dismiss)
// CALLED BY: ChatApp.js (instantiates + wires EventBus)
//            ChatInput.js (emits slash-trigger / slash-dismiss)
// ═══════════════════════════════════════════════════════════════════════

export class SkillPalette {

  // ── Constructor ──────────────────────────────────────────────────────

  /**
   * @param {import('../../shared/EventBus.js').EventBus} eventBus
   * @param {string} manifestUrl  Path to skill_manifest.json
   */
  constructor(eventBus, manifestUrl) {
    this._bus = eventBus;
    this._manifestUrl = manifestUrl || 'data/skill_manifest.json';
    this._skills = [];
    this._el = null;
    this._visible = false;
    this._selectedIndex = -1;
    this._onInsert = null;

    this._bus.on('slash-trigger', (data) => this._onTrigger(data));
    this._bus.on('slash-dismiss', () => this.hide());

    this._loadManifest();
  }

  // ── Manifest loading ─────────────────────────────────────────────────

  async _loadManifest() {
    try {
      const resp = await fetch(this._manifestUrl);
      if (!resp.ok) {
        console.error('[SkillPalette] SLASH-H2: manifest fetch failed, status=' + resp.status + ' url=' + this._manifestUrl);
        return;
      }
      this._skills = await resp.json();
      console.error('[SkillPalette] SLASH-H2-OK: manifest loaded, skills=' + this._skills.length);
    } catch (e) {
      console.error('[SkillPalette] SLASH-H2: manifest fetch exception: ' + e.message);
    }
  }

  // ── Lifecycle ────────────────────────────────────────────────────────

  /**
   * @param {HTMLElement} anchorEl  Element to anchor the palette above (the input area)
   * @param {Function}    onInsert  Called with skill content string when user picks a skill
   */
  bind(anchorEl, onInsert) {
    if (!anchorEl) {
      console.error('[SkillPalette] SLASH-H3: bind() called with null anchorEl');
      return;
    }
    this._anchorEl = anchorEl;
    this._onInsert = onInsert;

    this._el = document.createElement('div');
    this._el.className = 'skill-palette';
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

  // ── Show / Hide ──────────────────────────────────────────────────────

  _onTrigger(data) {
    const query = (data?.query || '').trim();
    this._show(query);
  }

  _show(query) {
    if (!this._el) {
      console.error('[SkillPalette] SLASH-H3: _el is null in _show — bind() never called or anchor missing');
      return;
    }
    if (this._skills.length === 0) {
      console.error('[SkillPalette] SLASH-H2: _skills empty in _show');
      return;
    }

    const scored = this._scoreAll(query);
    const grouped = this._groupByCategory(scored);

    let html = '<div class="skill-palette-results">';

    if (grouped.length === 0) {
      html += '<div class="skill-palette-empty">No matching skills</div>';
    } else {
      for (const group of grouped) {
        html += `<div class="skill-palette-group">`;
        html += `<div class="skill-palette-group-label">${this._esc(group.category)}</div>`;
        for (const item of group.items) {
          html += `<div class="skill-palette-item" data-slug="${this._esc(item.slug)}">`;
          html += `<div class="skill-palette-item-name">/${this._esc(item.name)}</div>`;
          html += `<div class="skill-palette-item-desc">${this._esc(item.description)}</div>`;
          html += `</div>`;
        }
        html += `</div>`;
      }
    }

    html += '<div class="skill-palette-create" data-action="create-skill">';
    html += '<span class="skill-palette-create-icon">+</span>';
    html += '<span class="skill-palette-create-text">Create your own skill</span>';
    html += '</div>';

    html += '</div>';
    this._el.innerHTML = html;
    this._el.style.display = '';
    this._visible = true;
    this._selectedIndex = -1;
  }

  hide() {
    if (!this._el) return;
    this._el.style.display = 'none';
    this._visible = false;
    this._selectedIndex = -1;
  }

  get isVisible() { return this._visible; }

  // ── Click handling ───────────────────────────────────────────────────

  _onClick(e) {
    const createBtn = e.target.closest('.skill-palette-create');
    if (createBtn) {
      this.hide();
      if (this._onInsert) this._onInsert('/create-skill ');
      return;
    }

    const item = e.target.closest('.skill-palette-item');
    if (!item) return;
    const slug = item.dataset.slug;
    const skill = this._skills.find(s => s.slug === slug);
    if (!skill) return;
    this.hide();
    if (this._onInsert) this._onInsert(skill.content);
  }

  // ── Arrow key navigation (called from ChatInput keydown) ─────────────

  navigateUp() {
    if (!this._visible) return false;
    const items = this._el.querySelectorAll('.skill-palette-item');
    if (items.length === 0) return false;
    this._selectedIndex = Math.max(0, this._selectedIndex - 1);
    this._highlightItem(items);
    return true;
  }

  navigateDown() {
    if (!this._visible) return false;
    const items = this._el.querySelectorAll('.skill-palette-item');
    if (items.length === 0) return false;
    this._selectedIndex = Math.min(items.length - 1, this._selectedIndex + 1);
    this._highlightItem(items);
    return true;
  }

  confirmSelection() {
    if (!this._visible) return false;
    const items = this._el.querySelectorAll('.skill-palette-item');
    if (this._selectedIndex < 0 || this._selectedIndex >= items.length) return false;
    items[this._selectedIndex].click();
    return true;
  }

  _highlightItem(items) {
    items.forEach((el, i) => {
      el.classList.toggle('skill-palette-item-active', i === this._selectedIndex);
    });
    if (this._selectedIndex >= 0 && items[this._selectedIndex]) {
      items[this._selectedIndex].scrollIntoView({ block: 'nearest' });
    }
  }

  // ── Relevance scoring ────────────────────────────────────────────────
  //
  // Multi-signal algorithm. Each query word is scored independently
  // against every field, then summed. This gives "semantic-like" results
  // without needing embeddings — "param" ranks "Parameters Skill" above
  // "Drawing Exporter" even though both descriptions mention parameters.

  _scoreAll(query) {
    if (!query) {
      return this._skills.map(s => ({ ...s, _score: 0 }));
    }

    const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 0);
    return this._skills.map(skill => {
      let score = 0;
      const nameLow = skill.name.toLowerCase();
      const descLow = (skill.description || '').toLowerCase();
      const tagsLow = (skill.tags || []).map(t => t.toLowerCase());
      const aliasesLow = (skill.aliases || []).map(a => a.toLowerCase());

      for (const w of words) {
        // Exact name match (full query vs name)
        if (nameLow === query.toLowerCase()) { score += 100; continue; }

        // Name starts-with
        if (nameLow.startsWith(w)) score += 80;
        // Name word contains
        else if (nameLow.includes(w)) score += 60;

        // Alias exact match
        if (aliasesLow.some(a => a === w || a === query.toLowerCase())) score += 70;
        // Alias partial
        else if (aliasesLow.some(a => a.includes(w))) score += 45;

        // Tag match
        if (tagsLow.some(t => t === w)) score += 50;
        else if (tagsLow.some(t => t.startsWith(w))) score += 35;
        else if (tagsLow.some(t => t.includes(w))) score += 20;

        // Description word match
        if (descLow.includes(w)) score += 30;

        // Slug match
        if (skill.slug.includes(w)) score += 25;
      }

      return { ...skill, _score: score };
    }).sort((a, b) => b._score - a._score);
  }

  // ── Grouping ─────────────────────────────────────────────────────────

  _groupByCategory(scored) {
    const hasQuery = scored.some(s => s._score > 0);
    const filtered = hasQuery ? scored.filter(s => s._score > 0) : scored;

    const map = new Map();
    for (const s of filtered) {
      const cat = s.category || 'General';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat).push(s);
    }

    const groups = [];
    for (const [category, items] of map) {
      const topScore = Math.max(...items.map(i => i._score));
      groups.push({ category, items, _topScore: topScore });
    }

    return groups.sort((a, b) => b._topScore - a._topScore);
  }

  // ── Helpers ──────────────────────────────────────────────────────────

  _esc(str) {
    if (!str) return '';
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }
}
