/**
 * ThinkingStepMessage — live thinking-step indicator and static thinking containers.
 *
 * Extracted from view6-chat.js (lines 1110–1365, 1516–1619, 2134–2185).
 * Handles the real-time "thinking" UI that appears while Claude is processing,
 * including animated step reveals, duration tracking, and collapse/expand behaviour.
 */

import { escapeHtml } from './MessageParser.js';

// ── Helpers ────────────────────────────────────────────────────────
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getElements() {
  return {
    chatMessages: document.getElementById('chatMessagesIndex6'),
    persistentNode: document.getElementById('chatPersistentNodeIndex6'),
    gifSection: document.getElementById('gifSectionIndex6'),
    chatInput: document.getElementById('chatInputIndex6'),
    chatSend: document.getElementById('chatSendIndex6')
  };
}

// ── Constants ──────────────────────────────────────────────────────
const THINKING_PHASES = [
  'Thinking about your request...',
  'Processing...',
  'Analysing context...',
  'Planning response...',
  'Generating answer...',
  'Almost there...'
];

const MIN_STEP_DELAY = 400;

// ── Class ──────────────────────────────────────────────────────────
export class ThinkingStepMessage {
  constructor(state, eventBus) {
    this._state = state;
    this._eventBus = eventBus;

    this.activeContainer = null;
    this.thinkingStartTime = null;
    this._stepQueue = [];
    this._isProcessingSteps = false;
    this._delegationInitialized = false;
  }

  // ── Live indicator (shown while Claude is thinking) ────────────

  /**
   * Create and append the live thinking indicator.
   * @param {HTMLElement} chatEl — the chat messages container
   * @returns {HTMLElement} the new thinking-container div
   */
  createThinkingIndicator(chatEl) {
    const container = document.createElement('div');
    container.className = 'thinking-container';
    container.style.opacity = '0';
    container.style.transform = 'translateY(8px)';
    container.innerHTML = `
      <div class="thinking-header">
        <div class="thinking-header-left">
          <div class="pulsing-node"></div>
          <span class="steps-count">1 step</span>
        </div>
        <div class="steps-toggle">
          <span class="chevron">⌃</span>
        </div>
      </div>
      <ul class="steps-list">
        <li class="visible"><span class="step-icon dot">●</span> Processing request...</li>
      </ul>
      <div class="thought-status">
        <span class="thought-status-text">Thinking about your request...</span>
      </div>
      <div class="thought-trail">
        <div class="thought-trail-header">
          <span class="thought-trail-label">Thought for <span class="thought-duration">0s</span></span>
          <span class="thought-trail-expand">▼</span>
        </div>
        <div class="thought-trail-content">
          <p>Analysing your request and preparing a response...</p>
        </div>
      </div>
    `;
    chatEl.appendChild(container);

    requestAnimationFrame(() => {
      container.classList.add('visible');
      container.style.transition = 'opacity 0.4s ease-out, transform 0.4s ease-out';
      container.style.opacity = '1';
      container.style.transform = 'translateY(0)';
    });

    chatEl.scrollTo({ top: chatEl.scrollHeight, behavior: 'smooth' });

    const durationEl = container.querySelector('.thought-duration');
    const statusTextEl = container.querySelector('.thought-status-text');
    let phaseIndex = 0;

    container._durationInterval = setInterval(() => {
      if (this.thinkingStartTime && durationEl) {
        const elapsed = Math.floor((Date.now() - this.thinkingStartTime) / 1000);
        durationEl.textContent = elapsed + 's';
      }
    }, 1000);

    container._phaseInterval = setInterval(() => {
      if (statusTextEl) {
        phaseIndex = (phaseIndex + 1) % THINKING_PHASES.length;
        statusTextEl.textContent = THINKING_PHASES[phaseIndex];
      }
    }, 2500);

    return container;
  }

  /**
   * Process the step queue — reveals queued thoughts one-by-one with delays.
   */
  async processStepQueue() {
    if (this._isProcessingSteps) return;
    this._isProcessingSteps = true;

    while (this._stepQueue.length > 0 && this.activeContainer) {
      const thought = this._stepQueue.shift();
      this.addStepToThinkingIndicatorAnimated(this.activeContainer, thought);
      await sleep(MIN_STEP_DELAY);
    }

    this._isProcessingSteps = false;
  }

  /**
   * Enqueue a thought for animated reveal.
   * @param {string} thought
   */
  queueStep(thought) {
    this._stepQueue.push(thought);
    this.processStepQueue();
  }

  /**
   * Reset the step queue (call when starting a new thinking session).
   */
  resetQueue() {
    this._stepQueue = [];
    this._isProcessingSteps = false;
  }

