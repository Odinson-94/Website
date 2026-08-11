import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const root = process.cwd();
const site = 'https://adelphos.ai';
const chat = 'https://chat.adelphos.ai';
const reviewed = '9 August 2026';

const official = {
  tm59: 'https://www.cibse.org/policy-advocacy/news/cibse-in-collaboration-with-arup-loughborough-university-and-inkling-launch-updated-cibse-tm59-guidance-to-help-tackle-overheating-risk-in-homes/',
  tm52: 'https://www.cibse.org/knowledge-research/knowledge-portal/tm52-the-limits-of-thermal-comfort-avoiding-overheating-in-european-buildings',
  partO: 'https://www.gov.uk/guidance/approved-document-o-overheating-frequently-asked-questions',
  am10: 'https://www.cibse.org/knowledge-research/knowledge-portal/am10-natural-ventilation-in-non-domestic-buildings-2026-pdf/',
  am11: 'https://www.cibse.org/knowledge-research/knowledge-portal/applications-manual-11-building-performance-modelling-2015/?id=a0q20000008JeYXAA0',
  sllCode: 'https://www.cibse.org/knowledge-research/knowledge-portal/sll-code-for-lighting-2022/',
  sllHandbook: 'https://www.cibse.org/knowledge-research/knowledge-portal/sll-lighting-handbook-2018?id=a0q0O00000F4MeJQAV',
  partL: 'https://www.gov.uk/government/publications/conservation-of-fuel-and-power-approved-document-l',
};

