/**
 * sandbox/shell.js
 * Injects the real Adelphos site shell (logo + menubar + dark toggle + hamburger)
 * into every sandbox page. Reuses /css/shared-styles.css so the visual matches
 * the existing site exactly.
 *
 * Usage in any sandbox page:
 *   <head>
 *     <link rel="stylesheet" href="/css/shared-styles.css">
 *     <link rel="stylesheet" href="/sandbox/sandbox.css">
 *     <script>document.documentElement.classList.toggle('dark-mode',
 *       document.cookie.match(/(?:^|; )darkMode=([^;]*)/)?.[1]==='true' ||
 *       localStorage.getItem('darkMode')==='true');</script>
 *   </head>
 *   <body>
 *     <script src="/sandbox/shell.js"></script>
 *     <main>...page content...</main>
 *   </body>
 */
(function(){
  // === SANDBOX BANNER (so user knows they're on a preview page) ============
  const sandboxBar = document.createElement('div');
  sandboxBar.className = 'sandbox-bar';
  const title = document.title || 'Sandbox';
  sandboxBar.innerHTML = `
    <strong>SANDBOX</strong>
    <span style="opacity:0.85;">${title}</span>
    <span class="spacer"></span>
    <a href="/sandbox/">Back to sandbox index</a>
  `;
  document.body.insertBefore(sandboxBar, document.body.firstChild);

  // === LOGO (top-left) =====================================================
  // Neural node pulse CSS
  const nodeStyle = document.createElement('style');
  nodeStyle.textContent = `
    .logo-node { position:relative; width:28px; height:28px; display:inline-block; vertical-align:middle; margin-left:8px; }
    .logo-node .nn-glow { position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); width:22px; height:22px; border-radius:50%; background:rgba(21,96,130,0.30); filter:blur(6px); }
    .logo-node .nn-core { position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); width:12px; height:12px; border-radius:50%; background:linear-gradient(135deg,#1a7a9e,#156082); box-shadow:0 0 10px rgba(21,96,130,0.50); }
    .logo-node .nn-ring { position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); width:12px; height:12px; border-radius:50%; border:3px solid rgba(21,96,130,0.50); box-sizing:border-box; animation:nnPulse 1.5s ease-out infinite; }
    @keyframes nnPulse { 0%{transform:translate(-50%,-50%) scale(1);opacity:0.7;} 100%{transform:translate(-50%,-50%) scale(3);opacity:0;} }
  `;
  document.head.appendChild(nodeStyle);

  const logo = document.createElement('div');
  logo.className = 'logo';
  logo.id = 'logo';
  logo.innerHTML = '<img src="/logos/adelphos-brand.svg" alt="Adelphos" style="height:100px;vertical-align:middle;"><div class="logo-node" style="margin-left:2px;"><div class="nn-glow"></div><div class="nn-core"></div><div class="nn-ring"></div></div>';
  document.body.appendChild(logo);

  // === HAMBURGER BUTTON (mobile only via shared-styles.css) ================
  const hamburger = document.createElement('button');
  hamburger.className = 'hamburger-btn';
  hamburger.id = 'hamburgerBtn';
  hamburger.setAttribute('aria-label', 'Menu');
  hamburger.innerHTML = '<span></span><span></span><span></span>';
  document.body.appendChild(hamburger);

  // === MOBILE MENU OVERLAY =================================================
  const mobileMenu = document.createElement('div');
  mobileMenu.className = 'mobile-menu-overlay';
  mobileMenu.id = 'mobileMenuOverlay';
  document.body.appendChild(mobileMenu);

  // Mobile menu populated from the same nav.json the menubar uses.
  (async function renderMobileMenu(){
    const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
    let nav;
    try { nav = await fetch('/sandbox/data/nav.json').then(r => r.json()); }
    catch { return; }
    const html = nav.items.map(it => {
      if (it.type === 'coming-soon') {
        return `<div class="mobile-menu-coming-soon">${esc(it.label)} <span class="coming-soon-tag">Soon</span></div>`;
      }
      if (it.type === 'dropdown-inline' && it.children) {
        const kids = it.children.map(c => `<a href="${esc(c.href)}" class="mobile-menu-link mobile-menu-sublink">${esc(c.title)}</a>`).join('');
        return `<a href="${esc(it.href)}" class="mobile-menu-link"><strong>${esc(it.label)}</strong></a>${kids}`;
      }
      return `<a href="${esc(it.href)}" class="mobile-menu-link">${esc(it.label)}</a>`;
    }).join('<div class="mobile-menu-divider"></div>');
    mobileMenu.innerHTML = html;
  })();

  // === MENUBAR (top centre) ================================================
  // Built from /sandbox/data/nav.json so menubar is fully data-driven.
  // Edit nav.json + apps.json + agentic-services.json → menu updates everywhere.
  const menubar = document.createElement('nav');
  menubar.className = 'menubar';
  menubar.id = 'menubar';
  menubar.innerHTML = `
    <div class="menu-tail" id="menuTail"></div>
    <div class="menu-highlight" id="menuHighlight"></div>
  `;
  document.body.appendChild(menubar);

  // Render menubar items asynchronously from nav.json + child registries
  (async function renderMenubar(){
    const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
    let nav;
    try {
      nav = await fetch('/sandbox/data/nav.json').then(r => r.json());
    } catch (e) {
      console.warn('nav.json not loaded:', e); return;
    }

    for (const item of nav.items) {
      if (item.type === 'dropdown') {
        // Children loaded from another JSON registry (apps.json, services.json, ...)
        const wrap = document.createElement('div');
        wrap.className = 'menu-item-dropdown';
        wrap.innerHTML = `<a href="${esc(item.href)}" class="menu-link">${esc(item.label)}</a>`;
        let children = [];
        try {
          const data = await fetch('/' + item.children_from).then(r => r.json());
          children = data.apps || data.services || data.features || [];
        } catch {}
        const list = children.map(c => `<li><a href="${esc(item.children_root + c.slug + '/')}"><strong>${esc(c.title)}</strong><span class="ds">${esc(c.tagline || c.blurb || '')}</span></a></li>`).join('');
        wrap.innerHTML += `
          <div class="dropdown-panel">
            <p class="blurb">${esc(item.label === 'Apps'
              ? 'Production apps that ship today.'
              : 'Services where Adelphos runs the agent for you.')}</p>
            <ul class="dropdown-list">${list}</ul>
          </div>`;
        menubar.appendChild(wrap);
      } else if (item.type === 'dropdown-inline') {
        // Children listed directly in nav.json (no extra fetch)
        const wrap = document.createElement('div');
        wrap.className = 'menu-item-dropdown';
        wrap.innerHTML = `<a href="${esc(item.href)}" class="menu-link">${esc(item.label)}</a>`;
        const list = (item.children || []).map(c =>
          `<li><a href="${esc(c.href)}"><strong>${esc(c.title)}</strong><span class="ds">${esc(c.tagline || '')}</span></a></li>`
        ).join('');
        wrap.innerHTML += `
          <div class="dropdown-panel">
            <p class="blurb">${esc(item.blurb || '')}</p>
            <ul class="dropdown-list">${list}</ul>
          </div>`;
        menubar.appendChild(wrap);
      } else if (item.type === 'coming-soon') {
        const wrap = document.createElement('div');
        wrap.className = 'menu-item-coming-soon';
        const items = (item.items || []).map(i => `<li>${esc(i)}</li>`).join('');
        wrap.innerHTML = `
          <a class="menu-link">${esc(item.label)}</a>
          <div class="coming-soon-dropdown">
            <span class="badge">Coming Soon</span>
            <p class="blurb">${esc(item.blurb || '')}</p>
            <ul>${items}</ul>
          </div>`;
        menubar.appendChild(wrap);
      } else {
        const a = document.createElement('a');
        a.href = item.href; a.className = 'menu-link'; a.textContent = item.label;
        menubar.appendChild(a);
      }
    }

    // Highlight current page
    const pathName = location.pathname;
    document.querySelectorAll('#menubar .menu-link[href]').forEach(a => {
      const href = a.getAttribute('href');
      if (pathName === href || (href !== '/' && pathName.startsWith(href.replace(/\/index\.html$/, '/')))) {
        a.style.color = '#156082';
        a.style.fontWeight = '600';
      }
    });
  })();

  // === MENUBAR SCROLL OPACITY ===============================================
  const scrollStyle = document.createElement('style');
  scrollStyle.textContent = `
    .menubar { background: transparent; border-radius: 999px; padding: 6px 16px; transition: background 0.3s, box-shadow 0.3s, backdrop-filter 0.3s; }
    .menubar.scrolled { background: rgba(255,255,255,0.92); box-shadow: 0 4px 24px rgba(0,0,0,0.10); backdrop-filter: blur(12px); }
    html.dark-mode .menubar.scrolled { background: rgba(30,30,30,0.92); box-shadow: 0 4px 24px rgba(0,0,0,0.30); }
  `;
  document.head.appendChild(scrollStyle);
  window.addEventListener('scroll', function() {
    menubar.classList.toggle('scrolled', window.scrollY > 80);
  }, { passive: true });

  // === DARK TOGGLE (top right) =============================================
  const darkToggle = document.createElement('div');
  darkToggle.className = 'dark-toggle';
  darkToggle.id = 'darkToggle';
  darkToggle.innerHTML = `
    <span class="dark-toggle-label">Dark</span>
    <div class="toggle-switch" id="toggleSwitch"></div>
  `;
  document.body.appendChild(darkToggle);

  // === DARK MODE TOGGLE ====================================================
  document.getElementById('toggleSwitch').addEventListener('click', () => {
    const isDark = document.documentElement.classList.toggle('dark-mode');
    document.cookie = `darkMode=${isDark}; path=/; max-age=31536000; SameSite=Lax`;
    try { localStorage.setItem('darkMode', String(isDark)); } catch {}
  });
  // sync .active class for the existing toggle visuals
  if (document.documentElement.classList.contains('dark-mode')) {
    document.getElementById('toggleSwitch').classList.add('active');
  }
  new MutationObserver(() => {
    document.getElementById('toggleSwitch')
      .classList.toggle('active', document.documentElement.classList.contains('dark-mode'));
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

  // === HAMBURGER (mobile) ==================================================
  hamburger.addEventListener('click', () => {
    hamburger.classList.toggle('active');
    mobileMenu.classList.toggle('active');
  });

  // === FOOTER (must run AFTER the body's content has been parsed,
  //     otherwise it appears at the TOP of the page because everything
  //     after the <script src="shell.js"> tag is still pending parse) ======
  const year = new Date().getFullYear();
  const footerHtml = `
    <div class="footer-inner">
      <div class="footer-grid">
        <div>
          <div class="footer-brand"><img src="/logos/adelphos-brand.svg" alt="Adelphos" style="height:68px;vertical-align:middle;"> <div class="logo-node"><div class="nn-glow"></div><div class="nn-core"></div><div class="nn-ring"></div></div></div>
          <p class="footer-tag">One platform for AI-enabled construction delivery. One suite, one build, all services.</p>
        </div>
        <div>
          <h4>Product</h4>
          <ul>
            <li><a href="/">Home</a></li>
            <li><a href="/sandbox/demos/">Demos</a></li>
            <li><a href="/sandbox/docs/tools/inventory.html">Tools (191)</a></li>
            <li><a href="/sandbox/docs/commands/inventory.html">Commands (163)</a></li>
            <li><a href="/sandbox/workflows/new-job-from-brief.html">Workflows</a></li>
          </ul>
        </div>
        <div>
          <h4>Resources</h4>
          <ul>
            <li><a href="#">Free Families</a></li>
            <li><a href="#">Free Templates</a></li>
            <li><a href="#">Free Asset Data</a></li>
            <li><a href="#">Documentation</a></li>
            <li><a href="#">API Reference</a></li>
          </ul>
        </div>
        <div>
          <h4>Company</h4>
          <ul>
            <li><a href="/about/">About Us</a></li>
            <li><a href="/roadmap/">Roadmap</a></li>
            <li><a href="/contact/">Contact</a></li>
            <li><a href="#">Press</a></li>
            <li><a href="#">Careers</a></li>
          </ul>
        </div>
        <div>
          <h4>Plan docs</h4>
          <ul>
            <li><a href="/BUILD%20WEB%20Plan/Codebase%20Inventory.md">Codebase Inventory</a></li>
            <li><a href="/BUILD%20WEB%20Plan/Attribute%20to%20Webpage%20Map.md">Attribute Map</a></li>
            <li><a href="/BUILD%20WEB%20Plan/Codebase%20Coverage%20Report.md">Coverage Report</a></li>
            <li><a href="/BUILD%20WEB%20Plan/Page%20Structures.md">Page Structures</a></li>
            <li><a href="/BUILD%20WEB%20Plan/Site%20Map.md">Site Map</a></li>
          </ul>
        </div>
      </div>
      <div class="footer-bottom">
        <span>© ${year} JPA Designs Ltd. Adelphos AI is a trading division.</span>
        <span class="legal">
          <a href="/privacy/">Privacy</a>
          <a href="/terms/">Terms</a>
          <a href="/contact/">Contact</a>
        </span>
      </div>
    </div>
  `;

  function appendFooter() {
    const footer = document.createElement('footer');
    footer.className = 'sandbox-footer';
    footer.innerHTML = footerHtml;
    document.body.appendChild(footer);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', appendFooter);
  } else {
    appendFooter();
  }
})();
