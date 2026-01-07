// ============================================
// TESLA-STYLE MENU HOVER - SINGLE SOURCE OF TRUTH
// All pages MUST use this file for menubar behavior
// ============================================

(function() {
  'use strict';
  
  const menubar = document.getElementById('menubar');
  if (!menubar) return;
  
  const menuLinks = document.querySelectorAll('.menu-link');
  const menuHighlightContainer = document.getElementById('menuHighlight')?.parentElement;
  if (!menuHighlightContainer) return;
  
  // Pool of highlight elements for independent fading
  const highlightPool = [];
  const maxHighlights = 4;
  
  for (let i = 0; i < maxHighlights; i++) {
    const highlight = document.createElement('div');
    highlight.className = 'menu-highlight';
    menuHighlightContainer.insertBefore(highlight, menuHighlightContainer.firstChild);
    highlightPool.push(highlight);
  }
  
  const menuTail = document.getElementById('menuTail');
  
  // Remove original highlight element
  const originalHighlight = document.getElementById('menuHighlight');
  if (originalHighlight) originalHighlight.remove();
  
  let poolIndex = 0;
  let currentHoverTimeout = null;
  let lastHoveredLink = null;
  
  function getNextHighlight() {
    const el = highlightPool[poolIndex];
    poolIndex = (poolIndex + 1) % maxHighlights;
    return el;
  }
  
  function positionElement(el, link) {
    const menubarRect = menubar.getBoundingClientRect();
    const linkRect = link.getBoundingClientRect();
    const x = linkRect.left - menubarRect.left;
    el.style.transform = `translateX(${x}px)`;
    el.style.width = linkRect.width + 'px';
  }
  
  menuLinks.forEach(link => {
    link.addEventListener('mouseenter', () => {
      const highlight = getNextHighlight();
      const isSameLink = lastHoveredLink === link;
      
      // Clear any pending timeout
      if (currentHoverTimeout) {
        clearTimeout(currentHoverTimeout);
        currentHoverTimeout = null;
      }
      
      highlight.classList.remove('fading', 'moving', 'dimming');
      positionElement(highlight, link);
      highlight.classList.add('visible', 'bright');
      
      // After initial bright flash, dim by 5%
      currentHoverTimeout = setTimeout(() => {
        highlight.classList.remove('bright');
        highlight.classList.add('dimming');
      }, 150);
      
      // Only animate tail if moving to a different link
      if (menuTail && !isSameLink) {
        menuTail.classList.remove('fading');
        menuTail.classList.add('moving', 'visible');
        positionElement(menuTail, link);
      } else if (menuTail && isSameLink) {
        // Same link - just show tail without animation
        menuTail.classList.remove('fading', 'moving');
        menuTail.classList.add('visible');
        positionElement(menuTail, link);
      }
      
      lastHoveredLink = link;
    });
    
    link.addEventListener('mouseleave', () => {
      if (currentHoverTimeout) {
        clearTimeout(currentHoverTimeout);
        currentHoverTimeout = null;
      }
      
      highlightPool.forEach(el => {
        if (el.classList.contains('visible')) {
          el.classList.add('fading');
          el.classList.remove('visible', 'bright', 'dimming');
        }
      });
      
      if (menuTail) {
        menuTail.classList.add('fading');
        menuTail.classList.remove('visible');
      }
    });
  });
  
  menubar.addEventListener('mouseleave', () => {
    if (currentHoverTimeout) {
      clearTimeout(currentHoverTimeout);
      currentHoverTimeout = null;
    }
    
    highlightPool.forEach(el => {
      el.classList.add('fading');
      el.classList.remove('visible', 'bright', 'dimming');
    });
    
    if (menuTail) {
      menuTail.classList.add('fading');
      menuTail.classList.remove('visible', 'moving');
    }
  });
})();

