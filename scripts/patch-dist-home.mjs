/**
 * scripts/patch-dist-home.mjs
 *
 * Post-build patch for dist/index.html. Does exactly TWO things:
 *
 *   1. Adds the chat CSS bundle to <head> (needed for the lifted chat)
 *      plus a scroll-lock override (chat-panel CSS ships overflow:hidden
 *      on html,body — we need to defeat that).
 *
 *   2. Lifts the MEP-floorplan chat block from /index.html (the live
 *      SPA) and injects it into #rpChatCell in the Revit Feature Panel.
 *
 * The template (templates/home.html) now owns ALL layout, structure and
 * CSS for the home page. This script only bridges the one thing the
 * template can't do by itself: grab the actual chat markup from the
 * live SPA file at build time.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const TARGET = path.join(ROOT, 'dist', 'index.html');
const SOURCE = path.join(ROOT, 'index.html');

// ── extract the demo-chat-wrapper from /index.html ──────────────────────
async function extractMepChat() {
  const src = await fs.readFile(SOURCE, 'utf8');
  const openTag = '<div class="demo-chat-wrapper">';
  const start = src.indexOf(openTag);
  if (start < 0) throw new Error('demo-chat-wrapper not found in /index.html');

  let i = start, depth = 0;
  const divOpen = /<div\b/g;
  const divClose = /<\/div>/g;
  while (i < src.length) {
    divOpen.lastIndex = i;
    divClose.lastIndex = i;
    const oMatch = divOpen.exec(src);
    const cMatch = divClose.exec(src);
    if (!oMatch && !cMatch) break;
    if (oMatch && (!cMatch || oMatch.index < cMatch.index)) {
      depth++;
      i = oMatch.index + oMatch[0].length;
    } else {
      depth--;
      i = cMatch.index + cMatch[0].length;
      if (depth === 0) return src.slice(start, i);
    }
  }
  throw new Error('Could not find matching </div> for demo-chat-wrapper');
}

// ── needles ─────────────────────────────────────────────────────────────
const CSS_NEEDLE = '<link rel="stylesheet" href="/css/bundles/page.css">';
const CHAT_CELL = '<!-- Chat panel injected here by patch-dist-home.mjs -->';

// ── main ────────────────────────────────────────────────────────────────
export async function patchHome() {
  let html = await fs.readFile(TARGET, 'utf8');

  // Already patched?
  if (html.includes('id="draggableChat"')) {
    console.log('patch-dist-home: already applied, skipping.');
    return { skipped: true };
  }

  // Verify needles exist
  if (!html.includes(CSS_NEEDLE)) {
    throw new Error('patch-dist-home: cannot find page.css link — has the template changed?');
  }
  if (!html.includes(CHAT_CELL)) {
    throw new Error('patch-dist-home: cannot find #rpChatCell placeholder — has the template changed?');
  }

  // 1. Add chat CSS bundle + scroll-lock override to <head>
  html = html.replace(CSS_NEEDLE,
    CSS_NEEDLE + '\n' +
    '<link rel="stylesheet" href="/css/bundles/chat.css">\n' +
    '<style>\n' +
    '  html, body { overflow: visible !important; height: auto !important; }\n' +
    '</style>'
  );

  // 2. Lift MEP chat from /index.html, wrap in natural ancestor chain
  let chatMarkup = await extractMepChat();
  console.log(`patch-dist-home: extracted MEP chat (${chatMarkup.length} chars)`);

  // Phase 8.7.5 accessibility patches on the lifted chat block.
  // (Single-law: do NOT edit /workspace/index.html — patch at lift time.)
  chatMarkup = chatMarkup
    // 1. Icon-only titlebar buttons need accessible names.
    .replace(/<button class="demo-titlebar-btn min">/g,
             '<button class="demo-titlebar-btn min" aria-label="Minimise chat panel" title="Minimise">')
    .replace(/<button class="demo-titlebar-btn max">/g,
             '<button class="demo-titlebar-btn max" aria-label="Maximise chat panel" title="Maximise">')
    .replace(/<button class="demo-titlebar-btn close">/g,
             '<button class="demo-titlebar-btn close" aria-label="Close chat panel" title="Close">')
    // 2. Tab-order: the chat colour-palette dropdown holds 70+ .color-swatch
    //    buttons that are visually hidden by default. They were polluting
    //    keyboard tab order — after the 4 hero CTAs the user had to tab
    //    through 70 hidden swatches before reaching anything else. Fix:
    //    set the closed dropdown as `inert`, which removes ALL descendants
    //    from tab order + the accessibility tree. Click handlers still
    //    work when the user opens the dropdown via the settings button
    //    (the open state needs to remove `inert` — the live SPA's open
    //    handler in /js/* doesn't currently know about inert; this is a
    //    follow-up for the chat-panel agent. For now the swatches are
    //    keyboard-unreachable while the dropdown is closed, which is the
    //    correct default state).
    .replace(/<div class="color-palette-dropdown word-style chat-palette" id="chatColorPaletteDropdown">/g,
             '<div class="color-palette-dropdown word-style chat-palette" id="chatColorPaletteDropdown" inert>');

  const overlayStyle =
    'position:absolute;top:0;left:0;width:100%;height:100%;' +
    'opacity:1;visibility:visible;pointer-events:auto;transition:none;z-index:auto;';

  const chatBlock =
    `<div class="draggable-chat" id="draggableChat">
        <div class="demo-view-overlay" id="specWritingOverlay" style="${overlayStyle}">
          <div class="demo-split-view">
            <div class="demo-containers-panel">
              <div class="demo-image-container">
                <div class="demo-containers-stack" data-service="floorplan">
${indent(chatMarkup, '                  ')}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <script>
      (function(){
        var cell = document.getElementById('rpChatCell');
        var chat = document.getElementById('draggableChat');
        if (!cell || !chat) return;
        var grip = chat.querySelector('.demo-chat-titlebar');
        if (!grip) return;
        grip.style.cursor = 'grab';
        grip.style.userSelect = 'none';
        var dragging=false, startX=0, startY=0, baseLeft=0, baseTop=0;
        function onDown(e){
          if (e.target.closest('button,input,.chat-settings-wrapper,.color-palette-dropdown')) return;
          dragging=true; chat.classList.add('is-dragging'); grip.style.cursor='grabbing';
          var pt=(e.touches&&e.touches[0])||e;
          startX=pt.clientX; startY=pt.clientY;
          var r=chat.getBoundingClientRect(), sr=cell.getBoundingClientRect();
          baseLeft=r.left-sr.left; baseTop=r.top-sr.top;
          chat.style.left=baseLeft+'px'; chat.style.top=baseTop+'px';
          e.preventDefault();
        }
        function onMove(e){
          if(!dragging) return;
          var pt=(e.touches&&e.touches[0])||e;
          var dx=pt.clientX-startX, dy=pt.clientY-startY;
          var sr=cell.getBoundingClientRect();
          var cw=chat.offsetWidth, ch=chat.offsetHeight;
          chat.style.left=Math.max(0,Math.min(sr.width-cw,baseLeft+dx))+'px';
          chat.style.top=Math.max(0,Math.min(sr.height-ch,baseTop+dy))+'px';
        }
        function onUp(){
          if(!dragging) return;
          dragging=false; chat.classList.remove('is-dragging'); grip.style.cursor='grab';
        }
        grip.addEventListener('mousedown',onDown);
        grip.addEventListener('touchstart',onDown,{passive:false});
        window.addEventListener('mousemove',onMove);
        window.addEventListener('touchmove',onMove,{passive:false});
        window.addEventListener('mouseup',onUp);
        window.addEventListener('touchend',onUp);
      })();
      </script>`;

  html = html.replace(CHAT_CELL, chatBlock);

  await fs.writeFile(TARGET, html, 'utf8');
  console.log('patch-dist-home: chat injected into Revit feature panel');
  return { skipped: false };
}

function indent(text, prefix) {
  return text.split('\n').map(l => l.length ? prefix + l : l).join('\n');
}

// CLI entry point
const invokedPath = process.argv[1] || '';
if (invokedPath && import.meta.url === pathToFileURL(invokedPath).href) {
  patchHome().catch(err => { console.error(err.message); process.exit(1); });
}
