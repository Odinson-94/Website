/**
 * CommandSuggestions — renders command suggestion UIs from orchestrator responses.
 *
 * Extracted from view6-chat.js:
 *   showCommandSuggestions()      (line ~827)
 *   showCommandOrder()            (line ~880)
 *   showClarifyMessage()          (line ~1006)
 *   showPromptEngineeringBox()    (line ~1051)
 */
import { escapeHtml } from '../messages/ThinkingStepMessage.js';

export class CommandSuggestions {
  constructor(state, bridge) {
    this._state = state;
    this._bridge = bridge;
  }

  /**
   * Show "Did you mean?" command suggestions with shiny buttons.
   * @param {HTMLElement} chatEl
   * @param {Array} commands
   * @param {string} originalQuery
   * @param {string} [customMessage]
   */
  showCommandSuggestions(chatEl, commands, originalQuery, customMessage) {
    if (!chatEl || !commands) return;

    const container = document.createElement('div');
    container.className = 'suggestions-container';

    const headerText = customMessage || 'Did you mean one of these?';
    let html = `<p>${escapeHtml(headerText)}</p><div class="command-suggestions">`;

    commands.forEach((cmd, index) => {
      const confidence = cmd.confidence ? Math.round(cmd.confidence * 100) : 50;
      let displayName = cmd.name || 'Unknown';
      displayName = displayName.replace(/Command$/, '').replace(/([A-Z])/g, ' $1').trim();
      const primaryClass = cmd.isPrimary === true ? ' primary' : '';

      html += `
        <button class="suggestion-btn${primaryClass}" data-command-id="${escapeHtml(cmd.id || cmd.name)}" data-index="${index}" data-confidence="${confidence}%">
          <span class="suggestion-name">${escapeHtml(displayName)}</span>
        </button>
      `;
    });

    html += '</div><p class="suggestion-hint">Tap a command to run it, or try describing your task differently.</p>';
    container.innerHTML = html;

    container.querySelectorAll('.suggestion-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const cmdId = btn.dataset.commandId;
        btn.style.transform = 'scale(0.98)';
        btn.style.opacity = '0.8';
        setTimeout(() => {
          this._bridge.postMessage('select_command', cmdId);
          container.remove();
        }, 150);
      });
    });

    chatEl.appendChild(container);
    chatEl.scrollTo({ top: chatEl.scrollHeight, behavior: 'smooth' });
  }

  /**
   * Show multi-step command order picker.
   * @param {HTMLElement} chatEl
   * @param {{ stepCount:number, workflow:string, steps:Array, message:string }} data
   */
  showCommandOrder(chatEl, data) {
    if (!chatEl) return;

    const { stepCount, workflow, steps, message } = data;
    const container = document.createElement('div');
    container.className = 'suggestions-container command-order';

    let html = `
      <p class="command-order-header">${escapeHtml(message || `This requires ${stepCount} steps:`)}</p>
      <p class="command-order-workflow">${escapeHtml(workflow || '')}</p>
    `;

    const selectedCommands = {};

    steps.forEach((step) => {
      const { stepNumber, stepKeyword, suggestions } = step;

      html += `
        <div class="step-section" data-step="${stepNumber}">
          <p class="step-label">Step ${stepNumber}: <span class="step-keyword">${escapeHtml(stepKeyword)}</span></p>
          <div class="command-suggestions step-suggestions">
      `;

      suggestions.forEach((cmd, cmdIdx) => {
        const confidence = cmd.confidence ? Math.round(cmd.confidence * 100) : 50;
        let displayName = cmd.name || 'Unknown';
        displayName = displayName.replace(/Command$/, '').replace(/([A-Z])/g, ' $1').trim();
        const primaryClass = cmd.isPrimary === true ? ' primary' : '';

        html += `
          <button class="suggestion-btn${primaryClass}"
                  data-step="${stepNumber}"
                  data-command-id="${escapeHtml(cmd.id || cmd.name)}"
                  data-index="${cmdIdx}"
                  data-confidence="${confidence}%">
            <span class="suggestion-name">${escapeHtml(displayName)}</span>
          </button>
        `;
      });

      html += `
          </div>
        </div>
      `;
    });

    html += `
      <div class="command-order-actions">
        <button class="execute-order-btn" disabled>Execute ${stepCount} Steps</button>
        <span class="selection-status">Select a command for each step</span>
      </div>
    `;

    container.innerHTML = html;

    container.querySelectorAll('.suggestion-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const stepNum = btn.dataset.step;
        const cmdId = btn.dataset.commandId;

        container.querySelectorAll(`.suggestion-btn[data-step="${stepNum}"]`).forEach(b => {
          b.classList.remove('selected');
        });
        btn.classList.add('selected');
        selectedCommands[stepNum] = cmdId;

        const allSelected = Object.keys(selectedCommands).length === stepCount;
        const executeBtn = container.querySelector('.execute-order-btn');
        const statusSpan = container.querySelector('.selection-status');

        if (allSelected) {
          executeBtn.disabled = false;
          executeBtn.classList.add('ready');
          statusSpan.textContent = 'Ready to execute';
        } else {
          executeBtn.disabled = true;
          executeBtn.classList.remove('ready');
          const remaining = stepCount - Object.keys(selectedCommands).length;
          statusSpan.textContent = `Select ${remaining} more step${remaining > 1 ? 's' : ''}`;
        }
      });
    });

    const executeBtn = container.querySelector('.execute-order-btn');
    executeBtn.addEventListener('click', () => {
      if (Object.keys(selectedCommands).length !== stepCount) return;

      const orderedCommands = [];
      for (let i = 1; i <= stepCount; i++) {
        if (selectedCommands[i]) orderedCommands.push(selectedCommands[i]);
      }

      executeBtn.disabled = true;
      executeBtn.textContent = 'Executing...';

      this._bridge.postMessage('execute_order', JSON.stringify({ commands: orderedCommands, workflow }));
      setTimeout(() => container.remove(), 300);
    });

    chatEl.appendChild(container);
    chatEl.scrollTo({ top: chatEl.scrollHeight, behavior: 'smooth' });
  }

  /**
   * Show clarification message when too many 50% matches.
   * @param {HTMLElement} chatEl
   * @param {string} message
   * @param {Array} suggestions
   */
  showClarifyMessage(chatEl, message, suggestions) {
    if (!chatEl) return;

    const container = document.createElement('div');
    container.className = 'suggestions-container clarify';

    let html = `<p style="color:#f59e0b;font-size:0.65rem;">⚠️ ${escapeHtml(message || 'Can you be more specific?')}</p>`;

    if (suggestions && suggestions.length > 0) {
      html += '<div class="command-suggestions">';
      suggestions.forEach((cmd, index) => {
        const confidence = cmd.confidence ? Math.round(cmd.confidence * 100) : 50;
        let displayName = cmd.name || 'Unknown';
        displayName = displayName.replace(/Command$/, '').replace(/([A-Z])/g, ' $1').trim();

        html += `
          <button class="suggestion-btn" data-command-id="${escapeHtml(cmd.id || cmd.name)}" data-index="${index}" data-confidence="${confidence}%">
            <span class="suggestion-name">${escapeHtml(displayName)}</span>
          </button>
        `;
      });
      html += '</div>';
    }

    html += '<p class="suggestion-hint">Try being more specific</p>';
    container.innerHTML = html;

    container.querySelectorAll('.suggestion-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const cmdId = btn.dataset.commandId;
        btn.style.transform = 'scale(0.98)';
        setTimeout(() => {
          this._bridge.postMessage('select_command', cmdId);
          container.remove();
        }, 150);
      });
    });

    chatEl.appendChild(container);
    chatEl.scrollTo({ top: chatEl.scrollHeight, behavior: 'smooth' });
  }

  /**
   * Show prompt engineering box for commands without keywords.
   * @param {HTMLElement} chatEl
   * @param {string} commandName
   * @param {string} commandClass
   */
  showPromptEngineeringBox(chatEl, commandName, commandClass) {
    if (!chatEl) return;

    const container = document.createElement('div');
    container.className = 'demo-msg-bot thinking-container visible';

    container.innerHTML = `
      <div class="thinking-header">
        <div class="thinking-header-left">
          <div class="pulsing-node" style="background:#f59e0b;"></div>
          <span class="steps-count">No Keywords</span>
        </div>
      </div>
      <div class="files-changed-section visible" style="margin-top:8px;">
        <div class="files-changed-header">
          <span class="files-changed-count">⚠️ ${escapeHtml(commandName)}</span>
        </div>
        <div style="padding:8px 10px;font-size:0.6rem;color:#888;">
          This command has no prompt keywords. Add keywords to help AI match your requests:
        </div>
        <div style="padding:4px 10px;">
          <input type="text" class="prompt-keyword-input"
                 style="width:100%;padding:6px 8px;font-size:0.6rem;border:1px solid #3a3a3a;border-radius:4px;background:#1a1a1a;color:#fff;"
                 placeholder="e.g., grid section, section along grid">
        </div>
        <div class="files-changed-actions" style="padding:8px 10px;display:flex;gap:8px;justify-content:flex-end;">
          <button class="files-action-btn" data-action="cancel">Cancel</button>
          <button class="files-action-btn primary" data-action="save">Save Keywords</button>
        </div>
      </div>
    `;

    const saveBtn = container.querySelector('[data-action="save"]');
    const cancelBtn = container.querySelector('[data-action="cancel"]');
    const input = container.querySelector('.prompt-keyword-input');

    saveBtn.addEventListener('click', () => {
      const keywords = input.value.trim();
      if (keywords) {
        this._bridge.postMessage('save_prompt', JSON.stringify({ commandName, commandClass, keywords }));
        container.remove();
      }
    });

    cancelBtn.addEventListener('click', () => container.remove());

    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') saveBtn.click();
    });

    chatEl.appendChild(container);
    chatEl.scrollTop = chatEl.scrollHeight;
    input.focus();
  }
}
