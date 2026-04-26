/**
 * sandbox/docs-shell.js
 * Renders the Cursor-style three-column docs layout:
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
  // LEFT RAIL — site-wide navigation
  //
  // TEST-RUN MODE: when serving from /dist/, show only the 4 generated pages.
  // This is the constraint Jordan asked for — at test-run stage the nav should
  // reflect what's actually been built, not the full future site.
  // ============================================================
  const isTestRun = location.pathname.startsWith('/dist/');

  const TEST_RUN_NAV = [
    {
      title: 'Test run · auto-generated',
      links: [
        { href: '/dist/docs/tools/list_rooms/index.html',                       label: 'Tool · list_rooms' },
        { href: '/dist/docs/commands/extend-all-connectors/index.html',         label: 'Command · Extend All Connectors' },
        { href: '/dist/workflows/schedules/index.html',                          label: 'Workflow · Schedules (from skill)' },
        { href: '/dist/demos/place-svp/index.html',                              label: 'Demo · Place SVP' },
      ]
    },
    {
      title: 'Pipeline',
      links: [
        { href: '/handoff/HANDOFF.md',                                           label: 'Handoff doc' },
        { href: '/BUILD%20WEB%20Plan/End%20to%20End%20Automation%20Pipeline.md', label: 'Pipeline plan' },
      ]
    }
  ];

  // Pull demo categories live from the data file so the (full) nav stays in sync
  let demoCats = [];
  try {
    const r = await fetch('/sandbox/data/demos.json');
    if (r.ok) { const j = await r.json(); demoCats = j.categories.map(c => ({ ...c, count: j.demos.filter(d => d.category === c.slug).length })); }
  } catch {}

  const FULL_NAV = [
    {
      title: 'Demos',
      links: demoCats.map(c => ({
        href: '/sandbox/demos/#cat-' + c.slug,
        label: c.title,
        count: c.count
      }))
    },
    {
      title: 'Reference',
      links: [
        { href: '/sandbox/docs/tools/inventory.html',    label: 'All MCP tools',     count: 191 },
        { href: '/sandbox/docs/commands/inventory.html', label: 'All Revit commands', count: 163 },
        { href: '/sandbox/docs/tools/list_rooms.html',   label: 'Tool example' },
        { href: '/sandbox/docs/commands/extend-all-connectors.html', label: 'Command example' },
      ]
    },
    {
      title: 'Workflows',
      links: [
        { href: '/sandbox/workflows/new-job-from-brief.html', label: 'New job from brief' },
      ]
    },
    {
      title: 'Plan docs',
      links: [
        { href: '/BUILD%20WEB%20Plan/Codebase%20Inventory.md',        label: 'Codebase Inventory' },
        { href: '/BUILD%20WEB%20Plan/Attribute%20to%20Webpage%20Map.md', label: 'Attribute → Webpage Map' },
        { href: '/BUILD%20WEB%20Plan/Codebase%20Coverage%20Report.md', label: 'Coverage Report' },
        { href: '/BUILD%20WEB%20Plan/Page%20Structures.md',           label: 'Page Structures' },
        { href: '/BUILD%20WEB%20Plan/Site%20Map.md',                  label: 'Site Map' },
      ]
    }
  ];

  const NAV = isTestRun ? TEST_RUN_NAV : FULL_NAV;

  const path = location.pathname + location.hash;
  left.innerHTML = NAV.map(section => `
    <div class="nav-section">
      <div class="nav-section-title">${section.title}</div>
      ${section.links.map(l => {
        const isActive = (l.href === path) || (location.hash && l.href.endsWith(location.hash));
        return `<a class="nav-link ${isActive ? 'active' : ''}" href="${l.href}">
          <span>${l.label}</span>
          ${l.count != null ? `<span class="nav-count">${l.count}</span>` : ''}
        </a>`;
      }).join('')}
    </div>
  `).join('');

  // Highlight active page in the simple cases
  const here = location.pathname;
  left.querySelectorAll('.nav-link').forEach(a => {
    const href = a.getAttribute('href').split('#')[0];
    if (href === here) a.classList.add('active');
  });

  // Re-highlight on hash change so anchors in left nav stay accurate
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
