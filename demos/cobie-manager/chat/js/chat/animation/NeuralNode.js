/**
 * NeuralNode — Neural node canvas animation and workflow sequencing.
 *
 * Extracted from view6-chat.js:
 *   - sleep(ms)                   (line 1516-1518)
 *   - getElements()               (lines 1520-1528)
 *   - getStatusForStep(step)      (lines 1543-1557)
 *   - buildStepHtml(step)         (lines 1566-1587)
 *   - formatDuration(ms)          (lines 1531-1540)
 *   - runNeuralNodeWorkflow()     (lines 1626-1949)  — full async animation
 *   - initResizeHandler() ref to #chatPersistentNodeIndex6 (line 2188+)
 *
 * DOM targets:
 *   #chatPersistentNodeIndex6     — the neural node element
 *   #chatNodeStatus6 .status-text — status text display
 *   #chatMessagesIndex6           — chat message container
 *
 * Responsibilities:
 *   - Orchestrate the full thinking animation workflow
 *   - Activate / deactivate the node (CSS class toggling)
 *   - Display and update status text below the node
 */
import { sleep, formatDuration, getStatusForStep, buildStepHtml } from '../messages/ThinkingStepMessage.js';

const TIMING = {
  nodeMove: 400,
  pause: 300,
  stepReveal: 350,
  collapse: 400
};

function getFileIcon(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  const icons = {
    'rvt':  { class: 'rvt',  label: 'RVT' },
    'dwg':  { class: 'dwg',  label: 'DWG' },
    'pdf':  { class: 'pdf',  label: 'PDF' },
    'xlsx': { class: 'xlsx', label: 'XLS' },
    'docx': { class: 'docx', label: 'DOC' }
  };
  return icons[ext] || { class: 'default', label: '◇' };
}

export class NeuralNode {
  /** @param {import('../state/ChatState.js').ChatState} state */
  /** @param {import('../../shared/EventBus.js').EventBus} eventBus */
  constructor(state, eventBus) {
    this._state = state;
    this._eventBus = eventBus;
    this._isAnimating = false;

    this._nodeEl = document.getElementById('chatPersistentNodeIndex6');
    this._statusEl = document.querySelector('#chatNodeStatus6 .status-text');
    this._chatEl = document.getElementById('chatMessagesIndex6');
  }

  // ── Public API ──────────────────────────────────────────────