const topics = [
  {
    key: 'tm59',
    kind: 'Report guide',
    guidePath: '/reports/tm59-overheating-assessment/',
    templatePath: '/report-templates/tm59-overheating-report-template/',
    guideTitle: 'TM59 Report and Overheating Assessment | Adelphos',
    templateTitle: 'TM59 Overheating Report Template | Adelphos',
    guideDescription: 'Learn what a TM59 report covers, which modelling inputs it needs and how to prepare an overheating assessment in Adelphos Chat.',
    templateDescription: 'See the structure, evidence schedule and review checks for an Adelphos TM59 overheating report template in Report Studio.',
    h1: 'TM59 report and overheating assessment',
    templateH1: 'TM59 overheating report template',
    primary: 'TM59 report',
    secondary: 'TM59 overheating assessment',
    status: 'Mapped in Report Studio',
    definition: 'A TM59 report records a design-stage assessment of overheating risk in homes using dynamic thermal modelling, declared assumptions, weather data, room-by-room results and mitigation evidence.',
    audience: 'Homes, care homes and student accommodation',
    output: 'Overheating assessment and room results',
    evidence: 'Model inputs, weather file, profiles and result exports',
    standard: 'CIBSE TM59 and project-specific regulatory requirements',
    cards: [
      ['What the report answers', 'It records whether the assessed dwelling types and rooms meet the applicable overheating criteria, which cases govern and where mitigation is needed.'],
      ['What the model must declare', 'Geometry, constructions, glazing, shading, ventilation, internal gains, occupancy profiles, weather data, controls and every project-specific departure.'],
      ['What the reviewer should see', 'A clear sample strategy, model QA record, results by room, failed cases, sensitivity checks, mitigation changes and the final issue basis.'],
    ],
    steps: [
      ['Confirm the assessment basis', 'Record the applicable TM59 edition, planning or Building Regulations route, project stage, weather files and approval requirements before modelling.'],
      ['Build and check the thermal model', 'Coordinate zoning, constructions, openings, shading, gains, profiles and control logic against the current architectural and MEP information.'],
      ['Run the required cases', 'Assess the agreed dwelling sample and scenarios. Keep the raw outputs, model version and any sensitivity runs tied to the report issue.'],
      ['Review failures and mitigation', 'Explain each failed room, test passive measures first, record design changes and rerun the controlled model before drawing a conclusion.'],
      ['Assemble the report', 'Present the basis, assumptions, QA checks, results, mitigation and limitations so another competent modeller can audit the submission.'],
    ],
    inputs: [
      ['Assessment brief', 'Client requirements, planning conditions, Part O route and agreed TM59 edition', 'Defines the test and approval boundary'],
      ['Geometry and fabric', 'Current drawings, room areas, constructions, glazing, orientation and shading', 'Controls solar and fabric heat transfer'],
      ['Ventilation strategy', 'Openable areas, controls, restrictions, mechanical rates and operating schedules', 'Defines how heat is rejected'],
      ['Internal gains', 'Occupancy, lighting, equipment, hot-water and distribution losses where applicable', 'Sets the heat-gain profiles'],
      ['Weather and scenarios', 'Declared current and future weather files where required by the brief', 'Makes the model basis reproducible'],
      ['Simulation outputs', 'Room temperatures, occupied hours, criteria results and model QA exports', 'Supports the reported conclusion'],
    ],
    templateSections: [
      ['Executive summary', 'Assessment scope, headline outcome, governing cases and required design actions.'],
      ['Project and regulatory basis', 'Building description, project stage, applicable TM59 edition, Part O or planning context and responsibilities.'],
      ['Model methodology and QA', 'Software, model version, geometry checks, zoning, weather data, profiles, ventilation, gains and assumptions.'],
      ['Sample and scenario matrix', 'Dwelling types, rooms, orientations, floors, weather cases and mitigation options assessed.'],
      ['Results', 'Room-by-room criteria tables, key plots, failed cases and corridor results where applicable.'],
      ['Mitigation and conclusion', 'Design changes, rerun evidence, residual risks, limitations and competent-person sign-off.'],
    ],
    sources: [
      ['CIBSE TM59 2026 launch', official.tm59, 'CIBSE published the updated design-stage methodology in July 2026. Confirm which edition applies to the project.'],
      ['Approved Document O FAQs', official.partO, 'For England, the government explains the dynamic thermal modelling report expected for the Part O route.'],
    ],
    faqs: [
      ['What is a TM59 report?', 'A TM59 report is the auditable record of a residential overheating assessment. It states the modelling basis, assumptions, sampled dwellings, room results, mitigation and conclusion against the applicable TM59 methodology.'],
      ['Is TM59 the same as Part O?', 'No. TM59 is a CIBSE assessment methodology. Approved Document O is regulatory guidance for new residential buildings in England and includes a dynamic thermal modelling route that refers to TM59.'],
      ['Which TM59 edition should a report use in 2026?', 'CIBSE published an updated TM59 methodology in July 2026. The modeller should confirm the edition required by the client, planning authority and building control body, then state it clearly in the report.'],
      ['Can Adelphos create the final compliance decision?', 'Adelphos can structure evidence and draft the report, but a competent modeller remains responsible for the model, assumptions, interpretation and issued conclusion.'],
    ],
  },
  {
    key: 'tm52', kind: 'Report guide',
    guidePath: '/reports/tm52-overheating-assessment/', templatePath: '/report-templates/tm52-overheating-report-template/',
    guideTitle: 'TM52 Report and Overheating Assessment | Adelphos', templateTitle: 'TM52 Overheating Report Template | Adelphos',
    guideDescription: 'Learn how a TM52 report documents adaptive thermal comfort, overheating criteria, thermal model inputs, results and mitigation.',
    templateDescription: 'Use a clear TM52 overheating report template structure for modelling assumptions, criteria results, mitigation and technical review.',
    h1: 'TM52 report and overheating assessment', templateH1: 'TM52 overheating report template', primary: 'TM52 report', secondary: 'TM52 overheating assessment', status: 'Preparing for release',
    definition: 'A TM52 report documents an overheating assessment for applicable occupied spaces, commonly in naturally ventilated non-domestic buildings, using adaptive thermal comfort criteria and a controlled thermal model.',
    audience: 'Applicable non-domestic and naturally ventilated spaces', output: 'Adaptive comfort and overheating results', evidence: 'Thermal model, occupied hours, weather and criteria outputs', standard: 'CIBSE TM52 and the current project brief',
    cards: [
      ['TM52 versus TM59', 'TM52 addresses thermal comfort and overheating in applicable buildings, while TM59 provides a residential design-stage methodology. The project brief decides the correct route.'],
      ['Assessment boundary', 'The report should define the occupied spaces, operating periods, ventilation mode, weather file, comfort category and any exclusions before results are presented.'],
      ['Decision trail', 'Criteria results need supporting assumptions, plots, failed-space commentary, mitigation changes and a conclusion that does not hide marginal cases.'],
    ],
    steps: [
      ['Set the comfort brief', 'Agree the building use, occupied periods, comfort category, applicable criteria, weather basis and spaces to be assessed.'],
      ['Coordinate the model', 'Check geometry, fabric, gains, occupancy, ventilation openings, controls and mechanical systems against the current design.'],
      ['Run the summer assessment', 'Export the occupied-space results and the data needed to test each applicable TM52 criterion.'],
      ['Investigate the governing spaces', 'Review peaks, duration and severity of discomfort, then test practical passive and control measures.'],
      ['Issue an auditable conclusion', 'State which spaces pass or fail, the mitigation included, model limitations and any actions carried into later design stages.'],
    ],
    inputs: [
      ['Thermal comfort brief', 'Building use, occupied hours, comfort expectations and project criteria', 'Sets the assessment target'],
      ['Model geometry and fabric', 'Zones, adjacency, constructions, glazing, shading and thermal mass', 'Defines heat transfer and solar gains'],
      ['Ventilation and controls', 'Openings, free areas, schedules, wind or stack assumptions and control logic', 'Defines adaptive opportunities'],
      ['Internal loads', 'People, lighting, equipment and operating profiles', 'Defines occupied heat gains'],
      ['Weather data', 'Declared design summer year and location basis', 'Supports repeatable simulation'],
      ['Criteria outputs', 'Occupied hours, operative temperatures, running mean data and space results', 'Supports the TM52 review'],
    ],
    templateSections: [
      ['Executive summary', 'Scope, assessment basis, headline results, failed spaces and design actions.'],
      ['Building and comfort brief', 'Use, occupancy, ventilation mode, comfort category, project stage and assessment boundary.'],
      ['Model basis and QA', 'Software, weather file, zoning, fabric, gains, schedules, openings, controls and checks.'],
      ['TM52 criteria results', 'Space-by-space results for each applicable criterion with clear pass, fail and review states.'],
      ['Mitigation study', 'Solar control, ventilation, thermal mass, internal-gain and control changes with rerun evidence.'],
      ['Conclusion and limitations', 'Final design basis, residual risk, assumptions needing confirmation and reviewer sign-off.'],
    ],
    sources: [['CIBSE TM52', official.tm52, 'The active CIBSE technical memorandum explains adaptive thermal comfort and criteria for identifying overheating.'], ['CIBSE AM11', official.am11, 'AM11 covers thermal environment modelling, ventilation modelling and quality assurance.']],
    faqs: [
      ['What does a TM52 report show?', 'It shows the assessment basis and the results for each applicable overheating criterion, supported by the thermal model assumptions, occupied periods, weather data and mitigation evidence.'],
      ['Is TM52 only for naturally ventilated buildings?', 'TM52 is widely used for naturally ventilated buildings because it uses an adaptive comfort approach. The modeller must confirm whether TM52 is appropriate for the space and project brief.'],
      ['What is the difference between a thermal model and a TM52 report?', 'The thermal model is the simulation. The TM52 report is the controlled technical record that explains the model, applies the criteria, presents results and records the conclusion.'],
      ['Does Adelphos replace a competent thermal modeller?', 'No. Adelphos can organise inputs, results and report sections, but the modeller is responsible for model quality, criteria application and issue.'],
    ],
  },
  {
    key: 'natural-ventilation', kind: 'Report guide',
    guidePath: '/reports/natural-ventilation-calculation-report/', templatePath: '/report-templates/natural-ventilation-report-template/',
    guideTitle: 'Natural Ventilation Calculation Report | Adelphos', templateTitle: 'Natural Ventilation Report Template | Adelphos',
    guideDescription: 'Learn what a natural ventilation report should include, from design airflow and opening assumptions to controls, overheating and commissioning.',
    templateDescription: 'Plan a natural ventilation report with sections for design intent, airflow inputs, opening calculations, controls, risks and review.',
    h1: 'Natural ventilation calculation report', templateH1: 'Natural ventilation report template', primary: 'natural ventilation report', secondary: 'natural ventilation calculation', status: 'Preparing for release',
    definition: 'A natural ventilation report records the design intent, required airflow, proposed air paths, opening assumptions, control strategy, calculation or simulation method, constraints and evidence that the strategy can work in use.',
    audience: 'Naturally ventilated and mixed-mode buildings', output: 'Strategy, opening and airflow evidence', evidence: 'Room data, openings, controls, weather and model outputs', standard: 'CIBSE AM10 (2026), project criteria and related guidance',
    cards: [
      ['Not one opening-area sum', 'A useful report connects air-quality and heat-removal requirements to openings, pressure drivers, internal flow paths, controls and real site constraints.'],
      ['Design stage matters', 'Early reports may test feasibility and strategy. Later issues should record coordinated free areas, actuator logic, acoustic limits, weather protection and commissioning requirements.'],
      ['Thermal comfort link', 'Natural ventilation performance should be reviewed alongside overheating, internal gains and thermal modelling rather than treated as an isolated airflow calculation.'],
    ],
    steps: [
      ['Define the ventilation purpose', 'Separate fresh-air, purge, heat-removal and night-cooling requirements for each space and operating mode.'],
      ['Map the airflow paths', 'Record inlets, outlets, transfer paths, opening heights, free areas, obstructions and the intended single-sided, cross-flow or stack strategy.'],
      ['Choose the design method', 'Use an appropriate envelope-flow model, dynamic thermal model, CFD study or staged combination for the project risk and design stage.'],
      ['Test constraints and controls', 'Include noise, security, rain, pollution, wind, occupant access, fire strategy, actuators, sensors and fallback modes.'],
      ['Document verification', 'Set out commissioning tests, control checks, seasonal tuning, handover information and post-occupancy review.'],
    ],
    inputs: [
      ['Room requirements', 'Occupancy, fresh-air rates, extract needs, heat gains and operating hours', 'Defines required airflow'],
      ['Opening schedule', 'Type, dimensions, aerodynamic free area, height, location and control', 'Defines available airflow paths'],
      ['Building context', 'Façade exposure, wind, stack height, internal doors and obstructions', 'Defines pressure drivers and resistance'],
      ['External constraints', 'Noise, air quality, security, rain, insects and local microclimate', 'Tests whether openings are usable'],
      ['Control sequence', 'Temperature, CO2, weather and user overrides with safe states', 'Defines real operation'],
      ['Model and test outputs', 'Airflow, temperature, comfort, sensitivity and commissioning evidence', 'Supports the report conclusion'],
    ],
    templateSections: [
      ['Executive summary', 'Ventilation concept, design duties, governing constraints and key actions.'],
      ['Design criteria', 'Air quality, comfort, purge, heat-removal, occupancy and operating requirements.'],
      ['System and airflow paths', 'Opening types, locations, free areas, transfer routes, zones and operating modes.'],
      ['Calculation and modelling method', 'Pressure assumptions, weather, envelope-flow or simulation method, inputs, cases and QA.'],
      ['Results and constraints', 'Room duties, achieved airflows, temperature results, acoustic and security limits, and sensitivity findings.'],
      ['Controls, commissioning and risk', 'Sequences, fail-safe states, test requirements, seasonal tuning, user information and residual risks.'],
    ],
    sources: [['CIBSE AM10 Natural Ventilation in Non-Domestic Buildings (2026)', official.am10, 'The current manual covers strategy, components, controls, design tools, envelope-flow methods and worked examples.'], ['CIBSE AM11 Building Performance Modelling', official.am11, 'AM11 covers quality assurance and appropriate modelling approaches for ventilation and thermal performance.']],
    faqs: [
      ['What should a natural ventilation report include?', 'It should include the design criteria, airflow paths, opening data, calculation or simulation method, controls, constraints, results, commissioning plan and residual risks.'],
      ['Is natural ventilation calculated using ACH?', 'Air changes per hour can be one design expression, but a complete strategy also needs source requirements, pressure drivers, opening characteristics, controls and use conditions.'],
      ['When is dynamic thermal modelling needed?', 'It is commonly used where thermal comfort, overheating, controls, night cooling or time-varying weather materially affect the design decision. The design team should choose a method proportionate to risk.'],
      ['Can Adelphos size openings automatically?', 'Adelphos can help structure declared inputs and calculation evidence. The engineer remains responsible for the chosen method, opening data, constraints and coordinated design.'],
    ],
  },
  {
    key: 'thermal-modelling', kind: 'Report guide',
    guidePath: '/reports/thermal-modelling-report/', templatePath: '/report-templates/thermal-modelling-report-template/',
    guideTitle: 'Thermal Modelling Report Guide | Adelphos', templateTitle: 'Thermal Modelling Report Template | Adelphos',
    guideDescription: 'Learn how to structure a thermal modelling report with a reproducible model basis, assumptions, QA, scenarios, results and limitations.',
    templateDescription: 'Use a thermal modelling report template for model inputs, zoning, weather, systems, QA, results, sensitivity and technical review.',
    h1: 'Thermal modelling report', templateH1: 'Thermal modelling report template', primary: 'thermal modelling report', secondary: 'dynamic thermal modelling report', status: 'Preparing for release',
    definition: 'A thermal modelling report is the technical record of a building simulation: why the model was built, how it represents the design, which inputs and scenarios were used, how it was checked and what the results do and do not support.',
    audience: 'Building performance, energy and thermal comfort studies', output: 'Reproducible model basis and results', evidence: 'Geometry, systems, profiles, weather, QA and simulation exports', standard: 'CIBSE AM11 and the study-specific assessment method',
    cards: [
      ['Model purpose first', 'An energy model, load model, comfort model and compliance model can use different inputs and rules. The report must state its purpose before presenting results.'],
      ['QA is part of the deliverable', 'Model version, zoning, area checks, envelope checks, profiles, system logic, energy balance and anomalous results should be reviewed and recorded.'],
      ['Results need boundaries', 'Every conclusion should identify the scenario, design revision, weather basis, exclusions, uncertainty and decisions that the result can support.'],
    ],
    steps: [
      ['Write the modelling brief', 'Define the decision, output metrics, project stage, model scope, software, assessment method and approval route.'],
      ['Collect controlled inputs', 'Use revisioned geometry, fabric, glazing, shading, occupancy, loads, systems, controls, weather and schedules.'],
      ['Build and QA the model', 'Check areas, volumes, zoning, adjacencies, constructions, profiles, plant logic, unmet loads and energy balance.'],
      ['Run base and sensitivity cases', 'Keep scenario names, changed inputs and result exports controlled so the report can explain cause and effect.'],
      ['Report decisions and limits', 'Present the metrics needed for the brief, explain anomalies and state where survey, design or operational uncertainty remains.'],
    ],
    inputs: [
      ['Modelling brief', 'Purpose, project stage, metrics, scenarios, software and acceptance criteria', 'Defines what the model must answer'],
      ['Building geometry', 'Revisioned model, areas, volumes, orientation, zoning and adjacency', 'Defines the simulated form'],
      ['Envelope', 'Constructions, thermal bridges where applicable, glazing, shading and infiltration', 'Defines fabric performance'],
      ['Internal conditions', 'Occupancy, equipment, lighting, setpoints and schedules', 'Defines demand and comfort drivers'],
      ['Systems and controls', 'HVAC, ventilation, efficiencies, capacities, setpoints and sequences', 'Defines system response'],
      ['Weather and outputs', 'Declared files, simulation periods, metrics, QA logs and result exports', 'Makes the study reproducible'],
    ],
    templateSections: [
      ['Executive summary', 'Study purpose, model status, headline findings, design decisions and limitations.'],
      ['Modelling brief and scope', 'Project stage, questions, metrics, assessment methods, software and excluded items.'],
      ['Model description', 'Geometry, zoning, envelope, glazing, shading, gains, occupancy, ventilation, systems and controls.'],
      ['Quality assurance', 'Source revisions, area and volume checks, schedules, energy balance, warnings, anomalies and reviewer checks.'],
      ['Scenarios and results', 'Base case, alternatives, weather cases, sensitivities, graphs, tables and decision commentary.'],
      ['Conclusions and model limitations', 'Supported decisions, unresolved inputs, uncertainty, next-stage actions and sign-off.'],
    ],
    sources: [['CIBSE AM11 Building Performance Modelling', official.am11, 'AM11 covers modelling QA, energy, thermal environment, ventilation, lighting and plant modelling.'], ['CIBSE Building Simulation Group', 'https://www.cibse.org/BuildingSimulation', 'The CIBSE group provides current building-simulation knowledge and industry activity.']],
    faqs: [
      ['What is included in a thermal modelling report?', 'A good report includes the modelling brief, model description, input sources, assumptions, QA checks, scenarios, results, sensitivity, limitations and sign-off.'],
      ['Is a thermal modelling report the same as an energy report?', 'Not always. Thermal models can address loads, comfort, overheating, ventilation, energy or controls. The report title and scope should match the decision being assessed.'],
      ['How detailed should the model be?', 'It should be detailed enough to answer the agreed question without adding unsupported complexity. The report should explain the chosen level of detail and its limitations.'],
      ['Can Report Studio read simulation outputs?', 'Report Studio is being prepared to assemble controlled model inputs, calculation outputs and narrative into reviewable report sections. The modeller still owns the simulation and conclusions.'],
    ],
  },
  {
    key: 'lighting', kind: 'Calculation guide',
    guidePath: '/calculations/lighting-calculations/', templatePath: '/report-templates/lighting-calculation-report-template/',
    guideTitle: 'How to Do Lighting Calculations | Adelphos', templateTitle: 'Lighting Calculation Report Template | Adelphos',
    guideDescription: 'Learn how to do lighting calculations using a clear design brief, maintained illuminance inputs, luminaire data, layout checks and review.',
    templateDescription: 'Structure a lighting calculation report with design criteria, luminaire data, calculation inputs, results, energy checks and review notes.',
    h1: 'How to do lighting calculations', templateH1: 'Lighting calculation report template', primary: 'how to do lighting calculations', secondary: 'lighting calculation report', status: 'Preparing for release',
    definition: 'Lighting calculations turn a project lighting brief, room geometry and verified photometric data into evidence for maintained illuminance, uniformity, glare, energy and the coordinated luminaire layout.',
    audience: 'Interior and exterior electric lighting design', output: 'Maintained illuminance and design review evidence', evidence: 'Room data, targets, photometry, layout, maintenance and energy inputs', standard: 'SLL Code for Lighting (2022), relevant Lighting Guides and project requirements',
    cards: [
      ['Start with the visual task', 'Choose the maintained illuminance, uniformity, glare, colour and control requirements for the actual use, not a generic room label.'],
      ['Use verified photometry', 'Luminaire lumens alone are not enough for a detailed layout. Use current photometric files, distribution data, mounting information and manufacturer maintenance data.'],
      ['Check more than average lux', 'Review the calculation grid, minimum values, uniformity, glare, vertical illuminance, daylight and controls where the project requires them.'],
    ],
    steps: [
      ['Set the lighting criteria', 'Record the space use, visual tasks, maintained illuminance, uniformity, glare, colour, emergency and control requirements.'],
      ['Build the room and reflectance model', 'Enter the real dimensions, calculation plane, obstructions, surface reflectances and daylight openings needed for the chosen method.'],
      ['Select verified luminaire data', 'Use the proposed luminaire photometry, luminous flux, power, mounting height, orientation and maintenance information.'],
      ['Calculate and coordinate the layout', 'Run the model, inspect the grid and contour results, adjust spacing and coordinate the layout with ceilings, structure and building services.'],
      ['Check quality and energy', 'Review average and minimum illuminance, uniformity, glare, controls, installed load and the applicable energy method.'],
      ['Issue the calculation report', 'Record the input revisions, software, calculation surfaces, luminaire schedule, results, exceptions and reviewer comments.'],
    ],
    inputs: [
      ['Design criteria', 'Maintained lux, uniformity, glare, colour, controls and task requirements', 'Defines the target'],
      ['Room geometry', 'Dimensions, workplane, ceiling, obstructions and surface reflectances', 'Defines the calculation space'],
      ['Luminaire data', 'IES or LDT photometry, lumens, wattage, distribution, mounting and tilt', 'Defines light output and distribution'],
      ['Maintenance factors', 'Lamp lumen, survival, luminaire and room-surface factors as applicable', 'Converts initial to maintained performance'],
      ['Layout and controls', 'Quantity, coordinates, spacing, circuits, occupancy and daylight controls', 'Defines the proposed scheme'],
      ['Results', 'Average, minimum, uniformity, glare, energy and calculation images', 'Supports design review'],
    ],
    templateSections: [
      ['Executive summary', 'Space coverage, design criteria, headline results, exceptions and actions.'],
      ['Design basis', 'Project stage, standards, room uses, target values, controls and exclusions.'],
      ['Calculation model', 'Software, room geometry, reflectances, workplanes, grids and daylight assumptions.'],
      ['Luminaire and maintenance data', 'Luminaire schedule, photometric files, output, power, mounting and maintenance factors.'],
      ['Results', 'Average and minimum illuminance, uniformity, glare, energy, contours and calculation images.'],
      ['Coordination and review', 'Layout issues, emergency-lighting boundary, controls, assumptions, deviations and sign-off.'],
    ],
    sources: [['SLL Code for Lighting (2022)', official.sllCode, 'The current SLL Code covers lighting criteria, indoor calculations, photometric data, maintenance and verification.'], ['SLL Lighting Handbook (2018)', official.sllHandbook, 'The handbook follows the lighting design process from early decisions through detailed design, commissioning and handover.'], ['Approved Document L', official.partL, 'For projects in England, confirm the current lighting energy requirements and applicable calculation route.']],
    faqs: [
      ['What is the basic lighting calculation formula?', 'A simple lumen-method estimate relates maintained illuminance to luminaire quantity, luminaire flux, utilisation and maintenance factors over the room area. Detailed design should use verified photometry and an appropriate calculation model.'],
      ['What information is needed for a lighting calculation?', 'You need the design criteria, room geometry, surface reflectances, calculation plane, luminaire photometry, lumen output, wattage, mounting, maintenance factors, layout and control strategy.'],
      ['Is average lux enough to approve a lighting design?', 'No. Depending on the brief, the designer may also need to check minimum illuminance, uniformity, glare, vertical or cylindrical illuminance, colour, controls, energy and emergency lighting.'],
      ['Can I use the free Adelphos lux calculator?', 'Yes. The free calculator is useful for an early lumen-method estimate. Use a detailed photometric calculation and competent review for the final coordinated lighting design.'],
    ],
  },
];

