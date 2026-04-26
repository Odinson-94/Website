import { readFileSync, writeFileSync } from 'fs';

const file = 'templates/home.html';
let src = readFileSync(file, 'utf8');

const replacements = [
  // 1. Remove .revit-panel background gradient
  [
    `    background: linear-gradient(135deg, #0e1c25 0%, #1a3441 50%, #156082 100%);\n    border-radius: var(--radius-lg);`,
    `    border-radius: var(--radius-lg);`
  ],

  // 2a. .revit-panel color: #fff → #222
  [
    `.revit-panel {\n    border-radius: var(--radius-lg);\n    overflow: hidden;\n    color: #fff;`,
    `.revit-panel {\n    border-radius: var(--radius-lg);\n    overflow: hidden;\n    color: #222;`
  ],

  // 2b. .revit-panel h2, h3 color override
  [
    `.revit-panel h2,\n  .revit-panel h3 {\n    color: #fff !important;\n  }`,
    `.revit-panel h2,\n  .revit-panel h3 {\n    color: #222 !important;\n  }`
  ],

  // 2c. .rp-tagline color
  [
    `color: #fff; max-width: 30em;`,
    `color: var(--text-muted); max-width: 30em;`
  ],

  // 2d. .rp-badge
  [
    `background: rgba(255,255,255,0.14); color: #fff;`,
    `background: rgba(21,96,130,0.10); color: #156082;`
  ],

  // 2e. .rp-cta
  [
    `background: #fff; color: #156082;\n    padding: 13px 24px;`,
    `background: #156082; color: #fff;\n    padding: 13px 24px;`
  ],

  // 2f. .rp-video-label
  [
    `font-size: 13px; color: rgba(255,255,255,0.85);`,
    `font-size: 13px; color: var(--text-muted);`
  ],

  // 2g. .rp-video background
  [
    `background: linear-gradient(160deg, rgba(0,0,0,0.20) 0%, rgba(0,0,0,0.50) 100%);`,
    `background: linear-gradient(160deg, rgba(0,0,0,0.03) 0%, rgba(0,0,0,0.08) 100%);`
  ],

  // 2h. .rp-play-icon background + border
  [
    `background: rgba(255,255,255,0.12); border: 2px solid rgba(255,255,255,0.25);`,
    `background: rgba(21,96,130,0.10); border: 2px solid rgba(21,96,130,0.20);`
  ],

  // 2i. .rp-play-icon svg fill
  [
    `width: 24px; height: 24px; fill: #fff;`,
    `width: 24px; height: 24px; fill: #156082;`
  ],

  // 2j. .revit-panel-top border-bottom
  [
    `border-bottom: 1px solid rgba(255,255,255,0.12);\n    min-height: 400px;`,
    `border-bottom: 1px solid var(--border);\n    min-height: 400px;`
  ],

  // 3. Commands card background — new gradient
  [
    `background: linear-gradient(135deg, #0e1c25 0%, #1a3441 50%, #156082 100%);\n    border-radius: 14px; padding: 36px;`,
    `background: linear-gradient(135deg, #a6a9ac 0%, #28606e 50%, #007482 100%);\n    border-radius: 14px; padding: 36px;`
  ],

  // 4a. .rp-feat-title font-size
  [
    `font-size: 16px; font-weight: 600; color: #fff;`,
    `font-size: clamp(20px, 2.2vw, 28px); font-weight: 600; color: #fff;`
  ],

  // 4b. .rp-feat-desc
  [
    `font-size: 13px; color: rgba(255,255,255,0.70); line-height: 1.4;`,
    `font-size: clamp(14px, 1.4vw, 18px); color: rgba(255,255,255,0.80); line-height: 1.5;`
  ],

  // 4c. .rp-commands-card h3 font-size
  [
    `margin: 0; font-size: clamp(28px, 3vw, 40px);`,
    `margin: 0; font-size: clamp(24px, 2.6vw, 34px);`
  ],

  // 5. Logo hover — add transition to .rp-logo + new hover rule
  [
    `filter: drop-shadow(0 30px 60px rgba(0,0,0,0.55));\n    border-radius: 42px;\n  }`,
    `filter: drop-shadow(0 30px 60px rgba(0,0,0,0.55));\n    border-radius: 42px;\n    transition: transform 0.3s ease;\n  }\n  .revit-panel-top .rp-copy .rp-logo:hover { transform: scale(1.05); }`
  ],
];

let count = 0;
for (const [old, neu] of replacements) {
  if (!src.includes(old)) {
    console.error(`NOT FOUND (#${count + 1}): ${JSON.stringify(old.slice(0, 80))}...`);
    process.exit(1);
  }
  src = src.replace(old, neu);
  count++;
}

// Normalise all to CRLF
src = src.replace(/\r\n/g, '\n').replace(/\n/g, '\r\n');

writeFileSync(file, src, 'utf8');
console.log(`Done — ${count} replacements applied, CRLF normalised.`);
