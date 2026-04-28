/**
 * Drag-drop folder onto composer → focus_set with path (when path available).
 * CHANGELOG: 2026-03-27 | Created.
 */
export class FocusDropZone {
  /**
   * @param {import('../bridge/OverrideApiClient.js').OverrideApiClient} api
   * @param {HTMLElement} zone — e.g. .chat-composer-stack
   * @param {import('./FocusDirectoryChip.js').FocusDirectoryChip} chip
   */
  constructor(api, zone, chip) {
    this._api = api;
    this._zone = zone;
    this._chip = chip;
  }

  attach() {
    if (!this._zone) return;
    this._zone.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    });
    this._zone.addEventListener('drop', async (e) => {
      e.preventDefault();
      const files = e.dataTransfer?.files;
      if (!files?.length) return;
      const f = files[0];
      const path = f.path || f.webkitRelativePath;
      if (typeof path === 'string' && path.includes('\\')) {
        const dir = path.includes('\\') ? path.replace(/[^\\]+$/, '').replace(/\\$/, '') : '';
        if (dir) {
          await this._api.call('focus_set', { path: dir });
          await this._chip.refresh();
        }
      }
    });
  }
}
