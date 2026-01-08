/* ============================================
   INDEX PAGE MAIN JAVASCRIPT
   Extracted from index.html
   ============================================ */

// BUILD X Package Panel Initialization (View 11)
(function() {
  // Uses shared packageData from js/buildx-panels.js
  const showPackageInfo = initBuildXPanels({
    leftPanelId: 'buildxRibbonLeft',
    rightPanelId: 'buildxRibbonRight',
    leftContentId: 'buildxRibbonLeftContent',
    rightContentId: 'buildxRibbonRightContent',
    buttonSelector: '.buildx-package-btn[data-package]',
    classSuffix: '',
    defaultPackage: 'X'
  });

  // Show BUILD X by default when View 11 becomes visible
  const buildXOverlay = document.getElementById('buildXOverlay');
  const leftPanel = document.getElementById('buildxRibbonLeft');
  if (buildXOverlay && leftPanel) {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
          if (buildXOverlay.classList.contains('visible') && !leftPanel.classList.contains('has-content')) {
            showPackageInfo('X');
          }
        }
      });
    });
    observer.observe(buildXOverlay, { attributes: true });
  }
})();

// ============================================
// DRAGGABLE/RESIZABLE DEMO CONTAINERS
// ============================================
(function() {
  // ============================================
  // SMART CONTAINER RESIZING
  // When both containers are docked, resizing the inner edge resizes both
  // ============================================
  document.querySelectorAll('.demo-containers-stack').forEach(function(stack) {
    const chatWrapper = stack.querySelector('.demo-chat-wrapper');
    const revitWrapper = stack.querySelector('.demo-revit-wrapper');
    const chatBox = chatWrapper ? chatWrapper.querySelector('.demo-chat-box') : null;
    const revitBox = revitWrapper ? revitWrapper.querySelector('.demo-revit-box') : null;
    
    if (!chatBox || !revitBox) return;
    
    // Store reference to wrappers on boxes for resize logic
    chatBox._wrapper = chatWrapper;
    chatBox._siblingWrapper = revitWrapper;
    chatBox._siblingBox = revitBox;
    chatBox._isLeftSide = false; // Chat is on right
    
    revitBox._wrapper = revitWrapper;
    revitBox._siblingWrapper = chatWrapper;
    revitBox._siblingBox = chatBox;
    revitBox._isLeftSide = true; // Revit is on left
  });
  
  // ============================================
  // DRAGGABLE CHAT/REVIT BOXES with snap-back
  // Shared state for single document listener approach
  // ============================================
  let dragState = null; // { box, wrapper, startX, startY, startLeft, startTop, lastCursorX, lastCursorY }
  
  function initDraggableBox(box, titlebar, wrapper) {
    if (!box || !titlebar) return;
    
    titlebar.addEventListener('mousedown', function(e) {
      // Ignore clicks on actual buttons
      if (e.target.closest('.demo-titlebar-btn')) return;
      
      // Skip if box is in expanded state - let view-controller.js handle it
      if (box.classList.contains('expanded')) return;
      
      // Skip if we're on a resize edge - let resize handler handle it
      const edge = getEdgeForBox(box, e);
      if (edge) return;
      
      // Get current position
      const rect = box.getBoundingClientRect();
      
      // If not already floating, make it floating
      if (!box.classList.contains('free-floating')) {
        box.classList.add('free-floating');
        box.style.left = rect.left + 'px';
        box.style.top = rect.top + 'px';
        box.style.width = rect.width + 'px';
        box.style.height = rect.height + 'px';
      }
      
      // Set shared drag state
      dragState = {
        box: box,
        wrapper: wrapper,
        startX: e.clientX,
        startY: e.clientY,
        startLeft: parseFloat(box.style.left) || rect.left,
        startTop: parseFloat(box.style.top) || rect.top,
        lastCursorX: e.clientX,
        lastCursorY: e.clientY
      };
      
      box.classList.add('dragging');
      e.preventDefault();
    });
  }
  
  // Single document mousemove handler for all draggable boxes
  document.addEventListener('mousemove', function(e) {
    if (!dragState) return;
    
    const { box, wrapper, startX, startY, startLeft, startTop } = dragState;
    
    // Track cursor position
    dragState.lastCursorX = e.clientX;
    dragState.lastCursorY = e.clientY;
    
    // Move box
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    box.style.left = (startLeft + dx) + 'px';
    box.style.top = (startTop + dy) + 'px';
    
    // Show snap indicator when cursor is in top third of wrapper
    if (wrapper) {
      const wrapperRect = wrapper.getBoundingClientRect();
      const cursorInX = e.clientX >= wrapperRect.left && e.clientX <= wrapperRect.right;
      const topThird = wrapperRect.top + (wrapperRect.height / 3);
      const cursorInTopThird = e.clientY >= wrapperRect.top && e.clientY <= topThird;
      
      if (cursorInX && cursorInTopThird) {
        wrapper.classList.add('snap-target');
      } else {
        wrapper.classList.remove('snap-target');
      }
    }
  });
  
  // Single document mouseup handler for all draggable boxes
  document.addEventListener('mouseup', function() {
    if (!dragState) return;
    
    const { box, wrapper, lastCursorX, lastCursorY } = dragState;
    
    box.classList.remove('dragging');
    
    // Always remove snap indicator on mouseup
    if (wrapper) {
      wrapper.classList.remove('snap-target');
      
      // Check for snap-back - cursor must be in top third of wrapper
      const wrapperRect = wrapper.getBoundingClientRect();
      const cursorInX = lastCursorX >= wrapperRect.left && lastCursorX <= wrapperRect.right;
      const topThird = wrapperRect.top + (wrapperRect.height / 3);
      const cursorInTopThird = lastCursorY >= wrapperRect.top && lastCursorY <= topThird;
      
      if (cursorInX && cursorInTopThird && box.classList.contains('free-floating')) {
        // Animate snap back to docked position
        box.classList.add('snapping-back');
        
        box.style.left = wrapperRect.left + 'px';
        box.style.top = wrapperRect.top + 'px';
        box.style.width = wrapperRect.width + 'px';
        box.style.height = wrapperRect.height + 'px';
        
        // After animation, remove floating state
        setTimeout(function() {
          box.classList.remove('free-floating');
          box.classList.remove('snapping-back');
          box.style.left = '';
          box.style.top = '';
          box.style.width = '';
          box.style.height = '';
        }, 300);
      }
    }
    
    // Clear drag state
    dragState = null;
  });
  
  // ============================================
  // RESIZABLE CHAT/REVIT BOXES (from edges)
  // With smart split resizing when both are docked
  // Shared state for single document listener approach
  // ============================================
  let resizeState = null; // { box, edge, isSplit, startX, startY, startWidth, startHeight, startLeft, startTop, startWrapperWidth, startSiblingWidth }
  
  function getEdgeForBox(box, e) {
    const rect = box.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const outsideBuffer = 10;
    const cornerSize = 30;
    const edgeSize = 18; // Larger to capture clicks on scrollbar area
    
    const inLeftCorner = x < cornerSize && x > -outsideBuffer;
    const inRightCorner = x > rect.width - cornerSize && x < rect.width + outsideBuffer;
    const inTopCorner = y < cornerSize && y > -outsideBuffer;
    const inBottomCorner = y > rect.height - cornerSize && y < rect.height + outsideBuffer;
    
    const onTopEdge = y < edgeSize && y > -outsideBuffer;
    const onBottomEdge = y > rect.height - edgeSize && y < rect.height + outsideBuffer;
    const onLeftEdge = x < edgeSize && x > -outsideBuffer;
    const onRightEdge = x > rect.width - edgeSize && x < rect.width + outsideBuffer;
    
    if (inTopCorner && inLeftCorner) return 'nw';
    if (inTopCorner && inRightCorner) return 'ne';
    if (inBottomCorner && inLeftCorner) return 'sw';
    if (inBottomCorner && inRightCorner) return 'se';
    if (onTopEdge && !inLeftCorner && !inRightCorner) return 'n';
    if (onBottomEdge && !inLeftCorner && !inRightCorner) return 's';
    if (onLeftEdge && !inTopCorner && !inBottomCorner) return 'w';
    if (onRightEdge && !inTopCorner && !inBottomCorner) return 'e';
    return null;
  }
  
  function getCursorForEdge(edge) {
    if (!edge) return '';
    if (edge === 'n' || edge === 's') return 'ns-resize';
    if (edge === 'e' || edge === 'w') return 'ew-resize';
    if (edge === 'ne' || edge === 'sw') return 'nesw-resize';
    if (edge === 'nw' || edge === 'se') return 'nwse-resize';
    return '';
  }
  
  function initResizableBox(box) {
    if (!box) return;
    
    // Add resize handle overlays that sit on top of scrollbars
    function addResizeHandles() {
      const handles = ['e', 's', 'se'];
      handles.forEach(function(edge) {
        const handle = document.createElement('div');
        handle.className = 'resize-handle resize-handle-' + edge;
        handle.style.cssText = 'position:absolute;z-index:200;';
        
        if (edge === 'e') {
          // Narrower handle (4px) at the very edge, doesn't overlap scrollbar
          handle.style.cssText += 'top:36px;right:0;width:4px;height:calc(100% - 56px);cursor:ew-resize;';
        } else if (edge === 's') {
          // Narrower handle (4px) at the very edge
          handle.style.cssText += 'bottom:0;left:0;width:100%;height:4px;cursor:ns-resize;';
        } else if (edge === 'se') {
          handle.style.cssText += 'bottom:0;right:0;width:16px;height:16px;cursor:nwse-resize;';
        }
        
        handle.addEventListener('mousedown', function(e) {
          e.preventDefault();
          e.stopPropagation();
          startResize(edge, e);
        });
        
        box.appendChild(handle);
      });
    }
    
    function startResize(edge, e) {
      const siblingBox = box._siblingBox;
      const wrapper = box._wrapper;
      const siblingWrapper = box._siblingWrapper;
      const bothDocked = !box.classList.contains('free-floating') && 
                         !box.classList.contains('expanded') &&
                         siblingBox && !siblingBox.classList.contains('free-floating') &&
                         !siblingBox.classList.contains('expanded');
      
      // Split resize for inner edge
      if (bothDocked && isInnerEdge(edge) && wrapper && siblingWrapper) {
        resizeState = {
          box: box,
          edge: edge,
          isSplit: true,
          startX: e.clientX,
          startWrapperWidth: wrapper.offsetWidth,
          startSiblingWidth: siblingWrapper.offsetWidth
        };
        box.classList.add('dragging');
        document.body.style.cursor = 'ew-resize';
        return;
      }
      
      // Regular resize
      if (!box.classList.contains('free-floating') && !box.classList.contains('expanded')) {
        const rect = box.getBoundingClientRect();
        box.classList.add('dragging');
        box.classList.add('free-floating');
        box.style.left = rect.left + 'px';
        box.style.top = rect.top + 'px';
        box.style.width = rect.width + 'px';
        box.style.height = rect.height + 'px';
      }
      
      resizeState = {
        box: box,
        edge: edge,
        isSplit: false,
        startX: e.clientX,
        startY: e.clientY,
        startWidth: box.offsetWidth,
        startHeight: box.offsetHeight,
        startLeft: parseFloat(box.style.left),
        startTop: parseFloat(box.style.top)
      };
      box.classList.add('dragging');
      document.body.style.cursor = getCursorForEdge(edge);
    }
    
    // Add handles
    addResizeHandles();
    
    // Check if inner edge for split resize
    function isInnerEdge(edge) {
      if (!edge) return false;
      if (box._isLeftSide && edge === 'e') return true;
      if (!box._isLeftSide && edge === 'w') return true;
      return false;
    }
    
    // Update cursor on hover (for edges not covered by handles)
    box.addEventListener('mousemove', function(e) {
      if (resizeState) return;
      if (e.target.classList.contains('resize-handle')) return;
      const edge = getEdgeForBox(box, e);
      box.style.cursor = getCursorForEdge(edge);
    });
    
    box.addEventListener('mouseleave', function() {
      if (!resizeState) box.style.cursor = '';
    });
    
    box.addEventListener('mousedown', function(e) {
      if (e.target.classList.contains('demo-titlebar-btn')) return;
      if (e.target.classList.contains('resize-handle')) return; // Handles do their own thing
      
      const edge = getEdgeForBox(box, e);
      if (!edge) return;
      
      const siblingBox = box._siblingBox;
      const wrapper = box._wrapper;
      const siblingWrapper = box._siblingWrapper;
      // Both boxes must be docked (not free-floating or expanded) for split resize
      const bothDocked = !box.classList.contains('free-floating') && 
                         !box.classList.contains('expanded') &&
                         siblingBox && !siblingBox.classList.contains('free-floating') &&
                         !siblingBox.classList.contains('expanded');
      
      // Split resize mode
      if (bothDocked && isInnerEdge(edge) && wrapper && siblingWrapper) {
        resizeState = {
          box: box,
          edge: edge,
          isSplit: true,
          startX: e.clientX,
          startWrapperWidth: wrapper.offsetWidth,
          startSiblingWidth: siblingWrapper.offsetWidth
        };
        box.classList.add('dragging');
        document.body.style.cursor = 'ew-resize';
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      
      // Regular resize - make floating if needed (but not if already expanded)
      if (!box.classList.contains('free-floating') && !box.classList.contains('expanded')) {
        const rect = box.getBoundingClientRect();
        // Add dragging class FIRST to disable transitions before setting position
        box.classList.add('dragging');
        box.classList.add('free-floating');
        box.style.left = rect.left + 'px';
        box.style.top = rect.top + 'px';
        box.style.width = rect.width + 'px';
        box.style.height = rect.height + 'px';
      }
      
      resizeState = {
        box: box,
        edge: edge,
        isSplit: false,
        startX: e.clientX,
        startY: e.clientY,
        startWidth: box.offsetWidth,
        startHeight: box.offsetHeight,
        startLeft: parseFloat(box.style.left),
        startTop: parseFloat(box.style.top)
      };
      box.classList.add('dragging');
      document.body.style.cursor = getCursorForEdge(edge);
      e.preventDefault();
      e.stopPropagation();
    });
  }
  
  // Single document mousemove for resize
  document.addEventListener('mousemove', function(e) {
    if (!resizeState) return;
    
    const { box, edge, isSplit, startX, startY, startWidth, startHeight, startLeft, startTop, startWrapperWidth, startSiblingWidth } = resizeState;
    
    if (isSplit) {
      const wrapper = box._wrapper;
      const siblingWrapper = box._siblingWrapper;
      if (!wrapper || !siblingWrapper) return;
      
      const dx = e.clientX - startX;
      const totalWidth = startWrapperWidth + startSiblingWidth;
      const minWidth = 200;
      
      let newWrapperWidth = box._isLeftSide ? startWrapperWidth + dx : startWrapperWidth - dx;
      let newSiblingWidth = box._isLeftSide ? startSiblingWidth - dx : startSiblingWidth + dx;
      
      if (newWrapperWidth < minWidth) { newWrapperWidth = minWidth; newSiblingWidth = totalWidth - minWidth; }
      if (newSiblingWidth < minWidth) { newSiblingWidth = minWidth; newWrapperWidth = totalWidth - minWidth; }
      
      wrapper.style.flex = '0 0 ' + (newWrapperWidth / totalWidth * 100) + '%';
      siblingWrapper.style.flex = '0 0 ' + (newSiblingWidth / totalWidth * 100) + '%';
      return;
    }
    
    // Regular resize
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    const minSize = 150;
    
    if (edge.includes('e')) box.style.width = Math.max(minSize, startWidth + dx) + 'px';
    if (edge.includes('w')) {
      const newWidth = Math.max(minSize, startWidth - dx);
      box.style.width = newWidth + 'px';
      box.style.left = (startLeft + startWidth - newWidth) + 'px';
    }
    if (edge.includes('s')) box.style.height = Math.max(minSize, startHeight + dy) + 'px';
    if (edge.includes('n')) {
      const newHeight = Math.max(minSize, startHeight - dy);
      box.style.height = newHeight + 'px';
      box.style.top = (startTop + startHeight - newHeight) + 'px';
    }
    
    const chatMessages = box.querySelector('.demo-chat-messages');
    if (chatMessages) chatMessages.scrollTop = chatMessages.scrollHeight;
  });
  
  // Single document mouseup for resize
  document.addEventListener('mouseup', function() {
    if (!resizeState) return;
    
    const { box } = resizeState;
    box.classList.remove('dragging');
    box.style.cursor = '';
    document.body.style.cursor = '';
    
    const wrapper = box._wrapper;
    if (wrapper) wrapper.classList.remove('snap-target');
    
    const chatMessages = box.querySelector('.demo-chat-messages');
    if (chatMessages) chatMessages.scrollTop = chatMessages.scrollHeight;
    
    resizeState = null;
  });
  
  // Initialize all chat boxes
  document.querySelectorAll('.demo-chat-box').forEach(function(box) {
    const titlebar = box.querySelector('.demo-chat-titlebar');
    const wrapper = box.closest('.demo-chat-wrapper');
    initDraggableBox(box, titlebar, wrapper);
    initResizableBox(box);
  });
  
  // Initialize all revit boxes
  document.querySelectorAll('.demo-revit-box').forEach(function(box) {
    const titlebar = box.querySelector('.demo-revit-titlebar');
    const wrapper = box.closest('.demo-revit-wrapper');
    initDraggableBox(box, titlebar, wrapper);
    initResizableBox(box);
  });
  
  // ============================================
  // CHAT AUTO-SCROLL TO BOTTOM - ALWAYS AT BOTTOM
  // ============================================
  
  function scrollToBottom() {
    document.querySelectorAll('.demo-chat-messages').forEach(function(el) {
      el.scrollTop = el.scrollHeight;
    });
  }
  
  // Scroll immediately
  scrollToBottom();
  
  // Scroll on every animation frame for first 2 seconds to ensure it sticks
  let frameCount = 0;
  function keepScrolling() {
    scrollToBottom();
    frameCount++;
    if (frameCount < 120) { // ~2 seconds at 60fps
      requestAnimationFrame(keepScrolling);
    }
  }
  requestAnimationFrame(keepScrolling);
  
  // Scroll when overlay becomes visible
  const gifOverlay = document.getElementById('gifOverlay');
  if (gifOverlay) {
    new MutationObserver(function() {
      if (gifOverlay.classList.contains('visible')) {
        scrollToBottom();
        setTimeout(scrollToBottom, 50);
        setTimeout(scrollToBottom, 100);
        setTimeout(scrollToBottom, 200);
        setTimeout(scrollToBottom, 500);
      }
    }).observe(gifOverlay, { attributes: true, attributeFilter: ['class'] });
  }
  
  // Scroll on resize - with requestAnimationFrame to wait for layout
  let resizeTimer;
  window.addEventListener('resize', function() {
    clearTimeout(resizeTimer);
    scrollToBottom();
    requestAnimationFrame(scrollToBottom);
    resizeTimer = setTimeout(function() {
      scrollToBottom();
      requestAnimationFrame(scrollToBottom);
    }, 100);
    
    // Keep free-floating boxes within viewport bounds
    document.querySelectorAll('.demo-chat-box.free-floating, .demo-revit-box.free-floating').forEach(function(box) {
      const rect = box.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      
      // Ensure at least 50px of the titlebar stays visible
      let newLeft = parseFloat(box.style.left) || rect.left;
      let newTop = parseFloat(box.style.top) || rect.top;
      
      // Constrain horizontally - keep at least 100px visible
      if (newLeft + rect.width < 100) {
        newLeft = 100 - rect.width;
      }
      if (newLeft > vw - 100) {
        newLeft = vw - 100;
      }
      
      // Constrain vertically - keep titlebar visible (top 40px)
      if (newTop < 0) {
        newTop = 0;
      }
      if (newTop > vh - 40) {
        newTop = vh - 40;
      }
      
      box.style.left = newLeft + 'px';
      box.style.top = newTop + 'px';
    });
  });
  
  // Scroll on load
  window.addEventListener('load', function() {
    scrollToBottom();
    setTimeout(scrollToBottom, 100);
    setTimeout(scrollToBottom, 500);
  });
  
  // If user scrolls up, snap back after 1 second
  document.querySelectorAll('.demo-chat-messages').forEach(function(el) {
    let timer = null;
    el.addEventListener('scroll', function() {
      if (el.scrollHeight - el.scrollTop - el.clientHeight > 20) {
        clearTimeout(timer);
        timer = setTimeout(function() {
          el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
        }, 1000);
      } else {
        clearTimeout(timer);
      }
    });
  });
  
  window.scrollToBottom = scrollToBottom;
})();
