// Animated pulsing node favicon
// Draws a glowing, pulsing circle on a canvas and sets it as the favicon
(function() {
  const SIZE = 64;
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  const cx = SIZE / 2;
  const cy = SIZE / 2;

  // Brand teal color
  const TEAL_R = 21, TEAL_G = 96, TEAL_B = 130; // #156082

  // Find or create favicon link
  let link = document.querySelector("link[rel~='icon']");
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }

  // Use requestAnimationFrame for smoother animation
  let lastTime = 0;
  let t = 0;
  const MIN_FRAME_MS = 1000 / 30; // cap at ~30fps to avoid excess dataURL calls

  function draw(timestamp) {
    requestAnimationFrame(draw);

    // Throttle to ~30fps (favicon dataURL swap is expensive)
    const delta = timestamp - lastTime;
    if (delta < MIN_FRAME_MS) return;
    lastTime = timestamp;

    t += delta / 1000;
    ctx.clearRect(0, 0, SIZE, SIZE);

    // Smooth eased pulse using sin³ for a softer breathe feel
    const raw = 0.5 + 0.5 * Math.sin(t * 1.8);        // slower cycle (~3.5s)
    const pulse = 0.25 + 0.75 * (raw * raw * (3 - 2 * raw)); // smoothstep ease

    // Outer glow – fills the whole 64x64 canvas
    const glowRadius = 32 * (0.9 + pulse * 0.1);
    const outerGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowRadius);
    outerGlow.addColorStop(0, `rgba(${TEAL_R}, ${TEAL_G}, ${TEAL_B}, ${0.6 * pulse})`);
    outerGlow.addColorStop(0.5, `rgba(${TEAL_R}, ${TEAL_G}, ${TEAL_B}, ${0.3 * pulse})`);
    outerGlow.addColorStop(1, `rgba(${TEAL_R}, ${TEAL_G}, ${TEAL_B}, 0)`);
    ctx.beginPath();
    ctx.arc(cx, cy, glowRadius, 0, Math.PI * 2);
    ctx.fillStyle = outerGlow;
    ctx.fill();

    // Inner glow (brighter core)
    const innerR = 26;
    const innerGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, innerR);
    innerGlow.addColorStop(0, `rgba(${TEAL_R + 60}, ${TEAL_G + 80}, ${TEAL_B + 60}, ${0.85 * pulse})`);
    innerGlow.addColorStop(1, `rgba(${TEAL_R}, ${TEAL_G}, ${TEAL_B}, 0)`);
    ctx.beginPath();
    ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
    ctx.fillStyle = innerGlow;
    ctx.fill();

    // Node circle (solid core) — fills most of the favicon
    const coreRadius = 20 + pulse * 3;
    ctx.beginPath();
    ctx.arc(cx, cy, coreRadius, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${TEAL_R}, ${TEAL_G}, ${TEAL_B}, ${0.92 + pulse * 0.08})`;
    ctx.fill();

    // Bright center highlight
    ctx.beginPath();
    ctx.arc(cx, cy, 10, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${TEAL_R + 100}, ${TEAL_G + 120}, ${TEAL_B + 100}, ${0.5 + pulse * 0.5})`;
    ctx.fill();

    // Ring outline
    ctx.beginPath();
    ctx.arc(cx, cy, 26 + pulse * 3, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(${TEAL_R}, ${TEAL_G}, ${TEAL_B}, ${0.3 + pulse * 0.4})`;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Update favicon
    link.type = 'image/png';
    link.href = canvas.toDataURL('image/png');
  }

  // Kick off with requestAnimationFrame for butter-smooth timing
  requestAnimationFrame(draw);
})();
