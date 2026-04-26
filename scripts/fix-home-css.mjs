import { readFileSync, writeFileSync } from 'fs';

const file = 'templates/home.html';
let content = readFileSync(file, 'utf8');
const eol = content.includes('\r\n') ? '\r\n' : '\n';
const lines = content.split(eol);
let changed = 0;

// --- 1. Background container: height → aspect-ratio ---
let idx = lines.findIndex(l => l.includes('height: 1020px;'));
if (idx >= 0) {
  lines[idx] = lines[idx].replace('height: 1020px;', 'aspect-ratio: 1576 / 1082;');
  console.log(`[1] aspect-ratio at line ${idx + 1}`);
  changed++;
} else {
  console.error('[1] FAIL: height: 1020px not found');
}

// --- 2. Content width 80% → 70% ---
idx = lines.findIndex(l => l.includes('width: 80% !important;'));
if (idx >= 0) {
  lines[idx] = lines[idx].replace('width: 80% !important;', 'width: 70% !important;');
  console.log(`[2] width 70% at line ${idx + 1}`);
  changed++;
} else {
  console.error('[2] FAIL: width: 80% not found');
}

// --- 3. Remove old button CSS → contact page CSS ---
const startIdx = lines.findIndex(l => l.includes('.home-hero .cta-note'));
const endIdx = lines.findIndex(
  (l, i) => i >= startIdx && l.includes('.home-hero .signup-btn.suggestion:hover')
);
if (startIdx >= 0 && endIdx >= startIdx) {
  const newCSS = [
    '    /* ============================================',
    '       BUTTONS - Build X Style',
    '       ============================================ */',
    '    .button-row {',
    '      display: flex;',
    '      flex-direction: column;',
    '      gap: 12px;',
    '      width: 100%;',
    '      margin-top: 10px;',
    '    }',
    '    ',
    '    .button-row-inline {',
    '      display: flex;',
    '      gap: 16px;',
    '      width: 100%;',
    '    }',
    '    ',
    '    .signup-btn {',
    '      font-family: \'Inter\', sans-serif;',
    '      font-size: 13px;',
    '      font-weight: 500;',
    '      padding: 12px 28px;',
    '      border-radius: 6px;',
    '      text-decoration: none;',
    '      transition: all 0.2s ease;',
    '      cursor: pointer;',
    '      text-align: center;',
    '      position: relative;',
    '      overflow: hidden;',
    '    }',
    '    ',
    '    .signup-btn.primary {',
    '      background: #156082;',
    '      color: #fff;',
    '      border: none;',
    '    }',
    '    ',
    '    .signup-btn.primary::before {',
    '      content: \'\';',
    '      position: absolute;',
    '      top: -50%;',
    '      left: -50%;',
    '      width: 200%;',
    '      height: 200%;',
    '      background: linear-gradient(',
    '        45deg,',
    '        transparent 40%,',
    '        rgba(255, 255, 255, 0.4) 50%,',
    '        transparent 60%',
    '      );',
    '      transform: translateX(-100%);',
    '      animation: contact-btn-shine 2.5s ease-in-out infinite;',
    '    }',
    '    ',
    '    @keyframes contact-btn-shine {',
    '      0% {',
    '        transform: translateX(-100%);',
    '      }',
    '      50%, 100% {',
    '        transform: translateX(100%);',
    '      }',
    '    }',
    '    ',
    '    .signup-btn.primary:hover {',
    '      background: #1a7a9e;',
    '    }',
    '    ',
    '    .signup-btn.secondary {',
    '      background: #6c757d;',
    '      color: #fff;',
    '      border: none;',
    '    }',
    '    ',
    '    .signup-btn.secondary:hover {',
    '      background: #5a6268;',
    '    }',
    '    ',
    '    .signup-btn.suggestion {',
    '      background: transparent;',
    '      color: #156082;',
    '      border: 1px solid #156082;',
    '    }',
    '    ',
    '    .signup-btn.suggestion:hover {',
    '      background: rgba(21, 96, 130, 0.1);',
    '    }',
  ];
  const count = endIdx - startIdx + 1;
  lines.splice(startIdx, count, ...newCSS);
  console.log(`[3] Button CSS replaced: removed ${count} lines (${startIdx + 1}-${endIdx + 1}), inserted ${newCSS.length} lines`);
  changed++;
} else {
  console.error(`[3] FAIL: button CSS range not found (start=${startIdx}, end=${endIdx})`);
}

