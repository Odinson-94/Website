  // Core state
  // --------------------------------------------------
  
  if (window.PERF) window.PERF.mark('brain.js START');

  const canvas = document.getElementById("scene");
  const ctx = canvas.getContext("2d");

  // Disabled high-DPI for performance (dpr = 1)
  const dpr = 1;
  
  let width = window.innerWidth;
  let height = window.innerHeight;

  // Set canvas size (no DPR scaling)
  canvas.width = width;
  canvas.height = height;

  // =====================================================
  // FIXED REFERENCE COORDINATE SYSTEM
  // =====================================================
  // Network is ALWAYS built at these reference dimensions.
  // Optimized for 2560x1440 at 150% Windows scaling = 1707x960 effective
  // This ensures identical brain layout across all screens 14"+ 
  // The worldToScreen transform scales from reference to actual.
  const REF_WIDTH = 1707;
  const REF_HEIGHT = 960;
  const REF_CENTER_X = REF_WIDTH / 2;
  const REF_CENTER_Y = REF_HEIGHT / 2;

  let nodes = [];
  let edges = [];
  let pulses = [];
  let particles = [];
  let lastTime = 0;
  
  // Mouse tracking
  let mouseX = -1000;
  let mouseY = -1000;
  
  // DUAL HOVER SYSTEM - User and Auto-hover are completely separate streams
  // Both can be active simultaneously and don't interfere with each other
  let userHoveredNode = null;    // Set by user mouse/overlay interaction
  let autoHoveredNode = null;    // Set by timer-based auto-hover cycling
  let userHoverPulseTimer = 0;   // Pulse timer for user hover
  let autoHoverPulseTimer = 0;   // Pulse timer for auto-hover
  
  // Legacy alias for backward compatibility - returns user hover if active, else auto
  function getHoveredNode() {
    return userHoveredNode !== null ? userHoveredNode : autoHoveredNode;
  }
  
// Dark mode - check immediately on load to prevent flash
// Check cookie first, then localStorage as fallback
function checkDarkModeCookie() {
  const match = document.cookie.match(/(?:^|; )darkMode=([^;]*)/);
  return match ? match[1] === 'true' : false;
}
let darkMode = checkDarkModeCookie() || localStorage.getItem('darkMode') === 'true';

function setDarkMode(enabled) {
  darkMode = enabled;
}
window.setDarkMode = setDarkMode;

// --------------------------------------------------
// ADAPTIVE PERFORMANCE SYSTEM
// --------------------------------------------------
// Monitors FPS and reduces effects when performance drops.
// Tiers: HIGH (45+fps), MEDIUM (30-45fps), LOW (20-30fps), MINIMAL (<20fps)

const PERF_SAMPLE_SIZE = 30;        // Frames to average
const PERF_CHECK_INTERVAL = 500;    // ms between tier checks
const PERF_HYSTERESIS = 5;          // FPS buffer to prevent flickering

let perfFrameTimes = [];
let perfLastCheck = 0;
let perfTier = 'HIGH';              // HIGH, MEDIUM, LOW, MINIMAL
let perfCurrentFPS = 60;

// Tier thresholds (with hysteresis for stability)
const PERF_TIERS = {
  HIGH:    { minFPS: 45, upFPS: 50 },   // Full effects
  MEDIUM:  { minFPS: 30, upFPS: 35 },   // Reduced trails, simpler glow
  LOW:     { minFPS: 20, upFPS: 25 },   // No hover glow, fewer pulses
  MINIMAL: { minFPS: 0,  upFPS: 15 }    // Basic rendering only
};

// Feature flags based on tier
// maxPulses: Infinity for HIGH = uncapped, let cascades run freely
const PERF_FEATURES = {
  HIGH:    { hoverGlow: true,  trailLength: 8,  edgeGlow: true,  particles: true,  maxPulses: Infinity, nodeGradients: true  },
  MEDIUM:  { hoverGlow: true,  trailLength: 4,  edgeGlow: true,  particles: true,  maxPulses: 150, nodeGradients: true  },
  LOW:     { hoverGlow: false, trailLength: 2,  edgeGlow: false, particles: false, maxPulses: 75,  nodeGradients: false },
  MINIMAL: { hoverGlow: false, trailLength: 0,  edgeGlow: false, particles: false, maxPulses: 30,  nodeGradients: false }
};

function getPerfFeatures() {
  return PERF_FEATURES[perfTier] || PERF_FEATURES.HIGH;
}

function updatePerformanceTier(dt) {
  // Record frame time
  const fps = dt > 0 ? 1 / dt : 60;
  perfFrameTimes.push(fps);
  if (perfFrameTimes.length > PERF_SAMPLE_SIZE) {
    perfFrameTimes.shift();
  }
  
  // Only check tier periodically to avoid constant switching
  const now = performance.now();
  if (now - perfLastCheck < PERF_CHECK_INTERVAL) return;
  perfLastCheck = now;
  
  // Calculate average FPS
  if (perfFrameTimes.length < 10) return; // Need enough samples
  const avgFPS = perfFrameTimes.reduce((a, b) => a + b, 0) / perfFrameTimes.length;
  perfCurrentFPS = Math.round(avgFPS);
  
  // Determine new tier with hysteresis
  const oldTier = perfTier;
  
  if (perfTier === 'MINIMAL') {
    if (avgFPS >= PERF_TIERS.LOW.upFPS) perfTier = 'LOW';
  } else if (perfTier === 'LOW') {
    if (avgFPS >= PERF_TIERS.MEDIUM.upFPS) perfTier = 'MEDIUM';
    else if (avgFPS < PERF_TIERS.LOW.minFPS) perfTier = 'MINIMAL';
  } else if (perfTier === 'MEDIUM') {
    if (avgFPS >= PERF_TIERS.HIGH.upFPS) perfTier = 'HIGH';
    else if (avgFPS < PERF_TIERS.MEDIUM.minFPS) perfTier = 'LOW';
  } else { // HIGH
    if (avgFPS < PERF_TIERS.HIGH.minFPS) perfTier = 'MEDIUM';
  }
  
  if (oldTier !== perfTier) {
    console.log(`Performance tier: ${oldTier} → ${perfTier} (${perfCurrentFPS} FPS)`);
  }
}

// Debug mode - shows FPS/tier indicator
let perfDebugMode = false;

function setPerfDebug(enabled) {
  perfDebugMode = enabled;
  console.log('Performance debug mode:', enabled ? 'ON' : 'OFF');
}

// Draw debug overlay
function drawPerfDebug() {
  if (!perfDebugMode) return;
  
  ctx.save();
  ctx.font = '12px monospace';
  ctx.textAlign = 'left';
  
  const tierColors = { HIGH: '#00cc66', MEDIUM: '#ffaa00', LOW: '#ff6600', MINIMAL: '#ff3333' };
  const color = tierColors[perfTier] || '#888';
  
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(10, 10, 100, 40);
  
  ctx.fillStyle = color;
  ctx.fillText(`${perfCurrentFPS} FPS`, 18, 28);
  ctx.fillText(`${perfTier}`, 18, 42);
  
  ctx.restore();
}

// Expose for debugging
window.getPerfTier = () => perfTier;
window.getPerfFPS = () => perfCurrentFPS;
window.setPerfDebug = setPerfDebug;

// --------------------------------------------------
// TRANSITION MODE - Simplified rendering during moves
// --------------------------------------------------
// When brain is moving/scaling, we reduce visual complexity
// to ensure smooth 60fps animations.

let transitionMode = false;

function isInTransition() {
  // Check if brain is currently moving or scaling
  return brainMoveStartTime > 0 || brainScaleStartTime > 0;
}