const esc = (value) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const absolute = (path) => `${site}${path.replace(/\/$/, '')}`;
const safeJson = (value) => JSON.stringify(value).replaceAll('<', '\\u003c');
const rows = (items) => items.map((cells) => `<tr>${cells.map((cell) => `<td>${esc(cell)}</td>`).join('')}</tr>`).join('');
const cards = (items) => items.map(([title, text]) => `<article class="program-card"><h3>${esc(title)}</h3><p>${esc(text)}</p></article>`).join('');

function head({ title, description, path, faqs, breadcrumb }) {
  const url = absolute(path);
  const schema = [
    { '@context': 'https://schema.org', '@type': 'WebPage', name: title.replace(' | Adelphos', ''), description, url, dateModified: '2026-08-09', inLanguage: 'en-GB', isPartOf: { '@type': 'WebSite', name: 'Adelphos AI', url: site } },
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: breadcrumb.map((item, index) => ({ '@type': 'ListItem', position: index + 1, name: item.name, item: absolute(item.path) })) },
    ...(faqs?.length ? [{ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faqs.map(({ q, a }) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) }] : []),
  ];
  return `<!doctype html>
<html lang="en-GB" class="regional-seo-public">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1">
  <meta name="theme-color" content="#156082">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@300;500&display=block">
  <link rel="stylesheet" href="/css/bundles/generic.css">
  <link rel="stylesheet" href="/css/bundles/shared.css">
  <link rel="stylesheet" href="/css/bundles/sandbox.css">
  <link rel="stylesheet" href="/css/bundles/page.css">
  <link rel="stylesheet" href="/css/regional-seo.css">
  <link rel="stylesheet" href="/css/programmatic-pages.css">
  <link rel="stylesheet" href="/css/report-content-pages.css">
  <link rel="canonical" href="${url}">
  <link rel="alternate" hreflang="en-GB" href="${url}">
  <link rel="alternate" hreflang="x-default" href="${url}">
  <meta property="og:type" content="website">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:url" content="${url}">
  <meta property="og:image" content="${site}/images/og/default.png">
  <meta property="og:site_name" content="Adelphos AI">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(title)}">
  <meta name="twitter:description" content="${esc(description)}">
  <meta name="twitter:image" content="${site}/images/og/default.png">
  ${schema.map((item) => `<script type="application/ld+json">${safeJson(item)}</script>`).join('\n  ')}
</head>`;
}