  /**
   * Run the full neural node animation workflow.
   * Requires the legacy conversations object to be available on window.View6Chat
   * or passed through state.
   */
  async runWorkflow() {
    if (this._isAnimating) return;
    this._isAnimating = true;

    const startTime = Date.now();
    const nodeEl = this._nodeEl;
    const chatEl = this._chatEl;

    if (!chatEl || !nodeEl) {
      this._isAnimating = false;
      return;
    }

    const conversations = window.View6Chat?.conversations || {};
    const activeConv = window.View6Chat?.getActiveConversation?.() || '';
    const conversation = conversations[activeConv];

    if (!conversation) {
      console.warn('[NeuralNode] No conversation found for:', activeConv);
      this._isAnimating = false;
      return;
    }

    const steps = conversation.thinkingSequence;
    const finalMsg = conversation.finalMessage;
    const thoughtTrailText = conversation.thoughtTrail || 'Analysing 3D model requirements and generating coordinated geometry.';

    // Move node LEFT
    nodeEl.classList.add('left');
    await sleep(TIMING.nodeMove);
    await sleep(TIMING.pause);

    // Start PULSING
    nodeEl.classList.add('processing');
    this.setStatus('Thinking...');
    await sleep(200);

    // Create thinking container
    const thinkingContainer = document.createElement('div');
    thinkingContainer.className = 'thinking-container';

    const stepsHtml = steps.map(step => buildStepHtml(step)).join('');

    // Collect changed files
    const filesMap = {};
    steps.forEach(step => {
      if (step.filename) {
        if (!filesMap[step.filename]) {
          filesMap[step.filename] = { filename: step.filename, totalChanges: 0 };
        }
        const changeNum = parseInt(step.changes?.replace(/[^0-9]/g, '') || '0');
        filesMap[step.filename].totalChanges += changeNum;
      }
    });
    const changedFiles = Object.values(filesMap);

    const filesListHtml = changedFiles.map(file => {
      const icon = getFileIcon(file.filename);
      return `
        <div class="file-changed-item">
          <span class="file-lang-icon ${icon.class}">${icon.label}</span>
          <span class="file-name">${file.filename}</span>
          <span class="file-changes"><span class="added">+${file.totalChanges}</span></span>
        </div>
      `;
    }).join('');

    const fileCount = changedFiles.length;

    thinkingContainer.innerHTML = `
      <div class="thinking-header">
        <div class="thinking-header-left">
          <div class="pulsing-node"></div>
          <span class="steps-count">0 steps</span>
        </div>
        <div class="steps-toggle">
          <span class="chevron">⌃</span>
        </div>
      </div>
      <ul class="steps-list">
        ${stepsHtml}
      </ul>
      <div class="thought-status">
        <span class="thought-status-text">Thinking...</span>
      </div>
      <div class="thought-trail">
        <div class="thought-trail-header">
          <span class="thought-trail-label">Thought for <span class="thought-duration">0s</span></span>
          <span class="thought-trail-expand">▼</span>
        </div>
        <div class="thought-trail-content">
          <p>${thoughtTrailText}</p>
        </div>
      </div>
    `;

    thinkingContainer.dataset.filesHtml = `
      <div class="files-changed-section visible">
        <div class="files-changed-header">
          <span class="files-changed-count">˅ ${fileCount} File${fileCount !== 1 ? 's' : ''}</span>
          <div class="files-changed-actions">
            <button class="files-action-btn undo-all">Undo all</button>
            <button class="files-action-btn keep-all">Keep All</button>
            <button class="files-action-btn review primary">Review</button>
          </div>
        </div>
        <div class="files-changed-list">
          ${filesListHtml}
        </div>
      </div>
    `;

    chatEl.appendChild(thinkingContainer);
    await sleep(50);
    thinkingContainer.classList.add('visible');
    await sleep(400);
    chatEl.scrollTop = chatEl.scrollHeight;

    const header = thinkingContainer.querySelector('.thinking-header');
    const toggle = thinkingContainer.querySelector('.steps-toggle');
    const stepsList = thinkingContainer.querySelector('.steps-list');
    const stepEls = stepsList.querySelectorAll('li');
    const stepsCount = thinkingContainer.querySelector('.steps-count');

    toggle.classList.add('expanded');
    stepsList.classList.add('expanded');
    await sleep(200);
    chatEl.scrollTop = chatEl.scrollHeight;

    // Reveal steps one by one
    const thoughtStatusText = thinkingContainer.querySelector('.thought-status-text');

    for (let i = 0; i < stepEls.length; i++) {
      const currentStep = steps[i];
      if (thoughtStatusText) thoughtStatusText.textContent = getStatusForStep(currentStep);
      this.setStatus(getStatusForStep(currentStep));

      stepEls[i].classList.add('visible');
      stepEls[i].classList.remove('preview-hidden');

      if (i >= 2) {
        const hideIndex = i - 2;
        if (hideIndex > 0) stepEls[hideIndex].classList.add('preview-hidden');
      }

      stepsCount.textContent = `${i + 1} steps`;
      chatEl.scrollTop = chatEl.scrollHeight;
      await sleep(TIMING.stepReveal);
    }

    // Complete
    const thinkDuration = Date.now() - startTime;
    header.classList.add('done');
    stepsCount.textContent = `${steps.length} steps`;

    thinkingContainer.classList.add('complete');
    const durationEl = thinkingContainer.querySelector('.thought-duration');
    if (durationEl) durationEl.textContent = formatDuration(thinkDuration);

    this.setStatus('Complete.');
    await sleep(500);

    // Collapse
    toggle.classList.remove('expanded');
    stepsList.classList.remove('expanded');
    await sleep(TIMING.collapse);

    // Add bot message
    const botMsg = document.createElement('div');
    botMsg.className = 'demo-msg-bot';
    botMsg.style.opacity = '0';
    botMsg.style.transform = 'translateY(10px)';
    botMsg.style.transition = 'opacity 0.8s ease, transform 0.8s ease';
    botMsg.innerHTML = '<p>' + finalMsg + '</p>';
    chatEl.appendChild(botMsg);
    chatEl.scrollTop = chatEl.scrollHeight;

    await sleep(50);
    botMsg.style.opacity = '1';
    botMsg.style.transform = 'translateY(0)';

    // Files changed section
    if (thinkingContainer.dataset.filesHtml) {
      const filesWrapper = document.createElement('div');
      filesWrapper.innerHTML = thinkingContainer.dataset.filesHtml.replace(
        'class="files-changed-section visible"',
        'class="files-changed-section"'
      );
      const filesSection = filesWrapper.firstElementChild;
      chatEl.appendChild(filesSection);

      await sleep(100);
      filesSection.classList.add('visible');
      await sleep(100);
      chatEl.scrollTop = chatEl.scrollHeight;

      this._attachFileActions(filesSection);
    }

    // Video playback (if gif section exists)
    const gifEl = document.getElementById('gifSectionIndex6');
    if (gifEl) {
      await this._playVideo(gifEl, conversation);
    }

    header.style.cursor = 'pointer';
    await sleep(TIMING.pause);

    // Move node back RIGHT
    nodeEl.classList.remove('left');
    await sleep(TIMING.nodeMove);

    // Stop pulsing
    await sleep(TIMING.pause);
    nodeEl.classList.remove('processing');
    this.setStatus('');

    this._isAnimating = false;
    this._eventBus.emit('neural-workflow-complete');
  }

