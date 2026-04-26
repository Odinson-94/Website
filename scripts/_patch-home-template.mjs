import { readFileSync, writeFileSync } from 'fs';

const FILE = 'templates/home.html';
let src = readFileSync(FILE, 'utf8');

// Normalize to LF for matching, will restore CRLF at end
const hadCRLF = src.includes('\r\n');
if (hadCRLF) src = src.replace(/\r\n/g, '\n');

function replace(label, old, neu) {
  if (!src.includes(old)) {
    console.error(`FAIL: "${label}" — old string not found`);
    process.exit(1);
  }
  const count = src.split(old).length - 1;
  if (count > 1) console.warn(`  WARN: "${label}" matched ${count} times — replacing first`);
  src = src.replace(old, neu);
  console.log(`  OK: ${label}`);
}

// ── 1. Fix background: cover → contain + matching bg color
replace('bg-contain',
  `background: url('/images/revit-bg.png') center center / cover no-repeat;`,
  `background: #e8e6e2 url('/images/revit-bg.png') center top / contain no-repeat;`
);

replace('height-680',
  `height: 1020px;`,
  `height: 680px;`
);

// ── 6. More spacing between hero h1 and BUILD cycler (do before button CSS removal to keep line refs stable)
replace('hero-margin',
  `margin-bottom: 80px;`,
  `margin-bottom: 120px;`
);

// ── 4. Copilot logo 1.3x
replace('logo-312',
  `width: 240px; height: 240px;`,
  `width: 312px; height: 312px;`
);

// ── 5a. Panel gradient — premium
replace('panel-gradient',
  `background: linear-gradient(135deg, #0e1c25 0%, #1a3441 50%, #156082 100%);
    border-radius: var(--radius-lg);`,
  `background: linear-gradient(160deg, #0a1628 0%, #0f2b3d 35%, #163a4f 65%, #1a4a63 100%);
    border-radius: var(--radius-lg);`
);

// ── 5b. Commands card gradient → frosted glass
replace('card-frosted',
  `background: linear-gradient(135deg, #0e1c25 0%, #1a3441 50%, #156082 100%);
    border-radius: 14px; padding: 36px;`,
  `background: rgba(10, 22, 40, 0.92); backdrop-filter: blur(12px);
    border-radius: 14px; padding: 36px;`
);

// ── 2a. Commands card: top/right → top/right/bottom
replace('card-bottom',
  `top: 24px; right: 24px;
    width: calc(45% - 36px);`,
  `top: 24px; right: 24px; bottom: 24px;
    width: calc(45% - 36px);`
);

// ── 3. Remove old button CSS and replace with contact-page style
const oldBtnCSS = `  .home-hero .button-row {
    display: flex; flex-direction: column; gap: 12px; margin-top: 8px;
  }
  .home-hero .button-row-inline {
    display: flex; gap: 16px; flex-wrap: wrap;
  }
  .home-hero .signup-btn {
    font-family: 'Inter', sans-serif;
    font-size: 13px; font-weight: 600; letter-spacing: 0.5px;
    text-transform: uppercase; padding: 14px 28px;
    border-radius: 4px; border: none; cursor: pointer;
    text-decoration: none; display: inline-block;
    transition: background 0.2s, transform 0.1s;
    position: relative; overflow: hidden;
  }
  .home-hero .signup-btn.primary {
    background: #156082; color: #fff;
  }
  .home-hero .signup-btn.primary::before {
    content: ''; position: absolute;
    top: 0; left: -100%; width: 100%; height: 100%;
    background: linear-gradient(to right, rgba(255,255,255,0) 0%, rgba(255,255,255,0.3) 50%, rgba(255,255,255,0) 100%);
    animation: contact-btn-shine 2.5s ease-in-out infinite;
  }
  @keyframes contact-btn-shine {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(200%); }
  }
  .home-hero .signup-btn.primary:hover { background: #1a7a9e; }
  .home-hero .signup-btn.secondary {
    background: #6c757d; color: #fff;
  }
  .home-hero .signup-btn.secondary:hover { background: #5a6268; }
  .home-hero .signup-btn.suggestion {
    background: transparent; color: #156082;
    border: 1px solid #156082;
  }
  .home-hero .signup-btn.suggestion:hover { background: rgba(21, 96, 130, 0.1); }`;

