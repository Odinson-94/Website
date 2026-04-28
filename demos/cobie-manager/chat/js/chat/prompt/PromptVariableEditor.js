/**
 * Modal to fill {{variables}} before inserting a vault prompt.
 * CHANGELOG: 2026-03-27 | Created.
 */

/** @returns {Promise<string|null>} resolved body or null if cancelled */
export function openPromptVariableEditor(title, body) {
  const vars = [];
  const re = /\{\{(\w+)\}\}/g;
  let m;
  while ((m = re.exec(body)) !== null) {
    if (!vars.includes(m[1])) vars.push(m[1]);
  }
  if (vars.length === 0) return Promise.resolve(body);

  return new Promise((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.className = 'bx-modal-backdrop';
    const modal = document.createElement('div');
    modal.className = 'bx-modal';
    modal.innerHTML = `
      <div class="bx-modal-header">${escapeHtml(title || 'Prompt')}</div>
      <p class="bx-modal-hint">Fill template variables</p>
      <div class="bx-modal-fields"></div>
      <div class="bx-modal-actions">
        <button type="button" class="bx-btn bx-btn-secondary" data-act="cancel">Cancel</button>
        <button type="button" class="bx-btn bx-btn-primary" data-act="ok">Insert</button>
      </div>`;

    const fieldsEl = modal.querySelector('.bx-modal-fields');
    vars.forEach((v) => {
      const row = document.createElement('label');
      row.className = 'bx-field-row';
      row.innerHTML = `<span class="bx-field-label">{{${escapeHtml(v)}}}</span><input type="text" class="bx-field-input" data-var="${escapeHtml(v)}" />`;
      fieldsEl.appendChild(row);
    });

    const close = (val) => {
      backdrop.remove();
      resolve(val);
    };

    modal.querySelector('[data-act="cancel"]').addEventListener('click', () => close(null));
    modal.querySelector('[data-act="ok"]').addEventListener('click', () => {
      let out = body;
      modal.querySelectorAll('.bx-field-input').forEach((inp) => {
        const name = inp.getAttribute('data-var');
        const val = inp.value || '';
        out = out.split(`{{${name}}}`).join(val);
      });
      close(out);
    });

    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);
    const first = modal.querySelector('.bx-field-input');
    if (first) first.focus();
  });
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
}