  /**
   * Add a step with smooth slide-in animation.
   */
  addStepToThinkingIndicatorAnimated(container, thought) {
    const stepsList = container.querySelector('.steps-list');
    const stepsCount = container.querySelector('.steps-count');
    const statusTextEl = container.querySelector('.thought-status-text');
    const trailContent = container.querySelector('.thought-trail-content');
    const toggle = container.querySelector('.steps-toggle');

    if (!stepsList || !thought) return;

    if (toggle && !toggle.classList.contains('expanded')) {
      toggle.classList.add('expanded');
      stepsList.classList.add('expanded');
    }

    // display:flex must be set inline because CSS has display:none by default
    // and display cannot be transitioned — it would skip the animation
    const li = document.createElement('li');
    li.style.display = 'flex';
    li.style.alignItems = 'flex-start';
    li.style.opacity = '0';
    li.style.transform = 'translateY(8px)';
    li.innerHTML = `<span class="step-icon dot">●</span> ${escapeHtml(thought)}`;
    stepsList.appendChild(li);

    li.offsetHeight; // force reflow

    li.style.transition = 'opacity 0.5s ease-out, transform 0.5s ease-out';
    li.classList.add('visible');
    li.style.opacity = '1';
    li.style.transform = 'translateY(0)';

    const count = stepsList.querySelectorAll('li').length;
    if (stepsCount) {
      stepsCount.textContent = `${count} step${count !== 1 ? 's' : ''}`;
    }

    if (statusTextEl) {
      statusTextEl.textContent = thought;
    }

    if (trailContent) {
      if (trailContent.innerHTML.includes('Analysing your request')) {
        trailContent.innerHTML = '';
      }
      const p = document.createElement('p');
      p.style.opacity = '0';
      p.style.transition = 'opacity 0.2s ease';
      p.textContent = thought;
      trailContent.appendChild(p);
      requestAnimationFrame(() => {
        p.style.opacity = '1';
      });
    }

    const chatEl = document.getElementById('chatMessagesIndex6');
    if (chatEl) {
      chatEl.scrollTo({ top: chatEl.scrollHeight, behavior: 'smooth' });
    }
  }

  /**
   * Add a step without animation (instant append).
   */
  addStepToThinkingIndicator(container, thought) {
    const stepsList = container.querySelector('.steps-list');
    const stepsCount = container.querySelector('.steps-count');
    const statusTextEl = container.querySelector('.thought-status-text');
    const trailContent = container.querySelector('.thought-trail-content');

    if (!stepsList || !thought) return;

    const li = document.createElement('li');
    li.className = 'visible';
    li.innerHTML = `<span class="step-icon dot">●</span> ${escapeHtml(thought)}`;
    stepsList.appendChild(li);

    const count = stepsList.querySelectorAll('li').length;
    if (stepsCount) stepsCount.textContent = `${count} step${count !== 1 ? 's' : ''}`;

    if (statusTextEl) statusTextEl.textContent = thought;

    if (trailContent) {
      if (trailContent.innerHTML.includes('Analysing your request')) {
        trailContent.innerHTML = '';
      }
      const p = document.createElement('p');
      p.textContent = thought;
      trailContent.appendChild(p);
    }

    const chatEl = document.getElementById('chatMessagesIndex6');
    if (chatEl) chatEl.scrollTop = chatEl.scrollHeight;
  }

  /**
   * Complete the current active thinking container (used for segmented thinking between tools).
   */
  completeThinkingIndicator() {
    if (!this.activeContainer) return;
    const durationMs = this.thinkingStartTime ? Date.now() - this.thinkingStartTime : 0;
    this.finishThinkingIndicator(this.activeContainer, durationMs);
    this.activeContainer = null;
  }

  /**
   * Finish the live thinking indicator — stops timers, shows final duration, collapses steps.
   */
  finishThinkingIndicator(container, durationMs) {
    if (container._durationInterval) {
      clearInterval(container._durationInterval);
    }
    if (container._phaseInterval) {
      clearInterval(container._phaseInterval);
    }

    const durationEl = container.querySelector('.thought-duration');
    if (durationEl) {
      durationEl.textContent = formatDuration(durationMs);
    }

    const statusTextEl = container.querySelector('.thought-status-text');
    if (statusTextEl) {
      statusTextEl.textContent = 'Done ✓';
      statusTextEl.style.animation = 'none';
      statusTextEl.style.background = '#156082';
      statusTextEl.style.webkitBackgroundClip = 'text';
      statusTextEl.style.backgroundClip = 'text';
    }

    container.classList.add('complete');
    const header = container.querySelector('.thinking-header');
    if (header) header.classList.add('done');

    const stepsList = container.querySelector('.steps-list');
    const stepsCount = container.querySelector('.steps-count');
    if (stepsCount && stepsList) {
      const actualCount = stepsList.querySelectorAll('li').length;
      stepsCount.textContent = `${actualCount} step${actualCount !== 1 ? 's' : ''}`;
    }

    const toggle = container.querySelector('.steps-toggle');
    if (toggle) toggle.classList.remove('expanded');
    if (stepsList) stepsList.classList.remove('expanded');
  }

