/**
 * CreatePalette — "Create…" quick-actions dropdown above the composer.
 *
 * Shell component. Populates with canned prompts for any local
 * [McpTool]-registered action that benefits from a one-click entry point
 * (e.g. native schedule creation, drawing issue sheet creation — once
 * those are built as first-party MEPBridge features).
 *
 * The palette auto-injects the current project ref when the C# side's
 * ActiveProjectContext provides one (bridge message: 'get_active_project').
 * When no ref is detected the user is prompted inline.
 */
export class CreatePalette {
  /** @param {import('../bridge/WebViewBridge.js').WebViewBridge} bridge */
  constructor(bridge) {
    this._bridge = bridge;
    this._el = null;
    this._menu = null;
    this._activeProject = null;

    this._handleProjectResp = this._handleProjectResp.bind(this);
    if (typeof this._bridge?.on === 'function') {
      this._bridge.on('active_project', (_rest, data) => this._handleProjectResp(data));
    }
    this._requestActiveProject();
  }

  mount() {
    // Mount is a no-op until there's at least one item to show. Remove this
    // guard once first-party MEPBridge create-actions land and are added
    // to the `items` array in _toggleMenu below.
    if (!CreatePalette.hasRegisteredItems()) return;

    const row = document.querySelector('.demo-chat-input-row')
      || document.querySelector('.chat-composer-stack')
      || document.body;
    if (!row) return;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'chat-create-palette-btn';
    btn.title = 'Quick-actions for the active project';
    btn.textContent = '\u2795 Create\u2026';
    btn.style.cssText = [
      'background: transparent',
      'color: var(--fg-primary, #E6E6E6)',
      'border: 1px solid var(--border-subtle, rgba(255,255,255,0.15))',
      'border-radius: 6px',
      'padding: 4px 10px',
      'font-size: 12px',
      'cursor: pointer',
      'margin-right: 6px',
    ].join(';');
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      this._toggleMenu(btn);
    });
    row.prepend(btn);
    this._el = btn;

    document.addEventListener('click', (e) => {
      if (this._menu && !this._menu.contains(e.target) && e.target !== this._el) {
        this._closeMenu();
      }
    });
  }

  _requestActiveProject() {
    try { this._bridge?.postMessage?.('get_active_project', ''); } catch { /* best effort */ }
  }

  _handleProjectResp(data) {
    this._activeProject = data?.projectRef || null;
    // Refresh the menu if it's open.
    if (this._menu && this._el) {
      this._closeMenu();
      this._toggleMenu(this._el);
    }
  }

  _toggleMenu(anchor) {
    if (this._menu) { this._closeMenu(); return; }
    this._requestActiveProject();

    const menu = document.createElement('div');
    menu.className = 'chat-create-palette-menu';
    menu.style.cssText = [
      'position: absolute',
      'z-index: 40',
      'background: var(--bg-surface, #1D1D1F)',
      'color: var(--fg-primary, #E6E6E6)',
      'border: 1px solid var(--border-subtle, rgba(255,255,255,0.15))',
      'border-radius: 8px',
      'padding: 6px',
      'min-width: 260px',
      'box-shadow: 0 6px 20px rgba(0,0,0,0.35)',
      'font-size: 13px',
    ].join(';');

    const projectLabel = this._activeProject
      ? `<span style="color:#7FC49C">${this._activeProject}</span>`
      : '<em style="opacity:0.65">no active project detected — you\u2019ll be prompted</em>';

    menu.innerHTML = `
      <div style="padding:4px 8px;opacity:0.8;">Active project: ${projectLabel}</div>
      <hr style="border:none;border-top:1px solid rgba(255,255,255,0.1);margin:4px 0;">
    `;

    // The palette is registered-but-empty until first-party MEPBridge
    // features (e.g. Drawing Issue Sheet creation, Schedule creation) land
    // as native [McpTool] classes in this repo. When they do, add entries
    // here with `{label, hint, makePrompt: (ref) => '…'}` and the button
    // will post the canned prompt via bridge.postMessage('chat', …).
    const items = [];

    items.forEach((it) => {
      const row = document.createElement('button');
      row.type = 'button';
      row.style.cssText = [
        'display: block',
        'width: 100%',
        'text-align: left',
        'background: transparent',
        'color: inherit',
        'border: none',
        'border-radius: 6px',
        'padding: 8px 10px',
        'cursor: pointer',
        'font: inherit',
      ].join(';');
      row.innerHTML = `<div>${it.label}</div><div style="opacity:0.55;font-size:11.5px;margin-top:2px">${it.hint}</div>`;
      row.addEventListener('mouseenter', () => row.style.background = 'rgba(255,255,255,0.06)');
      row.addEventListener('mouseleave', () => row.style.background = 'transparent');
      row.addEventListener('click', () => {
        this._closeMenu();
        let ref = this._activeProject;
        if (!ref) {
          const typed = (window.prompt('Project ref (e.g. G0053):') || '').trim();
          if (!typed) return;
          ref = typed.toUpperCase();
        }
        const prompt = it.makePrompt(ref);
        if (!prompt) return;
        try { this._bridge?.postMessage?.('chat', prompt); } catch (e) { console.warn('[CreatePalette] send failed', e?.message); }
      });
      menu.appendChild(row);
    });

    const rect = anchor.getBoundingClientRect();
    menu.style.left = `${Math.round(rect.left)}px`;
    menu.style.top = `${Math.round(rect.top - 8)}px`;
    menu.style.transform = 'translateY(-100%)';
    document.body.appendChild(menu);
    this._menu = menu;
  }

  _closeMenu() {
    if (this._menu?.parentNode) this._menu.parentNode.removeChild(this._menu);
    this._menu = null;
  }

  /**
   * Returns true once at least one create-action has been added to the
   * palette. Gates mount() so the composer button doesn't appear until the
   * feature is populated.
   */
  static hasRegisteredItems() {
    // Flip to `return true;` once the `items` array in _toggleMenu has
    // at least one entry.
    return false;
  }
}