const newBtnCSS = `  .button-row {
    display: flex; flex-direction: column; gap: 12px; width: 100%; margin-top: 10px;
  }
  .button-row-inline {
    display: flex; gap: 16px; width: 100%;
  }
  .signup-btn {
    font-family: 'Inter', sans-serif; font-size: 13px; font-weight: 500;
    padding: 12px 28px; border-radius: 6px; text-decoration: none;
    transition: all 0.2s ease; cursor: pointer; text-align: center;
    position: relative; overflow: hidden;
  }
  .signup-btn.primary { background: #156082; color: #fff; border: none; }
  .signup-btn.primary::before {
    content: ''; position: absolute; top: -50%; left: -50%;
    width: 200%; height: 200%;
    background: linear-gradient(45deg, transparent 40%, rgba(255,255,255,0.4) 50%, transparent 60%);
    transform: translateX(-100%);
    animation: contact-btn-shine 2.5s ease-in-out infinite;
  }
  @keyframes contact-btn-shine {
    0% { transform: translateX(-100%); }
    50%, 100% { transform: translateX(100%); }
  }
  .signup-btn.primary:hover { background: #1a7a9e; }
  .signup-btn.secondary { background: #6c757d; color: #fff; border: none; }
  .signup-btn.secondary:hover { background: #5a6268; }
  .signup-btn.suggestion { background: transparent; color: #156082; border: 1px solid #156082; }
  .signup-btn.suggestion:hover { background: rgba(21, 96, 130, 0.1); }`;

replace('button-css', oldBtnCSS, newBtnCSS);

// ── 2b. Commands card HTML replacement
const oldCardHTML = `      <div class="rp-commands-card" id="rpCommandsCard">
        <h3>500+ Free Commands</h3>
        <p>Drawing utilities, documentation production and the complete one-click command library — all from inside Revit.</p>
        <ul>
          <li>Create your own commands and workflows</li>
          <li>Connect your own plugins with exposed tool calling</li>
          <li>QA Manager, CoBie Manager and Document Controller built in</li>
          <li>Every routine MEP task, ready to run from the chat</li>
        </ul>
      </div>`;

const newCardHTML = `      <div class="rp-commands-card" id="rpCommandsCard">
        <h3>{{command_count}}+ Free Commands</h3>
        <p>The complete command library, drawing utilities and documentation production — all inside Revit.</p>
        <div class="rp-features-grid">
          <div class="rp-feat"><span class="rp-feat-icon">⚡</span><div><strong>Create your own</strong><br>Build custom commands and workflows from the chat</div></div>
          <div class="rp-feat"><span class="rp-feat-icon">🔌</span><div><strong>Plugin your own tools</strong><br>Expose any external plugin via MCP tool calling</div></div>
          <div class="rp-feat"><span class="rp-feat-icon">📋</span><div><strong>QA + COBie + Doc Control</strong><br>Three full apps built into the Copilot sidebar</div></div>
          <div class="rp-feat"><span class="rp-feat-icon">🔧</span><div><strong>Every MEP routine</strong><br>Pipe sizing, duct routing, schedules, clash checks — one chat</div></div>
          <div class="rp-feat"><span class="rp-feat-icon">📐</span><div><strong>Drawing production</strong><br>Title blocks, annotations, sheet setup — automated</div></div>
          <div class="rp-feat"><span class="rp-feat-icon">🤖</span><div><strong>{{tool_count}} AI tools</strong><br>The full MCP tool surface, callable from natural language</div></div>
        </div>
      </div>`;

replace('commands-card-html', oldCardHTML, newCardHTML);

// ── 2c. Add CSS for .rp-features-grid after .rp-commands-card li::before rule
const afterLiBefore = `  .rp-commands-card li::before {
    content: ""; position: absolute; left: 0; top: 7px;
    width: 5px; height: 5px; border-radius: 50%;
    background: rgba(255,255,255,0.50);
  }`;

const featGridCSS = `  .rp-commands-card li::before {
    content: ""; position: absolute; left: 0; top: 7px;
    width: 5px; height: 5px; border-radius: 50%;
    background: rgba(255,255,255,0.50);
  }
  .rp-features-grid {
    display: grid; grid-template-columns: 1fr 1fr;
    gap: 14px; margin-top: 8px;
  }
  .rp-feat {
    display: flex; gap: 10px; align-items: flex-start;
    font-size: 13px; line-height: 1.45; color: rgba(255,255,255,0.90);
  }
  .rp-feat-icon { font-size: 20px; flex-shrink: 0; margin-top: 1px; }
  .rp-feat strong { color: #fff; font-weight: 600; font-size: 14px; }`;

replace('features-grid-css', afterLiBefore, featGridCSS);

// ── Restore CRLF if original had it
if (hadCRLF) src = src.replace(/\n/g, '\r\n');

writeFileSync(FILE, src, 'utf8');
console.log('\nAll patches applied to templates/home.html');