// Expose for view-controller
window.isInTransition = isInTransition;
  
  // Brain position control
  let brainOpacity = 1;          // Full opacity (no fade)
  let brainTargetOpacity = 1;
  // If BRAIN_INITIAL_VIEW is set, wait for it; otherwise render immediately (index.html behavior)
  let viewInitialized = (typeof window.BRAIN_INITIAL_VIEW !== 'number');
  
  // Virtual Camera System - positions transform, sizes stay fixed in pixels
  const camera = {
    x: 0,
    y: 0,
    zoom: 1.0
  };
  
  let isDragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let dragStartCamX = 0;
  let dragStartCamY = 0;
  const MIN_ZOOM = 1.0;
  const MAX_ZOOM = 20.0; // Updated for stem view (18.0)
  const SCROLL_ZOOM_TARGET = 10.0; // 1000% for scroll
  
  // Animated zoom with camera pan
  let zoomAnimating = false;
  let zoomStartTime = 0;
  let zoomDuration = 1000;
  let zoomStartValue = 1.0;
  let zoomTargetValue = 1.0;
  let isScrollZoom = false; // Track if this is scroll-triggered zoom
  let zoomCallbackFired = false; // Track if callback fired
  let camStartX = 0;
  let camStartY = 0;
  let camTargetX = 0;
  let camTargetY = 0;
  // For zoom-in: keep this point fixed on screen
  let zoomFixedWorldX = 0;
  let zoomFixedWorldY = 0;
  let zoomFixedScreenX = 0;
  let zoomFixedScreenY = 0;
  let zoomingIn = false;
  
  // Brain animation variables
  let brainOffsetX = 0;
  let brainTargetOffsetX = 0;
  let brainMoveStartX = 0;  // Starting value for interpolation
  let brainMoveStartTime = 0;
  let brainMoveDuration = 1000;
  let brainScaleAnim = 1.0;
  let brainTargetScale = 1.0;
  let brainScaleStartValue = 1.0;  // Starting value for interpolation
  let brainScaleStartTime = 0;
  
  // Camera pan animation (for Views 4, 5, 6 - simple offset from current position)
  let camPanAnimating = false;
  let camPanStartTime = 0;
  let camPanDuration = 800;
  let camPanStartX = 0;
  let camPanStartY = 0;
  let camPanTargetX = 0;
  let camPanTargetY = 0;
  
  // Cached transform coefficients (updated once per frame)
  let txA = 1, txB = 0, txC = 1, txD = 0; // x = (wx - REF_CENTER_X) * txA + txB, y = (wy - REF_CENTER_Y) * txC + txD
  
  function updateTransformCache() {
    const screenCenterX = width / 2;
    const screenCenterY = height / 2;
    
    // Scale factor from reference to screen (fit to smaller dimension to maintain aspect ratio)
    const refScale = Math.min(width / REF_WIDTH, height / REF_HEIGHT);
    
    // Combined scale: reference-to-screen * brainScaleAnim * camera.zoom
    const totalScale = refScale * brainScaleAnim * camera.zoom;
    
    txA = totalScale;
    txB = screenCenterX + (brainOffsetX - camera.x) * camera.zoom;
    txC = totalScale;
    txD = screenCenterY - camera.y * camera.zoom;
  }
  
  // Transform world coordinates to screen coordinates (uses cached coefficients)
  // World coords are centered at REF_CENTER_X, REF_CENTER_Y
  function worldToScreen(wx, wy) {
    return {
      x: (wx - REF_CENTER_X) * txA + txB,
      y: (wy - REF_CENTER_Y) * txC + txD
    };
  }
  
  // Transform screen coordinates to world coordinates
  // Returns coordinates in the REF_WIDTH x REF_HEIGHT system
  function screenToWorld(sx, sy) {
    const screenCenterX = width / 2;
    const screenCenterY = height / 2;
    const refScale = Math.min(width / REF_WIDTH, height / REF_HEIGHT);
    
    // Undo camera transform
    let cx = (sx - screenCenterX - (brainOffsetX - camera.x) * camera.zoom) / camera.zoom;
    let cy = (sy - screenCenterY + camera.y * camera.zoom) / camera.zoom;
    
    // Undo brain animation and reference scale
    return {
      x: cx / (refScale * brainScaleAnim) + REF_CENTER_X,
      y: cy / (refScale * brainScaleAnim) + REF_CENTER_Y
    };
  }

  // Seeded random number generator
  let currentSeed = 1408343519; // Fixed seed for consistent brain structure
  const initialSeed = currentSeed; // Store the initial seed for download
  function seededRandom() {
    currentSeed = (currentSeed * 1103515245 + 12345) & 0x7fffffff;
    return currentSeed / 0x7fffffff;
  }
  
  // Function to get/set seed
  function getSeed() { return initialSeed; }
  function setSeed(s) { currentSeed = s; }

  // Configuration
  const BASE_PULSE_COUNT = 2;      // Reduced to 2
  const HOVER_PULSE_RATE = 0.03;   // Very fast hover pulses
  const PULSE_SPEED_MIN = 2.5;     // Faster base speed
  const PULSE_SPEED_MAX = 4.0;     // Faster max speed
  const TRAIL_LENGTH = 8;
  const GLOW_RADIUS = 55;
  const CURVE_SEGMENTS = 15;
  const HOVER_RADIUS = 8;         // Original value
  const MAX_HOVER_INTENSITY = 1.0;
  const HOVER_RAMP_SPEED = 0.2;
  const GLOW_RAMP_SPEED = 0.25;
  const GLOW_DECAY_SPEED = 0.5;
  const HOVER_DECAY_SPEED = 0.9;

  // --------------------------------------------------
  // Utility
  // --------------------------------------------------

  function rand(min, max) {
    return seededRandom() * (max - min) + min;
  }

  function clamp(val, min, max) {
    return val < min ? min : val > max ? max : val;
  }

  // Quadratic Bezier interpolation
  function quadraticPoint(t, p0, p1, p2) {
    const oneMinusT = 1 - t;
    const x =
      oneMinusT * oneMinusT * p0.x +
      2 * oneMinusT * t * p1.x +
      t * t * p2.x;
    const y =
      oneMinusT * oneMinusT * p0.y +
      2 * oneMinusT * t * p1.y +
      t * t * p2.y;
    return { x, y };
  }

  // --------------------------------------------------
  // Network construction - Brain Shape (from CAD export)
  // --------------------------------------------------
  
  // Animation control - pause pulses until container animation completes
  let animationStarted = false;
  
  // Brain outline from JSON export - raw coordinates
  const brainCoordsRaw = [
    { X: 259.557, Y: 721.512 },
    { X: 312.922, Y: 897.098 },
    { X: 590.076, Y: 1075.952 },
    { X: 793.031, Y: 1167.561 },
    { X: 1144.383, Y: 1209.003 },
    { X: 1328.857, Y: 1230.761 },
    { X: 1541.565, Y: 1211.184 },
    { X: 1761.979, Y: 1174.104 },
    { X: 2108.967, Y: 1060.684 },
    { X: 2209.353, Y: 995.250 },
    { X: 2309.739, Y: 807.670 },
    { X: 2351.203, Y: 735.692 },
    { X: 2394.850, Y: 637.540 },
    { X: 2431.949, Y: 537.207 },
    { X: 2431.949, Y: 393.251 },
    { X: 2414.491, Y: 349.627 },
    { X: 2292.281, Y: 146.780 },
    { X: 2246.452, Y: 114.063 },
    { X: 2165.707, Y: 90.070 },
    { X: 2060.956, Y: 57.353 },
    { X: 1997.668, Y: -23.350 },
    { X: 1851.647, Y: -135.914 },
    { X: 1794.266, Y: -138.014 },
    { X: 1786.693, Y: -159.855 },
    { X: 1787.460, Y: -190.482 },
    { X: 1816.037, Y: -350.159 },
    { X: 1699.990, Y: -313.728 },
    { X: 1684.038, Y: -253.110 },
    { X: 1643.727, Y: -196.312 },
    { X: 1598.204, Y: -106.051 },
    { X: 1477.185, Y: 17.102 },
    { X: 1246.952, Y: 20.273 },
    { X: 1173.134, Y: -6.442 },
    { X: 1000.253, Y: -39.788 },
    { X: 838.859, Y: -58.249 },
    { X: 770.967, Y: -11.291 },
    { X: 686.287, Y: 75.367 },
    { X: 581.536, Y: 151.708 },
    { X: 398.258, Y: 168.313 },
    { X: 288.916, Y: 286.374 },
    { X: 245.270, Y: 493.584 },
    { X: 245.270, Y: 661.533 },
    { X: 259.557, Y: 721.512 }
  ];
  
  // Calculate bounds and normalize
  const minX = Math.min(...brainCoordsRaw.map(p => p.X));
  const maxX = Math.max(...brainCoordsRaw.map(p => p.X));
  const minY = Math.min(...brainCoordsRaw.map(p => p.Y));
  const maxY = Math.max(...brainCoordsRaw.map(p => p.Y));
  const cadWidth = maxX - minX;
  const cadHeight = maxY - minY;
  const cadCenterX = (minX + maxX) / 2;
  const cadCenterY = (minY + maxY) / 2;
  
  // Normalize to -1 to 1 range (flip Y for screen coordinates)
  // Scale X by 1.15 to make more elliptical (less square)
  const brainOutline = brainCoordsRaw.map(p => [
    (p.X - cadCenterX) / (cadWidth / 2) * 1.15,
    -(p.Y - cadCenterY) / (cadHeight / 2)
  ]);
  
  // Point in polygon test using ray casting
  function pointInPolygon(x, y, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i][0], yi = polygon[i][1];
      const xj = polygon[j][0], yj = polygon[j][1];
      
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
        inside = !inside;
      }
    }
    return inside;
  }
  
  function isInsideBrain(x, y, centerX, centerY, scale) {
    const nx = (x - centerX) / scale;
    const ny = (y - centerY) / scale;
    return pointInPolygon(nx, ny, brainOutline);
  }
  
  function getBrainDensity(x, y, centerX, centerY, scale) {
    const nx = (x - centerX) / scale;
    const ny = (y - centerY) / scale;
    const dist = Math.sqrt(nx * nx + ny * ny);
    let density = Math.max(0, 1 - dist * 1.0);
    return Math.min(1, density);
  }

  function buildNetwork() {
    nodes = [];
    edges = [];

    // Use FIXED reference dimensions for consistent network layout
    const centerX = REF_CENTER_X;
    const centerY = REF_CENTER_Y;
    // Match original brainScale calculation: min(smallerDim * 0.45, 400)
    // For 1707x960: min(960 * 0.45, 400) = min(432, 400) = 400px
    const maxBrainScale = 400;
    const brainScale = Math.min(Math.min(REF_WIDTH, REF_HEIGHT) * 0.45, maxBrainScale);
    
    // Define brain regions based on angle from center
    // 0: Frontal (front-left), 1: Parietal (top), 2: Occipital (back-right), 
    // 3: Temporal-lower, 4: Central
    function getRegion(x, y) {
      const dx = x - centerX;
      const dy = y - centerY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx); // -PI to PI
      
      // Central region - close to center
      if (dist < brainScale * 0.3) return 4;
      
      // Divide by angle
      if (angle >= -Math.PI/4 && angle < Math.PI/4) return 2; // Right - Occipital
      if (angle >= Math.PI/4 && angle < 3*Math.PI/4) return 3; // Bottom - Temporal
      if (angle >= -3*Math.PI/4 && angle < -Math.PI/4) return 1; // Top - Parietal
      return 0; // Left - Frontal
    }
    
    const targetNodes = 480;
    
    let attempts = 0;
    const maxAttempts = targetNodes * 50;
    
    while (nodes.length < targetNodes && attempts < maxAttempts) {
      attempts++;
      
      const x = centerX + (seededRandom() - 0.5) * brainScale * 2.4;
      const y = centerY + (seededRandom() - 0.5) * brainScale * 2.4;
      
      if (!isInsideBrain(x, y, centerX, centerY, brainScale)) {
        continue;
      }
      
      const density = getBrainDensity(x, y, centerX, centerY, brainScale);
      const minDist = 8 + (1 - density) * 14;
      
      let tooClose = false;
      for (const node of nodes) {
        const dx = node.x - x;
        const dy = node.y - y;
        if (dx * dx + dy * dy < minDist * minDist) {
          tooClose = true;
          break;
        }
      }
      
      if (tooClose) continue;
      
      const baseR = rand(1.5, 3.5);
      const region = getRegion(x, y);
      
      nodes.push({
        id: nodes.length,
        x: x,
        y: y,
        r: baseR,
        activation: 0,
        baseR: baseR,
        baseBrightness: rand(0.3, 0.9),
        layer: Math.floor(density * 3),
        yellowActivation: 0,
        blueActivation: 0,
        hoverIntensity: 0,
        hoverTimer: 0,
        density: density,
        region: region
      });
    }

    // Build connections - local within regions, highways between regions
    for (let i = 0; i < nodes.length; i++) {
      const from = nodes[i];
      
      // Separate nodes by region
      const sameRegion = [];
      const otherRegion = [];
      
      for (let j = 0; j < nodes.length; j++) {
        if (i === j) continue;
        const to = nodes[j];
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (to.region === from.region) {
          sameRegion.push({ idx: j, dist: dist });
        } else {
          otherRegion.push({ idx: j, dist: dist, toRegion: to.region });
        }
      }
      
      sameRegion.sort((a, b) => a.dist - b.dist);
      otherRegion.sort((a, b) => a.dist - b.dist);
      
      // Local connections - dense within region
      const localConnections = Math.floor(4 + (from.density || 0.5) * 4); // 4-8 local
      const maxLocalDist = 100;
      
      let localCount = 0;
      for (const d of sameRegion) {
        if (localCount >= localConnections) break;
        if (d.dist > maxLocalDist) break;
        
        const edgeExists = edges.some(e => 
          (e.from === i && e.to === d.idx) || 
          (e.from === d.idx && e.to === i)
        );
        
        if (!edgeExists) {
          const to = nodes[d.idx];
          const curveStrength = rand(-6, 6);
          
          const midX = (from.x + to.x) / 2;
          const midY = (from.y + to.y) / 2;
          const dx = to.x - from.x;
          const dy = to.y - from.y;
          const len = Math.sqrt(dx * dx + dy * dy) || 1;
          const nnx = -dy / len;
          const nny = dx / len;
          
          const p0 = { x: from.x, y: from.y };
          const p1 = { x: midX + nnx * curveStrength, y: midY + nny * curveStrength };
          const p2 = { x: to.x, y: to.y };
          
          const curvePoints = [];
          for (let s = 0; s <= CURVE_SEGMENTS; s++) {
            const t = s / CURVE_SEGMENTS;
            curvePoints.push(quadraticPoint(t, p0, p1, p2));
          }
          
          edges.push({
            from: i,
            to: d.idx,
            cx: p1.x,
            cy: p1.y,
            curvePoints: curvePoints,
            pulsePositions: [],
            baseOpacity: rand(0.06, 0.18),
            baseBrightness: rand(0.5, 1.0),
            activity: 0,
            hoverBoost: 0,
            targetHoverBoost: 0,
            hoverBoostFactor: rand(0.03, 0.1),
            isHighway: false
          });
          
          localCount++;
        }
      }
      
      // Cross-boundary connections - connect to nearby nodes in adjacent regions
      const crossBoundaryMax = 2; // Up to 2 cross-boundary local connections
      const maxCrossDist = 70; // Shorter range for cross-boundary
      let crossCount = 0;
      
      for (const d of otherRegion) {
        if (crossCount >= crossBoundaryMax) break;
        if (d.dist > maxCrossDist) break;
        
        const edgeExists = edges.some(e => 
          (e.from === i && e.to === d.idx) || 
          (e.from === d.idx && e.to === i)
        );
        
        if (!edgeExists) {
          const to = nodes[d.idx];
          const curveStrength = rand(-6, 6);
          
          const midX = (from.x + to.x) / 2;
          const midY = (from.y + to.y) / 2;
          const dx = to.x - from.x;
          const dy = to.y - from.y;
          const len = Math.sqrt(dx * dx + dy * dy) || 1;
          const nnx = -dy / len;
          const nny = dx / len;
          
          const p0 = { x: from.x, y: from.y };
          const p1 = { x: midX + nnx * curveStrength, y: midY + nny * curveStrength };
          const p2 = { x: to.x, y: to.y };
          
          const curvePoints = [];
          for (let s = 0; s <= CURVE_SEGMENTS; s++) {
            const t = s / CURVE_SEGMENTS;
            curvePoints.push(quadraticPoint(t, p0, p1, p2));
          }
          
          edges.push({
            from: i,
            to: d.idx,
            cx: p1.x,
            cy: p1.y,
            curvePoints: curvePoints,
            pulsePositions: [],
            baseOpacity: rand(0.06, 0.18),
            baseBrightness: rand(0.5, 1.0),
            activity: 0,
            hoverBoost: 0,
            targetHoverBoost: 0,
            hoverBoostFactor: rand(0.03, 0.1),
            isHighway: false
          });
          
          crossCount++;
        }
      }
      
      // Highway connections - sparse between regions (~20% of nodes get one)
      if (seededRandom() < 0.2 && otherRegion.length > 0) {
        // Pick a random distant node in another region
        const minHighwayDist = 150;
        const maxHighwayDist = 500;
        const highwayCandidates = otherRegion.filter(d => d.dist >= minHighwayDist && d.dist <= maxHighwayDist);
        
        if (highwayCandidates.length > 0) {
          const d = highwayCandidates[Math.floor(seededRandom() * highwayCandidates.length)];
          
          const edgeExists = edges.some(e => 
            (e.from === i && e.to === d.idx) || 
            (e.from === d.idx && e.to === i)
          );
          
          if (!edgeExists) {
            const to = nodes[d.idx];
            const curveStrength = rand(-30, 30); // More dramatic curves
            
            const midX = (from.x + to.x) / 2;
            const midY = (from.y + to.y) / 2;
            const dx = to.x - from.x;
            const dy = to.y - from.y;
            const len = Math.sqrt(dx * dx + dy * dy) || 1;
            const nnx = -dy / len;
            const nny = dx / len;
            
            const p0 = { x: from.x, y: from.y };
            const p1 = { x: midX + nnx * curveStrength, y: midY + nny * curveStrength };
            const p2 = { x: to.x, y: to.y };
            
            const curvePoints = [];
            for (let s = 0; s <= CURVE_SEGMENTS; s++) {
              const t = s / CURVE_SEGMENTS;
              curvePoints.push(quadraticPoint(t, p0, p1, p2));
            }
            
            edges.push({
              from: i,
              to: d.idx,
              cx: p1.x,
              cy: p1.y,
              curvePoints: curvePoints,
              pulsePositions: [],
              baseOpacity: rand(0.02, 0.08), // Fainter highways
              baseBrightness: rand(0.5, 1.0),
              activity: 0,
              hoverBoost: 0,
              targetHoverBoost: 0,
              hoverBoostFactor: rand(0.03, 0.1),
              isHighway: true
            });
          }
        }
      }
    }
  }
  
