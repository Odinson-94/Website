/**
 * sandbox/docs-shell.js
 * Renders the three-column docs layout:
 *   left rail = site-wide nav (sections + counts)
 *   right rail = "On this page" (auto-built from H2/H3 inside <main class="docs-content">)
 *
 * Usage on any sandbox page:
 *   <body>
 *     <script src="/sandbox/shell.js"></script>     ← top menubar
 *     <div class="docs-layout">
 *       <aside class="docs-left"></aside>
 *       <main class="docs-content">…page content with H2/H3…</main>
 *       <aside class="docs-right"></aside>
 *     </div>
 *     <script src="/sandbox/docs-shell.js"></script>
 *   </body>
 */
(async function(){
  const left  = document.querySelector('.docs-left');
  const right = document.querySelector('.docs-right');
  const main  = document.querySelector('.docs-content');
  if (!left || !main) return;

  // ============================================================
  // LEFT RAIL — auto-generated from live data
  //
  // Detects which section the user is in (tools, commands, demos,
  // etc.) and builds a category index from the registry JSON.
  // ============================================================
  const here = location.pathname;
  const esc  = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

  const CATEGORY_LABELS = {
    action: 'Action (write)', context: 'Context (read)', adelphos: 'Adelphos',
    calculator: 'Calculators', debug: 'Debug', snapshot: 'Snapshot'
  };
  const BRIDGE_LABELS = {
    SelfDebug: 'Debug', DrawingExporter: 'Drawing exporter', RevitContext: 'Revit',
    ParameterEditor: 'Parameter editor', QAManager: 'QA Manager', Snapshot: 'Snapshot'
  };

  let NAV = [];

  const isToolsSection   = here.includes('/docs/tools');
  const isCommandSection = here.includes('/docs/commands');

  if (isToolsSection) {
    try {
      const tools = await fetch('/sandbox/data/tools.json').then(r => r.json());
      const byCat = {};
      tools.forEach(t => {
        const k = t.category || 'uncategorised';
        if (!byCat[k]) byCat[k] = [];
        byCat[k].push(t);
      });
      const catOrder = ['context','action','adelphos','snapshot','calculator','debug','uncategorised'];
      NAV.push({
        title: 'By category',
        links: catOrder.filter(k => byCat[k]).map(k => ({
          href: '/dist/docs/tools/index.html#cat-' + k,
          label: CATEGORY_LABELS[k] || k,
          count: byCat[k].length,
          filter: k
        }))
      });

      const byBridge = {};
      tools.forEach(t => {
        const k = t.bridge || '';
        if (k) { if (!byBridge[k]) byBridge[k] = []; byBridge[k].push(t); }
      });
      if (Object.keys(byBridge).length) {
        NAV.push({
          title: 'By bridge',
          links: Object.keys(byBridge).sort().map(k => ({
            href: '/dist/docs/tools/index.html#bridge-' + k.toLowerCase(),
            label: BRIDGE_LABELS[k] || k,
            count: byBridge[k].length,
            filter: k
          }))
        });
      }
    } catch {}
  } else if (isCommandSection) {
    try {
      const cmds = await fetch('/data/registries/command_registry.json').then(r => r.json());
      const arr = Array.isArray(cmds) ? cmds : [cmds];
      const byPillar = {};
      arr.forEach(c => {
        const k = c.pillar || 'Uncategorised';
        if (!byPillar[k]) byPillar[k] = [];
        byPillar[k].push(c);
      });
      const sorted = Object.keys(byPillar).sort((a,b) => a === 'Uncategorised' ? 1 : b === 'Uncategorised' ? -1 : a.localeCompare(b));
      NAV.push({
        title: 'By mini-project',
        links: sorted.map(k => ({
          href: '/dist/docs/commands/index.html#pillar-' + k.toLowerCase().replace(/\s+/g,'-'),
          label: k,
          count: byPillar[k].length
        }))
      });
    } catch {}
  }

  // Cross-section links at bottom
  NAV.push({
    title: 'Documentation',
    links: [
      { href: '/dist/docs/index.html',            label: 'Docs home' },
      { href: '/dist/docs/tools/index.html',      label: 'All MCP tools' },
      { href: '/dist/docs/commands/index.html',    label: 'All Revit commands' },
      { href: '/dist/docs/calc-engines/index.html',label: 'Calculation engines' },
      { href: '/dist/demos/index.html',            label: 'Demos' },
      { href: '/dist/workflows/index.html',        label: 'Workflows' },
    ]
  });

  const path = here + location.hash;
  left.innerHTML = NAV.map(section => `
    <div class="nav-section">
      <div class="nav-section-title">${section.title}</div>
      ${section.links.map(l => {
        const isActive = (l.href === path) || (location.hash && l.href.endsWith(location.hash));
        return `<a class="nav-link ${isActive ? 'active' : ''}" href="${l.href}"${l.filter ? ' data-filter="'+esc(l.filter)+'"' : ''}>
          <span>${l.label}</span>
          ${l.count != null ? `<span class="nav-count">${l.count}</span>` : ''}
        </a>`;
      }).join('')}
    </div>
  `).join('');

  // Click on a category/bridge link filters the main table if on an inventory page
  left.querySelectorAll('.nav-link[data-filter]').forEach(a => {
    a.addEventListener('click', e => {
      const f = a.dataset.filter;
      const catSel = document.getElementById('categoryFilter');
      const bridgeSel = document.getElementById('bridgeFilter');
      const pillarSel = document.getElementById('pillarFilter');
      if (catSel && a.closest('[class*="nav-section"]').querySelector('.nav-section-title').textContent.includes('category')) {
        catSel.value = f; catSel.dispatchEvent(new Event('input'));
      } else if (bridgeSel && a.closest('[class*="nav-section"]').querySelector('.nav-section-title').textContent.includes('bridge')) {
        bridgeSel.value = f; bridgeSel.dispatchEvent(new Event('input'));
      } else if (pillarSel) {
        pillarSel.value = f; pillarSel.dispatchEvent(new Event('input'));
      }
    });
  });

  // Highlight active page
  left.querySelectorAll('.nav-link').forEach(a => {
    const href = a.getAttribute('href').split('#')[0];
    if (href === here) a.classList.add('active');
  });

  window.addEventListener('hashchange', () => {
    left.querySelectorAll('.nav-link').forEach(a => {
      const isActive = a.getAttribute('href') === location.pathname + location.hash;
      a.classList.toggle('active', isActive);
    });
  });

  // ============================================================
  // RIGHT RAIL — "On this page"
  // Reads H2 and H3 inside <main class="docs-content">, plus any element
  // with [data-toc] (used to add custom entries — e.g. one per demo card)
  // ============================================================
  if (!right) return;

  function buildToc() {
    const items = Array.from(main.querySelectorAll('h2[id], h3[id], [data-toc][id]'));
    if (!items.length) { right.innerHTML = ''; return; }

    right.innerHTML = `
      <div class="toc-title">On this page</div>
      ${items.map(el => {
        const isH3   = el.tagName === 'H3' || el.dataset.tocLevel === 'h3';
        const label  = el.dataset.tocLabel || el.textContent.trim();
        return `<a class="toc-link ${isH3 ? 'toc-h3' : ''}" href="#${el.id}" data-target="${el.id}">${label}</a>`;
      }).join('')}
    `;

    // Smooth scroll within page (the native jump can be jarring under sticky menubar)
    right.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', e => {
        const id = a.dataset.target;
        const el = document.getElementById(id);
        if (!el) return;
        e.preventDefault();
        const top = el.getBoundingClientRect().top + window.scrollY - 110;
        window.scrollTo({ top, behavior: 'smooth' });
        history.replaceState(null, '', '#' + id);
      });
    });

    // Highlight active section as user scrolls
    const links = right.querySelectorAll('.toc-link');
    const map   = new Map(items.map(el => [el.id, right.querySelector(`[data-target="${el.id}"]`)]));
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        const link = map.get(e.target.id);
        if (!link) return;
        if (e.isIntersecting) {
          links.forEach(l => l.classList.remove('active'));
          link.classList.add('active');
        }
      });
    }, { rootMargin: '-30% 0px -55% 0px' });
    items.forEach(el => io.observe(el));
  }

  // Build now, plus rebuild after any async content (demos cards) populates
  buildToc();
  // If the demos page injected cards after fetch, rebuild once they're in DOM
  const mo = new MutationObserver(() => buildToc());
  mo.observe(main, { childList: true, subtree: true });
})();