function faqMarkup(faqs, title) {
  return `<section class="seo-section"><div class="seo-wrap faq-layout"><div><span class="seo-kicker">Direct answers</span><h2>${esc(title)} questions</h2></div><div class="faq-list">${faqs.map(({ q, a }) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}</div></div></section>`;
}

function relatedMarkup(topic, template = false) {
  const links = [
    { label: template ? 'Report guide' : 'Report template', title: template ? topic.h1 : topic.templateH1, path: template ? topic.guidePath : topic.templatePath },
    { label: 'Free calculation', title: 'Lighting Lux Calculator', path: '/calculators/lighting-lux-calculator/' },
    { label: 'Report library', title: template ? 'All report templates' : 'Engineering report guides', path: template ? '/report-templates/' : '/reports/' },
  ];
  return `<section class="seo-section"><div class="seo-wrap"><div class="section-heading"><div><span class="seo-kicker">Related workflows</span><h2>Continue with the evidence.</h2></div><p class="section-heading__copy">Move between the technical guide, the report structure and the calculation tools without mixing their search intent.</p></div><div class="report-related-grid">${links.map((link) => `<a href="${link.path}"><small>${esc(link.label)}</small><strong>${esc(link.title)}</strong></a>`).join('')}</div></div></section>`;
}

function guidePage(topic) {
  const faqs = topic.faqs.map(([q, a]) => ({ q, a }));
  const hubPath = topic.kind === 'Calculation guide' ? '/calculations/' : '/reports/';
  const hubName = topic.kind === 'Calculation guide' ? 'Calculations' : 'Reports';
  return `${head({ title: topic.guideTitle, description: topic.guideDescription, path: topic.guidePath, faqs, breadcrumb: [{ name: 'Home', path: '/' }, { name: hubName, path: hubPath }, { name: topic.h1, path: topic.guidePath }] })}
<body class="regional-public">
<script src="/shell.js"></script>
<div class="docs-layout wide seo-no-rails"><aside class="docs-left"></aside><main class="docs-content">
<article class="seo-page report-seo-page">
  <header class="seo-hero program-hero"><div class="seo-hero__copy"><nav class="seo-breadcrumb" aria-label="Breadcrumb"><a href="/">Home</a> / <a href="${hubPath}">${hubName}</a> / ${esc(topic.h1)}</nav><span class="report-status">${esc(topic.status)}</span><span class="seo-kicker">${esc(topic.kind)}</span><h1>${esc(topic.h1)}</h1><p class="seo-hero__lead">${esc(topic.definition)}</p><div class="seo-hero__actions"><a class="signup-btn primary" href="${chat}">Build in Chat</a><a class="signup-btn secondary" href="${topic.templatePath}">View report template</a></div></div><aside class="seo-hero__aside"><div class="report-fact-panel"><div><small>Primary search</small><strong>${esc(topic.primary)}</strong></div><div><small>Assessment basis</small><strong>${esc(topic.standard)}</strong></div><div><small>Last technical review</small><strong>${reviewed}</strong></div></div></aside></header>
  <section class="seo-section seo-section--compact"><div class="seo-wrap"><p class="report-definition">${esc(topic.definition)}</p></div></section>
  <section class="seo-section"><div class="seo-wrap"><div class="report-fact-grid"><div class="report-fact"><small>Best suited to</small><strong>${esc(topic.audience)}</strong></div><div class="report-fact"><small>Core output</small><strong>${esc(topic.output)}</strong></div><div class="report-fact"><small>Source evidence</small><strong>${esc(topic.evidence)}</strong></div><div class="report-fact"><small>Workflow</small><strong>Chat-guided inputs and Report Studio handoff</strong></div></div></div></section>
  <section class="seo-section"><div class="seo-wrap"><div class="section-heading"><div><span class="seo-kicker">Report purpose</span><h2>What this report needs to prove.</h2></div><p class="section-heading__copy">The page targets “${esc(topic.primary)}” while keeping the report-template query on its own page.</p></div><div class="program-card-grid">${cards(topic.cards)}</div></div></section>
  <section class="seo-section"><div class="seo-wrap"><div class="section-heading"><div><span class="seo-kicker">Method</span><h2>How to prepare the assessment and report.</h2></div><p class="section-heading__copy">Use controlled source information, keep each modelling decision traceable and obtain competent-person review before issue.</p></div><ol class="report-steps">${topic.steps.map(([title, text]) => `<li><h3>${esc(title)}</h3><p>${esc(text)}</p></li>`).join('')}</ol></div></section>
  <section class="seo-section"><div class="seo-wrap"><div class="section-heading"><div><span class="seo-kicker">Input schedule</span><h2>Information to gather before you start.</h2></div><p class="section-heading__copy">Missing inputs should remain visible as review items. They should not be replaced with convenient assumptions without approval.</p></div><div class="report-table-wrap"><table class="report-table"><thead><tr><th>Input group</th><th>Source information</th><th>Why it matters</th></tr></thead><tbody>${rows(topic.inputs)}</tbody></table></div></div></section>
  <section class="seo-section"><div class="seo-wrap"><div class="section-heading"><div><span class="seo-kicker">Report structure</span><h2>What the issued report should contain.</h2></div><p class="section-heading__copy">Use the separate template page when the search task is to find the report layout rather than understand the assessment.</p></div><div class="report-table-wrap"><table class="report-table"><thead><tr><th>Section</th><th>Required coverage</th></tr></thead><tbody>${rows(topic.templateSections)}</tbody></table></div></div></section>
  <section class="seo-section"><div class="seo-wrap"><div class="section-heading"><div><span class="seo-kicker">Primary sources</span><h2>Standards and guidance to check.</h2></div><p class="section-heading__copy">The project team must confirm the current edition, jurisdiction, contractual requirements and authorised access to each publication.</p></div><ul class="report-source-list">${topic.sources.map(([label, url, note]) => `<li><a href="${url}">${esc(label)}</a><span>${esc(note)}</span></li>`).join('')}</ul></div></section>
  <section class="seo-section"><div class="seo-wrap"><div class="report-release-note"><div><h3>Prepare the report in Adelphos Chat.</h3><p>Collect the inputs, identify missing evidence and build the report structure now. Report Studio templates are being prepared for release.</p></div><a class="signup-btn primary" href="${chat}">Build in Chat</a></div></div></section>
  ${faqMarkup(faqs, topic.h1)}
  ${relatedMarkup(topic)}
  <section class="seo-section seo-section--compact"><div class="seo-wrap"><div class="responsibility-notice"><strong>Technical responsibility</strong><p>Adelphos structures declared evidence and report content. A competent person remains responsible for the model, calculations, standards, assumptions, interpretation, coordination and issued conclusion.</p></div></div></section>
</article></main></div>
</body></html>`;
}

