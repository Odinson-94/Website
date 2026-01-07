// ============================================
// SHARED FOOTER - SINGLE SOURCE OF TRUTH
// All pages MUST use this file for footer content
// ============================================

(function() {
  'use strict';
  
  // Detect base path - works for both file:// and http:// protocols
  // If we're in a subfolder (about/, contact/, etc.), prefix is '../'
  // If we're at root (index.html), prefix is './'
  const path = window.location.pathname;
  const isSubfolder = path.includes('/about/') || path.includes('/contact/') || 
                      path.includes('/roadmap/') || path.includes('/privacy/') || 
                      path.includes('/terms/');
  const base = isSubfolder ? '../' : './';
  
  // Define all site pages - add new pages here and menu/footer will auto-update
  const sitePages = [
    { name: 'Home', href: base, id: 'footerHome' },
    { name: 'About Us', href: base + 'about/', id: 'footerAboutUs' },
    { name: 'Roadmap', href: base + 'roadmap/', id: 'footerRoadmap' },
    { name: 'Contact', href: base + 'contact/', id: 'footerContact' }
  ];
  
  // Legal pages
  const legalPages = [
    { name: 'Privacy Policy', href: base + 'privacy/' },
    { name: 'Terms of Service', href: base + 'terms/' }
  ];
  
  // Build compact footer HTML - copyright below tagline, legal as 4th column
  const currentYear = new Date().getFullYear();
  
  const footerHTML = `
    <div class="footer-content footer-content-compact">
      <div class="footer-brand">
        <a href="${base}" class="footer-logo">
          <span class="footer-logo-adelphos">ADELPHOS</span>
          <span class="footer-logo-ai">AI</span>
        </a>
        <p class="footer-tagline">The future of construction design automation</p>
        <p class="footer-copyright">&copy; ${currentYear} Adelphos AI. All rights reserved.</p>
      </div>
      
      <div class="footer-links">
        <div class="footer-links-column">
          <h4 class="footer-links-title">Navigation</h4>
          <ul class="footer-links-list">
            ${sitePages.map(page => `<li><a href="${page.href}" id="${page.id}">${page.name}</a></li>`).join('')}
          </ul>
        </div>
        
        <div class="footer-links-column">
          <h4 class="footer-links-title">Resources</h4>
          <ul class="footer-links-list">
            <li><a href="#" onclick="if(window.adelphosSignup){window.adelphosSignup.openModal('early_access');}return false;">Early Access</a></li>
            <li><a href="${base}roadmap/">Product Roadmap</a></li>
          </ul>
        </div>
        
        <div class="footer-links-column">
          <h4 class="footer-links-title">Connect</h4>
          <ul class="footer-links-list">
            <li><a href="https://www.linkedin.com/company/adelphos-ai" target="_blank">LinkedIn</a></li>
            <li><a href="mailto:hello@adelphos.ai">Email Us</a></li>
          </ul>
        </div>
        
        <div class="footer-links-column">
          <h4 class="footer-links-title">Legal</h4>
          <ul class="footer-links-list">
            ${legalPages.map(page => `<li><a href="${page.href}">${page.name}</a></li>`).join('')}
          </ul>
        </div>
      </div>
    </div>
  `;
  
  // Apply to standard footer container (other pages)
  const footerContainer = document.getElementById('siteFooter');
  if (footerContainer) {
    footerContainer.innerHTML = footerHTML;
  }
  
  // Apply to BUILD X embedded footer (index.html View 11)
  const buildxFooter = document.getElementById('buildxSiteFooter');
  if (buildxFooter) {
    buildxFooter.innerHTML = footerHTML;
  }
})();
