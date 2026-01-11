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
        { type: 'bot', text: 'I\'ve cross-referenced the civil pop-up locations with the room requirements. Some positions differ from optimal — I\'ve marked these for your review.<br><br>Ready to proceed with the full drainage design? Type yes or proceed to continue.' }
      ],
      thinkingSequence: [
        { text: 'Initiating drainage design sequence...', type: 'think' },
        { text: 'Applying BS EN 12056-2 design methodology.', type: 'think' },
        { text: 'Calculating pipe gradients per Approved Document H.', type: 'think' },
        { text: 'Checking company standard for branch pipe sizing.', type: 'think' },
        { text: 'Placing branch pipes to sanitary outlets.', type: 'action', changes: '+48', filename: 'drainage-layout.rvt' },
        { text: 'Routing stack connections through risers.', type: 'action', changes: '+86', filename: 'drainage-layout.rvt' },
        { text: 'Designing primary ventilation per BS EN 12056-2.', type: 'think' },
        { text: 'SVP sizing based on discharge units.', type: 'think' },
        { text: 'Placing SVPs in boxed risers (client preference).', type: 'action', changes: '+24', filename: 'drainage-layout.rvt' },
        { text: 'Generating 3D model and routing.', type: 'action', changes: '+156', filename: 'drainage-layout.rvt' },
        { text: 'Running clash detection against structural model.', type: 'think' },
        { text: 'Clashes found with structure.', type: 'think' },
        { text: 'Rerouting pipes to avoid clashes.', type: 'action', changes: '+24', filename: 'drainage-layout.rvt' },
        { text: 'Checking access for rodding per Approved Doc H.', type: 'think' },
        { text: 'Adding rodding eyes at changes of direction.', type: 'action', changes: '+12', filename: 'drainage-layout.rvt' },
        { text: 'Cross-referencing civil pop-up positions.', type: 'think' },
        { text: 'Marking unconfirmed SVP positions with hazard symbol.', type: 'action', changes: '+4', filename: 'drainage-layout.rvt' },
        { text: 'Generating drainage schedule.', type: 'action', changes: '+1', filename: 'Drainage_Schedule.xlsx' },
        { text: 'Design complete.', type: 'done' }
      ],
      finalMessage: 'Drainage design complete in compliance with <strong>BS EN 12056</strong> and <strong>Approved Document H</strong>:<br>• Primary ventilation sized and routed<br>• SVPs boxed in risers per client preference<br>• Branch pipes sized per discharge unit calculations<br>• Rodding access provided at all changes of direction<br><br><strong>Note:</strong> I have marked the SVPs that weren\'t confirmed on the civil engineering information with a hazard symbol — please send this drawing to the civil engineer for confirmation.',
      readyPrompt: 'Type <strong>"yes"</strong> or <strong>"proceed"</strong> to generate drainage layout',
      thoughtTrail: 'I need to review the civil engineering pop-up locations and cross-reference with the room schedule. The SVPs must fit within the boxing per client preference, and I need to verify compliance with Approved Document H for access and rodding. Let me check similar project approaches for the riser coordination.',
      videoSource: 'Videos/View 4 - MEP Layouts/01-drainage.mp4'
    },
    
    water: {
      messages: [
        { type: 'user', text: 'Can you design the cold and hot water system?' },
        { type: 'bot', text: 'Of course, let me analyse the requirements, regulations and site constraints.' },
        { type: 'thinking', steps: [
          { text: 'Loading project context...', type: 'think' },
          { text: 'Location identified: London, UK (Westminster).', type: 'think' },
          { text: 'Checking BS EN 806 Parts 1-5 (water supply specifications).', type: 'think' },
          { text: 'Checking Water Supply (Water Fittings) Regulations 1999.', type: 'think' },
          { text: 'Checking HSG274 Part 2 (Legionella control).', type: 'think' },
          { text: 'Reviewing local water authority requirements.', type: 'think' },
          { text: 'Loading company standard.', type: 'think' },
          { text: 'Checking similar project approaches.', type: 'think' },
          { text: 'Client preference found: Point-of-use heaters.', type: 'think' },
          { text: 'Reading project specification...', type: 'think' },
          { text: 'Checking building location and height.', type: 'think' },
          { text: 'Querying local water authority for pressure data.', type: 'think' },
          { text: 'Calculating pressure requirements for upper floors.', type: 'think' },
          { text: 'Booster set required — pressure insufficient for upper floors.', type: 'think' },
          { text: 'Checking water hardness data for location.', type: 'think' },
          { text: 'Water softener required per specification.', type: 'think' },
          { text: 'Checking HSG274 dead leg requirements.', type: 'think' },
          { text: 'Analysis complete — awaiting confirmation.', type: 'done' }
        ]},
        { type: 'bot', text: 'I\'ve analysed the project against <strong>BS EN 806</strong>, <strong>Water Fittings Regulations</strong>, and <strong>HSG274</strong> Legionella guidance. Local water authority data and similar projects checked.<br><br>Booster set required for upper floors and water softener required per specification. Point-of-use heaters will be used per client preference.<br><br>Shall I proceed with the design?' },
        { type: 'user', text: 'Yes, proceed.' },
        { type: 'thinking', steps: [
          { text: 'Continuing with outlet placement...', type: 'think' },
          { text: 'Reading room schedule from Revit model.', type: 'think' },
          { text: 'Mapping sanitary fittings to outlet requirements.', type: 'think' },
          { text: 'Calculating loading units per BS EN 806-3.', type: 'think' },
          { text: 'Identifying point-of-use water heater locations.', type: 'think' },
          { text: 'Applying company standard for outlet positioning.', type: 'think' },
          { text: 'Placing cold water outlets per room requirements.', type: 'action', changes: '+186', filename: 'water-services.rvt' },
          { text: 'Placing hot water outlets per room requirements.', type: 'action', changes: '+142', filename: 'water-services.rvt' },
          { text: 'Adding point-of-use water heaters (client preference).', type: 'action', changes: '+24', filename: 'water-services.rvt' },
          { text: 'Sizing booster set per BS EN 806-3 calculations.', type: 'think' },
          { text: 'Placing booster set in Level 00 plantroom.', type: 'action', changes: '+8', filename: 'water-services.rvt' },
          { text: 'Placing water softener adjacent to incoming main.', type: 'action', changes: '+4', filename: 'water-services.rvt' },
          { text: 'Outlets placed successfully.', type: 'done' }
        ]},
        { type: 'bot', text: 'Water outlets placed with booster set and softener positioned in the plantroom. Ready to route pipework and generate calculations?' }
      ],
      thinkingSequence: [
        { text: 'Initiating pipework routing sequence...', type: 'think' },
        { text: 'Applying BS EN 806-3 pipe sizing methodology.', type: 'think' },
        { text: 'Calculating loading units per outlet type.', type: 'think' },
        { text: 'Checking company standard for minimum velocities.', type: 'think' },
        { text: 'Checking similar project riser approaches.', type: 'think' },
        { text: 'Sizing cold water mains from incoming supply.', type: 'think' },
        { text: 'Routing cold water mains through risers.', type: 'action', changes: '+486', filename: 'water-services.rvt' },
        { text: 'Sizing hot water distribution pipework.', type: 'think' },
        { text: 'Routing hot water to point-of-use heaters.', type: 'action', changes: '+324', filename: 'water-services.rvt' },
        { text: 'Checking dead leg distances per HSG274.', type: 'think' },
        { text: 'All dead legs compliant.', type: 'think' },
        { text: 'Adding isolation valves per company standard.', type: 'action', changes: '+86', filename: 'water-services.rvt' },
        { text: 'Running clash detection against structure.', type: 'think' },
        { text: 'No clashes detected.', type: 'think' },
        { text: 'Generating BS EN 806 calculation report.', type: 'think' },
        { text: 'Saving calculations to project folder.', type: 'action', changes: '+1', filename: 'Water_Calcs_BS-EN-806.pdf' },
        { text: 'Generating pipe schedule.', type: 'action', changes: '+1', filename: 'Water_Pipe_Schedule.xlsx' },
        { text: 'Design complete.', type: 'done' }
      ],
      finalMessage: 'Water services design complete in compliance with <strong>BS EN 806</strong> and <strong>HSG274</strong>:<br>• <strong>186</strong> cold water outlets placed<br>• <strong>142</strong> hot water outlets placed<br>• <strong>24</strong> point-of-use water heaters (per client preference)<br>• <strong>Booster set</strong> and <strong>softener</strong> positioned in plantroom<br>• All dead legs compliant per HSG274<br>• Pipework sized per BS EN 806-3<br>• Calculations saved: <code>Water_Calcs_BS-EN-806.pdf</code><br><br>Design ready for review.',
      readyPrompt: 'Type <strong>"yes"</strong> or <strong>"proceed"</strong> to route pipework',
      thoughtTrail: 'The incoming pressure won\'t reach the upper floors adequately so I need to size a booster set per BS EN 806-3 methodology. Water softener is required per the specification. I should verify all dead legs comply with HSG274 Legionella guidance — point-of-use heaters will help minimise dead legs as used on similar projects.',
      videoSource: 'Videos/View 4 - MEP Layouts/02-water.mp4'
    },
    
    heating: {
      messages: [
        { type: 'user', text: 'Can you design the heating and cooling system?' },
        { type: 'bot', text: 'Of course, let me analyse the requirements, regulations and system strategy.' },
        { type: 'thinking', steps: [
          { text: 'Loading project context...', type: 'think' },
          { text: 'Location identified: London, UK (Westminster).', type: 'think' },
          { text: 'Checking Building Regulations Part L.', type: 'think' },
          { text: 'Checking CIBSE Guide A.', type: 'think' },
          { text: 'Checking CIBSE TM52.', type: 'think' },
          { text: 'Checking BCO Guide to Specification.', type: 'think' },
          { text: 'Loading company standard.', type: 'think' },
          { text: 'Checking similar project approaches.', type: 'think' },
          { text: 'Client preference found: Daikin VRF system.', type: 'think' },
          { text: 'Reading project specification...', type: 'think' },
          { text: 'Heating strategy: VRF heat recovery system.', type: 'think' },
          { text: 'Cooling strategy: VRF ducted indoor units.', type: 'think' },
          { text: 'Panel heaters specified for corridors.', type: 'think' },
          { text: 'Ducted FCUs required for office areas.', type: 'think' },
          { text: 'VRF outdoor condensers required on roof.', type: 'think' },
          { text: 'Locating riser positions from architectural model.', type: 'think' },
          { text: 'Extracting design temperatures from specification.', type: 'think' },
          { text: 'Heating setpoint: 21°C winter.', type: 'think' },
          { text: 'Cooling setpoint: 24°C summer.', type: 'think' },
          { text: 'Looking for thermal model in project folder...', type: 'think' },
          { text: 'Thermal model not found — cannot size equipment.', type: 'error' }
        ]},
        { type: 'bot', text: 'I\'ve checked the project against Part L, CIBSE guides and BCO requirements. Local data and similar projects reviewed.<br><br>However, I need thermal loads to size the equipment. No thermal model found.<br><br>Would you like me to run the <strong>IESVE</strong> calculations?' },
        { type: 'user', text: 'Yes, proceed.' },
        { type: 'thinking', steps: [
          { text: 'Launching IESVE thermal analysis...', type: 'think' },
          { text: 'Checking CIBSE TM52 criteria.', type: 'think' },
          { text: 'Importing Revit geometry to IESVE.', type: 'think' },
          { text: 'Building thermal model from geometry.', type: 'action', changes: '+1', filename: 'hvac-model.aps' },
          { text: 'Applying weather data for location.', type: 'action', changes: '+1', filename: 'hvac-model.aps' },
          { text: 'Adding construction templates per Part L.', type: 'action', changes: '+48', filename: 'hvac-model.aps' },
          { text: 'Applying internal gains per CIBSE Guide A.', type: 'action', changes: '+24', filename: 'hvac-model.aps' },
          { text: 'Setting room data temperatures per zone.', type: 'action', changes: '+186', filename: 'hvac-model.aps' },
          { text: 'Applying occupancy profiles.', type: 'think' },
          { text: 'Running heating load simulations...', type: 'think' },
          { text: 'Running cooling load simulations...', type: 'think' },
          { text: 'Running TM52 overheating analysis...', type: 'think' },
          { text: 'All zones pass TM52 criteria.', type: 'think' },
          { text: 'Generating thermal report.', type: 'action', changes: '+1', filename: 'Thermal_Report.pdf' },
          { text: 'Parsing thermal data for equipment sizing...', type: 'think' },
          { text: 'Extracting zone heating and cooling loads.', type: 'think' },
          { text: 'Adding loads to Revit zone information.', type: 'action', changes: '+186', filename: 'heating-cooling.rvt' },
          { text: 'Thermal analysis complete.', type: 'done' }
        ]},
        { type: 'bot', text: 'Thermal analysis complete. All zones pass TM52 overheating criteria. Loads have been added to the model.<br><br>Ready to proceed with equipment sizing and layout?' }
      ],
      thinkingSequence: [
        { text: 'Initiating equipment sizing sequence...', type: 'think' },
        { text: 'Applying Daikin VRV selection criteria.', type: 'think' },
        { text: 'Checking company standard for equipment margins.', type: 'think' },
        { text: 'Reading zone loads from thermal model.', type: 'think' },
        { text: 'Applying safety margin per company standard.', type: 'think' },
        { text: 'Selecting ducted FCU models from manufacturer catalogue.', type: 'think' },
        { text: 'Sizing heater batteries for AHU supply air.', type: 'think' },
        { text: 'Sizing panel heaters for corridor perimeter losses.', type: 'think' },
        { text: 'Calculating VRF outdoor unit capacity with diversity.', type: 'think' },
        { text: 'Checking refrigerant pipe length limits.', type: 'think' },
        { text: 'Checking similar project approaches.', type: 'think' },
        { text: 'Placing ducted FCUs per BCO ceiling void zones.', type: 'action', changes: '+86', filename: 'heating-cooling.rvt' },
        { text: 'Placing heater batteries in AHU rooms.', type: 'action', changes: '+12', filename: 'heating-cooling.rvt' },
        { text: 'Placing panel heaters in corridors.', type: 'action', changes: '+34', filename: 'heating-cooling.rvt' },
        { text: 'Placing VRF outdoor condensers on roof.', type: 'action', changes: '+6', filename: 'heating-cooling.rvt' },
        { text: 'Sizing refrigerant pipework per manufacturer guidelines.', type: 'think' },
        { text: 'Routing refrigerant pipework through risers.', type: 'action', changes: '+892', filename: 'heating-cooling.rvt' },
        { text: 'Checking refrigerant charge limits per F-Gas regulations.', type: 'think' },
        { text: 'All areas compliant.', type: 'think' },
        { text: 'Placing cable tray routes for controls.', type: 'action', changes: '+248', filename: 'heating-cooling.rvt' },
        { text: 'Routing condensate drainage to nearest stack.', type: 'action', changes: '+124', filename: 'heating-cooling.rvt' },
        { text: 'Placing local controllers at each indoor unit.', type: 'action', changes: '+86', filename: 'heating-cooling.rvt' },
        { text: 'Adding specification notes per company standard.', type: 'action', changes: '+24', filename: 'heating-cooling.rvt' },
        { text: 'Generating equipment schedules.', type: 'action', changes: '+4', filename: 'HVAC_Schedule.xlsx' },
        { text: 'Design complete.', type: 'done' }
      ],
      finalMessage: 'Heating & cooling design complete in compliance with <strong>Part L</strong>, <strong>CIBSE Guide A</strong>, and <strong>BCO Guide</strong>:<br>• <strong>86</strong> ducted FCUs sized per zone loads<br>• <strong>12</strong> heater batteries for AHU supply<br>• <strong>34</strong> panel heaters in corridors<br>• <strong>6</strong> VRF outdoor units on roof<br>• Refrigerant pipework sized per manufacturer guidelines<br>• F-Gas regulations checked — all areas compliant<br>• TM52 overheating analysis passed<br><br>Design ready for review.',
      readyPrompt: 'Type <strong>"yes"</strong> or <strong>"proceed"</strong> to generate heating and cooling layout',
      thoughtTrail: 'I need to run IESVE to get accurate heating and cooling loads — without thermal modelling I can\'t size the equipment correctly. TM52 overheating analysis is essential for this building type. The client prefers Daikin so I\'ll use VRV heat recovery units. I should check similar project approaches for the refrigerant routing — pipe length limits need verifying for this building height.',
      videoSource: 'Videos/View 4 - MEP Layouts/03-heating.mp4'
    },
    
    ventilation: {
      messages: [
        { type: 'user', text: 'Can you design the ventilation system?' },
        { type: 'bot', text: 'Yes, let me analyse the requirements, regulations and coordination requirements.' },
        { type: 'thinking', steps: [
          { text: 'Loading project context...', type: 'think' },
          { text: 'Location identified: London, UK (Westminster).', type: 'think' },
          { text: 'Checking Building Regulations Part F (Ventilation).', type: 'think' },
          { text: 'Checking Building Regulations Part B (Fire safety).', type: 'think' },
          { text: 'Checking CIBSE Guide B2 (Ventilation and ductwork).', type: 'think' },
          { text: 'Loading company standard: JPA-STD-VENT-001.', type: 'think' },
          { text: 'Checking previous similar projects.', type: 'think' },
          { text: 'Client preference found: Circular plenum grilles exposed.', type: 'think' },
          { text: 'Reading project specification section 5.6...', type: 'think' },
          { text: 'Client spec: 14 L/s/person fresh air rate.', type: 'think' },
          { text: 'Reading room requirements from thermal model.', type: 'think' },
          { text: 'Fresh air rates found from heating/cooling calculations.', type: 'think' },
          { text: 'Checking Part F compliance.', type: 'think' },
          { text: 'All zones compliant with Part F requirements.', type: 'think' },
          { text: 'Locating ducted fan coil units from HVAC model.', type: 'think' },
          { text: '86 ducted FCUs found — coordinating supply positions.', type: 'think' },
          { text: 'Loading lighting layout from electrical model.', type: 'think' },
          { text: 'Lighting positions calculated per client lux requirements.', type: 'think' },
          { text: 'Loading fire alarm positions from fire engineer.', type: 'think' },
          { text: 'Loading PIR sensor positions from electrical.', type: 'think' },
          { text: 'Forecasting grille positions to avoid clashes.', type: 'think' },
          { text: 'Generating reflected ceiling plan (RCP).', type: 'action', changes: '+1', filename: 'ventilation-layout.rvt' },
          { text: 'Running clash detection against ceiling elements.', type: 'think' },
          { text: 'No clashes with structure or services.', type: 'think' },
          { text: 'Checking company rules for grille placement.', type: 'think' },
          { text: 'All placement rules satisfied.', type: 'think' },
          { text: 'Determining final grille positions.', type: 'think' },
          { text: 'Connecting supply ducts to fan coil units.', type: 'action', changes: '+86', filename: 'ventilation-layout.rvt' },
          { text: 'Awaiting confirmation on fresh air strategy.', type: 'done' }
        ]},
        { type: 'bot', text: 'I\'ve analysed the project against <strong>Part F</strong>, <strong>Part B</strong>, and <strong>CIBSE Guide B2</strong>. Local data and similar projects checked.<br><br>Grille positions coordinated with lighting and fire detection. 86 FCU connections prepared using circular plenum grilles per client preference.<br><br>Do you want to connect fresh air to the rear of the fan coils, or use a separate fresh air system?' }
      ],
      thinkingSequence: [
        { text: 'Proceeding with fresh air connection...', type: 'think' },
        { text: 'Applying CIBSE Guide B2 duct sizing methodology.', type: 'think' },
        { text: 'Checking company standard for maximum duct velocities.', type: 'think' },
        { text: 'Max velocity: 6 m/s for main ducts per company standard.', type: 'think' },
        { text: 'Checking similar project approaches.', type: 'think' },
        { text: 'Drawing main ductwork runs from AHU.', type: 'action', changes: '+342', filename: 'ventilation-layout.rvt' },
        { text: 'Applying CIBSE equal friction sizing method.', type: 'think' },
        { text: 'Tagging all ductwork with system identifiers.', type: 'action', changes: '+86', filename: 'ventilation-layout.rvt' },
        { text: 'Assigning design flow rates per zone (14 L/s/person).', type: 'action', changes: '+86', filename: 'ventilation-layout.rvt' },
        { text: 'Sizing ductwork per calculated flow rates.', type: 'think' },
        { text: 'Checking Part B fire compartment crossings.', type: 'think' },
        { text: 'Adding VCDs at branch takeoffs for balancing.', type: 'action', changes: '+24', filename: 'ventilation-layout.rvt' },
        { text: 'Adding fire dampers at compartment boundaries.', type: 'action', changes: '+18', filename: 'ventilation-layout.rvt' },
        { text: 'Sizing acoustic attenuators per NR criteria.', type: 'think' },
        { text: 'Target: NR 35 for open plan offices.', type: 'think' },
        { text: 'Adding attenuators at AHU discharge.', type: 'action', changes: '+12', filename: 'ventilation-layout.rvt' },
        { text: 'Adding specification notes per company standard.', type: 'action', changes: '+8', filename: 'ventilation-layout.rvt' },
        { text: 'Generating ductwork schedule.', type: 'action', changes: '+4', filename: 'Ductwork_Schedule.xlsx' },
        { text: 'Running final clash detection.', type: 'think' },
        { text: 'No clashes — design complete.', type: 'done' }
      ],
      finalMessage: 'Ventilation design complete in compliance with <strong>Part F</strong>, <strong>Part B</strong>, and <strong>CIBSE Guide B2</strong>:<br>• Fresh air connected to FCU rear spigots (14 L/s/person per client spec)<br>• Ductwork sized per CIBSE equal friction method<br>• Circular plenum grilles coordinated with lighting and fire detection<br>• Fire dampers at all compartment boundaries<br>• VCDs for system balancing<br>• Attenuators sized for NR 35<br><br>Ready to proceed to upper floors? I\'ll apply your preferences automatically.',
      readyPrompt: 'Type <strong>"yes"</strong> or <strong>"proceed"</strong> to add fresh air',
      thoughtTrail: 'The ceiling void coordination is critical here — I need to check the lighting layout, fire detection positions, and sprinkler heads before placing grilles. The client spec requires 14 L/s/person which exceeds Part F minimum. I\'ll use circular plenum grilles as specified and ensure we hit NR 35 with inline attenuators at AHU discharge.',
      videoSource: 'Videos/View 4 - MEP Layouts/04-ventilation.mp4'
    },
    
    controls: {
      messages: [
        { type: 'bot', text: 'BMS specification not found. Has the client specified controls requirements?' },
        { type: 'user', text: 'No. Can you develop a few briefs?' },
        { type: 'bot', text: 'Of course. Generating three options.' },
        { type: 'thinking', steps: [
          { text: 'Analysing mechanical systems for control points.', type: 'think' },
          { text: '127 points identified.', type: 'think' },
          { text: 'Option 1: Basic on/off control — lowest cost.', type: 'think' },
          { text: 'Option 2: Modulating control with scheduling — medium cost.', type: 'think' },
          { text: 'Option 3: Full BMS with trending and optimisation — premium.', type: 'think' },
          { text: 'Done.', type: 'done' }
        ]},
        { type: 'bot', text: 'Three controls packages ready. Can you send these to the client for selection?' },
        { type: 'user', text: 'Client has confirmed. They want the lowest cost option.' },
        { type: 'bot', text: 'Noted. Ready to proceed with basic controls package?' }
      ],
      thinkingSequence: [
        { text: 'Proceeding with basic controls package.', type: 'think' },
        { text: 'Obtaining control inputs from mechanical equipment.', type: 'think' },
        { text: 'Obtaining control outputs.', type: 'think' },
        { text: 'Developing control strategy.', type: 'think' },
        { text: 'Generating BMS points list.', type: 'action', changes: '+1', filename: 'BMS_Points_Schedule.xlsx' },
        { text: 'Adding VRF central controller.', type: 'action', changes: '+1', filename: 'controls.rvt' },
        { text: 'Done.', type: 'done' }
      ],
      finalMessage: 'Controls strategy complete. Basic on/off package selected. 127 BMS points scheduled. VRF central controller added for coordinated operation.',
      readyPrompt: 'Type <strong>"yes"</strong> or <strong>"proceed"</strong> to generate controls',
      videoSource: 'Videos/View 4 - MEP Layouts/05-controls.mp4'
    },
    
    containment: {
      messages: [
        { type: 'bot', text: 'Containment routing required. Can you draw the core containment route on the model?' },
        { type: 'user', text: 'Done. I\'ve drawn the main backbone route.' },
        { type: 'bot', text: 'Route received. Let me analyse.' },
        { type: 'thinking', steps: [
          { text: 'Reading user-defined route.', type: 'think' },
          { text: 'Route accepted as core backbone.', type: 'think' },
          { text: 'Checking clearances against structure.', type: 'think' },
          { text: 'Verifying segregation distances per BS 7671.', type: 'think' },
          { text: 'Done.', type: 'done' }
        ]},
        { type: 'bot', text: 'Core route accepted. Ready to size and complete the containment?' }
      ],
      thinkingSequence: [
        { text: 'Sizing tray for calculated cable volumes.', type: 'action', changes: '+86', filename: 'containment.rvt' },
        { text: 'Adding branch routes to distribution boards.', type: 'action', changes: '+48', filename: 'containment.rvt' },
        { text: 'Coordinating with structure for bracketry.', type: 'think' },
        { text: 'Adding fire stopping at compartment boundaries.', type: 'action', changes: '+24', filename: 'containment.rvt' },
        { text: 'Done.', type: 'done' }
      ],
      finalMessage: 'Containment complete. Core route sized for cable volumes. Branch routes added. Fire stopping scheduled at all compartment boundaries.',
      readyPrompt: 'Type <strong>"yes"</strong> or <strong>"proceed"</strong> to complete containment',
      videoSource: 'Videos/View 4 - MEP Layouts/06-containment.mp4'
    },
    
    power: {
      messages: [
        { type: 'user', text: 'Can you design the small power?' },
        { type: 'bot', text: 'Of course. Let me analyse the requirements.' }
      ],
      thinkingSequence: [
        { text: 'Reading requirements.', type: 'think' },
        { text: 'Calculating power requirements per room.', type: 'think' },
        { text: 'Reading mechanical schedules.', type: 'think' },
        { text: 'Planning socket outlets.', type: 'action', changes: '+186', filename: 'small-power.rvt' },
        { text: 'Placing data outlets.', type: 'action', changes: '+124', filename: 'small-power.rvt' },
        { text: 'Placing submains.', type: 'action', changes: '+48', filename: 'small-power.rvt' },
        { text: 'Allocating submains to tray routes.', type: 'think' },
        { text: 'Connecting to distribution boards.', type: 'action', changes: '+24', filename: 'small-power.rvt' },
        { text: 'Auto-circuiting.', type: 'think' },
        { text: 'Calculating cables per BS 7671.', type: 'think' },
        { text: 'Done.', type: 'done' }
      ],
      finalMessage: 'Small power design complete. Socket outlets and data placed per room requirements. Submains routed through containment and connected to distribution boards. Circuits allocated and cables sized.',
      readyPrompt: 'Type <strong>"yes"</strong> or <strong>"proceed"</strong> to design small power',
      videoSource: 'Videos/View 4 - MEP Layouts/07-power.mp4'
    },
    
    lighting: {
      messages: [
        { type: 'bot', text: 'Lighting specification not found. Has the client specified lux levels or control requirements?' },
        { type: 'user', text: 'No. Can you develop options?' },
        { type: 'bot', text: 'Of course. Generating lighting control options.' },
        { type: 'thinking', steps: [
          { text: 'Reading room schedule for area types.', type: 'think' },
          { text: 'Calculating lux requirements per CIBSE LG7.', type: 'think' },
          { text: 'Option 1: Basic switching — lowest cost.', type: 'think' },
          { text: 'Option 2: Daylight dimming with absence detection — medium cost.', type: 'think' },
          { text: 'Option 3: Full DALI addressable with scene control — premium.', type: 'think' },
          { text: 'Done.', type: 'done' }
        ]},
        { type: 'bot', text: 'Three lighting options ready. Can you send these to the client?' },
        { type: 'user', text: 'Client confirmed. Basic switching.' },
        { type: 'bot', text: 'Noted. Ready to proceed with basic switching?' }
      ],
      thinkingSequence: [
        { text: 'Calculating luminaire quantities per room.', type: 'think' },
        { text: 'Placing luminaires on reflected ceiling plan.', type: 'action', changes: '+248', filename: 'lighting.rvt' },
        { text: 'Luminaire positions affect grille layout.', type: 'think' },
        { text: 'Re-editing ventilation grille positions.', type: 'action', changes: '~32', filename: 'ventilation-layout.rvt' },
        { text: 'Adding emergency luminaires per BS 5266.', type: 'action', changes: '+48', filename: 'lighting.rvt' },
        { text: 'Circuiting to local distribution boards.', type: 'action', changes: '+86', filename: 'lighting.rvt' },
        { text: 'Generating lighting schedule.', type: 'think' },
        { text: 'Done.', type: 'done' }
      ],
      finalMessage: 'Lighting complete. CIBSE LG7 lux levels achieved. Ventilation grilles re-positioned to coordinate with luminaires. Emergency to BS 5266. Circuits allocated.',
      readyPrompt: 'Type <strong>"yes"</strong> or <strong>"proceed"</strong> to place luminaires',
      videoSource: 'Videos/View 4 - MEP Layouts/08-lighting.mp4'
    },
    
    firealarms: {
      messages: [
        { type: 'bot', text: 'Fire alarm design required. Has the fire strategy report been issued?' },
        { type: 'user', text: 'Yes, it\'s in the project documents.' },
        { type: 'bot', text: 'Reading fire strategy report.' },
        { type: 'thinking', steps: [
          { text: 'Reading fire strategy report.', type: 'think' },
          { text: 'L1 coverage specified.', type: 'think' },
          { text: 'Full building protection required.', type: 'think' },
          { text: 'Cause and effect requirements extracted.', type: 'think' },
          { text: 'Interface with sprinkler system noted.', type: 'think' },
          { text: 'Done.', type: 'done' }
        ]},
        { type: 'bot', text: 'Fire report details L1 coverage with sprinkler interface. Ready to proceed with fire alarm layout?' }
      ],
      thinkingSequence: [
        { text: 'Defining zones per floor.', type: 'think' },
        { text: 'Placing detectors in all areas.', type: 'action', changes: '+186', filename: 'fire-alarms.rvt' },
        { text: 'Adding MCPs at exits.', type: 'action', changes: '+24', filename: 'fire-alarms.rvt' },
        { text: 'Placing sounders for 65 dB coverage.', type: 'think' },
        { text: 'Generating cause and effect matrix.', type: 'action', changes: '+1', filename: 'Cause_Effect_Matrix.xlsx' },
        { text: 'Linking sprinkler flow switch interface.', type: 'think' },
        { text: 'Done.', type: 'done' }
      ],
      finalMessage: 'Fire alarm complete. L1 full coverage to BS 5839-1 per fire strategy. Zones defined with cause and effect matrix. Sprinkler interface included.',
      readyPrompt: 'Type <strong>"yes"</strong> or <strong>"proceed"</strong> to place devices',
      videoSource: 'Videos/View 4 - MEP Layouts/09-firealarms.mp4'
    },
    
    security: {
      messages: [
        { type: 'user', text: 'Can you design the security system?' },
        { type: 'bot', text: 'Of course. Let me check the project requirements.' },
        { type: 'thinking', steps: [
          { text: 'Searching project documents.', type: 'think' },
          { text: 'Secured by Design certification required.', type: 'think' },
          { text: 'SBD Commercial 2023 guidelines apply.', type: 'think' },
          { text: 'Access control at all entrance points required.', type: 'think' },
          { text: 'CCTV coverage of external approaches required.', type: 'think' },
          { text: 'Done.', type: 'done' }
        ]},
        { type: 'bot', text: 'Secured by Design certification required. SBD Commercial 2023 conditions apply. Ready to proceed with security layout?' }
      ],
      thinkingSequence: [
        { text: 'Identifying entrance points and secure areas.', type: 'think' },
        { text: 'Placing access readers at all entrances.', type: 'action', changes: '+18', filename: 'security.rvt' },
        { text: 'Adding door controllers and PSUs.', type: 'action', changes: '+9', filename: 'security.rvt' },
        { text: 'Placing CCTV cameras at external approaches.', type: 'action', changes: '+12', filename: 'security.rvt' },
        { text: 'Routing cabling through containment.', type: 'think' },
        { text: 'Integrating with fire alarm for door release.', type: 'think' },
        { text: 'Done.', type: 'done' }
      ],
      finalMessage: 'Security complete. Access control and CCTV positioned to Secured by Design Commercial 2023. Fire alarm integration for door release on activation.',
      readyPrompt: 'Type <strong>"yes"</strong> or <strong>"proceed"</strong> to design security',
      videoSource: 'Videos/View 4 - MEP Layouts/10-security.mp4'
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
    
    // Set cursor style - click handler is managed via event delegation
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
    const thoughtTrailText = conversation.thoughtTrail || 'Analysing project requirements and checking compliance with relevant standards and regulations.';
    
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
      
      // Load and play video - use conversation-specific video source
      const video = gifEl.querySelector('video');
      const img = gifEl.querySelector('img'); // Fallback for non-video views
      const poster = gifEl.querySelector('.video-poster');
      
      if (video) {
        // Disable right-click on video (basic deterrent)
        video.addEventListener('contextmenu', e => e.preventDefault());
        
        // Get video source from conversation data (per-conversation videos)
        const conversationVideoSrc = conversation.videoSource;
        
        if (conversationVideoSrc) {
          try {
            // Load conversation-specific video via blob URL (hides direct path)
            const response = await fetch(conversationVideoSrc);
            const blob = await response.blob();
            video.src = URL.createObjectURL(blob);
          } catch (e) {
            // Fallback to direct source if fetch fails
            video.src = conversationVideoSrc;
            video.load();
          }
        } else {
          // Fallback to default video if no conversation-specific source
          const defaultSource = video.querySelector('source');
          if (defaultSource) {
            video.src = defaultSource.src;
          }
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
    
    // === STEP 10: Ensure cursor style for expand/collapse ===
    // Click handler is managed via event delegation in initThinkingContainerHandlers
    header.style.cursor = 'pointer';
    
    await sleep(TIMING.pause);
    
    // === STEP 11: Move node RIGHT ===
    nodeEl.classList.remove('left');
    await sleep(TIMING.nodeMove);
    
    // === STEP 12: Stop pulsing and clear status ===
    await sleep(TIMING.pause);
    nodeEl.classList.remove('processing');
    // Keep the "Thought for Xm Xs" status visible with expand button
    
    // Re-initialize click handlers for all thinking containers after animation
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
  // Uses event delegation to avoid issues with innerHTML restoration
  let thinkingDelegationInitialized = false;
  
  function initThinkingContainerHandlers(parentEl) {
    if (!parentEl) return;
    
    // Set cursor style on all headers
    parentEl.querySelectorAll('.thinking-container .thinking-header').forEach(header => {
      header.style.cursor = 'pointer';
    });
    
    // Only add the delegated event listener once
    if (!thinkingDelegationInitialized) {
      thinkingDelegationInitialized = true;
      
      // Use event delegation on document to handle all thinking header clicks
      document.addEventListener('click', function(e) {
        // Only handle clicks within View 4's chat messages
        if (!e.target.closest('#chatMessagesIndex4')) return;
        
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
          
          // fully-expanded should match expanded state
          if (isExpanded) {
            // Collapsing
            stepsList.classList.remove('fully-expanded');
          } else {
            // Expanding - show all steps
            stepsList.classList.add('fully-expanded');
            stepsList.querySelectorAll('li').forEach(li => li.classList.add('visible'));
          }
        }
      });
    }
  }
  
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
      // Find the display within the same dropdown context, not global
      const dropdownWrapper = modelOption.closest('.chat-model-dropdown');
      const display = dropdownWrapper ? dropdownWrapper.querySelector('.model-display') : document.querySelector('.model-display');
      if (display) {
        // Parse model name (e.g., "Build X 0.1" -> variant="X", version="0.1")
        const match = modelName.match(/Build\s+(\S+)\s+([\d.]+)/i);
        if (match) {
          const variant = match[1].toUpperCase();
          const version = match[2];
          display.innerHTML = '<span class="brand-build">BUILD</span> <span class="brand-variant">' + variant + '</span><span class="brand-dot">.</span> <span class="model-version-display">' + version + '</span>';
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

