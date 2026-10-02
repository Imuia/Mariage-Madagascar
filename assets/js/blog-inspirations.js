/* Mariage Madagascar — Blog Inspirations
   Source : Supabase public.blog_posts + public.blog_post_images
   Destination : same-site article URLs only
*/
(function () {
  'use strict';

  const SUPABASE_URL = 'https://qrkinjuhtyfptldlvdyg.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_MT2uo1JdbfVSZAjwXqW7gg_NITLziCF';

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

  function canonicalSlug(slug) {
    return String(slug || '').trim().replace(/-2$/, '');
  }

  function internalUrl(post) {
    const slug = canonicalSlug(post.slug);
    return slug ? '/' + encodeURIComponent(slug) : '/blog-wedding-planner-nosy-be.html';
  }

  function categoryForPost(post) {
    const s = (
      (post.title || '') + ' ' +
      (post.slug || '') + ' ' +
      (post.content || '')
    ).toLowerCase();

    if (/10-bonnes|10-villas|travel-planner|pourquoi/.test(s)) {
      return "Conseils d'Experts";
    }
    if (/nosy-komba|nosy-sakatia|lokobe|paddle|excursion|nosy-iranja/.test(s)) {
      return 'Destinations';
    }
    if (/mariage|jour j|plage de rêve|plage-de-reve/.test(s)) {
      return 'Récits de Mariage';
    }
    return 'Art de Vivre';
  }

  function localImageCandidates(slug) {
    const safe = encodeURIComponent(canonicalSlug(slug));
    return [
      '/assets/img/blog/' + safe + '/01.jpg',
      '/assets/img/blog/' + safe + '/01.jpeg',
      '/assets/img/blog/' + safe + '/01.png',
      '/assets/img/blog/' + safe + '/01.webp',
      '/assets/img/blog/' + safe + '/01.gif',
      '/assets/img/blog/' + safe + '/01.avif'
    ];
  }

  function attachLocalFallback(img, slug) {
    const candidates = localImageCandidates(slug);
    let index = 0;

    function next() {
      if (index >= candidates.length) {
        img.style.display = 'none';
        return;
      }
      img.src = candidates[index++];
    }

    img.onerror = next;
    next();
  }

  function formatDate(value) {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    }).format(d);
  }

  function normalize(post, imageMap) {
    const slug = canonicalSlug(post.slug || '');
    const images = imageMap.get(String(post.id)) || [];
    const featuredFromGallery =
      images.find(function (x) { return x.is_featured; }) ||
      images[0] ||
      null;

    const summaryText = stripHtml(post.summary || post.content || '');
    return {
      id: post.id || post.legacy_wp_id || slug,
      title: stripHtml(post.title || ''),
      slug: slug,
      summary: summaryText.slice(0, 260),
      image: post.featured_image_url || (featuredFromGallery && featuredFromGallery.image_url) || '',
      published_at: post.published_at || post.created_at || '',
      category: categoryForPost(post),
      gallery: images
    };
  }

  function dedupeCanonicalPosts(posts) {
    const seen = new Set();
    return posts.filter(function (post) {
      const key = canonicalSlug(post.slug);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function renderFeatured(post) {
    if (!post) return;

    featuredLink.href = internalUrl(post);
    featuredLink.removeAttribute('target');
    featuredLink.removeAttribute('rel');

    featuredCategory.textContent = post.category;
    featuredTitle.textContent = post.title;
    featuredSummary.textContent =
      post.summary || 'Découvrez cet article dans les Inspirations Mariage Madagascar.';

    if (featuredImage) {
      featuredImage.alt = post.title;
      featuredImage.style.display = '';
      featuredImage.src = post.image || '';
      if (!post.image) attachLocalFallback(featuredImage, post.slug);
      else {
        featuredImage.onerror = function () {
          attachLocalFallback(featuredImage, post.slug);
        };
      }
    }
  }

  function renderGrid(postsToRender) {
    if (!postsToRender.length) {
      grid.innerHTML =
        '<div class="col-span-full glass-panel rounded-xl p-8 text-center text-on-surface-variant">Aucun article dans cette catégorie.</div>';
      return;
    }

    grid.innerHTML = postsToRender.map(function (post) {
      const image = escapeHtml(post.image || localImageCandidates(post.slug)[0]);
      const title = escapeHtml(post.title);
      const summary = escapeHtml(
        post.summary || 'Découvrez cet article dans les Inspirations Mariage Madagascar.'
      );
      const category = escapeHtml(post.category);
      const date = escapeHtml(formatDate(post.published_at));
      const href = escapeHtml(internalUrl(post));

      return `
        <a href="${href}"
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
              <span class="material-symbols-outlined text-[16px] text-primary group-hover:translate-x-1 transition-transform">arrow_forward</span>
            </div>
          </div>
        </a>`;
    }).join('');

    grid.querySelectorAll('img').forEach(function (img, index) {
      img.addEventListener('error', function () {
        const post = postsToRender[index];
        if (post) attachLocalFallback(img, post.slug);
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

  /* Les boutons de filtres sont de vrais boutons : aucun clic ne doit
     déclencher une navigation ou suivre un lien du Header. */
  filters.forEach(function (button) {
    button.setAttribute('type', 'button');
    button.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();

      const filter = button.getAttribute('data-blog-filter') || 'all';
      setActiveFilter(button);
      applyFilter(filter);

      // Reste sur la page du blog : aucun changement d'URL.
      try {
        window.history.replaceState(null, '', window.location.pathname);
      } catch (e) {}
    });
  });

  async function getJson(url) {
    const response = await fetch(url, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: 'Bearer ' + SUPABASE_ANON_KEY
      }
    });
    if (!response.ok) {
      throw new Error('Supabase HTTP ' + response.status);
    }
    return response.json();
  }

  async function loadFromSupabase() {
    // Exact columns confirmed in the current public.blog_posts schema.
    const postsEndpoint =
      SUPABASE_URL +
      '/rest/v1/blog_posts' +
      '?select=id,legacy_wp_id,title,slug,summary,content,featured_image_url,published_at,created_at,is_published' +
      '&is_published=eq.true' +
      '&order=published_at.desc,created_at.desc';

    const posts = await getJson(postsEndpoint);
    if (!Array.isArray(posts)) return [];

    let galleryRows = [];
    try {
      const imagesEndpoint =
        SUPABASE_URL +
        '/rest/v1/blog_post_images' +
        '?select=blog_post_id,image_url,alt_text,sort_order,is_featured' +
        '&order=sort_order.asc';

      const images = await getJson(imagesEndpoint);
      galleryRows = Array.isArray(images) ? images : [];
    } catch (error) {
      console.warn('blog_post_images indisponible, fallback vers featured_image_url/local.', error);
    }

    const imageMap = new Map();
    galleryRows.forEach(function (row) {
      const key = String(row.blog_post_id);
      if (!imageMap.has(key)) imageMap.set(key, []);
      imageMap.get(key).push(row);
    });

    return dedupeCanonicalPosts(posts.map(function (post) {
      return normalize(post, imageMap);
    }));
  }

  async function init() {
    grid.innerHTML =
      '<div class="col-span-full glass-panel rounded-xl p-8 text-center text-on-surface-variant">Chargement des articles...</div>';

    try {
      allPosts = await loadFromSupabase();

      if (!allPosts.length) {
        grid.innerHTML =
          '<div class="col-span-full glass-panel rounded-xl p-8 text-center text-on-surface-variant">Aucun article publié.</div>';
        if (status) status.textContent = '0 article chargé';
        return;
      }

      // Keep the most recent published article with an image for the featured block.
      const featured = allPosts.find(function (post) {
        return !!post.image;
      }) || allPosts[0];

      renderFeatured(featured);
      renderGrid(allPosts);

      if (status) {
        status.textContent = allPosts.length + ' articles ';
      }
    } catch (error) {
      console.error('Impossible de charger le blog depuis Supabase.', error);
      grid.innerHTML =
        '<div class="col-span-full glass-panel rounded-xl p-8 text-center text-on-surface-variant">Impossible de charger les articles pour le moment.</div>';
      if (status) status.textContent = 'Erreur de chargement';
    }
  }

  init();
})();
