/**
 * BUILD X Panel Data & Functions
 * Shared between demos.html and index.html
 * This is the single source of truth for all BUILD package content
 */

const packageData = {
  'MEP': {
    name: 'BUILD MEP.',
    subtitle: 'AI MEP Systems Design Automation',
    problem: 'MEP coordination is the leading cause of construction delays. Services clash with structure, routes conflict with architecture, and coordination meetings consume weeks of professional time. Drawings require constant manual updates as designs evolve.',
    solution: 'Adelphos automates the entire MEP design workflow. Routes are sized and coordinated in real-time against all disciplines. Clashes are resolved before they happen. Layouts, sections, and schematics update automatically.',
    outputs: [
      'Coordinated MEP layouts (all services)',
      'Plant room layouts with sections',
      'Schematics linked to layouts',
      'Equipment schedules',
      'Design calculations to CIBSE',
      'Specifications to NBS format'
    ],
    capabilities: [
      'Generate infinite compliant design options until satisfied',
      'Automatic clash detection and resolution',
      'One-click coordination with architecture',
      'Real-time pipe and duct sizing',
      'Cable containment routing',
      'Fire strategy compliance checking'
    ],
    ribaStages: 'Stages 2, 3, 4, 5, 6'
  },
  'A': {
    name: 'BUILD A.',
    subtitle: 'AI Architecture Design Software',
    problem: 'Architectural changes cascade through every discipline. Move a wall and the MEP routes break, structural grids misalign, cost plans become outdated. Coordination between teams is slow, expensive, and error-prone.',
    solution: 'Adelphos propagates architectural changes to all disciplines instantly. Room data sheets update automatically. Door schedules, window schedules, and ceiling layouts sync in real-time across the coordinated model.',
    outputs: [
      'Room data sheets',
      'Door and window schedules',
      'Ceiling void coordination',
      'Planning submission packages',
      'Material specifications',
      'Area schedules to RICS'
    ],
    capabilities: [
      'Generate unlimited layout options instantly',
      'Test adjacency configurations in seconds',
      'Automatic fire escape distance checking',
      'Client revisions without rework',
      'Daylight factor optimisation',
      'Accessibility compliance validation'
    ],
    ribaStages: 'Stages 1, 2, 3, 4, 5'
  },
  'S': {
    name: 'BUILD S.',
    subtitle: 'AI Structural Engineering Design',
    problem: 'Structural design is isolated from MEP coordination. Beam penetrations are discovered late, requiring expensive rework. Foundation designs lack integration with drainage strategies. Manual calculations are time-consuming and repetitive.',
    solution: 'Adelphos integrates structural analysis with full building coordination. MEP penetrations are tracked automatically. Builders work requirements generate from the coordinated model. Robot Structural Analysis integration enables rapid design iteration.',
    outputs: [
      'Structural GA drawings',
      'Foundation layouts',
      'RC/Steel schedules',
      'Connection details',
      'Beam penetration schedules',
      'Builders work requirements'
    ],
    capabilities: [
      'Rapid structural option generation',
      'Automatic beam sizing updates',
      'Foundation coordination with civils',
      'Penetration tracking across grids',
      'Load path verification',
      'Iterative scheme refinement'
    ],
    ribaStages: 'Stages 2, 3, 4, 5'
  },
  'C': {
    name: 'BUILD C.',
    subtitle: 'AI Civil Engineering Automation',
    problem: 'External works are often designed in isolation. Drainage strategies conflict with building positions. Attenuation sizing is iterative and manual. S104/S38 submissions require extensive documentation effort.',
    solution: 'Adelphos coordinates civil engineering with building design. Drainage networks size automatically to BS EN 752. Attenuation is calculated from site constraints. Submission packages compile from the coordinated model.',
    outputs: [
      'Drainage layouts to BS EN 752',
      'Attenuation sizing calculations',
      'SuDS design and sizing',
      'External levels coordination',
      'S104/S38 submission packages',
      'Utility connection schedules'
    ],
    capabilities: [
      'Multiple drainage network options',
      'Automatic attenuation recalculation',
      'Site constraint optimisation',
      'Utility route alternatives',
      'Earthworks balance modelling',
      'Adoption authority compliance'
    ],
    ribaStages: 'Stages 2, 3, 4, 5'
  },
  'F': {
    name: 'BUILD F.',
    subtitle: 'AI Construction Cost Estimation',
    problem: 'Cost plans lag behind design development. Quantities are measured manually from outdated drawings. Value engineering options lack rapid cost feedback. Final accounts are disputed due to poor change control.',
    solution: 'Adelphos generates cost data directly from the coordinated model. Quantities measure automatically as design develops. Value engineering options show cost impact immediately. Change control maintains full audit trail to final account.',
    outputs: [
      'Order of cost estimates',
      'Elemental cost breakdowns',
      'Bills of Quantities to NRM2',
      'Tender documents',
      'Variation assessments',
      'Final account preparation'
    ],
    capabilities: [
      'Instant cost impact on design changes',
      'Generate VE options with costs',
      'Unlimited re-measurement cycles',
      'Live budget tracking',
      'Procurement package splitting',
      'Contractor pricing comparison'
    ],
    ribaStages: 'Stages 1, 2, 3, 4, 5, 6'
  },
  'M': {
    name: 'BUILD M.',
    subtitle: 'AI Project Administration Tools',
    problem: 'Client briefs get lost between teams. Meeting notes are unstructured and disconnected from deliverables. Risk registers are static documents. The golden thread breaks before construction begins.',
    solution: 'Adelphos captures client requirements via natural language and structures them into actionable project data. Meeting transcription links decisions to deliverables. Risk registers update dynamically. The golden thread is maintained from briefing to handover.',
    outputs: [
      'Structured client briefs',
      'Meeting transcription and action logs',
      'Change control workflow',
      'Dynamic risk register',
      'Golden thread documentation',
      'Stage reports to RIBA format'
    ],
    capabilities: [
      'Natural language brief capture',
      'Real-time meeting transcription',
      'Automatic action item tracking',
      'Risk register live updates',
      'Decision audit trails',
      'Client feedback loop integration'
    ],
    ribaStages: 'Stages 0, 1, 2, 3, 4, 5, 6, 7'
  },
  'Z': {
    name: 'BUILD Z.',
    subtitle: 'AI Sustainability & Energy Analysis',
    problem: 'Energy modelling is a separate workflow from building design. Models are rebuilt from scratch each time. Compliance reports take weeks. Carbon calculations are manual and disconnected from specifications.',
    solution: 'Adelphos exports directly to IESVE for dynamic thermal modelling. SAP and SBEM calculations generate from design inputs. Part L compliance is checked continuously. Embodied carbon calculates from actual material selections.',
    outputs: [
      'Dynamic thermal models (IESVE)',
      'SAP/SBEM calculations',
      'Part L compliance reports',
      'TM54, TM52/TM59 assessments',
      'BREEAM pre-assessments',
      'Embodied carbon calculations'
    ],
    capabilities: [
      'Instant Part L compliance checking',
      'Generate design options to hit targets',
      'Automatic thermal model sync',
      'Iterative carbon reduction',
      'Overheating mitigation options',
      'Renewable sizing alternatives'
    ],
    ribaStages: 'Stages 2, 3, 4'
  },
  'P': {
    name: 'BUILD P.',
    subtitle: 'AI Project Delivery Management',
    problem: 'Design programmes are manually coordinated across disciplines. Information required schedules are static spreadsheets. Stage reports require extensive manual compilation. Handover packs are incomplete.',
    solution: 'Adelphos coordinates design programmes automatically. Information dependencies are tracked in real-time. Stage reports compile from project data. Handover packs include all as-built information and O&M documentation.',
    outputs: [
      'Coordinated design programmes',
      'Information required schedules',
      'Stage reports',
      'Procurement packages',
      'Construction support documentation',
      'Complete handover packs'
    ],
    capabilities: [
      'Automatic programme updates',
      'Information dependency tracking',
      'Milestone progress reporting',
      'Resource allocation optimisation',
      'Critical path identification',
      'Handover pack compilation'
    ],
    ribaStages: 'Stages 3, 4, 5, 6'
  },
  'D': {
    name: 'BUILD D.',
    subtitle: 'AI Data Centre Design',
    problem: 'Data centre design requires specialist expertise across electrical, mechanical, and IT infrastructure. Coordination between power distribution, cooling systems, and rack layouts is complex. Redundancy planning requires careful analysis.',
    solution: 'Adelphos automates data centre design with specialised workflows for power, cooling, and containment. N+1 redundancy is validated automatically. Rack layouts optimise for cooling efficiency. Power distribution coordinates with generator and UPS sizing.',
    outputs: [
      'Power distribution layouts',
      'Cooling system design',
      'Rack layout optimisation',
      'Containment strategies',
      'Redundancy analysis (N+1, 2N)',
      'Mission-critical MEP coordination'
    ],
    capabilities: [
      'Generate multiple rack configurations',
      'Cooling efficiency optimisation',
      'Automatic redundancy validation',
      'Power density modelling',
      'Hot/cold aisle containment',
      'Uptime tier compliance checking'
    ],
    ribaStages: 'Stages 2, 3, 4, 5'
  },
  'X': {
    name: 'BUILD X.',
    subtitle: 'Complete AI Construction Design Suite',
    problem: 'The construction industry operates in silos. Architects, engineers, cost consultants, and project managers work in disconnected software. Data is re-entered, coordination is manual, and the golden thread breaks repeatedly.',
    solution: 'BUILD X unifies every Adelphos module into a single subscription. Every discipline, every stage, every deliverable — coordinated in one platform. From site survey to handover, from feasibility to final account.',
    outputs: [
      'All BUILD module outputs',
      'Full RIBA Stage 0-7 deliverables',
      'Cross-discipline coordination',
      'Single source of truth',
      'Complete golden thread',
      'Unified project data'
    ],
    capabilities: [
      'Every module, every discipline',
      'Unlimited design iterations',
      'Client revisions in seconds',
      'Full RIBA stage coverage',
      'Single subscription pricing',
      '30% early access discount'
    ],
    ribaStages: 'Stages 0, 1, 2, 3, 4, 5, 6, 7'
  }
};

