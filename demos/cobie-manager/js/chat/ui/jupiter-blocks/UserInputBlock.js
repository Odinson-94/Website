/**
 * UserInputBlock — renders structured choice UI (single-select, multi-select, rank).
 * Deletable: if removed, user_input results render as plain JSON.
 */

function _esc(s) { return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

export class UserInputBlock {
  static render(data, bridge) {
    const el = document.createElement('div');
    el.className = 'jb-user-input';

    const questions = data.questions || [];
    if (!questions.length) {
      el.innerHTML = '<div class="jb-input-empty">No questions provided.</div>';
      return el;
    }

    el.innerHTML = `
      <div class="jb-input-header">Input Required</div>
      <div class="jb-input-questions">
        ${questions.map((q, qi) => `
          <div class="jb-input-question" data-qindex="${qi}" data-type="${q.type || 'single_select'}">
            <div class="jb-input-prompt">${_esc(q.question)}</div>
            <div class="jb-input-options">
              ${(q.options || []).slice(0, 6).map((opt, oi) => {
                const inputType = (q.type === 'multi_select') ? 'checkbox' : 'radio';
                const name = `jb_q${qi}`;
                return `
                  <label class="jb-input-option">
                    <input type="${inputType}" name="${name}" value="${_esc(opt)}" />
                    <span>${_esc(opt)}</span>
                  </label>
                `;
              }).join('')}
            </div>
          </div>
        `).join('')}
      </div>
      <div class="jb-input-actions">
        <button class="jb-input-submit">Submit</button>
        <button class="jb-input-cancel">Cancel</button>
      </div>
    `;

    el.querySelector('.jb-input-submit')?.addEventListener('click', () => {
      const answers = [];
      questions.forEach((q, qi) => {
        const qEl = el.querySelector(`[data-qindex="${qi}"]`);
        const checked = qEl ? Array.from(qEl.querySelectorAll('input:checked')).map(i => i.value) : [];
        answers.push({ question: q.question, selected: checked });
      });

      if (bridge) {
        bridge.postMessage('chat', JSON.stringify({
          text: JSON.stringify({ tool: 'user_input', answers }, null, 2)
        }));
      }

      el.querySelectorAll('.jb-input-actions button').forEach(b => b.disabled = true);
      el.querySelector('.jb-input-submit').textContent = 'Submitted';
      el.classList.add('jb-input-submitted');
    });

    el.querySelector('.jb-input-cancel')?.addEventListener('click', () => {
      if (bridge) {
        bridge.postMessage('chat', JSON.stringify({ text: 'User cancelled the input request.' }));
      }
      el.remove();
    });

    return el;
  }
}
