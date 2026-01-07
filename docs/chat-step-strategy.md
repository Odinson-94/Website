# Chat Step Strategy

## Overview

Chat steps are categorized into two distinct types: **Thinking Steps** and **Action Steps**. This distinction helps users understand what the AI is doing at each moment.

---

## Step Types

### Thinking Steps (Read/Analyze)

Thinking steps represent cognitive processes where the AI is gathering information, calculating, or forecasting. These steps do **not** modify any files or elements.

**Visual indicators:**
- Simple grey dot node (●)
- No +/- element counts
- No filename

**Examples:**
- Reading specification.
- Checking number of outlets.
- Calculating condensate connection requirements.
- Forecasting clashes.
- Analyzing room layouts.
- Finding rooms...
- Understanding where connections would be required.

**Verbs that indicate thinking:**
- Reading
- Checking
- Analyzing
- Finding
- Understanding
- Calculating
- Forecasting
- Looking for
- Continuing

---

### Action Steps (Write/Edit)

Action steps represent operations where the AI is actively modifying, creating, or removing elements in a file. These steps **do** change the project.

**Visual indicators:**
- Pencil icon (✎) on left
- +/- count in styled box (e.g., `+366`)
- Filename on right in light font (e.g., `drainage-layout.rvt`)

**Examples:**
- Placing pop ups on drawing. `+366` `drainage-layout.rvt`
- Placing branch pipes and outlet positions. `+48` `drainage-layout.rvt`
- Designing in 3D. `+156` `drainage-layout.rvt`
- Rerouting pipes to avoid clashes. `+24` `drainage-layout.rvt`
- Removing duplicate elements. `-12` `model.rvt`

**Verbs that indicate action:**
- Placing
- Creating
- Adding
- Removing
- Editing
- Writing
- Designing
- Rerouting
- Updating
- Modifying

---

## HTML Structure

### Thinking Step
```html
<li class="visible">
  <span class="step-icon dot"></span>
  <span class="step-content">
    <span class="step-text">Reading specification.</span>
  </span>
</li>
```

### Action Step
```html
<li class="visible">
  <span class="step-icon edit">✎</span>
  <span class="step-content">
    <span class="step-text">Placing pop ups on drawing.</span>
    <span class="step-changes">
      <span class="changes-box">
        <span class="added">+366</span>
      </span>
      <span class="filename">drainage-layout.rvt</span>
    </span>
  </span>
</li>
```

### Completed Step
```html
<li class="visible">
  <span class="step-icon check"></span>
  <span class="step-content">
    <span class="step-text">Done.</span>
  </span>
</li>
```

### Error/Blocker Step
```html
<li class="visible">
  <span class="step-icon error">✗</span>
  <span class="step-content">
    <span class="step-text">Thermal model not found — cannot size equipment.</span>
  </span>
</li>
```

---

## JavaScript Data Structure

For dynamic step generation, use this object format:

```javascript
const thinkingSteps = [
  // Thinking step (no changes)
  { text: 'Reading specification.', type: 'think' },
  
  // Action step (with changes)
  { text: 'Placing elements.', type: 'action', changes: '+48', filename: 'model.rvt' },
  
  // Action step with removals
  { text: 'Removing clashes.', type: 'action', changes: '-12', filename: 'model.rvt' },
  
  // Error/blocker step (stops workflow, requires user input)
  { text: 'Thermal model not found.', type: 'error' },
  
  // Completed step
  { text: 'Done.', type: 'done' }
];
```

---

## Key Rules

1. **Forecasting ≠ Action** — Forecasting clashes is thinking, not action. It doesn't remove clashes.
2. **Reading ≠ Action** — Reading files, specifications, or drawings is always thinking.
3. **Only show +/- when elements change** — If no elements are added/removed, it's a thinking step.
4. **Filename only on action steps** — The filename indicates which file was modified.
5. **Use past-tense verbs for completed actions** — "Placed" vs "Placing" when showing as done.

---

## Chat Context Variations

Each demo chat should have its own set of steps tailored to the workflow being demonstrated:

