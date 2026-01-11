/**
 * CLASH MANAGER CONTROLLER
 * 
 * Handles:
 * - Sample clash data based on WPF data models
 * - Category selection and results list population
 * - Result selection and detail display
 * - Status update functions (Solve, Accept, Reject)
 * - Close modal functionality
 */

(function() {
  'use strict';

  // ============================================
  // SAMPLE DATA - Based on WPF Models
  // ============================================

  // ClashItem: Individual element in a clash
  function ClashItem(elementId, sourceFile, category, name) {
    return {
      elementId: elementId,
      sourceFile: sourceFile,
      category: category,
      name: name
    };
  }

  // ClashResult: A clash between two items
  function ClashResult(id, name, status, item1, item2, beforeImage, afterImage) {
    return {
      id: id,
      name: name,
      status: status, // 'new', 'active', 'reviewed', 'approved', 'resolved'
      item1: item1,
      item2: item2,
      beforeImage: beforeImage || 'images/demos/Structural - mep through beams.png',
      afterImage: afterImage || 'images/demos/MEP Exposed Services.png'
    };
  }

  // ClashCategory: A test/category containing multiple clash results
  function ClashCategory(id, name, description, results) {
    return {
      id: id,
      name: name,
      description: description,
      results: results || []
    };
  }

  // Sample clash data
  const clashCategories = [
    ClashCategory('mep-structure', 'MEP vs Structure', 'Clashes between MEP services and structural elements', [
      ClashResult(
        'clash-001',
        'Duct vs. Beam L1-B12',
        'new',
        ClashItem('1045782', 'MEP_Model.rvt', 'Ducts', 'Rectangular Duct 600x300'),
        ClashItem('892341', 'Structure_Model.rvt', 'Structural Framing', 'W12x26 Beam'),
        'images/demos/Structural - mep through beams.png',
        'images/demos/MEP Exposed Services.png'
      ),
      ClashResult(
        'clash-002',
        'Pipe vs. Column C-04',
        'active',
        ClashItem('1045891', 'MEP_Model.rvt', 'Pipes', 'DN100 CW Pipe'),
        ClashItem('892455', 'Structure_Model.rvt', 'Structural Columns', 'HSS 8x8 Column'),
        'images/demos/Structural - mep through beams.png',
        'images/demos/MEP Exposed Services.png'
      ),
      ClashResult(
        'clash-003',
        'Cable Tray vs. Beam L2-B08',
        'reviewed',
        ClashItem('1046012', 'MEP_Model.rvt', 'Cable Tray', 'Cable Tray 300mm'),
        ClashItem('892567', 'Structure_Model.rvt', 'Structural Framing', 'W10x22 Beam'),
        'images/demos/Containment though Beams.png',
        'images/demos/MEP Exposed Services.png'
      )
    ]),
    
    ClashCategory('hvac-plumbing', 'HVAC vs Plumbing', 'Clashes between HVAC and plumbing systems', [
      ClashResult(
        'clash-004',
        'Supply Duct vs. Waste Pipe',
        'new',
        ClashItem('1047234', 'MEP_Model.rvt', 'Ducts', 'Rectangular Duct 450x250'),
        ClashItem('1047891', 'MEP_Model.rvt', 'Pipes', 'DN75 Waste Pipe'),
        'images/demos/Structural - mep through beams.png',
        'images/demos/MEP Exposed Services.png'
      ),
      ClashResult(
        'clash-005',
        'Return Duct vs. CW Riser',
        'approved',
        ClashItem('1047345', 'MEP_Model.rvt', 'Ducts', 'Rectangular Duct 500x300'),
        ClashItem('1047956', 'MEP_Model.rvt', 'Pipes', 'DN80 CW Riser'),
        'images/demos/Structural - mep through beams.png',
        'images/demos/MEP Exposed Services.png'
      )
    ]),
    
    ClashCategory('electrical-hvac', 'Electrical vs HVAC', 'Clashes between electrical and HVAC systems', [
      ClashResult(
        'clash-006',
        'Conduit vs. FCU-04',
        'new',
        ClashItem('1048567', 'MEP_Model.rvt', 'Conduit', 'Conduit 25mm'),
        ClashItem('1048234', 'MEP_Model.rvt', 'Mechanical Equipment', 'Fan Coil Unit'),
        'images/demos/Structural - mep through beams.png',
        'images/demos/MEP Exposed Services.png'
      ),
      ClashResult(
        'clash-007',
        'Cable Tray vs. AHU Duct',
        'resolved',
        ClashItem('1048678', 'MEP_Model.rvt', 'Cable Tray', 'Cable Tray 450mm'),
        ClashItem('1048345', 'MEP_Model.rvt', 'Ducts', 'Rectangular Duct 800x400'),
        'images/demos/Containment though Beams.png',
        'images/demos/MEP Exposed Services.png'
      )
    ]),
    
    ClashCategory('fire-protection', 'Fire Protection', 'Clashes involving fire protection systems', [
      ClashResult(
        'clash-008',
        'Sprinkler vs. Lighting',
        'active',
        ClashItem('1049123', 'MEP_Model.rvt', 'Sprinklers', 'Pendent Sprinkler'),
        ClashItem('1049456', 'MEP_Model.rvt', 'Lighting Fixtures', 'LED Panel 600x600'),
        'images/demos/Structural - mep through beams.png',
        'images/demos/MEP Exposed Services.png'
      )
    ])
  ];

  // ============================================
  // STATE
  // ============================================

  let activeCategory = null;
  let activeResult = null;
  let statusFilter = 'all';

  // ============================================
  // DOM ELEMENTS
  // ============================================

  function getElements() {
    return {
      categoryList: document.getElementById('clashCategoryList'),
      resultsList: document.getElementById('clashResultsList'),
      statusFilter: document.getElementById('statusFilter'),
      beforeView: document.getElementById('beforeView'),
      afterView: document.getElementById('afterView'),
      item1ElementId: document.getElementById('item1ElementId'),
      item1SourceFile: document.getElementById('item1SourceFile'),
      item1Category: document.getElementById('item1Category'),
      item1Name: document.getElementById('item1Name'),
      item2ElementId: document.getElementById('item2ElementId'),
      item2SourceFile: document.getElementById('item2SourceFile'),
      item2Category: document.getElementById('item2Category'),
      item2Name: document.getElementById('item2Name'),
      clashCount: document.getElementById('clashCount'),
      clashStatus: document.getElementById('clashStatus'),
      solveBtn: document.getElementById('solveClashBtn'),
      acceptBtn: document.getElementById('acceptBtn'),
      rejectBtn: document.getElementById('rejectBtn'),
      cancelBtn: document.getElementById('cancelBtn'),
      closeBtn: document.getElementById('closeBtn'),
      refreshBtn: document.getElementById('refreshBtn')
    };
  }

  // ============================================
  // RENDER FUNCTIONS
  // ============================================

  function renderCategories() {
    const els = getElements();
    if (!els.categoryList) return;

    const totalClashes = clashCategories.reduce((sum, cat) => sum + cat.results.length, 0);
    if (els.clashCount) {
      els.clashCount.textContent = `${totalClashes} clashes`;
    }

    els.categoryList.innerHTML = clashCategories.map(cat => {
      const isActive = activeCategory && activeCategory.id === cat.id;
      const newCount = cat.results.filter(r => r.status === 'new').length;
      const countLabel = newCount > 0 ? `${cat.results.length} (${newCount} new)` : `${cat.results.length} clashes`;
      
      return `
        <div class="clash-category-item ${isActive ? 'active' : ''}" data-category="${cat.id}">
          <span class="category-title">${cat.name}</span>
          <span class="category-count">${countLabel}</span>
        </div>
      `;
    }).join('');
  }

  function renderResults() {
    const els = getElements();
    if (!els.resultsList) return;

    if (!activeCategory) {
      els.resultsList.innerHTML = '<div class="view-placeholder"><span class="placeholder-text">Select a test category</span></div>';
      return;
    }

    let results = activeCategory.results;
    
    // Apply status filter
    if (statusFilter !== 'all') {
      results = results.filter(r => r.status === statusFilter);
    }

    if (results.length === 0) {
      els.resultsList.innerHTML = '<div class="view-placeholder"><span class="placeholder-text">No clashes match the filter</span></div>';
      return;
    }

    els.resultsList.innerHTML = results.map(result => {
      const isActive = activeResult && activeResult.id === result.id;
      return `
        <div class="clash-result-item ${isActive ? 'active' : ''}" data-result="${result.id}">
          <span class="result-status ${result.status}"></span>
          <span class="result-name">${result.name}</span>
        </div>
      `;
    }).join('');
  }

  function renderResultDetails() {
    const els = getElements();
    
    if (!activeResult) {
      // Reset to placeholder
      if (els.beforeView) {
        els.beforeView.innerHTML = `
          <div class="view-placeholder">
            <span class="placeholder-icon">🔍</span>
            <span class="placeholder-text">Select a clash to view</span>
          </div>
        `;
      }
      if (els.afterView) {
        els.afterView.innerHTML = `
          <div class="view-placeholder">
            <span class="placeholder-icon">✓</span>
            <span class="placeholder-text">Resolution preview</span>
          </div>
        `;
      }
      
      // Reset item details
      ['item1ElementId', 'item1SourceFile', 'item1Category', 'item1Name',
       'item2ElementId', 'item2SourceFile', 'item2Category', 'item2Name'].forEach(id => {
        if (els[id]) els[id].textContent = '—';
      });
      
      // Reset status
      if (els.clashStatus) {
        els.clashStatus.textContent = 'Select a clash to begin';
      }
      
      // Disable action buttons
      if (els.solveBtn) els.solveBtn.disabled = true;
      if (els.acceptBtn) els.acceptBtn.disabled = true;
      if (els.rejectBtn) els.rejectBtn.disabled = true;
      
      return;
    }

    // Render before/after images
    if (els.beforeView) {
      els.beforeView.innerHTML = `
        <img src="${activeResult.beforeImage}" alt="Before" class="view-image">
        <div class="clash-highlight" style="top: 40%; left: 35%; width: 80px; height: 60px;"></div>
      `;
    }
    if (els.afterView) {
      els.afterView.innerHTML = `
        <img src="${activeResult.afterImage}" alt="After" class="view-image">
      `;
    }

    // Render item 1 details
    if (els.item1ElementId) els.item1ElementId.textContent = activeResult.item1.elementId;
    if (els.item1SourceFile) els.item1SourceFile.textContent = activeResult.item1.sourceFile;
    if (els.item1Category) els.item1Category.textContent = activeResult.item1.category;
    if (els.item1Name) els.item1Name.textContent = activeResult.item1.name;

    // Render item 2 details
    if (els.item2ElementId) els.item2ElementId.textContent = activeResult.item2.elementId;
    if (els.item2SourceFile) els.item2SourceFile.textContent = activeResult.item2.sourceFile;
    if (els.item2Category) els.item2Category.textContent = activeResult.item2.category;
    if (els.item2Name) els.item2Name.textContent = activeResult.item2.name;

    // Update status
    if (els.clashStatus) {
      const statusLabels = {
        'new': 'New clash — awaiting review',
        'active': 'Active — in progress',
        'reviewed': 'Reviewed — pending approval',
        'approved': 'Approved — ready to resolve',
        'resolved': 'Resolved'
      };
      els.clashStatus.textContent = statusLabels[activeResult.status] || 'Unknown status';
    }

    // Enable/disable action buttons based on status
    if (els.solveBtn) {
      els.solveBtn.disabled = activeResult.status === 'resolved';
    }
    if (els.acceptBtn) {
      els.acceptBtn.disabled = activeResult.status === 'resolved';
    }
    if (els.rejectBtn) {
      els.rejectBtn.disabled = activeResult.status === 'resolved';
    }
  }

  // ============================================
  // EVENT HANDLERS
  // ============================================

  function handleCategoryClick(categoryId) {
    activeCategory = clashCategories.find(c => c.id === categoryId) || null;
    activeResult = null;
    
    renderCategories();
    renderResults();
    renderResultDetails();
  }

  function handleResultClick(resultId) {
    if (!activeCategory) return;
    
    activeResult = activeCategory.results.find(r => r.id === resultId) || null;
    
    renderResults();
    renderResultDetails();
  }

  function handleStatusFilterChange(newFilter) {
    statusFilter = newFilter;
    activeResult = null;
    
    renderResults();
    renderResultDetails();
  }

  function handleSolveClash() {
    if (!activeResult) return;
    
    // Simulate solving - move to reviewed status
    activeResult.status = 'reviewed';
    
    const els = getElements();
    if (els.clashStatus) {
      els.clashStatus.textContent = 'Solving clash...';
    }
    
    setTimeout(() => {
      renderResults();
      renderResultDetails();
    }, 500);
  }

  function handleAccept() {
    if (!activeResult) return;
    
    // Move through status progression
    const progression = {
      'new': 'active',
      'active': 'reviewed',
      'reviewed': 'approved',
      'approved': 'resolved'
    };
    
    if (progression[activeResult.status]) {
      activeResult.status = progression[activeResult.status];
    }
    
    renderResults();
    renderResultDetails();
    renderCategories(); // Update counts
  }

  function handleReject() {
    if (!activeResult) return;
    
    // Reset to new status
    activeResult.status = 'new';
    
    renderResults();
    renderResultDetails();
    renderCategories();
  }

  function handleClose() {
    // Notify parent window to close modal
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: 'closeClashManager' }, '*');
    } else {
      // Standalone mode - just reload
      window.close();
    }
  }

  function handleRefresh() {
    // Reset active selections
    activeCategory = null;
    activeResult = null;
    statusFilter = 'all';
    
    const els = getElements();
    if (els.statusFilter) {
      els.statusFilter.value = 'all';
    }
    
    renderCategories();
    renderResults();
    renderResultDetails();
  }

  // ============================================
  // INITIALIZATION
  // ============================================

  function init() {
    const els = getElements();

    // Category click handling
    if (els.categoryList) {
      els.categoryList.addEventListener('click', (e) => {
        const item = e.target.closest('.clash-category-item');
        if (item) {
          handleCategoryClick(item.dataset.category);
        }
      });
    }

    // Result click handling
    if (els.resultsList) {
      els.resultsList.addEventListener('click', (e) => {
        const item = e.target.closest('.clash-result-item');
        if (item) {
          handleResultClick(item.dataset.result);
        }
      });
    }

    // Status filter
    if (els.statusFilter) {
      els.statusFilter.addEventListener('change', (e) => {
        handleStatusFilterChange(e.target.value);
      });
    }

    // Action buttons
    if (els.solveBtn) {
      els.solveBtn.addEventListener('click', handleSolveClash);
    }
    if (els.acceptBtn) {
      els.acceptBtn.addEventListener('click', handleAccept);
    }
    if (els.rejectBtn) {
      els.rejectBtn.addEventListener('click', handleReject);
    }
    if (els.cancelBtn) {
      els.cancelBtn.addEventListener('click', handleClose);
    }
    if (els.closeBtn) {
      els.closeBtn.addEventListener('click', handleClose);
    }
    if (els.refreshBtn) {
      els.refreshBtn.addEventListener('click', handleRefresh);
    }

    // Keyboard shortcut for close (Escape)
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    });

    // Initial render
    renderCategories();
    renderResults();
    renderResultDetails();

    // Auto-select first category if available
    if (clashCategories.length > 0) {
      handleCategoryClick(clashCategories[0].id);
    }
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose for external access
  window.ClashManager = {
    getCategories: () => clashCategories,
    getActiveCategory: () => activeCategory,
    getActiveResult: () => activeResult,
    refresh: handleRefresh
  };

})();