function templatePage(topic) {
  const faqs = [
    { q: `What is included in this ${topic.primary} template?`, a: `The template covers the project and assessment basis, controlled inputs, methodology, quality checks, results, limitations, actions and sign-off needed for a reviewable ${topic.primary}.` },
    { q: 'Is this a completed assessment?', a: 'No. A template is a structure for project evidence. It does not supply missing calculations, approve assumptions or replace competent technical review.' },
    { q: 'Can I build it in Report Studio?', a: 'Yes. Use the Report Studio button to begin the guided report workflow in Adelphos. Report Studio is being prepared for release, and availability may vary by template.' },
  ];
  return `${head({ title: topic.templateTitle, description: topic.templateDescription, path: topic.templatePath, faqs, breadcrumb: [{ name: 'Home', path: '/' }, { name: 'Report templates', path: '/report-templates/' }, { name: topic.templateH1, path: topic.templatePath }] })}
<body class="regional-public">
<script src="/shell.js"></script>
<div class="docs-layout wide seo-no-rails"><aside class="docs-left"></aside><main class="docs-content">
<article class="seo-page report-seo-page">
  <header class="seo-hero program-hero"><div class="seo-hero__copy"><nav class="seo-breadcrumb" aria-label="Breadcrumb"><a href="/">Home</a> / <a href="/report-templates/">Report templates</a> / ${esc(topic.templateH1)}</nav><span class="report-status">${esc(topic.status)}</span><span class="seo-kicker">Report Studio template</span><h1>${esc(topic.templateH1)}</h1><p class="seo-hero__lead">${esc(topic.templateDescription)} The structure keeps missing evidence visible and separates calculation results from reviewer conclusions.</p><div class="seo-hero__actions"><a class="signup-btn primary" href="${chat}">Build in Report Studio</a><a class="signup-btn secondary" href="${topic.guidePath}">Read the report guide</a></div></div><aside class="seo-hero__aside"><div class="report-fact-panel"><div><small>Template intent</small><strong>${esc(topic.primary)} template</strong></div><div><small>Technical basis</small><strong>${esc(topic.standard)}</strong></div><div><small>Issue rule</small><strong>Competent-person review before issue</strong></div></div></aside></header>
  <section class="seo-section seo-section--compact"><div class="seo-wrap"><p class="report-definition">This ${esc(topic.templateH1)} is a controlled report outline for real project evidence. It is not a pre-filled compliance answer and it does not convert missing inputs into a pass.</p></div></section>
  <section class="seo-section"><div class="seo-wrap"><div class="section-heading"><div><span class="seo-kicker">Template outline</span><h2>Recommended report sections.</h2></div><p class="section-heading__copy">Each section has a clear evidence purpose so Report Studio can assemble a draft without hiding review gaps.</p></div><div class="report-table-wrap"><table class="report-table"><thead><tr><th>Report section</th><th>What belongs in it</th></tr></thead><tbody>${rows(topic.templateSections)}</tbody></table></div></div></section>
  <section class="seo-section"><div class="seo-wrap"><div class="section-heading"><div><span class="seo-kicker">Evidence checklist</span><h2>Inputs to bind into the template.</h2></div><p class="section-heading__copy">Use revisioned project data and label every assumption, exclusion and unresolved item.</p></div><div class="report-table-wrap"><table class="report-table"><thead><tr><th>Evidence group</th><th>Expected source</th><th>Template use</th></tr></thead><tbody>${rows(topic.inputs)}</tbody></table></div></div></section>
  <section class="seo-section"><div class="seo-wrap"><div class="section-heading"><div><span class="seo-kicker">Report Studio workflow</span><h2>From evidence to reviewed report.</h2></div><p class="section-heading__copy">Report Studio handles structure and assembly. Technical ownership stays with the project team.</p></div><ol class="report-steps"><li><h3>Select the template</h3><p>Start from the matching report type and record the project, stage, issue status and technical owner.</p></li><li><h3>Bind the source evidence</h3><p>Add controlled drawings, model outputs, calculation files, schedules, photographs and meeting decisions.</p></li><li><h3>Resolve gaps and assumptions</h3><p>Keep missing information and departures visible. Assign each item to an owner rather than inventing a value.</p></li><li><h3>Generate and review</h3><p>Build the draft, check every table and conclusion against its source, then complete competent-person review.</p></li><li><h3>Issue with traceability</h3><p>Record the revision, reviewer, source set, limitations and superseded information with the issued document.</p></li></ol></div></section>
  <section class="seo-section"><div class="seo-wrap"><div class="report-release-note"><div><h3>Build this template in Report Studio.</h3><p>Open Adelphos to collect project evidence and prepare the report. Template availability is being expanded as Adelphos prepares for release.</p></div><a class="signup-btn primary" href="${chat}">Build in Report Studio</a></div></div></section>
  ${faqMarkup(faqs, topic.templateH1)}
  ${relatedMarkup(topic, true)}
  <section class="seo-section seo-section--compact"><div class="seo-wrap"><div class="responsibility-notice"><strong>Template boundary</strong><p>The template organises evidence but does not create missing technical work, certify compliance or replace the named author and reviewer.</p></div></div></section>
</article></main></div>
</body></html>`;
}