| Demo | Focus | Thinking Examples | Action Examples |
|------|-------|-------------------|-----------------|
| Drainage | Pipe layout | Finding rooms, Reading civil | Placing pop ups, Routing pipes |
| Water Services | Supply design | Checking pressure, Reading utility constraints | Placing outlets, Adding heaters |
| HVAC | Duct design | Calculating loads, Checking zones | Placing diffusers, Sizing ducts |
| Electrical | Power layout | Counting outlets, Reading schedule | Placing sockets, Running cables |
| Clash Detection | Coordination | Analyzing clashes, Finding conflicts | Rerouting elements, Adjusting positions |

---

## Water Services Chat Example

### User Message
> Can you design the cold and hot water system?

### Bot Response
> Of course, let me check the requirements and site constraints.

### Thinking Steps (Container 1)
```
○ Reading specification...
○ Checking building location.
○ Analysing local utility provider constraints.
○ Understanding incoming water pressure — 2.1 bar static.
○ Calculating pressure requirements for upper floors.
○ Booster set required — pressure insufficient above Level 3.
○ Checking water hardness data — 285 ppm (hard water zone).
○ Water softener required as per specification.
○ Reading BS EN 806 requirements.
✓ Analysis complete — awaiting confirmation.
```

### Bot Response
> Based on my analysis:
> - **Incoming pressure**: 2.1 bar static (insufficient for upper floors)
> - **Booster set**: Required for Levels 3+
> - **Water hardness**: 285 ppm — softener required per spec
> - **Standard**: BS EN 806 compliance
>
> Shall I proceed with the design?

### User Message
> Yes, proceed.

### Thinking Steps (Container 2)
```
○ Continuing.
○ Reading room schedule for outlet requirements.
○ Identifying point-of-use water heater locations.
✎ Placing cold water outlets.                    +186    water-services.rvt
✎ Placing hot water outlets.                     +142    water-services.rvt
✎ Adding point-of-use water heaters (as spec).   +24     water-services.rvt
✎ Placing booster set in plantroom.              +8      water-services.rvt
✎ Placing water softener in plantroom.           +4      water-services.rvt
✎ Routing pipework in 3D.                        +892    water-services.rvt
○ Generating calculation report.
✎ Saving calculations to folder.                 +1      Water_Calcs_BS-EN-806.pdf
✓ Done.
```

### Bot Response
> Water services design complete:
> - **186** cold water outlets placed
> - **142** hot water outlets placed  
> - **24** point-of-use water heaters (per specification)
> - **Booster set** and **softener** positioned in plantroom
> - Pipework routed in 3D with clash avoidance
> - Calculations saved: `Water_Calcs_BS-EN-806.pdf`
>
> Design complies with BS EN 806. Ready for review.

---

### JavaScript Data Structure (Water Services)

```javascript
// Container 1 - Analysis phase (all thinking)
const waterAnalysisSteps = [
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
];

// Container 2 - Design phase (mix of thinking and action)
const waterDesignSteps = [
  { text: 'Continuing.', type: 'think' },
  { text: 'Reading room schedule for outlet requirements.', type: 'think' },
  { text: 'Identifying point-of-use water heater locations.', type: 'think' },
  { text: 'Placing cold water outlets.', type: 'action', changes: '+186', filename: 'water-services.rvt' },
  { text: 'Placing hot water outlets.', type: 'action', changes: '+142', filename: 'water-services.rvt' },
  { text: 'Adding point-of-use water heaters (as spec).', type: 'action', changes: '+24', filename: 'water-services.rvt' },
  { text: 'Placing booster set in plantroom.', type: 'action', changes: '+8', filename: 'water-services.rvt' },
  { text: 'Placing water softener in plantroom.', type: 'action', changes: '+4', filename: 'water-services.rvt' },
  { text: 'Routing pipework in 3D.', type: 'action', changes: '+892', filename: 'water-services.rvt' },
  { text: 'Generating calculation report.', type: 'think' },
  { text: 'Saving calculations to folder.', type: 'action', changes: '+1', filename: 'Water_Calcs_BS-EN-806.pdf' },
  { text: 'Done.', type: 'done' }
];
```

