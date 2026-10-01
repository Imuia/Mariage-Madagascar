/* Mariage Madagascar - Blog Inspirations
   Source des données : Supabase public.blog_posts
   URLs de destination : site officiel mariage-madagascar.com
*/
(function () {
  'use strict';

  const SUPABASE_URL = 'https://qrkinjuhtyfptldlvdyg.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFya2luanVodHlmcHRsZGx2ZHlnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA4MzY3NzUsImV4cCI6MjEwNjQxMjc3NX0.rKo326yy_QALlLVH5FfFfzyRp_J6Fd6B3EnZhbdIj9I';

  /* URLs trouvées et vérifiées dans les résultats du site officiel.
     Pour les slugs non surfaced individuellement, le fallback reste le même slug
     sur le domaine officiel avec le format historique du site. */
  const OFFICIAL_URLS = {
  "les-joyaux-de-nosy-komba-pour-votre-lune-de-miel": "https://www.mariage-madagascar.com/-les-joyaux-de-nosy-komba-pour-votre-lune-de-miel-",
  "focus-festival-une-experience-unique-a-madagascar": "https://www.mariage-madagascar.com/en/focus-festival-une-experience-unique-a-madagascar",
  "snorkeling-a-nosy-sakatia": "https://www.mariage-madagascar.com/snorkeling-a-nosy-sakatia-",
  "paddle-et-diner-romantique-exceptionnel": "https://www.mariage-madagascar.com/paddle-et-diner-romantique-exceptionnel",
  "10-villas-hotels-et-lieux-insolites-au-bord-de-leau-pour-un-mariage-de-reve-a-madagascar": "https://www.mariage-madagascar.com/en/10-villas-hotels-et-lieux-insolites-au-bord-de-leau-pour-un-mariage-de-reve-a-madagascar-",
  "10-bonnes-raisons-de-choisir-madagascar-pour-votre-lune-de-miel": "https://www.mariage-madagascar.com/10-bonnes-raisons-de-choisir-madagascar-pour-votre-lune-de-miel-",
  "un-mariage-unique-sur-une-plage-de-reve": "https://www.mariage-madagascar.com/un-mariage-unique-sur-une-plage-de-reve-",
  "pourquoi-un-mariage-symbolique-est-une-experience-extraordinaire-pour-vos-enfants": "https://www.mariage-madagascar.com/-pourquoi-un-mariage-symbolique-est-une-experience-extraordinaire-pour-vos-enfants-",
  "mariage-de-reve-a-nosy-iranja": "https://www.mariage-madagascar.com/mariage-de-reve-a-nosy-iranja-",
  "mariage-madagascar-votre-jour-j-pense-dans-les-moindres-details": "https://www.mariage-madagascar.com/-mariage-madagascar-votre-jour-j-pense-dans-les-moindres-details-",
  "nosy-komba-le-paradis-des-lemuriens-et-des-maries-copy": "https://www.mariage-madagascar.com/nosy-komba-le-paradis-des-lemuriens-et-des-maries-copy",
  "10-villas-hotels-et-lieux-insolites-au-bord-de-leau-pour-un-mariage-de-reve-a-madagascar-2": "https://www.mariage-madagascar.com/en/10-villas-hotels-et-lieux-insolites-au-bord-de-leau-pour-un-mariage-de-reve-a-madagascar-",
  "focus-festival-une-experience-unique-a-madagascar-2": "https://www.mariage-madagascar.com/en/focus-festival-une-experience-unique-a-madagascar",
  "visite-de-la-reserve-naturelle-de-lokobe-2": "https://www.mariage-madagascar.com/visite-de-la-reserve-naturelle-de-lokobe-",
  "un-mariage-unique-sur-une-plage-de-reve-2": "https://www.mariage-madagascar.com/un-mariage-unique-sur-une-plage-de-reve-",
  "pourquoi-faire-appel-a-un-travel-planner-specialise-pour-votre-voyage-de-noces-ou-anniversaire-de-mariage-a-madagascar-2": "https://www.mariage-madagascar.com/pourquoi-faire-appel-a-un-travel-planner-specialise-pour-votre-voyage-de-noces-ou-anniversaire-de-mariage-a-madagascar-",
  "10-bonnes-raisons-de-choisir-madagascar-pour-votre-lune-de-miel-2": "https://www.mariage-madagascar.com/10-bonnes-raisons-de-choisir-madagascar-pour-votre-lune-de-miel-",
  "pourquoi-un-mariage-symbolique-est-une-experience-extraordinaire-pour-vos-enfants-2": "https://www.mariage-madagascar.com/-pourquoi-un-mariage-symbolique-est-une-experience-extraordinaire-pour-vos-enfants-",
  "visite-de-la-reserve-naturelle-de-lokobe": "https://www.mariage-madagascar.com/visite-de-la-reserve-naturelle-de-lokobe-",
  "pourquoi-faire-appel-a-un-travel-planner-specialise-pour-votre-voyage-de-noces-ou-anniversaire-de-mariage-a-madagascar": "https://www.mariage-madagascar.com/pourquoi-faire-appel-a-un-travel-planner-specialise-pour-votre-voyage-de-noces-ou-anniversaire-de-mariage-a-madagascar-",
  "excursion-a-nosy-komba-et-nosy-tanikely": "https://www.mariage-madagascar.com/excursion-a-nosy-komba-et-nosy-tanikely-",
  "payer-votre-mariage-de-reve-a-nosy-be-en-bitcoin-ou-cryptomonnaies": "https://www.mariage-madagascar.com/payer-votre-mariage-de-reve-a-nosy-be-en-bitcoin-ou-cryptomonnaies-",
  "hello-world": "https://www.mariage-madagascar.com/hello-world-"
};

  const FALLBACK_POSTS = [{"id": "279", "title": "🌴 Les Joyaux de Nosy Komba pour votre Lune de Miel 💕", "slug": "les-joyaux-de-nosy-komba-pour-votre-lune-de-miel", "summary": "", "featured_image_url": "", "published_at": "2025-04-06 00:00:00", "category": "Destinations", "official_url": "https://www.mariage-madagascar.com/-les-joyaux-de-nosy-komba-pour-votre-lune-de-miel-"}, {"id": "280", "title": "🌊 𝗙𝗢𝗖𝗨𝗦 𝗙𝗘𝗦𝗧𝗜𝗩𝗔𝗟 – Une Expérience Unique à Madagascar ✨ Copy", "slug": "focus-festival-une-experience-unique-a-madagascar", "summary": "", "featured_image_url": "", "published_at": "2025-09-06 00:00:00", "category": "Art de Vivre", "official_url": "https://www.mariage-madagascar.com/en/focus-festival-une-experience-unique-a-madagascar"}, {"id": "281", "title": "Snorkeling à Nosy Sakatia 🐋🐬🐢🌊", "slug": "snorkeling-a-nosy-sakatia", "summary": "", "featured_image_url": "", "published_at": "2024-11-21 16:27:04", "category": "Destinations", "official_url": "https://www.mariage-madagascar.com/snorkeling-a-nosy-sakatia-"}, {"id": "282", "title": "Visite de la Réserve Naturelle de Lokobe 🐒🦎🌿", "slug": "visite-de-la-reserve-naturelle-de-lokobe", "summary": "", "featured_image_url": "", "published_at": "2024-11-21 16:27:04", "category": "Destinations", "official_url": "https://www.mariage-madagascar.com/visite-de-la-reserve-naturelle-de-lokobe-"}, {"id": "283", "title": "Paddle et Dîner Romantique Exceptionnel🐬👩🏼‍❤️‍👩🏽🐢🌊", "slug": "paddle-et-diner-romantique-exceptionnel", "summary": "", "featured_image_url": "", "published_at": "2024-12-06 17:39:53", "category": "Destinations", "official_url": "https://www.mariage-madagascar.com/paddle-et-diner-romantique-exceptionnel"}, {"id": "285", "title": "10 Villas, Hôtels et Lieux Insolites au Bord de l’Eau pour un Mariage de Rêve à Madagascar 🌊💍🏝", "slug": "10-villas-hotels-et-lieux-insolites-au-bord-de-leau-pour-un-mariage-de-reve-a-madagascar", "summary": "", "featured_image_url": "", "published_at": "2025-03-05 00:00:00", "category": "Conseils d'Experts", "official_url": "https://www.mariage-madagascar.com/en/10-villas-hotels-et-lieux-insolites-au-bord-de-leau-pour-un-mariage-de-reve-a-madagascar-"}, {"id": "288", "title": "10 Bonnes Raisons de Choisir Madagascar pour Votre Lune de Miel 🌴💕", "slug": "10-bonnes-raisons-de-choisir-madagascar-pour-votre-lune-de-miel", "summary": "", "featured_image_url": "", "published_at": "2024-06-01 00:00:00", "category": "Conseils d'Experts", "official_url": "https://www.mariage-madagascar.com/10-bonnes-raisons-de-choisir-madagascar-pour-votre-lune-de-miel-"}, {"id": "289", "title": "Un mariage unique sur une plage de rêve 👰🏼⛱️", "slug": "un-mariage-unique-sur-une-plage-de-reve", "summary": "", "featured_image_url": "", "published_at": "2023-01-30 20:08:02", "category": "Récits de Mariage", "official_url": "https://www.mariage-madagascar.com/un-mariage-unique-sur-une-plage-de-reve-"}, {"id": "291", "title": "Pourquoi faire appel à un travel planner spécialisé pour votre voyage de noces ou anniversaire de mariage à Madagascar ? 🌴💍🛶✨", "slug": "pourquoi-faire-appel-a-un-travel-planner-specialise-pour-votre-voyage-de-noces-ou-anniversaire-de-mariage-a-madagascar", "summary": "", "featured_image_url": "", "published_at": "2025-07-28 00:00:00", "category": "Conseils d'Experts", "official_url": "https://www.mariage-madagascar.com/pourquoi-faire-appel-a-un-travel-planner-specialise-pour-votre-voyage-de-noces-ou-anniversaire-de-mariage-a-madagascar-"}, {"id": "293", "title": "🌟 Pourquoi un Mariage Symbolique est une Expérience Extraordinaire pour Vos Enfants 🌟", "slug": "pourquoi-un-mariage-symbolique-est-une-experience-extraordinaire-pour-vos-enfants", "summary": "", "featured_image_url": "", "published_at": "2025-09-20 00:00:00", "category": "Conseils d'Experts", "official_url": "https://www.mariage-madagascar.com/-pourquoi-un-mariage-symbolique-est-une-experience-extraordinaire-pour-vos-enfants-"}, {"id": "296", "title": "10 Villas, Hôtels et Lieux Insolites au Bord de l’Eau pour un Mariage de Rêve à Madagascar 🌊💍🏝", "slug": "10-villas-hotels-et-lieux-insolites-au-bord-de-leau-pour-un-mariage-de-reve-a-madagascar-2", "summary": "", "featured_image_url": "", "published_at": "2025-03-05 00:00:00", "category": "Conseils d'Experts", "official_url": "https://www.mariage-madagascar.com/en/10-villas-hotels-et-lieux-insolites-au-bord-de-leau-pour-un-mariage-de-reve-a-madagascar-"}, {"id": "298", "title": "🌊 𝗙𝗢𝗖𝗨𝗦 𝗙𝗘𝗦𝗧𝗜𝗩𝗔𝗟 – Une Expérience Unique à Madagascar ✨ Copy", "slug": "focus-festival-une-experience-unique-a-madagascar-2", "summary": "", "featured_image_url": "", "published_at": "2025-09-06 00:00:00", "category": "Art de Vivre", "official_url": "https://www.mariage-madagascar.com/en/focus-festival-une-experience-unique-a-madagascar"}, {"id": "299", "title": "Visite de la Réserve Naturelle de Lokobe 🐒🦎🌿", "slug": "visite-de-la-reserve-naturelle-de-lokobe-2", "summary": "", "featured_image_url": "", "published_at": "2024-11-21 16:27:04", "category": "Destinations", "official_url": "https://www.mariage-madagascar.com/visite-de-la-reserve-naturelle-de-lokobe-"}, {"id": "300", "title": "Un mariage unique sur une plage de rêve 👰🏼⛱️", "slug": "un-mariage-unique-sur-une-plage-de-reve-2", "summary": "", "featured_image_url": "", "published_at": "2023-01-30 20:08:02", "category": "Récits de Mariage", "official_url": "https://www.mariage-madagascar.com/un-mariage-unique-sur-une-plage-de-reve-"}, {"id": "302", "title": "Pourquoi faire appel à un travel planner spécialisé pour votre voyage de noces ou anniversaire de mariage à Madagascar ? 🌴💍🛶✨", "slug": "pourquoi-faire-appel-a-un-travel-planner-specialise-pour-votre-voyage-de-noces-ou-anniversaire-de-mariage-a-madagascar-2", "summary": "", "featured_image_url": "", "published_at": "2025-07-28 00:00:00", "category": "Conseils d'Experts", "official_url": "https://www.mariage-madagascar.com/pourquoi-faire-appel-a-un-travel-planner-specialise-pour-votre-voyage-de-noces-ou-anniversaire-de-mariage-a-madagascar-"}, {"id": "303", "title": "10 Bonnes Raisons de Choisir Madagascar pour Votre Lune de Miel 🌴💕", "slug": "10-bonnes-raisons-de-choisir-madagascar-pour-votre-lune-de-miel-2", "summary": "", "featured_image_url": "", "published_at": "2024-06-01 00:00:00", "category": "Conseils d'Experts", "official_url": "https://www.mariage-madagascar.com/10-bonnes-raisons-de-choisir-madagascar-pour-votre-lune-de-miel-"}, {"id": "308", "title": "Excursion à Nosy Komba et Nosy Tanikely 🐢🐬🌴🌞🐒", "slug": "excursion-a-nosy-komba-et-nosy-tanikely", "summary": "", "featured_image_url": "", "published_at": "2024-11-21 16:27:04", "category": "Destinations", "official_url": "https://www.mariage-madagascar.com/excursion-a-nosy-komba-et-nosy-tanikely-"}, {"id": "309", "title": "Mariage de Rêve à Nosy Iranja 💎💍", "slug": "mariage-de-reve-a-nosy-iranja", "summary": "", "featured_image_url": "", "published_at": "2024-11-21 16:27:04", "category": "Destinations", "official_url": "https://www.mariage-madagascar.com/mariage-de-reve-a-nosy-iranja-"}, {"id": "312", "title": "Payer votre mariage de reve a nosy be en bitcoin ou cryptomonnaies 🤑", "slug": "payer-votre-mariage-de-reve-a-nosy-be-en-bitcoin-ou-cryptomonnaies", "summary": "", "featured_image_url": "", "published_at": "2024-12-06 17:39:53", "category": "Récits de Mariage", "official_url": "https://www.mariage-madagascar.com/payer-votre-mariage-de-reve-a-nosy-be-en-bitcoin-ou-cryptomonnaies-"}, {"id": "314", "title": "💍✨ Mariage Madagascar – Votre Jour J, pensé dans les moindres détails ✨", "slug": "mariage-madagascar-votre-jour-j-pense-dans-les-moindres-details", "summary": "", "featured_image_url": "", "published_at": "2025-03-07 00:00:00", "category": "Récits de Mariage", "official_url": "https://www.mariage-madagascar.com/-mariage-madagascar-votre-jour-j-pense-dans-les-moindres-details-"}, {"id": "1", "title": "Hello world!", "slug": "hello-world", "summary": "", "featured_image_url": "", "published_at": "2026-10-01 07:55:59", "category": "Art de Vivre", "official_url": "https://www.mariage-madagascar.com/hello-world-"}, {"id": "304", "title": "Nosy Komba – Le paradis des lémuriens et des mariés 🌴💍 Copy", "slug": "nosy-komba-le-paradis-des-lemuriens-et-des-maries-copy", "summary": "", "featured_image_url": "", "published_at": "2025-11-02 00:00:00", "category": "Destinations", "official_url": "https://www.mariage-madagascar.com/nosy-komba-le-paradis-des-lemuriens-et-des-maries-copy"}, {"id": "310", "title": "🌟 Pourquoi un Mariage Symbolique est une Expérience Extraordinaire pour Vos Enfants 🌟", "slug": "pourquoi-un-mariage-symbolique-est-une-experience-extraordinaire-pour-vos-enfants-2", "summary": "", "featured_image_url": "", "published_at": "2025-09-20 00:00:00", "category": "Conseils d'Experts", "official_url": "https://www.mariage-madagascar.com/-pourquoi-un-mariage-symbolique-est-une-experience-extraordinaire-pour-vos-enfants-"}];

  const grid = document.getElementById('blog-article-grid');
  const featuredLink = document.getElementById('blog-featured-link');
  const featuredImage = document.getElementById('blog-featured-image');
  const featuredCategory = document.getElementById('blog-featured-category');
  const featuredTitle = document.getElementById('blog-featured-title');
  const featuredSummary = document.getElementById('blog-featured-summary');
  const status = document.getElementById('blog-load-status');
  const filters = Array.from(document.querySelectorAll('[data-blog-filter]'));

  if (!grid) return;

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function stripHtml(value) {
    const el = document.createElement('div');
    el.innerHTML = value || '';
    return (el.textContent || el.innerText || '').replace(/\s+/g, ' ').trim();
  }

  function categoryForPost(post) {
    if (post.category) return post.category;
    const s = ((post.title || '') + ' ' + (post.slug || '') + ' ' + (post.content || '')).toLowerCase();
    if (/pourquoi|10-bonnes|10-villas|travel-planner/.test(s)) return "Conseils d'Experts";
    if (/nosy-komba|nosy-sakatia|lokobe|paddle|excursion|nosy-iranja/.test(s)) return "Destinations";
    if (/mariage|jour j|plage de rêve|plage-de-reve/.test(s)) return "Récits de Mariage";
    return "Art de Vivre";
  }

  function officialUrlFor(post) {
    if (OFFICIAL_URLS[post.slug]) return OFFICIAL_URLS[post.slug];

    const canonicalSlug = String(post.slug || '').replace(/-2$/, '');
    return 'https://www.mariage-madagascar.com/' + canonicalSlug + '-';
  }

  function fallbackImageFor(slug) {
    return '/assets/img/blog/' + encodeURIComponent(slug) + '/01.jpg';
  }

  function localImageFallback(slug, element) {
    const extensions = ['jpg', 'png', 'webp', 'gif', 'avif'];
    let index = 0;
    const tryNext = function () {
      if (index >= extensions.length) {
        element.style.display = 'none';
        return;
      }
      element.src = '/assets/img/blog/' + slug + '/01.' + extensions[index++];
    };
    element.onerror = tryNext;
    tryNext();
  }

  function formatDate(value) {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }).format(d);
  }

  function normalize(post) {
    const title = stripHtml(post.title || '');
    const summary = stripHtml(post.summary || post.content || '');
    const featured = post.featured_image_url || '';
    return {
      id: post.id || post.legacy_wp_id || Math.random(),
      slug: post.slug || '',
      title,
      summary: summary.slice(0, 260),
      image: featured,
      published_at: post.published_at || post.created_at || '',
      category: categoryForPost(post),
      official_url: officialUrlFor(post)
    };
  }

  function renderFeatured(post) {
    if (!post) return;
    featuredLink.href = post.official_url;
    featuredLink.target = '_blank';
    featuredLink.rel = 'noopener noreferrer';
    featuredCategory.textContent = post.category;
    featuredTitle.textContent = post.title;
    featuredSummary.textContent = post.summary || 'Découvrez cet article sur le site officiel Mariage Madagascar.';

    featuredImage.alt = post.title;
    if (post.image) {
      featuredImage.src = post.image;
      featuredImage.onerror = function () {
        localImageFallback(post.slug, featuredImage);
      };
    } else {
      localImageFallback(post.slug, featuredImage);
    }
  }

  function renderGrid(postsToRender) {
    if (!postsToRender.length) {
      grid.innerHTML = '<div class="col-span-full glass-panel rounded-xl p-8 text-center text-on-surface-variant">Aucun article dans cette catégorie.</div>';
      return;
    }

    grid.innerHTML = postsToRender.map(function (post) {
      const image = escapeHtml(post.image || fallbackImageFor(post.slug));
      const title = escapeHtml(post.title);
      const summary = escapeHtml(post.summary || 'Lire cet article sur le site officiel Mariage Madagascar.');
      const category = escapeHtml(post.category);
      const date = escapeHtml(formatDate(post.published_at));
      const href = escapeHtml(post.official_url);

      return `
        <a href="${href}" target="_blank" rel="noopener noreferrer"
           class="glass-panel rounded-xl overflow-hidden group cursor-pointer hover-glow transition-all duration-300 flex flex-col h-full no-underline">
          <div class="h-48 relative overflow-hidden bg-surface-container-high">
            <img class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 opacity-90"
                 src="${image}"
                 alt="${title}">
            <div class="absolute inset-0 bg-gradient-to-t from-background/50 to-transparent"></div>
          </div>
          <div class="p-6 flex flex-col flex-grow">
            <span class="text-primary text-xs font-semibold tracking-wider uppercase mb-2">${category}</span>
            <h3 class="font-headline text-xl font-medium text-on-surface mb-3 group-hover:text-primary transition-colors">${title}</h3>
            <p class="text-on-surface-variant text-sm flex-grow line-clamp-3">${summary}</p>
            <div class="mt-4 text-xs text-on-surface-variant/70 flex items-center justify-between">
              <span>${date || 'Article'}</span>
              <span class="material-symbols-outlined text-[16px] text-primary group-hover:translate-x-1 transition-transform">arrow_outward</span>
            </div>
          </div>
        </a>`;
    }).join('');

    grid.querySelectorAll('img').forEach(function (img, index) {
      img.addEventListener('error', function () {
        const post = postsToRender[index];
        if (post) localImageFallback(post.slug, img);
      }, { once: true });
    });
  }

  function setActiveFilter(activeButton) {
    filters.forEach(function (button) {
      const active = button === activeButton;
      button.classList.toggle('text-primary', active);
      button.classList.toggle('border-primary/40', active);
      button.classList.toggle('text-on-surface-variant', !active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  let allPosts = [];

  function applyFilter(filter) {
    if (filter === 'all') {
      renderGrid(allPosts);
      return;
    }
    renderGrid(allPosts.filter(function (post) {
      return post.category === filter;
    }));
  }

  filters.forEach(function (button) {
    button.addEventListener('click', function () {
      setActiveFilter(button);
      applyFilter(button.dataset.blogFilter);
    });
  });

  async function loadFromSupabase() {
    const endpoint = SUPABASE_URL +
      '/rest/v1/blog_posts?select=id,legacy_wp_id,title,slug,summary,content,featured_image_url,published_at,created_at,is_published&is_published=eq.true&order=published_at.desc,created_at.desc';

    const response = await fetch(endpoint, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: 'Bearer ' + SUPABASE_ANON_KEY
      }
    });

    if (!response.ok) {
      throw new Error('Supabase HTTP ' + response.status);
    }

    const data = await response.json();
    return Array.isArray(data) ? data.map(normalize) : [];
  }

  async function init() {
    allPosts = FALLBACK_POSTS.map(normalize);

    /* Affiche immédiatement les 23 articles depuis la liste de secours,
       puis remplace par Supabase dès que les données sont disponibles. */
    allPosts.sort(function (a,b) {
      return new Date(b.published_at || 0) - new Date(a.published_at || 0);
    });
    renderFeatured(allPosts[0]);
    renderGrid(allPosts);

    try {
      const remote = await loadFromSupabase();
      if (remote.length) {
        allPosts = remote;
        allPosts.sort(function (a,b) {
          return new Date(b.published_at || 0) - new Date(a.published_at || 0);
        });
        renderFeatured(allPosts[0]);
        renderGrid(allPosts);
        status.textContent = allPosts.length + ' articles chargés depuis Supabase';
      } else {
        status.textContent = allPosts.length + ' articles disponibles';
      }
    } catch (error) {
      console.warn('Blog Supabase indisponible, affichage de secours.', error);
      status.textContent = allPosts.length + ' articles disponibles';
    }
  }

  init();
})();