function hubPage({ path, title, description, h1, kicker, intro, template = false, items = topics }) {
  const cardsMarkup = items.map((topic) => `<a class="region-link" href="${template ? topic.templatePath : topic.guidePath}"><span class="region-link__type">${template ? 'Report Studio template' : topic.kind}</span><strong>${esc(template ? topic.templateH1 : topic.h1)}</strong><span>${template ? 'View template' : 'Read guide'} &rarr;</span></a>`).join('');
  return `${head({ title, description, path, breadcrumb: [{ name: 'Home', path: '/' }, { name: h1, path }] })}
<body class="regional-public"><script src="/shell.js"></script><div class="docs-layout wide seo-no-rails"><aside class="docs-left"></aside><main class="docs-content"><article class="seo-page"><header class="specimen-hero"><div class="seo-wrap"><span class="seo-kicker">${esc(kicker)}</span><h1>${esc(h1)}</h1><p>${esc(intro)}</p><div class="seo-hero__actions" style="margin-top:24px"><a class="signup-btn primary" href="${chat}">${template ? 'Build in Report Studio' : 'Build in Chat'}</a><a class="signup-btn secondary" href="${template ? '/reports/' : '/report-templates/'}">${template ? 'Read report guides' : 'View report templates'}</a></div></div></header><section class="seo-section"><div class="seo-wrap"><div class="section-heading"><div><span class="seo-kicker">Five focused workflows</span><h2>${template ? 'Templates for reviewable technical reports.' : 'Guides for calculations, models and reports.'}</h2></div><p class="section-heading__copy">Each page has one primary search intent, direct answers, official source links and a clear route into Adelphos.</p></div><div class="location-grid program-index-grid">${cardsMarkup}</div></div></section></article></main></div></body></html>`;
}

