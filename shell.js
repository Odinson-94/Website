/**
 * shell.js — Adelphos site shell
 * Injects logo, menubar, dark toggle, hamburger and footer into every page.
 * Menubar is data-driven from /data/nav.json.
 */
(function(){
  // === LOGO (top-left) =====================================================
  const logo = document.createElement('div');
  logo.className = 'logo';
  logo.id = 'logo';
  logo.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 28" preserveAspectRatio="xMidYMid meet" style="height:100px;vertical-align:middle;" aria-label="Adelphos"><text x="0" y="22" font-family="Segoe UI,system-ui,-apple-system,sans-serif" font-size="20" font-weight="500" letter-spacing="-0.4" fill="currentColor">Adelphos<tspan font-weight="700" fill="#156082">.</tspan></text></svg>';
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
    try { nav = await fetch('/data/nav.json').then(r => r.json()); }
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
  // Built from /data/nav.json so menubar is fully data-driven.
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
      nav = await fetch('/data/nav.json').then(r => r.json());
    } catch (e) {
      return;
    }

    for (const item of nav.items) {
      if (item.type === 'dropdown') {
        const wrap = document.createElement('div');
        wrap.className = 'menu-item-dropdown';
        wrap.innerHTML = `<a href="${esc(item.href)}" class="menu-link">${esc(item.label)}</a>`;
        let children = [];
        try {
          const data = await fetch('/' + item.children_from).then(r => r.json());
          children = data.apps || data.services || data.features || [];
        } catch {}

        let nested = [];
        if (item.nested_from) {
          try {
            const nData = await fetch('/' + item.nested_from).then(r => r.json());
            nested = nData.apps || nData.services || nData.features || [];
          } catch {}
        }

        const list = children.map(c => {
          const hasNested = item.nested_parent_slug && c.slug === item.nested_parent_slug && nested.length;
          let subHtml = '';
          if (hasNested) {
            const subList = nested.map(n => `<li><a href="${esc(item.nested_root + n.slug + '/')}"><strong>${esc(n.title)}</strong><span class="ds">${esc(n.tagline || n.headline_claim || '')}</span></a></li>`).join('');
            subHtml = `<div class="dropdown-nested-panel"><p class="nested-label">${esc(item.nested_label || 'Features')}</p><ul class="dropdown-list">${subList}</ul></div>`;
          }
          return `<li class="${hasNested ? 'has-nested' : ''}"><a href="${esc(item.children_root + c.slug + '/')}"><strong>${esc(c.title)}</strong><span class="ds">${esc(c.tagline || c.blurb || '')}</span></a>${subHtml}</li>`;
        }).join('');
        wrap.innerHTML += `
          <div class="dropdown-panel">
            <p class="blurb">${esc(item.label === 'Apps'
              ? 'Eleven apps in development — beta Q2 2026.'
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

    // Highlight current page with teal underline.
    const pathName = location.pathname;
    document.querySelectorAll('#menubar .menu-link[href]').forEach(a => {
      const href = a.getAttribute('href');
      if (pathName === href || (href !== '/' && pathName.startsWith(href.replace(/\/index\.html$/, '/')))) {
        a.classList.add('menu-link-active');
      }
    });
  })();

  // === MENUBAR SCROLL + ACTIVE STATE ========================================
  const scrollStyle = document.createElement('style');
  scrollStyle.textContent = `
    .menubar { background: transparent; border-radius: 999px; padding: 6px 16px; transition: background 0.3s, box-shadow 0.3s, backdrop-filter 0.3s; }
    .menubar.scrolled { background: rgba(255,255,255,0.92); box-shadow: 0 4px 24px rgba(0,0,0,0.10); backdrop-filter: blur(12px); }
    html.dark-mode .menubar.scrolled { background: rgba(30,30,30,0.92); box-shadow: 0 4px 24px rgba(0,0,0,0.30); }

    /* Menu link base state */
    #menubar .menu-link {
      position: relative;
      color: var(--ad-text-1, #222);
      text-decoration: none;
      padding: 8px 14px;
      transition: color 0.3s cubic-bezier(0.65, 0, 0.35, 1);
    }
    html.dark-mode #menubar .menu-link { color: var(--ad-text-1, #e0e0e0); }
    #menubar .menu-link::after {
      content: '';
      position: absolute;
      left: 14px; right: 14px;
      bottom: 4px;
      height: 2px;
      background: var(--ad-teal, #156082);
      transform: scaleX(0);
      transform-origin: left center;
      transition: transform 0.3s cubic-bezier(0.65, 0, 0.35, 1);
    }
    @media (hover: hover) {
      #menubar .menu-link:hover { color: var(--ad-teal, #156082); }
      #menubar .menu-link:hover::after { transform: scaleX(1); }
    }
    #menubar .menu-link.menu-link-active {
      color: var(--ad-teal, #156082);
    }
    #menubar .menu-link.menu-link-active::after {
      transform: scaleX(1);
    }
    /* Focus ring */
    #menubar .menu-link:focus-visible {
      outline: 2px solid var(--ad-teal, #156082);
      outline-offset: 2px;
      border-radius: 4px;
    }
  `;
  document.head.appendChild(scrollStyle);
  window.addEventListener('scroll', function() {
    menubar.classList.toggle('scrolled', window.scrollY > 80);
    logo.classList.toggle('logo-hidden', window.scrollY > 80);
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

  // === FOOTER ==============================================================
  const year = new Date().getFullYear();
  const footerHtml = `
    <div class="footer-inner">
      <div class="footer-grid">
        <div>
          <div class="footer-brand"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 28" preserveAspectRatio="xMidYMid meet" style="height:48px;vertical-align:middle;" aria-label="Adelphos"><text x="0" y="22" font-family="Segoe UI,system-ui,-apple-system,sans-serif" font-size="20" font-weight="500" letter-spacing="-0.4" fill="currentColor">Adelphos<tspan font-weight="700" fill="#156082">.</tspan></text></svg></div>
          <p class="footer-tag">One platform for AI-enabled construction delivery. One suite, one build, all services.</p>
        </div>
        <div>
          <h4>Product</h4>
          <ul>
            <li><a href="/index.html">Home</a></li>
            <li><a href="/demos/index.html">Demos</a></li>
            <li><a href="/docs/tools/index.html">Tools</a></li>
            <li><a href="/docs/commands/index.html">Commands</a></li>
            <li><a href="/workflows/index.html">Workflows</a></li>
          </ul>
        </div>
        <div>
          <h4>Resources</h4>
          <ul>
            <li><a href="/resources/index.html">Free Families</a></li>
            <li><a href="/resources/index.html">Free Templates</a></li>
            <li><a href="/resources/index.html">Free Asset Data</a></li>
            <li><a href="/docs/index.html">Documentation</a></li>
            <li><a href="/docs/index.html">API Reference</a></li>
          </ul>
        </div>
        <div>
          <h4>Company</h4>
          <ul>
            <li><a href="/about/">About Us</a></li>
            <li><a href="/roadmap/">Roadmap</a></li>
            <li><a href="/contact/">Contact</a></li>
            <li><a href="/contact/">Press</a></li>
            <li><a href="/contact/">Careers</a></li>
          </ul>
        </div>
      </div>
      <div class="footer-bottom">
        <span>&copy; ${year} Adelphos AI. All rights reserved.</span>
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

  // Load pulsing neural node favicon on every page
  if (!document.querySelector('script[src*="favicon-pulse"]')) {
    var s = document.createElement('script');
    s.src = '/js/favicon-pulse.js';
    s.defer = true;
    document.head.appendChild(s);
  }
})();