  // ── Static / history rendering ─────────────────────────────────

  /**
   * Build a single step's `<li>` markup.
   * Per chat-step-strategy.md:
   * - think: grey dot, no +/-, no filename
   * - action: pencil icon, +/- in box, filename in light font
   * - done: green check
   */
  buildStepHtml(step, liClasses = '') {
    return buildStepHtml(step, liClasses);
  }

  /**
   * Create a static thinking container (for restored / history messages).
   */
  createThinkingContainer(steps, isCollapsed = false) {
    const container = document.createElement('div');
    container.className = 'thinking-container' + (isCollapsed ? ' visible' : '');

    const stepsHtml = steps.map(step => this.buildStepHtml(step, '')).join('');

    container.innerHTML = `
      <div class="thinking-header${isCollapsed ? ' done' : ''}">
        <div class="thinking-header-left">
          <div class="pulsing-node"></div>
          <span class="steps-count">${steps.length} steps</span>
        </div>
        <div class="steps-toggle">
          <span class="chevron">⌃</span>
        </div>
      </div>
      <ul class="steps-list">
        ${stepsHtml}
      </ul>
    `;

    const header = container.querySelector('.thinking-header');
    if (header) {
      header.style.cursor = 'pointer';
    }

    return container;
  }

  /**
   * Get human-readable status text for a step type.
   */
  getStatusForStep(step) {
    return getStatusForStep(step);
  }

  // ── Event delegation for expand/collapse ───────────────────────

  /**
   * Wire up click handlers for thinking-container expand/collapse.
   * Uses event delegation so dynamically-added containers work automatically.
   */
  initThinkingContainerHandlers(parentEl) {
    if (!parentEl) return;

    parentEl.querySelectorAll('.thinking-container .thinking-header').forEach(header => {
      header.style.cursor = 'pointer';
    });

    if (this._delegationInitialized) return;
    this._delegationInitialized = true;

    document.addEventListener('click', (e) => {
      if (!e.target.closest('#chatMessagesIndex6')) return;

      const header = e.target.closest('.thinking-header');
      if (!header) return;

      const container = header.closest('.thinking-container');
      if (!container) return;

      const toggle = container.querySelector('.steps-toggle');
      const stepsList = container.querySelector('.steps-list');

      if (stepsList) {
        const isExpanded = stepsList.classList.contains('expanded');

        if (toggle) toggle.classList.toggle('expanded');
        stepsList.classList.toggle('expanded');

        if (isExpanded) {
          stepsList.classList.remove('fully-expanded');
        } else {
          stepsList.classList.add('fully-expanded');
          stepsList.querySelectorAll('li').forEach(li => li.classList.add('visible'));
        }
      }
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('#chatMessagesIndex6')) return;

      const thoughtHeader = e.target.closest('.thought-trail-header');
      if (!thoughtHeader) return;

      const thoughtTrail = thoughtHeader.closest('.thought-trail');
      if (thoughtTrail) {
        thoughtTrail.classList.toggle('expanded');
      }
    });
  }
}

// ── Module-private utility (used by finishThinkingIndicator) ─────

function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }
  return `${seconds}s`;
}

function getStatusForStep(step) {
  if (!step) return '';
  switch (step.type) {
    case 'think':
      return 'Thinking...';
    case 'action':
      return 'Generating 3D model...';
    case 'error':
      return 'Stopped.';
    case 'done':
      return 'Complete.';
    default:
      return 'Processing...';
  }
}

function buildStepHtml(step, liClasses = '') {
  let iconClass = 'dot';
  let iconChar = '';

  if (step.type === 'done') {
    iconClass = 'check';
  } else if (step.type === 'action') {
    iconClass = 'edit';
    iconChar = '✎';
  } else if (step.type === 'error') {
    iconClass = 'error';
    iconChar = '✗';
  }

  let changesHtml = '';
  if (step.changes) {
    const changeClass = step.changes.startsWith('-') ? 'removed' : (step.changes.startsWith('~') ? 'modified' : 'added');
    changesHtml = `<span class="step-changes"><span class="changes-box"><span class="${changeClass}">${step.changes}</span></span><span class="filename">${step.filename || ''}</span></span>`;
  }

  return `<li class="${liClasses}"><span class="step-icon ${iconClass}">${iconChar}</span><span class="step-content"><span class="step-text">${step.text}</span>${changesHtml}</span></li>`;
}

export { sleep, getElements, escapeHtml, formatDuration, getStatusForStep, buildStepHtml };
