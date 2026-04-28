/**
 * PromptLibrary — Saves and recalls user prompts via localStorage.
 *
 * Two buckets:
 *   1. Saved prompts  — explicitly bookmarked by the user (☆ button).
 *   2. Recent prompts — auto-recorded each time a message is sent.
 *
 * Both are persisted as JSON arrays under separate localStorage keys.
 */
export class PromptLibrary {
  constructor() {
    this._key = 'buildx_saved_prompts';
    this._recentKey = 'buildx_recent_prompts';
    this._maxRecent = 20;
  }

  save(text, name) {
    const prompts = this.getSaved();
    prompts.push({ text, name: name || text.substring(0, 40), savedAt: new Date().toISOString() });
    localStorage.setItem(this._key, JSON.stringify(prompts));
  }

  getSaved() {
    try { return JSON.parse(localStorage.getItem(this._key) || '[]'); } catch { return []; }
  }

  deleteSaved(index) {
    const prompts = this.getSaved();
    prompts.splice(index, 1);
    localStorage.setItem(this._key, JSON.stringify(prompts));
  }

  addRecent(text) {
    const recent = this.getRecent();
    recent.unshift({ text, usedAt: new Date().toISOString() });
    if (recent.length > this._maxRecent) recent.pop();
    localStorage.setItem(this._recentKey, JSON.stringify(recent));
  }

  getRecent() {
    try { return JSON.parse(localStorage.getItem(this._recentKey) || '[]'); } catch { return []; }
  }
}
