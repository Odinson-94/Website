/* ============================================
   THINKING ANIMATION CONTROLLER
   ============================================
   Extracted from view-controller.js for use in chat interfaces.
   This module provides functions to show AI "thinking" steps
   with animated step reveals and a pulsing indicator.
   
   Usage:
   1. Include thinking-animation.css
   2. Include this script
   3. Add the thinking container HTML structure to your chat
   4. Call ThinkingAnimation.show(container) to start
   5. Call ThinkingAnimation.hide(container) to collapse
   
   HTML Structure required:
   <div class="thinking-container" id="thinkingContainer">
     <div class="thinking-header" id="thinkingHeader">
       <div class="pulsing-node"></div>
       <div class="steps-toggle" id="stepsToggle">
         <span class="chevron">⌃</span>
         <span id="stepsCount">8 steps</span>
       </div>
     </div>
     <ul class="steps-list" id="stepsList">
       <li><span class="step-icon dot">●</span> Step description...</li>
       ...
     </ul>
   </div>
*/

const ThinkingAnimation = (function() {
  'use strict';
  
  // Helper function
  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * Run the full thinking animation sequence
   * @param {HTMLElement} container - The thinking container element
   * @param {Object} options - Animation options
   * @param {number} options.stepDelay - Delay between revealing each step (default: 350ms)
   * @param {boolean} options.autoCollapse - Whether to auto-collapse after completion (default: true)
   * @param {Function} options.onComplete - Callback when animation completes
   */
  async function runAnimation(container, options = {}) {
    const {
      stepDelay = 350,
      autoCollapse = true,
      onComplete = null
    } = options;
    
    const header = container.querySelector('.thinking-header');
    const stepsToggle = container.querySelector('.steps-toggle');
    const stepsList = container.querySelector('.steps-list');
    const stepsCount = container.querySelector('#stepsCount') || container.querySelector('.steps-count');
    
    if (!header || !stepsToggle || !stepsList) {
      console.error('ThinkingAnimation: Missing required elements');
      return;
    }
    
    // Show container
    container.classList.add('visible');
    
    await sleep(200);
    
    // Expand steps
    stepsToggle.classList.add('expanded');
    stepsList.classList.add('expanded');
    
    // Get all steps
    const steps = stepsList.querySelectorAll('li');
    const totalSteps = steps.length;
    let stepNum = totalSteps;
    
    // Reveal steps one by one
    for (let i = 0; i < steps.length; i++) {
      if (stepsCount) {
        stepsCount.textContent = `${stepNum} steps`;
      }
      steps[i].classList.add('visible');
      await sleep(stepDelay);
      stepNum--;
    }
    
    // Mark as done
    header.classList.add('done');
    if (stepsCount) {
      stepsCount.textContent = `${totalSteps} steps`;
    }
    
    if (autoCollapse) {
      await sleep(500);
      
      // Collapse steps
      stepsToggle.classList.remove('expanded');
      stepsList.classList.remove('expanded');
      
      await sleep(400);
      
      // Fade out container
      container.classList.add('collapsing');
      await sleep(300);
      container.classList.remove('visible');
      container.classList.add('hidden');
    }
    
    if (onComplete && typeof onComplete === 'function') {
      onComplete();
    }
  }
  
  /**
   * Show the thinking container (starts expanded)
   * @param {HTMLElement} container - The thinking container element
   */
  function show(container) {
    container.classList.remove('hidden', 'collapsing');
    container.classList.add('visible');
    
    const stepsToggle = container.querySelector('.steps-toggle');
    const stepsList = container.querySelector('.steps-list');
    
    if (stepsToggle) stepsToggle.classList.add('expanded');
    if (stepsList) stepsList.classList.add('expanded');
  }
  
  /**
   * Hide the thinking container with animation
   * @param {HTMLElement} container - The thinking container element
   */
  async function hide(container) {
    const stepsToggle = container.querySelector('.steps-toggle');
    const stepsList = container.querySelector('.steps-list');
    
    // Collapse steps first
    if (stepsToggle) stepsToggle.classList.remove('expanded');
    if (stepsList) stepsList.classList.remove('expanded');
    
    await sleep(400);
    
    container.classList.add('collapsing');
    await sleep(300);
    container.classList.remove('visible');
    container.classList.add('hidden');
    container.classList.remove('collapsing');
  }
  
  /**
   * Reset the thinking container to initial state
   * @param {HTMLElement} container - The thinking container element
   */
  function reset(container) {
    const header = container.querySelector('.thinking-header');
    const stepsToggle = container.querySelector('.steps-toggle');
    const stepsList = container.querySelector('.steps-list');
    const steps = stepsList ? stepsList.querySelectorAll('li') : [];
    
    // Reset classes
    container.classList.remove('visible', 'collapsing', 'hidden');
    if (header) header.classList.remove('done');
    if (stepsToggle) stepsToggle.classList.remove('expanded');
    if (stepsList) stepsList.classList.remove('expanded');
    
    // Reset all steps
    steps.forEach(step => step.classList.remove('visible'));
  }
  
  /**
   * Add a new step to the thinking list dynamically
   * @param {HTMLElement} stepsList - The steps list element
   * @param {string} text - Step text
   * @param {string} iconType - 'dot', 'check', or 'edit'
   * @param {Object} changes - Optional changes object {added: number, removed: number, filename: string}
   */
  function addStep(stepsList, text, iconType = 'dot', changes = null) {
    const li = document.createElement('li');
    
    const iconMap = {
      'dot': '●',
      'check': '✓',
      'edit': '✎'
    };
    
    let html = `<span class="step-icon ${iconType}">${iconMap[iconType] || '●'}</span> ${text}`;
    
    if (changes) {
      html += ` <span class="step-changes">`;
      if (changes.added) html += `<span class="added">+${changes.added}</span> `;
      if (changes.removed) html += `<span class="removed">-${changes.removed}</span>`;
      if (changes.filename) html += `<span class="filename">${changes.filename}</span>`;
      html += `</span>`;
    }
    
    li.innerHTML = html;
    stepsList.appendChild(li);
    
    // Animate in
    requestAnimationFrame(() => {
      li.classList.add('visible');
    });
    
    return li;
  }
  
  // Public API
  return {
    run: runAnimation,
    show: show,
    hide: hide,
    reset: reset,
    addStep: addStep,
    sleep: sleep
  };
})();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ThinkingAnimation;
}

