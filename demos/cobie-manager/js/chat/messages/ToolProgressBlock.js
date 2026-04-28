/**
 * Tool progress UI — returns insertable HTML for the chat stream.
 * Completion updates the existing node in the chat container by `data-tool`.
 * Each invocation is wrapped in `.tool-progress-stack` with a muted eyebrow
 * and a footer line when the tool finishes.
 */
export class ToolProgressBlock {
  constructor() {
    this._activeBlocks = new Map();
  }

  /**
   * Muted caption above the card — per tool / command (aesthetic breakdown).
   * @param {string} toolName
   * @returns {string}
   */
  static eyebrowForTool(toolName) {
    const n = toolName || '';
    if (n === 'execute_command') return 'Revit command';
    if (n === 'spawn_agent') return 'Agent';
    if (n === 'web_search') return 'Web · search';
    if (n === 'web_fetch') return 'Web · fetch';
    if (n === 'auto_verify') return 'Verification';
    if (n === 'propose_next') return 'Planning next steps';
    if (['browse_files', 'read_file', 'write_file', 'search_files'].includes(n)) {
      const bit = { browse_files: 'browse', read_file: 'read file', write_file: 'write file', search_files: 'search' }[n];
      return `Workspace · ${bit}`;
    }
    const readable = n.replace(/_/g, ' ');
    return `MCP · ${readable}`;
  }

  /**
   * @param {string} summary
   * @returns {{ text: string, isError: boolean }}
   */
  static formatFooter(summary) {
    const s = (summary || '').trim() || 'Done';
    const isError = /^Error:/i.test(s) || /^Failed\b/i.test(s) || /^Tool\b.*\bfailed\b/i.test(s);
    let text;
    if (s === 'Done' || s === 'Success' || s === 'Cached result') text = s === 'Success' ? 'Done' : s;
    else if (isError) text = s;
    else text = `Done · ${s}`;
    return { text, isError };
  }

  _findOpenStack(rootEl, toolName) {
    return Array.from(rootEl.querySelectorAll('.tool-progress-stack[data-tool]')).find(
      (el) => el.dataset.tool === toolName && !el.classList.contains('tool-progress-stack-done')
    );
  }

  /**
   * @param {string} toolName
   * @param {string} description
   * @param {string} [assistantMsgIndex]
   * @returns {string} HTML fragment
   */
  createBlockHtml(toolName, description, assistantMsgIndex) {
    const esc = this._escapeHtml;
    const idxAttr = assistantMsgIndex != null && assistantMsgIndex !== ''
      ? ` data-assistant-msg-index="${esc(String(assistantMsgIndex))}"`
      : '';
    const eyebrow = esc(ToolProgressBlock.eyebrowForTool(toolName));
    const html = `
      <div class="tool-progress-stack"${idxAttr} data-tool="${esc(toolName)}">
        <div class="tool-progress-eyebrow">${eyebrow}</div>
        <div class="thinking-container visible tool-progress-card">
          <div class="thinking-header">
            <div class="thinking-header-left">
              <div class="pulsing-node"></div>
              <span class="steps-count">${esc(description)}</span>
            </div>
            <div class="steps-toggle">
              <span class="chevron">⌃</span>
            </div>
          </div>
          <ul class="steps-list"></ul>
        </div>
        <div class="tool-progress-footer" hidden></div>
      </div>`;
    this._activeBlocks.set(toolName, true);
    return html.trim();
  }

  /**
   * @param {HTMLElement} rootEl  Usually `#chatMessagesIndex6`
   * @param {string} toolName
   * @param {string} summary
   * @returns {HTMLElement|null}
   */
  completeBlock(rootEl, toolName, summary) {
    if (!rootEl) return null;

    const stack = this._findOpenStack(rootEl, toolName);
    if (!stack) return null;

    const container = stack.querySelector('.thinking-container');
    if (!container) return null;

    stack.classList.add('tool-progress-stack-done');
    container.classList.add('complete', 'tool-progress-done');
    const header = container.querySelector('.thinking-header');
    if (header) header.classList.add('done');

    const stepsCount = container.querySelector('.steps-count');
    if (stepsCount) {
      stepsCount.textContent = '\u2713 ' + stepsCount.textContent.replace(/^\u2713\s*/, '');
    }

    const footer = stack.querySelector('.tool-progress-footer');
    if (footer) {
      const { text, isError } = ToolProgressBlock.formatFooter(summary || 'Done');
      footer.textContent = text;
      footer.hidden = false;
      footer.classList.toggle('tool-progress-footer--error', isError);
    }

    this._activeBlocks.delete(toolName);
    return container;
  }