function writePage(path, html) {
  const file = join(root, path.replace(/^\//, ''), 'index.html');
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, html, 'utf8');
  return path;
}

const paths = [];
for (const topic of topics) {
  paths.push(writePage(topic.guidePath, guidePage(topic)));
  paths.push(writePage(topic.templatePath, templatePage(topic)));
}
paths.push(writePage('/reports/', hubPage({ path: '/reports/', title: 'Engineering Reports and Assessment Guides | Adelphos', description: 'Explore practical Adelphos guides for TM59, TM52, natural ventilation, thermal modelling and lighting calculation reports, inputs and evidence.', h1: 'Engineering reports and assessment guides', kicker: 'Adelphos reports', intro: 'Prepare controlled engineering assessments, calculations and report evidence in Chat, then move the reviewed content into Report Studio.' })));
paths.push(writePage('/report-templates/', hubPage({ path: '/report-templates/', title: 'Engineering Report Templates | Adelphos Report Studio', description: 'Explore structured report templates for TM59, TM52, natural ventilation, thermal modelling and lighting calculations, ready for Report Studio.', h1: 'Engineering report templates', kicker: 'Adelphos Report Studio', intro: 'Use evidence-led report structures that keep inputs, model outputs, assumptions, review actions and conclusions traceable.' , template: true })));
paths.push(writePage('/calculations/', hubPage({ path: '/calculations/', title: 'Engineering Calculation Guides | Adelphos', description: 'Read practical engineering calculation guides and move from design inputs to protected Adelphos calculations and reports.', h1: 'Engineering calculation guides', kicker: 'Adelphos calculations', intro: 'Start with the lighting calculation guide, use the free protected calculator for an early estimate, then build the reviewed workflow in Chat.', items: topics.filter((topic) => topic.kind === 'Calculation guide') })));

const sitemapPath = join(root, 'sitemap.xml');
let sitemap = readFileSync(sitemapPath, 'utf8');
const today = '2026-08-09';
const additions = paths.filter((path) => !sitemap.includes(`<loc>${absolute(path)}</loc>`)).map((path) => `<url>\n  <loc>${absolute(path)}</loc>\n  <lastmod>${today}</lastmod>\n  <changefreq>monthly</changefreq>\n  <priority>${path === '/reports/' || path === '/report-templates/' ? '0.8' : '0.7'}</priority>\n</url>`).join('\n');
if (additions) sitemap = sitemap.replace('</urlset>', `${additions}\n</urlset>`);
writeFileSync(sitemapPath, sitemap, 'utf8');

const llmsPath = join(root, 'llms.txt');
let llms = readFileSync(llmsPath, 'utf8');
if (!llms.includes('## Engineering reports and Report Studio templates')) {
  llms += `\n\n## Engineering reports and Report Studio templates\n\n${paths.map((path) => `- ${absolute(path)}`).join('\n')}\n`;
  writeFileSync(llmsPath, llms, 'utf8');
}

console.log(`Generated ${paths.length} SEO pages and refreshed sitemap/llms indexes.`);
