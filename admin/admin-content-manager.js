/* Mariage Madagascar — admin content management.
   Requires the existing admin-auth.js, admin-shared.js and public Supabase tables.
   No middleware file is used or created. */
(function () {
  'use strict';

  const pageType = document.documentElement.dataset.cmsType;
  const isProducts = pageType === 'products';
  const isBlogs = pageType === 'blogs';
  if (!isProducts && !isBlogs) return;

  // Images are uploaded to this public-read, admin-write Supabase Storage bucket.
  const STORAGE_BUCKET = 'mm-content-images';
  const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
  const PRODUCT_CATEGORY_OPTIONS = [
    'Mariage', 'Lune de miel', 'Anniversaire', 'Séjour romantique', 'Shooting photo',
    'Événement privé', 'Prestations', 'Destinations', 'Voyage & escapade',
    'Nosy Be', 'Nosy Saba', 'Antananarivo', 'Morondava', 'Tuléar', 'Diego-Suarez', 'Autre', 'Non classé'
  ];

  const $ = (selector) => document.querySelector(selector);
  const statusEl = $('#cms-status');
  const toastEl = $('#mm-toast');
  let toastTimer = null;
  let client = null;
  let currentRows = [];
  let currentProduct = null;
  let currentBlog = null;
  let variations = [];
  let productImages = [];
  let blogImages = [];
  let currentVariationId = null;
  let slugEdited = false;
  // Keep selections while toolbar buttons are clicked, so WYSIWYG commands
  // apply to the selected text instead of losing the caret.
  const editorRanges = new Map();

  function setStatus(message, type = '') {
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.className = `cms-status${type ? ` ${type}` : ''}`;
  }

  function toast(message, error = false) {
    if (!toastEl) { window.alert(message); return; }
    toastEl.textContent = message;
    toastEl.className = `mm-toast show${error ? ' mm-toast-error' : ''}`;
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => { toastEl.className = 'mm-toast'; }, 4500);
  }

  function escapeHTML(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[char]);
  }

  function slugify(value) {
    return String(value || '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 200);
  }

  function money(value) {
    if (value == null || value === '') return '—';
    const number = Number(value);
    if (!Number.isFinite(number)) return '—';
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(number);
  }

  function dateText(value) {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(date);
  }

  function dateTimeLocal(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
  }

  function openDialog(dialog) {
    if (dialog && typeof dialog.showModal === 'function') dialog.showModal();
    else if (dialog) dialog.setAttribute('open', '');
  }
  function closeDialog(dialog) {
    if (dialog && typeof dialog.close === 'function') dialog.close();
    else if (dialog) dialog.removeAttribute('open');
  }

  function setFormError(id, message) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = message || '';
    el.hidden = !message;
  }

  function errorMessage(error) {
    if (!error) return 'Erreur inconnue.';
    const parts = [error.message, error.details, error.hint, error.code ? `Code : ${error.code}` : null]
      .filter((part, index, all) => part && all.indexOf(part) === index);
    const text = parts.join(' — ') || String(error);
    if (/row-level security|rls|permission denied|not allowed/i.test(text)) {
      return `Permission Supabase refusée. Vérifie la migration RLS et le rôle admin. Détail : ${text}`;
    }
    if (/schema cache|could not find the .* column|relation .* does not exist/i.test(text)) {
      return `Schéma Supabase incompatible ou non actualisé. Vérifie les tables/colonnes requises. Détail : ${text}`;
    }
    return text;
  }

  async function initialize() {
    try {
      if (!window.MMAdminAuth || typeof window.MMAdminAuth.getClient !== 'function') {
        throw new Error('Module admin-auth.js introuvable. Vérifie le chemin du script.');
      }
      // checkAdminAuth envoie les utilisateurs non autorisés vers la page de connexion.
      const authState = await window.MMAdminAuth.checkAdminAuth();
      if (!authState || !authState.isAuthorized) return;
      if (!['super_admin', 'admin'].includes(authState.role)) {
        throw new Error('Seuls les rôles administrateur et super administrateur peuvent gérer les produits et les articles.');
      }
      client = window.MMAdminAuth.getClient();
      if (!client) throw new Error('Client Supabase non disponible.');

      bindCommonEvents();
      if (isProducts) {
        bindProductEvents();
        await loadProducts();
      } else {
        bindBlogEvents();
        await loadBlogs();
      }
    } catch (error) {
      console.error('Admin content initialization:', error);
      setStatus(errorMessage(error), 'error');
    }
  }

  function bindCommonEvents() {
    document.querySelectorAll('[data-close-modal]').forEach((button) => {
      button.addEventListener('click', () => closeDialog(button.closest('dialog')));
    });
    document.querySelectorAll('dialog').forEach((dialog) => {
      dialog.addEventListener('click', (event) => {
        if (event.target === dialog) closeDialog(dialog);
      });
    });
    const search = $('#cms-search');
    const filter = $('#cms-filter');
    if (search) search.addEventListener('input', renderRows);
    if (filter) filter.addEventListener('change', renderRows);
    document.querySelectorAll('[data-image-preview]').forEach((input) => {
      input.addEventListener('change', () => {
        if (input.dataset.previewObjectUrl) {
          URL.revokeObjectURL(input.dataset.previewObjectUrl);
          delete input.dataset.previewObjectUrl;
        }
        const file = input.files && input.files[0];
        const previewId = input.dataset.imagePreview;
        if (file) {
          const previewUrl = URL.createObjectURL(file);
          input.dataset.previewObjectUrl = previewUrl;
          setImagePreview(previewId, previewUrl);
        } else {
          setImagePreview(previewId, input.dataset.currentUrl || '');
        }
      });
    });
  }

  // -------------------------------------------------------------------------
  // PRODUCTS
  // -------------------------------------------------------------------------
  function bindProductEvents() {
    $('#new-product')?.addEventListener('click', () => openProductEditor(null));
    $('#save-product')?.addEventListener('click', saveProduct);
    $('#p-name')?.addEventListener('input', () => {
      if (!slugEdited && !currentProduct) $('#p-slug').value = slugify($('#p-name').value);
    });
    $('#p-slug')?.addEventListener('input', () => { slugEdited = true; });
    $('#p-type')?.addEventListener('change', toggleProductTypeFields);
    $('#p-categories-toggle')?.addEventListener('click', () => {
      const menu = $('#p-category-menu');
      const button = $('#p-categories-toggle');
      if (!menu || !button) return;
      menu.hidden = !menu.hidden;
      button.setAttribute('aria-expanded', String(!menu.hidden));
    });
    $('#p-category-options')?.addEventListener('change', (event) => {
      if (!event.target.matches('[data-product-category]')) return;
      const values = [...$('#p-category-options').querySelectorAll('[data-product-category]:checked')].map((input) => input.value);
      $('#p-categories').value = values.join(', ');
      updateProductCategorySummary(values);
    });
    document.addEventListener('click', (event) => {
      const dropdown = $('#p-categories-dropdown');
      const menu = $('#p-category-menu');
      const button = $('#p-categories-toggle');
      if (dropdown && !dropdown.contains(event.target) && menu && !menu.hidden) {
        menu.hidden = true;
        button?.setAttribute('aria-expanded', 'false');
      }
    });
    $('#new-variation')?.addEventListener('click', () => openVariationForm(null));
    $('#cancel-variation')?.addEventListener('click', (event) => { event.preventDefault(); resetVariationForm(); });
    $('#variation-form')?.addEventListener('submit', saveVariation);
    $('#product-image-form')?.addEventListener('submit', saveProductImage);
    $('#product-images')?.addEventListener('click', handleProductImageAction);
    $('#product-rows')?.addEventListener('click', handleProductTableAction);
    $('#variation-rows')?.addEventListener('click', handleVariationAction);

    bindWysiwygEditors(['p-short-editor', 'p-description-editor']);
  }

  function saveEditorSelection(editor) {
    if (!editor || !editor.id) return;
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    if (editor.contains(range.startContainer) && editor.contains(range.endContainer)) {
      editorRanges.set(editor.id, range.cloneRange());
    }
  }

  function restoreEditorSelection(editor) {
    if (!editor) return;
    editor.focus({ preventScroll: true });
    const selection = window.getSelection();
    if (!selection) return;
    const saved = editorRanges.get(editor.id);
    if (saved && editor.contains(saved.startContainer) && editor.contains(saved.endContainer)) {
      selection.removeAllRanges();
      selection.addRange(saved);
      return;
    }
    // If the user has not selected text yet, put the caret at the end of this editor.
    const range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
    editorRanges.set(editor.id, range.cloneRange());
  }

  function normalizedEditorHTML(value) {
    const html = String(value || '').trim();
    if (!html || /^(?:<br\s*\/?\s*>|<div>\s*<br\s*\/?\s*>\s*<\/div>|<p>\s*<br\s*\/?\s*>\s*<\/p>)$/i.test(html)) return '';
    return html;
  }

  function readEditorHTML(editorSelector, fallbackSelector) {
    const editor = $(editorSelector);
    if (editor) return normalizedEditorHTML(editor.innerHTML);
    return $(fallbackSelector)?.value || '';
  }

  function syncEditors() {
    // Each visible contenteditable editor maps to a hidden textarea whose id is
    // the same without the final "-editor" suffix. These values are the exact
    // HTML fields persisted to Supabase for products and blog posts.
    ['p-short-editor', 'p-description-editor', 'b-summary-editor', 'b-content-editor'].forEach((editorId) => {
      const editor = document.getElementById(editorId);
      const textarea = document.getElementById(editorId.replace(/-editor$/, ''));
      if (editor && textarea) textarea.value = normalizedEditorHTML(editor.innerHTML);
    });
  }

  function bindWysiwygEditors(editorIds) {
    const allowedIds = new Set(editorIds);
    editorIds.forEach((id) => {
      const editor = document.getElementById(id);
      if (!editor) return;
      const rememberSelection = () => saveEditorSelection(editor);
      editor.addEventListener('keyup', rememberSelection);
      editor.addEventListener('mouseup', rememberSelection);
      editor.addEventListener('focus', rememberSelection);
      editor.addEventListener('input', () => { syncEditors(); rememberSelection(); });
      editor.addEventListener('blur', syncEditors);
      editor.addEventListener('paste', () => window.setTimeout(() => { syncEditors(); rememberSelection(); }, 0));
    });

    document.querySelectorAll('[data-wysiwyg]').forEach((btn) => {
      if (!allowedIds.has(btn.dataset.target)) return;
      // Keep focus/selection inside the editor when a toolbar button is clicked.
      btn.addEventListener('mousedown', (event) => {
        if (event.button === 0) event.preventDefault();
      });
      btn.addEventListener('click', (event) => {
        event.preventDefault();
        const editor = document.getElementById(btn.dataset.target);
        if (!editor) return;
        restoreEditorSelection(editor);
        const command = btn.dataset.wysiwyg;
        const value = btn.dataset.value || null;
        if (command === 'createLink') {
          const url = window.prompt('Entrez l’URL du lien :', 'https://');
          if (!url || !url.trim()) { restoreEditorSelection(editor); return; }
          restoreEditorSelection(editor);
          document.execCommand('createLink', false, url.trim());
        } else if (command === 'formatBlock') {
          document.execCommand('formatBlock', false, `<${value || 'p'}>`);
        } else {
          document.execCommand(command, false, value);
        }
        syncEditors();
        saveEditorSelection(editor);
      });
    });
  }

  function toggleProductTypeFields() {
    const type = $('#p-type')?.value || 'simple';
    const simpleWrap = $('#p-simple-price-wrap');
    if (simpleWrap) {
      simpleWrap.hidden = (type === 'variable');
    }
  }

  async function loadProducts() {
    setStatus('Chargement du catalogue depuis Supabase…');
    const { data, error } = await client.from('mm_products')
      .select('id,slug,sku,name,short_description,description_html,categories,product_type,published,catalog_visibility,featured,in_stock,tax_status,attribute_name,attribute_values,featured_image_url,source_url,created_at,updated_at')
      .order('updated_at', { ascending: false })
      .range(0, 999);
    if (error) throw error;
    currentRows = data || [];
    const variationPrices = {};
    const anyVariationPrices = {};
    const { data: prices, error: priceError } = await client.from('mm_product_variations')
      .select('product_id,regular_price,published,in_stock').range(0, 1999);
    if (!priceError && prices) {
      prices.forEach((row) => {
        if (row.regular_price == null || row.product_id == null) return;
        const key = row.product_id;
        const amount = Number(row.regular_price);
        if (!Number.isFinite(amount)) return;
        // The catalogue uses published prices, but the edit form must also
        // prefill draft/unpublished products so an existing price is not lost.
        if (anyVariationPrices[key] == null || amount < anyVariationPrices[key]) anyVariationPrices[key] = amount;
        if (row.published && (variationPrices[key] == null || amount < variationPrices[key])) variationPrices[key] = amount;
      });
    } else if (priceError) {
      console.warn('Prix des variations non chargés :', priceError.message);
    }
    currentRows.forEach((row) => {
      row._minPrice = variationPrices[row.id];
      row._anyPrice = anyVariationPrices[row.id];
    });
    renderRows();
    setStatus(`${currentRows.length} produit(s) chargé(s). Les prix sont lus depuis mm_product_variations.`, 'success');
  }

  function renderRows() {
    const tbody = isProducts ? $('#product-rows') : $('#blog-rows');
    if (!tbody) return;
    const query = ($('#cms-search')?.value || '').toLocaleLowerCase('fr').trim();
    const filter = $('#cms-filter')?.value || 'all';
    const rows = currentRows.filter((row) => {
      const text = isProducts
        ? [row.name, row.slug, row.sku, formatCommaList(row.categories), row.product_type].join(' ').toLocaleLowerCase('fr')
        : [row.title, row.slug, row.summary, row.seo_title].join(' ').toLocaleLowerCase('fr');
      if (query && !text.includes(query)) return false;
      if (filter === 'published' && !(isProducts ? row.published : row.is_published)) return false;
      if (filter === 'draft' && (isProducts ? row.published : row.is_published)) return false;
      if (isProducts && filter === 'stock' && !row.in_stock) return false;
      if (isProducts && filter === 'out' && row.in_stock) return false;
      return true;
    });
    const count = isProducts ? $('#product-count') : $('#blog-count');
    if (count) count.textContent = `${rows.length} ${isProducts ? 'produit(s)' : 'article(s)'}`;
    const empty = isProducts ? $('#product-empty') : $('#blog-empty');
    if (empty) empty.hidden = rows.length > 0;
    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="cms-empty">Aucun résultat.</td></tr>`;
      return;
    }
    if (isProducts) {
      tbody.innerHTML = rows.map((row) => `
        <tr>
          <td><div class="flex items-center gap-3">${row.featured_image_url ? `<img class="cms-thumb" loading="lazy" src="${escapeHTML(imageDisplayUrl(row.featured_image_url, row.featured_image_url))}" alt="">` : '<div class="cms-thumb"></div>'}<div><strong>${escapeHTML(row.name || 'Sans nom')}</strong><div class="cms-subtext">${escapeHTML(row.sku || row.slug || '')}</div></div></div></td>
          <td>${escapeHTML(formatCommaList(row.categories) || '—')}</td><td>${escapeHTML(row.product_type || '—')}</td><td>${money(row._minPrice)}</td>
          <td><span class="mm-badge ${row.published ? 'green' : 'orange'}">${row.published ? 'Publié' : 'Brouillon'}</span><div class="cms-subtext">${row.in_stock ? 'En stock' : 'Hors stock'}</div></td>
          <td><div class="cms-actions"><button class="cms-small-btn" data-product-edit="${escapeHTML(row.id)}">Modifier</button><button class="cms-small-btn" data-product-toggle="${escapeHTML(row.id)}">${row.published ? 'Dépublier' : 'Publier'}</button>${row.slug ? `<a class="cms-small-btn" href="/${encodeURIComponent(row.slug)}" target="_blank" rel="noopener">Voir</a>` : ''}</div></td>
        </tr>`).join('');
    } else {
      tbody.innerHTML = rows.map((row) => `
        <tr><td><div class="flex items-center gap-3">${row.featured_image_url ? `<img class="cms-thumb" loading="lazy" src="${escapeHTML(imageDisplayUrl(row.featured_image_url, row.featured_image_url))}" alt="">` : '<div class="cms-thumb"></div>'}<div><strong>${escapeHTML(row.title || 'Sans titre')}</strong><div class="cms-subtext">${escapeHTML(row.summary || '').slice(0, 150)}</div></div></div></td>
        <td><code>${escapeHTML(row.slug || '')}</code></td><td>${escapeHTML(row.category || '—')}</td><td><span class="mm-badge ${row.is_published ? 'green' : 'orange'}">${row.is_published ? 'Publié' : 'Brouillon'}</span></td><td>${dateText(row.updated_at || row.published_at || row.created_at)}</td>
        <td><div class="cms-actions"><button class="cms-small-btn" data-blog-edit="${escapeHTML(row.id)}">Modifier le HTML</button><button class="cms-small-btn" data-blog-toggle="${escapeHTML(row.id)}">${row.is_published ? 'Dépublier' : 'Publier'}</button>${row.slug ? `<a class="cms-small-btn" href="/${encodeURIComponent(row.slug)}" target="_blank" rel="noopener">Voir</a>` : ''}</div></td></tr>`).join('');
    }
  }

  function openProductEditor(row) {
    currentProduct = row ? { ...row } : null;
    slugEdited = Boolean(row);
    setFormError('product-form-error', '');
    $('#product-modal-title').textContent = row ? 'Modifier le produit' : 'Nouveau produit';
    $('#p-name').value = row?.name || '';
    $('#p-slug').value = row?.slug || '';
    $('#p-sku').value = row?.sku || '';
    renderProductCategoryDropdown(row?.categories || []);
    $('#p-type').value = row?.product_type || 'simple';
    toggleProductTypeFields();
    if ($('#p-simple-price')) $('#p-simple-price').value = row?._anyPrice ?? row?._minPrice ?? '';
    const shortHtml = row?.short_description || '';
    $('#p-short').value = shortHtml;
    if ($('#p-short-editor')) $('#p-short-editor').innerHTML = shortHtml;
    const descHtml = row?.description_html || '';
    $('#p-description').value = descHtml;
    if ($('#p-description-editor')) $('#p-description-editor').innerHTML = descHtml;
    $('#p-image').value = row?.featured_image_url || '';
    $('#p-image-file').value = '';
    $('#p-image-file').dataset.currentUrl = row?.featured_image_url || '';
    setImagePreview('p-image-preview', row?.featured_image_url || '');
    $('#p-source').value = row?.source_url || '';
    $('#p-visibility').value = row?.catalog_visibility || 'visible';
    $('#p-tax').value = row?.tax_status || 'taxable';
    $('#p-attribute-name').value = row?.attribute_name || '';
    $('#p-attribute-values').value = row?.attribute_values || '';
    $('#p-published').checked = Boolean(row?.published);
    $('#p-featured').checked = Boolean(row?.featured);
    $('#p-stock').checked = row ? Boolean(row.in_stock) : true;
    $('#product-subpanels').hidden = !row;
    if (row) {
      loadVariations(row.id).then(() => {
        if (['simple', 'service'].includes($('#p-type')?.value) && variations.length === 1 && $('#p-simple-price')) {
          const existingPrice = variations[0].regular_price;
          if (existingPrice != null) $('#p-simple-price').value = existingPrice;
        }
      }).catch((error) => toast(`Variations : ${errorMessage(error)}`, true));
      loadProductImages(row.id).catch((error) => toast(`Images : ${errorMessage(error)}`, true));
    } else {
      $('#variation-rows').innerHTML = '<tr><td colspan="5" class="cms-empty">Enregistrez d’abord le produit pour ajouter des variations.</td></tr>';
      $('#product-images').innerHTML = '<div class="cms-subtext">Enregistrez d’abord le produit pour ajouter des images.</div>';
      resetVariationForm();
    }
    openDialog($('#product-modal'));
  }

  async function saveProduct() {
    const name = $('#p-name').value.trim();
    const slug = ($('#p-slug').value.trim() || slugify(name)).replace(/^\/+|\/+$/g, '');
    if (!name || !slug) { setFormError('product-form-error', 'Le nom et le slug sont obligatoires.'); return; }

    const productId = currentProduct?.id || (window.crypto && typeof window.crypto.randomUUID === 'function' ? window.crypto.randomUUID() : `prod-${Date.now()}`);
    let newlyUploadedPath = null;
    let productRecordSaved = false;
    let featuredImageUrl = normalizeImageValue($('#p-image').value);

    $('#save-product').disabled = true;
    $('#save-product').textContent = 'Enregistrement…';
    setFormError('product-form-error', '');

    const featuredFile = $('#p-image-file')?.files?.[0];
    if (featuredFile) {
      try {
        const uploaded = await uploadImageFile(featuredFile, `products/${productId}/featured`);
        newlyUploadedPath = uploaded.path;
        featuredImageUrl = uploaded.publicUrl;
      } catch (uploadError) {
        console.error('Upload image error:', uploadError);
        setFormError('product-form-error', `Échec du téléversement de l'image principale : ${errorMessage(uploadError)}`);
        $('#save-product').disabled = false;
        $('#save-product').textContent = 'Enregistrer le produit';
        return;
      }
    }

    syncEditors();
    const shortDescription = readEditorHTML('#p-short-editor', '#p-short');
    const descriptionHtml = readEditorHTML('#p-description-editor', '#p-description');
    $('#p-short').value = shortDescription;
    $('#p-description').value = descriptionHtml;

    const payload = {
      id: productId,
      name,
      slug,
      sku: blankToNull($('#p-sku').value),
      categories: parseCommaList($('#p-categories').value),
      product_type: blankToNull($('#p-type').value) || 'simple',
      short_description: blankToNull(shortDescription),
      description_html: descriptionHtml,
      featured_image_url: featuredImageUrl,
      source_url: blankToNull($('#p-source').value),
      catalog_visibility: $('#p-visibility').value,
      tax_status: blankToNull($('#p-tax').value) || 'taxable',
      attribute_name: blankToNull($('#p-attribute-name').value),
      attribute_values: blankToNull($('#p-attribute-values').value),
      published: $('#p-published').checked,
      featured: $('#p-featured').checked,
      in_stock: $('#p-stock').checked,
      updated_at: new Date().toISOString()
    };

    try {
      let result;
      if (currentProduct?.id) {
        result = await client.from('mm_products').update(payload).eq('id', currentProduct.id).select('*').single();
      } else {
        result = await client.from('mm_products').insert(payload).select('*').single();
      }
      if (result.error) throw result.error;
      currentProduct = result.data;
      productRecordSaved = true;
      renderProductCategoryDropdown(currentProduct.categories || $('#p-categories').value || []);

      if (currentProduct.featured_image_url) {
        $('#p-image').value = currentProduct.featured_image_url;
        $('#p-image-file').value = '';
        $('#p-image-file').dataset.currentUrl = currentProduct.featured_image_url;
        setImagePreview('p-image-preview', currentProduct.featured_image_url);
      }

      $('#product-modal-title').textContent = 'Modifier le produit';
      $('#product-subpanels').hidden = false;
      $('#p-slug').value = currentProduct.slug;

      // Auto-create/update variation for simple products
      const pType = $('#p-type').value || 'simple';
      const simplePriceInput = $('#p-simple-price')?.value;
      if ((pType === 'simple' || pType === 'service') && simplePriceInput !== '' && simplePriceInput != null) {
        const simplePrice = Number(simplePriceInput);
        if (Number.isFinite(simplePrice) && simplePrice >= 0) {
          const { data: existingVars, error: lookupError } = await client.from('mm_product_variations')
            .select('id,regular_price').eq('product_id', currentProduct.id)
            .order('created_at', { ascending: true }).limit(1);
          if (lookupError) throw lookupError;
          const varPayload = {
            product_id: currentProduct.id,
            sku: currentProduct.sku ? `${currentProduct.sku}-MAIN` : `${currentProduct.slug}-MAIN`,
            name: `${currentProduct.name} - Tarif de base`,
            attribute_name: currentProduct.attribute_name || 'Option',
            attribute_value: currentProduct.attribute_values || 'Standard',
            pax: 1,
            regular_price: simplePrice,
            currency: 'EUR',
            published: currentProduct.published,
            in_stock: currentProduct.in_stock,
            raw_export: {
              SKU: currentProduct.sku || '',
              Name: currentProduct.name,
              Type: 'variation',
              'Regular price': simplePrice,
              Published: currentProduct.published ? 1 : 0
            },
            updated_at: new Date().toISOString()
          };

          // For an existing simple product, change only its price and timestamp.
          // Preserve the variation's SKU, name, attributes, publication and stock values.
          const variationResult = existingVars && existingVars.length > 0
            ? await client.from('mm_product_variations')
                .update({ regular_price: simplePrice, updated_at: new Date().toISOString() })
                .eq('id', existingVars[0].id).eq('product_id', currentProduct.id)
            : await client.from('mm_product_variations').insert(varPayload);
          if (variationResult.error) throw variationResult.error;
        }
      }

      setFormError('product-form-error', '');
      await loadProducts();
      await Promise.all([loadVariations(currentProduct.id), loadProductImages(currentProduct.id)]);
      toast(featuredFile ? 'Produit et image principale enregistrés avec succès.' : 'Produit enregistré avec succès.');
    } catch (error) {
      console.error('Save product error:', error);
      // Do not delete a newly uploaded image if the product row was already saved:
      // later gallery/variation refresh errors must not break the stored image URL.
      if (newlyUploadedPath && !productRecordSaved) {
        try { await client.storage.from(STORAGE_BUCKET).remove([newlyUploadedPath]); } catch (_) {}
      }
      setFormError('product-form-error', errorMessage(error));
    } finally {
      $('#save-product').disabled = false;
      $('#save-product').textContent = 'Enregistrer le produit';
    }
  }

  async function handleProductTableAction(event) {
    const edit = event.target.closest('[data-product-edit]');
    const toggle = event.target.closest('[data-product-toggle]');
    if (edit) {
      const row = currentRows.find((item) => item.id === edit.dataset.productEdit);
      if (row) openProductEditor(row);
    }
    if (toggle) {
      const row = currentRows.find((item) => item.id === toggle.dataset.productToggle);
      if (!row) return;
      try {
        const { error } = await client.from('mm_products').update({ published: !row.published, updated_at: new Date().toISOString() }).eq('id', row.id);
        if (error) throw error;
        toast(row.published ? 'Produit dépublié.' : 'Produit publié.');
        await loadProducts();
      } catch (error) { toast(errorMessage(error), true); }
    }
  }

  async function loadVariations(productId) {
    const { data, error } = await client.from('mm_product_variations').select('*').eq('product_id', productId).order('created_at', { ascending: true });
    if (error) throw error;
    variations = data || [];
    const tbody = $('#variation-rows');
    if (!variations.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="cms-empty">Aucune variation pour ce produit.</td></tr>';
      return;
    }
    tbody.innerHTML = variations.map((v) => `<tr><td>${escapeHTML(v.name || (v.pax ? `${v.pax} personne(s)` : 'Option'))}</td><td>${escapeHTML(v.sku || '—')}</td><td>${money(v.regular_price)}</td><td><span class="mm-badge ${v.published && v.in_stock ? 'green' : 'orange'}">${v.published && v.in_stock ? 'Active' : 'Inactive'}</span></td><td><div class="cms-actions"><button type="button" class="cms-small-btn" data-variation-edit="${escapeHTML(v.id)}">Modifier</button>${v.published || v.in_stock ? `<button type="button" class="cms-small-btn danger" data-variation-disable="${escapeHTML(v.id)}">Désactiver</button>` : ''}</div></td></tr>`).join('');
  }

  function resetVariationForm() {
    const form = $('#variation-form');
    if (!form) return;
    form.reset();
    $('#v-id').value = '';
    $('#v-published').checked = true;
    $('#v-stock').checked = true;
    currentVariationId = null;
    form.hidden = true;
  }

  function openVariationForm(variation) {
    if (!currentProduct?.id) { toast('Enregistrez le produit avant d’ajouter une variation.', true); return; }
    const form = $('#variation-form');
    form.hidden = false;
    form.reset();
    currentVariationId = variation?.id || null;
    $('#v-id').value = currentVariationId || '';
    $('#v-name').value = variation?.name || '';
    $('#v-sku').value = variation?.sku || '';
    $('#v-pax').value = variation?.pax ?? '';
    $('#v-price').value = variation ? (variation.regular_price ?? '') : '';
    $('#v-published').checked = variation ? Boolean(variation.published) : true;
    $('#v-stock').checked = variation ? Boolean(variation.in_stock) : true;
  }

  async function saveVariation(event) {
    event.preventDefault();
    if (!currentProduct?.id) {
      toast('Enregistrez le produit avant d’ajouter une variation.', true);
      return;
    }
    const priceText = String($('#v-price')?.value ?? '').trim();
    const price = priceText === '' ? NaN : Number(priceText);
    if (!Number.isFinite(price) || price < 0) {
      toast('Saisissez un prix valide supérieur ou égal à 0 €.', true);
      $('#v-price')?.focus();
      return;
    }
    const paxText = String($('#v-pax')?.value ?? '').trim();
    const paxVal = paxText === '' ? null : Number(paxText);
    if (paxVal !== null && (!Number.isInteger(paxVal) || paxVal < 1)) {
      toast('Le nombre de personnes doit être un entier supérieur ou égal à 1.', true);
      $('#v-pax')?.focus();
      return;
    }

    const existingVariation = currentVariationId
      ? variations.find((row) => String(row.id) === String(currentVariationId))
      : null;
    const enteredName = blankToNull($('#v-name')?.value);
    const variationName = enteredName || `${currentProduct.name || 'Produit'} — ${paxVal !== null ? `${paxVal} personne(s)` : 'Option'}`;
    const attributeName = blankToNull(currentProduct.attribute_name) || (paxVal !== null ? 'Nombre de personnes (pax)' : 'Option');
    const attributeValue = paxVal !== null ? String(paxVal) : (enteredName || 'Standard');
    const enteredSku = blankToNull($('#v-sku')?.value);
    const baseSku = slugify(currentProduct.sku || currentProduct.slug || currentProduct.name || 'PRODUIT')
      .replace(/-/g, '').toUpperCase().slice(0, 70) || 'PRODUIT';
    // Some existing schema constraints require a non-empty variation SKU.
    // Preserve an existing SKU on edit; generate one only for a new blank SKU.
    const variationSku = enteredSku || existingVariation?.sku ||
      `${baseSku}-VAR-${paxVal !== null ? paxVal : 'STD'}-${Date.now()}`;
    const now = new Date().toISOString();
    const rawExport = {
      ...(existingVariation?.raw_export && typeof existingVariation.raw_export === 'object' ? existingVariation.raw_export : {}),
      SKU: variationSku,
      Name: variationName,
      Type: 'variation',
      'Regular price': price,
      Currency: 'EUR',
      'Attribute 1 name': attributeName,
      'Attribute 1 value': attributeValue,
      Published: $('#v-published').checked ? 1 : 0,
      'In stock?': $('#v-stock').checked ? 1 : 0
    };
    const payload = {
      product_id: currentProduct.id,
      name: variationName,
      sku: variationSku,
      pax: paxVal,
      regular_price: price,
      currency: 'EUR',
      attribute_name: attributeName,
      attribute_value: attributeValue,
      published: $('#v-published').checked,
      in_stock: $('#v-stock').checked,
      raw_export: rawExport,
      updated_at: now
    };
    const submitButton = $('#variation-form button[type="submit"]');
    if (submitButton) { submitButton.disabled = true; submitButton.textContent = 'Enregistrement…'; }
    try {
      let result;
      if (currentVariationId) {
        result = await client.from('mm_product_variations')
          .update(payload).eq('id', currentVariationId).eq('product_id', currentProduct.id).select('id').single();
      } else {
        result = await client.from('mm_product_variations')
          .insert({ ...payload, created_at: now }).select('id').single();
      }
      if (result.error) throw result.error;
      if (!result.data?.id) throw new Error('Supabase n’a confirmé aucune variation enregistrée. Vérifiez les colonnes et les règles RLS.');
      resetVariationForm();
      await Promise.all([loadVariations(currentProduct.id), loadProducts()]);
      toast('Variation enregistrée.');
    } catch (error) {
      console.error('Save variation error:', error);
      toast(`Échec d’enregistrement de la variation : ${errorMessage(error)}`, true);
    } finally {
      if (submitButton) { submitButton.disabled = false; submitButton.textContent = 'Enregistrer variation'; }
    }
  }

  async function handleVariationAction(event) {
    const edit = event.target.closest('[data-variation-edit]');
    const disable = event.target.closest('[data-variation-disable]');
    if (edit) {
      const row = variations.find((item) => item.id === edit.dataset.variationEdit);
      if (row) openVariationForm(row);
    }
    if (disable) {
      const row = variations.find((item) => item.id === disable.dataset.variationDisable);
      if (!row || !window.confirm('Désactiver cette variation sans supprimer l’historique ?')) return;
      try {
        const { error } = await client.from('mm_product_variations').update({ published: false, in_stock: false, updated_at: new Date().toISOString() }).eq('id', row.id).eq('product_id', currentProduct.id);
        if (error) throw error;
        await Promise.all([loadVariations(currentProduct.id), loadProducts()]);
        toast('Variation désactivée sans suppression.');
      } catch (error) { toast(errorMessage(error), true); }
    }
  }

  async function loadProductImages(productId) {
    const container = $('#product-images');
    const { data, error } = await client.from('mm_product_images').select('*').eq('product_id', productId).order('sort_order', { ascending: true });
    if (error) throw error;
    productImages = data || [];
    if (!productImages.length) { container.innerHTML = '<div class="cms-subtext">Aucune image supplémentaire enregistrée.</div>'; return; }
    container.innerHTML = productImages.map((img) => {
      const displayUrl = imageDisplayUrl(img.local_path, img.image_url || img.source_url);
      return `<div class="mm-list-item"><div class="flex items-center gap-3">${displayUrl ? `<img class="cms-thumb" loading="lazy" src="${escapeHTML(displayUrl)}" alt="${escapeHTML(img.alt_text || '')}">` : ''}<div><strong>${escapeHTML(img.alt_text || 'Image produit')}</strong><small>${escapeHTML(img.local_path || img.image_url || img.source_url || '')}</small></div></div><div class="cms-actions"><span class="mm-badge">Ordre ${Number(img.sort_order) || 0}${img.is_featured ? ' · vedette' : ''}</span><button type="button" class="cms-small-btn danger" data-product-image-remove="${escapeHTML(img.id)}">Retirer</button></div></div>`;
    }).join('');
  }

  async function saveProductImage(event) {
    event.preventDefault();
    if (!currentProduct?.id) { toast('Enregistrez le produit avant d’ajouter une image.', true); return; }
    const file = $('#pi-file')?.files?.[0];
    if (!file) { toast('Choisissez un fichier image sur votre ordinateur.', true); return; }
    const submitButton = $('#product-image-form button[type="submit"]');
    if (submitButton) { submitButton.disabled = true; submitButton.textContent = 'Téléversement…'; }
    let uploaded = null;
    try {
      uploaded = await uploadImageFile(file, `products/${currentProduct.id}/gallery`);
      const payload = {
        product_id: currentProduct.id,
        image_url: uploaded.publicUrl,
        source_url: uploaded.publicUrl,
        local_path: uploaded.path,
        alt_text: blankToNull($('#pi-alt').value),
        sort_order: Number($('#pi-order').value || 0),
        is_featured: $('#pi-featured').checked
      };
      let { error } = await client.from('mm_product_images').insert(payload);
      // Older deployments may not yet have the optional image_url column. The
      // legacy schema uses source_url + local_path, so retry only for that exact
      // missing-column/schema-cache case rather than masking unrelated errors.
      if (error && /(?:column .*image_url.*does not exist|could not find the .*image_url.*column|schema cache.*image_url)/i.test(error.message || '')) {
        const { image_url: _imageUrl, ...legacyPayload } = payload;
        const retry = await client.from('mm_product_images').insert(legacyPayload);
        error = retry.error;
      }
      if (error) {
        try { await client.storage.from(STORAGE_BUCKET).remove([uploaded.path]); } catch (_) { /* don't hide the original database error */ }
        throw error;
      }
      $('#product-image-form').reset();
      $('#pi-order').value = '0';
      await loadProductImages(currentProduct.id);
      toast('Image téléversée et ajoutée à la galerie.');
    } catch (error) { toast(errorMessage(error), true); }
    finally { if (submitButton) { submitButton.disabled = false; submitButton.textContent = 'Téléverser et ajouter l’image'; } }
  }

  async function isStoragePathInUse(path) {
    if (!path || !client) return false;
    try {
      const publicMarker = `${STORAGE_BUCKET}/${path}`;
      const [prodRes, prodImgRes, blogRes, blogImgRes] = await Promise.all([
        client.from('mm_products').select('id').or(`featured_image_url.ilike.%${path}%,source_url.ilike.%${path}%`).limit(1),
        client.from('mm_product_images').select('id').or(`local_path.eq.${path},source_url.ilike.%${path}%`).limit(1),
        client.from('blog_posts').select('id').or(`featured_image_url.ilike.%${path}%`).limit(1),
        client.from('blog_post_images').select('id').or(`image_url.ilike.%${path}%`).limit(1)
      ]);
      if ((prodRes.data && prodRes.data.length > 0) ||
          (prodImgRes.data && prodImgRes.data.length > 0) ||
          (blogRes.data && blogRes.data.length > 0) ||
          (blogImgRes.data && blogImgRes.data.length > 0)) {
        return true;
      }
    } catch (_) {
      return true;
    }
    return false;
  }

  async function handleProductImageAction(event) {
    const button = event.target.closest('[data-product-image-remove]');
    if (!button || !currentProduct?.id) return;
    const image = productImages.find((row) => row.id === button.dataset.productImageRemove);
    if (!image || !window.confirm('Retirer cette image de la galerie ?')) return;
    try {
      const { error } = await client.from('mm_product_images').delete().eq('id', image.id).eq('product_id', currentProduct.id);
      if (error) throw error;
      if (isManagedStoragePath(image.local_path)) {
        const inUse = await isStoragePathInUse(image.local_path);
        if (!inUse) {
          const { error: storageError } = await client.storage.from(STORAGE_BUCKET).remove([image.local_path]);
          if (storageError) console.warn('Référence supprimée mais fichier Storage conservé :', storageError.message);
        }
      }
      await loadProductImages(currentProduct.id);
      toast('Image retirée de la galerie.');
    } catch (error) { toast(errorMessage(error), true); }
  }

  // -------------------------------------------------------------------------
  // BLOG POSTS
  // -------------------------------------------------------------------------
  function bindBlogEvents() {
    $('#new-blog')?.addEventListener('click', () => openBlogEditor(null));
    $('#save-blog')?.addEventListener('click', saveBlog);
    $('#b-title')?.addEventListener('input', () => {
      if (!slugEdited && !currentBlog) $('#b-slug').value = slugify($('#b-title').value);
    });
    $('#b-slug')?.addEventListener('input', () => { slugEdited = true; });
    $('#blog-rows')?.addEventListener('click', handleBlogTableAction);
    $('#blog-image-form')?.addEventListener('submit', saveBlogImage);
    $('#blog-images')?.addEventListener('click', handleBlogImageAction);
    bindWysiwygEditors(['b-summary-editor', 'b-content-editor']);
  }

  async function loadBlogs() {
    setStatus('Chargement des articles depuis Supabase…');
    const { data, error } = await client.from('blog_posts')
      .select('id,title,slug,category,content,summary,featured_image_url,seo_title,seo_description,is_published,published_at,created_at,updated_at')
      .order('updated_at', { ascending: false })
      .range(0, 999);
    if (error) throw error;
    currentRows = data || [];
    renderRows();
    setStatus(`${currentRows.length} article(s) chargé(s) depuis public.blog_posts.`, 'success');
  }

  function openBlogEditor(row) {
    currentBlog = row ? { ...row } : null;
    slugEdited = Boolean(row);
    setFormError('blog-form-error', '');
    $('#blog-modal-title').textContent = row ? 'Modifier l’article' : 'Nouvel article';
    $('#b-title').value = row?.title || '';
    $('#b-slug').value = row?.slug || '';
    setSelectValuePreservingOption($('#b-category'), row?.category || '');
    $('#b-image').value = row?.featured_image_url || '';
    $('#b-image-file').value = '';
    $('#b-image-file').dataset.currentUrl = row?.featured_image_url || '';
    setImagePreview('b-image-preview', row?.featured_image_url || '');
    const summaryHtml = row?.summary || '';
    const contentHtml = row?.content || '';
    $('#b-summary').value = summaryHtml;
    $('#b-content').value = contentHtml;
    if ($('#b-summary-editor')) $('#b-summary-editor').innerHTML = summaryHtml;
    if ($('#b-content-editor')) $('#b-content-editor').innerHTML = contentHtml;
    editorRanges.delete('b-summary-editor');
    editorRanges.delete('b-content-editor');
    $('#b-seo-title').value = row?.seo_title || '';
    $('#b-seo-description').value = row?.seo_description || '';
    $('#b-published').checked = Boolean(row?.is_published);
    $('#b-published-at').value = dateTimeLocal(row?.published_at);
    $('#blog-images-panel').hidden = !row;
    if (row) loadBlogImages(row.id).catch((error) => toast(`Galerie article : ${errorMessage(error)}`, true));
    else $('#blog-images').innerHTML = '<div class="cms-subtext">Enregistrez d’abord l’article pour ajouter des images à la galerie.</div>';
    openDialog($('#blog-modal'));
  }

  async function saveBlog() {
    syncEditors();
    const title = $('#b-title').value.trim();
    const slug = ($('#b-slug').value.trim() || slugify(title)).replace(/^\/+|\/+$/g, '');
    const summaryHtml = readEditorHTML('#b-summary-editor', '#b-summary');
    const content = readEditorHTML('#b-content-editor', '#b-content');
    $('#b-summary').value = summaryHtml;
    $('#b-content').value = content;
    if (!title || !slug || !content.trim()) { setFormError('blog-form-error', 'Le titre, le slug et le contenu de l’article sont obligatoires.'); return; }

    const blogId = currentBlog?.id || (window.crypto && typeof window.crypto.randomUUID === 'function' ? window.crypto.randomUUID() : `blog-${Date.now()}`);
    let newlyUploadedPath = null;
    let blogRecordSaved = false;
    let featuredImageUrl = normalizeImageValue($('#b-image').value);

    $('#save-blog').disabled = true;
    $('#save-blog').textContent = 'Enregistrement…';
    setFormError('blog-form-error', '');

    const featuredFile = $('#b-image-file')?.files?.[0];
    if (featuredFile) {
      try {
        const uploaded = await uploadImageFile(featuredFile, `blogs/${blogId}/featured`);
        newlyUploadedPath = uploaded.path;
        featuredImageUrl = uploaded.publicUrl;
      } catch (uploadError) {
        console.error('Upload blog image error:', uploadError);
        setFormError('blog-form-error', `Échec du téléversement de l'image principale : ${errorMessage(uploadError)}`);
        $('#save-blog').disabled = false;
        $('#save-blog').textContent = 'Enregistrer l’article';
        return;
      }
    }

    const published = $('#b-published').checked;
    let publishedAt = $('#b-published-at').value ? new Date($('#b-published-at').value).toISOString() : null;
    if (published && !publishedAt) publishedAt = new Date().toISOString();

    const payload = {
      id: blogId,
      title,
      slug,
      category: blankToNull($('#b-category')?.value),
      summary: blankToNull(summaryHtml),
      content,
      featured_image_url: featuredImageUrl,
      seo_title: blankToNull($('#b-seo-title').value),
      seo_description: blankToNull($('#b-seo-description').value),
      is_published: published,
      published_at: publishedAt,
      updated_at: new Date().toISOString()
    };

    try {
      let result;
      if (currentBlog?.id) result = await client.from('blog_posts').update(payload).eq('id', currentBlog.id).select('*').single();
      else result = await client.from('blog_posts').insert(payload).select('*').single();
      if (result.error) throw result.error;
      currentBlog = result.data;
      blogRecordSaved = true;

      if (featuredFile && featuredImageUrl) {
        $('#b-image').value = featuredImageUrl;
        $('#b-image-file').value = '';
        $('#b-image-file').dataset.currentUrl = featuredImageUrl;
        setImagePreview('b-image-preview', featuredImageUrl);
      }

      $('#blog-modal-title').textContent = 'Modifier l’article';
      $('#blog-images-panel').hidden = false;
      $('#b-slug').value = currentBlog.slug;
      setFormError('blog-form-error', '');
      await loadBlogs();
      await loadBlogImages(currentBlog.id);
      toast(featuredFile ? 'Article et image principale enregistrés avec succès.' : 'Article enregistré avec succès.');
    } catch (error) {
      console.error('Save blog error:', error);
      if (newlyUploadedPath && !blogRecordSaved) {
        try { await client.storage.from(STORAGE_BUCKET).remove([newlyUploadedPath]); } catch (_) {}
      }
      setFormError('blog-form-error', errorMessage(error));
    } finally {
      $('#save-blog').disabled = false;
      $('#save-blog').textContent = 'Enregistrer l’article';
    }
  }

  async function handleBlogTableAction(event) {
    const edit = event.target.closest('[data-blog-edit]');
    const toggle = event.target.closest('[data-blog-toggle]');
    if (edit) {
      const row = currentRows.find((item) => item.id === edit.dataset.blogEdit);
      if (row) openBlogEditor(row);
    }
    if (toggle) {
      const row = currentRows.find((item) => item.id === toggle.dataset.blogToggle);
      if (!row) return;
      try {
        const now = new Date().toISOString();
        const payload = { is_published: !row.is_published, updated_at: now };
        if (!row.is_published && !row.published_at) payload.published_at = now;
        const { error } = await client.from('blog_posts').update(payload).eq('id', row.id);
        if (error) throw error;
        toast(row.is_published ? 'Article dépublié.' : 'Article publié.');
        await loadBlogs();
      } catch (error) { toast(errorMessage(error), true); }
    }
  }

  async function loadBlogImages(blogId) {
    const { data, error } = await client.from('blog_post_images').select('*').eq('blog_post_id', blogId).order('sort_order', { ascending: true });
    if (error) throw error;
    blogImages = data || [];
    const container = $('#blog-images');
    if (!blogImages.length) { container.innerHTML = '<div class="cms-subtext">Aucune image supplémentaire dans la galerie.</div>'; return; }
    container.innerHTML = blogImages.map((img) => {
      return `<div class="mm-list-item"><div class="flex items-center gap-3">${img.image_url ? `<img class="cms-thumb" loading="lazy" src="${escapeHTML(imageDisplayUrl(img.image_url, img.image_url))}" alt="${escapeHTML(img.alt_text || '')}">` : ''}<div><strong>${escapeHTML(img.alt_text || 'Image article')}</strong><small>${escapeHTML(img.image_url || '')}</small></div></div><div class="cms-actions"><span class="mm-badge">Ordre ${Number(img.sort_order) || 0}${img.is_featured ? ' · vedette' : ''}</span><button type="button" class="cms-small-btn danger" data-blog-image-remove="${escapeHTML(img.id)}">Retirer</button></div></div>`;
    }).join('');
  }

  async function saveBlogImage(event) {
    event.preventDefault();
    if (!currentBlog?.id) return;
    const file = $('#bi-file')?.files?.[0];
    if (!file) { toast('Choisissez un fichier image sur votre ordinateur.', true); return; }
    const submitButton = $('#blog-image-form button[type="submit"]');
    if (submitButton) { submitButton.disabled = true; submitButton.textContent = 'Téléversement…'; }
    let uploaded = null;
    try {
      uploaded = await uploadImageFile(file, `blogs/${currentBlog.id}/gallery`);
      const payload = {
        blog_post_id: currentBlog.id,
        image_url: uploaded.publicUrl,
        alt_text: blankToNull($('#bi-alt').value),
        sort_order: Number($('#bi-order').value || 0),
        is_featured: $('#bi-featured').checked
      };
      const { error } = await client.from('blog_post_images').insert(payload);
      if (error) {
        try { await client.storage.from(STORAGE_BUCKET).remove([uploaded.path]); } catch (_) { /* keep original error */ }
        throw error;
      }
      $('#blog-image-form').reset();
      $('#bi-order').value = '0';
      await loadBlogImages(currentBlog.id);
      toast('Image téléversée et ajoutée à la galerie de l’article.');
    } catch (error) { toast(errorMessage(error), true); }
    finally { if (submitButton) { submitButton.disabled = false; submitButton.textContent = 'Téléverser et ajouter l’image'; } }
  }

  async function handleBlogImageAction(event) {
    const button = event.target.closest('[data-blog-image-remove]');
    if (!button || !currentBlog?.id) return;
    if (!window.confirm('Retirer cette image de la galerie ? Le fichier envoyé dans le stockage du site sera aussi supprimé s’il est géré par cette administration.')) return;
    try {
      const image = blogImages.find((row) => row.id === button.dataset.blogImageRemove);
      const { error } = await client.from('blog_post_images').delete().eq('id', button.dataset.blogImageRemove).eq('blog_post_id', currentBlog.id);
      if (error) throw error;
      if (image?.image_url) {
        const path = storagePathFromPublicUrl(image.image_url);
        if (isManagedStoragePath(path)) {
          const inUse = await isStoragePathInUse(path);
          if (!inUse) {
            const { error: storageError } = await client.storage.from(STORAGE_BUCKET).remove([path]);
            if (storageError) console.warn('Référence supprimée mais fichier Storage conservé :', storageError.message);
          }
        }
      }
      await loadBlogImages(currentBlog.id);
      toast('Image retirée de la galerie.');
    } catch (error) { toast(errorMessage(error), true); }
  }

  function categoryValues(value) {
    const raw = Array.isArray(value) ? value : String(value || '').split(',');
    return [...new Set(raw.map((item) => String(item).trim()).filter(Boolean))];
  }

  function renderProductCategoryDropdown(value) {
    const container = $('#p-category-options');
    const hiddenInput = $('#p-categories');
    if (!container || !hiddenInput) return;
    const selected = categoryValues(value);
    const categories = [...PRODUCT_CATEGORY_OPTIONS, ...selected.filter((item) => !PRODUCT_CATEGORY_OPTIONS.includes(item))];
    container.innerHTML = categories.map((category) => `
      <label class="cms-category-option"><input type="checkbox" data-product-category value="${escapeHTML(category)}" ${selected.includes(category) ? 'checked' : ''}><span>${escapeHTML(category)}</span></label>
    `).join('');
    hiddenInput.value = selected.join(', ');
    updateProductCategorySummary(selected);
    const menu = $('#p-category-menu');
    const button = $('#p-categories-toggle');
    if (menu) menu.hidden = true;
    button?.setAttribute('aria-expanded', 'false');
  }

  function updateProductCategorySummary(values) {
    const selected = categoryValues(values);
    const button = $('#p-categories-toggle');
    const summary = $('#p-categories-summary');
    if (button) button.textContent = selected.length ? `Catégories sélectionnées (${selected.length}) ▾` : 'Choisir des catégories ▾';
    if (summary) summary.textContent = selected.length ? selected.join(' · ') : 'Aucune sélection. Un produit sans catégorie sera classé « Non classé ». ';
  }

  function setSelectValuePreservingOption(select, value) {
    if (!select) return;
    const selectedValue = String(value || '');
    if (selectedValue && ![...select.options].some((option) => option.value === selectedValue)) {
      select.add(new Option(selectedValue, selectedValue));
    }
    select.value = selectedValue;
  }

  function parseCommaList(value) {
    const values = String(value == null ? '' : value).split(',').map((item) => item.trim()).filter(Boolean);
    return values.length ? [...new Set(values)] : ['Non classé'];
  }

  function formatCommaList(value) {
    if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean).join(', ');
    if (typeof value === 'string') return value;
    return '';
  }

  function setImagePreview(previewId, url) {
    const preview = document.getElementById(previewId);
    if (!preview) return;
    const displayUrl = normalizeImageValue(url);
    if (displayUrl) {
      preview.src = displayUrl;
      preview.hidden = false;
    } else {
      preview.removeAttribute('src');
      preview.hidden = true;
    }
  }

  function safeStorageFileName(fileName) {
    const name = String(fileName || 'image').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(-100);
    return name || 'image';
  }

  async function uploadImageFile(file, folder) {
    if (!file) throw new Error('Choisissez un fichier image.');
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];
    if (!allowedTypes.includes(file.type)) throw new Error('Format non pris en charge. Utilisez JPG, PNG, WebP, GIF ou AVIF.');
    if (file.size <= 0 || file.size > MAX_IMAGE_BYTES) throw new Error('La taille du fichier doit être comprise entre 1 octet et 10 Mo.');
    if (!client?.storage) throw new Error('Le stockage Supabase n’est pas disponible.');
    const randomPart = (window.crypto && typeof window.crypto.randomUUID === 'function')
      ? window.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const path = `${folder}/${randomPart}-${safeStorageFileName(file.name)}`;
    const { data, error } = await client.storage.from(STORAGE_BUCKET).upload(path, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type
    });
    if (error) {
      if (/bucket not found|not found/i.test(error.message || '')) {
        throw new Error(`Le bucket Storage « ${STORAGE_BUCKET} » n’existe pas. Exécute la migration SQL de stockage fournie dans le pack.`);
      }
      throw error;
    }
    const storedPath = data?.path || path;
    const { data: urlData } = client.storage.from(STORAGE_BUCKET).getPublicUrl(storedPath);
    if (!urlData?.publicUrl) throw new Error('Supabase a reçu le fichier mais n’a pas retourné son URL publique.');
    return { path: storedPath, publicUrl: urlData.publicUrl };
  }

  function supabasePublicImageUrl(path) {
    const cleanPath = String(path || '').trim().replace(/^\/+/, '');
    if (!cleanPath) return '';
    return `https://qrkinjuhtyfptldlvdyg.supabase.co/storage/v1/object/public/${STORAGE_BUCKET}/${cleanPath.split('/').map((part) => encodeURIComponent(part)).join('/')}`;
  }

  function imageDisplayUrl(localPath, sourceUrl) {
    const local = String(localPath || '').trim();
    const source = String(sourceUrl || '').trim();
    // A path uploaded by this admin is authoritative: render it from Storage even
    // if a legacy external source_url is also present.
    if (isManagedStoragePath(local)) return supabasePublicImageUrl(local);
    if (/^https?:\/\//i.test(local)) return local;
    if (local.startsWith('/')) return local;
    if (/^https?:\/\//i.test(source)) return source;
    if (source.startsWith('/')) return source;
    if (isManagedStoragePath(source)) return supabasePublicImageUrl(source);
    const fallback = local || source;
    return fallback ? supabasePublicImageUrl(fallback) : '';
  }

  function normalizeImageValue(value) {
    const imageValue = String(value || '').trim();
    if (!imageValue) return '';
    return imageDisplayUrl(imageValue, imageValue);
  }

  function isManagedStoragePath(path) {
    return typeof path === 'string' && /^(products|blogs)\//.test(path);
  }

  function storagePathFromPublicUrl(url) {
    if (!url || !client?.storage) return null;
    try {
      const marker = `/storage/v1/object/public/${STORAGE_BUCKET}/`;
      const index = String(url).indexOf(marker);
      if (index < 0) return null;
      return decodeURIComponent(String(url).slice(index + marker.length).split('?')[0]);
    } catch (_) { return null; }
  }

  function blankToNull(value) {
    const text = String(value == null ? '' : value).trim();
    return text || null;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize);
  else initialize();
})();
