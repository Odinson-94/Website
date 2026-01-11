/**
 * VIEW 5: Schematics Chat Controller
 * 
 * Handles:
 * - Conversation switching (LV, Drainage, Water, etc.)
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
  
  let activeConversation = 'lv';
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
    lv: {
      messages: [
        { type: 'user', text: 'Can you create the LV schematic?' },
        { type: 'bot', text: 'I can see the panelboard is existing, but I don\'t have the circuit charts. Do you have a photograph or document showing the existing circuits?' },
        { type: 'user', text: 'Yes, I\'ve uploaded the photo to the project folder.' },
        { type: 'thinking', steps: [
          { text: 'Reading uploaded photograph...', type: 'think' },
          { text: 'Running OCR on circuit chart image.', type: 'think' },
          { text: 'Extracting circuit descriptions.', type: 'think' },
          { text: 'Parsing protective device ratings.', type: 'think' },
          { text: 'Cross-referencing with layout data.', type: 'think' },
          { text: 'Matching circuits to distribution boards.', type: 'think' },
          { text: 'Storing circuit data to project.', type: 'action', changes: '+48', filename: 'Circuit_Schedule.xlsx' },
          { text: 'Circuit data extracted successfully.', type: 'done' }
        ]},
        { type: 'bot', text: 'I\'ve extracted the circuit data from your photograph using OCR. <strong>48 circuits</strong> identified across <strong>DB-01</strong> and <strong>DB-02</strong>. Protective device ratings and cable sizes have been captured.<br><br>Ready to generate the LV schematic?' }
      ],
      thinkingSequence: [
        { text: 'Initiating LV schematic generation...', type: 'think' },
        { text: 'Loading circuit schedule from project.', type: 'think' },
        { text: 'Checking BS 7671 for protective device coordination.', type: 'think' },
        { text: 'Calculating discrimination between devices.', type: 'think' },
        { text: 'Verifying cable sizes per circuit loading.', type: 'think' },
        { text: 'Checking volt drop calculations.', type: 'think' },
        { text: 'All circuits within 3% volt drop limit.', type: 'think' },
        { text: 'Generating single-line diagram layout.', type: 'action', changes: '+1', filename: 'LV_Schematic.rvt' },
        { text: 'Adding protective device symbols.', type: 'action', changes: '+96', filename: 'LV_Schematic.rvt' },
        { text: 'Adding cable annotations.', type: 'action', changes: '+48', filename: 'LV_Schematic.rvt' },
        { text: 'Adding circuit references.', type: 'action', changes: '+48', filename: 'LV_Schematic.rvt' },
        { text: 'Generating PDF output.', type: 'action', changes: '+1', filename: 'LV_Schematic.pdf' },
        { text: 'Schematic generation complete.', type: 'done' }
      ],
      finalMessage: 'LV schematic generated in compliance with <strong>BS 7671</strong>:<br>• <strong>48 circuits</strong> documented across 2 distribution boards<br>• Protective device coordination verified<br>• Cable sizes confirmed per loading<br>• Volt drop within 3% limit<br><br>Output saved: <code>LV_Schematic.pdf</code>',
      readyPrompt: 'Type <strong>"yes"</strong> or <strong>"proceed"</strong> to generate LV schematic',
      thoughtTrail: 'I need to extract the circuit data from the uploaded photograph using OCR, then cross-reference with the layout data to ensure all circuits are accounted for. Protective device coordination per BS 7671 is essential.',
      videoSource: 'Videos/View 5 - Schematics/01-lv.mp4'
    },
    
    drainage: {
      messages: [],
      thinkingSequence: [
        { text: 'Initiating drainage schematic generation...', type: 'think' },
        { text: 'Loading SVP data from project folder.', type: 'think' },
        { text: 'Reading stack positions and connections.', type: 'think' },
        { text: 'Checking discharge unit calculations per BS EN 12056.', type: 'think' },
        { text: 'Generating schematic layout.', type: 'action', changes: '+1', filename: 'Drainage_Schematic.rvt' },
        { text: 'Adding SVP symbols and annotations.', type: 'action', changes: '+24', filename: 'Drainage_Schematic.rvt' },
        { text: 'Adding branch connections.', type: 'action', changes: '+86', filename: 'Drainage_Schematic.rvt' },
        { text: 'Adding pipe sizes and gradients.', type: 'action', changes: '+48', filename: 'Drainage_Schematic.rvt' },
        { text: 'Adding discharge unit annotations.', type: 'action', changes: '+24', filename: 'Drainage_Schematic.rvt' },
        { text: 'Generating PDF output.', type: 'action', changes: '+1', filename: 'Drainage_Schematic.pdf' },
        { text: 'Schematic generation complete.', type: 'done' }
      ],
      finalMessage: 'Drainage schematic generated per <strong>BS EN 12056</strong>:<br>• <strong>24 SVPs</strong> documented with connections<br>• Branch pipes sized and annotated<br>• Gradients shown per Approved Document H<br>• Discharge units calculated per stack<br><br>Output saved: <code>Drainage_Schematic.pdf</code>',
      readyPrompt: 'Try: <strong>"Can you create the drainage schematic?"</strong>',
      thoughtTrail: 'I have the SVPs from the project folder. I can generate the drainage schematic directly from this data, showing stack positions and discharge unit calculations.',
      videoSource: 'Videos/View 5 - Schematics/02-drainage.mp4',
      // Special handling for blank conversation with guided prompts
      blankConversation: true,
      expectedKeywords: ['drainage', 'schematic'],
      contextualResponse: 'I have the SVPs from the project folder. Starting now.',
      fallbackPrompt: 'I can see the subject — do you want to generate the drainage schematic instead?'
    },
    
    water: {
      messages: [
        { type: 'user', text: 'Can you create the water schematic?' },
        { type: 'bot', text: 'I can see the water outlets and network from the Revit model, which is different to the RIBA Stage 3 design. Do you want me to proceed with Revit as source of truth?' }
      ],
      thinkingSequence: [
        { text: 'Initiating water schematic generation...', type: 'think' },
        { text: 'Loading water network from Revit model.', type: 'think' },
        { text: 'Reading outlet positions and pipe routes.', type: 'think' },
        { text: 'Comparing against RIBA Stage 3 design.', type: 'think' },
        { text: 'Using Revit model as source of truth.', type: 'think' },
        { text: 'Generating schematic layout.', type: 'action', changes: '+1', filename: 'Water_Schematic.rvt' },
        { text: 'Adding riser symbols and annotations.', type: 'action', changes: '+12', filename: 'Water_Schematic.rvt' },
        { text: 'Adding branch connections.', type: 'action', changes: '+142', filename: 'Water_Schematic.rvt' },
        { text: 'Adding pipe sizes per BS EN 806.', type: 'action', changes: '+86', filename: 'Water_Schematic.rvt' },
        { text: 'Adding loading unit annotations.', type: 'action', changes: '+48', filename: 'Water_Schematic.rvt' },
        { text: 'Adding booster set detail.', type: 'action', changes: '+8', filename: 'Water_Schematic.rvt' },
        { text: 'Generating PDF output.', type: 'action', changes: '+1', filename: 'Water_Schematic.pdf' },
        { text: 'Schematic generation complete.', type: 'done' }
      ],
      finalMessage: 'Water schematic generated per <strong>BS EN 806</strong> using Revit model as source of truth:<br>• <strong>186 cold water outlets</strong> documented<br>• <strong>142 hot water outlets</strong> documented<br>• Pipe sizes annotated per loading units<br>• Booster set detail included<br><br>Output saved: <code>Water_Schematic.pdf</code>',
      readyPrompt: 'Type <strong>"yes"</strong> or <strong>"proceed"</strong> to generate water schematic',
      thoughtTrail: 'The Revit model contains the current water outlet positions and network layout. This differs from the RIBA Stage 3 design, so I will use Revit as the source of truth for the schematic.',
      videoSource: 'Videos/View 5 - Schematics/03-water.mp4'
    },
    
    heating: {
      messages: [
        { type: 'user', text: 'Can you generate the heating schematic?' },
        { type: 'bot', text: 'Yes, would you like both the plant and the distribution schematic? I can see both in the model.' }
      ],
      thinkingSequence: [
        { text: 'Initiating heating schematic generation...', type: 'think' },
        { text: 'Loading heating system data from model.', type: 'think' },
        { text: 'Reading plant room equipment positions.', type: 'think' },
        { text: 'Reading distribution network layout.', type: 'think' },
        { text: 'Generating plant schematic layout.', type: 'action', changes: '+1', filename: 'Heating_Plant_Schematic.rvt' },
        { text: 'Adding boiler/heat pump symbols.', type: 'action', changes: '+4', filename: 'Heating_Plant_Schematic.rvt' },
        { text: 'Adding pump sets and valves.', type: 'action', changes: '+18', filename: 'Heating_Plant_Schematic.rvt' },
        { text: 'Adding pipework connections.', type: 'action', changes: '+42', filename: 'Heating_Plant_Schematic.rvt' },
        { text: 'Generating distribution schematic layout.', type: 'action', changes: '+1', filename: 'Heating_Distribution_Schematic.rvt' },
        { text: 'Adding FCU symbols.', type: 'action', changes: '+86', filename: 'Heating_Distribution_Schematic.rvt' },
        { text: 'Adding radiator/emitter symbols.', type: 'action', changes: '+34', filename: 'Heating_Distribution_Schematic.rvt' },
        { text: 'Adding pipework routes and sizes.', type: 'action', changes: '+124', filename: 'Heating_Distribution_Schematic.rvt' },
        { text: 'Adding capacity annotations.', type: 'action', changes: '+92', filename: 'Heating_Distribution_Schematic.rvt' },
        { text: 'Generating PDF outputs.', type: 'action', changes: '+2', filename: 'Heating_Schematics.pdf' },
        { text: 'Schematic generation complete.', type: 'done' }
      ],
      finalMessage: 'Heating schematics generated:<br><br><strong>Plant Schematic:</strong><br>• <strong>4 heat sources</strong> documented<br>• Pump sets and valve arrangements shown<br>• Primary circuit layout complete<br><br><strong>Distribution Schematic:</strong><br>• <strong>86 FCUs</strong> with capacity annotations<br>• <strong>34 radiators/emitters</strong> documented<br>• Secondary pipework routes and sizes shown<br><br>Output saved: <code>Heating_Schematics.pdf</code>',
      readyPrompt: 'Type <strong>"yes"</strong> or <strong>"proceed"</strong> to generate heating schematics',
      thoughtTrail: 'I can see both the plant room equipment and distribution network in the model. I will generate both schematics to show the complete heating system.',
      videoSource: 'Videos/View 5 - Schematics/04-heating.mp4'
    },
    
    ventilation: {
      messages: [
        { type: 'user', text: 'Can you create the ventilation schematic?' },
        { type: 'bot', text: 'I have the ventilation layout data from View 4. AHU positions, ductwork routes and air flow rates are available. Ready to generate the air balance diagram?' }
      ],
      thinkingSequence: [
        { text: 'Initiating air balance diagram generation...', type: 'think' },
        { text: 'Loading ventilation layout from project.', type: 'think' },
        { text: 'Reading AHU positions and capacities.', type: 'think' },
        { text: 'Reading zone air flow rates.', type: 'think' },
        { text: 'Generating air balance diagram layout.', type: 'action', changes: '+1', filename: 'Air_Balance_Diagram.rvt' },
        { text: 'Adding AHU symbols.', type: 'action', changes: '+4', filename: 'Air_Balance_Diagram.rvt' },
        { text: 'Adding zone supply/extract annotations.', type: 'action', changes: '+86', filename: 'Air_Balance_Diagram.rvt' },
        { text: 'Adding ductwork schematic routes.', type: 'action', changes: '+124', filename: 'Air_Balance_Diagram.rvt' },
        { text: 'Adding air flow rate annotations.', type: 'action', changes: '+172', filename: 'Air_Balance_Diagram.rvt' },
        { text: 'Adding commissioning set points.', type: 'action', changes: '+48', filename: 'Air_Balance_Diagram.rvt' },
        { text: 'Generating PDF output.', type: 'action', changes: '+1', filename: 'Air_Balance_Diagram.pdf' },
        { text: 'Air balance diagram generation complete.', type: 'done' }
      ],
      finalMessage: 'Air balance diagram generated per <strong>CIBSE Guide B2</strong>:<br>• <strong>4 AHUs</strong> documented with capacities<br>• <strong>86 zones</strong> with supply/extract rates<br>• Ductwork routes shown schematically<br>• Commissioning set points included<br><br>Output saved: <code>Air_Balance_Diagram.pdf</code>',
      readyPrompt: 'Type <strong>"yes"</strong> or <strong>"proceed"</strong> to generate air balance diagram',
      thoughtTrail: 'The ventilation layout from View 4 includes all AHU positions, zone air flow calculations and ductwork routes. Fresh air rates per zone are available.',
      videoSource: 'Videos/View 5 - Schematics/05-ventilation.mp4'
    },
    
    containment: {
      messages: [
        { type: 'user', text: 'Can you create the containment schematic?' },
        { type: 'bot', text: 'I have the containment layout data from View 4. Tray routes, sizes and cable volumes are available. Ready to generate the containment riser diagram?' }
      ],
      thinkingSequence: [
        { text: 'Initiating containment riser diagram generation...', type: 'think' },
        { text: 'Loading containment layout from project.', type: 'think' },
        { text: 'Reading tray routes and sizes.', type: 'think' },
        { text: 'Reading cable volume allocations.', type: 'think' },
        { text: 'Generating riser diagram layout.', type: 'action', changes: '+1', filename: 'Containment_Riser.rvt' },
        { text: 'Adding riser symbols.', type: 'action', changes: '+12', filename: 'Containment_Riser.rvt' },
        { text: 'Adding tray size annotations.', type: 'action', changes: '+86', filename: 'Containment_Riser.rvt' },
        { text: 'Adding cable volume percentages.', type: 'action', changes: '+48', filename: 'Containment_Riser.rvt' },
        { text: 'Adding fire stopping locations.', type: 'action', changes: '+24', filename: 'Containment_Riser.rvt' },
        { text: 'Generating PDF output.', type: 'action', changes: '+1', filename: 'Containment_Riser.pdf' },
        { text: 'Riser diagram generation complete.', type: 'done' }
      ],
      finalMessage: 'Containment riser diagram generated per <strong>BS 7671</strong>:<br>• <strong>12 risers</strong> documented with tray sizes<br>• Cable volume percentages annotated<br>• Fire stopping locations marked<br>• Segregation distances verified<br><br>Output saved: <code>Containment_Riser.pdf</code>',
      readyPrompt: 'Type <strong>"yes"</strong> or <strong>"proceed"</strong> to generate containment riser diagram',
      thoughtTrail: 'The containment layout from View 4 includes all tray routes, sizes and cable volume calculations. Fire stopping requirements are documented.',
      videoSource: 'Videos/View 5 - Schematics/06-containment.mp4'
    },
    
    smallpower: {
      messages: [
        { type: 'user', text: 'Can you create the small power schematic?' },
        { type: 'bot', text: 'I have small power layout data, but it appears outdated. The layout was modified after the last sync. Would you like me to sync the data first?' },
        { type: 'user', text: 'Yes, please sync first.' },
        { type: 'thinking', steps: [
          { text: 'Reading current layout data...', type: 'think' },
          { text: 'Comparing with stored schematic data.', type: 'think' },
          { text: 'Detecting 12 new outlets added.', type: 'think' },
          { text: 'Detecting 4 outlets repositioned.', type: 'think' },
          { text: 'Updating circuit allocations.', type: 'action', changes: '+16', filename: 'Circuit_Schedule.xlsx' },
          { text: 'Recalculating cable lengths.', type: 'think' },
          { text: 'Updating volt drop calculations.', type: 'action', changes: '~12', filename: 'Cable_Calculations.xlsx' },
          { text: 'Sync complete.', type: 'done' }
        ]},
        { type: 'bot', text: 'Data synced. <strong>12 new outlets</strong> added to circuits and <strong>4 repositioned</strong> outlets updated. Cable calculations refreshed.<br><br>Ready to generate the small power schematic?' }
      ],
      thinkingSequence: [
        { text: 'Initiating small power schematic generation...', type: 'think' },
        { text: 'Loading synced circuit data.', type: 'think' },
        { text: 'Reading distribution board allocations.', type: 'think' },
        { text: 'Generating schematic layout.', type: 'action', changes: '+1', filename: 'Small_Power_Schematic.rvt' },
        { text: 'Adding distribution board symbols.', type: 'action', changes: '+8', filename: 'Small_Power_Schematic.rvt' },
        { text: 'Adding circuit lines.', type: 'action', changes: '+186', filename: 'Small_Power_Schematic.rvt' },
        { text: 'Adding outlet symbols.', type: 'action', changes: '+186', filename: 'Small_Power_Schematic.rvt' },
        { text: 'Adding cable annotations.', type: 'action', changes: '+186', filename: 'Small_Power_Schematic.rvt' },
        { text: 'Adding protective device ratings.', type: 'action', changes: '+48', filename: 'Small_Power_Schematic.rvt' },
        { text: 'Generating PDF output.', type: 'action', changes: '+1', filename: 'Small_Power_Schematic.pdf' },
        { text: 'Schematic generation complete.', type: 'done' }
      ],
      finalMessage: 'Small power schematic generated per <strong>BS 7671</strong>:<br>• <strong>186 outlets</strong> across 8 distribution boards<br>• Circuit allocations documented<br>• Cable sizes annotated per loading<br>• Protective device ratings shown<br><br>Output saved: <code>Small_Power_Schematic.pdf</code>',
      readyPrompt: 'Type <strong>"yes"</strong> or <strong>"proceed"</strong> to generate small power schematic',
      thoughtTrail: 'The small power layout was modified since the last sync. I need to update the circuit allocations and recalculate cable lengths before generating the schematic.',
      videoSource: 'Videos/View 5 - Schematics/07-smallpower.mp4'
    },
    
    lighting: {
      messages: [
        { type: 'user', text: 'Can you create the lighting schematic?' },
        { type: 'bot', text: 'I have the lighting layout data from View 4. Luminaire positions, circuits and control zones are available. Ready to generate the lighting schematic?' }
      ],
      thinkingSequence: [
        { text: 'Initiating lighting schematic generation...', type: 'think' },
        { text: 'Loading lighting layout from project.', type: 'think' },
        { text: 'Reading luminaire positions and types.', type: 'think' },
        { text: 'Reading circuit allocations.', type: 'think' },
        { text: 'Generating schematic layout.', type: 'action', changes: '+1', filename: 'Lighting_Schematic.rvt' },
        { text: 'Adding distribution board symbols.', type: 'action', changes: '+4', filename: 'Lighting_Schematic.rvt' },
        { text: 'Adding circuit lines.', type: 'action', changes: '+248', filename: 'Lighting_Schematic.rvt' },
        { text: 'Adding luminaire symbols.', type: 'action', changes: '+248', filename: 'Lighting_Schematic.rvt' },
        { text: 'Adding emergency luminaire annotations.', type: 'action', changes: '+48', filename: 'Lighting_Schematic.rvt' },
        { text: 'Adding control zone boundaries.', type: 'action', changes: '+24', filename: 'Lighting_Schematic.rvt' },
        { text: 'Generating PDF output.', type: 'action', changes: '+1', filename: 'Lighting_Schematic.pdf' },
        { text: 'Schematic generation complete.', type: 'done' }
      ],
      finalMessage: 'Lighting schematic generated per <strong>BS 5266</strong>:<br>• <strong>248 luminaires</strong> documented<br>• <strong>48 emergency luminaires</strong> annotated<br>• Circuit allocations shown<br>• Control zones defined<br><br>Output saved: <code>Lighting_Schematic.pdf</code>',
      readyPrompt: 'Type <strong>"yes"</strong> or <strong>"proceed"</strong> to generate lighting schematic',
      thoughtTrail: 'The lighting layout from View 4 includes all luminaire positions, circuit allocations and emergency lighting per BS 5266.',
      videoSource: 'Videos/View 5 - Schematics/08-lighting.mp4'
    },
    
    firealarms: {
      messages: [
        { type: 'user', text: 'Can you create the fire alarm schematic?' },
        { type: 'bot', text: 'Of course, do you want the cause and effect and addresses too? I can see that the panel is existing, so will need to verify if existing addresses occur before giving this out.' }
      ],
      thinkingSequence: [
        { text: 'Initiating fire alarm schematic generation...', type: 'think' },
        { text: 'Loading fire alarm layout from project.', type: 'think' },
        { text: 'Checking existing panel configuration.', type: 'think' },
        { text: 'Reading device positions and types.', type: 'think' },
        { text: 'Verifying existing address allocations.', type: 'think' },
        { text: 'Cross-referencing with existing panel addresses.', type: 'think' },
        { text: 'Address conflicts found — flagging for review.', type: 'think' },
        { text: 'Generating schematic layout.', type: 'action', changes: '+1', filename: 'Fire_Alarm_Schematic.rvt' },
        { text: 'Adding existing panel symbol.', type: 'action', changes: '+1', filename: 'Fire_Alarm_Schematic.rvt' },
        { text: 'Adding zone loop diagrams.', type: 'action', changes: '+12', filename: 'Fire_Alarm_Schematic.rvt' },
        { text: 'Adding detector symbols with addresses.', type: 'action', changes: '+186', filename: 'Fire_Alarm_Schematic.rvt' },
        { text: 'Adding MCP symbols with addresses.', type: 'action', changes: '+24', filename: 'Fire_Alarm_Schematic.rvt' },
        { text: 'Adding sounder symbols.', type: 'action', changes: '+48', filename: 'Fire_Alarm_Schematic.rvt' },
        { text: 'Generating cause and effect matrix.', type: 'action', changes: '+1', filename: 'Cause_Effect_Matrix.xlsx' },
        { text: 'Adding cause & effect references to schematic.', type: 'action', changes: '+12', filename: 'Fire_Alarm_Schematic.rvt' },
        { text: 'Generating PDF output.', type: 'action', changes: '+1', filename: 'Fire_Alarm_Schematic.pdf' },
        { text: 'Schematic generation complete.', type: 'done' }
      ],
      finalMessage: 'Fire alarm schematic generated per <strong>BS 5839-1</strong>:<br>• <strong>186 detectors</strong> across 12 zones with addresses<br>• <strong>24 MCPs</strong> at exit points with addresses<br>• <strong>48 sounders</strong> for coverage<br>• Cause & effect matrix generated<br><br><strong>Note:</strong> Existing panel addresses have been verified. Some address conflicts flagged for review before issuing.<br><br>Output saved: <code>Fire_Alarm_Schematic.pdf</code>',
      readyPrompt: 'Type <strong>"yes"</strong> or <strong>"proceed"</strong> to generate fire alarm schematic',
      thoughtTrail: 'The panel is existing so I need to verify if existing addresses are in use before allocating new ones. I will cross-reference the device addresses and flag any conflicts.',
      videoSource: 'Videos/View 5 - Schematics/09-firealarms.mp4'
    },
    
    security: {
      messages: [
        { type: 'user', text: 'Can you create the security schematic?' },
        { type: 'bot', text: 'Yes, can you confirm the supplier is as per existing panel? If so, I can attach the documentation as a tech sub too.' }
      ],
      thinkingSequence: [
        { text: 'Initiating security schematic generation...', type: 'think' },
        { text: 'Loading security layout from project.', type: 'think' },
        { text: 'Checking existing panel supplier.', type: 'think' },
        { text: 'Supplier confirmed — loading product documentation.', type: 'think' },
        { text: 'Reading access control positions.', type: 'think' },
        { text: 'Reading CCTV camera positions.', type: 'think' },
        { text: 'Generating schematic layout.', type: 'action', changes: '+1', filename: 'Security_Schematic.rvt' },
        { text: 'Adding existing access control panel symbol.', type: 'action', changes: '+1', filename: 'Security_Schematic.rvt' },
        { text: 'Adding door controller symbols.', type: 'action', changes: '+9', filename: 'Security_Schematic.rvt' },
        { text: 'Adding reader symbols.', type: 'action', changes: '+18', filename: 'Security_Schematic.rvt' },
        { text: 'Adding CCTV camera symbols.', type: 'action', changes: '+12', filename: 'Security_Schematic.rvt' },
        { text: 'Adding NVR symbol.', type: 'action', changes: '+1', filename: 'Security_Schematic.rvt' },
        { text: 'Adding network topology.', type: 'action', changes: '+24', filename: 'Security_Schematic.rvt' },
        { text: 'Attaching supplier documentation.', type: 'action', changes: '+1', filename: 'Security_Tech_Submittal.pdf' },
        { text: 'Generating PDF output.', type: 'action', changes: '+1', filename: 'Security_Schematic.pdf' },
        { text: 'Schematic generation complete.', type: 'done' }
      ],
      finalMessage: 'Security schematic generated per <strong>SBD Commercial 2023</strong>:<br>• <strong>18 access readers</strong> documented<br>• <strong>9 door controllers</strong> with PSUs<br>• <strong>12 CCTV cameras</strong> with NVR<br>• Network topology shown<br>• Supplier documentation attached as tech sub<br><br>Output saved: <code>Security_Schematic.pdf</code><br>Tech submittal: <code>Security_Tech_Submittal.pdf</code>',
      readyPrompt: 'Type <strong>"yes"</strong> or <strong>"proceed"</strong> to generate security schematic',
      thoughtTrail: 'The existing panel supplier has been confirmed. I will attach the product documentation as a technical submittal along with the schematic.',
      videoSource: 'Videos/View 5 - Schematics/10-security.mp4'
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
      chatMessages: document.getElementById('chatMessagesIndex5'),
      persistentNode: document.getElementById('chatPersistentNodeIndex5'),
      gifSection: document.getElementById('gifSectionIndex5'),
      chatInput: document.getElementById('chatInputIndex5'),
      chatSend: document.getElementById('chatSendIndex5')
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
        return 'Generating schematic...';
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
      console.warn('View5Chat: No conversation found for:', activeConversation);
      isAnimating = false;
      return;
    }
    
    const steps = conversation.thinkingSequence;
    const finalMsg = conversation.finalMessage;
    const thoughtTrailText = conversation.thoughtTrail || 'Analysing project data and generating schematic output.';
    
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
    
    // Thought trail click handler is now via event delegation in initThinkingContainerHandlers()
    // No direct handler needed here - it would conflict with delegation
    
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
          const gifSection = document.getElementById('gifSectionIndex5');
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
      console.warn('View5Chat: chatMessagesIndex5 not found');
      return;
    }
    
    const conversation = conversations[conversationKey];
    if (!conversation) {
      console.warn('View5Chat: conversation not found for:', conversationKey);
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
  
  // Common swear words to detect (basic list)
  const swearWords = ['fuck', 'shit', 'damn', 'crap', 'ass', 'bastard', 'bitch', 'hell', 'piss'];
  
  function containsSwearWord(text) {
    const lowerText = text.toLowerCase();
    return swearWords.some(word => lowerText.includes(word));
  }
  
  function containsKeywords(text, keywords) {
    const lowerText = text.toLowerCase();
    return keywords.every(keyword => lowerText.includes(keyword.toLowerCase()));
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
    
    // Get current conversation
    const conversation = conversations[activeConversation];
    const state = conversationStates[activeConversation] || {};
    
    // Check for swearing first
    if (containsSwearWord(input)) {
      await sleep(300);
      addMessageWithAnimation(chatEl, 'demo-msg-bot', '<p>Please keep it professional.</p>');
      chatEl.scrollTop = chatEl.scrollHeight;
      conversationStates[activeConversation] = { ...state, chatHTML: chatEl.innerHTML };
      return;
    }
    
    // Check if this is a blank conversation (like drainage)
    const isBlankConversation = conversation && 
                                 conversation.blankConversation && 
                                 conversation.messages.length === 0;
    
    // Check for proceed commands
    if (input === 'yes' || input === 'proceed' || input === 'y' || input === 'ok') {
      // Check if command already completed for this conversation
      if (state.completed) {
        await sleep(300);
        addMessageWithAnimation(chatEl, 'demo-msg-bot', '<p>I\'m sorry, this schematic has already been generated. Please select a different system from the history.</p>');
        chatEl.scrollTop = chatEl.scrollHeight;
        return;
      }
      
      // If awaiting fallback confirmation, proceed with workflow
      if (state.awaitingFallbackConfirm || state.awaitingYesNo) {
        await sleep(300);
        addMessageWithAnimation(chatEl, 'demo-msg-bot', '<p>' + conversation.contextualResponse + '</p>');
        chatEl.scrollTop = chatEl.scrollHeight;
        conversationStates[activeConversation] = { ...state, awaitingFallbackConfirm: false, awaitingYesNo: false };
        
        await sleep(500);
        await runNeuralNodeWorkflow();
        
        conversationStates[activeConversation] = {
          completed: true,
          chatHTML: chatEl.innerHTML
        };
        return;
      }
      
      await runNeuralNodeWorkflow();
      
      // Save completed state for this conversation
      conversationStates[activeConversation] = {
        completed: true,
        chatHTML: chatEl.innerHTML
      };
    } else if (input === 'no' || input === 'n') {
      // User said no to fallback prompt
      if (state.awaitingFallbackConfirm || state.awaitingYesNo) {
        await sleep(300);
        addMessageWithAnimation(chatEl, 'demo-msg-bot', '<p>Ok, we\'ll leave for now. Come back when ready.</p>');
        chatEl.scrollTop = chatEl.scrollHeight;
        conversationStates[activeConversation] = { 
          ...state, 
          awaitingFallbackConfirm: false, 
          awaitingYesNo: false,
          chatHTML: chatEl.innerHTML 
        };
        return;
      }
      await sleep(300);
      addMessageWithAnimation(chatEl, 'demo-msg-bot', '<p>Ok, we\'ll leave for now. Come back when ready.</p>');
      chatEl.scrollTop = chatEl.scrollHeight;
      conversationStates[activeConversation] = { ...state, chatHTML: chatEl.innerHTML };
    } else if (isBlankConversation && !state.completed) {
      // Handle blank conversation logic
      const hasKeywords = conversation.expectedKeywords && 
                          containsKeywords(input, conversation.expectedKeywords);
      
      if (hasKeywords) {
        // User asked the right question - proceed with contextual response and workflow
        await sleep(300);
        addMessageWithAnimation(chatEl, 'demo-msg-bot', '<p>' + conversation.contextualResponse + '</p>');
        chatEl.scrollTop = chatEl.scrollHeight;
        
        await sleep(500);
        await runNeuralNodeWorkflow();
        
        conversationStates[activeConversation] = {
          completed: true,
          chatHTML: chatEl.innerHTML
        };
      } else if (state.awaitingFallbackConfirm) {
        // User responded to fallback but not with yes/no - ask again
        await sleep(300);
        addMessageWithAnimation(chatEl, 'demo-msg-bot', '<p>Yes or no?</p>');
        chatEl.scrollTop = chatEl.scrollHeight;
        conversationStates[activeConversation] = { 
          ...state, 
          awaitingFallbackConfirm: false,
          awaitingYesNo: true,
          chatHTML: chatEl.innerHTML 
        };
      } else if (state.awaitingYesNo) {
        // User still didn't say yes or no - give up
        await sleep(300);
        addMessageWithAnimation(chatEl, 'demo-msg-bot', '<p>Ok, we\'ll leave for now. Come back when ready.</p>');
        chatEl.scrollTop = chatEl.scrollHeight;
        conversationStates[activeConversation] = { 
          ...state, 
          awaitingYesNo: false,
          chatHTML: chatEl.innerHTML 
        };
      } else {
        // User didn't use the right keywords - show fallback prompt
        await sleep(300);
        addMessageWithAnimation(chatEl, 'demo-msg-bot', '<p>' + conversation.fallbackPrompt + '</p>');
        chatEl.scrollTop = chatEl.scrollHeight;
        conversationStates[activeConversation] = { 
          ...state, 
          awaitingFallbackConfirm: true,
          chatHTML: chatEl.innerHTML 
        };
      }
    } else {
      await sleep(300);
      addMessageWithAnimation(chatEl, 'demo-msg-bot', '<p>Please type "yes" or "proceed" to generate the schematic.</p>');
      chatEl.scrollTop = chatEl.scrollHeight;
    }
  }
  
  // ============================================
  // INITIALIZATION
  // ============================================
  
  function init() {
    // History item clicks - conversation switching
    document.addEventListener('click', function(e) {
      const historyItem = e.target.closest('#chatHistoryIndex5 .demo-history-item');
      if (!historyItem) return;
      
      // Update active state
      document.querySelectorAll('#chatHistoryIndex5 .demo-history-item').forEach(i => i.classList.remove('active'));
      historyItem.classList.add('active');
      
      // Load conversation
      const system = historyItem.getAttribute('data-system') || historyItem.getAttribute('data-conversation');
      if (system && conversations[system]) {
        loadConversation(system);
      }
    });
    
    // Send button click
    document.addEventListener('click', function(e) {
      if (e.target.closest('#chatSendIndex5')) {
        handleChatSend(e);
      }
    });
    
    // Enter key in input (works for both input and contenteditable)
    document.addEventListener('keydown', function(e) {
      const inputEl = document.getElementById('chatInputIndex5');
      if (e.key === 'Enter' && !e.shiftKey && document.activeElement === inputEl) {
        e.preventDefault(); // Prevent newline in contenteditable
        handleChatSend(e);
      }
    });
    
    // Initialize existing thinking containers in HTML
    initThinkingContainerHandlers(document.getElementById('chatMessagesIndex5'));
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
        // Only handle clicks within View 5's chat messages
        if (!e.target.closest('#chatMessagesIndex5')) return;
        
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
      
      // Event delegation for thought-trail expand/collapse (fixes lost handlers after HTML restore)
      document.addEventListener('click', function(e) {
        // Only handle clicks within View 5's chat messages
        if (!e.target.closest('#chatMessagesIndex5')) return;
        
        const thoughtHeader = e.target.closest('.thought-trail-header');
        if (!thoughtHeader) return;
        
        const thoughtTrail = thoughtHeader.closest('.thought-trail');
        if (thoughtTrail) {
          thoughtTrail.classList.toggle('expanded');
        }
      });
    }
  }
  
  // Chat sidebar resize handle for View 5
  function initResizeHandler() {
    const chatSidebarResize = document.querySelector('#schematicsOverlay .chat-sidebar-resize');
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
  window.View5Chat = {
    loadConversation: loadConversation,
    getActiveConversation: function() { return activeConversation; },
    conversations: conversations
  };
  
})();

