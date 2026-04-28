/**
 * PlanModeBlock — renders plan mode banner (enter) and plan review card (exit).
 * Deletable: if removed, plan mode tools still work, just no inline UI.
 */

function _esc(s) { return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

export class PlanModeBlock {
  static render(data, bridge) {
    const active = data.active;

    if (active) {
      return PlanModeBlock._renderBanner(bridge);
    } else {
      return PlanModeBlock._renderReview(data.plan_text || '', bridge);
    }
  }

  static _renderBanner(bridge) {
    const el = document.createElement('div');
    el.className = 'jb-plan-banner';
    el.innerHTML = `
      <div class="jb-plan-banner-icon">&#128203;</div>
      <div class="jb-plan-banner-text">
        <strong>Plan Mode Active</strong>
        <span>Read-only mode. Exploring codebase and designing approach. No model changes.</span>
      </div>
      <button class="jb-plan-banner-exit">Exit Plan Mode</button>
    `;

    el.querySelector('.jb-plan-banner-exit')?.addEventListener('click', () => {
      if (bridge) bridge.postMessage('chat', JSON.stringify({ text: 'exit plan mode' }));
    });

    return el;
  }

  static _renderReview(planText, bridge) {
    const el = document.createElement('div');
    el.className = 'jb-plan-review';

    el.innerHTML = `
      <div class="jb-plan-review-header">&#128203; Plan Review</div>
      <div class="jb-plan-review-body">
        <pre class="jb-plan-review-text">${_esc(planText || '(No plan text found)')}</pre>
      </div>
      <div class="jb-plan-review-actions">
        <button class="jb-plan-action jb-plan-approve">&#10003; Approve &amp; Execute</button>
        <button class="jb-plan-action jb-plan-reject">&#10007; Reject</button>
        <button class="jb-plan-action jb-plan-edit">&#9998; Edit</button>
      </div>
    `;

    el.querySelector('.jb-plan-approve')?.addEventListener('click', () => {
      if (bridge) bridge.postMessage('chat', JSON.stringify({
        text: `Plan approved. Execute it now.\n\n${planText}`
      }));
    });

    el.querySelector('.jb-plan-reject')?.addEventListener('click', () => {
      if (bridge) bridge.postMessage('chat', JSON.stringify({ text: 'Plan rejected. Please revise.' }));
    });

    el.querySelector('.jb-plan-edit')?.addEventListener('click', () => {
      const pre = el.querySelector('.jb-plan-review-text');
      if (pre) {
        pre.contentEditable = 'true';
        pre.focus();
        pre.classList.add('jb-plan-editing');
      }
    });

    return el;
  }
}