---

## Heating & Cooling Chat Example

### User Message
> Can you design the heating and cooling system?

### Bot Response
> Of course, let me check the requirements and system strategy.

### Thinking Steps (Container 1)
```
○ Reading specification...
○ Checking heating strategy — Daikin VRF system.
○ Checking cooling strategy — Daikin VRF ducted units.
○ Panel heaters specified for corridors.
○ Ducted FCUs to BCO standard for office areas.
○ VRF outdoor condensers required on roof.
○ Locating riser positions.
○ Finding design temperatures from specification.
○ Heating setpoint: 21°C winter.
○ Cooling setpoint: 24°C summer.
○ Looking for thermal model...
✗ Thermal model not found — cannot size equipment.
```

### Bot Response
> I've found the system requirements but there's no thermal model available. I need heating and cooling loads to size the equipment correctly.
>
> Would you like me to run the IESVE calculations?

### User Message
> Yes, proceed.

### Thinking Steps (Container 2 - IESVE)
```
○ Opening IESVE...
✎ Building thermal model from Revit geometry.         +1      hvac-model.aps
✎ Adding weather templates — London TRY.              +1      hvac-model.aps
✎ Adding construction templates.                      +48     hvac-model.aps
✎ Adding internal gains profiles.                     +24     hvac-model.aps
✎ Setting room data temperatures per zone.            +186    hvac-model.aps
○ Running heating load simulations...
○ Running cooling load simulations...
○ Running overheating analysis (TM52)...
✎ Generating thermal report.                          +1      Thermal_Report.pdf
✎ Downloading results to project folder.              +1      Thermal_Report.pdf
○ Parsing thermal data...
○ Extracting zone heating loads.
○ Extracting zone cooling loads.
✎ Adding loads to zone information.                   +186    heating-cooling.rvt
✓ Thermal analysis complete.
```

### Bot Response
> Thermal analysis complete. I've extracted the heating and cooling loads for all zones and added them to the model.
>
> Ready to proceed with equipment sizing and layout?

### User Message
> Yes.

### Thinking Steps (Container 3 - Design)
```
○ Continuing.
○ Reading zone information from thermal model.
○ Calculating equipment capacities.
○ Sizing ducted fan coil units.
○ Sizing heater batteries.
○ Sizing panel heaters for corridors.
○ Sizing VRF outdoor condensers.
✎ Placing ducted FCUs in BCO zones.                   +86     heating-cooling.rvt
✎ Placing heater batteries.                           +12     heating-cooling.rvt
✎ Placing panel heaters in corridors.                 +34     heating-cooling.rvt
✎ Placing VRF outdoor condensers on roof.             +6      heating-cooling.rvt
✎ Routing refrigerant pipework in 3D.                 +892    heating-cooling.rvt
○ Sizing refrigerant pipework to Daikin guidelines.
✎ Placing cable tray routes.                          +248    heating-cooling.rvt
✎ Placing condensate drainage routes.                 +124    heating-cooling.rvt
✎ Placing local controllers.                          +86     heating-cooling.rvt
✎ Adding specification notes.                         +24     heating-cooling.rvt
○ Generating schedules.
✎ Schedules exported.                                 +4      heating-cooling.rvt
✓ Done.
```

### Bot Response
> Heating & cooling design complete:
> - **86** ducted fan coil units sized and placed (BCO compliant)
> - **12** heater batteries placed
> - **34** panel heaters in corridors
> - **6** VRF outdoor condensers on roof
> - Refrigerant pipework routed and sized to Daikin guidelines
> - Cable tray and condensate drainage placed
> - Local controllers at each indoor unit
> - Schedules exported
>
> Design ready for review.

---

### JavaScript Data Structure (Heating & Cooling)

```javascript
// Container 1 - Initial analysis (thinking, ends with blocker)
const heatingAnalysisSteps = [
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
];

// Container 2 - IESVE thermal analysis
const heatingThermalSteps = [
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
];

// Container 3 - Design phase (sizing = thinking, placing = action)
const heatingDesignSteps = [
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
];
```