  /**
   * Mark all open (non-done) tool blocks as failed/cancelled.
   * Called on stop, cancel, error, or timeout.
   * @param {HTMLElement} rootEl  Usually `#chatMessagesIndex6`
   * @param {string} [reason='Cancelled']
   */
  failOpenBlocks(rootEl, reason = 'Cancelled') {
    if (!rootEl) return;
    const stacks = rootEl.querySelectorAll('.tool-progress-stack[data-tool]');
    let n = 0;
    for (const stack of stacks) {
      if (stack.classList.contains('tool-progress-stack-done')) continue;
      const container = stack.querySelector('.thinking-container');
      if (!container || container.classList.contains('tool-progress-done')) continue;

      stack.classList.add('tool-progress-stack-done');
      n++;
      container.classList.add('complete', 'tool-progress-done', 'tool-progress-failed');
      const header = container.querySelector('.thinking-header');
      if (header) header.classList.add('done');

      const stepsCount = container.querySelector('.steps-count');
      if (stepsCount) {
        stepsCount.textContent = '\u2717 ' + stepsCount.textContent.replace(/^[\u2713\u2717]\s*/, '');
      }

      const footer = stack.querySelector('.tool-progress-footer');
      if (footer) {
        footer.textContent = reason;
        footer.hidden = false;
        footer.classList.add('tool-progress-footer--error');
      }

      const toolName = stack.dataset.tool;
      if (toolName) this._activeBlocks.delete(toolName);
    }
    return n;
  }

  /**
   * After C# sends __TOOL_UNDO_REF__, attach per-tool Undo (Revit LIFO: this slot and later).
   * @param {HTMLElement} rootEl
   * @param {string} toolName
   * @param {number} slot
   */
  attachUndoRef(rootEl, toolName, slot) {
    if (!rootEl || toolName == null || Number.isNaN(slot)) return;

    const stack = Array.from(rootEl.querySelectorAll('.tool-progress-stack[data-tool]')).find(
      (s) => s.dataset.tool === toolName
        && s.classList.contains('tool-progress-stack-done')
        && !s.hasAttribute('data-undo-slot')
    );
    if (!stack) return;

    stack.setAttribute('data-undo-slot', String(slot));
    const row = document.createElement('div');
    row.className = 'tool-progress-undo-row';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tool-progress-undo-btn';
    btn.title = 'Undo this tool and every later model change from this reply (uses Revit undo stack).';
    btn.textContent = 'Undo from here';
    row.appendChild(btn);
    stack.appendChild(row);
  }

  appendFeedbackButtons(container) {
    if (!container) return;
    const row = document.createElement('div');
    row.className = 'msg-feedback-row';
    row.innerHTML =
      '<button class="msg-feedback-btn keep" title="Keep these changes">\u2713</button>' +
      '<button class="msg-feedback-btn undo" title="Undo changes from this response">\u21A9</button>' +
      '<button class="msg-feedback-btn review" title="Review what changed">\uD83D\uDC41</button>';
    container.appendChild(row);
  }

  /**
   * Append a sub-step status line into an open tool card's steps-list.
   * @param {HTMLElement} rootEl
   * @param {string} toolName
   * @param {string} statusText
   */
  updateStatus(rootEl, toolName, statusText) {
    if (!rootEl || !statusText) return;
    const stack = this._findOpenStack(rootEl, toolName);
    if (!stack) return;
    const stepsList = stack.querySelector('.steps-list');
    if (!stepsList) return;

    const li = document.createElement('li');
    li.className = 'tool-status-line visible';
    li.textContent = '(' + statusText + ')';
    stepsList.appendChild(li);

    const stepsCount = stack.querySelector('.steps-count');
    if (stepsCount) {
      const base = stepsCount.dataset.baseDesc || stepsCount.textContent.replace(/\s*\(\d+ steps?\)\s*$/, '');
      if (!stepsCount.dataset.baseDesc) stepsCount.dataset.baseDesc = base;
      const count = stepsList.querySelectorAll('li').length;
      stepsCount.textContent = base + ` (${count} step${count !== 1 ? 's' : ''})`;
    }
  }

  _escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