  /** Set the status text below the neural node. */
  setStatus(text) {
    if (this._statusEl) this._statusEl.textContent = text || '';
  }

  /** Add the 'processing' CSS class (glow + pulse). */
  activate() {
    if (this._nodeEl) this._nodeEl.classList.add('processing');
  }

  /** Remove the 'processing' CSS class. */
  deactivate() {
    if (this._nodeEl) this._nodeEl.classList.remove('processing');
    this.setStatus('');
  }

  // ── Private ─────────────────────────────────────────────────

  _attachFileActions(filesSection) {
    const undoAllBtn = filesSection.querySelector('.files-action-btn.undo-all');
    const keepAllBtn = filesSection.querySelector('.files-action-btn.keep-all');
    const filesActions = filesSection.querySelector('.files-changed-actions');

    if (undoAllBtn) {
      undoAllBtn.addEventListener('click', () => {
        const gifSection = document.getElementById('gifSectionIndex6');
        if (gifSection) {
          const video = gifSection.querySelector('video');
          const poster = gifSection.querySelector('.video-poster');
          if (video) { video.pause(); video.currentTime = 0; video.classList.remove('ready'); }
          if (poster) poster.classList.remove('hidden');
          const revitBox = gifSection.closest('.demo-revit-box');
          if (revitBox?.classList.contains('expanded')) {
            const minBtn = revitBox.querySelector('.demo-titlebar-btn.min');
            if (minBtn) minBtn.click();
          }
        }
        if (filesActions) filesActions.style.display = 'none';
      });
    }

    if (keepAllBtn) {
      keepAllBtn.addEventListener('click', () => {
        if (filesActions) filesActions.style.display = 'none';
      });
    }
  }

  async _playVideo(gifEl, conversation) {
    const revitBox = gifEl.closest('.demo-revit-box');
    if (revitBox) {
      const maxBtn = revitBox.querySelector('.demo-titlebar-btn.max');
      if (maxBtn && !revitBox.classList.contains('expanded')) maxBtn.click();
    }

    await sleep(500);

    const video = gifEl.querySelector('video');
    const img = gifEl.querySelector('img');
    const poster = gifEl.querySelector('.video-poster');

    if (video) {
      video.addEventListener('contextmenu', e => e.preventDefault());

      const conversationVideoSrc = conversation.videoSource;
      if (conversationVideoSrc) {
        try {
          const response = await fetch(conversationVideoSrc);
          const blob = await response.blob();
          video.src = URL.createObjectURL(blob);
        } catch (e) {
          video.src = conversationVideoSrc;
          video.load();
        }
      } else {
        const defaultSource = video.querySelector('source');
        if (defaultSource) video.src = defaultSource.src;
        video.load();
      }

      await sleep(300);
      if (poster) poster.classList.add('hidden');
      video.classList.add('ready');
      video.play();
      video.loop = false;
    } else if (img) {
      const gifSrc = img.src;
      img.src = '';
      img.src = gifSrc;
      await sleep(50);
      img.classList.add('playing');
    }
  }
}