// Function to start animations after container animation completes
function startNeuralAnimations() {
  animationStarted = true;
  
  // Start base pulses immediately (normal firing)
  ensureBasePulseCount();
  
  // Fire multiple stem-to-center cascades immediately for impressive visual
  // Fire 3 streams with slight stagger for a burst effect
  fireInitialSignal();
  setTimeout(() => fireInitialSignal(), 80);
  setTimeout(() => fireInitialSignal(), 160);
}
window.startNeuralAnimations = startNeuralAnimations;
  
  // Fire a special signal from brain stem up to the center node
  function fireInitialSignal() {
    if (nodes.length === 0) return;
    
    // Use reference coordinates since nodes are built at REF_WIDTH x REF_HEIGHT
    const centerX = REF_CENTER_X;
    const centerY = REF_CENTER_Y;
    
    // Find the stem node - HIGHEST Y value (bottom of screen = stem)
    let stemNode = null;
    let highestY = -Infinity;
    
    for (const node of nodes) {
      if (node.y > highestY) {
        highestY = node.y;
        stemNode = node;
      }
    }
    
    // Find the node closest to the centroid (screen center)
    let centerNode = null;
    let minDistToCenter = Infinity;
    
    for (const node of nodes) {
      const dist = Math.sqrt(
        Math.pow(node.x - centerX, 2) + 
        Math.pow(node.y - centerY, 2)
      );
      if (dist < minDistToCenter) {
        minDistToCenter = dist;
        centerNode = node;
      }
    }
    
    if (!stemNode || !centerNode || stemNode.id === centerNode.id) {
      // Just skip the cascade if we can't find proper nodes
      return;
    }
    
    // Fire the special signal - it will path-find upward to center
    fireSignalToTarget(stemNode.id, centerNode.id);
  }
  
  // Fire a signal that paths from start node toward target node
  function fireSignalToTarget(startNodeId, targetNodeId) {
    const startNode = nodes[startNodeId];
    const targetNode = nodes[targetNodeId];
    if (!startNode || !targetNode) return;
    
    // Find path using connected edges, always moving closer to target
    let currentNodeId = startNodeId;
    let visitedNodes = new Set([currentNodeId]);
    let pathNodes = [currentNodeId];
    
    while (currentNodeId !== targetNodeId && pathNodes.length < 30) {
      const currentNode = nodes[currentNodeId];
      
      // Find connected edges
      let bestNextNode = null;
      let bestDist = Infinity;
      
      for (const edge of edges) {
        let nextNodeId = null;
        if (edge.from === currentNodeId) nextNodeId = edge.to;
        else if (edge.to === currentNodeId) nextNodeId = edge.from;
        
        if (nextNodeId !== null && !visitedNodes.has(nextNodeId)) {
          const nextNode = nodes[nextNodeId];
          const distToTarget = Math.sqrt(
            Math.pow(targetNode.x - nextNode.x, 2) + 
            Math.pow(targetNode.y - nextNode.y, 2)
          );
          
          if (distToTarget < bestDist) {
            bestDist = distToTarget;
            bestNextNode = nextNodeId;
          }
        }
      }
      
      if (bestNextNode === null) break;
      
      visitedNodes.add(bestNextNode);
      pathNodes.push(bestNextNode);
      currentNodeId = bestNextNode;
      
      // Check if we reached the target
      if (currentNodeId === targetNodeId) break;
      
      // Check if we're close enough to target
      if (bestDist < 30) {
        if (targetNodeId !== currentNodeId) {
          pathNodes.push(targetNodeId);
        }
        break;
      }
    }
    
    // Fire pulses along the path with delays for cascade effect
    firePathPulses(pathNodes, targetNodeId);
  }
  
  // Fire pulses along a path with sequential timing
  async function firePathPulses(pathNodes, targetNodeId) {
    for (let i = 0; i < pathNodes.length - 1; i++) {
      const fromNodeId = pathNodes[i];
      const toNodeId = pathNodes[i + 1];
      
      // Find the edge between these nodes
      const edge = edges.find(e => 
        (e.from === fromNodeId && e.to === toNodeId) ||
        (e.from === toNodeId && e.to === fromNodeId)
      );
      
      if (edge) {
        const fromNode = nodes[fromNodeId];
        const reverse = edge.from !== fromNodeId;
        
        // Create a highly visible blue pulse for the path
        const pulse = {
          edge: edge,
          edgeIdx: edges.indexOf(edge),
          t: reverse ? 1 : 0,
          speed: 0.7, // Faster cascade
          direction: reverse ? -1 : 1,
          brightness: 100,
          currentBrightness: 100,
          trailThickness: rand(0.6, 1.8), // Slightly thicker trails
          isYellow: true, // Blue/cyan color
          fromHover: false,
          isGhost: false,
          isInitialSignal: true,
          trail: [],
          visited: new Set(),
          alive: true,
          hasArrived: false,
          reverse: reverse,
          baseBrightness: 70,
          fromNodeBrightness: nodes[edge.from].baseBrightness,
          toNodeBrightness: nodes[edge.to].baseBrightness
        };
        
        pulses.push(pulse);
        
        // Mark edge as glowing
        edge.glowIntensity = 1.0;
        edge.pathGlow = 1.0;
        
        // Activate the from node with blue glow
        fromNode.activation = 1.0;
        fromNode.yellowActivation = 1.0;
        fromNode.blueActivation = 1.0;
        
        // Wait for pulse to travel before firing next - shorter delay for faster cascade
        await new Promise(resolve => setTimeout(resolve, 120));
      }
    }
    
    // After path completes, glow the center node
    setTimeout(() => {
      const targetNode = nodes[targetNodeId];
      if (targetNode) {
        targetNode.activation = 1.0;
        targetNode.yellowActivation = 1.0;
        targetNode.blueActivation = 1.0;
        targetNode.baseBrightness = 1.0;
      }
    }, 300);
  }

  function buildParticles() {
    particles = [];
    const count = Math.round((width * height) / 150000); // Reduced from 100000 - fewer particles
    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: rand(-0.004, 0.004), // Slower horizontal movement
        vy: rand(-0.01, -0.003), // Slower vertical movement
        size: rand(0.5, 1.2),
        alpha: rand(0.06, 0.1), // Slightly more transparent
        phase: Math.random() * Math.PI * 2
      });
    }
  }

  // --------------------------------------------------
  // Pulse spawning
  // --------------------------------------------------

  function spawnPulse(forceFromNode = null) {
    if (edges.length === 0) return;
    
    let edgeIdx;
    let isYellow = false;
    
    if (forceFromNode !== null) {
      // When spawning from hover, boost the source node activation
      const sourceNode = nodes[forceFromNode];
      if (sourceNode) {
        // All nodes get activation that will fade to zero
        if (sourceNode.baseBrightness > 0.8) {
          sourceNode.activation = 0.2; // Will fade to zero
        } else {
          const boost = 0.3 * (1 - sourceNode.baseBrightness);
          sourceNode.activation = Math.min(0.6, sourceNode.activation + boost);
        }
      }
      
      // Spawn from or to the specified node, but prefer outgoing
      const outgoingEdges = edges.filter(e => e.from === forceFromNode);
      const incomingEdges = edges.filter(e => e.to === forceFromNode);
      
      let validEdges;
      // 80% chance to fire OUT from the node, 20% to attract TO the node
      if (Math.random() < 0.8 && outgoingEdges.length > 0) {
        validEdges = outgoingEdges;
      } else if (incomingEdges.length > 0) {
        validEdges = incomingEdges;
      } else {
        validEdges = outgoingEdges.length > 0 ? outgoingEdges : edges.filter(e => e.from === forceFromNode || e.to === forceFromNode);
      }
      
      if (validEdges.length === 0) return;
      
      const edge = validEdges[Math.floor(Math.random() * validEdges.length)];
      edgeIdx = edges.indexOf(edge);
      // Yellow/teal chance scales with hover intensity (20% at start, up to 50% at max)
      const hoveredNodeData = nodes[forceFromNode];
      const yellowChance = hoveredNodeData ? (0.20 + hoveredNodeData.hoverIntensity * 0.30) : 0.35;
      isYellow = Math.random() < yellowChance;
    } else {
      // Random edge for base pulses - 15% chance for teal
      edgeIdx = Math.floor(Math.random() * edges.length);
      isYellow = Math.random() < 0.15;
    }
    
    const baseSpeed = clamp(rand(PULSE_SPEED_MIN, PULSE_SPEED_MAX), PULSE_SPEED_MIN, PULSE_SPEED_MAX);
    const edge = edges[edgeIdx];
    const fromNode = nodes[edge.from];
    const toNode = nodes[edge.to];
    
    // Get source node for speed multiplier tracking
    const sourceNode = forceFromNode !== null ? forceFromNode : edge.from;
    const speedMultiplier = getNodePulseSpeed(sourceNode);
    const speed = baseSpeed * speedMultiplier;
    
    const baseBrightness = isYellow ? 70 : (50 + rand(-10, 10));
    
    pulses.push({
      edgeIdx,
      t: 0,
      speed: speed,
      baseSpeed: baseSpeed, // Store original speed for scaling
      hue: isYellow ? 180 : 0, // teal for special, 0 for black/grey
      baseBrightness: baseBrightness,
      currentBrightness: baseBrightness * fromNode.baseBrightness,
      fromNodeBrightness: fromNode.baseBrightness,
      toNodeBrightness: toNode.baseBrightness,
      isYellow,
      trailThickness: rand(0.4, 1.5), // Reduced to match smaller signals
      trail: [],
      fromHover: (forceFromNode !== null),
      alive: true,
      parking: false,
      parkTimer: 0,
      fadeOpacity: 1,
      isGhost: false,
      hasArrived: false,
      fadeTimer: 0,
      ghostX: 0,
      ghostY: 0,
      reverse: false,
      sourceNodeId: sourceNode
    });
    
    // Immediately activate the source node when pulse spawns
    if (!forceFromNode) { // Only for base pulses (hover already handled above)
      // All nodes get activation that will fade to zero
      if (fromNode.baseBrightness > 0.8) {
        // Bright nodes: set to low activation
        fromNode.activation = 0.2; // Will fade to zero
      } else {
        // Normal nodes get boost based on darkness
        const boost = 0.3 * (1 - fromNode.baseBrightness);
        fromNode.activation = Math.min(0.6, fromNode.activation + boost);
      }
    }
  }

  let baseSpawnTimer = 0;
  const BASE_SPAWN_RATE = 0.04; // Faster spawning (was 0.08)
  
  function ensureBasePulseCount(dt) {
    // Don't spawn pulses until animation has started
    if (!animationStarted) return;
    
    const basePulses = pulses.filter(p => !p.fromHover).length;
    const needed = BASE_PULSE_COUNT - basePulses;
    
    if (needed > 0 && dt) {
      baseSpawnTimer += dt;
      const spawnRate = BASE_SPAWN_RATE * (0.8 + Math.random() * 0.4);
      if (baseSpawnTimer >= spawnRate) {
        spawnPulse();
        baseSpawnTimer = 0;
      }
    } else if (!dt && needed > 0) {
      for (let i = 0; i < needed; i++) {
        spawnPulse();
      }
    }
  }

  // --------------------------------------------------
  // Mouse interaction
  // --------------------------------------------------

  function handleMouseMove(e) {
    // Don't allow hover interactions until animation started
    if (!animationStarted) return;
    
    const rect = canvas.getBoundingClientRect();
    const rawX = e.clientX - rect.left;
    const rawY = e.clientY - rect.top;
    
    // Use screenToWorld to get world coordinates
    const world = screenToWorld(rawX, rawY);
    mouseX = world.x;
    mouseY = world.y;
    
    let newHoveredNode = null;
    for (const node of nodes) {
      const dx = mouseX - node.x;
      const dy = mouseY - node.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < HOVER_RADIUS) {
        newHoveredNode = node.id;
        canvas.style.cursor = 'pointer';
        break;
      }
    }
    
    // Update USER hover (direct canvas interaction)
    if (newHoveredNode !== userHoveredNode) {
      userHoveredNode = newHoveredNode;
      
      // Reset hover timer for new node
      if (userHoveredNode !== null) {
        nodes[userHoveredNode].hoverTimer = 0;
        userHoverPulseTimer = 0;
      }
    }
    
    if (userHoveredNode === null) {
      canvas.style.cursor = 'default';
    }
  }

  canvas.addEventListener('mousemove', handleMouseMove);
  canvas.addEventListener('mouseleave', () => {
    mouseX = -1000;
    mouseY = -1000;
    userHoveredNode = null;  // Only clear user hover, not auto
    canvas.style.cursor = 'default';
  });
  
  
  
  // Function to animate zoom to target value
  function animateZoomTo(targetZoom, scrollTriggered = false) {
    // Brain center screen position (at 30% of screen width due to offset)
    const brainScreenX = width * 0.3;
    const brainScreenY = height / 2;
    
    // Use screenToWorld to correctly account for brain offset and scale
    const worldPos = screenToWorld(brainScreenX, brainScreenY);
    zoomFixedWorldX = worldPos.x;
    zoomFixedWorldY = worldPos.y;
    zoomFixedScreenX = brainScreenX;
    zoomFixedScreenY = brainScreenY;
    
    zoomAnimating = true;
    zoomStartTime = performance.now();
    zoomStartValue = camera.zoom;
    zoomTargetValue = targetZoom;
    isScrollZoom = scrollTriggered;
    zoomCallbackFired = false;
  }
  
  // Make it globally accessible
  window.animateZoomTo = animateZoomTo;
  
  // Pan with click and drag
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) {
      isDragging = true;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      dragStartCamX = camera.x;
      dragStartCamY = camera.y;
      canvas.style.cursor = 'grabbing';
    }
  });
  
  canvas.addEventListener('mousemove', (e) => {
    if (isDragging) {
      camera.x = dragStartCamX - (e.clientX - dragStartX) / camera.zoom;
      camera.y = dragStartCamY - (e.clientY - dragStartY) / camera.zoom;
    }
  });
  
  canvas.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      canvas.style.cursor = userHoveredNode !== null ? 'pointer' : 'default';
      // iPhone-style: rubber band back to original position after drag
      setTimeout(() => {
        if (!isDragging && !camPanAnimating) {
          panBackToOriginal(400);
        }
      }, 150);
    }
  });
  
  canvas.addEventListener('mouseleave', () => {
    if (isDragging) {
      isDragging = false;
      // iPhone-style: rubber band back after drag ends
      setTimeout(() => {
        if (!isDragging && !camPanAnimating) {
          panBackToOriginal(400);
        }
      }, 150);
    }
  });

  // --------------------------------------------------
  // Drawing
  // --------------------------------------------------

  function drawBackground() {
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    
    if (darkMode) {
      // Dark mode gradient background
      const grad = ctx.createRadialGradient(width/2, height/2, 0, width/2, height/2, Math.max(width, height) * 0.7);
      grad.addColorStop(0, "#2a2a2a");
      grad.addColorStop(0.5, "#252525");
      grad.addColorStop(1, "#1a1a1a");
      ctx.fillStyle = grad;
    } else {
      ctx.fillStyle = "#ffffff";
    }
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }

  function drawParticles(dt) {
    const perf = getPerfFeatures();
    if (!perf.particles) return; // Skip particles in low perf modes
    
    ctx.save();
    ctx.globalCompositeOperation = "source-over";

    for (const p of particles) {
      p.x += p.vx * dt * 60;
      p.y += p.vy * dt * 60;
      p.phase += dt * 0.5;

      if (p.y < -20) {
        p.y = height + 10;
        p.x = Math.random() * width;
      }
      if (p.x < -20) p.x = width + 10;
      if (p.x > width + 20) p.x = -10;

      const twinkle = 0.3 + Math.sin(p.phase) * 0.2;
      const a = p.alpha * twinkle;
      
      if (a < 0.02) continue;

      ctx.beginPath();
      ctx.fillStyle = darkMode ? `rgba(140, 140, 140, ${a})` : `rgba(60, 60, 60, ${a})`;
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  function drawEdges() {
    if (!edges.length) return;
    ctx.save();

    ctx.globalCompositeOperation = "source-over";
    
    // Check if we're in transition mode (brain moving/scaling)
    const inTransition = isInTransition();

    for (const edge of edges) {
      const from = nodes[edge.from];
      const to = nodes[edge.to];
      
      // Transform to screen coordinates
      const fromScreen = worldToScreen(from.x, from.y);
      const toScreen = worldToScreen(to.x, to.y);

      // Faster culling with larger margin during transitions
      const margin = inTransition ? 100 : 200;
      if ((fromScreen.x < -margin || fromScreen.x > width + margin || fromScreen.y < -margin || fromScreen.y > height + margin) &&
          (toScreen.x < -margin || toScreen.x > width + margin || toScreen.y < -margin || toScreen.y > height + margin)) {
        continue;
      }

      // Skip hover calculations during transitions
      if (!inTransition) {
        // Update target hover boost - check BOTH user and auto hover
        const isUserHoverEdge = userHoveredNode !== null && (edge.from === userHoveredNode || edge.to === userHoveredNode);
        const isAutoHoverEdge = autoHoveredNode !== null && (edge.from === autoHoveredNode || edge.to === autoHoveredNode);
        
        if (isUserHoverEdge || isAutoHoverEdge) {
          // Use the higher intensity from either stream
          let maxIntensity = 0;
          if (isUserHoverEdge && nodes[userHoveredNode]) {
            maxIntensity = Math.max(maxIntensity, nodes[userHoveredNode].hoverIntensity);
          }
          if (isAutoHoverEdge && nodes[autoHoveredNode]) {
            maxIntensity = Math.max(maxIntensity, nodes[autoHoveredNode].hoverIntensity);
          }
          edge.targetHoverBoost = maxIntensity * edge.hoverBoostFactor;
        } else {
          edge.targetHoverBoost = 0;
        }
        
        // Smoothly interpolate hover boost
        const boostDiff = edge.targetHoverBoost - edge.hoverBoost;
        if (Math.abs(boostDiff) > 0.001) {
          if (boostDiff > 0) {
            edge.hoverBoost += boostDiff * 0.15;
          } else {
            edge.hoverBoost *= 0.95;
          }
        } else {
          edge.hoverBoost = edge.targetHoverBoost;
        }
      }

      const opacity = edge.baseOpacity + (inTransition ? 0 : edge.hoverBoost);
      
      ctx.beginPath();
      ctx.strokeStyle = darkMode ? `rgba(120, 120, 120, ${opacity})` : `rgba(20, 20, 20, ${opacity})`;
      ctx.lineWidth = inTransition ? 0.6 : (0.8 + edge.hoverBoost * 0.5);
      ctx.moveTo(fromScreen.x, fromScreen.y);
      
      // Always use curves (straight lines during transitions caused visible "jumping")
        const ctrlScreen = worldToScreen(edge.cx, edge.cy);
        ctx.quadraticCurveTo(ctrlScreen.x, ctrlScreen.y, toScreen.x, toScreen.y);
      ctx.stroke();

      // Localized glow - skip during transitions, when zoomed out, or low perf
      if (!inTransition) {
        const perf = getPerfFeatures();
        if (perf.edgeGlow && camera.zoom >= 1.5 && edge.pulsePositions.length > 0) {
          ctx.save();
          ctx.globalCompositeOperation = "source-over";
          
          edge.pulsePositions.forEach(pulseInfo => {
            const { pos, isYellow, brightness } = pulseInfo;
            if (brightness < 5) return;
            
            const posScreen = worldToScreen(pos.x, pos.y);
            
            for (let i = 0; i < edge.curvePoints.length - 1; i++) {
              const pt1 = worldToScreen(edge.curvePoints[i].x, edge.curvePoints[i].y);
              const pt2 = worldToScreen(edge.curvePoints[i + 1].x, edge.curvePoints[i + 1].y);
              
              const dx = pt1.x - posScreen.x;
              const dy = pt1.y - posScreen.y;
              const dist = Math.sqrt(dx * dx + dy * dy);
              
              if (dist < GLOW_RADIUS) {
                const normalizedDist = dist / GLOW_RADIUS;
                const intensity = Math.pow(1 - normalizedDist, 2) * (brightness / 75);
                
                ctx.beginPath();
                if (isYellow) {
                  ctx.strokeStyle = darkMode ? `rgba(50, 255, 100, ${intensity * 0.5})` : `rgba(0, 220, 220, ${intensity * 0.35})`;
                } else {
                  ctx.strokeStyle = darkMode ? `rgba(180, 180, 180, ${intensity * 0.3})` : `rgba(30, 30, 30, ${intensity * 0.18})`;
                }
                ctx.lineWidth = 0.5 + intensity * 1.2;
                ctx.lineCap = 'round';
                ctx.moveTo(pt1.x, pt1.y);
                ctx.lineTo(pt2.x, pt2.y);
                ctx.stroke();
              }
            }
          });
          ctx.restore();
        }
      }
    }

    ctx.restore();
  }

  function drawNodes() {
    if (!nodes.length) return;
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    
    const perf = getPerfFeatures();
    const inTransition = isInTransition();
    
    // Force simple mode during transitions for smoother animation
    const useGradients = inTransition ? false : perf.nodeGradients;
    const useHoverGlow = inTransition ? false : perf.hoverGlow;

    for (const node of nodes) {
      // Transform to screen coordinates
      const screen = worldToScreen(node.x, node.y);
      
      // Larger margin during transitions for faster culling
      const margin = inTransition ? 50 : 100;
      if (screen.x < -margin || screen.x > width + margin || 
          screen.y < -margin || screen.y > height + margin) {
        continue;
      }

      const act = inTransition ? 0 : clamp(node.activation, 0, 1);
      const brightness = node.baseBrightness;
      const r = node.baseR + (inTransition ? 0 : act * 1.5 + (useHoverGlow ? node.hoverIntensity * 2 : 0));
      
      // Check if this node is being hovered (either by user or auto)
      const isHovered = node.id === userHoveredNode || node.id === autoHoveredNode;

      if (darkMode) {
        // Dark mode - simplified at zoom out OR in low perf mode
        const isZoomedOut = camera.zoom < 2;
        const useSimpleMode = isZoomedOut || !useGradients;
        
        if (useSimpleMode) {
          // Simple ring only when zoomed out or low perf
          const ringAlpha = brightness * 0.3 + act * 0.2;
          const ringColor = (node.yellowActivation > 0.1 && !isHovered) ? 
            `rgba(50, 255, 100, ${ringAlpha})` :
            `rgba(140, 140, 140, ${ringAlpha})`;
          ctx.beginPath();
          ctx.strokeStyle = ringColor;
          ctx.lineWidth = 0.5 + act * 0.2;
          ctx.arc(screen.x, screen.y, node.baseR * 0.8, 0, Math.PI * 2);
          ctx.stroke();
        } else {
          // Full graphics when zoomed in and high perf
          if (act > 0.05 || brightness > 0.2) {
            const expansionFactor = 1 + act * 0.03;
            const glowRadius = r * 1.5 * expansionFactor;
            const grad = ctx.createRadialGradient(
              screen.x, screen.y, 0,
              screen.x, screen.y, glowRadius
            );
            
            const glowIntensity = brightness * 0.12 + act * 0.08;
            
            if (node.yellowActivation > 0.1 && !isHovered) {
              grad.addColorStop(0, `rgba(50, 255, 100, ${glowIntensity * node.yellowActivation})`);
              grad.addColorStop(0.5, `rgba(30, 200, 70, ${glowIntensity * node.yellowActivation * 0.4})`);
              grad.addColorStop(1, `rgba(20, 150, 50, 0)`);
            } else {
              const greyValue = 130;
              grad.addColorStop(0, `rgba(${greyValue}, ${greyValue}, ${greyValue}, ${glowIntensity})`);
              grad.addColorStop(0.5, `rgba(${greyValue * 0.7}, ${greyValue * 0.7}, ${greyValue * 0.7}, ${glowIntensity * 0.4})`);
              grad.addColorStop(1, `rgba(${greyValue * 0.5}, ${greyValue * 0.5}, ${greyValue * 0.5}, 0)`);
            }

            ctx.beginPath();
            ctx.fillStyle = grad;
            ctx.arc(screen.x, screen.y, glowRadius, 0, Math.PI * 2);
            ctx.fill();
          }
          
          // Hover glow - reduced (skip in low perf)
          if (useHoverGlow && node.hoverIntensity > 0.01) {
            const hoverGlowRadius = r * 2.5;
            const hoverGrad = ctx.createRadialGradient(
              screen.x, screen.y, 0,
              screen.x, screen.y, hoverGlowRadius
            );
            const hoverGlowIntensity = node.hoverIntensity * 0.12;
            
            hoverGrad.addColorStop(0, `rgba(160, 160, 160, ${hoverGlowIntensity})`);
            hoverGrad.addColorStop(0.5, `rgba(120, 120, 120, ${hoverGlowIntensity * 0.4})`);
            hoverGrad.addColorStop(1, `rgba(80, 80, 80, 0)`);
            
            ctx.beginPath();
            ctx.fillStyle = hoverGrad;
            ctx.arc(screen.x, screen.y, hoverGlowRadius, 0, Math.PI * 2);
            ctx.fill();
          }

          // Ring
          const ringColor = (node.yellowActivation > 0.1 && !isHovered) ? 
            `rgba(50, 255, 100, ${brightness * 0.15 + act * 0.25})` :
            `rgba(140, 140, 140, ${brightness * 0.15 + act * 0.25 + (useHoverGlow ? node.hoverIntensity * 0.25 : 0)})`;
          ctx.beginPath();
          ctx.strokeStyle = ringColor;
          ctx.lineWidth = 0.5 + brightness * 0.15 + act * 0.15;
          ctx.arc(screen.x, screen.y, node.baseR * 0.85, 0, Math.PI * 2);
          ctx.stroke();
        }
        
      } else {
        // Light mode
        const useSimpleMode = !useGradients;
        
        if (useSimpleMode) {
          // Simple mode for low perf - just ring
          const ringAlpha = brightness * 0.2 + act * 0.3;
          ctx.beginPath();
          ctx.strokeStyle = `rgba(2, 2, 2, ${ringAlpha})`;
          ctx.lineWidth = 0.7 + brightness * 0.2 + act * 0.2;
          ctx.arc(screen.x, screen.y, node.baseR, 0, Math.PI * 2);
          ctx.stroke();
        } else {
          // Full mode - original style
          if (act > 0.05 || brightness > 0.2) {
            const expansionFactor = 1 + act * 0.05;
            const glowRadius = r * 2.0 * expansionFactor;
            const grad = ctx.createRadialGradient(
              screen.x, screen.y, 0,
              screen.x, screen.y, glowRadius
            );
            
            const glowIntensity = brightness * 0.15 + act * 0.1;
            const neonIntensity = act > 0.3 ? 1.1 : 1.0;
            const greyValue = 50;
            
            grad.addColorStop(0, `rgba(${greyValue}, ${greyValue}, ${greyValue}, ${glowIntensity * neonIntensity})`);
            grad.addColorStop(0.5, `rgba(${greyValue * 0.8}, ${greyValue * 0.8}, ${greyValue * 0.8}, ${glowIntensity * neonIntensity * 0.5})`);
            grad.addColorStop(1, `rgba(${greyValue * 0.6}, ${greyValue * 0.6}, ${greyValue * 0.6}, 0)`);

            ctx.beginPath();
            ctx.fillStyle = grad;
            ctx.arc(screen.x, screen.y, glowRadius, 0, Math.PI * 2);
            ctx.fill();
          }
          
          if (useHoverGlow && node.hoverIntensity > 0.01) {
            const hoverGlowRadius = r * 3;
            const hoverGrad = ctx.createRadialGradient(
              screen.x, screen.y, 0,
              screen.x, screen.y, hoverGlowRadius
            );
            const hoverGlowIntensity = node.hoverIntensity * 0.15;
            
            hoverGrad.addColorStop(0, `rgba(80, 80, 80, ${hoverGlowIntensity})`);
            hoverGrad.addColorStop(0.5, `rgba(60, 60, 60, ${hoverGlowIntensity * 0.5})`);
            hoverGrad.addColorStop(1, `rgba(40, 40, 40, 0)`);
            
            ctx.beginPath();
            ctx.fillStyle = hoverGrad;
            ctx.arc(screen.x, screen.y, hoverGlowRadius, 0, Math.PI * 2);
            ctx.fill();
          }

          ctx.beginPath();
          ctx.fillStyle = `rgba(240, 240, 240, 0.2)`;
          ctx.arc(screen.x, screen.y, node.baseR * 0.8, 0, Math.PI * 2);
          ctx.fill();

          const ringColor = `rgba(2, 2, 2, ${brightness * 0.2 + act * 0.3})`;
          ctx.beginPath();
          ctx.strokeStyle = ringColor;
          ctx.lineWidth = 0.7 + brightness * 0.2 + act * 0.2;
          ctx.arc(screen.x, screen.y, node.baseR, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    }

    ctx.restore();
  }

  function drawPulses(dt) {
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    
    const perf = getPerfFeatures();
    const maxTrailLength = perf.trailLength;

    for (const edge of edges) {
      edge.pulsePositions = [];
    }

    const pulsesToRemove = [];
    
    // Limit pulse count in low perf modes - cull excess BASE pulses only
    // Cascade and hover pulses are protected to allow full propagation
    if (pulses.length > perf.maxPulses) {
      // Remove oldest non-protected pulses first (base pulses only)
      const excess = pulses.length - perf.maxPulses;
      let removed = 0;
      for (let i = 0; i < pulses.length && removed < excess; i++) {
        const p = pulses[i];
        // Only cull pulses that are: not ghost, not from hover, not cascade
        if (!p.isGhost && !p.fromHover && !p.isCascade) {
          pulsesToRemove.push(i);
          removed++;
        }
      }
    }

    for (let idx = 0; idx < pulses.length; idx++) {
      const pulse = pulses[idx];
      const edge = edges[pulse.edgeIdx];
      if (!edge) {
        pulsesToRemove.push(idx);
        continue;
      }

      const from = pulse.reverse ? nodes[edge.to] : nodes[edge.from];
      const to = pulse.reverse ? nodes[edge.from] : nodes[edge.to];

      // Handle ghost pulses
      if (pulse.isGhost) {
        pulse.fadeTimer += dt;
        pulse.fadeOpacity = Math.max(0, 1 - pulse.fadeTimer / 1.5);
        
        if (pulse.fadeOpacity <= 0) {
          pulsesToRemove.push(idx);
          continue;
        }
      } else {
        pulse.t += pulse.speed * dt / Math.sqrt(camera.zoom);
      }

      const t = clamp(pulse.t, 0, 1);
      const pos = pulse.isGhost ? 
        { x: pulse.ghostX, y: pulse.ghostY } :
        quadraticPoint(t, 
          { x: from.x, y: from.y },
          { x: edge.cx, y: edge.cy },
          { x: to.x, y: to.y }
        );

      // Add to trail
      if (!pulse.isGhost) {
        pulse.trail.push({ x: pos.x, y: pos.y, brightness: pulse.currentBrightness });
        
        // Add to edge glow positions
        edge.pulsePositions.push({ 
          pos: pos, 
          isYellow: pulse.isYellow, 
          brightness: pulse.currentBrightness 
        });
      }

      // Create ghost when pulse arrives
      if (pulse.t >= 1 && !pulse.hasArrived && !pulse.isGhost) {
        pulse.hasArrived = true;
        
        // Get the actual destination node index (accounting for reverse)
        const toNodeIdx = pulse.reverse ? edge.from : edge.to;
        
        // Call pulse arrival callback if set
        if (window.onPulseArrived) {
          window.onPulseArrived(toNodeIdx, pulse.sourceNodeId);
        }
        
        // Activate destination node
        if (to.baseBrightness > 0.8) {
          to.activation = Math.min(to.activation + 0.2, 0.4);
        } else {
          const boost = 0.3 * (1 - to.baseBrightness);
          to.activation = Math.min(0.6, to.activation + boost);
        }
        
        const ghostPulse = {
          edgeIdx: pulse.edgeIdx,
          t: 1,
          speed: 0,
          isGhost: true,
          ghostX: to.x,
          ghostY: to.y,
          fadeTimer: 0,
          fadeOpacity: 1,
          trail: [],
          isYellow: pulse.isYellow,
          currentBrightness: pulse.currentBrightness * 1.4,
          trailThickness: pulse.trailThickness,
          hasArrived: true,
          reverse: pulse.reverse || false
        };
        pulses.push(ghostPulse);
        
        // CASCADE: 90% chance to fire a downstream signal
        // BUT skip if the source node has cascade blocking (completed loading)
        const sourceNodeBlocked = pulse.sourceNodeId !== undefined && isCascadeBlocked(pulse.sourceNodeId);
        if (!sourceNodeBlocked && Math.random() < 0.9) {
          // Find outgoing edges from this node (excluding the one we came from)
          const outgoingEdges = edges.map((e, idx) => ({ edge: e, idx }))
            .filter(({ edge, idx }) => 
              (edge.from === toNodeIdx || edge.to === toNodeIdx) && 
              idx !== pulse.edgeIdx
            );
          
          if (outgoingEdges.length > 0) {
            const chosen = outgoingEdges[Math.floor(Math.random() * outgoingEdges.length)];
            const newEdge = chosen.edge;
            const reverse = newEdge.to === toNodeIdx; // Need to go other direction
            
            const fromNode = reverse ? nodes[newEdge.to] : nodes[newEdge.from];
            const toNode = reverse ? nodes[newEdge.from] : nodes[newEdge.to];
            
            // Spawn cascade pulse after small delay (via slightly negative t)
            const cascadePulse = {
              edgeIdx: chosen.idx,
              t: -0.1 - Math.random() * 0.2, // Small delay
              speed: rand(PULSE_SPEED_MIN, PULSE_SPEED_MAX),
              isGhost: false,
              ghostX: 0,
              ghostY: 0,
              fadeTimer: 0,
              fadeOpacity: 1,
              trail: [],
              isYellow: pulse.isYellow && Math.random() < 0.5, // 50% chance to keep yellow
              currentBrightness: pulse.currentBrightness * 0.8, // Slightly dimmer
              trailThickness: rand(0.4, 1.2),
              hasArrived: false,
              reverse: reverse,
              sourceNodeId: pulse.sourceNodeId, // Inherit source for cascade blocking
              fromHover: pulse.fromHover, // Inherit hover status to protect from culling
              isCascade: true // Mark as cascade pulse
            };
            pulses.push(cascadePulse);
          }
        }
        
        pulsesToRemove.push(idx);
        continue;
      }
      
      // Maintain trail length (use perf-based length)
      const effectiveTrailLength = maxTrailLength > 0 ? maxTrailLength : 1;
      while (pulse.trail.length > effectiveTrailLength) {
        pulse.trail.shift();
      }

      // Transform position to screen
      const posScreen = worldToScreen(pos.x, pos.y);

      // Draw trail - skip when zoomed out or low perf for performance
      if (maxTrailLength > 0 && camera.zoom >= 1.5 && !pulse.isGhost && pulse.trail.length > 1) {
        for (let i = 0; i < pulse.trail.length - 1; i++) {
          const trailPos = pulse.trail[i];
          const nextPos = pulse.trail[i + 1];
          
          const trailScreen = worldToScreen(trailPos.x, trailPos.y);
          const nextScreen = worldToScreen(nextPos.x, nextPos.y);
          
          const progress = i / pulse.trail.length;
          const trailAlpha = progress * progress * 0.25 * Math.max(0.05, trailPos.brightness / 100);
          const trailZoomScale = Math.min(1, camera.zoom / 3);
          const trailWidth = pulse.trailThickness * progress * 0.7 * (0.5 + trailZoomScale * 0.5);
          
          ctx.beginPath();
          if (pulse.isYellow) {
            if (darkMode) {
              const greenIntensity = 255;
              ctx.strokeStyle = `rgba(${greenIntensity * 0.3}, ${greenIntensity}, ${greenIntensity * 0.5}, ${trailAlpha})`;
            } else {
              ctx.strokeStyle = `rgba(0, 180, 180, ${trailAlpha})`;
            }
          } else {
            if (darkMode) {
              const greyValue = 160;
              ctx.strokeStyle = `rgba(${greyValue}, ${greyValue}, ${greyValue}, ${trailAlpha})`;
            } else {
              ctx.strokeStyle = `rgba(50, 50, 50, ${trailAlpha})`;
            }
          }
          ctx.lineWidth = trailWidth;
          ctx.lineCap = 'round';
          ctx.moveTo(trailScreen.x, trailScreen.y);
          ctx.lineTo(nextScreen.x, nextScreen.y);
          ctx.stroke();
        }
      }

      // Activate source node at start
      if (!pulse.isGhost && t > 0 && t < 0.25) {
        const fadeFactor = Math.max(0, 1 - t * 4);
        const relativeFactor = 1 - from.activation * 0.8;
        const startBoost = 0.02 * fadeFactor * relativeFactor * dt * 60;
        from.activation = Math.min(0.6, from.activation + startBoost);
      }

      // Draw pulse head (ghosts and active pulses)
      if (pulse.isGhost || (pulse.t <= 1 && !pulse.hasArrived)) {
        // Scale radius relative to zoom (smaller when zoomed out)
        const zoomScale = Math.min(1, camera.zoom / 3);
        let radius;
        if (pulse.isGhost) {
          const pulseScale = 1.05 + Math.sin(pulse.fadeTimer * 3) * 0.08;
          radius = (1.2 + zoomScale * 0.7) * pulseScale;
        } else {
          radius = 0.8 + zoomScale * 0.6;
        }
        const adaptiveBrightness = Math.max(30, pulse.currentBrightness);
        const fadeMultiplier = pulse.fadeOpacity || 1;
        
        // Outer glow
        const glowGrad = ctx.createRadialGradient(
          posScreen.x, posScreen.y, 0, 
          posScreen.x, posScreen.y, radius * 2.8
        );
        const glowAlpha = pulse.isGhost ? 
          0.7 * (pulse.currentBrightness / 70) * fadeMultiplier :
          0.5 * (pulse.currentBrightness / 70) * fadeMultiplier;
          
        if (pulse.isYellow) {
          if (darkMode) {
            glowGrad.addColorStop(0, `rgba(50, 255, 100, ${glowAlpha})`);
            glowGrad.addColorStop(0.3, `rgba(30, 200, 70, ${glowAlpha * 0.4})`);
            glowGrad.addColorStop(1, `rgba(20, 150, 50, 0)`);
          } else {
            glowGrad.addColorStop(0, `rgba(0, ${200 + adaptiveBrightness}, ${200 + adaptiveBrightness}, ${glowAlpha})`);
            glowGrad.addColorStop(0.3, `rgba(0, ${180 + adaptiveBrightness}, ${180 + adaptiveBrightness}, ${glowAlpha * 0.4})`);
            glowGrad.addColorStop(1, `rgba(0, 150, 150, 0)`);
          }
        } else {
          if (darkMode) {
            const greyBase = 140 + adaptiveBrightness * 0.5;
            glowGrad.addColorStop(0, `rgba(${greyBase}, ${greyBase}, ${greyBase}, ${glowAlpha})`);
            glowGrad.addColorStop(0.3, `rgba(${greyBase - 20}, ${greyBase - 20}, ${greyBase - 20}, ${glowAlpha * 0.4})`);
            glowGrad.addColorStop(1, `rgba(80, 80, 80, 0)`);
          } else {
            const greyBase = 20 + adaptiveBrightness * 0.5;
            glowGrad.addColorStop(0, `rgba(${greyBase}, ${greyBase}, ${greyBase}, ${glowAlpha})`);
            glowGrad.addColorStop(0.3, `rgba(${greyBase - 10}, ${greyBase - 10}, ${greyBase - 10}, ${glowAlpha * 0.4})`);
            glowGrad.addColorStop(1, `rgba(10, 10, 10, 0)`);
          }
        }
        
        ctx.beginPath();
        ctx.fillStyle = glowGrad;
        ctx.arc(posScreen.x, posScreen.y, radius * 2.8, 0, Math.PI * 2);
        ctx.fill();

        // Core
        ctx.beginPath();
        if (pulse.isYellow) {
          const coreAlpha = pulse.isGhost ? 0.95 : 0.75;
          if (darkMode) {
            ctx.fillStyle = `rgba(50, 255, 100, ${coreAlpha * (pulse.currentBrightness / 70) * fadeMultiplier})`;
          } else {
            ctx.fillStyle = `rgba(0, ${220 + adaptiveBrightness}, ${220 + adaptiveBrightness}, ${coreAlpha * (pulse.currentBrightness / 70) * fadeMultiplier})`;
          }
        } else {
          const coreAlpha = pulse.isGhost ? 0.9 : 0.65;
          if (darkMode) {
            const coreGrey = Math.min(200, 140 + adaptiveBrightness * 0.7);
            ctx.fillStyle = `rgba(${coreGrey}, ${coreGrey}, ${coreGrey}, ${coreAlpha * (pulse.currentBrightness / 70) * fadeMultiplier})`;
          } else {
            const greyCore = Math.min(75, 35 + adaptiveBrightness * 0.7);
            ctx.fillStyle = `rgba(${greyCore}, ${greyCore}, ${greyCore}, ${coreAlpha * (pulse.currentBrightness / 70) * fadeMultiplier})`;
          }
        }
        ctx.arc(posScreen.x, posScreen.y, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    
    // Remove dead pulses
    for (let i = pulsesToRemove.length - 1; i >= 0; i--) {
      pulses.splice(pulsesToRemove[i], 1);
    }

    ctx.restore();
  }

  // --------------------------------------------------
  // Simulation
  // --------------------------------------------------

  function step(dt) {
    const nodeDecay = Math.pow(0.96, dt * 60); // Faster fade to zero

    for (const node of nodes) {
      // Fade to 0 for bright nodes (multiply effect), to original for others
      if (node.baseBrightness > 0.8) {
        node.activation *= Math.pow(0.88, dt * 60); // Much faster fade for bright nodes
      } else {
        node.activation *= nodeDecay; // Faster decay for others too
      }
      node.yellowActivation *= Math.pow(0.94, dt * 60); // Faster decay
      node.blueActivation *= Math.pow(0.95, dt * 60); // Faster decay
      
      // Update hover intensity per node - check BOTH streams
      const isUserHovered = node.id === userHoveredNode;
      const isAutoHovered = node.id === autoHoveredNode;
      
      if (isUserHovered || isAutoHovered) {
        node.hoverTimer += dt;
        node.hoverIntensity = Math.min(MAX_HOVER_INTENSITY, node.hoverTimer * GLOW_RAMP_SPEED);
      } else {
        // Decay in ~3 seconds to match pulse effects
        node.hoverIntensity *= Math.pow(0.96, dt * 60); // Faster decay
        if (node.hoverIntensity < 0.01) {
          node.hoverIntensity = 0;
          node.hoverTimer = 0;
        }
      }
    }
    
    const perf = getPerfFeatures();
    
    // Spawn extra pulses for USER hovered node (skip in low perf)
    if (perf.hoverGlow && userHoveredNode !== null) {
      const hoveredNodeData = nodes[userHoveredNode];
      if (hoveredNodeData) {
        const intensity = hoveredNodeData.hoverIntensity;
        
        // Zoomed in = slower base rate, zoomed out = faster
        const isZoomedIn = camera.zoom > 2;
        const baseRate = isZoomedIn ? 0.06 : 0.025;
        
        // Scale spawn rate with intensity (slower in medium perf)
        const perfSpawnMult = (perfTier === 'MEDIUM') ? 1.5 : 1.0;
        const dynamicSpawnRate = (baseRate + (1 - intensity) * 0.06) * perfSpawnMult;
        
        userHoverPulseTimer += dt;
        if (userHoverPulseTimer > dynamicSpawnRate) {
          userHoverPulseTimer = 0;
          spawnPulse(userHoveredNode);
        }
      }
    }
    
    // Spawn extra pulses for AUTO hovered node (separate stream)
    if (perf.hoverGlow && autoHoveredNode !== null) {
      const hoveredNodeData = nodes[autoHoveredNode];
      if (hoveredNodeData) {
        const intensity = hoveredNodeData.hoverIntensity;
        
        // Auto-hover has a slower pulse rate
        const baseRate = 0.08;
        const perfSpawnMult = (perfTier === 'MEDIUM') ? 1.5 : 1.0;
        const dynamicSpawnRate = (baseRate + (1 - intensity) * 0.04) * perfSpawnMult;
        
        autoHoverPulseTimer += dt;
        if (autoHoverPulseTimer > dynamicSpawnRate) {
          autoHoverPulseTimer = 0;
          spawnPulse(autoHoveredNode);
        }
      }
    }
    
    // Maintain base pulse count for the rest of the system
    ensureBasePulseCount(dt);
  }

  // --------------------------------------------------
  // Animation loop
  // --------------------------------------------------

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }
  
  // Smooth start and end - gentler at beginning
  function easeInOutCubic(t) {
    return t < 0.5 
      ? 4 * t * t * t 
      : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }
  
  // iPhone-style zoom easing - snappy
  function easeOutQuad(t) {
    return 1 - (1 - t) * (1 - t);
  }
  
  // Fast start, slow end (aggressive deceleration in final 10%)
  function easeOutQuint(t) {
    return 1 - Math.pow(1 - t, 5);
  }

  function loop(timestamp) {
    if (!lastTime) lastTime = timestamp;
    const dt = Math.min(0.016, (timestamp - lastTime) / 1000); // Cap at ~60fps worth of dt
    lastTime = timestamp;
    
    // Don't render until view is initialized (prevents jump from default to target view)
    if (!viewInitialized) {
      requestAnimationFrame(loop);
      return;
    }
    
    // Update performance monitoring
    updatePerformanceTier(dt);
    
    // Animate brain opacity (fade in - 400ms fast fade)
    if (brainOpacity < brainTargetOpacity) {
      brainOpacity = Math.min(brainTargetOpacity, brainOpacity + dt * 2.5);
    }
    
    // Animate camera zoom smoothly
    if (zoomAnimating) {
      const elapsed = timestamp - zoomStartTime;
      const progress = Math.min(1, elapsed / zoomDuration);
      
      // Use easeInOutCubic for scroll zoom - gentle start, smooth throughout
      const easedProgress = isScrollZoom ? easeInOutCubic(progress) : easeOutCubic(progress);
      
      camera.zoom = zoomStartValue + (zoomTargetValue - zoomStartValue) * easedProgress;
      
      // Camera position handling:
      // - If screenPosAnimating: interpolate screen position, compute camera from that
      // - If camPanAnimating: let pan animation control camera
      // - Otherwise: use fixed-point formula (pinch/wheel zoom)
      if (screenPosAnimating) {
        // Interpolate desired screen position
        const screenPosElapsed = timestamp - screenPosStartTime;
        const screenPosProgress = Math.min(1, screenPosElapsed / screenPosDuration);
        const screenPosEased = easeInOutCubic(screenPosProgress);
        
        const currentScreenX = screenPosStartX + (screenPosTargetX - screenPosStartX) * screenPosEased;
        const currentScreenY = screenPosStartY + (screenPosTargetY - screenPosStartY) * screenPosEased;
        
        // Calculate camera position to achieve this screen position
        // screenX = width/2 + (brainOffsetX - camera.x) * zoom
        // camera.x = brainOffsetX - (screenX - width/2) / zoom
        camera.x = brainOffsetX - (currentScreenX - width/2) / camera.zoom;
        camera.y = -(currentScreenY - height/2) / camera.zoom;
        
        if (screenPosProgress >= 1) {
          screenPosAnimating = false;
        }
      } else if (!camPanAnimating) {
        const screenCenterX = width / 2;
        const screenCenterY = height / 2;
        camera.x = brainOffsetX + (zoomFixedWorldX - screenCenterX) * brainScaleAnim - (zoomFixedScreenX - screenCenterX) / camera.zoom;
        camera.y = (zoomFixedWorldY - screenCenterY) * brainScaleAnim - (zoomFixedScreenY - screenCenterY) / camera.zoom;
      }
      // If camPanAnimating is true, camera position is handled by the pan animation below
      
      if (progress >= 1) {
        zoomAnimating = false;
        camera.zoom = zoomTargetValue;
        
        // Fire callback after zoom completes
        if (isScrollZoom && !zoomCallbackFired) {
          zoomCallbackFired = true;
          setTimeout(() => {
            if (window.onZoomComplete) {
              window.onZoomComplete();
            }
          }, 50);
        }
      }
    }
    
    // Animate brain offset with easeInOutCubic (smooth start and end)
    if (brainMoveStartTime > 0 && brainOffsetX !== brainTargetOffsetX) {
      const elapsed = timestamp - brainMoveStartTime;
      const progress = Math.min(1, elapsed / brainMoveDuration);
      const easedProgress = easeInOutCubic(progress);
      brainOffsetX = brainMoveStartX + (brainTargetOffsetX - brainMoveStartX) * easedProgress;
      
      if (progress >= 1) {
        brainOffsetX = brainTargetOffsetX;
        brainMoveStartTime = 0;
      }
    }
    
    // Animate brain scale with easeInOutCubic (smooth start and end)
    if (brainScaleStartTime > 0 && brainScaleAnim !== brainTargetScale) {
      const elapsed = timestamp - brainScaleStartTime;
      const progress = Math.min(1, elapsed / brainMoveDuration);
      const easedProgress = easeInOutCubic(progress);
      brainScaleAnim = brainScaleStartValue + (brainTargetScale - brainScaleStartValue) * easedProgress;
      
      if (progress >= 1) {
        brainScaleAnim = brainTargetScale;
        brainScaleStartTime = 0;
      }
    }
    
    // Animate camera pan (for Views 4, 5, 6 and rubber band)
    if (camPanAnimating) {
      const elapsed = timestamp - camPanStartTime;
      const progress = Math.min(1, elapsed / camPanDuration);
      const easedProgress = easeInOutCubic(progress);
      
      camera.x = camPanStartX + (camPanTargetX - camPanStartX) * easedProgress;
      camera.y = camPanStartY + (camPanTargetY - camPanStartY) * easedProgress;
      
      if (progress >= 1) {
        camPanAnimating = false;
        camera.x = camPanTargetX;
        camera.y = camPanTargetY;
      }
    }
    
    // Update transform cache once per frame
    updateTransformCache();

    drawBackground();
    step(dt);
    
    // Skip particles during transitions for better performance
    if (!isInTransition()) {
      drawParticles(dt);
    }
    
    // Apply brain opacity only - transforms handled by worldToScreen
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.globalAlpha = brainOpacity;
    
    drawEdges();
    drawNodes();
    drawPulses(dt);
    ctx.restore();
    
    // Debug overlay (if enabled)
    drawPerfDebug();

    requestAnimationFrame(loop);
  }
  
  // =====================================================
  // SINGLE SOURCE OF TRUTH - VIEW STATES
  // =====================================================
  // All view parameters defined here. Any animation between views
  // should read from this table, not use hardcoded values.
  //
  // brainOffset: multiplied by window width for responsive positioning
  // brainScale: scale factor for the brain (1.0 = full size, 0.85 = shrunk)
  // zoom: camera zoom level (1.0 = normal, 10.0 = zoomed in)
  // camOffset: camera pan offset RELATIVE to View 2 reference position
  //
  // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
  // !! CRITICAL WARNING - READ THIS BEFORE MODIFYING ANIMATION CODE !!
  // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
  // !! View 1 is NOT CENTERED! View 1 has brainOffset: -0.2 (LEFT)   !!
  // !! Only Views 0 and 11 have brainOffset: 0 (CENTERED)            !!
  // !! I (Claude) repeatedly make the mistake of centering View 1.   !!
  // !! DO NOT set zoomFixedScreenX to width/2 for View 1 transitions !!
  // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
  //
  // VIEW LAYOUT (12 views: 0-11):
  // View 0  = Brain CENTERED, full size, no zoom (scrollable with dot)
  // View 1  = Brain LEFT and shrunk, but NOT zoomed (hero text)
  // View 2  = Zoomed in, brain LEFT, camera at center (RIBA Stages)
  // View 3  = Zoomed in, brain LEFT, camera pan (Demo Intro)
  // View 4  = Zoomed in, brain LEFT, camera at MEP region (MEP Floorplan)
  // View 5  = Zoomed in, brain LEFT, camera pan (Schematics MEP)
  // View 6  = Zoomed in, brain LEFT, camera pan (3D Modelling)
  // View 7  = Zoomed in, brain LEFT, camera pan (Schedules)
  // View 8  = Zoomed in, brain LEFT, camera pan (Spec Writing)
  // View 9  = Zoomed in, brain LEFT, camera pan (Arch Build)
  // View 10 = Zoomed in, brain LEFT, camera pan (Coming Soon)
  // View 11 = Brain CENTERED, full size, zoomed out (BUILD X - same as View 0)
  
  // Camera pan offsets relative to View 2 reference position
  // 12 VIEWS TOTAL (0-11): Scroll through brain, last view zooms out to match view 0
  const CAMERA_OFFSETS = {
    center:     { x: 0, y: 0 },       // Views 0, 1, 2, 11 - centered
    demoIntro:  { x: 80, y: -40 },    // View 3 - Demo intro
    floorplan:  { x: -250, y: 20 },   // View 4 - MEP Floorplan (frontal lobe)
    schematics: { x: 50, y: -120 },   // View 5 - Schematics (parietal)
    modelling:  { x: -150, y: -80 },  // View 6 - 3D Modelling
    schedules:  { x: 120, y: 40 },    // View 7 - Schedules
    specWrite:  { x: -80, y: -100 },  // View 8 - Spec Writing
    archBuild:  { x: 100, y: -60 },   // View 9 - Arch Build
    comingSoon: { x: -50, y: 60 },    // View 10 - Coming Soon
    buildX:     { x: 0, y: 0 }        // View 11 - BUILD X (transition to zoom out)
  };
  window.CAMERA_OFFSETS = CAMERA_OFFSETS;
  
  // Animation durations (milliseconds) - view-controller.js should use these
  const ANIMATION_DURATIONS = {
    panOnly: 800,           // Pan between views at same zoom level
    zoomWithPan: 1000,      // Zoom in/out with simultaneous pan
    brainMove: 600,         // Brain offset/scale animation
    textDelay: 400          // Delay before showing text after animation completes
  };
  window.ANIMATION_DURATIONS = ANIMATION_DURATIONS;
  
  // VIEW STATES: 12 views (0-11)
  // Views 0-2: Intro sequence (hero, text, RIBA)
  // Views 3-10: Demo views (scrolling through brain)
  // View 11: BUILD X + zoom out to match View 0 (footer scrolls below)
  const VIEW_STATES = {
    0:  { zoom: 1.0,  brainOffset: 0,    brainScale: 1.0,  camOffset: CAMERA_OFFSETS.center,     hasDot: true },
    1:  { zoom: 1.0,  brainOffset: -0.2, brainScale: 0.85, camOffset: CAMERA_OFFSETS.center,     hasDot: true },
    2:  { zoom: 10.0, brainOffset: -0.2, brainScale: 0.85, camOffset: CAMERA_OFFSETS.center,     hasDot: true },
    3:  { zoom: 10.0, brainOffset: -0.2, brainScale: 0.85, camOffset: CAMERA_OFFSETS.demoIntro,  hasDot: true },
    4:  { zoom: 10.0, brainOffset: -0.2, brainScale: 0.85, camOffset: CAMERA_OFFSETS.floorplan,  hasDot: true },
    5:  { zoom: 10.0, brainOffset: -0.2, brainScale: 0.85, camOffset: CAMERA_OFFSETS.schematics, hasDot: true },
    6:  { zoom: 10.0, brainOffset: -0.2, brainScale: 0.85, camOffset: CAMERA_OFFSETS.modelling,  hasDot: true },
    7:  { zoom: 10.0, brainOffset: -0.2, brainScale: 0.85, camOffset: CAMERA_OFFSETS.schedules,  hasDot: true },
    8:  { zoom: 10.0, brainOffset: -0.2, brainScale: 0.85, camOffset: CAMERA_OFFSETS.specWrite,  hasDot: true },
    9:  { zoom: 10.0, brainOffset: -0.2, brainScale: 0.85, camOffset: CAMERA_OFFSETS.archBuild,  hasDot: true },
    10: { zoom: 10.0, brainOffset: -0.2, brainScale: 0.85, camOffset: CAMERA_OFFSETS.comingSoon, hasDot: true },
    11: { zoom: 1.0,  brainOffset: 0,    brainScale: 1.0,  camOffset: CAMERA_OFFSETS.center,     hasDot: true }   // BUILD X - zooms out, footer scrolls below
  };
  window.VIEW_STATES = VIEW_STATES;
  
  // =====================================================
  // CAMERA POSITION - DERIVED FROM VIEW_STATES ONLY
  // =====================================================
  // Camera target for any view is calculated from VIEW_STATES.
  // NO hardcoded values. All values come from the table.
  
  function getCameraTargetForView(viewNum) {
    const state = VIEW_STATES[viewNum];
    if (!state) return { x: 0, y: 0 };
    
    // For zoom 1.0 views (0, 1, 8): camera at origin
    if (state.zoom === 1.0) {
      return { x: 0, y: 0 };
    }
    
    // For View 9 (stem zoom): find the 4 southernmost nodes and center on them
    if (viewNum === 9) {
      if (nodes.length < 4) return { x: 0, y: 0 };
      
      // Sort nodes by Y (highest Y = most south/bottom)
      const sortedByY = [...nodes].sort((a, b) => b.y - a.y);
      const stemNodes = sortedByY.slice(0, 4);
      
      // Calculate centroid of stem nodes (in reference coordinates)
      let centroidX = 0, centroidY = 0;
      for (const node of stemNodes) {
        centroidX += node.x;
        centroidY += node.y;
      }
      centroidX /= 4;
      centroidY /= 4;
      
      // Convert to offset from reference center
      // Camera offset needs to shift the centroid to screen center
      // Positive Y = pan down to show bottom of brain (stem nodes)
      const refScale = Math.min(width / REF_WIDTH, height / REF_HEIGHT);
      const offsetFromRefCenterX = (centroidX - REF_CENTER_X) * refScale * state.brainScale;
      const offsetFromRefCenterY = (centroidY - REF_CENTER_Y) * refScale * state.brainScale;
      
      return {
        x: -offsetFromRefCenterX,
        y: offsetFromRefCenterY  // Positive to show bottom of brain
      };
    }
    
    // For zoom 10.0 views: calculate base from VIEW_STATES[2], then add offset
    const state2 = VIEW_STATES[2];
    const brainOffset = state2.brainOffset * width;           // FROM TABLE
    const brainScreenX = (0.5 + state2.brainOffset) * width;  // DERIVED FROM TABLE
    
    // Base camera position at zoom 10.0 (View 2 reference)
    const baseX = brainOffset - (brainScreenX - width/2) / state2.zoom;
    const baseY = 0;
    
    // Add this view's offset FROM TABLE
    return {
      x: baseX + state.camOffset.x,
      y: baseY + state.camOffset.y
    };
  }
  window.getCameraTargetForView = getCameraTargetForView;
  
  // =====================================================
  // NODE QUERY FUNCTIONS
  // =====================================================
  // Get nodes visible in a specific view, or by region
  
  // Calculate screen position for a node at a specific view state
  function getNodeScreenPosForView(node, viewNum) {
    const state = VIEW_STATES[viewNum];
    if (!state) return null;
    
    const cam = getCameraTargetForView(viewNum);
    const zoom = state.zoom;
    const brainOff = state.brainOffset * width;
    const brainSc = state.brainScale;
    
    const screenCenterX = width / 2;
    const screenCenterY = height / 2;
    
    // Scale from reference to screen
    const refScale = Math.min(width / REF_WIDTH, height / REF_HEIGHT);
    
    // Combined transform: ref-to-screen * brainScale * zoom
    const tA = refScale * brainSc * zoom;
    const tB = screenCenterX + (brainOff - cam.x) * zoom;
    const tD = screenCenterY - cam.y * zoom;
    
    return {
      x: (node.x - REF_CENTER_X) * tA + tB,
      y: (node.y - REF_CENTER_Y) * tA + tD
    };
  }
  window.getNodeScreenPosForView = getNodeScreenPosForView;
  
  // Get all nodes visible in a specific view (within visible brain area)
  // For zoomed views (2-7), excludes the right 45% where the panel sits
  function getNodesInView(viewNum, padding = 50) {
    const state = VIEW_STATES[viewNum];
    const visibleNodes = [];
    
    // For zoomed views, brain is on left 55% of screen
    // For zoom 1.0 views (0, 1, 8), full width is visible
    const rightBoundary = (state && state.zoom > 1.0) ? width * 0.55 : width + padding;
    
    for (const node of nodes) {
      const pos = getNodeScreenPosForView(node, viewNum);
      if (pos && 
          pos.x >= -padding && pos.x <= rightBoundary &&
          pos.y >= -padding && pos.y <= height + padding) {
        visibleNodes.push({
          node: node,
          screenX: pos.x,
          screenY: pos.y
        });
      }
    }
    return visibleNodes;
  }
  window.getNodesInView = getNodesInView;
  
  // Get nodes by region (0-4)
  function getNodesByRegion(regionNum) {
    return nodes.filter(n => n.region === regionNum);
  }
  window.getNodesByRegion = getNodesByRegion;
  
  // Get region name
  function getRegionName(regionNum) {
    const names = ['Frontal', 'Parietal', 'Occipital', 'Temporal', 'Central'];
    return names[regionNum] || 'Unknown';
  }
  window.getRegionName = getRegionName;
  
  // Get center-most node in a region (closest to region centroid)
  function getCenterNodeInRegion(regionNum) {
    const regionNodes = nodes.filter(n => n.region === regionNum);
    if (regionNodes.length === 0) return null;
    
    // Calculate centroid of region
    let sumX = 0, sumY = 0;
    regionNodes.forEach(n => {
      sumX += n.x;
      sumY += n.y;
    });
    const centroidX = sumX / regionNodes.length;
    const centroidY = sumY / regionNodes.length;
    
    // Find node closest to centroid
    let closestNode = null;
    let minDist = Infinity;
    regionNodes.forEach(n => {
      const dist = Math.sqrt((n.x - centroidX) ** 2 + (n.y - centroidY) ** 2);
      if (dist < minDist) {
        minDist = dist;
        closestNode = n;
      }
    });
    
    return closestNode ? closestNode.id : null;
  }
  window.getCenterNodeInRegion = getCenterNodeInRegion;
  
  // Debug: log node distribution
  function logNodeStats() {
    const regionCounts = [0, 0, 0, 0, 0];
    nodes.forEach(n => regionCounts[n.region]++);
    console.log('Node distribution by region:');
    regionCounts.forEach((count, i) => {
      console.log(`  ${getRegionName(i)}: ${count} nodes`);
    });
    
    // Log visible nodes per view (in brain area only, excludes right panel)
    console.log('Visible nodes per view (left 55% for zoomed views):');
    for (let v = 2; v <= 7; v++) {
      const visible = getNodesInView(v);
      console.log(`  View ${v}: ${visible.length} nodes`);
    }
  }
  window.logNodeStats = logNodeStats;
  
  // Get N nodes near center of visible area for a view, spread out
  // Uses REFERENCE dimensions (1707x960 = 2560x1440 at 150%) for consistent selection
  function getCenterNodesForView(viewNum, count = 5) {
    const state = VIEW_STATES[viewNum];
    if (!state) return [];
    
    // Use reference dimensions for consistent node selection (optimized for 2560x1440 @150%)
    const refVisibleWidth = (state.zoom > 1.0) ? REF_WIDTH * 0.55 : REF_WIDTH;
    // Center point for sorting - use 27.5% of width (center of 55% panel) for zoomed views
    const refCenterX = (state.zoom > 1.0) ? REF_WIDTH * 0.275 : REF_WIDTH / 2;
    const refCenterY = REF_HEIGHT / 2;
    
    // Scale factor from reference to current screen
    const screenScale = Math.min(width / REF_WIDTH, height / REF_HEIGHT);
    
    const visibleNodes = getNodesInView(viewNum);
    if (visibleNodes.length === 0) {
      console.log('getCenterNodesForView: No visible nodes for view', viewNum);
      return [];
    }
    
    // FIRST: Filter to nodes well within the visible 55% panel
    // Keep nodes centered - use 15% to 40% of width (left-center of the 55% brain area)
    // And 15% to 85% of height for good vertical spread
    const panelLeft = width * 0.15;   // 15% from left edge
    const panelRight = width * 0.40;  // 40% from left
    const panelCenterX = (panelLeft + panelRight) / 2;  // Center of filter zone
    const panelTop = height * 0.15;   // 15% from top
    const panelBottom = height * 0.85; // 85% from top
    const panelCenterY = (panelTop + panelBottom) / 2;  // Center of filter zone
    
    const onScreenNodes = visibleNodes.filter(n => 
      n.screenX >= panelLeft && n.screenX <= panelRight && 
      n.screenY >= panelTop && n.screenY <= panelBottom
    );
    
    // Use on-screen nodes if we have enough, otherwise fall back to all visible
    const baseNodes = onScreenNodes.length >= count ? onScreenNodes : visibleNodes;
    
    // Convert screen positions back to reference-equivalent for consistent filtering
    // This ensures the same nodes are selected regardless of screen size
    const nodesWithRefPos = baseNodes.map(n => ({
      ...n,
      refX: n.screenX / screenScale,
      refY: n.screenY / screenScale
    }));
    
    // Filter to nodes in the "sweet spot" - middle 60% of visible area (using reference dims)
    const marginX = refVisibleWidth * 0.2;
    const marginY = REF_HEIGHT * 0.2;
    const sweetSpotNodes = nodesWithRefPos.filter(n => 
      n.refX >= marginX && n.refX <= refVisibleWidth - marginX &&
      n.refY >= marginY && n.refY <= REF_HEIGHT - marginY
    );
    
    // Use sweet spot if we have enough, otherwise use all visible
    const candidates = sweetSpotNodes.length >= count ? sweetSpotNodes : nodesWithRefPos;
    
    // Sort by distance to panel center (in screen coords for accuracy)
    candidates.sort((a, b) => {
      const distA = Math.sqrt(Math.pow(a.screenX - panelCenterX, 2) + Math.pow(a.screenY - panelCenterY, 2));
      const distB = Math.sqrt(Math.pow(b.screenX - panelCenterX, 2) + Math.pow(b.screenY - panelCenterY, 2));
      return distA - distB;
    });
    
    // Pick nodes that are spread apart (minimum distance in screen coords)
    const selected = [];
    const minSpacing = Math.min(panelRight - panelLeft, panelBottom - panelTop) * 0.20; // 20% of smaller panel dimension
    
    for (const candidate of candidates) {
      if (selected.length >= count) break;
      
      // Check if this node is far enough from already selected nodes
      let tooClose = false;
      for (const sel of selected) {
        const dist = Math.sqrt(Math.pow(candidate.screenX - sel.screenX, 2) + Math.pow(candidate.screenY - sel.screenY, 2));
        if (dist < minSpacing) {
          tooClose = true;
          break;
        }
      }
      
      if (!tooClose) {
        selected.push(candidate);
      }
    }
    
    // If we couldn't get enough with spacing, fill with closest remaining
    if (selected.length < count) {
      for (const candidate of candidates) {
        if (selected.length >= count) break;
        if (!selected.includes(candidate)) {
          selected.push(candidate);
        }
      }
    }
    
    console.log(`getCenterNodesForView: View ${viewNum} - selected: ${selected.length}, onScreen: ${onScreenNodes.length}, visible: ${visibleNodes.length}, sweetSpot: ${sweetSpotNodes.length}`);
    
    return selected;
  }
  window.getCenterNodesForView = getCenterNodesForView;
  
  // Trigger a pulse from a specific node (called when overlay node is hovered)
  function triggerNodePulse(nodeId) {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    
    // Call pulse fired callback if set
    if (window.onPulseFired) {
      window.onPulseFired(nodeId);
    }
    
    // Activate the node visually
    node.activation = 1.0;
    node.yellowActivation = 1.0;
    node.hoverIntensity = 1.0;
    
    // Get speed multiplier for this node
    const speedMultiplier = getNodePulseSpeed(nodeId);
    
    // Find edges connected to this node
    const connectedEdgeIndices = [];
    edges.forEach((edge, idx) => {
      if (edge.from === nodeId || edge.to === nodeId) {
        connectedEdgeIndices.push(idx);
      }
    });
    
    // Shuffle and pick 3 random edges
    const shuffled = connectedEdgeIndices.sort(() => Math.random() - 0.5);
    const pulseCount = Math.min(3, shuffled.length);
    
    for (let i = 0; i < pulseCount; i++) {
      const edgeIdx = shuffled[i];
      const edge = edges[edgeIdx];
      const isForward = edge.from === nodeId;
      const fromNode = nodes[edge.from];
      const toNode = nodes[edge.to];
      
      // Use same speed range as spawnPulse, adjusted by multiplier
      const baseSpeed = PULSE_SPEED_MIN + Math.random() * (PULSE_SPEED_MAX - PULSE_SPEED_MIN);
      
      pulses.push({
        edgeIdx: edgeIdx,
        t: isForward ? 0 : 1,
        speed: baseSpeed * speedMultiplier,
        baseSpeed: baseSpeed,
        hue: 180, // teal color
        baseBrightness: 70,
        currentBrightness: 70 * (isForward ? fromNode.baseBrightness : toNode.baseBrightness),
        fromNodeBrightness: fromNode.baseBrightness,
        toNodeBrightness: toNode.baseBrightness,
        isYellow: true,
        trailThickness: 0.8 + Math.random() * 0.4,
        trail: [],
        fromHover: true,
        alive: true,
        parking: false,
        parkTimer: 0,
        fadeOpacity: 1,
        isGhost: false,
        hasArrived: false,
        fadeTimer: 0,
        ghostX: 0,
        ghostY: 0,
        reverse: false,
        dir: isForward ? 1 : -1,
        sourceNodeId: nodeId
      });
    }
  }
  window.triggerNodePulse = triggerNodePulse;
  
  // Get current screen position of a node (using current transform state)
  function getNodeCurrentScreenPos(nodeId) {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return null;
    return worldToScreen(node.x, node.y);
  }
  window.getNodeCurrentScreenPos = getNodeCurrentScreenPos;
  
  // =====================================================
  // DUAL HOVER SYSTEM - User and Auto-hover are SEPARATE
  // =====================================================
  // User hover and auto-hover run as independent streams.
  // Both can activate nodes simultaneously without interference.
  
  // Set hovered node - SEPARATE streams for user vs auto
  // isUserHover: true = user initiated, false = auto-hover from timer
  function setHoveredNode(nodeId, isUserHover = true) {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    
    if (isUserHover) {
      // User hover - completely separate from auto-hover
      userHoveredNode = nodeId;
      // Reset user pulse timer so pulses start fresh
      userHoverPulseTimer = 0;
    } else {
      // Auto-hover - doesn't affect user hover
      autoHoveredNode = nodeId;
      // Reset auto pulse timer
      autoHoverPulseTimer = 0;
    }
    
    // Activate the node visually (both streams contribute)
    node.hoverIntensity = Math.max(node.hoverIntensity, 0.5);
    node.activation = Math.max(node.activation, 0.5);
    node.yellowActivation = Math.max(node.yellowActivation, 0.5);
  }
  window.setHoveredNode = setHoveredNode;
  
  // Clear hovered node - SEPARATE for user vs auto
  // isUserClear: true = user stopped hovering, false = auto-hover cleanup
  function clearHoveredNode(isUserClear = true) {
    if (isUserClear) {
      userHoveredNode = null;
    } else {
      autoHoveredNode = null;
    }
  }
  window.clearHoveredNode = clearHoveredNode;
  
  // Check if user is currently hovering (for external use)
  function isUserHovering() {
    return userHoveredNode !== null;
  }
  window.isUserHovering = isUserHovering;
  
  // Get user hovered node (for external use)
  function getUserHoveredNode() {
    return userHoveredNode;
  }
  window.getUserHoveredNode = getUserHoveredNode;
  
  // Get auto hovered node (for external use)
  function getAutoHoveredNode() {
    return autoHoveredNode;
  }
  window.getAutoHoveredNode = getAutoHoveredNode;
  
  // Node pulse speed multipliers (for loading animation)
  const nodePulseSpeedMultipliers = {};
  
  // Nodes that have completed loading - block cascades from these
  const cascadeBlockedNodes = new Set();
  
  // Set pulse speed multiplier for a specific node
  function setNodePulseSpeed(nodeId, speedMultiplier) {
    nodePulseSpeedMultipliers[nodeId] = speedMultiplier;
  }
  window.setNodePulseSpeed = setNodePulseSpeed;
  
  // Get pulse speed multiplier for a node
  function getNodePulseSpeed(nodeId) {
    return nodePulseSpeedMultipliers[nodeId] || 1.0;
  }
  window.getNodePulseSpeed = getNodePulseSpeed;
  
  // Block cascades from a node (called when loading completes)
  function blockCascadesFromNode(nodeId) {
    cascadeBlockedNodes.add(nodeId);
  }
  window.blockCascadesFromNode = blockCascadesFromNode;
  
  // Unblock cascades (called when a different node is hovered)
  function unblockCascades() {
    cascadeBlockedNodes.clear();
  }
  window.unblockCascades = unblockCascades;
  
  // Check if cascades should be blocked from a node
  function isCascadeBlocked(nodeId) {
    return cascadeBlockedNodes.has(nodeId);
  }
  
  // Update speed of all existing pulses from a source node
  function updatePulsesFromNode(nodeId, speedMultiplier) {
    pulses.forEach(pulse => {
      if (pulse.sourceNodeId === nodeId && pulse.baseSpeed) {
        pulse.speed = pulse.baseSpeed * speedMultiplier;
      }
    });
  }
  window.updatePulsesFromNode = updatePulsesFromNode;
  
  // =====================================================
  // TARGET VIEW TRACKING
  // =====================================================
  // targetViewIndex is the SINGLE SOURCE OF TRUTH for which view
  // we're animating towards. When an animation completes, it checks
  // if it's still the current target before triggering callbacks.
  // This prevents text bleeding when scrolling quickly between views.
  
  let targetViewIndex = 0;
  let currentBrainView = 0;
  
  function setTargetView(viewNum) {
    targetViewIndex = viewNum;
    currentBrainView = viewNum;
    console.log('Target view set to:', viewNum);
  }
  window.setTargetView = setTargetView;
  
  function getTargetView() {
    return targetViewIndex;
  }
  window.getTargetView = getTargetView;
  
  // Legacy alias
  function setCurrentBrainView(viewNum) {
    setTargetView(viewNum);
  }
  window.setCurrentBrainView = setCurrentBrainView;
  
  // =====================================================
  // UNIFIED ANIMATION FUNCTION
  // =====================================================
  // animateToViewState() is THE ONLY function for view transitions.
  // 
  // LOGIC:
  // 1. Read CURRENT values from actual state
  // 2. Read TARGET values from VIEW_STATES table (SOURCE OF TRUTH)
  // 3. Start all animations simultaneously
  // 4. Resolve after duration + buffer
  //
  // NO callbacks from draw loop. NO complex state tracking.
  // Just: start animations, wait, resolve.
  
  // =====================================================
  // SCREEN POSITION INTERPOLATION FOR ZOOM TRANSITIONS
  // =====================================================
  // When zoom changes, we can't just linearly interpolate camera position.
  // The brain's screen position is: screenX = width/2 + (brainOffsetX - camera.x) * zoom
  // If camera.x and zoom both animate independently, screenX takes a curved path!
  //
  // FIX: Interpolate the SCREEN position we want, then calculate required camera.x
  // This guarantees smooth visual motion regardless of zoom changes.
  
  let screenPosAnimating = false;
  let screenPosStartTime = 0;
  let screenPosDuration = 1000;
  let screenPosStartX = 0;
  let screenPosStartY = 0;
  let screenPosTargetX = 0;
  let screenPosTargetY = 0;
  
  function animateToViewState(targetView, callback) {
    return new Promise((resolve) => {
      const now = performance.now();
      const state = VIEW_STATES[targetView];
      if (!state) {
        console.log('animateToViewState: invalid view', targetView);
        resolve();
        return;
      }
      
      // Mark view as initialized so rendering can begin
      viewInitialized = true;
      
      setTargetView(targetView);
      
      // ========== SOURCE OF TRUTH CHECK ==========
      // View 0: zoom 1.0, brainOffset 0 (CENTER), brainScale 1.0
      // View 1: zoom 1.0, brainOffset -0.2 (LEFT), brainScale 0.85 <-- NOT CENTERED!
      // View 2-6: zoom 10.0, brainOffset -0.2 (LEFT), brainScale 0.85
      // View 7: zoom 1.0, brainOffset 0 (CENTER), brainScale 1.0
      
      // ========== READ CURRENT ==========
      const startZoom = camera.zoom;
      const startCamX = camera.x;
      const startCamY = camera.y;
      const startBrainOffset = brainOffsetX;
      const startBrainScale = brainScaleAnim;
      
      // ========== READ TARGET FROM TABLE ==========
      const targetZoom = state.zoom;
      const targetBrainOffset = state.brainOffset * width;
      const targetBrainScale = state.brainScale;
      const targetCam = getCameraTargetForView(targetView);
      
      // ========== DURATION ==========
      const zoomChanging = Math.abs(targetZoom - startZoom) > 0.5;
      const duration = zoomChanging ? ANIMATION_DURATIONS.zoomWithPan : ANIMATION_DURATIONS.panOnly;
      
      console.log(`animateToViewState(${targetView}): zoom ${startZoom.toFixed(1)}->${targetZoom.toFixed(1)}, cam (${startCamX.toFixed(0)},${startCamY.toFixed(0)})->(${targetCam.x.toFixed(0)},${targetCam.y.toFixed(0)}), brain ${startBrainOffset.toFixed(0)}->${targetBrainOffset.toFixed(0)}, duration=${duration}`);
      
      // ========== START ALL ANIMATIONS ==========
      
      // Brain offset
      brainMoveStartX = startBrainOffset;
      brainTargetOffsetX = targetBrainOffset;
      brainMoveStartTime = now;
      brainMoveDuration = duration;
      
      // Brain scale
      brainScaleStartValue = startBrainScale;
      brainTargetScale = targetBrainScale;
      brainScaleStartTime = now;
      
      // Zoom (if changing)
      if (zoomChanging) {
        zoomAnimating = true;
        zoomStartTime = now;
        zoomDuration = duration;
        zoomStartValue = startZoom;
        zoomTargetValue = targetZoom;
        isScrollZoom = true;
        zoomCallbackFired = true; // Don't use callback mechanism
        
        // ========== SCREEN POSITION INTERPOLATION ==========
        // Calculate current brain screen position
        // screenX = width/2 + (brainOffsetX - camera.x) * zoom
        screenPosStartX = width/2 + (startBrainOffset - startCamX) * startZoom;
        screenPosStartY = height/2 - startCamY * startZoom;
        
        // Calculate target brain screen position
        screenPosTargetX = width/2 + (targetBrainOffset - targetCam.x) * targetZoom;
        screenPosTargetY = height/2 - targetCam.y * targetZoom;
        
        // Enable screen position interpolation (camera will be computed in loop)
        screenPosAnimating = true;
        screenPosStartTime = now;
        screenPosDuration = duration;
        
        // DON'T use simple cam pan - let screen pos interpolation control camera
        camPanAnimating = false;
        
        console.log(`  Screen pos: (${screenPosStartX.toFixed(0)},${screenPosStartY.toFixed(0)}) -> (${screenPosTargetX.toFixed(0)},${screenPosTargetY.toFixed(0)})`);
      } else {
        // No zoom change - use simple camera pan
        camPanAnimating = true;
        camPanStartTime = now;
        camPanDuration = duration;
        camPanStartX = startCamX;
        camPanStartY = startCamY;
        camPanTargetX = targetCam.x;
        camPanTargetY = targetCam.y;
        screenPosAnimating = false;
      }
      
      // ========== RESOLVE AFTER DURATION ==========
      // Simple: just wait for animation to complete, then resolve
      setTimeout(() => {
        console.log(`animateToViewState(${targetView}): complete`);
        if (callback) callback();
        resolve();
      }, duration + 100);
    });
  }
  window.animateToViewState = animateToViewState;
  
  // =====================================================
  // SET VIEW INSTANT - No animation, immediate positioning
  // =====================================================
  function setViewInstant(targetView, makeVisible = false) {
    const state = VIEW_STATES[targetView];
    if (!state) {
      console.log('setViewInstant: invalid view', targetView);
      return;
    }
    
    setTargetView(targetView);
    
    // Stop all animations
    zoomAnimating = false;
    camPanAnimating = false;
    screenPosAnimating = false;
    
    // Mark view as initialized so rendering can begin
    viewInitialized = true;
    
    // Optionally make brain visible instantly (for #about deep link)
    if (makeVisible) {
      brainOpacity = 1;
      brainTargetOpacity = 1;
    }
    
    // Set camera zoom instantly
    camera.zoom = state.zoom;
    
    // Set brain offset and scale instantly
    brainOffsetX = state.brainOffset * width;
    brainTargetOffsetX = brainOffsetX;
    brainScaleAnim = state.brainScale;
    brainTargetScale = state.brainScale;
    
    // Set camera position instantly
    const targetCam = getCameraTargetForView(targetView);
    camera.x = targetCam.x;
    camera.y = targetCam.y;
    camPanTargetX = camera.x;
    camPanTargetY = camera.y;
    
    console.log(`setViewInstant(${targetView}): zoom=${state.zoom}, brainOffset=${brainOffsetX.toFixed(0)}, brainScale=${state.brainScale}, cam=(${camera.x.toFixed(0)},${camera.y.toFixed(0)})`);
  }
  window.setViewInstant = setViewInstant;
  
  // =====================================================
  // WRAPPER FUNCTIONS (Legacy - for backward compatibility)
  // =====================================================
  // These functions exist for backward compatibility but internally
  // they should use VIEW_STATES values. New code should use
  // animateToViewState() directly.
  
  // Move brain to left position and shrink (View 0 -> View 1 transition)
  function shrinkAndMoveBrain() {
    const now = performance.now();
    const state = VIEW_STATES[1];
    
    brainScaleStartValue = brainScaleAnim;
    brainTargetScale = state.brainScale;
    brainScaleStartTime = now;
    
    brainMoveStartX = brainOffsetX;
    brainTargetOffsetX = state.brainOffset * width;
    brainMoveStartTime = now;
    brainMoveDuration = ANIMATION_DURATIONS.brainMove;
    
    console.log('shrinkAndMoveBrain: scale', brainScaleAnim, '->', state.brainScale, ', offset', brainOffsetX, '->', state.brainOffset * width);
  }
  window.shrinkAndMoveBrain = shrinkAndMoveBrain;
  
  // DEPRECATED: Use animateToViewState(7) instead
  // Kept for backward compatibility
  function resetBrainForView7() {
    console.log('resetBrainForView7 called - use animateToViewState(7) instead');
    animateToViewState(7);
  }
  window.resetBrainForView7 = resetBrainForView7;
  
  // DEPRECATED: Use animateToViewState(1) instead
  // Kept for backward compatibility
  function resetBrainForView1() {
    console.log('resetBrainForView1 called - use animateToViewState(1) instead');
    animateToViewState(1);
  }
  window.resetBrainForView1 = resetBrainForView1;
  
  // DEPRECATED: Use animateToViewState(6) instead
  // Kept for backward compatibility
  function zoomBackToView6() {
    console.log('zoomBackToView6 called - use animateToViewState(6) instead');
    animateToViewState(6);
  }
  window.zoomBackToView6 = zoomBackToView6;
  
  // =====================================================
  // PAN FUNCTIONS
  // =====================================================
  // These animate the camera only (no zoom or brain position change).
  // Used for transitions between Views 2-6 which share the same zoom level.
  
  // Pan to a specific view's camera position
  function panToView(viewNum, duration) {
    const target = getCameraTargetForView(viewNum);
    const dur = duration || ANIMATION_DURATIONS.panOnly;
    
    camPanAnimating = true;
    camPanStartTime = performance.now();
    camPanDuration = dur;
    camPanStartX = camera.x;
    camPanStartY = camera.y;
    camPanTargetX = target.x;
    camPanTargetY = target.y;
    
    console.log('panToView', viewNum, ': (', camera.x.toFixed(1), ',', camera.y.toFixed(1), ') -> (', target.x.toFixed(1), ',', target.y.toFixed(1), ')');
  }
  window.panToView = panToView;
  
  // Pan back to current view's target position (rubber band effect)
  function panBackToOriginal(duration) {
    panToView(currentBrainView, duration);
    console.log('Rubber band to view', currentBrainView);
  }
  window.panBackToOriginal = panBackToOriginal;
  
  // DEPRECATED: Use panToView() with view number instead
  // Maps region names to view numbers for backward compatibility
  function panToBrainRegion(regionName, duration) {
    const regionToView = { 
      mep: 4, 
      arch: 5, 
      cost: 6, 
      center: 2 
    };
    const viewNum = regionToView[regionName];
    if (viewNum) {
      panToView(viewNum, duration);
    } else {
      console.warn('Unknown region:', regionName);
    }
  }
  window.panToBrainRegion = panToBrainRegion;
  
  function isPanAnimating() {
    return camPanAnimating;
  }
  window.isPanAnimating = isPanAnimating;
  
  function isBrainMoving() {
    return brainMoveStartTime > 0 && brainOffsetX !== brainTargetOffsetX;
  }

  // --------------------------------------------------
  // Resize
  // --------------------------------------------------

  function handleResize() {
    width = window.innerWidth;
    height = window.innerHeight;
    
    // Simple resize (no DPR scaling)
    canvas.width = width;
    canvas.height = height;

    buildNetwork();
    buildParticles();
    pulses = [];
    ensureBasePulseCount();
  }

  window.addEventListener("resize", handleResize);

  // --------------------------------------------------
  // Initialize
  // --------------------------------------------------

  function init() {
    buildNetwork();
    buildParticles();
    // Don't spawn pulses yet - wait for container animation
    requestAnimationFrame(loop);
  }

  if (window.PERF) window.PERF.mark('brain.js before init()');
  init();
  if (window.PERF) window.PERF.mark('brain.js after init() - network built');
  
  // Check for initial view set by page (e.g. roadmap, contact)
  // This sets the view BEFORE first render to avoid jumping
  if (typeof window.BRAIN_INITIAL_VIEW === 'number') {
    setViewInstant(window.BRAIN_INITIAL_VIEW);
  }
  
  // Pre-render first frame only if view is initialized
  if (viewInitialized) {
  updateTransformCache();
  if (window.PERF) window.PERF.mark('brain.js updateTransformCache done');
  drawBackground();
  if (window.PERF) window.PERF.mark('brain.js drawBackground done');
  drawParticles(0);
  if (window.PERF) window.PERF.mark('brain.js drawParticles done');
  drawEdges();
  if (window.PERF) window.PERF.mark('brain.js drawEdges done');
  drawNodes();
  if (window.PERF) window.PERF.mark('brain.js drawNodes done - FIRST FRAME COMPLETE');
  }
  
  // Start animation loop
  requestAnimationFrame(loop);