/**
 * Initialize BUILD X panels for a page
 * @param {Object} config - Configuration object
 * @param {string} config.leftPanelId - ID of left ribbon panel
 * @param {string} config.rightPanelId - ID of right ribbon panel
 * @param {string} config.leftContentId - ID of left content container
 * @param {string} config.rightContentId - ID of right content container
 * @param {string} config.buttonSelector - CSS selector for package buttons
 * @param {string} config.classSuffix - Suffix for CSS classes ('' for demos, '-home' for index)
 * @param {string} config.defaultPackage - Package to show by default
 */
function initBuildXPanels(config) {
  const leftPanel = document.getElementById(config.leftPanelId);
  const rightPanel = document.getElementById(config.rightPanelId);
  const leftContent = document.getElementById(config.leftContentId);
  const rightContent = document.getElementById(config.rightContentId);
  const packageBtns = document.querySelectorAll(config.buttonSelector);
  const suffix = config.classSuffix || '';

  if (!leftPanel || !rightPanel || !leftContent || !rightContent) {
    return null;
  }

  function showPackageInfo(packageKey) {
    const data = packageData[packageKey];
    if (!data) return;

    // Update active button state
    packageBtns.forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.querySelector(`${config.buttonSelector}[data-package="${packageKey}"]`);
    if (activeBtn) activeBtn.classList.add('active');

    // Build LEFT panel content (header + problem + solution)
    leftContent.innerHTML = `
      <div class="buildx-panel-header${suffix}">
        <div class="buildx-panel-name${suffix}">${data.name.replace(/([A-Z]+)\./g, '<span class="teal">$1.</span>')}</div>
        <h3 class="buildx-panel-subtitle${suffix}">${data.subtitle}</h3>
      </div>
      
      <div class="buildx-panel-section${suffix}">
        <h4 class="buildx-panel-section-title${suffix}">The Industry Problem</h4>
        <p class="buildx-panel-text${suffix}">${data.problem}</p>
      </div>
      
      <div class="buildx-panel-section${suffix}">
        <h4 class="buildx-panel-section-title${suffix}">What Adelphos Does</h4>
        <p class="buildx-panel-text${suffix}">${data.solution}</p>
      </div>
      
      <div class="buildx-panel-section${suffix}">
        <h4 class="buildx-panel-section-title${suffix}">RIBA Stage Coverage</h4>
        <p class="buildx-panel-text${suffix}">${data.ribaStages}</p>
      </div>
    `;

    // Build RIGHT panel content (outputs + capabilities + revisions)
    rightContent.innerHTML = `
      <div class="buildx-panel-section${suffix}">
        <h4 class="buildx-panel-section-title${suffix}">Outputs & Deliverables</h4>
        <ul class="buildx-panel-list${suffix}">
          ${data.outputs.map(item => `<li>${item}</li>`).join('')}
        </ul>
      </div>
      
      <div class="buildx-panel-section${suffix}">
        <h4 class="buildx-panel-section-title${suffix}">Key Capabilities</h4>
        <ul class="buildx-panel-list${suffix}">
          ${data.capabilities.map(item => `<li>${item}</li>`).join('')}
        </ul>
      </div>
      
      <div class="buildx-panel-highlight${suffix}">
        <div class="buildx-panel-highlight-title${suffix}">∞ Infinite Compliant Options</div>
        <p class="buildx-panel-highlight-text${suffix}">Generate as many design options as you need. Client wants another revision? Done in seconds. Keep iterating until everyone is happy — no additional cost, no delays.</p>
      </div>
      
      <div class="buildx-panel-highlight${suffix}" style="margin-top: 10px;">
        <div class="buildx-panel-highlight-title${suffix}">✓ Revise Anytime</div>
        <p class="buildx-panel-highlight-text${suffix}">Design changes propagate across all disciplines automatically. No manual coordination. No broken references. Just update and go.</p>
      </div>
    `;

    // Show both panels
    leftPanel.classList.add('has-content');
    rightPanel.classList.add('has-content');
  }

  // Attach click handlers to buttons
  packageBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const pkg = btn.getAttribute('data-package');
      if (pkg) showPackageInfo(pkg);
    });
  });

  // Show default package
  if (config.defaultPackage) {
    showPackageInfo(config.defaultPackage);
  }

  // Return the function so it can be called externally
  return showPackageInfo;
}

// Export for use in other scripts (if needed)
if (typeof window !== 'undefined') {
  window.packageData = packageData;
  window.initBuildXPanels = initBuildXPanels;
}

