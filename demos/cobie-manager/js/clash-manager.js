/**
 * BUILD X. QA Manager
 * Controller for Quality Assurance error detection and resolution
 */

(function() {
  'use strict';

  // ============================================
  // ERROR TYPES
  // ============================================
  const ERROR_TYPES = {
    CONNECTIVITY: { id: 'connectivity', name: 'Node Disconnected', description: 'Unconnected ends' },
    FIRE_SAFETY: { id: 'fire-safety', name: 'No Fire Damper', description: 'Missing fire dampers' },
    HOSTING: { id: 'hosting', name: 'Hosting Error', description: 'Incorrect element hosting' },
    INSULATION: { id: 'insulation', name: 'Missing Insulation', description: 'No insulation' },
    CLASHES: { id: 'clashes', name: 'Clash', description: 'Coordination issue' },
    DOCUMENTATION: { id: 'documentation', name: 'View Error', description: 'Documentation issue' },
    DATA: { id: 'data', name: 'Data Mismatch', description: 'Parameter inconsistency' },
    BRIEF: { id: 'brief', name: 'Missing Item', description: 'Not in brief' }
  };

  // Sample errors
  const SAMPLE_ERRORS = [
    {
      id: 'ERR-001', elementId: '1234567', name: 'Pipe L1-P-001 disconnected',
      type: ERROR_TYPES.CONNECTIVITY, status: 'new', solvedBy: null, qaBy: null, comments: '',
      category: 'Pipes', family: 'M_Pipe Types', familyType: 'Steel - Schedule 40',
      createdBy: 'J. Smith', createdDate: '2025-11-14', modifiedBy: 'M. Johnson', modifiedDate: '2026-01-08',
      sourceFile: 'MEP_Central.rvt', level: 'Level 01',
      solutions: ['Connect to adjacent fitting', 'Cap off pipe end', 'Extend to equipment']
    },
    {
      id: 'ERR-002', elementId: '2345678', name: 'Duct B12 - No fire damper',
      type: ERROR_TYPES.FIRE_SAFETY, status: 'active', solvedBy: null, qaBy: null, comments: 'Wall FR60',
      category: 'Duct Accessories', family: 'M_Fire Damper', familyType: 'Rectangular',
      createdBy: 'A. Williams', createdDate: '2025-10-22', modifiedBy: 'A. Williams', modifiedDate: '2025-12-19',
      sourceFile: 'MEP_Central.rvt', level: 'Level 02',
      solutions: ['Insert fire damper', 'Reroute ductwork', 'Request derogation']
    },
    {
      id: 'ERR-003', elementId: '3456789', name: 'LT-04 not at ceiling',
      type: ERROR_TYPES.HOSTING, status: 'new', solvedBy: null, qaBy: null, comments: '',
      category: 'Lighting Fixtures', family: 'M_Recessed Downlight', familyType: '150mm LED',
      createdBy: 'K. Chen', createdDate: '2025-12-03', modifiedBy: 'K. Chen', modifiedDate: '2026-01-05',
      sourceFile: 'MEP_Central.rvt', level: 'Level 02',
      solutions: ['Move to ceiling face', 'Adjust ceiling height', 'Change host']
    },
    {
      id: 'ERR-004', elementId: '4567890', name: 'Socket in wall buildup',
      type: ERROR_TYPES.HOSTING, status: 'reviewed', solvedBy: 'T. Brown', qaBy: null, comments: 'Needs review',
      category: 'Electrical Fixtures', family: 'M_Socket Outlet', familyType: 'UK Standard',
      createdBy: 'T. Brown', createdDate: '2025-11-28', modifiedBy: 'T. Brown', modifiedDate: '2026-01-07',
      sourceFile: 'MEP_Central.rvt', level: 'Level 01',
      solutions: ['Move to wall face', 'Create backbox void', 'Use surface mount']
    },
    {
      id: 'ERR-005', elementId: '5678901', name: 'CHW pipe missing insulation',
      type: ERROR_TYPES.INSULATION, status: 'new', solvedBy: null, qaBy: null, comments: '',
      category: 'Pipe Insulation', family: 'Pipe Insulation', familyType: '25mm Armaflex',
      createdBy: 'J. Smith', createdDate: '2025-11-20', modifiedBy: 'J. Smith', modifiedDate: '2025-11-20',
      sourceFile: 'MEP_Central.rvt', level: 'Level 01',
      solutions: ['Apply 25mm insulation', 'Apply 50mm insulation', 'Mark as external']
    },
    {
      id: 'ERR-006', elementId: '6789012', name: 'Clash: Duct vs Beam',
      type: ERROR_TYPES.CLASHES, status: 'active', solvedBy: null, qaBy: null, comments: 'Navisworks',
      category: 'Ducts', family: 'M_Rectangular Duct', familyType: '600x300',
      createdBy: 'System', createdDate: '2026-01-10', modifiedBy: 'System', modifiedDate: '2026-01-10',
      sourceFile: 'MEP_Central.rvt', level: 'Level 02',
      solutions: ['Lower duct routing', 'Request penetration', 'Reduce duct size']
    },
    {
      id: 'ERR-007', elementId: '7890123', name: 'Sheet missing legend',
      type: ERROR_TYPES.DOCUMENTATION, status: 'new', solvedBy: null, qaBy: null, comments: 'E-100',
      category: 'Sheets', family: 'A1 Titleblock', familyType: 'JPA Standard',
      createdBy: 'K. Chen', createdDate: '2026-01-09', modifiedBy: 'K. Chen', modifiedDate: '2026-01-09',
      sourceFile: 'MEP_Central.rvt', level: '-',
      solutions: ['Add electrical legend', 'Link to master legend']
    },
    {
      id: 'ERR-008', elementId: '8901234', name: 'AHU-01 COBie mismatch',
      type: ERROR_TYPES.DATA, status: 'new', solvedBy: null, qaBy: null, comments: 'AssetID empty',
      category: 'Mechanical Equipment', family: 'M_Air Handling Unit', familyType: 'Modular',
      createdBy: 'M. Johnson', createdDate: '2025-10-15', modifiedBy: 'A. Williams', modifiedDate: '2026-01-06',
      sourceFile: 'MEP_Central.rvt', level: 'Roof',
      solutions: ['Populate AssetID', 'Link to asset register', 'Mark as non-asset']
    },
    {
      id: 'ERR-009', elementId: '9012345', name: 'DB-L1-01 power mismatch',
      type: ERROR_TYPES.DATA, status: 'active', solvedBy: null, qaBy: null, comments: '63A vs 100A',
      category: 'Electrical Equipment', family: 'M_Distribution Board', familyType: 'TPN',
      createdBy: 'T. Brown', createdDate: '2025-11-05', modifiedBy: 'K. Chen', modifiedDate: '2026-01-08',
      sourceFile: 'MEP_Central.rvt', level: 'Level 01',
      solutions: ['Update model to 100A', 'Update schedule to 63A', 'Confirm with engineer']
    },
    {
      id: 'ERR-010', elementId: '1123456', name: 'FCU-L2-03 not in register',
      type: ERROR_TYPES.DATA, status: 'new', solvedBy: null, qaBy: null, comments: '',
      category: 'Mechanical Equipment', family: 'M_Fan Coil Unit', familyType: 'Horizontal',
      createdBy: 'M. Johnson', createdDate: '2025-12-18', modifiedBy: 'M. Johnson', modifiedDate: '2025-12-18',
      sourceFile: 'MEP_Central.rvt', level: 'Level 02',
      solutions: ['Add to asset register', 'Update asset tag']
    },
    {
      id: 'ERR-011', elementId: '2234567', name: 'VAV box missing from brief',
      type: ERROR_TYPES.BRIEF, status: 'new', solvedBy: null, qaBy: null, comments: 'Room datasheet',
      category: 'Air Terminals', family: 'M_VAV Box', familyType: 'Pressure Independent',
      createdBy: 'System', createdDate: '2026-01-10', modifiedBy: 'System', modifiedDate: '2026-01-10',
      sourceFile: 'MEP_Central.rvt', level: 'Level 01',
      solutions: ['Add VAV box to model', 'Update room brief']
    },
    {
      id: 'ERR-012', elementId: '3345678', name: 'Sensor missing from asset',
      type: ERROR_TYPES.DATA, status: 'new', solvedBy: null, qaBy: null, comments: '',
      category: 'Sensors', family: 'M_CO2 Sensor', familyType: 'Wall Mounted',
      createdBy: 'A. Williams', createdDate: '2026-01-08', modifiedBy: 'A. Williams', modifiedDate: '2026-01-08',
      sourceFile: 'MEP_Central.rvt', level: 'Level 01',
      solutions: ['Add to asset manager', 'Link to BMS']
    }
  ];

  // ============================================
  // STATE
  // ============================================
  let state = {
    errors: SAMPLE_ERRORS,
    selectedError: null,
    selectedRows: new Set(),
    currentSolutionIndex: 0,
    statusFilter: 'all',
    typeFilter: 'all'
  };

  // ============================================
  // DOM ELEMENTS - Initialized in init()
  // ============================================
  let elements = {};

  function initElements() {
    elements = {
      window: document.getElementById('qaManagerWindow'),
      resultsTableBody: document.getElementById('qaResultsTableBody'),
      selectAll: document.getElementById('qaSelectAll'),
      statusFilter: document.getElementById('qaStatusFilter'),
      typeFilter: document.getElementById('qaTypeFilter'),
      errorCount: document.getElementById('qaErrorCount'),
      
      detailElementId: document.getElementById('qaDetailElementId'),
      detailCategory: document.getElementById('qaDetailCategory'),
      detailFamily: document.getElementById('qaDetailFamily'),
      detailType: document.getElementById('qaDetailType'),
      detailCreatedBy: document.getElementById('qaDetailCreatedBy'),
      detailCreatedDate: document.getElementById('qaDetailCreatedDate'),
      detailModifiedBy: document.getElementById('qaDetailModifiedBy'),
      detailModifiedDate: document.getElementById('qaDetailModifiedDate'),
      detailSourceFile: document.getElementById('qaDetailSourceFile'),
      detailLevel: document.getElementById('qaDetailLevel'),
      
      beforeView: document.getElementById('qaBeforeView'),
      afterView: document.getElementById('qaAfterView'),
      afterViewNav: document.getElementById('qaAfterViewNav'),
      optionLabel: document.getElementById('qaOptionLabel'),
      prevOptionBtn: document.getElementById('qaPrevOptionBtn'),
      nextOptionBtn: document.getElementById('qaNextOptionBtn'),
      
      solveClashBtn: document.getElementById('qaSolveClashBtn'),
      solveSimilarBtn: document.getElementById('qaSolveSimilarBtn'),
      solveAllBtn: document.getElementById('qaSolveAllBtn'),
      viewInModelBtn: document.getElementById('qaViewInModelBtn'),
      groupSelectedBtn: document.getElementById('qaGroupSelectedBtn'),
      importModelBtn: document.getElementById('qaImportModelBtn'),
      exportExcelBtn: document.getElementById('qaExportExcelBtn'),
      refreshBtn: document.getElementById('qaRefreshBtn'),
      runChecksBtn: document.getElementById('qaRunChecksBtn'),
      closeBtn: document.getElementById('qaCloseBtn'),
      darkModeToggle: document.getElementById('qaDarkModeToggle'),
      scheduleSessionBtn: document.getElementById('qaScheduleSessionBtn'),
      
      qaStatus: document.getElementById('qaStatus'),
      lastCheckTime: document.getElementById('qaLastCheckTime'),
      
      qaChatInput: document.getElementById('qaChatInput'),
      qaChatSend: document.getElementById('qaChatSend'),
      qaChatMessages: document.getElementById('qaChatMessages'),
      qaHistoryList: document.getElementById('qaHistoryList')
    };
  }

  // ============================================
  // RENDER FUNCTIONS
  // ============================================
  function renderTable() {
    const filteredErrors = filterErrors();
    elements.errorCount.textContent = `${filteredErrors.length} error${filteredErrors.length !== 1 ? 's' : ''}`;
    
    elements.resultsTableBody.innerHTML = filteredErrors.map(error => `
      <tr data-id="${error.id}" class="${state.selectedError?.id === error.id ? 'active' : ''}">
        <td class="col-select">
          <input type="checkbox" ${state.selectedRows.has(error.id) ? 'checked' : ''} data-error-id="${error.id}">
        </td>
        <td class="col-name">
          <span class="status-dot ${error.status}"></span>
          ${escapeHtml(error.name)}
        </td>
        <td class="col-type">
          <span class="error-type-badge ${error.type.id}">${error.type.id}</span>
        </td>
        <td class="col-view">
          <button class="view-btn" data-error-id="${error.id}">👁</button>
        </td>
        <td class="col-solved">${error.solvedBy || '—'}</td>
        <td class="col-qa">${error.qaBy || '—'}</td>
        <td class="col-comments">${escapeHtml(error.comments) || '—'}</td>
      </tr>
    `).join('');
    
    attachTableListeners();
  }

  function filterErrors() {
    return state.errors.filter(error => {
      const statusMatch = state.statusFilter === 'all' || error.status === state.statusFilter;
      const typeMatch = state.typeFilter === 'all' || error.type.id === state.typeFilter;
      return statusMatch && typeMatch;
    });
  }

  function renderElementDetails(error) {
    if (!error) {
      elements.detailElementId.textContent = '—';
      elements.detailCategory.textContent = '—';
      elements.detailFamily.textContent = '—';
      elements.detailType.textContent = '—';
      elements.detailCreatedBy.textContent = '—';
      elements.detailCreatedDate.textContent = '—';
      elements.detailModifiedBy.textContent = '—';
      elements.detailModifiedDate.textContent = '—';
      elements.detailSourceFile.textContent = '—';
      elements.detailLevel.textContent = '—';
      return;
    }

    elements.detailElementId.textContent = error.elementId;
    elements.detailCategory.textContent = error.category;
    elements.detailFamily.textContent = error.family;
    elements.detailType.textContent = error.familyType;
    elements.detailCreatedBy.textContent = error.createdBy;
    elements.detailCreatedDate.textContent = error.createdDate;
    elements.detailModifiedBy.textContent = error.modifiedBy;
    elements.detailModifiedDate.textContent = error.modifiedDate;
    elements.detailSourceFile.textContent = error.sourceFile;
    elements.detailLevel.textContent = error.level;
  }

  function renderViews(error) {
    if (!error) {
      elements.beforeView.innerHTML = `<div class="view-placeholder"><span class="placeholder-icon">🔍</span><span>Select an error</span></div>`;
      elements.afterView.innerHTML = `<div class="view-placeholder"><span class="placeholder-icon">✓</span><span>Solution preview</span></div>`;
      elements.afterViewNav.style.display = 'none';
      return;
    }

    elements.beforeView.innerHTML = `
      <div class="view-placeholder">
        <span class="placeholder-icon" style="font-size:1.5rem;">⚠️</span>
        <span style="color:#e74c3c;font-weight:500;">${escapeHtml(error.type.name)}</span>
        </div>
      `;
    
    if (error.solutions && error.solutions.length > 0) {
      const solution = error.solutions[state.currentSolutionIndex];
      elements.afterView.innerHTML = `
          <div class="view-placeholder">
          <span class="placeholder-icon" style="font-size:1.5rem;">✅</span>
          <span style="color:#27ae60;font-weight:500;">${escapeHtml(solution)}</span>
          </div>
        `;
      
      if (error.solutions.length > 1) {
        elements.afterViewNav.style.display = 'flex';
        elements.optionLabel.textContent = `${state.currentSolutionIndex + 1}/${error.solutions.length}`;
      } else {
        elements.afterViewNav.style.display = 'none';
      }
    }
  }

  function updateButtonStates() {
    const hasSelection = state.selectedError !== null;
    
    if (elements.solveClashBtn) elements.solveClashBtn.disabled = !hasSelection;
    if (elements.solveSimilarBtn) elements.solveSimilarBtn.disabled = !hasSelection;
    if (elements.solveAllBtn) elements.solveAllBtn.disabled = state.errors.length === 0;
    if (elements.viewInModelBtn) elements.viewInModelBtn.disabled = !hasSelection;
    
    if (hasSelection) {
      elements.qaStatus.textContent = `Selected: ${state.selectedError.name}`;
    } else {
      elements.qaStatus.textContent = 'Select an error to begin';
    }
  }

  // ============================================
  // EVENT HANDLERS
  // ============================================
  function attachTableListeners() {
    elements.resultsTableBody.querySelectorAll('tr').forEach(row => {
      row.addEventListener('click', (e) => {
        if (e.target.type === 'checkbox' || e.target.classList.contains('view-btn')) return;
        selectError(row.dataset.id);
      });
    });
    
    elements.resultsTableBody.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      cb.addEventListener('change', (e) => {
        e.stopPropagation();
        if (cb.checked) {
          state.selectedRows.add(cb.dataset.errorId);
        } else {
          state.selectedRows.delete(cb.dataset.errorId);
        }
        updateSelectAllState();
        updateButtonStates();
      });
    });
    
    elements.resultsTableBody.querySelectorAll('.view-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        viewInModel(btn.dataset.errorId);
      });
    });
  }

  function selectError(errorId) {
    state.selectedError = state.errors.find(e => e.id === errorId) || null;
    state.currentSolutionIndex = 0;
    renderTable();
    renderElementDetails(state.selectedError);
    renderViews(state.selectedError);
    updateButtonStates();
  }

  function updateSelectAllState() {
    const checkboxes = elements.resultsTableBody.querySelectorAll('input[type="checkbox"]');
    const allChecked = checkboxes.length > 0 && Array.from(checkboxes).every(cb => cb.checked);
    elements.selectAll.checked = allChecked;
  }

  function viewInModel(errorId) {
    const error = state.errors.find(e => e.id === errorId);
    if (error) {
      elements.qaStatus.textContent = `Viewing ${error.elementId} in model...`;
      addChatMessage('assistant', `Navigating to element ${error.elementId} in the model view.`);
    }
  }

  function addChatMessage(role, text) {
    const msg = document.createElement('div');
    // Use chat-panel.css classes
    msg.className = role === 'user' ? 'demo-msg-user' : 'demo-msg-bot';
    msg.innerHTML = `<p>${text}</p>`;
    elements.qaChatMessages.appendChild(msg);
    elements.qaChatMessages.scrollTop = elements.qaChatMessages.scrollHeight;
  }

  // ============================================
  // RIBBON TABS
  // ============================================
  function initRibbonTabs() {
    const qaRibbon = document.querySelector('.qa-ribbon');
    if (!qaRibbon) return;
    
    qaRibbon.querySelectorAll('.ribbon-tab').forEach(tab => {
      tab.addEventListener('click', function() {
        const tabName = this.dataset.tab;
        
        qaRibbon.querySelectorAll('.ribbon-tab').forEach(t => t.classList.remove('active'));
        this.classList.add('active');
        
        qaRibbon.querySelectorAll('.ribbon-content').forEach(content => {
          content.classList.remove('active');
          if (content.dataset.tab === tabName) {
            content.classList.add('active');
          }
        });
      });
    });
  }

  // ============================================
  // RESIZERS (Chat column and inner resizer)
  // ============================================
  function initResizers() {
    const qaResizer = document.getElementById('qaResizer');
    const qaChatColumn = document.getElementById('qaChatColumn');
    
    // Main chat column resizer (between main content and chat)
    if (qaResizer && qaChatColumn) {
      let startX, startWidth;
      
      qaResizer.addEventListener('mousedown', (e) => {
        e.preventDefault();
        startX = e.clientX;
        startWidth = qaChatColumn.offsetWidth;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        
        document.addEventListener('mousemove', doResize);
        document.addEventListener('mouseup', stopResize);
      });
      
      function doResize(e) {
        const dx = startX - e.clientX;
        const newWidth = Math.max(200, Math.min(500, startWidth + dx));
        qaChatColumn.style.width = newWidth + 'px';
      }
      
      function stopResize() {
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        document.removeEventListener('mousemove', doResize);
        document.removeEventListener('mouseup', stopResize);
      }
    }
    
    // Inner resizer (between chat main and history sidebar)
    const innerResizer = document.getElementById('qaInnerResizer');
    const chatMain = qaChatColumn?.querySelector('.demo-chat-main');
    const historySidebar = qaChatColumn?.querySelector('.demo-chat-history-sidebar');
    
    if (innerResizer && chatMain && historySidebar) {
      let startX, chatStartWidth, historyStartWidth;
      
      innerResizer.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        startX = e.clientX;
        chatStartWidth = chatMain.offsetWidth;
        historyStartWidth = historySidebar.offsetWidth;
        innerResizer.classList.add('active');
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        
        document.addEventListener('mousemove', doInnerResize);
        document.addEventListener('mouseup', stopInnerResize);
      });
      
      function doInnerResize(e) {
        const dx = e.clientX - startX;
        const newChatWidth = Math.max(100, chatStartWidth + dx);
        const newHistoryWidth = Math.max(80, historyStartWidth - dx);
        chatMain.style.flex = `0 0 ${newChatWidth}px`;
        historySidebar.style.flex = `0 0 ${newHistoryWidth}px`;
      }
      
      function stopInnerResize() {
        innerResizer.classList.remove('active');
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        document.removeEventListener('mousemove', doInnerResize);
        document.removeEventListener('mouseup', stopInnerResize);
      }
    }
  }

  // ============================================
  // COLUMN RESIZING
  // ============================================
  function initColumnResize() {
    const table = document.getElementById('qaResultsTable');
    if (!table) return;

    const headers = table.querySelectorAll('thead th');
    headers.forEach((th, index) => {
      // Skip last column (comments - auto width)
      if (index >= headers.length - 1) return;
      
      // Create resize handle
      const handle = document.createElement('div');
      handle.className = 'col-resize-handle';
      th.appendChild(handle);
      
      let startX, startWidth;
      
      handle.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        startX = e.clientX;
        startWidth = th.offsetWidth;
        handle.classList.add('resizing');
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        
        document.addEventListener('mousemove', onColResize);
        document.addEventListener('mouseup', onColResizeEnd);
      });
      
      function onColResize(e) {
        const dx = e.clientX - startX;
        const newWidth = Math.max(30, startWidth + dx);
        th.style.width = newWidth + 'px';
      }
      
      function onColResizeEnd() {
        handle.classList.remove('resizing');
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        document.removeEventListener('mousemove', onColResize);
        document.removeEventListener('mouseup', onColResizeEnd);
      }
    });
  }

  // ============================================
  // HISTORY ITEMS - Click to switch conversations
  // ============================================
  function initHistoryItems() {
    const historyList = document.getElementById('qaHistoryList');
    if (!historyList) return;
    
    const historyItems = historyList.querySelectorAll('.demo-history-item');
    
    historyItems.forEach(item => {
      item.addEventListener('click', function() {
        // Remove active from all
        historyItems.forEach(i => i.classList.remove('active'));
        // Add active to clicked
        this.classList.add('active');
        
        // Get conversation data
        const conversation = this.dataset.conversation;
        const system = this.dataset.system;
        
        // Update chat messages based on selected agent
        const chatMessages = document.getElementById('qaChatMessages');
        if (chatMessages && conversation) {
          chatMessages.innerHTML = `
            <div class="demo-msg-bot">
              <p><strong>${this.querySelector('.demo-history-item-title')?.textContent || 'Agent'}</strong><br>
              ${this.querySelector('.demo-history-item-preview')?.textContent || 'Ready to assist...'}</p>
            </div>
          `;
        }
        
        // Update status
        const status = document.getElementById('qaStatus');
        if (status) {
          status.textContent = `Switched to: ${this.querySelector('.demo-history-item-title')?.textContent || conversation}`;
        }
      });
    });
  }
  
  // ============================================
  // AGENT COUNT - Count and display agents
  // ============================================
  function initAgentCount() {
    const historyList = document.getElementById('qaHistoryList');
    const agentCountEl = document.getElementById('qaAgentCountNum');
    
    if (historyList && agentCountEl) {
      const agentItems = historyList.querySelectorAll('.demo-history-item.agent-item');
      agentCountEl.textContent = agentItems.length;
    }
  }

  // ============================================
  // FLOATING WINDOW DRAG & RESIZE
  // ============================================
  function initWindowDragResize() {
    const win = document.getElementById('qaManagerWindow');
    const titlebar = document.querySelector('.qa-titlebar');
    if (!win || !titlebar) return;
    
    // Position is initialized in showQAManager when window first becomes visible
    
    let isDragging = false;
    let isResizing = false;
    let dragStartX, dragStartY, windowStartX, windowStartY;
    let resizeStartX, resizeStartY, windowStartWidth, windowStartHeight;
    let resizeEdge = '';
    
    // Titlebar drag
    titlebar.addEventListener('mousedown', (e) => {
      // Don't drag if clicking menu buttons
      if (e.target.closest('.menu-dropdown') || e.target.closest('.window-controls')) return;
      
      isDragging = true;
      win.classList.add('dragging');
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      windowStartX = win.offsetLeft;
      windowStartY = win.offsetTop;
      
      document.addEventListener('mousemove', onDragMove);
      document.addEventListener('mouseup', onDragEnd);
      e.preventDefault();
    });
    
    function onDragMove(e) {
      if (!isDragging) return;
      const dx = e.clientX - dragStartX;
      const dy = e.clientY - dragStartY;
      win.style.left = (windowStartX + dx) + 'px';
      win.style.top = (windowStartY + dy) + 'px';
    }
    
    function onDragEnd() {
      isDragging = false;
      win.classList.remove('dragging');
      document.removeEventListener('mousemove', onDragMove);
      document.removeEventListener('mouseup', onDragEnd);
    }
    
    // Resize edges
    const resizeEdges = win.querySelectorAll('.resize-edge');
    resizeEdges.forEach(edge => {
      edge.addEventListener('mousedown', (e) => {
        isResizing = true;
        resizeEdge = edge.dataset.edge;
        resizeStartX = e.clientX;
        resizeStartY = e.clientY;
        windowStartWidth = win.offsetWidth;
        windowStartHeight = win.offsetHeight;
        windowStartX = win.offsetLeft;
        windowStartY = win.offsetTop;
        
        win.classList.add('dragging');
        document.body.style.userSelect = 'none';
        
        document.addEventListener('mousemove', onResizeMove);
        document.addEventListener('mouseup', onResizeEnd);
        e.preventDefault();
      });
    });
    
    function onResizeMove(e) {
      if (!isResizing) return;
      
      const dx = e.clientX - resizeStartX;
      const dy = e.clientY - resizeStartY;
      const minW = 600;
      const minH = 400;
      
      if (resizeEdge.includes('e')) {
        win.style.width = Math.max(minW, windowStartWidth + dx) + 'px';
      }
      if (resizeEdge.includes('w')) {
        const newWidth = Math.max(minW, windowStartWidth - dx);
        if (newWidth > minW || windowStartWidth - dx > minW) {
          win.style.width = newWidth + 'px';
          win.style.left = (windowStartX + dx) + 'px';
        }
      }
      if (resizeEdge.includes('s')) {
        win.style.height = Math.max(minH, windowStartHeight + dy) + 'px';
      }
      if (resizeEdge.includes('n')) {
        const newHeight = Math.max(minH, windowStartHeight - dy);
        if (newHeight > minH || windowStartHeight - dy > minH) {
          win.style.height = newHeight + 'px';
          win.style.top = (windowStartY + dy) + 'px';
        }
      }
    }
    
    function onResizeEnd() {
      isResizing = false;
      resizeEdge = '';
      win.classList.remove('dragging');
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', onResizeMove);
      document.removeEventListener('mouseup', onResizeEnd);
    }
    
    // Window control buttons (minimize, maximize style)
    const yellowBtn = win.querySelector('.window-btn.yellow');
    const greenBtn = win.querySelector('.window-btn.green');
    
    if (yellowBtn) {
      yellowBtn.addEventListener('click', () => {
        // Snap back to default size/position
        win.style.width = '1100px';
        win.style.height = '650px';
        win.style.left = '50%';
        win.style.top = '50%';
        win.style.transform = 'translate(-50%, -50%)';
        setTimeout(() => { win.style.transform = 'none'; const r = win.getBoundingClientRect(); win.style.left = r.left + 'px'; win.style.top = r.top + 'px'; }, 10);
      });
    }
    
    if (greenBtn) {
      greenBtn.addEventListener('click', () => {
        // Expand 20%
        const currentWidth = win.offsetWidth;
        const currentHeight = win.offsetHeight;
        win.style.width = Math.min(window.innerWidth - 40, currentWidth * 1.2) + 'px';
        win.style.height = Math.min(window.innerHeight - 40, currentHeight * 1.2) + 'px';
      });
    }
  }

  // ============================================
  // SHOW/HIDE FUNCTIONS
  // ============================================
  let isInitialized = false;
  let positionInitialized = false;

  function showQAManager() {
    if (!isInitialized) {
      init();
    }
    if (elements.window) {
      elements.window.style.display = 'flex';
      
      // Initialize position only when first shown (so getBoundingClientRect works)
      if (!positionInitialized) {
        positionInitialized = true;
        // Let the CSS transform center it, then convert to fixed position
        requestAnimationFrame(() => {
          const rect = elements.window.getBoundingClientRect();
          elements.window.style.transform = 'none';
          elements.window.style.left = rect.left + 'px';
          elements.window.style.top = rect.top + 'px';
        });
      }
    }
  }

  function hideQAManager() {
    if (elements.window) {
      elements.window.style.display = 'none';
    }
  }

  function toggleQAManager() {
    if (elements.window) {
      if (elements.window.style.display === 'none' || !elements.window.style.display) {
        showQAManager();
      } else {
        hideQAManager();
      }
    }
  }

  // Expose to global scope
  window.showQAManager = showQAManager;
  window.hideQAManager = hideQAManager;
  window.toggleQAManager = toggleQAManager;

  // ============================================
  // INITIALIZATION
  // ============================================
  function init() {
    if (isInitialized) return;
    isInitialized = true;

    initElements();
    
    // Check if elements exist (QA Manager is in DOM)
    if (!elements.window || !elements.resultsTableBody) {
      console.log('QA Manager: Elements not found, skipping init');
      return;
    }

    renderTable();
    updateButtonStates();
    initRibbonTabs();
    initResizers();
    initColumnResize();
    initWindowDragResize();
    initHistoryItems();
    initAgentCount();
    
    elements.lastCheckTime.textContent = `Last check: ${new Date().toLocaleTimeString()}`;
    
    // Select all
    elements.selectAll?.addEventListener('change', () => {
      const checkboxes = elements.resultsTableBody.querySelectorAll('input[type="checkbox"]');
      checkboxes.forEach(cb => {
        cb.checked = elements.selectAll.checked;
        if (elements.selectAll.checked) {
          state.selectedRows.add(cb.dataset.errorId);
        } else {
          state.selectedRows.delete(cb.dataset.errorId);
        }
      });
      updateButtonStates();
    });
    
    // Filters
    elements.statusFilter?.addEventListener('change', () => {
      state.statusFilter = elements.statusFilter.value;
      renderTable();
    });
    
    elements.typeFilter?.addEventListener('change', () => {
      state.typeFilter = elements.typeFilter.value;
      renderTable();
    });
    
    // Solution navigation
    elements.prevOptionBtn?.addEventListener('click', () => {
      if (state.selectedError?.solutions) {
        state.currentSolutionIndex = (state.currentSolutionIndex - 1 + state.selectedError.solutions.length) % state.selectedError.solutions.length;
        renderViews(state.selectedError);
      }
    });
    
    elements.nextOptionBtn?.addEventListener('click', () => {
      if (state.selectedError?.solutions) {
        state.currentSolutionIndex = (state.currentSolutionIndex + 1) % state.selectedError.solutions.length;
        renderViews(state.selectedError);
      }
    });
    
    // Buttons
    elements.solveClashBtn?.addEventListener('click', () => {
      if (state.selectedError) {
        const solution = state.selectedError.solutions?.[state.currentSolutionIndex];
        elements.qaStatus.textContent = `Applying: ${solution}`;
        addChatMessage('assistant', `Applying solution: <strong>${solution}</strong>`);
      }
    });
    
    elements.viewInModelBtn?.addEventListener('click', () => {
      if (state.selectedError) viewInModel(state.selectedError.id);
    });
    
    elements.refreshBtn?.addEventListener('click', () => {
      elements.qaStatus.textContent = 'Refreshing...';
      setTimeout(() => {
        renderTable();
        elements.lastCheckTime.textContent = `Last check: ${new Date().toLocaleTimeString()}`;
        elements.qaStatus.textContent = 'Refresh complete';
      }, 500);
    });
    
    elements.runChecksBtn?.addEventListener('click', () => {
      elements.qaStatus.textContent = 'Running QA checks...';
      addChatMessage('assistant', 'Running QA checks on model...');
      setTimeout(() => {
        elements.lastCheckTime.textContent = `Last check: ${new Date().toLocaleTimeString()}`;
        elements.qaStatus.textContent = `Found ${state.errors.length} errors`;
        addChatMessage('assistant', `<strong>Check complete.</strong> Found ${state.errors.length} errors.`);
      }, 1500);
    });
    
    elements.scheduleSessionBtn?.addEventListener('click', () => {
      addChatMessage('assistant', 'Opening QA session scheduler. You can set recurring checks and notify team members when issues are found.');
    });
    
    // Close button
    elements.closeBtn?.addEventListener('click', () => {
      hideQAManager();
    });
    
    // Dark mode
    elements.darkModeToggle?.addEventListener('click', () => {
      document.documentElement.classList.toggle('dark-mode');
      const isDark = document.documentElement.classList.contains('dark-mode');
      localStorage.setItem('specbuilder-dark-mode', isDark ? 'dark' : 'light');
      document.cookie = `specbuilderDarkMode=${isDark}; path=/; max-age=31536000; SameSite=Lax`;
    });
    
    // Chat input
    elements.qaChatSend?.addEventListener('click', sendChatMessage);
    elements.qaChatInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendChatMessage();
      }
    });
    
    function sendChatMessage() {
      const text = elements.qaChatInput.textContent.trim();
      if (!text) return;
      
      addChatMessage('user', escapeHtml(text));
      elements.qaChatInput.textContent = '';
      
      // Simple response
      setTimeout(() => {
        addChatMessage('assistant', `I understand you're asking about: "${escapeHtml(text)}". I can help you resolve errors, explain QA rules, or schedule review sessions.`);
      }, 500);
    }
    
    // History items
    elements.qaHistoryList?.querySelectorAll('.history-item').forEach(item => {
      item.addEventListener('click', () => {
        elements.qaHistoryList.querySelectorAll('.history-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        addChatMessage('assistant', `Loaded session: ${item.querySelector('.history-item-title').textContent}`);
      });
    });
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        state.selectedError = null;
        state.selectedRows.clear();
        renderTable();
        renderElementDetails(null);
        renderViews(null);
        updateButtonStates();
      }
      
      if (state.selectedError) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          const idx = state.errors.findIndex(e => e.id === state.selectedError.id);
          if (idx < state.errors.length - 1) selectError(state.errors[idx + 1].id);
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          const idx = state.errors.findIndex(e => e.id === state.selectedError.id);
          if (idx > 0) selectError(state.errors[idx - 1].id);
        }
        if (e.key === 'ArrowLeft' && state.selectedError.solutions?.length > 1) {
          e.preventDefault();
          elements.prevOptionBtn?.click();
        }
        if (e.key === 'ArrowRight' && state.selectedError.solutions?.length > 1) {
          e.preventDefault();
          elements.nextOptionBtn?.click();
        }
      }
    });
  }

  function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
