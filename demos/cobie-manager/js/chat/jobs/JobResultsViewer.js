/**
 * Viewer for scheduled job output (planned).
 * CHANGELOG: 2026-03-27 | Stub.
 */
export class JobResultsViewer {
  constructor(root) {
    this._root = root;
  }

  show(_jobId) {
    if (!this._root) return;
    this._root.innerHTML = '<p class="bx-muted">Job results will open here when Edge Functions are deployed.</p>';
  }
}