// --- 4a. Copilot logo size ---
idx = lines.findIndex(l => l.includes('width: 240px; height: 240px;'));
if (idx >= 0) {
  lines[idx] = lines[idx].replace('width: 240px; height: 240px;', 'width: 312px; height: 312px;');
  console.log(`[4a] Logo size at line ${idx + 1}`);
  changed++;
} else {
  console.error('[4a] FAIL: width: 240px not found');
}

// --- 4b. Copilot logo border-radius ---
idx = lines.findIndex(l => l.includes('border-radius: 32px;'));
if (idx >= 0) {
  lines[idx] = lines[idx].replace('border-radius: 32px;', 'border-radius: 42px;');
  console.log(`[4b] Logo radius at line ${idx + 1}`);
  changed++;
} else {
  console.error('[4b] FAIL: border-radius: 32px not found');
}

// --- 4c. Copilot logo shadow ---
idx = lines.findIndex(l => l.includes('drop-shadow(0 24px 50px'));
if (idx >= 0) {
  lines[idx] = lines[idx].replace(
    'filter: drop-shadow(0 24px 50px rgba(0,0,0,0.55));',
    'filter: drop-shadow(0 30px 60px rgba(0,0,0,0.55));'
  );
  console.log(`[4c] Logo shadow at line ${idx + 1}`);
  changed++;
} else {
  console.error('[4c] FAIL: drop-shadow 24px not found');
}

// --- 5. Hero margin-bottom 80px → 120px ---
idx = lines.findIndex(l => l.includes('margin-bottom: 80px;'));
if (idx >= 0) {
  lines[idx] = lines[idx].replace('margin-bottom: 80px;', 'margin-bottom: 120px;');
  console.log(`[5] Hero margin at line ${idx + 1}`);
  changed++;
} else {
  console.error('[5] FAIL: margin-bottom: 80px not found');
}

// --- 6. Verify HTML buttons ---
const btnRowIdx = lines.findIndex(l => l.includes('<div class="button-row">'));
if (btnRowIdx >= 0) {
  const expected = [
    '      <div class="button-row">',
    '        <div class="button-row-inline">',
    '          <a href="#" class="signup-btn primary" onclick="window.adelphosSignup.openModal(\'early_access\'); return false;">Sign Up for Early Access</a>',
    '          <a href="#" class="signup-btn secondary" onclick="window.adelphosSignup.openModal(\'news\'); return false;">Sign Up for News</a>',
    '        </div>',
    '        <a href="#" class="signup-btn suggestion" onclick="window.adelphosSignup.openModal(\'suggestion\'); return false;">Got a suggestion? We\'d be happy to include it.</a>',
    '      </div>',
  ];
  let match = true;
  for (let i = 0; i < expected.length; i++) {
    const actual = lines[btnRowIdx + i].replace(/\r$/, '');
    if (actual !== expected[i]) {
      console.error(`[6] HTML mismatch at line ${btnRowIdx + i + 1}:`);
      console.error(`    expected: ${JSON.stringify(expected[i])}`);
      console.error(`    actual:   ${JSON.stringify(actual)}`);
      match = false;
    }
  }
  if (match) console.log(`[6] HTML buttons verified OK at line ${btnRowIdx + 1}`);
} else {
  console.error('[6] FAIL: <div class="button-row"> not found');
}

// --- Write back with original line endings ---
writeFileSync(file, lines.join(eol), 'utf8');
console.log(`\nDone — ${changed} replacement(s) applied, line ending: ${eol === '\r\n' ? 'CRLF' : 'LF'}`);
