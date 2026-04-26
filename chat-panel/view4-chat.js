/**
 * VIEW 4: Floorplan MEP Chat Controller
 * 
 * Handles:
 * - Conversation switching (Drainage, Water Services, etc.)
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
  
  let activeConversation = 'drainage';
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
    drainage: {
      messages: [
        { type: 'user', text: 'Can you design the drainage system?' },
        { type: 'bot', text: 'Of course, let me check the rooms.' },
        { type: 'thinking', steps: [
          { text: 'Finding rooms...', type: 'think' },
          { text: '24 rooms found.', type: 'think' },
          { text: 'Checking number of outlets.', type: 'think' },
          { text: 'Checking for further drainage requirements.', type: 'think' },
          { text: 'Reading specification.', type: 'think' },
          { text: 'Calculating condensate connection requirements.', type: 'think' },
          { text: 'Looking for civil pop up information...', type: 'think' },
          { text: 'Stopped — awaiting civil data.', type: 'done' }
        ]},
        { type: 'bot', text: 'Do you have civil engineering information?' },
        { type: 'user', text: 'Yes, sorry just added to the folder now.' },
        { type: 'thinking', steps: [
          { text: 'Continuing.', type: 'think' },
          { text: 'Reading civil drawings.', type: 'think' },
          { text: 'Pop up locations found — different to requirements.', type: 'think' },
          { text: 'Placing pop ups on drawing.', type: 'action', changes: '+366', filename: 'drainage-layout.rvt' },
          { text: 'Done.', type: 'done' }
        ]},
        { type: 'bot', text: 'Can you check to see if you are happy? If happy, type yes or proceed to continue.' }
      ],
      thinkingSequence: [
        { text: 'Thinking...', type: 'think' },
        { text: 'Placing branch pipes and outlet positions.', type: 'action', changes: '+48', filename: 'drainage-layout.rvt' },
        { text: 'Designing in 3D.', type: 'action', changes: '+156', filename: 'drainage-layout.rvt' },
        { text: 'Forecasting clashes.', type: 'think' },
        { text: 'Rerouting pipes to avoid clashes.', type: 'action', changes: '+24', filename: 'drainage-layout.rvt' },
        { text: 'Done.', type: 'done' }
      ],
      finalMessage: 'Designed and added note on primary ventilation in compliance with BS EN 12056 & Approved Document H. Note: I have marked the SVPs that weren\'t on the civil engineering information with a hazard symbol — please send this drawing to the civil engineer for confirmation.',
      readyPrompt: 'Type <strong>"yes"</strong> or <strong>"proceed"</strong> to generate drainage layout'
    },
    
    water: {
      messages: [
        { type: 'user', text: 'Can you design the cold and hot water system?' },
        { type: 'bot', text: 'Of course, let me check the requirements and site constraints.' },
        { type: 'thinking', steps: [
          { text: 'Reading specification...', type: 'think' },
          { text: 'Checking building location.', type: 'think' },
          { text: 'Analysing local utility provider constraints.', type: 'think' },
          { text: 'Understanding incoming water pressure — 2.1 bar static.', type: 'think' },
          { text: 'Calculating pressure requirements for upper floors.', type: 'think' },
          { text: 'Booster set required — pressure insufficient above Level 3.', type: 'think' },
          { text: 'Checking water hardness data — 285 ppm (hard water zone).', type: 'think' },
          { text: 'Water softener required as per specification.', type: 'think' },
          { text: 'Reading BS EN 806 requirements.', type: 'think' },
          { text: 'Analysis complete — awaiting confirmation.', type: 'done' }
        ]},
        { type: 'bot', text: 'Based on my analysis:<br>• <strong>Incoming pressure</strong>: 2.1 bar static (insufficient for upper floors)<br>• <strong>Booster set</strong>: Required for Levels 3+<br>• <strong>Water hardness</strong>: 285 ppm — softener required per spec<br>• <strong>Standard</strong>: BS EN 806 compliance<br><br>Shall I proceed with the design?' },
        { type: 'user', text: 'Yes, proceed.' },
        { type: 'thinking', steps: [
          { text: 'Continuing.', type: 'think' },
          { text: 'Reading room schedule for outlet requirements.', type: 'think' },
          { text: 'Identifying point-of-use water heater locations.', type: 'think' },
          { text: 'Placing cold water outlets.', type: 'action', changes: '+186', filename: 'water-services.rvt' },
          { text: 'Placing hot water outlets.', type: 'action', changes: '+142', filename: 'water-services.rvt' },
          { text: 'Adding point-of-use water heaters (as spec).', type: 'action', changes: '+24', filename: 'water-services.rvt' },
          { text: 'Placing booster set in plantroom.', type: 'action', changes: '+8', filename: 'water-services.rvt' },
          { text: 'Placing water softener in plantroom.', type: 'action', changes: '+4', filename: 'water-services.rvt' },
          { text: 'Done.', type: 'done' }
        ]},
        { type: 'bot', text: 'Water outlets placed. Ready to route pipework and generate calculations?' }
      ],
      thinkingSequence: [
        { text: 'Thinking...', type: 'think' },
        { text: 'Calculating pipe sizes based on loading units.', type: 'think' },
        { text: 'Routing cold water mains from intake.', type: 'action', changes: '+486', filename: 'water-services.rvt' },
        { text: 'Routing hot water distribution pipework.', type: 'action', changes: '+324', filename: 'water-services.rvt' },
        { text: 'Checking dead legs compliance.', type: 'think' },
        { text: 'Generating calculation report.', type: 'think' },
        { text: 'Saving calculations to folder.', type: 'action', changes: '+1', filename: 'Water_Calcs_BS-EN-806.pdf' },
        { text: 'Done.', type: 'done' }
      ],
      finalMessage: 'Water services design complete:<br>• <strong>186</strong> cold water outlets placed<br>• <strong>142</strong> hot water outlets placed<br>• <strong>24</strong> point-of-use water heaters (per specification)<br>• <strong>Booster set</strong> and <strong>softener</strong> positioned in plantroom<br>• Pipework routed in 3D with clash avoidance<br>• Calculations saved: <code>Water_Calcs_BS-EN-806.pdf</code><br><br>Design complies with BS EN 806. Ready for review.',
      readyPrompt: 'Type <strong>"yes"</strong> or <strong>"proceed"</strong> to route pipework'
    },
    
    heating: {
      messages: [
        { type: 'user', text: 'Can you design the heating and cooling system?' },
        { type: 'bot', text: 'Of course, let me check the requirements and system strategy.' },
        { type: 'thinking', steps: [
          { text: 'Reading specification...', type: 'think' },
          { text: 'Checking heating strategy — Daikin VRF system.', type: 'think' },
          { text: 'Checking cooling strategy — Daikin VRF ducted units.', type: 'think' },
          { text: 'Panel heaters specified for corridors.', type: 'think' },
          { text: 'Ducted FCUs to BCO standard for office areas.', type: 'think' },
          { text: 'VRF outdoor condensers required on roof.', type: 'think' },
          { text: 'Locating riser positions.', type: 'think' },
          { text: 'Finding design temperatures from specification.', type: 'think' },
          { text: 'Heating setpoint: 21°C winter.', type: 'think' },
          { text: 'Cooling setpoint: 24°C summer.', type: 'think' },
          { text: 'Looking for thermal model...', type: 'think' },
          { text: 'Thermal model not found — cannot size equipment.', type: 'error' }
        ]},
        { type: 'bot', text: 'I\'ve found the system requirements but there\'s no thermal model available. I need heating and cooling loads to size the equipment correctly.<br><br>Would you like me to run the <strong>IESVE</strong> calculations?' },
        { type: 'user', text: 'Yes, proceed.' },
        { type: 'thinking', steps: [
          { text: 'Opening IESVE...', type: 'think' },
          { text: 'Building thermal model from Revit geometry.', type: 'action', changes: '+1', filename: 'hvac-model.aps' },
          { text: 'Adding weather templates — London TRY.', type: 'action', changes: '+1', filename: 'hvac-model.aps' },
          { text: 'Adding construction templates.', type: 'action', changes: '+48', filename: 'hvac-model.aps' },
          { text: 'Adding internal gains profiles.', type: 'action', changes: '+24', filename: 'hvac-model.aps' },
          { text: 'Setting room data temperatures per zone.', type: 'action', changes: '+186', filename: 'hvac-model.aps' },
          { text: 'Running heating load simulations...', type: 'think' },
          { text: 'Running cooling load simulations...', type: 'think' },
          { text: 'Running overheating analysis (TM52)...', type: 'think' },
          { text: 'Generating thermal report.', type: 'action', changes: '+1', filename: 'Thermal_Report.pdf' },
          { text: 'Downloading results to project folder.', type: 'action', changes: '+1', filename: 'Thermal_Report.pdf' },
          { text: 'Parsing thermal data...', type: 'think' },
          { text: 'Extracting zone heating loads.', type: 'think' },
          { text: 'Extracting zone cooling loads.', type: 'think' },
          { text: 'Adding loads to zone information.', type: 'action', changes: '+186', filename: 'heating-cooling.rvt' },
          { text: 'Thermal analysis complete.', type: 'done' }
        ]},
        { type: 'bot', text: 'Thermal analysis complete. I\'ve extracted the heating and cooling loads for all zones and added them to the model.<br><br>Ready to proceed with equipment sizing and layout?' }
      ],
      thinkingSequence: [
        { text: 'Continuing.', type: 'think' },
        { text: 'Reading zone information from thermal model.', type: 'think' },
        { text: 'Calculating equipment capacities.', type: 'think' },
        { text: 'Sizing ducted fan coil units.', type: 'think' },
        { text: 'Sizing heater batteries.', type: 'think' },
        { text: 'Sizing panel heaters for corridors.', type: 'think' },
        { text: 'Sizing VRF outdoor condensers.', type: 'think' },
        { text: 'Placing ducted FCUs in BCO zones.', type: 'action', changes: '+86', filename: 'heating-cooling.rvt' },
        { text: 'Placing heater batteries.', type: 'action', changes: '+12', filename: 'heating-cooling.rvt' },
        { text: 'Placing panel heaters in corridors.', type: 'action', changes: '+34', filename: 'heating-cooling.rvt' },
        { text: 'Placing VRF outdoor condensers on roof.', type: 'action', changes: '+6', filename: 'heating-cooling.rvt' },
        { text: 'Routing refrigerant pipework in 3D.', type: 'action', changes: '+892', filename: 'heating-cooling.rvt' },
        { text: 'Sizing refrigerant pipework to Daikin guidelines.', type: 'think' },
        { text: 'Placing cable tray routes.', type: 'action', changes: '+248', filename: 'heating-cooling.rvt' },
        { text: 'Placing condensate drainage routes.', type: 'action', changes: '+124', filename: 'heating-cooling.rvt' },
        { text: 'Placing local controllers.', type: 'action', changes: '+86', filename: 'heating-cooling.rvt' },
        { text: 'Adding specification notes.', type: 'action', changes: '+24', filename: 'heating-cooling.rvt' },
        { text: 'Generating schedules.', type: 'think' },
        { text: 'Schedules exported.', type: 'action', changes: '+4', filename: 'heating-cooling.rvt' },
        { text: 'Done.', type: 'done' }
      ],
      finalMessage: 'Heating & cooling design complete:<br>• <strong>86</strong> ducted fan coil units sized and placed (BCO compliant)<br>• <strong>12</strong> heater batteries placed<br>• <strong>34</strong> panel heaters in corridors<br>• <strong>6</strong> VRF outdoor condensers on roof<br>• Refrigerant pipework routed and sized to Daikin guidelines<br>• Cable tray and condensate drainage placed<br>• Local controllers at each indoor unit<br>• Schedules exported<br><br>Design ready for review.',
      readyPrompt: 'Type <strong>"yes"</strong> or <strong>"proceed"</strong> to generate heating and cooling layout'
    },
    
    ventilation: {
      messages: [
        { type: 'user', text: 'Can you design the ventilation system?' },
        { type: 'bot', text: 'Yes, let me check the requirements.' },
        { type: 'thinking', steps: [
          { text: 'Reading room requirements.', type: 'think' },
          { text: 'Vent calculations found from heating and cooling forecast.', type: 'think' },
          { text: 'Checking.', type: 'think' },
          { text: 'All good — all compliant.', type: 'think' },
          { text: 'Now checking for fan coil units.', type: 'think' },
          { text: 'Ducted units found.', type: 'think' },
          { text: 'Checking for lights.', type: 'think' },
          { text: 'Lighting calculations carried out to client selection.', type: 'think' },
          { text: 'Positions forecasted to avoid clashes.', type: 'think' },
          { text: 'Fire alarm positions determined.', type: 'think' },
          { text: 'PIRs determined.', type: 'think' },
          { text: 'RCP built.', type: 'action', changes: '+1', filename: 'ventilation-layout.rvt' },
          { text: 'Check for clashes.', type: 'think' },
          { text: 'No clashes.', type: 'think' },
          { text: 'Check for rules.', type: 'think' },
          { text: 'Fire alarm next to grille — moved.', type: 'action', changes: '+1', filename: 'ventilation-layout.rvt' },
          { text: 'Check for rules.', type: 'think' },
          { text: 'No more rule violations.', type: 'think' },
          { text: 'Grille positions determined.', type: 'think' },
          { text: 'Ducts connected to fan coil units.', type: 'action', changes: '+86', filename: 'ventilation-layout.rvt' },
          { text: 'Stopped — awaiting confirmation.', type: 'done' }
        ]},
        { type: 'bot', text: 'Do you want to put fresh air to the rear of the fan coils?' }
      ],
      thinkingSequence: [
        { text: 'Ok.', type: 'think' },
        { text: 'Ductwork drawn out.', type: 'action', changes: '+342', filename: 'ventilation-layout.rvt' },
        { text: 'Size system called.', type: 'think' },
        { text: 'Tagged.', type: 'action', changes: '+86', filename: 'ventilation-layout.rvt' },
        { text: 'Flow rates assigned.', type: 'action', changes: '+86', filename: 'ventilation-layout.rvt' },
        { text: 'System sized.', type: 'think' },
        { text: 'VCDs added.', type: 'action', changes: '+24', filename: 'ventilation-layout.rvt' },
        { text: 'Fire dampers added.', type: 'action', changes: '+18', filename: 'ventilation-layout.rvt' },
        { text: 'Attenuators sized and added.', type: 'action', changes: '+12', filename: 'ventilation-layout.rvt' },
        { text: 'Notes added.', type: 'action', changes: '+8', filename: 'ventilation-layout.rvt' },
        { text: 'Schedules exported.', type: 'action', changes: '+4', filename: 'ventilation-layout.rvt' },
        { text: 'Done.', type: 'done' }
      ],
      finalMessage: 'I referenced the grilles to the fan coil units, and the fan coil units to the BCO zones. If you would like to check over and confirm, we can do the next level. Or if you have any changes to preference, I will learn your preferences and action it for the upper floors.',
      readyPrompt: 'Type <strong>"yes"</strong> or <strong>"proceed"</strong> to add fresh air'
    },
    
    controls: {
      messages: [
        { type: 'user', text: 'Can you set up the controls strategy?' },
        { type: 'bot', text: 'Of course, let me analyse the BMS requirements.' },
        { type: 'thinking', steps: [
          { text: 'Reading controls specification.', type: 'think' },
          { text: 'Identifying BMS points from mechanical equipment.', type: 'think' },
          { text: '847 control points identified.', type: 'think' },
          { text: 'Allocating points to outstations.', type: 'think' },
          { text: 'Done.', type: 'done' }
        ]},
        { type: 'bot', text: 'BMS points identified. Ready to generate the controls schedule?' }
      ],
      thinkingSequence: [
        { text: 'Thinking...', type: 'think' },
        { text: 'Generating points schedule.', type: 'action', changes: '+1', filename: 'BMS_Points_Schedule.xlsx' },
        { text: 'Creating cause and effect matrix.', type: 'action', changes: '+1', filename: 'Cause_Effect_Matrix.xlsx' },
        { text: 'Done.', type: 'done' }
      ],
      finalMessage: 'Controls strategy complete. 847 BMS points scheduled across HVAC, lighting and metering. Cause and effect matrix generated for life safety interfaces.',
      readyPrompt: 'Type <strong>"yes"</strong> or <strong>"proceed"</strong> to generate controls schedule'
    },
    
    containment: {
      messages: [
        { type: 'user', text: 'Can you design the containment routes?' },
        { type: 'bot', text: 'Of course, let me check the requirements.' },
        { type: 'thinking', steps: [
          { text: 'Reading containment specification.', type: 'think' },
          { text: 'Checking cable tray requirements.', type: 'think' },
          { text: 'Identifying riser positions.', type: 'think' },
          { text: 'Done.', type: 'done' }
        ]},
        { type: 'bot', text: 'Requirements identified. Ready to route containment?' }
      ],
      thinkingSequence: [
        { text: 'Routing cable tray.', type: 'action', changes: '+186', filename: 'containment.rvt' },
        { text: 'Done.', type: 'done' }
      ],
      finalMessage: 'Containment routes designed.',
      readyPrompt: 'Type <strong>"yes"</strong> or <strong>"proceed"</strong> to route containment'
    },
    
    power: {
      messages: [
        { type: 'user', text: 'Can you design the power distribution?' },
        { type: 'bot', text: 'Of course, let me check the requirements.' },
        { type: 'thinking', steps: [
          { text: 'Reading electrical specification.', type: 'think' },
          { text: 'Checking load schedule.', type: 'think' },
          { text: 'Identifying distribution board locations.', type: 'think' },
          { text: 'Done.', type: 'done' }
        ]},
        { type: 'bot', text: 'Requirements identified. Ready to design power distribution?' }
      ],
      thinkingSequence: [
        { text: 'Placing distribution boards.', type: 'action', changes: '+24', filename: 'power.rvt' },
        { text: 'Done.', type: 'done' }
      ],
      finalMessage: 'Power distribution designed.',
      readyPrompt: 'Type <strong>"yes"</strong> or <strong>"proceed"</strong> to design power'
    },
    
    lighting: {
      messages: [
        { type: 'user', text: 'Can you design the lighting layout?' },
        { type: 'bot', text: 'Of course, let me check the requirements.' },
        { type: 'thinking', steps: [
          { text: 'Reading lighting specification.', type: 'think' },
          { text: 'Checking lux level requirements.', type: 'think' },
          { text: 'Identifying luminaire types.', type: 'think' },
          { text: 'Done.', type: 'done' }
        ]},
        { type: 'bot', text: 'Requirements identified. Ready to place luminaires?' }
      ],
      thinkingSequence: [
        { text: 'Placing luminaires.', type: 'action', changes: '+248', filename: 'lighting.rvt' },
        { text: 'Done.', type: 'done' }
      ],
      finalMessage: 'Lighting layout designed.',
      readyPrompt: 'Type <strong>"yes"</strong> or <strong>"proceed"</strong> to place luminaires'
    },
    
    firealarms: {
      messages: [
        { type: 'user', text: 'Can you design the fire alarm system?' },
        { type: 'bot', text: 'Of course, let me check the requirements.' },
        { type: 'thinking', steps: [
          { text: 'Reading fire alarm specification.', type: 'think' },
          { text: 'Checking zone requirements.', type: 'think' },
          { text: 'Identifying device types.', type: 'think' },
          { text: 'Done.', type: 'done' }
        ]},
        { type: 'bot', text: 'Requirements identified. Ready to place fire alarm devices?' }
      ],
      thinkingSequence: [
        { text: 'Placing detectors.', type: 'action', changes: '+186', filename: 'fire-alarms.rvt' },
        { text: 'Done.', type: 'done' }
      ],
      finalMessage: 'Fire alarm system designed.',
      readyPrompt: 'Type <strong>"yes"</strong> or <strong>"proceed"</strong> to place devices'
    },
    
    security: {
      messages: [
        { type: 'user', text: 'Can you design the security and access control system?' },
        { type: 'bot', text: 'Of course, let me check the requirements.' },
        { type: 'thinking', steps: [
          { text: 'Reading security specification.', type: 'think' },
          { text: 'Checking access control requirements.', type: 'think' },
          { text: 'Identifying reader positions.', type: 'think' },
          { text: 'Done.', type: 'done' }
        ]},
        { type: 'bot', text: 'Requirements identified. Ready to place security devices?' }
      ],
      thinkingSequence: [
        { text: 'Placing access readers.', type: 'action', changes: '+48', filename: 'security.rvt' },
        { text: 'Done.', type: 'done' }
      ],
      finalMessage: 'Security and access control system designed.',
      readyPrompt: 'Type <strong>"yes"</strong> or <strong>"proceed"</strong> to place devices'
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
      chatMessages: document.getElementById('chatMessagesIndex4'),
      persistentNode: document.getElementById('chatPersistentNodeIndex4'),
      gifSection: document.getElementById('gifSectionIndex4'),
      chatInput: document.getElementById('chatInputIndex4'),
      chatSend: document.getElementById('chatSendIndex4')
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
        return 'Placing objects...';
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
      const changeClass = step.changes.startsWith('-') ? 'removed' : 'added';
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
    
    // For collapsed (static history), steps start hidden. For animated, steps start hidden too.
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
    
    // Add click handler for expand/collapse (toggle full view)
    const header = container.querySelector('.thinking-header');
    const toggle = container.querySelector('.steps-toggle');
    const stepsList = container.querySelector('.steps-list');
    
    header.style.cursor = 'pointer';
    header.dataset.clickInitialized = 'true'; // Mark as initialized to prevent duplicate handlers
    header.addEventListener('click', function() {
      toggle.classList.toggle('expanded');
      stepsList.classList.toggle('expanded');
      stepsList.classList.toggle('fully-expanded');
      // When expanding collapsed container, show all steps
      stepsList.querySelectorAll('li').forEach(li => li.classList.add('visible'));
    });
    
    return container;
  }
  
  // ============================================
  // NEURAL NODE WORKFLOW
  // Full animation sequence with conversation support
  // ============================================
  
  async function runNeuralNodeWorkflow() {
    if (isAnimating) return;
    isAnimating = true;
    
    // Track start time for duration
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
      console.warn('View4Chat: No conversation found for:', activeConversation);
      isAnimating = false;
      return;
    }
    
    const steps = conversation.thinkingSequence;
    const finalMsg = conversation.finalMessage;
    
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
    
    // Extract unique files from steps that have filenames, and sum up their changes
    const filesMap = {};
    steps.forEach(step => {
      if (step.filename) {
        if (!filesMap[step.filename]) {
          filesMap[step.filename] = { filename: step.filename, totalChanges: 0 };
        }
        // Parse changes like "+366" to get number
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
        'docx': { class: 'docx', label: 'DOC' },
        'js': { class: 'js', label: 'JS' },
        'html': { class: 'html', label: '◇' },
        'css': { class: 'css', label: 'CSS' }
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
          <p>I need to look at the civil information, room requirements and british standards for the up to date version. I need to make sure SVPs fit inside the boxing.</p>
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
    await sleep(400); // Wait for max-height transition to complete
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
    
    // === STEP 5: Reveal steps ONE BY ONE (show first, previous, current only) ===
    // Get the shiny status text inside the thinking container
    const thoughtStatusText = thinkingContainer.querySelector('.thought-status-text');
    
    for (let i = 0; i < stepEls.length; i++) {
      // Update shiny status based on current step type
      const currentStep = steps[i];
      if (thoughtStatusText) {
        thoughtStatusText.textContent = getStatusForStep(currentStep);
      }
      
      // Show current step
      stepEls[i].classList.add('visible');
      stepEls[i].classList.remove('preview-hidden');
      
      // Hide middle steps (keep first and previous visible)
      // First step (i=0) is never hidden
      // Previous step (i-1) stays visible
      // Older steps (i-2 and earlier, except first) get hidden
      if (i >= 2) {
        // Hide step i-2 (unless it's the first step)
        const hideIndex = i - 2;
        if (hideIndex > 0) {
          stepEls[hideIndex].classList.add('preview-hidden');
        }
      }
      
      // Count UP from 1 to total
      stepsCount.textContent = `${i + 1} steps`;
      chatEl.scrollTop = chatEl.scrollHeight;
      await sleep(TIMING.stepReveal);
    }
    
    // === STEP 6: Complete ===
    const thinkDuration = Date.now() - startTime;
    header.classList.add('done');
    stepsCount.textContent = `${steps.length} steps`;
    
    // Hide shiny status, show grey thought trail with duration
    thinkingContainer.classList.add('complete');
    const durationEl = thinkingContainer.querySelector('.thought-duration');
    if (durationEl) {
      durationEl.textContent = formatDuration(thinkDuration);
    }
    
    // Add click handler for thought trail expand
    const thoughtTrail = thinkingContainer.querySelector('.thought-trail');
    const thoughtHeader = thinkingContainer.querySelector('.thought-trail-header');
    if (thoughtTrail && thoughtHeader) {
      thoughtHeader.addEventListener('click', () => {
        thoughtTrail.classList.toggle('expanded');
        // Don't scroll - let user read in place
      });
    }
    
    await sleep(500);
    
    // === STEP 7: Collapse ===
    toggle.classList.remove('expanded');
    stepsList.classList.remove('expanded');
    await sleep(TIMING.collapse);
    
    // === STEP 8: Add bot message with smooth fade-in (BEFORE video to reduce GPU load) ===
    const botMsg = document.createElement('div');
    botMsg.className = 'demo-msg-bot';
    botMsg.style.opacity = '0';
    botMsg.style.transform = 'translateY(10px)';
    botMsg.style.transition = 'opacity 0.8s ease, transform 0.8s ease';
    botMsg.innerHTML = '<p>' + finalMsg + '</p>';
    chatEl.appendChild(botMsg);
    chatEl.scrollTop = chatEl.scrollHeight;
    
    // Trigger animation
    await sleep(50);
    botMsg.style.opacity = '1';
    botMsg.style.transform = 'translateY(0)';
    
    // === STEP 9b: Add files changed section below the message ===
    if (thinkingContainer.dataset.filesHtml) {
      const filesWrapper = document.createElement('div');
      filesWrapper.innerHTML = thinkingContainer.dataset.filesHtml.replace('class="files-changed-section visible"', 'class="files-changed-section"');
      const filesSection = filesWrapper.firstElementChild;
      chatEl.appendChild(filesSection);
      
      // Wait for DOM update, then trigger animation
      await sleep(100);
      filesSection.classList.add('visible');
      
      // Scroll to show full files section
      await sleep(100);
      chatEl.scrollTop = chatEl.scrollHeight;
      
      // Add click handlers for files changed buttons
      const undoAllBtn = filesSection.querySelector('.files-action-btn.undo-all');
      const keepAllBtn = filesSection.querySelector('.files-action-btn.keep-all');
      const filesActions = filesSection.querySelector('.files-changed-actions');
      
      if (undoAllBtn) {
        undoAllBtn.addEventListener('click', () => {
          // Reset video back to poster image state
          const gifSection = document.getElementById('gifSectionIndex4');
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
            // Minimize the revit box if expanded
            const revitBox = gifSection.closest('.demo-revit-box');
            if (revitBox && revitBox.classList.contains('expanded')) {
              const minBtn = revitBox.querySelector('.demo-titlebar-btn.min');
              if (minBtn) minBtn.click();
            }
          }
          // Hide the actions
          if (filesActions) filesActions.style.display = 'none';
        });
      }
      
      if (keepAllBtn) {
        keepAllBtn.addEventListener('click', () => {
          // Just hide the action buttons
          if (filesActions) filesActions.style.display = 'none';
        });
      }
    }
    
    // === STEP 9: Maximize window and play video (AFTER message to reduce GPU load) ===
    if (gifEl) {
      const revitBox = gifEl.closest('.demo-revit-box');
      if (revitBox) {
        const maxBtn = revitBox.querySelector('.demo-titlebar-btn.max');
        if (maxBtn && !revitBox.classList.contains('expanded')) {
          maxBtn.click();
        }
      }
      
      // Wait for maximize animation to complete
      await sleep(500);
      
      // Load and play video
      const video = gifEl.querySelector('video');
      const img = gifEl.querySelector('img'); // Fallback for non-video views
      const poster = gifEl.querySelector('.video-poster');
      
      if (video) {
        // Disable right-click on video (basic deterrent)
        video.addEventListener('contextmenu', e => e.preventDefault());
        
        // Load video via blob URL (hides direct path)
        const videoSource = video.querySelector('source');
        if (videoSource && !video.dataset.blobLoaded) {
          try {
            const response = await fetch(videoSource.src);
            const blob = await response.blob();
            video.src = URL.createObjectURL(blob);
            video.dataset.blobLoaded = 'true';
          } catch (e) {
            // Fallback to direct load if fetch fails
            video.load();
          }
        } else {
          video.load();
        }
        
        // Wait a moment for video to be ready
        await sleep(300);
        
        // Hide poster and show video
        if (poster) poster.classList.add('hidden');
        video.classList.add('ready');
        video.play();
        
        // Stop at end, don't loop
        video.loop = false;
        
      } else if (img) {
        // Fallback for views still using GIF
        const gifSrc = img.src;
        img.src = '';
        img.src = gifSrc;
        await sleep(50);
        img.classList.add('playing');
      }
    }
    
    // === STEP 10: Add expand/collapse handler (toggle full view) ===
    header.style.cursor = 'pointer';
    header.addEventListener('click', function() {
      toggle.classList.toggle('expanded');
      stepsList.classList.toggle('expanded');
      stepsList.classList.toggle('fully-expanded');
      // Show all steps when expanding, remove preview-hidden
      if (stepsList.classList.contains('expanded')) {
        stepsList.querySelectorAll('li').forEach(li => {
          li.classList.add('visible');
          li.classList.remove('preview-hidden');
        });
      }
    });
    
    await sleep(TIMING.pause);
    
    // === STEP 11: Move node RIGHT ===
    nodeEl.classList.remove('left');
    await sleep(TIMING.nodeMove);
    
    // === STEP 12: Stop pulsing and clear status ===
    await sleep(TIMING.pause);
    nodeEl.classList.remove('processing');
    // Keep the "Thought for Xm Xs" status visible with expand button
    
    isAnimating = false;
  }
  
  // ============================================
  // CONVERSATION LOADING
  // ============================================
  
  function loadConversation(conversationKey) {
    const els = getElements();
    const chatEl = els.chatMessages;
    
    if (!chatEl) {
      console.warn('View4Chat: chatMessagesIndex4 not found');
      return;
    }
    
    const conversation = conversations[conversationKey];
    if (!conversation) {
      console.warn('View4Chat: conversation not found for:', conversationKey);
      return;
    }
    
    // Save current conversation state before switching (if not already saved as completed)
    if (activeConversation && !conversationStates[activeConversation]?.completed) {
      conversationStates[activeConversation] = {
        completed: false,
        chatHTML: chatEl.innerHTML
      };
    }
    
    activeConversation = conversationKey;
    
    // Check if we have saved state for this conversation
    const savedState = conversationStates[conversationKey];
    if (savedState && savedState.chatHTML) {
      // Restore saved state
      chatEl.innerHTML = savedState.chatHTML;
      chatEl.scrollTop = chatEl.scrollHeight;
      // Re-attach click handlers for thinking containers
      initThinkingContainerHandlers(chatEl);
      return;
    }
    
    // No saved state - build fresh from conversation data
    chatEl.innerHTML = '';
    
    // Add messages
    conversation.messages.forEach(msg => {
      if (msg.type === 'thinking') {
        // Create collapsed thinking container (steps hidden until user clicks)
        const container = createThinkingContainer(msg.steps, true);
        chatEl.appendChild(container);
      } else {
        const msgDiv = document.createElement('div');
        msgDiv.className = msg.type === 'user' ? 'demo-msg-user' : 'demo-msg-bot';
        msgDiv.innerHTML = '<p>' + msg.text + '</p>';
        chatEl.appendChild(msgDiv);
      }
    });
    
    // Re-initialize thinking container click handlers after loading
    initThinkingContainerHandlers(chatEl);
    
    // Add ready prompt
    const promptDiv = document.createElement('div');
    promptDiv.className = 'demo-ready-prompt';
    promptDiv.innerHTML = '<span>' + conversation.readyPrompt + '</span>';
    chatEl.appendChild(promptDiv);
    
    chatEl.scrollTop = chatEl.scrollHeight;
    
    // Don't reset video/GIF when switching conversations - persist until page refresh
    // User can see the completed output while browsing other chat contexts
  }
  
  // ============================================
  // CHAT INPUT HANDLING
  // ============================================
  
  // Helper to add message with WhatsApp-style slide-in animation
  function addMessageWithAnimation(chatEl, className, html) {
    const msg = document.createElement('div');
    msg.className = className;
    msg.style.opacity = '0';
    msg.style.transform = 'translateY(10px)';
    msg.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
    msg.innerHTML = html;
    chatEl.appendChild(msg);
    
    // Trigger animation after append
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
    
    // Support both input elements and contenteditable spans
    const rawInput = inputEl.value !== undefined ? inputEl.value : inputEl.textContent;
    const input = rawInput.trim().toLowerCase();
    if (!input) return;
    
    // Add user message with animation
    addMessageWithAnimation(chatEl, 'demo-msg-user', '<p>' + rawInput.trim() + '</p>');
    
    // Clear input
    if (inputEl.value !== undefined) {
      inputEl.value = '';
    } else {
      inputEl.textContent = '';
    }
    
    // Remove ready prompt
    const readyPrompt = chatEl.querySelector('.demo-ready-prompt');
    if (readyPrompt) readyPrompt.remove();
    
    chatEl.scrollTop = chatEl.scrollHeight;
    
    // Check for proceed commands
    if (input === 'yes' || input === 'proceed' || input === 'y' || input === 'ok') {
      // Check if command already completed for this conversation
      if (conversationStates[activeConversation]?.completed) {
        await sleep(300);
        addMessageWithAnimation(chatEl, 'demo-msg-bot', '<p>I\'m sorry, this command has already been completed. Please select a different chat context from the history.</p>');
        chatEl.scrollTop = chatEl.scrollHeight;
        return;
      }
      
      await runNeuralNodeWorkflow();
      
      // Save completed state for this conversation
      conversationStates[activeConversation] = {
        completed: true,
        chatHTML: chatEl.innerHTML
      };
    } else {
      await sleep(300);
      addMessageWithAnimation(chatEl, 'demo-msg-bot', '<p>Please type "yes" or "proceed" to generate the layout.</p>');
      chatEl.scrollTop = chatEl.scrollHeight;
    }
  }
  
  // ============================================
  // INITIALIZATION
  // ============================================
  
  function init() {
    // History item clicks - conversation switching
    document.addEventListener('click', function(e) {
      const historyItem = e.target.closest('#chatHistoryIndex4 .demo-history-item');
      if (!historyItem) return;
      
      // Update active state
      document.querySelectorAll('#chatHistoryIndex4 .demo-history-item').forEach(i => i.classList.remove('active'));
      historyItem.classList.add('active');
      
      // Load conversation
      const system = historyItem.getAttribute('data-system') || historyItem.getAttribute('data-conversation');
      if (system && conversations[system]) {
        loadConversation(system);
      }
    });
    
    // Send button click
    document.addEventListener('click', function(e) {
      if (e.target.closest('#chatSendIndex4')) {
        handleChatSend(e);
      }
    });
    
    // Enter key in input (works for both input and contenteditable)
    document.addEventListener('keydown', function(e) {
      const inputEl = document.getElementById('chatInputIndex4');
      if (e.key === 'Enter' && !e.shiftKey && document.activeElement === inputEl) {
        e.preventDefault(); // Prevent newline in contenteditable
        handleChatSend(e);
      }
    });
    
    // Initialize existing thinking containers in HTML
    initThinkingContainerHandlers(document.getElementById('chatMessagesIndex4'));
  }
  
  // Helper function to initialize click handlers for thinking containers
  function initThinkingContainerHandlers(parentEl) {
    if (!parentEl) return;
    
    parentEl.querySelectorAll('.thinking-container').forEach(container => {
      const header = container.querySelector('.thinking-header');
      const toggle = container.querySelector('.steps-toggle');
      const stepsList = container.querySelector('.steps-list');
      
      if (header && stepsList && !header.dataset.clickInitialized) {
        header.dataset.clickInitialized = 'true';
        header.style.cursor = 'pointer';
        header.addEventListener('click', function() {
          if (toggle) toggle.classList.toggle('expanded');
          stepsList.classList.toggle('expanded');
          stepsList.classList.toggle('fully-expanded');
          // Show all steps when expanding
          if (stepsList.classList.contains('expanded')) {
            stepsList.querySelectorAll('li').forEach(li => li.classList.add('visible'));
          }
        });
      }
    });
    
    // LLM Mode toggle - enable/disable LLM options
    document.addEventListener('change', function(e) {
      if (e.target.id === 'llmModeToggle') {
        const llmOptions = document.querySelectorAll('.dropdown-item.llm-option');
        llmOptions.forEach(opt => {
          if (e.target.checked) {
            opt.classList.remove('disabled');
            opt.classList.add('enabled');
          } else {
            opt.classList.remove('enabled');
            opt.classList.add('disabled');
          }
        });
      }
    });
    
    // Agent mode toggles (only one can be on at a time)
    document.addEventListener('change', function(e) {
      if (e.target.name === 'agentMode') {
        const menu = e.target.closest('.agent-menu');
        if (menu && e.target.checked) {
          // Turn off all other toggles
          menu.querySelectorAll('input[name="agentMode"]').forEach(input => {
            if (input !== e.target) input.checked = false;
          });
          // Update display
          const modeName = e.target.value;
          const display = document.querySelector('.agent-mode-display');
          if (display) display.textContent = modeName;
        }
      }
    });
    
    // Model selection with tick
    document.addEventListener('click', function(e) {
      const modelOption = e.target.closest('.model-option');
      if (modelOption) {
        const menu = modelOption.closest('.model-menu');
        if (menu) {
          // Remove active from all
          menu.querySelectorAll('.model-option').forEach(opt => opt.classList.remove('active'));
          // Add active to clicked
          modelOption.classList.add('active');
        }
        const modelName = modelOption.getAttribute('data-model');
        const display = document.querySelector('.model-display');
        if (display) {
          // Parse model name for brand formatting (e.g., 'Build X 0.1' -> BUILD X. 0.1)
          const parts = modelName.match(/Build (\w+) (\d+\.\d+)/);
          if (parts) {
            display.innerHTML = '<span class="brand-build">BUILD</span> <span class="brand-variant">' + parts[1].toUpperCase() + '</span><span class="brand-dot">.</span><span class="model-version-inline">' + parts[2] + '</span>';
          } else {
            display.textContent = modelName;
          }
        }
      }
      
      // Meeting mode toggle
      const meetingBtn = e.target.closest('.chat-meeting-btn');
      if (meetingBtn) {
        meetingBtn.classList.toggle('active');
      }
      
      // Project Structure folder toggle
      const folderHeader = e.target.closest('.tree-folder-header');
      if (folderHeader) {
        const folder = folderHeader.closest('.tree-folder');
        if (folder) {
          folder.classList.toggle('expanded');
        }
      }
    });
    
    // Sidebar tab switching
    document.addEventListener('click', (e) => {
      const sidebarTab = e.target.closest('.sidebar-tab');
      if (sidebarTab) {
        const panelName = sidebarTab.getAttribute('data-panel');
        const sidebar = sidebarTab.closest('.demo-chat-history-sidebar');
        if (sidebar && panelName) {
          // Update tab active state
          sidebar.querySelectorAll('.sidebar-tab').forEach(tab => tab.classList.remove('active'));
          sidebarTab.classList.add('active');
          // Update panel active state
          sidebar.querySelectorAll('.sidebar-panel').forEach(panel => panel.classList.remove('active'));
          const targetPanel = sidebar.querySelector(`.sidebar-panel[data-panel="${panelName}"]`);
          if (targetPanel) targetPanel.classList.add('active');
        }
      }
    });
    
    // Chat sidebar resize handle (horizontal - sidebar vs chat)
    const chatSidebarResize = document.querySelector('.chat-sidebar-resize');
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
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  
  // Expose for external access if needed
  window.View4Chat = {
    loadConversation: loadConversation,
    getActiveConversation: function() { return activeConversation; },
    conversations: conversations
  };
  
})();

