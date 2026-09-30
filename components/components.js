document.addEventListener('DOMContentLoaded', async () => {
  async function mount(selector, url) {
    const el = document.querySelector(selector);
    if (!el) return;
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error(String(r.status));
      el.innerHTML = await r.text();

      // Execute scripts contained in dynamically loaded component.
      el.querySelectorAll('script').forEach(oldScript => {
        const script = document.createElement('script');
        Array.from(oldScript.attributes).forEach(attr => {
          script.setAttribute(attr.name, attr.value);
        });
        script.textContent = oldScript.textContent;
        oldScript.replaceWith(script);
      });
    } catch (e) {
      console.error('Mariage Madagascar component load failed:', url, e);
    }
  }

  await Promise.all([
    mount('[data-global-header]', '/components/header.html'),
    mount('[data-global-footer]', '/components/footer.html')
  ]);

  const mobileToggle = document.getElementById('mobile-menu-toggle');
  const mobileMenu = document.getElementById('mobile-global-menu');

  if (mobileToggle && mobileMenu) {
    mobileToggle.addEventListener('click', () => {
      const hidden = mobileMenu.classList.toggle('hidden');
      mobileToggle.setAttribute('aria-expanded', String(!hidden));
      const icon = mobileToggle.querySelector('.material-symbols-outlined');
      if (icon) icon.textContent = hidden ? 'menu' : 'close';
    });

    mobileMenu.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        mobileMenu.classList.add('hidden');
        mobileToggle.setAttribute('aria-expanded', 'false');
        const icon = mobileToggle.querySelector('.material-symbols-outlined');
        if (icon) icon.textContent = 'menu';
      });
    });
  }

  // Active navigation.
  const path = location.pathname === '/' ? '/' : location.pathname;
  document.querySelectorAll('[data-global-nav]').forEach(a => {
    const href = a.getAttribute('href');
    if (href && path === href) {
      a.classList.remove('text-on-surface-variant');
      a.classList.add('text-primary', 'border-b-2', 'border-primary');
    }
  });

  // Simple routing for existing placeholder buttons/links.
  const routes = [
    [/voir toutes les destinations|destinations/i, '/destinations.html'],
    [/d[eé]couvrir nos services|services/i, '/services.html'],
    [/lunes de miel/i, '/lunes-de-miel.html'],
    [/inspirations/i, '/inspirations.html'],
    [/demander un devis/i, '/contact.html'],
    [/cr[eé]er notre exp[eé]rience/i, '/composer-mon-sejour.html']
  ];

  document.querySelectorAll('a[href="#"], button').forEach(el => {
    const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
    const hit = routes.find(([rx]) => rx.test(text));
    if (!hit) return;

    if (el.tagName === 'A') {
      el.href = hit[1];
    } else if (!el.dataset.globalRouted) {
      el.dataset.globalRouted = '1';
      el.addEventListener('click', () => location.href = hit[1]);
    }
  });
});
