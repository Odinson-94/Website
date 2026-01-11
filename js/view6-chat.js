/**
 * VIEW 6: 3D Model Chat Controller
 * 
 * Handles:
 * - Conversation switching (Risers, Corridors, Plant Rooms, Clash Detection)
 * - Neural node animation workflow
 * - Thinking/Action step display (per chat-step-strategy.md)
 * - Chat input handling
 */

(function() {
  'use strict';
  
  // ============================================
  // CONFIGURATION
  // ============================================
  
  const TIMING = {
    nodeMove: 400,
    pause: 300,
    stepReveal: 350,
    collapse: 400
  };
  
  // ============================================
  // STATE
  // ============================================
  
  let activeConversation = 'risers';
  let isAnimating = false;
  
  // Track completed state and chat content per conversation (persists until page refresh)
  const conversationStates = {};  // { conversationKey: { completed: bool, chatHTML: string } }
  
  // ============================================
  // CONVERSATION DATA
  // Per chat-step-strategy.md:
  // - Thinking steps: dot icon, no +/-, no filename
  // - Action steps: pencil icon, +/- box, filename
  // ============================================
  
  const conversations = {
    risers: {
      messages: [
        { type: 'bot', text: 'I\'ve analysed the ceiling void data from the architectural model. The void depth is 400mm on Level 1 and 350mm on Level 2.' },
        { type: 'user', text: 'Can we fit all services in that void?' },
        { type: 'bot', text: 'I\'ve stacked the routing classes to eliminate clashes. Ventilation sized to corridor width, containment and pipework coordinated. 8 initial clashes detected and resolved through 3D coordination.' },
        { type: 'user', text: 'What about the tight corridor near the lift?' },
        { type: 'bot', text: 'The 350mm void in Corridor C-04 requires VRF refrigerant pipework to route below the cable tray. Ceiling height remains at 2.4m — above minimum. Ready to convert routing to 3D model?' }
      ],
      thinkingSequence: [
        { text: 'Initiating 3D riser model generation...', type: 'think' },
        { text: 'Loading floor-by-floor routing data.', type: 'think' },
        { text: 'Reading riser shaft dimensions from architectural model.', type: 'think' },
        { text: 'Calculating service stacking order.', type: 'think' },
        { text: 'Applying company standard for riser coordination.', type: 'think' },
        { text: 'Generating 3D riser geometry.', type: 'action', changes: '+1', filename: 'MEP_3D_Model.rvt' },
        { text: 'Placing vertical pipework in risers.', type: 'action', changes: '+86', filename: 'MEP_3D_Model.rvt' },
        { text: 'Placing cable containment in risers.', type: 'action', changes: '+48', filename: 'MEP_3D_Model.rvt' },
        { text: 'Placing ductwork risers.', type: 'action', changes: '+24', filename: 'MEP_3D_Model.rvt' },
        { text: 'Adding floor penetration sleeves.', type: 'action', changes: '+36', filename: 'MEP_3D_Model.rvt' },
        { text: 'Generating riser section views.', type: 'action', changes: '+12', filename: 'Riser_Sections.dwg' },
        { text: '3D riser model complete.', type: 'done' }
      ],
      finalMessage: '3D riser model generated:<br>• <strong>12 riser shafts</strong> modelled with full MEP coordination<br>• <strong>86 pipework risers</strong> placed and sized<br>• <strong>48 containment routes</strong> coordinated<br>• <strong>24 ductwork risers</strong> positioned<br>• Floor penetration sleeves added<br><br>Output saved: <code>MEP_3D_Model.rvt</code>, <code>Riser_Sections.dwg</code>',
      readyPrompt: 'Type <strong>"yes"</strong> or <strong>"proceed"</strong> to generate 3D model',
      thoughtTrail: 'The riser shafts need careful coordination between all MEP services. I\'ll stack services in the optimal order and ensure floor penetrations are correctly positioned.',
      videoSource: 'Videos/View 6 - 3D Model/01-risers.mp4'
    },
    
    corridors: {
      messages: [
        { type: 'user', text: 'Can you generate the corridor sections?' },
        { type: 'bot', text: 'I can see the ceiling void depths vary across corridors. Level 1 has 400mm, Level 2 has 350mm. The tight section near the lift lobby is 300mm. Do you want me to stack services optimally for each zone?' }
      ],
      thinkingSequence: [
        { text: 'Initiating corridor 3D model generation...', type: 'think' },
        { text: 'Loading ceiling void data per zone.', type: 'think' },
        { text: 'Reading corridor routing from 2D layouts.', type: 'think' },
        { text: 'Calculating optimal stacking order per void depth.', type: 'think' },
        { text: 'Zone 1 (400mm): Duct above tray above pipe.', type: 'think' },
        { text: 'Zone 2 (350mm): Flat duct, tray, pipe stacked.', type: 'think' },
        { text: 'Zone 3 (300mm): VRF below tray, reduced duct.', type: 'think' },
        { text: 'Generating 3D corridor geometry.', type: 'action', changes: '+1', filename: 'MEP_3D_Model.rvt' },
        { text: 'Placing horizontal ductwork.', type: 'action', changes: '+186', filename: 'MEP_3D_Model.rvt' },
        { text: 'Placing cable containment routes.', type: 'action', changes: '+124', filename: 'MEP_3D_Model.rvt' },
        { text: 'Placing pipework distribution.', type: 'action', changes: '+98', filename: 'MEP_3D_Model.rvt' },
        { text: 'Adding support brackets.', type: 'action', changes: '+248', filename: 'MEP_3D_Model.rvt' },
        { text: 'Generating corridor section views.', type: 'action', changes: '+8', filename: 'Corridor_Sections.dwg' },
        { text: '3D corridor model complete.', type: 'done' }
      ],
      finalMessage: '3D corridor model generated with optimised stacking:<br>• <strong>186 ductwork elements</strong> placed<br>• <strong>124 containment routes</strong> coordinated<br>• <strong>98 pipework elements</strong> distributed<br>• <strong>248 support brackets</strong> positioned<br>• Void depths respected per zone<br><br>Output saved: <code>MEP_3D_Model.rvt</code>, <code>Corridor_Sections.dwg</code>',
      readyPrompt: 'Type <strong>"yes"</strong> or <strong>"proceed"</strong> to generate corridor 3D',
      thoughtTrail: 'The varying void depths require different stacking strategies. I\'ll optimise the service arrangement for each zone while maintaining accessibility.',
      videoSource: 'Videos/View 6 - 3D Model/02-corridors.mp4'
    },
    
    plantrooms: {
      messages: [
        { type: 'user', text: 'Can you generate the plant room 3D model?' },
        { type: 'bot', text: 'I can see the plant room layouts from the 2D design. Equipment positions, access clearances and maintenance zones are defined. Ready to convert to coordinated 3D?' }
      ],
      thinkingSequence: [
        { text: 'Initiating plant room 3D model generation...', type: 'think' },
        { text: 'Loading plant room layout data.', type: 'think' },
        { text: 'Reading equipment schedules.', type: 'think' },
        { text: 'Checking manufacturer dimensions for major equipment.', type: 'think' },
        { text: 'Verifying access and maintenance clearances.', type: 'think' },
        { text: 'Generating 3D plant room geometry.', type: 'action', changes: '+1', filename: 'MEP_3D_Model.rvt' },
        { text: 'Placing AHU families.', type: 'action', changes: '+4', filename: 'MEP_3D_Model.rvt' },
        { text: 'Placing boiler/chiller equipment.', type: 'action', changes: '+6', filename: 'MEP_3D_Model.rvt' },
        { text: 'Placing pump sets.', type: 'action', changes: '+12', filename: 'MEP_3D_Model.rvt' },
        { text: 'Placing distribution boards and panels.', type: 'action', changes: '+8', filename: 'MEP_3D_Model.rvt' },
        { text: 'Routing pipework headers.', type: 'action', changes: '+86', filename: 'MEP_3D_Model.rvt' },
        { text: 'Routing ductwork connections.', type: 'action', changes: '+48', filename: 'MEP_3D_Model.rvt' },
        { text: 'Adding valve assemblies.', type: 'action', changes: '+64', filename: 'MEP_3D_Model.rvt' },
        { text: 'Generating plant room sections.', type: 'action', changes: '+6', filename: 'Plant_Sections.dwg' },
        { text: '3D plant room model complete.', type: 'done' }
      ],
      finalMessage: '3D plant room model generated:<br>• <strong>4 AHUs</strong> placed with connections<br>• <strong>6 boilers/chillers</strong> positioned<br>• <strong>12 pump sets</strong> with headers<br>• <strong>86 pipework elements</strong> routed<br>• <strong>48 ductwork connections</strong> made<br>• Access clearances verified<br><br>Output saved: <code>MEP_3D_Model.rvt</code>, <code>Plant_Sections.dwg</code>',
      readyPrompt: 'Type <strong>"yes"</strong> or <strong>"proceed"</strong> to generate plant room 3D',
      thoughtTrail: 'The plant room needs careful coordination of major equipment with pipework headers and ductwork connections. Access clearances must be maintained for maintenance.',
      videoSource: 'Videos/View 6 - 3D Model/03-plantrooms.mp4'
    },
    
    clash: {
      messages: [
        { type: 'user', text: 'Can you run clash detection on the 3D model?' },
        { type: 'bot', text: 'I\'ve run an initial clash detection against the structural and architectural models. 47 clashes detected — mostly at beam/duct intersections and riser penetrations. Want me to auto-resolve where possible?' }
      ],
      thinkingSequence: [
        { text: 'Initiating clash detection analysis...', type: 'think' },
        { text: 'Loading structural model for coordination.', type: 'think' },
        { text: 'Loading architectural model.', type: 'think' },
        { text: 'Running MEP vs Structure clash test.', type: 'think' },
        { text: '32 clashes found with structure.', type: 'think' },
        { text: 'Running MEP vs Architecture clash test.', type: 'think' },
        { text: '15 clashes found with architecture.', type: 'think' },
        { text: 'Analysing clash severity and resolution options.', type: 'think' },
        { text: 'Auto-resolving duct routing clashes.', type: 'action', changes: '~24', filename: 'MEP_3D_Model.rvt' },
        { text: 'Auto-resolving pipe routing clashes.', type: 'action', changes: '~12', filename: 'MEP_3D_Model.rvt' },
        { text: 'Flagging structural penetrations for approval.', type: 'action', changes: '+8', filename: 'MEP_3D_Model.rvt' },
        { text: 'Generating clash report.', type: 'action', changes: '+1', filename: 'Clash_Report.pdf' },
        { text: 'Generating void analysis.', type: 'action', changes: '+1', filename: 'Void_Analysis.xlsx' },
        { text: 'Clash resolution complete.', type: 'done' }
      ],
      finalMessage: 'Clash detection and resolution complete:<br>• <strong>47 clashes</strong> detected initially<br>• <strong>36 clashes</strong> auto-resolved (routing adjustments)<br>• <strong>8 clashes</strong> flagged for structural engineer approval<br>• <strong>3 clashes</strong> require design decision<br><br>Output saved: <code>Clash_Report.pdf</code>, <code>Void_Analysis.xlsx</code>',
      readyPrompt: 'Type <strong>"yes"</strong> or <strong>"proceed"</strong> to run clash detection',
      thoughtTrail: 'The clash detection will compare the MEP model against structural and architectural models. Where possible, I\'ll auto-resolve by adjusting routing. Structural penetrations need engineer approval.',
      videoSource: 'Videos/View 6 - 3D Model/04-clash.mp4'
    }
  };
  
  // ============================================
  // UTILITY FUNCTIONS
  // ============================================
  
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
  
  // Format duration as "Xm Ys" or "Xs"
  function formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    }
    return `${seconds}s`;
  }
  
  // Get status text based on step type
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
  
  /**
   * Build step HTML from step object
   * Per chat-step-strategy.md:
   * - think: grey dot, no +/-, no filename
   * - action: pencil icon, +/- in box, filename in light font
   * - done: green check
   */
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
  
  /**
   * Create a thinking container element
   */
  function createThinkingContainer(steps, isCollapsed = false) {
    const container = document.createElement('div');
    container.className = 'thinking-container' + (isCollapsed ? ' visible' : '');
    
    const stepsHtml = steps.map(step => buildStepHtml(step, '')).join('');
    
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
  
  // ============================================
  // NEURAL NODE WORKFLOW
  // Full animation sequence with conversation support
  // ============================================
  
  async function runNeuralNodeWorkflow() {
    if (isAnimating) return;
    isAnimating = true;
    
    const startTime = Date.now();
    
    const els = getElements();
    const chatEl = els.chatMessages;
    const nodeEl = els.persistentNode;
    const gifEl = els.gifSection;
    
    if (!chatEl || !nodeEl) {
      isAnimating = false;
      return;
    }
    
    const conversation = conversations[activeConversation];
    if (!conversation) {
      console.warn('View6Chat: No conversation found for:', activeConversation);
      isAnimating = false;
      return;
    }
    
    const steps = conversation.thinkingSequence;
    const finalMsg = conversation.finalMessage;
    const thoughtTrailText = conversation.thoughtTrail || 'Analysing 3D model requirements and generating coordinated geometry.';
    
    // === STEP 1: Move node LEFT ===
    nodeEl.classList.add('left');
    await sleep(TIMING.nodeMove);
    
    // === STEP 2: PAUSE ===
    await sleep(TIMING.pause);
    
    // === STEP 3: Start PULSING ===
    nodeEl.classList.add('processing');
    await sleep(200);
    
    // === STEP 4: Create thinking container ===
    const thinkingContainer = document.createElement('div');
    thinkingContainer.className = 'thinking-container';
    
    const stepsHtml = steps.map(step => buildStepHtml(step)).join('');
    
    // Extract unique files from steps
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
    
    // Build files list HTML
    const getFileIcon = (filename) => {
      const ext = filename.split('.').pop().toLowerCase();
      const icons = {
        'rvt': { class: 'rvt', label: 'RVT' },
        'dwg': { class: 'dwg', label: 'DWG' },
        'pdf': { class: 'pdf', label: 'PDF' },
        'xlsx': { class: 'xlsx', label: 'XLS' },
        'docx': { class: 'docx', label: 'DOC' }
      };
      return icons[ext] || { class: 'default', label: '◇' };
    };
    
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
    
    // Store files data for later use
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
    
    // Make visible
    await sleep(50);
    thinkingContainer.classList.add('visible');
    await sleep(400);
    chatEl.scrollTop = chatEl.scrollHeight;
    
    // Get elements
    const header = thinkingContainer.querySelector('.thinking-header');
    const toggle = thinkingContainer.querySelector('.steps-toggle');
    const stepsList = thinkingContainer.querySelector('.steps-list');
    const stepEls = stepsList.querySelectorAll('li');
    const stepsCount = thinkingContainer.querySelector('.steps-count');
    
    // Expand
    toggle.classList.add('expanded');
    stepsList.classList.add('expanded');
    await sleep(200);
    chatEl.scrollTop = chatEl.scrollHeight;
    
    // === STEP 5: Reveal steps ONE BY ONE ===
    const thoughtStatusText = thinkingContainer.querySelector('.thought-status-text');
    
    for (let i = 0; i < stepEls.length; i++) {
      const currentStep = steps[i];
      if (thoughtStatusText) {
        thoughtStatusText.textContent = getStatusForStep(currentStep);
      }
      
      stepEls[i].classList.add('visible');
      stepEls[i].classList.remove('preview-hidden');
      
      if (i >= 2) {
        const hideIndex = i - 2;
        if (hideIndex > 0) {
          stepEls[hideIndex].classList.add('preview-hidden');
        }
      }
      
      stepsCount.textContent = `${i + 1} steps`;
      chatEl.scrollTop = chatEl.scrollHeight;
      await sleep(TIMING.stepReveal);
    }
    
    // === STEP 6: Complete ===
    const thinkDuration = Date.now() - startTime;
    header.classList.add('done');
    stepsCount.textContent = `${steps.length} steps`;
    
    thinkingContainer.classList.add('complete');
    const durationEl = thinkingContainer.querySelector('.thought-duration');
    if (durationEl) {
      durationEl.textContent = formatDuration(thinkDuration);
    }
    
    await sleep(500);
    
    // === STEP 7: Collapse ===
    toggle.classList.remove('expanded');
    stepsList.classList.remove('expanded');
    await sleep(TIMING.collapse);
    
    // === STEP 8: Add bot message ===
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
    
    // === STEP 9b: Add files changed section ===
    if (thinkingContainer.dataset.filesHtml) {
      const filesWrapper = document.createElement('div');
      filesWrapper.innerHTML = thinkingContainer.dataset.filesHtml.replace('class="files-changed-section visible"', 'class="files-changed-section"');
      const filesSection = filesWrapper.firstElementChild;
      chatEl.appendChild(filesSection);
      
      await sleep(100);
      filesSection.classList.add('visible');
      
      await sleep(100);
      chatEl.scrollTop = chatEl.scrollHeight;
      
      const undoAllBtn = filesSection.querySelector('.files-action-btn.undo-all');
      const keepAllBtn = filesSection.querySelector('.files-action-btn.keep-all');
      const filesActions = filesSection.querySelector('.files-changed-actions');
      
      if (undoAllBtn) {
        undoAllBtn.addEventListener('click', () => {
          const gifSection = document.getElementById('gifSectionIndex6');
          if (gifSection) {
            const video = gifSection.querySelector('video');
            const poster = gifSection.querySelector('.video-poster');
            if (video) {
              video.pause();
              video.currentTime = 0;
              video.classList.remove('ready');
            }
            if (poster) {
              poster.classList.remove('hidden');
            }
            const revitBox = gifSection.closest('.demo-revit-box');
            if (revitBox && revitBox.classList.contains('expanded')) {
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
    
    // === STEP 9: Maximize window and play video ===
    if (gifEl) {
      const revitBox = gifEl.closest('.demo-revit-box');
      if (revitBox) {
        const maxBtn = revitBox.querySelector('.demo-titlebar-btn.max');
        if (maxBtn && !revitBox.classList.contains('expanded')) {
          maxBtn.click();
        }
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
          if (defaultSource) {
            video.src = defaultSource.src;
          }
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
    
    header.style.cursor = 'pointer';
    
    await sleep(TIMING.pause);
    
    // === STEP 11: Move node RIGHT ===
    nodeEl.classList.remove('left');
    await sleep(TIMING.nodeMove);
    
    // === STEP 12: Stop pulsing ===
    await sleep(TIMING.pause);
    nodeEl.classList.remove('processing');
    
    const els2 = getElements();
    if (els2.chatMessages) {
      initThinkingContainerHandlers(els2.chatMessages);
    }
    
    isAnimating = false;
  }
  
  // ============================================
  // CONVERSATION LOADING
  // ============================================
  
  function loadConversation(conversationKey) {
    const els = getElements();
    const chatEl = els.chatMessages;
    
    if (!chatEl) {
      console.warn('View6Chat: chatMessagesIndex6 not found');
      return;
    }
    
    const conversation = conversations[conversationKey];
    if (!conversation) {
      console.warn('View6Chat: conversation not found for:', conversationKey);
      return;
    }
    
    if (activeConversation && !conversationStates[activeConversation]?.completed) {
      conversationStates[activeConversation] = {
        completed: false,
        chatHTML: chatEl.innerHTML
      };
    }
    
    activeConversation = conversationKey;
    
    const savedState = conversationStates[conversationKey];
    if (savedState && savedState.chatHTML) {
      chatEl.innerHTML = savedState.chatHTML;
      chatEl.scrollTop = chatEl.scrollHeight;
      initThinkingContainerHandlers(chatEl);
      return;
    }
    
    chatEl.innerHTML = '';
    
    conversation.messages.forEach(msg => {
      if (msg.type === 'thinking') {
        const container = createThinkingContainer(msg.steps, true);
        chatEl.appendChild(container);
      } else {
        const msgDiv = document.createElement('div');
        msgDiv.className = msg.type === 'user' ? 'demo-msg-user' : 'demo-msg-bot';
        msgDiv.innerHTML = '<p>' + msg.text + '</p>';
        chatEl.appendChild(msgDiv);
      }
    });
    
    initThinkingContainerHandlers(chatEl);
    
    const promptDiv = document.createElement('div');
    promptDiv.className = 'demo-ready-prompt';
    promptDiv.innerHTML = '<span>' + conversation.readyPrompt + '</span>';
    chatEl.appendChild(promptDiv);
    
    chatEl.scrollTop = chatEl.scrollHeight;
  }
  
  // ============================================
  // CHAT INPUT HANDLING
  // ============================================
  
  function addMessageWithAnimation(chatEl, className, html) {
    const msg = document.createElement('div');
    msg.className = className;
    msg.style.opacity = '0';
    msg.style.transform = 'translateY(10px)';
    msg.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
    msg.innerHTML = html;
    chatEl.appendChild(msg);
    
    requestAnimationFrame(() => {
      msg.style.opacity = '1';
      msg.style.transform = 'translateY(0)';
    });
    
    return msg;
  }
  
  async function handleChatSend(e) {
    if (e) {
      e.stopImmediatePropagation();
      e.preventDefault();
    }
    
    if (isAnimating) return;
    
    const els = getElements();
    const inputEl = els.chatInput;
    const chatEl = els.chatMessages;
    
    if (!inputEl || !chatEl) return;
    
    const rawInput = inputEl.value !== undefined ? inputEl.value : inputEl.textContent;
    const input = rawInput.trim().toLowerCase();
    if (!input) return;
    
    addMessageWithAnimation(chatEl, 'demo-msg-user', '<p>' + rawInput.trim() + '</p>');
    
    if (inputEl.value !== undefined) {
      inputEl.value = '';
    } else {
      inputEl.textContent = '';
    }
    
    const readyPrompt = chatEl.querySelector('.demo-ready-prompt');
    if (readyPrompt) readyPrompt.remove();
    
    chatEl.scrollTop = chatEl.scrollHeight;
    
    if (input === 'yes' || input === 'proceed' || input === 'y' || input === 'ok') {
      if (conversationStates[activeConversation]?.completed) {
        await sleep(300);
        addMessageWithAnimation(chatEl, 'demo-msg-bot', '<p>I\'m sorry, this 3D model has already been generated. Please select a different system from the history.</p>');
        chatEl.scrollTop = chatEl.scrollHeight;
        return;
      }
      
      await runNeuralNodeWorkflow();
      
      conversationStates[activeConversation] = {
        completed: true,
        chatHTML: chatEl.innerHTML
      };
    } else {
      await sleep(300);
      addMessageWithAnimation(chatEl, 'demo-msg-bot', '<p>Please type "yes" or "proceed" to generate the 3D model.</p>');
      chatEl.scrollTop = chatEl.scrollHeight;
    }
  }
  
  // ============================================
  // INITIALIZATION
  // ============================================
  
  function init() {
    // History item clicks - conversation switching
    document.addEventListener('click', function(e) {
      const historyItem = e.target.closest('#chatHistoryIndex6 .demo-history-item');
      if (!historyItem) return;
      
      document.querySelectorAll('#chatHistoryIndex6 .demo-history-item').forEach(i => i.classList.remove('active'));
      historyItem.classList.add('active');
      
      const system = historyItem.getAttribute('data-system') || historyItem.getAttribute('data-conversation');
      if (system && conversations[system]) {
        loadConversation(system);
      }
    });
    
    // Send button click
    document.addEventListener('click', function(e) {
      if (e.target.closest('#chatSendIndex6')) {
        handleChatSend(e);
      }
    });
    
    // Enter key in input
    document.addEventListener('keydown', function(e) {
      const inputEl = document.getElementById('chatInputIndex6');
      if (e.key === 'Enter' && !e.shiftKey && document.activeElement === inputEl) {
        e.preventDefault();
        handleChatSend(e);
      }
    });
    
    initThinkingContainerHandlers(document.getElementById('chatMessagesIndex6'));
  }
  
  let thinkingDelegationInitialized = false;
  
  function initThinkingContainerHandlers(parentEl) {
    if (!parentEl) return;
    
    parentEl.querySelectorAll('.thinking-container .thinking-header').forEach(header => {
      header.style.cursor = 'pointer';
    });
    
    if (!thinkingDelegationInitialized) {
      thinkingDelegationInitialized = true;
      
      document.addEventListener('click', function(e) {
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
      
      document.addEventListener('click', function(e) {
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
  
  // Chat sidebar resize handle for View 6
  function initResizeHandler() {
    const chatSidebarResize = document.querySelector('#modellingOverlay .chat-sidebar-resize');
    if (chatSidebarResize) {
      let isResizingChat = false;
      let startX = 0;
      let startSidebarWidth = 0;
      
      chatSidebarResize.addEventListener('mousedown', (e) => {
        isResizingChat = true;
        startX = e.clientX;
        const sidebar = chatSidebarResize.previousElementSibling;
        if (sidebar) {
          startSidebarWidth = sidebar.offsetWidth;
        }
        document.body.style.cursor = 'ew-resize';
        document.body.style.userSelect = 'none';
        e.preventDefault();
      });
      
      document.addEventListener('mousemove', (e) => {
        if (!isResizingChat) return;
        const sidebar = chatSidebarResize.previousElementSibling;
        if (sidebar) {
          const deltaX = e.clientX - startX;
          const newWidth = Math.max(120, Math.min(400, startSidebarWidth + deltaX));
          sidebar.style.width = newWidth + 'px';
          sidebar.style.flex = 'none';
        }
      });
      
      document.addEventListener('mouseup', () => {
        if (isResizingChat) {
          isResizingChat = false;
          document.body.style.cursor = '';
          document.body.style.userSelect = '';
        }
      });
    }
  }
  
  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { init(); initResizeHandler(); });
  } else {
    init();
    initResizeHandler();
  }
  
  // Expose for external access if needed
  window.View6Chat = {
    loadConversation: loadConversation,
    getActiveConversation: function() { return activeConversation; },
    conversations: conversations
  };
  
})();

