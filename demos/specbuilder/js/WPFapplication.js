/**
 * WPFapplication.js - Chat Panel Controller
 * (Formerly view4-chat.js)
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
    stepReveal: 100, // Faster steps as requested
    collapse: 400
  };
  
  // ============================================
  // STATE
  // ============================================
  
  let activeConversation = 'manager';
  let isAnimating = false;
  let onboardingComplete = false;
  
  // Track completed state and chat content per conversation (persists until page refresh)
  const conversationStates = {};  // { conversationKey: { completed: bool, chatHTML: string } }
  
  // ============================================
  // BACKGROUND ANIMATION STATE TRACKING
  // When manager says "Done", all agent animations start running in background.
  // When user switches to an agent chat, they see the animation at its live position.
  // ============================================
  
  let globalAnimationStartTime = null;  // When all animations started
  
  // Track each agent's animation state
  const agentAnimationStates = {};  // { key: { startTime, duration, currentStep, totalSteps, completed, stepsData } }
  
  // Animation durations now calculated from step count × TIMING.stepReveal (350ms)
  
  // Agent spawning order and delays
  const agentSpawnOrder = [
    { key: 'introduction', name: 'Introduction', preview: 'Preparing overview...', delay: 0 },
    { key: 'drainage', name: 'Drainage', preview: 'Analysing drainage requirements...', delay: 400 },
    { key: 'water', name: 'Water Services', preview: 'Checking water systems...', delay: 800 },
    { key: 'heating', name: 'Heating & Cooling', preview: 'Evaluating HVAC...', delay: 1200 },
    { key: 'ventilation', name: 'Ventilation', preview: 'Reviewing ventilation...', delay: 1600 },
    { key: 'controls', name: 'Controls & Plant', preview: 'Checking BMS points...', delay: 2000 },
    { key: 'containment', name: 'Containment', preview: 'Planning routes...', delay: 2400 },
    { key: 'power', name: 'Power', preview: 'Analysing distribution...', delay: 2800 },
    { key: 'lighting', name: 'Lighting', preview: 'Calculating lux levels...', delay: 3200 },
    { key: 'firealarms', name: 'Fire Alarms', preview: 'Checking zones...', delay: 3600 },
    { key: 'security', name: 'Security & Access', preview: 'Reviewing access points...', delay: 4000 }
  ];
  
  // ============================================
  // BACKGROUND ANIMATION FUNCTIONS
  // All agent animations start immediately when spawned (queued from single prompt)
  // ============================================
  
  // User prompts for each agent (as if queued from single manager prompt)
  const agentUserPrompts = {
    introduction: 'Can you do the introduction section of the spec please?',
    drainage: 'Can you do the drainage section of the spec please?',
    water: 'Can you do the water services section of the spec please?',
    heating: 'Can you do the heating and cooling section of the spec please?',
    ventilation: 'Can you do the ventilation section of the spec please?',
    controls: 'Can you do the controls and plant section of the spec please?',
    containment: 'Can you do the containment section of the spec please?',
    power: 'Can you do the power section of the spec please?',
    lighting: 'Can you do the lighting section of the spec please?',
    firealarms: 'Can you do the fire alarms section of the spec please?',
    security: 'Can you do the security section of the spec please?'
  };
  
  /**
   * Start all agent animations immediately after spawn.
   * Each agent runs its own workflow in background - when user switches to that chat,
   * they see it at the current live position.
   */
  function startAllBackgroundAnimations() {
    globalAnimationStartTime = Date.now();
    
    const totalAgents = agentSpawnOrder.length;
    
    // Initialize and start each agent's animation with staggered start
    agentSpawnOrder.forEach((agent, index) => {
      const conversation = conversations[agent.key];
      if (!conversation) return;
      
      const steps = conversation.thinkingSequence || [];
      
      // Calculate duration from step count: each step = 350ms (TIMING.stepReveal)
      // Plus some overhead for container creation, collapse, final message
      const stepDuration = steps.length * TIMING.stepReveal;
      const overheadDuration = 2000; // Container, collapse, final message
      const totalDuration = stepDuration + overheadDuration;
      
      // Stagger start times slightly so they don't all hit the same step at once
      const staggerDelay = index * 500;
      
      agentAnimationStates[agent.key] = {
        startTime: globalAnimationStartTime + staggerDelay,
        duration: totalDuration,
        currentStep: 0,
        totalSteps: steps.length,
        completed: false,
        steps: steps
      };
    });
    
    // Start the background timer to track progress
    startBackgroundAnimationTimer(totalAgents);
  }
  
  /**
   * Background timer - updates INDIVIDUAL progress rings per agent
   */
  let backgroundAnimationInterval = null;
  
  function startBackgroundAnimationTimer(totalAgents) {
    if (backgroundAnimationInterval) {
      clearInterval(backgroundAnimationInterval);
    }
    
    backgroundAnimationInterval = setInterval(() => {
      const now = Date.now();
      let allComplete = true;
      
      agentSpawnOrder.forEach(agent => {
        const state = agentAnimationStates[agent.key];
        if (!state) return;
        
        if (state.completed) return;
        
        const elapsed = now - state.startTime;
        const progress = Math.min(elapsed / state.duration, 1);
        
        // Update current step
        state.currentStep = Math.floor(progress * state.totalSteps);
        
        // Update this agent's individual progress ring (0-100%)
        updateIndividualProgressRing(agent.key, progress);
        
        if (progress >= 1 && !state.completed) {
          state.completed = true;
          state.currentStep = state.totalSteps;
          markAgentComplete(agent.key);
        } else {
          allComplete = false;
        }
      });
      
      if (allComplete) {
        clearInterval(backgroundAnimationInterval);
        backgroundAnimationInterval = null;
        // All agents complete - show the BUILD release overlay
        showBuildReleaseOverlay();
      }
    }, 200);
  }
  
  /**
   * Show the BUILD release overlay when all agents complete
   */
  function showBuildReleaseOverlay() {
    const editorArea = document.getElementById('editorArea');
    const editorWrapper = editorArea?.closest('.editor-wrapper');
    if (!editorArea || !editorWrapper) return;
    
    
    // Add blur to editor
    editorArea.classList.add('blurred');
    
    // Create overlay if it doesn't exist - append to wrapper (non-scrolling) not area (scrolling)
    let overlay = document.getElementById('buildReleaseOverlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'buildReleaseOverlay';
      overlay.className = 'build-release-overlay';
      overlay.innerHTML = `
        <div class="build-release-content" style="text-align: center; padding: 40px;">
          <div class="build-release-logo" style="font-family: 'Gotham Medium', 'Montserrat', Helvetica, Arial, sans-serif; font-size: 36px; font-weight: 500; letter-spacing: 5pt; margin-bottom: 30px;">ADELPHOS <span class="logo-ai" style="color: #156082;">AI</span></div>
          <div class="build-release-text" style="font-family: 'Inter', sans-serif;">
            <p class="release-line" style="font-size: 14px; font-weight: 300; color: #666; margin-bottom: 8px;">Released as part of</p>
            <p class="release-brand" style="font-size: 28px; font-weight: 500; margin-bottom: 8px; display: flex; align-items: baseline; justify-content: center;">
              <span class="brand-build" style="letter-spacing: 2pt; margin-right: 6px;">BUILD</span>
              <span class="carousel-container" style="display: inline-block; height: 32px; overflow: hidden; vertical-align: baseline; min-width: 50px;">
                <span class="carousel-items" id="buildCarousel" style="display: flex; flex-direction: column; transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);">
                  <span class="carousel-item" style="height: 32px; line-height: 32px; font-weight: 600; text-align: left;"><span class="carousel-letter" style="color: #156082;">A</span><span class="carousel-stop">.</span></span>
                  <span class="carousel-item" style="height: 32px; line-height: 32px; font-weight: 600; text-align: left;"><span class="carousel-letter" style="color: #156082;">MEP</span><span class="carousel-stop">.</span></span>
                  <span class="carousel-item" style="height: 32px; line-height: 32px; font-weight: 600; text-align: left;"><span class="carousel-letter" style="color: #156082;">S</span><span class="carousel-stop">.</span></span>
                  <span class="carousel-item" style="height: 32px; line-height: 32px; font-weight: 600; text-align: left;"><span class="carousel-letter" style="color: #156082;">C</span><span class="carousel-stop">.</span></span>
                  <span class="carousel-item" style="height: 32px; line-height: 32px; font-weight: 600; text-align: left;"><span class="carousel-letter" style="color: #156082;">F</span><span class="carousel-stop">.</span></span>
                  <span class="carousel-item" style="height: 32px; line-height: 32px; font-weight: 600; text-align: left;"><span class="carousel-letter" style="color: #156082;">X</span><span class="carousel-stop">.</span></span>
                </span>
              </span>
            </p>
            <p class="release-product" style="font-size: 16px; font-weight: 400; color: #666;">Full Specification Builder</p>
          </div>
        </div>
      `;
      editorWrapper.appendChild(overlay);
    }
    
    // Show with animation
    setTimeout(() => {
      overlay.classList.add('visible');
      // Start carousel animation after overlay is visible
      startBuildCarouselAnimation();
      // Start simulating background text
      startBackgroundTextSimulation();
    }, 100);
  }
  
  /**
   * Animate the BUILD package carousel: A → MEP → S → C → F → X (stop)
   */
  function startBuildCarouselAnimation() {
    const carousel = document.getElementById('buildCarousel');
    
    
    if (!carousel) return;
    
    const itemHeight = 32; // Fixed height matching CSS
    let currentIndex = 0;
    const totalItems = 6; // A, MEP, S, C, F, X
    
    const advanceCarousel = () => {
      currentIndex++;
      if (currentIndex >= totalItems) {
        // Stop at X. (last item, index 5)
        return;
      }
      carousel.style.transform = `translateY(-${currentIndex * itemHeight}px)`;
      // Continue to next item
      setTimeout(advanceCarousel, 800);
    };
    
    // Start advancing after initial delay
    setTimeout(advanceCarousel, 800);
    
  }
  
  /**
   * Simulate spec text being generated in the background behind the blur
   */
  function startBackgroundTextSimulation() {
    // #region agent log
    // #endregion
    
    const contentPaper = document.getElementById('editorPaper');
    if (!contentPaper) return;
    
    // Remove extra pages, keep only editorPaper
    const editorArea = document.getElementById('editorArea');
    if (editorArea) {
      editorArea.querySelectorAll('.editor-paper:not(.title-page):not(#editorPaper)').forEach(p => p.remove());
    }
    
    // Clear and setup columns
    contentPaper.innerHTML = '';
    contentPaper.style.columnCount = '2';
    contentPaper.style.columnGap = '15px';
    contentPaper.style.columnFill = 'auto';
    
    const specPara = 'The work described in this document covers the supply, installation, setting to work and commissioning of the Mechanical, Electrical and Plumbing services installation for the Aurora House office fit-out works at 45 Broadgate Circle, London EC2M. The intention of the specification is to cover all MEP services for the Cat A and Cat B fit-out and will be supplemented with additional scope of works as the project develops.';
    
    // VISIBLE content for first 2 pages only (16 items max)
    const visibleSections = [
      { type: 'h2', text: '1 Scope of Services' },
      { type: 'h3', text: '1.1 Introduction' }, { type: 'p', text: specPara },
      { type: 'h3', text: '1.2 Document Structure' }, { type: 'p', text: specPara },
      { type: 'h3', text: '1.3 Abbreviations/Acronyms' }, { type: 'p', text: specPara },
      { type: 'h3', text: '1.4 Terms' }, { type: 'p', text: specPara },
      { type: 'h3', text: '1.5 Description of the Works' }, { type: 'p', text: specPara },
      { type: 'h2', text: '2 Site Services and Infrastructure' },
      { type: 'h3', text: '2.1 Utilities' }, { type: 'p', text: specPara },
      { type: 'h2', text: '3 Engineering Services Drawing List' },
      { type: 'h3', text: '3.1 Mechanical and Public Health Services' }, { type: 'p', text: specPara }
    ];
    
    // Add visible content quickly (headings populate sidebar via MutationObserver)
    let visibleIndex = 0;
    const addVisibleSection = () => {
      if (visibleIndex >= visibleSections.length) {
        // Start the fake word count animation
        startWordCountAnimation();
        return;
      }
      
      const section = visibleSections[visibleIndex];
      const tagName = ['h2', 'h3', 'h4'].includes(section.type) ? section.type : 'p';
      const el = document.createElement(tagName);
      el.textContent = section.text;
      
      // Inline styles
      if (section.type === 'h2') {
        el.style.cssText = 'font-size: 9pt; font-weight: bold; margin: 10pt 0 4pt 0; color: #156082;';
      } else if (section.type === 'h3') {
        el.style.cssText = 'font-size: 7pt; font-weight: bold; margin: 6pt 0 2pt 0; color: #333;';
      } else {
        el.style.cssText = 'font-size: 6pt; line-height: 1.35; margin: 0 0 4pt 0; text-align: justify; color: #555;';
      }
      
      contentPaper.appendChild(el);
      visibleIndex++;
      setTimeout(addVisibleSection, 50);
    };
    
    // Fake headings to add progressively (continuing from real content)
    const fakeHeadings = [
      '4 Standard Details', '4.1 Mechanical Services', '4.2 Electrical Services',
      '5 Testing and Commissioning', '5.1 New Plant Equipment', '5.2 Factory Tests',
      '6 Approved Manufacturers',
      '7 Regulatory Criteria', '7.1 Design Criteria',
      '8 Design Criteria', '8.1 Mechanical Design', '8.2 Electrical Design',
      '9 Stripping Out', '9.1 Existing Services', '9.2 Mechanical', '9.3 Electrical',
      '10 Mechanical & PH Engineering', '10.1 Ventilation', '10.2 Heating/Cooling', '10.3 Water', '10.4 Drainage',
      '11 Electrical Services', '11.1 Installation', '11.2 LV Distribution', '11.3 Lighting', '11.4 Fire Alarm',
      '12 Building Management', '12.1 BMS Controls', '12.2 Energy Metering', '12.3 Commissioning'
    ];
    
    // Animate word count, page count, and headings over ~10 seconds
    const startWordCountAnimation = () => {
      const wordCountEl = document.getElementById('wordCount') || document.querySelector('.word-count');
      const pageCountEl = document.querySelector('.page-count');
      const headingsList = document.getElementById('headingsList');
      if (!wordCountEl) return;
      
      let currentWords = 500;
      const targetWords = 23847;
      let currentPage = 1;
      const targetPages = 73;
      const duration = 10000; // 10 seconds
      const steps = 50;
      const wordIncrement = Math.floor((targetWords - currentWords) / steps);
      const interval = duration / steps;
      
      let headingIndex = 0;
      
      const animate = () => {
        // Animate word count
        currentWords = Math.min(currentWords + wordIncrement + Math.floor(Math.random() * 200), targetWords);
        wordCountEl.textContent = `${currentWords.toLocaleString()} words`;
        
        // Animate page count
        if (pageCountEl && currentPage < targetPages) {
          currentPage = Math.min(currentPage + 1, targetPages);
          pageCountEl.textContent = `Page 1 of ${currentPage}`;
        }
        
        // Add fake headings progressively (append, don't clear)
        if (headingsList && headingIndex < fakeHeadings.length) {
          const li = document.createElement('li');
          const heading = fakeHeadings[headingIndex];
          li.className = 'heading-item level-' + (heading.match(/^\d+\.\d+/) ? '3' : '2');
          li.textContent = heading;
          headingsList.appendChild(li);
          headingIndex++;
        }
        
        if (currentWords < targetWords) {
          setTimeout(animate, interval);
        } else {
          wordCountEl.textContent = `${targetWords.toLocaleString()} words`;
          if (pageCountEl) pageCountEl.textContent = `Page 1 of ${targetPages}`;
        }
      };
      
      setTimeout(animate, 200);
    };
    
    // Start adding visible content
    setTimeout(addVisibleSection, 150);
  }
  
  /* DEAD CODE REMOVED - Old specSections array was causing ReferenceError
      { type: 'h3', text: '1.3 Abbreviations/Acronyms' }, { type: 'p', text: specPara },
      { type: 'h3', text: '1.4 Terms' }, { type: 'p', text: specPara },
      { type: 'h3', text: '1.5 Description of the Works' }, { type: 'p', text: specPara },
      { type: 'h3', text: '1.6 Samples' }, { type: 'p', text: specPara },
      { type: 'h3', text: '1.7 Fire Stopping' }, { type: 'p', text: specPara },
      { type: 'h3', text: '1.8 Access to Plant and Equipment' }, { type: 'p', text: specPara },
      { type: 'h3', text: '1.9 Manufacturers Warranties and Guarantees' }, { type: 'p', text: specPara },
      { type: 'h3', text: '1.10 Cleaning And Painting' }, { type: 'p', text: specPara },
      { type: 'h3', text: '1.11 Electromagnetic Compatibility And Screening (EMC)' },
      { type: 'h4', text: '1.11.1 Performance Objectives' }, { type: 'p', text: specPara },
      { type: 'h4', text: '1.11.2 Design Parameters' }, { type: 'p', text: specPara },
      { type: 'h4', text: '1.11.3 General' }, { type: 'p', text: specPara },
      { type: 'h4', text: '1.11.4 System Equipment' }, { type: 'p', text: specPara },
      { type: 'h4', text: '1.11.5 System Installation' }, { type: 'p', text: specPara },
      { type: 'h4', text: '1.11.6 Survey' }, { type: 'p', text: specPara },
      { type: 'h3', text: '1.12 Labelling & Engraving' },
      { type: 'h4', text: '1.12.1 Mechanical Services' }, { type: 'p', text: specPara },
      { type: 'h4', text: '1.12.2 Electrical Services' }, { type: 'p', text: specPara },
      { type: 'h4', text: '1.12.3 Products' }, { type: 'p', text: specPara },
      { type: 'h4', text: '1.12.4 Fabrication' }, { type: 'p', text: specPara },
      { type: 'h4', text: '1.12.5 Execution' }, { type: 'p', text: specPara },
      // Section 2 - Site Services
      { type: 'h2', text: '2 Site Services and Infrastructure' },
      { type: 'h3', text: '2.1 Utilities' },
      { type: 'h4', text: '2.1.1 Electrical Utilities' }, { type: 'p', text: specPara },
      { type: 'h4', text: '2.1.2 Mechanical Utilities' }, { type: 'p', text: specPara },
      { type: 'h4', text: '2.1.3 Telecommunications' }, { type: 'p', text: specPara },
      // Section 3 - Drawing List
      { type: 'h2', text: '3 Engineering Services Drawing List' },
      { type: 'h3', text: '3.1 Mechanical and Public Health Services' }, { type: 'p', text: specPara },
      { type: 'h3', text: '3.2 Electrical Services' }, { type: 'p', text: specPara },
      // Section 4 - Standard Details
      { type: 'h2', text: '4 Standard Details' },
      { type: 'h3', text: '4.1 Mechanical and Public Health Services' }, { type: 'p', text: specPara },
      { type: 'h3', text: '4.2 Electrical Services' }, { type: 'p', text: specPara },
      // Section 5 - Testing & Commissioning
      { type: 'h2', text: '5 Testing, Commissioning and Aftercare' },
      { type: 'h3', text: '5.1 New Plant Equipment' }, { type: 'p', text: specPara },
      { type: 'h3', text: '5.2 Factory Tests' }, { type: 'p', text: specPara },
      { type: 'h3', text: '5.3 OEM Tests' }, { type: 'p', text: specPara },
      { type: 'h3', text: '5.4 Site Inspection & Performance Testing' },
      { type: 'h4', text: '5.4.1 Electrical Systems' }, { type: 'p', text: specPara },
      { type: 'h4', text: '5.4.2 Mechanical Systems' }, { type: 'p', text: specPara },
      { type: 'h4', text: '5.4.3 Public Health Systems' }, { type: 'p', text: specPara },
      { type: 'h3', text: '5.5 Integrated Systems Test' },
      { type: 'h4', text: '5.5.1 Scope' }, { type: 'p', text: specPara },
      { type: 'h4', text: '5.5.2 IST Pre-requisite' }, { type: 'p', text: specPara },
      { type: 'h4', text: '5.5.3 Methodology' }, { type: 'p', text: specPara },
      { type: 'h4', text: '5.5.4 IST Test Results' }, { type: 'p', text: specPara },
      { type: 'h3', text: '5.6 Soak Tests / Seasonal Commissioning' }, { type: 'p', text: specPara },
      // Section 6 - Approved Manufacturers
      { type: 'h2', text: '6 Approved Plant and Equipment Manufacturers' }, { type: 'p', text: specPara },
      // Section 7 - Regulatory
      { type: 'h2', text: '7 Regulatory Criteria and Environmental Requirements' },
      { type: 'h3', text: '7.1 Design Criteria' }, { type: 'p', text: specPara },
      // Section 8 - Design Criteria
      { type: 'h2', text: '8 Design Criteria' },
      { type: 'h3', text: '8.1 Mechanical Design Criteria' },
      { type: 'h4', text: '8.1.1 External Design Conditions' }, { type: 'p', text: specPara },
      { type: 'h4', text: '8.1.2 Internal Design Conditions' }, { type: 'p', text: specPara },
      { type: 'h4', text: '8.1.3 Ventilation Design Criteria' }, { type: 'p', text: specPara },
      { type: 'h4', text: '8.1.4 Ventilation Specific Fan Powers' }, { type: 'p', text: specPara },
      { type: 'h4', text: '8.1.5 Heat Gain Design Criteria' }, { type: 'p', text: specPara },
      { type: 'h4', text: '8.1.6 Ductwork Design Criteria' }, { type: 'p', text: specPara },
      { type: 'h4', text: '8.1.7 Pipework Design Criteria' }, { type: 'p', text: specPara },
      { type: 'h4', text: '8.1.8 Public Health Design Criteria' }, { type: 'p', text: specPara },
      { type: 'h4', text: '8.1.9 Fluid Temperatures and Pressures' }, { type: 'p', text: specPara },
      { type: 'h4', text: '8.1.10 Plant Life Expectancies' }, { type: 'p', text: specPara },
      { type: 'h4', text: '8.1.11 Design Margin' }, { type: 'p', text: specPara },
      { type: 'h3', text: '8.2 Electrical Design Criteria' },
      { type: 'h4', text: '8.2.1 Electricity Intake' }, { type: 'p', text: specPara },
      { type: 'h4', text: '8.2.2 Lighting' }, { type: 'p', text: specPara },
      { type: 'h4', text: '8.2.3 Emergency Lighting Systems' }, { type: 'p', text: specPara },
      // Section 9 - Stripping Out
      { type: 'h2', text: '9 Stripping Out & Modifications of Existing Services' },
      { type: 'h3', text: '9.1 Existing Services' },
      { type: 'h4', text: '9.1.1 Survey, Stripping Out, Modifications' }, { type: 'p', text: specPara },
      { type: 'h4', text: '9.1.2 Background Information' }, { type: 'p', text: specPara },
      { type: 'h4', text: '9.1.3 Access To the Site' }, { type: 'p', text: specPara },
      { type: 'h4', text: '9.1.4 Access To Particular Plant Areas' }, { type: 'p', text: specPara },
      { type: 'h4', text: '9.1.5 Unforeseen Hazards' }, { type: 'p', text: specPara },
      { type: 'h4', text: '9.1.6 Safety of Third Parties' }, { type: 'p', text: specPara },
      { type: 'h4', text: '9.1.7 Test Instrument' }, { type: 'p', text: specPara },
      { type: 'h4', text: '9.1.8 Soft Strip' }, { type: 'p', text: specPara },
      { type: 'h4', text: '9.1.9 Builders Work and Making Good' }, { type: 'p', text: specPara },
      { type: 'h3', text: '9.2 Mechanical Services' },
      { type: 'h4', text: '9.2.1 Scope' }, { type: 'p', text: specPara },
      { type: 'h4', text: '9.2.2 Ductwork' }, { type: 'p', text: specPara },
      { type: 'h4', text: '9.2.3 Pipework' }, { type: 'p', text: specPara },
      { type: 'h4', text: '9.2.4 Sprinkler System' }, { type: 'p', text: specPara },
      { type: 'h4', text: '9.2.5 Refrigerant Systems' }, { type: 'p', text: specPara },
      { type: 'h3', text: '9.3 Electrical Services' },
      { type: 'h4', text: '9.3.1 Conduits' }, { type: 'p', text: specPara },
      { type: 'h4', text: '9.3.2 Trunking' }, { type: 'p', text: specPara },
      { type: 'h4', text: '9.3.3 Tray Plates & Baskets' }, { type: 'p', text: specPara },
      { type: 'h4', text: '9.3.4 General Lighting & Power' }, { type: 'p', text: specPara },
      { type: 'h4', text: '9.3.5 LV Distribution' }, { type: 'p', text: specPara },
      { type: 'h4', text: '9.3.6 Life Safety Systems' }, { type: 'p', text: specPara },
      { type: 'h4', text: '9.3.7 Security Systems' }, { type: 'p', text: specPara },
      { type: 'h4', text: '9.3.8 Public Address' }, { type: 'p', text: specPara },
      { type: 'h4', text: '9.3.9 Data and Telephone Installation' }, { type: 'p', text: specPara },
      { type: 'h4', text: '9.3.10 ELV Services' }, { type: 'p', text: specPara },
      // Section 10 - Mechanical & PH
      { type: 'h2', text: '10 Mechanical and Public Health Engineering Services' },
      { type: 'h3', text: '10.1 Ventilation System' }, { type: 'p', text: specPara },
      { type: 'h3', text: '10.2 General Ventilation' }, { type: 'p', text: specPara },
      { type: 'h3', text: '10.3 Heating and Cooling System' }, { type: 'p', text: specPara },
      { type: 'h3', text: '10.4 Steam System' }, { type: 'p', text: specPara },
      { type: 'h3', text: '10.5 Domestic Water System' }, { type: 'p', text: specPara },
      { type: 'h3', text: '10.6 Above Ground Drainage System' }, { type: 'p', text: specPara },
      { type: 'h3', text: '10.7 Compressed Air and Natural Gas System' }, { type: 'p', text: specPara },
      { type: 'h3', text: '10.8 Sprinkler System' }, { type: 'p', text: specPara },
      // Section 11 - Electrical
      { type: 'h2', text: '11 Electrical Engineering Services' },
      { type: 'h3', text: '11.1 Type Of Installation' }, { type: 'p', text: specPara },
      { type: 'h3', text: '11.2 Low Voltage Distribution' },
      { type: 'h4', text: '11.2.1 General' }, { type: 'p', text: specPara },
      { type: 'h4', text: '11.2.2 Section Board (Panel Board Type)' }, { type: 'p', text: specPara },
      { type: 'h4', text: '11.2.3 Section Board (Cubicle Board Type)' }, { type: 'p', text: specPara },
      { type: 'h4', text: '11.2.4 New Distribution Boards' }, { type: 'p', text: specPara },
      { type: 'h4', text: '11.2.5 Circuit Breakers - MCCB' }, { type: 'p', text: specPara },
      { type: 'h4', text: '11.2.6 Miniature Circuit Breakers' }, { type: 'p', text: specPara },
      { type: 'h4', text: '11.2.7 Residual Current Breaker with Integral Overcurrent Protection' }, { type: 'p', text: specPara },
      { type: 'h4', text: '11.2.8 Current Transformers' }, { type: 'p', text: specPara },
      { type: 'h4', text: '11.2.9 Digital Multi-Function Metering Equipment' }, { type: 'p', text: specPara },
      { type: 'h4', text: '11.2.10 Final Circuit Monitoring' }, { type: 'p', text: specPara },
      { type: 'h3', text: '11.3 Small Power' },
      { type: 'h4', text: '11.3.1 Hard Wired Low Voltage Small Power System Generally' }, { type: 'p', text: specPara },
      { type: 'h4', text: '11.3.2 Industrial Socket Outlets' }, { type: 'p', text: specPara },
      { type: 'h4', text: '11.3.3 Industrial Plugs' }, { type: 'p', text: specPara },
      { type: 'h4', text: '11.3.4 Standard Socket Outlets' }, { type: 'p', text: specPara },
      { type: 'h3', text: '11.4 Lighting' },
      { type: 'h4', text: '11.4.1 General Lighting System' }, { type: 'p', text: specPara },
      { type: 'h4', text: '11.4.2 Controls' }, { type: 'p', text: specPara },
      { type: 'h4', text: '11.4.3 Products' }, { type: 'p', text: specPara },
      { type: 'h4', text: '11.4.4 Warranties' }, { type: 'p', text: specPara },
      { type: 'h3', text: '11.5 Emergency Lighting' },
      { type: 'h4', text: '11.5.1 Emergency Luminaires Generally' }, { type: 'p', text: specPara },
      { type: 'h4', text: '11.5.2 Internally Illuminated Emergency Signs' }, { type: 'p', text: specPara },
      { type: 'h4', text: '11.5.3 Warranties' }, { type: 'p', text: specPara },
      { type: 'h3', text: '11.6 Fire Alarm' }, { type: 'p', text: specPara },
      { type: 'h3', text: '11.7 Security Systems' },
      { type: 'h4', text: '11.7.1 CCTV' }, { type: 'p', text: specPara },
      { type: 'h4', text: '11.7.2 Access Control' }, { type: 'p', text: specPara },
      { type: 'h3', text: '11.8 Structured Cabling' }, { type: 'p', text: specPara },
      { type: 'h3', text: '11.9 Earthing & Bonding' }, { type: 'p', text: specPara },
      { type: 'h3', text: '11.10 Electrical Testing' },
      { type: 'h4', text: '11.10.1 Factory Acceptance Tests (FAT)' }, { type: 'p', text: specPara },
      { type: 'h4', text: '11.10.2 UPS Factory Acceptance Test' }, { type: 'p', text: specPara },
      { type: 'h4', text: '11.10.3 Emergency Lighting' }, { type: 'p', text: specPara },
      { type: 'h4', text: '11.10.4 Fire Alarm' }, { type: 'p', text: specPara },
      { type: 'h4', text: '11.10.5 Miscellaneous – Lighting and Small Power' }, { type: 'p', text: specPara },
      // Section 12 - BMS
      { type: 'h2', text: '12 Building Management Services (BMS)' },
      { type: 'h3', text: '12.1 BMS Controls' }, { type: 'p', text: specPara },
      { type: 'h3', text: '12.2 Air Source Heat Pump Heating and Cooling Plants' }, { type: 'p', text: specPara },
      { type: 'h3', text: '12.3 Energy Metering' }, { type: 'p', text: specPara },
      { type: 'h3', text: '12.4 General' }, { type: 'p', text: specPara },
      { type: 'h3', text: '12.5 System Performance' },
      { type: 'h4', text: '12.5.1 General' }, { type: 'p', text: specPara },
      { type: 'h4', text: '12.5.2 Design' }, { type: 'p', text: specPara },
      { type: 'h3', text: '12.6 Products' },
      { type: 'h4', text: '12.6.1 Control Panels General' }, { type: 'p', text: specPara },
      { type: 'h4', text: '12.6.2 Control Panel Design' }, { type: 'p', text: specPara },
      { type: 'h4', text: '12.6.3 Control Panel Power Wiring' }, { type: 'p', text: specPara },
      { type: 'h4', text: '12.6.4 Control Panel Wiring' }, { type: 'p', text: specPara },
      { type: 'h4', text: '12.6.5 Control Panel Construction' }, { type: 'p', text: specPara },
      { type: 'h4', text: '12.6.6 Control Panel Labelling' }, { type: 'p', text: specPara },
      { type: 'h4', text: '12.6.7 Control Panel Drawings' }, { type: 'p', text: specPara },
      { type: 'h3', text: '12.7 Communications Network General' },
      { type: 'h4', text: '12.7.1 Communications Network Configuration' }, { type: 'p', text: specPara },
      { type: 'h4', text: '12.7.2 Outstation And Field Controllers General' }, { type: 'p', text: specPara },
      { type: 'h4', text: '12.7.3 Field Devices General' }, { type: 'p', text: specPara },
      { type: 'h4', text: '12.7.4 Field Devices Control Valves' }, { type: 'p', text: specPara },
      { type: 'h4', text: '12.7.5 Field Devices Electricity Metering' }, { type: 'p', text: specPara },
      { type: 'h3', text: '12.8 Miscellaneous Equipment' },
      { type: 'h4', text: '12.8.1 General Principles' }, { type: 'p', text: specPara },
      { type: 'h4', text: '12.8.2 Generator' }, { type: 'p', text: specPara },
      { type: 'h4', text: '12.8.3 Main LV Switchboards' }, { type: 'p', text: specPara },
      { type: 'h4', text: '12.8.4 Transformer Room' }, { type: 'p', text: specPara },
      { type: 'h4', text: '12.8.5 Fire Alarm System' }, { type: 'p', text: specPara },
      { type: 'h4', text: '12.8.6 Emergency Lighting System' }, { type: 'p', text: specPara },
      { type: 'h4', text: '12.8.7 Security Control Systems' }, { type: 'p', text: specPara },
      { type: 'h4', text: '12.8.8 Weather Station' }, { type: 'p', text: specPara },
      { type: 'h3', text: '12.9 Completion' },
      { type: 'h4', text: '12.9.1 Inspection And Testing' }, { type: 'p', text: specPara },
      { type: 'h4', text: '12.9.2 Pre-Commissioning General' }, { type: 'p', text: specPara },
      { type: 'h4', text: '12.9.3 Pre-Commissioning Plant Ready For Control System' }, { type: 'p', text: specPara },
      { type: 'h3', text: '12.10 Commissioning' },
      { type: 'h4', text: '12.10.1 Commissioning General' }, { type: 'p', text: specPara },
      { type: 'h4', text: '12.10.2 Commissioning Operation Of Building Services Plant' }, { type: 'p', text: specPara },
      { type: 'h4', text: '12.10.3 Commissioning Tests On Completion' }, { type: 'p', text: specPara },
      { type: 'h4', text: '12.10.4 Keys' }, { type: 'p', text: specPara },
      { type: 'h4', text: '12.10.5 Documentation' }, { type: 'p', text: specPara },
      { type: 'h4', text: '12.10.6 Workmanship' }, { type: 'p', text: specPara },
      { type: 'h4', text: '12.10.7 Network Equipment And Server Coordination' }, { type: 'p', text: specPara }
    ];
    
    let sectionIndex = 0;
    
    const addSection = () => {
      try {
        if (sectionIndex >= specSections.length) return;
        
        // #region agent log
        if (sectionIndex < 5 || sectionIndex % 50 === 0) {
        }
        // #endregion
        
        const section = specSections[sectionIndex];
      // Use proper semantic HTML elements
      const tagName = ['h2', 'h3', 'h4'].includes(section.type) ? section.type : 'p';
      const el = document.createElement(tagName);
      el.textContent = section.text;
      
      // Apply inline styles - h2 prominent, h3/h4 subsections, p paragraphs
      if (section.type === 'h2') {
        // Main section headers - teal, bold, larger
        el.style.cssText = 'opacity: 0; font-size: 9pt; font-weight: bold; margin: 10pt 0 4pt 0; color: #156082; transition: opacity 0.15s ease;';
      } else if (section.type === 'h3') {
        // Subsection headers - dark, medium
        el.style.cssText = 'opacity: 0; font-size: 7pt; font-weight: bold; margin: 6pt 0 2pt 0; color: #333; transition: opacity 0.15s ease;';
      } else if (section.type === 'h4') {
        // Sub-subsection headers - smaller, indented feel
        el.style.cssText = 'opacity: 0; font-size: 6.5pt; font-weight: 600; margin: 3pt 0 1pt 0; color: #444; transition: opacity 0.15s ease;';
      } else {
        // Paragraphs - the spec content
        el.style.cssText = 'opacity: 0; font-size: 6pt; line-height: 1.35; margin: 0 0 4pt 0; text-align: justify; color: #555; transition: opacity 0.15s ease;';
      }
      
      // Find a page with room - ALWAYS prefer contentPaper first, then use overflow system
      // This ensures content stays in document order
      let targetPage = contentPaper;
      
      // Only use findOrCreatePageWithRoom if contentPaper is full (10+ children)
      if (contentPaper.children.length >= 10 && window.findOrCreatePageWithRoom) {
        targetPage = window.findOrCreatePageWithRoom();
      }
      
      // Remove empty placeholder if it's the only child (keeps content in proper order)
      if (targetPage.children.length === 1) {
        const firstChild = targetPage.children[0];
        if (firstChild.tagName === 'P' && (!firstChild.textContent || firstChild.textContent.trim() === '')) {
          firstChild.remove();
        }
      }
      
      targetPage.appendChild(el);
      
      // Ensure column layout is applied (in case CSS didn't apply)
      if (!targetPage.style.columnCount) {
        targetPage.style.columnCount = '2';
        targetPage.style.columnGap = '15px';
        targetPage.style.columnFill = 'auto';
      }
      
      // #region agent log
      // #endregion
      
      // Fade in after append
      requestAnimationFrame(() => {
        el.style.opacity = '1';
        
        // Trigger IMMEDIATE overflow check to create new pages if needed
        // Use immediate check (not debounced) to prevent bleeding
        if (window.immediateOverflowCheck) {
          window.immediateOverflowCheck();
        } else if (window.scheduleOverflowCheck) {
          window.scheduleOverflowCheck();
        }
        
        // #region agent log
        // Log position info for first few elements
        if (sectionIndex <= 5) {
          const rect = el.getBoundingClientRect();
          const paperRect = contentPaper.getBoundingClientRect();
            index:sectionIndex,
            type:section.type,
            elTop:rect.top - paperRect.top,
            elBottom:rect.bottom - paperRect.top,
            paperHeight:paperRect.height,
            scrollHeight:contentPaper.scrollHeight
          },timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H3'})}).catch(()=>{});
        }
        // #endregion
      });
      
      sectionIndex++;
      
      // Continue adding sections - very fast for full spec simulation
      if (sectionIndex < specSections.length) {
        const delay = section.type === 'h2' ? 80 : section.type === 'p' ? 20 : 35; // Faster cascade
        setTimeout(addSection, delay);
      } else {
        // #region agent log
        // #endregion
      }
    } catch (err) {
        // Log error and continue with next section
        sectionIndex++;
        if (sectionIndex < specSections.length) {
          setTimeout(addSection, 50);
        }
  END OF DEAD CODE */

  /**
   * Update an individual agent's progress ring (SVG circle)
   */
  function updateIndividualProgressRing(agentKey, progress) {
    const historyList = document.getElementById('chatHistoryIndex8');
    if (!historyList) return;
    
    const agentItem = historyList.querySelector(`[data-conversation="${agentKey}"]`);
    if (!agentItem) return;
    
    const ringFill = agentItem.querySelector('.agent-progress-ring .ring-fill');
    if (!ringFill) return;
    
    // SVG circle: circumference = 2 * PI * r = 2 * 3.14159 * 6 = 37.7
    const circumference = 37.7;
    const offset = circumference - (progress * circumference);
    ringFill.style.strokeDashoffset = offset;
  }
  
  /**
   * Mark agent as complete - update UI
   */
  function markAgentComplete(agentKey) {
    const historyList = document.getElementById('chatHistoryIndex8');
    if (!historyList) return;
    
    const agentItem = historyList.querySelector(`[data-conversation="${agentKey}"]`);
    if (agentItem) {
      agentItem.classList.add('complete');
      agentItem.classList.remove('spawning');
      
      const preview = agentItem.querySelector('.demo-history-item-preview');
      if (preview) {
        const readyTexts = {
          'introduction': 'Ready to write',
          'drainage': 'Analysis ready',
          'water': 'Systems mapped',
          'heating': 'HVAC ready',
          'ventilation': 'Layout ready',
          'controls': 'BMS ready',
          'containment': 'Routes planned',
          'power': 'Distribution ready',
          'lighting': 'Lux calculated',
          'firealarms': 'Zones ready',
          'security': 'Access ready'
        };
        preview.textContent = readyTexts[agentKey] || 'Ready';
      }
    }
    
    // Also save completed state
    const els = getElements();
    if (conversationStates[agentKey]?.chatHTML) {
      conversationStates[agentKey].completed = true;
    }
  }
  
  /**
   * Get current animation state for an agent
   */
  function getAgentAnimationState(agentKey) {
    const state = agentAnimationStates[agentKey];
    if (!state) {
      return { progress: 0, currentStep: 0, totalSteps: 0, completed: false, steps: [] };
    }
    
    const now = Date.now();
    const elapsed = Math.max(0, now - state.startTime);
    const progress = Math.min(elapsed / state.duration, 1);
    
    return {
      progress,
      currentStep: Math.floor(progress * state.totalSteps),
      totalSteps: state.totalSteps,
      completed: state.completed,
      steps: state.steps,
      elapsed,
      duration: state.duration,
      startTime: state.startTime
    };
  }
  
  // ============================================
  // CONVERSATION DATA
  // Per chat-step-strategy.md:
  // - Thinking steps: dot icon, no +/-, no filename
  // - Action steps: pencil icon, +/- box, filename
  // ============================================
  
  const conversations = {
    // Specbuilder Manager - Onboarding conversation
    manager: {
      messages: [
        { type: 'bot', text: 'Welcome to <span class="brand-build">BUILD</span> <span class="brand-variant">X</span><span class="brand-dot">.</span><br><br>I can see the project data from the connected project. Do you want me to build the MEP spec based on the contract?' }
      ],
      thinkingSequence: [
        { text: 'Detecting structure...', type: 'think' },
        { text: 'Detecting formatting format...', type: 'think' },
        { text: 'Detecting services...', type: 'think' },
        { text: 'Detecting contract type...', type: 'think' },
        { text: 'Employing designers...', type: 'think' },
        { text: 'Done. Agents employed.', type: 'done' }
      ],
      finalMessage: 'Done. Agents employed.<br><br>Please see individual section agents for their comments.',
      readyPrompt: ''
    },
    
    // Introduction section
    introduction: {
      messages: [
        { type: 'bot', text: 'I\'m preparing the introduction section for your specification. This will include the project overview, scope of works, and general requirements.' },
        { type: 'thinking', steps: [
          { text: 'Loading project metadata...', type: 'think' },
          { text: 'Identifying contract type: NEC4 ECC Option A.', type: 'think' },
          { text: 'Reading Works Information requirements.', type: 'think' },
          { text: 'Setting up document structure.', type: 'done' }
        ]},
        { type: 'bot', text: 'Introduction section framework is ready. I\'ve identified this as an <strong>NEC4 ECC Option A</strong> contract. Would you like me to complete the general requirements?' }
      ],
      thinkingSequence: [
        { text: 'Writing general requirements...', type: 'action', changes: '+45', filename: 'specification.docx' },
        { text: 'Adding scope of work...', type: 'action', changes: '+28', filename: 'specification.docx' },
        { text: 'Adding preliminaries...', type: 'action', changes: '+32', filename: 'specification.docx' },
        { text: 'Done.', type: 'done' }
      ],
      finalMessage: 'Introduction section complete. General requirements, scope of work, and preliminaries have been added to the specification.',
      readyPrompt: 'Type <strong>"yes"</strong> or <strong>"proceed"</strong> to complete introduction'
    },
    
    drainage: {
      messages: [
        { type: 'user', text: 'Can you design the drainage system?' },
        { type: 'bot', text: 'Of course, let me analyse the project requirements and regulations.' },
        { type: 'thinking', steps: [
          { text: 'Loading project context...', type: 'think' },
          { text: 'Location identified: London, UK.', type: 'think' },
          { text: 'Checking Approved Document H.', type: 'think' },
          { text: 'Checking BS EN 12056-2 for gravity drainage.', type: 'think' },
          { text: 'Checking BS EN 12056-3 for roof drainage.', type: 'think' },
          { text: 'Reviewing local water authority requirements.', type: 'think' },
          { text: 'Loading company standard.', type: 'think' },
          { text: 'Checking similar project approaches.', type: 'think' },
          { text: 'Client preference found: SVPs to be boxed in risers.', type: 'think' },
          { text: 'Finding rooms from Revit model...', type: 'think' },
          { text: '24 rooms found requiring drainage.', type: 'think' },
          { text: 'Checking number of sanitary outlets per room.', type: 'think' },
          { text: 'Calculating discharge units per BS EN 12056.', type: 'think' },
          { text: 'Checking for additional drainage requirements.', type: 'think' },
          { text: 'Reading project specification...', type: 'think' },
          { text: 'Calculating condensate connection requirements.', type: 'think' },
          { text: 'Looking for civil engineering pop-up information...', type: 'think' },
          { text: 'Civil data not found in project folder.', type: 'error' },
          { text: 'Stopped — awaiting civil data.', type: 'done' }
        ]},
        { type: 'bot', text: 'I\'ve analysed the project against <strong>Approved Document H</strong> and <strong>BS EN 12056</strong>. Local authority requirements and similar projects checked. Client preference for boxed SVPs noted.<br><br>However, I need the civil engineering information to locate the drainage pop-ups. Do you have this available?' },
        { type: 'user', text: 'Yes, sorry just added to the folder now.' },
        { type: 'thinking', steps: [
          { text: 'Continuing analysis...', type: 'think' },
          { text: 'Reading civil engineering drawings.', type: 'think' },
          { text: 'Parsing drainage pop-up locations from civil data.', type: 'think' },
          { text: 'Cross-referencing with room layout requirements.', type: 'think' },
          { text: 'Pop-up locations differ from optimal positions.', type: 'think' },
          { text: 'Checking if relocation is feasible per Approved Doc H.', type: 'think' },
          { text: 'Placing pop-up markers on drawing for review.', type: 'action', changes: '+366', filename: 'drainage-layout.rvt' },
          { text: 'Analysis complete.', type: 'done' }
        ]},
        { type: 'bot', text: 'I\'ve cross-referenced the civil pop-up locations with the room requirements. Some positions differ from optimal — I\'ve marked these for your review.<br><br>Ready to proceed with the full drainage design when you are.' }
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
      chatMessages: document.getElementById('chatMessagesIndex8'),
      persistentNode: document.getElementById('chatPersistentNodeIndex8'),
      chatInput: document.getElementById('chatInputIndex8'),
      chatSend: document.getElementById('chatSendIndex8')
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
    // Static containers are complete (finished thinking) - need 'complete' class for thought-trail to show
    container.className = 'thinking-container' + (isCollapsed ? ' visible complete' : '');
    
    // For collapsed (static history), steps start hidden. For animated, steps start hidden too.
    const stepsHtml = steps.map(step => buildStepHtml(step, 'visible')).join('');
    
    // Calculate thinking time based on actual animation timing (TIMING.stepReveal per step + overhead)
    const animationMs = (steps.length * TIMING.stepReveal) + 1500; // 350ms per step + 1.5s overhead
    const thinkingSeconds = Math.round(animationMs / 1000);
    const thinkingMins = Math.floor(thinkingSeconds / 60);
    const thinkingSecs = thinkingSeconds % 60;
    const thinkingTimeText = thinkingMins > 0 
      ? `${thinkingMins}m ${thinkingSecs}s` 
      : `${thinkingSecs}s`;
    
    // Static containers: steps start collapsed, only header + thought-trail visible
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
      <div class="thought-trail">
        <div class="thought-trail-header">
          <span class="thought-trail-label">Thought for <span class="thought-duration">${thinkingTimeText}</span></span>
          <span class="thought-trail-expand">▼</span>
        </div>
        <div class="thought-trail-content">
          <p>Analysis complete. Generated ${steps.length} processing steps.</p>
        </div>
      </div>
    `;
    
    // Add click handler for expand/collapse steps
    const header = container.querySelector('.thinking-header');
    const toggle = container.querySelector('.steps-toggle');
    const stepsList = container.querySelector('.steps-list');
    
    header.style.cursor = 'pointer';
    header.dataset.clickInitialized = 'true'; // Mark as initialized to prevent duplicate handlers
    header.addEventListener('click', function() {
      toggle.classList.toggle('expanded');
      // Toggle 'expanded' to show/hide all steps
      stepsList.classList.toggle('expanded');
      // When expanding, show all steps
      if (stepsList.classList.contains('expanded')) {
        stepsList.querySelectorAll('li').forEach(li => li.classList.add('visible'));
      }
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
    
    // Create steps WITHOUT 'visible' class - they start hidden and are revealed one at a time
    const stepsHtml = steps.map(step => buildStepHtml(step, '')).join('');
    
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
    
    // Expand steps list immediately (like working website version)
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
      // Scroll to bottom after each step (matches working website)
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
    if (thoughtTrail && thoughtHeader && !thoughtHeader.dataset.clickInitialized) {
      thoughtHeader.dataset.clickInitialized = 'true';
      thoughtHeader.style.cursor = 'pointer';
      thoughtHeader.addEventListener('click', () => {
        thoughtTrail.classList.toggle('expanded');
        // Don't scroll - let user read in place
      });
    }
    
    await sleep(500);
    
    // === STEP 7: Collapse to show only header + thought-trail ===
    stepsList.classList.remove('expanded');
    toggle.classList.remove('expanded');
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
          // Remove the entire files changed section (will call actual undo later)
          filesSection.remove();
        });
      }
      
      if (keepAllBtn) {
        keepAllBtn.addEventListener('click', () => {
          // Just remove the action buttons, keep the files list visible
          if (filesActions) filesActions.remove();
        });
      }
    }
    
    // === STEP 9: Add expand/collapse handler (use standard handler attachment) ===
    initThinkingContainerHandlers(thinkingContainer);
    
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
    try {
      const els = getElements();
      const chatEl = els.chatMessages;
      
      if (!chatEl) {
        console.error('View4Chat: chatMessagesIndex8 not found - check if DOM is ready');
        return;
      }
      
      const conversation = conversations[conversationKey];
      if (!conversation) {
        console.error('View4Chat: conversation not found for:', conversationKey, '- available:', Object.keys(conversations));
        return;
      }
    
    // #region agent log
    // #endregion
    
    // Save current conversation state before switching (if not already saved as completed)
    // Only save if we're actually switching to a DIFFERENT conversation
    if (activeConversation && activeConversation !== conversationKey && !conversationStates[activeConversation]?.completed) {
      conversationStates[activeConversation] = {
        completed: false,
        chatHTML: chatEl.innerHTML
      };
    }
    
    activeConversation = conversationKey;
    
    // Check if we have saved state for this conversation
    const savedState = conversationStates[conversationKey];
    // #region agent log
    // #endregion
    if (savedState && savedState.chatHTML) {
      // Restore saved state
      chatEl.innerHTML = savedState.chatHTML;
      chatEl.scrollTop = chatEl.scrollHeight;
      // Clear clickInitialized so handlers can be re-added (innerHTML doesn't preserve listeners)
      chatEl.querySelectorAll('.thinking-header[data-click-initialized]').forEach(header => {
        delete header.dataset.clickInitialized;
      });
      // Re-attach click handlers for thinking containers
      initThinkingContainerHandlers(chatEl);
      return;
    }
    
    // No saved state - check if background animation is running
    chatEl.innerHTML = '';
    
    // Check if this is an agent with a background animation (running or just completed)
    const animState = getAgentAnimationState(conversationKey);
    const hasAnimation = globalAnimationStartTime && animState.totalSteps > 0;
    
    // #region agent log
    // #endregion
    
    if (hasAnimation) {
      // === LIVE ANIMATION MODE ===
      // Show the animation at its current live position and continue from there
      // If completed, will show full animation immediately and then final message
      // #region agent log
      // #endregion
      renderLiveAnimation(chatEl, conversationKey, animState);
      return;
    }
    
    // #region agent log
    // #endregion
    
    // For agent chats (not manager), if animations haven't started yet, show EMPTY chat
    // Only the manager should show its welcome message before animations start
    if (conversationKey !== 'manager' && !globalAnimationStartTime) {
      // #region agent log
      // #endregion
      // Leave chat empty - waiting for animations to start
      return;
    }
    
    // Add messages (manager welcome or standard mode after animations complete)
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
    
    // Ready prompt removed per user request
    
    chatEl.scrollTop = chatEl.scrollHeight;
    
    // Don't reset video/GIF when switching conversations - persist until page refresh
    // User can see the completed output while browsing other chat contexts
    } catch (error) {
      console.error('View4Chat: Error loading conversation:', conversationKey, error);
    }
  }
  
  /**
   * Render a live animation at its current position.
   * Shows user prompt "Can you do the X section?" then thinking steps at live position.
   */
  async function renderLiveAnimation(chatEl, conversationKey, animState) {
    const conversation = conversations[conversationKey];
    if (!conversation) return;
    
    const steps = conversation.thinkingSequence || [];
    
    // === STEP 1: Add user prompt message ===
    const userPrompt = agentUserPrompts[conversationKey] || 'Can you do this section please?';
    const userMsg = document.createElement('div');
    userMsg.className = 'demo-msg-user';
    userMsg.innerHTML = '<p>' + userPrompt + '</p>';
    chatEl.appendChild(userMsg);
    
    // === STEP 2: Create thinking container using SAME format as runNeuralNodeWorkflow ===
    const thinkingContainer = document.createElement('div');
    thinkingContainer.className = 'thinking-container visible';
    
    // Build steps HTML with visibility based on current progress
    const visibleSteps = Math.min(animState.currentStep + 1, steps.length);
    const stepsHtml = steps.map((step, i) => {
      const visibleClass = i < visibleSteps ? 'visible' : '';
      const hiddenClass = i < visibleSteps - 2 && i > 0 ? 'preview-hidden' : '';
      return buildStepHtml(step, `${visibleClass} ${hiddenClass}`);
    }).join('');
    
    const currentStepText = visibleSteps > 0 && steps[visibleSteps - 1] 
      ? steps[visibleSteps - 1].text 
      : 'Thinking...';
    
    thinkingContainer.innerHTML = `
      <div class="thinking-header">
        <div class="thinking-header-left">
          <div class="pulsing-node"></div>
          <span class="steps-count">${visibleSteps} steps</span>
        </div>
        <div class="steps-toggle expanded">
          <span class="chevron">⌃</span>
        </div>
      </div>
      <ul class="steps-list expanded">
        ${stepsHtml}
      </ul>
      <div class="thought-status">
        <span class="thought-status-text">${currentStepText}</span>
      </div>
    `;
    
    chatEl.appendChild(thinkingContainer);
    chatEl.scrollTop = chatEl.scrollHeight;
    
    // === STEP 3: Continue animation from current position ===
    await continueLiveAnimation(chatEl, conversationKey, steps, visibleSteps, thinkingContainer, animState);
  }
  
  /**
   * Continue animation from current position until complete
   */
  async function continueLiveAnimation(chatEl, conversationKey, steps, startFromStep, container, animState) {
    const conversation = conversations[conversationKey];
    const stepsList = container.querySelector('.steps-list');
    const stepEls = stepsList.querySelectorAll('li');
    const stepsCount = container.querySelector('.steps-count');
    const thoughtStatusText = container.querySelector('.thought-status-text');
    const header = container.querySelector('.thinking-header');
    
    // Calculate time remaining per step
    const timeRemaining = Math.max(0, animState.duration - animState.elapsed);
    const stepsRemaining = steps.length - startFromStep;
    const timePerStep = stepsRemaining > 0 ? Math.min(timeRemaining / stepsRemaining, TIMING.stepReveal) : TIMING.stepReveal;
    
    // Continue revealing steps from current position
    for (let i = startFromStep; i < steps.length; i++) {
      // Check if animation was completed in background
      const currentState = getAgentAnimationState(conversationKey);
      if (currentState.completed && i < steps.length - 1) {
        // Fast-forward to completion
        for (let j = i; j < steps.length; j++) {
          if (stepEls[j]) {
            stepEls[j].classList.add('visible');
          }
        }
        stepsCount.textContent = `${steps.length} steps`;
        break;
      }
      
      const currentStep = steps[i];
      if (thoughtStatusText) {
        thoughtStatusText.textContent = currentStep.text;
      }
      
      if (stepEls[i]) {
        stepEls[i].classList.add('visible');
        stepEls[i].classList.remove('preview-hidden');
      }
      
      // Hide older steps
      if (i >= 2 && stepEls[i - 2] && i - 2 > 0) {
        stepEls[i - 2].classList.add('preview-hidden');
      }
      
      stepsCount.textContent = `${i + 1} steps`;
      chatEl.scrollTop = chatEl.scrollHeight;
      
      await sleep(timePerStep);
    }
    
    // === Animation complete ===
    header.classList.add('done');
    container.classList.add('complete');
    
    // Add thought trail
    const elapsed = Date.now() - animState.startTime;
    const durationSec = Math.round(elapsed / 1000);
    const trailDiv = document.createElement('div');
    trailDiv.className = 'thought-trail';
    trailDiv.innerHTML = `
      <div class="thought-trail-header">
        <span class="thought-trail-label">Thought for <span class="thought-duration">${durationSec}s</span></span>
        <span class="thought-trail-expand">▼</span>
      </div>
    `;
    container.appendChild(trailDiv);
    
    await sleep(TIMING.collapse);
    
    // Collapse steps
    stepsList.classList.remove('expanded');
    container.querySelector('.steps-toggle').classList.remove('expanded');
    
    await sleep(TIMING.collapse);
    
    // Add the final message
    const botMsg = document.createElement('div');
    botMsg.className = 'demo-msg-bot';
    botMsg.style.opacity = '0';
    botMsg.style.transform = 'translateY(10px)';
    botMsg.style.transition = 'opacity 0.8s ease, transform 0.8s ease';
    botMsg.innerHTML = '<p>' + conversation.finalMessage + '</p>';
    chatEl.appendChild(botMsg);
    chatEl.scrollTop = chatEl.scrollHeight;
    
    await sleep(50);
    botMsg.style.opacity = '1';
    botMsg.style.transform = 'translateY(0)';
    
    // Save completed state
    conversationStates[conversationKey] = {
      completed: true,
      chatHTML: chatEl.innerHTML
    };
    
    // Re-attach handlers
    initThinkingContainerHandlers(container);
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
    
    if (isAnimating) {
      return;
    }
    
    const els = getElements();
    const inputEl = els.chatInput;
    const chatEl = els.chatMessages;
    
    if (!inputEl || !chatEl) {
      return;
    }
    
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
    
    // Check for proceed commands (including "Finish Specification" from Tab completion)
    if (input === 'yes' || input === 'proceed' || input === 'y' || input === 'ok' || input === 'finish specification' || input === 'finish spec') {
      // Check if command already completed for this conversation
      if (conversationStates[activeConversation]?.completed) {
        await sleep(300);
        addMessageWithAnimation(chatEl, 'demo-msg-bot', '<p>I\'m sorry, this command has already been completed. Please select a different chat context from the history.</p>');
        chatEl.scrollTop = chatEl.scrollHeight;
        return;
      }
      
      // Handle manager onboarding differently
      if (activeConversation === 'manager') {
        await runOnboardingFlow();
      } else {
        await runNeuralNodeWorkflow();
      }
      
      // Save completed state for this conversation
      conversationStates[activeConversation] = {
        completed: true,
        chatHTML: chatEl.innerHTML
      };
    } else {
      await sleep(300);
      // Removed automatic prompt messages - user requested removal
      chatEl.scrollTop = chatEl.scrollHeight;
    }
  }
  
  // ============================================
  // INITIALIZATION
  // ============================================
  
  function init() {
    try {
      // Verify required DOM elements exist
      const els = getElements();
      if (!els.chatMessages) {
        console.error('View4Chat: Required element chatMessagesIndex8 not found - init aborted');
        return;
      }
      
      // Hide all agent items initially (they spawn during onboarding)
      const agentItems = document.querySelectorAll('#chatHistoryIndex8 .demo-history-item.agent-item');
      agentItems.forEach(item => {
        item.classList.add('hidden');
      });
      
      // History item clicks - conversation switching
      document.addEventListener('click', function(e) {
        const historyItem = e.target.closest('#chatHistoryIndex8 .demo-history-item');
        if (!historyItem) return;
        
        // Don't allow clicking hidden agent items
        if (historyItem.classList.contains('hidden')) return;
        
        // Don't allow switching during INITIAL onboarding (before agents spawn)
        // Once globalAnimationStartTime is set (agents spawning), allow switching
        if (isAnimating && !globalAnimationStartTime) {
          // #region agent log
          // #endregion
          return;
        }
        
        // Update active state
        document.querySelectorAll('#chatHistoryIndex8 .demo-history-item').forEach(i => i.classList.remove('active'));
        historyItem.classList.add('active');
        
        // Load conversation
        const system = historyItem.getAttribute('data-system') || historyItem.getAttribute('data-conversation');
        if (system && conversations[system]) {
          loadConversation(system);
        }
      });
      
      // Send button click
      document.addEventListener('click', function(e) {
        if (e.target.closest('#chatSendIndex8')) {
          handleChatSend(e);
        }
      });
      
      // Enter key in input (works for both input and contenteditable)
      document.addEventListener('keydown', function(e) {
        const inputEl = document.getElementById('chatInputIndex8');
        if (e.key === 'Enter' && !e.shiftKey && document.activeElement === inputEl) {
          e.preventDefault(); // Prevent newline in contenteditable
          handleChatSend(e);
        }
      });
      
      // Initialize global event handlers (only once)
      initGlobalEventHandlers();
      
      // Load the manager conversation on init (onboarding)
      loadConversation('manager');
      
      console.log('View4Chat: Initialization complete - Onboarding ready');
    } catch (error) {
      console.error('View4Chat: Initialization failed:', error);
    }
  }
  
  // ============================================
  // ONBOARDING FLOW - Agent Spawning
  // ============================================
  
  async function runOnboardingFlow() {
    if (isAnimating || onboardingComplete) return;
    isAnimating = true;
    
    const els = getElements();
    const chatEl = els.chatMessages;
    const nodeEl = els.persistentNode;
    
    if (!chatEl || !nodeEl) {
      isAnimating = false;
      return;
    }
    
    const conversation = conversations.manager;
    const steps = conversation.thinkingSequence;
    
    // === STEP 1: Node animation start ===
    nodeEl.classList.add('left');
    await sleep(TIMING.nodeMove);
    await sleep(TIMING.pause);
    nodeEl.classList.add('processing');
    await sleep(200);
    
    // === STEP 2: Create thinking container ===
    const thinkingContainer = document.createElement('div');
    thinkingContainer.className = 'thinking-container';
    
    const stepsHtml = steps.map(step => buildStepHtml(step, '')).join('');
    
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
        <span class="thought-status-text">Detecting structure...</span>
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
    const thoughtStatusText = thinkingContainer.querySelector('.thought-status-text');
    
    toggle.classList.add('expanded');
    stepsList.classList.add('expanded');
    await sleep(200);
    
    // === STEP 3: Reveal steps and spawn agents ===
    for (let i = 0; i < stepEls.length; i++) {
      const currentStep = steps[i];
      if (thoughtStatusText) {
        thoughtStatusText.textContent = currentStep.text;
      }
      
      stepEls[i].classList.add('visible');
      stepEls[i].classList.remove('preview-hidden');
      
      // Hide older steps (except first and previous)
      if (i >= 2) {
        const hideIndex = i - 2;
        if (hideIndex > 0) {
          stepEls[hideIndex].classList.add('preview-hidden');
        }
      }
      
      stepsCount.textContent = `${i + 1} steps`;
      chatEl.scrollTop = chatEl.scrollHeight;
      
      // During "Employing designers..." step, spawn agents
      if (currentStep.text === 'Employing designers...') {
        await spawnAgents();
      }
      
      await sleep(TIMING.stepReveal);
    }
    
    // === STEP 4: Complete ===
    header.classList.add('done');
    thinkingContainer.classList.add('complete');
    await sleep(500);
    
    stepsList.classList.remove('expanded');
    toggle.classList.remove('expanded');
    await sleep(TIMING.collapse);
    
    // === STEP 5: Final message ===
    const botMsg = document.createElement('div');
    botMsg.className = 'demo-msg-bot';
    botMsg.style.opacity = '0';
    botMsg.style.transform = 'translateY(10px)';
    botMsg.style.transition = 'opacity 0.8s ease, transform 0.8s ease';
    botMsg.innerHTML = '<p>' + conversation.finalMessage + '</p>';
    chatEl.appendChild(botMsg);
    chatEl.scrollTop = chatEl.scrollHeight;
    
    await sleep(50);
    botMsg.style.opacity = '1';
    botMsg.style.transform = 'translateY(0)';
    
    // === STEP 6: Node back to idle ===
    await sleep(TIMING.pause);
    nodeEl.classList.remove('left');
    await sleep(TIMING.nodeMove);
    nodeEl.classList.remove('processing');
    
    // Mark onboarding as complete
    onboardingComplete = true;
    conversationStates.manager = {
      completed: true,
      chatHTML: chatEl.innerHTML
    };
    
    // Note: Background animations already started during spawnAgents()
    
    isAnimating = false;
  }
  
  async function spawnAgents() {
    const historyList = document.getElementById('chatHistoryIndex8');
    if (!historyList) return;
    
    const totalAgents = agentSpawnOrder.length;
    let spawnedCount = 0;
    
    for (const agent of agentSpawnOrder) {
      await sleep(agent.delay > 0 ? 300 : 0); // Stagger each spawn
      
      const agentItem = historyList.querySelector(`[data-conversation="${agent.key}"]`);
      if (agentItem) {
        agentItem.classList.remove('hidden');
        agentItem.classList.add('spawning');
        spawnedCount++;
        
        // Update preview text
        const preview = agentItem.querySelector('.demo-history-item-preview');
        if (preview) {
          preview.textContent = agent.preview;
        }
      }
    }
    
    // === START ALL BACKGROUND ANIMATIONS IMMEDIATELY ===
    // All agent workflows start NOW - queued from single manager prompt
    // Progress ring updates as agents complete (0-100%)
    startAllBackgroundAnimations();
  }
  
  // Update the single progress ring based on agent completion
  function updateAgentProgressRing(completedCount, totalCount) {
    const progressRing = document.getElementById('progressRingFill');
    const progressPercent = document.getElementById('progressPercent');
    const progressContainer = document.getElementById('agentProgressContainer');
    
    if (!progressRing || !progressPercent) return;
    
    const percent = Math.round((completedCount / totalCount) * 100);
    const circumference = 2 * Math.PI * 8; // r=8
    const offset = circumference - (percent / 100) * circumference;
    
    progressRing.style.strokeDashoffset = offset;
    progressPercent.textContent = percent + '%';
    
    if (percent >= 100 && progressContainer) {
      progressContainer.classList.add('complete');
    }
  }
  
  // NOTE: Agent completion is handled by markAgentComplete() called from startBackgroundAnimationTimer()
  // Progress ring shows 0-100% as agents complete their workflows
  
  // Initialize global event handlers (called once from init)
  function initGlobalEventHandlers() {
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
  }
  
  // Helper function to initialize click handlers for thinking containers
  function initThinkingContainerHandlers(parentEl) {
    if (!parentEl) return;
    
    // Get all thinking containers - either the element itself or children
    const containers = parentEl.classList && parentEl.classList.contains('thinking-container') 
      ? [parentEl] 
      : parentEl.querySelectorAll('.thinking-container');
    
    containers.forEach(container => {
      const header = container.querySelector('.thinking-header');
      const toggle = container.querySelector('.steps-toggle');
      const stepsList = container.querySelector('.steps-list');
      
      if (header && stepsList && !header.dataset.clickInitialized) {
        header.dataset.clickInitialized = 'true';
        header.style.cursor = 'pointer';
        header.addEventListener('click', function() {
          if (toggle) toggle.classList.toggle('expanded');
          // Toggle 'expanded' to show/hide all steps
          stepsList.classList.toggle('expanded');
          // When expanding, show all steps
          if (stepsList.classList.contains('expanded')) {
            stepsList.querySelectorAll('li').forEach(li => li.classList.add('visible'));
          }
        });
      }
      
      // Add thought trail expand handler (for "Thought for Xm Ys" dropdown)
      const thoughtTrail = container.querySelector('.thought-trail');
      const thoughtHeader = container.querySelector('.thought-trail-header');
      if (thoughtTrail && thoughtHeader && !thoughtHeader.dataset.clickInitialized) {
        thoughtHeader.dataset.clickInitialized = 'true';
        thoughtHeader.style.cursor = 'pointer';
        thoughtHeader.addEventListener('click', (e) => {
          e.stopPropagation(); // Prevent event bubbling
          thoughtTrail.classList.toggle('expanded');
        });
      }
    });
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

