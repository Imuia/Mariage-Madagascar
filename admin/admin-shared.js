/* Mariage Madagascar — Shared Admin Sidebar & UI Logic */
(function () {
  'use strict';

  // Determine current active page filename
  function getCurrentPage() {
    const attr = document.documentElement.getAttribute('data-admin-page');
    if (attr) return attr.toLowerCase();
    const path = window.location.pathname.split('/').pop();
    return (path || 'index.html').toLowerCase();
  }

  const currentPage = getCurrentPage();

  const financePages = [
    'finance.html',
    'paiements.html',
    'facturation.html',
    'commissions.html',
    'rapports.html'
  ];

  const isFinanceActive = financePages.includes(currentPage);

  function renderSidebarHTML() {
    return `
      <!-- Mobile Overlay Backdrop -->
      <div id="mm-sidebar-overlay" class="mm-sidebar-overlay" aria-hidden="true"></div>

      <!-- Main Sidebar Container -->
      <aside id="mm-admin-sidebar" class="mm-admin-sidebar" aria-label="Navigation Admin">
        <!-- Brand Header -->
        <div class="mm-sidebar-brand">
          <div class="mm-brand-logo">
            <span class="material-symbols-outlined text-primary text-xl">ac_unit</span>
          </div>
          <div class="mm-brand-text">
            <h1 class="text-base font-headline font-semibold text-primary leading-tight">Admin Mariage Madagascar</h1>
            <p class="text-[10px] text-on-surface-variant font-medium uppercase tracking-wider">Luxury Madagascar</p>
          </div>
          <button id="mm-sidebar-close" class="mm-sidebar-close-btn md:hidden" aria-label="Fermer le menu">
            <span class="material-symbols-outlined">close</span>
          </button>
        </div>

        <!-- Navigation Links -->
        <nav class="mm-sidebar-nav">
          <a href="index.html" class="mm-nav-link ${currentPage === 'index.html' ? 'active' : ''}">
            <span class="material-symbols-outlined" style="${currentPage === 'index.html' ? "font-variation-settings:'FILL' 1;" : ''}">dashboard</span>
            <span>Tableau de bord</span>
          </a>

          <a href="crm.html" class="mm-nav-link ${currentPage === 'crm.html' ? 'active' : ''}">
            <span class="material-symbols-outlined" style="${currentPage === 'crm.html' ? "font-variation-settings:'FILL' 1;" : ''}">groups</span>
            <span>CRM</span>
          </a>

          <a href="sejours.html" class="mm-nav-link ${currentPage === 'sejours.html' ? 'active' : ''}">
            <span class="material-symbols-outlined" style="${currentPage === 'sejours.html' ? "font-variation-settings:'FILL' 1;" : ''}">explore</span>
            <span>Séjours</span>
          </a>

          <a href="mariages.html" class="mm-nav-link ${currentPage === 'mariages.html' ? 'active' : ''}">
            <span class="material-symbols-outlined" style="${currentPage === 'mariages.html' ? "font-variation-settings:'FILL' 1;" : ''}">favorite</span>
            <span>Mariages</span>
          </a>

          <!-- Finance Collapsible Group -->
          <div class="mm-nav-group ${isFinanceActive ? 'expanded' : ''}" id="mm-finance-group">
            <button type="button" class="mm-nav-link mm-group-toggle ${isFinanceActive ? 'parent-active' : ''}" id="mm-finance-toggle" aria-expanded="${isFinanceActive}">
              <span class="material-symbols-outlined" style="${isFinanceActive ? "font-variation-settings:'FILL' 1;" : ''}">payments</span>
              <span>Finance</span>
              <span class="material-symbols-outlined mm-arrow-icon">expand_more</span>
            </button>
            <div class="mm-subnav" id="mm-finance-subnav">
              <a href="finance.html" class="mm-sublink ${currentPage === 'finance.html' ? 'active' : ''}">Vue financière</a>
              <a href="paiements.html" class="mm-sublink ${currentPage === 'paiements.html' ? 'active' : ''}">Paiements</a>
              <a href="facturation.html" class="mm-sublink ${currentPage === 'facturation.html' ? 'active' : ''}">Factures et devis</a>
              <a href="commissions.html" class="mm-sublink ${currentPage === 'commissions.html' ? 'active' : ''}">Commissions</a>
              <a href="rapports.html" class="mm-sublink ${currentPage === 'rapports.html' ? 'active' : ''}">Rapports</a>
            </div>
          </div>

          <a href="parametres.html" class="mm-nav-link ${currentPage === 'parametres.html' ? 'active' : ''}">
            <span class="material-symbols-outlined" style="${currentPage === 'parametres.html' ? "font-variation-settings:'FILL' 1;" : ''}">settings</span>
            <span>Paramètres</span>
          </a>

          <a href="parametres.html#support" class="mm-nav-link ${window.location.hash === '#support' ? 'active' : ''}">
            <span class="material-symbols-outlined">help</span>
            <span>Support</span>
          </a>
        </nav>

        <!-- Bottom Profile Section -->
        <div class="mm-sidebar-footer">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-full border border-primary/20 overflow-hidden flex-shrink-0 bg-surface-container">
              <img src="https://lh3.googleusercontent.com/aida-public/AB6AXuCc_4P6656nhCyCLJokjeiftXvyUf4O5fFzAp9wV8yEIwSSOwNJXy9xjjUtgtq8LTKkkMGKJKBbtt8EymINv4gnLigJaxY3xyvs3TFRObrXDpIakpRpLqhMEVPzbYq7yLZ_mVXw2evKr-g82wDEvWPCVbUfpbGYQtcFlT995a03Vs0XrFzMPQCBLrYoZ-Fy487J8-l86z67b67xTKJXhrLSySS2CHfYu6UDkZ3xgo3cfvURfNBdmgb-iQ"
                   alt="Admin Profile"
                   class="w-full h-full object-cover">
            </div>
            <div class="flex flex-col min-w-0">
              <span class="text-xs font-semibold text-on-surface truncate">Admin Profile</span>
              <span class="text-[10px] text-on-surface-variant truncate">System Master</span>
            </div>
          </div>
        </div>
      </aside>
    `;
  }

  function initSidebar() {
    // Remove any existing sidebar, overlay, top header or mobile bottom nav
    const existingSidebar = document.getElementById('mm-admin-sidebar');
    if (existingSidebar) existingSidebar.remove();

    const existingOverlay = document.getElementById('mm-sidebar-overlay');
    if (existingOverlay) existingOverlay.remove();

    // Insert new unified sidebar at body top
    const wrapper = document.createElement('div');
    wrapper.innerHTML = renderSidebarHTML();
    while (wrapper.firstChild) {
      document.body.insertBefore(wrapper.firstChild, document.body.firstChild);
    }

    // Setup Finance Dropdown Toggle
    const financeToggle = document.getElementById('mm-finance-toggle');
    const financeGroup = document.getElementById('mm-finance-group');

    if (financeToggle && financeGroup) {
      financeToggle.addEventListener('click', function (e) {
        e.preventDefault();
        const expanded = financeGroup.classList.toggle('expanded');
        financeToggle.setAttribute('aria-expanded', expanded);
      });
    }

    // Setup Mobile Drawer Toggle
    const sidebar = document.getElementById('mm-admin-sidebar');
    const overlay = document.getElementById('mm-sidebar-overlay');
    const closeBtn = document.getElementById('mm-sidebar-close');

    function openMobileSidebar() {
      if (sidebar) sidebar.classList.add('mobile-open');
      if (overlay) overlay.classList.add('mobile-open');
      document.body.style.overflow = 'hidden';
    }

    function closeMobileSidebar() {
      if (sidebar) sidebar.classList.remove('mobile-open');
      if (overlay) overlay.classList.remove('mobile-open');
      document.body.style.overflow = '';
    }

    if (overlay) overlay.addEventListener('click', closeMobileSidebar);
    if (closeBtn) closeBtn.addEventListener('click', closeMobileSidebar);

    // Bind all burger buttons on page
    document.addEventListener('click', function (e) {
      const burger = e.target.closest('[data-mm-burger]');
      if (burger) {
        e.preventDefault();
        openMobileSidebar();
      }
    });

    // Close mobile drawer when clicking a sublink or navlink on mobile
    const links = sidebar.querySelectorAll('a');
    links.forEach(link => {
      link.addEventListener('click', () => {
        if (window.innerWidth < 768) {
          closeMobileSidebar();
        }
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSidebar);
  } else {
    initSidebar();
  }
})();
