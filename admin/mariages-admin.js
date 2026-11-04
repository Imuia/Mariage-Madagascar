/* Mariage Madagascar — Gestion des mariages (données réelles Supabase) */
(() => {
  'use strict';

  const $ = (selector) => document.querySelector(selector);
  const tbody = $('#mm-weddings-rows');
  if (!tbody) return;

  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
  const pick = (obj, keys) => {
    for (const key of keys) {
      const value = obj?.[key];
      if (value !== null && value !== undefined && String(value).trim() !== '') return value;
    }
    return '';
  };
  const money = (value) => {
    if (value === '' || value === null || value === undefined || !Number.isFinite(Number(value))) return '—';
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(Number(value));
  };
  const fmtDate = (value) => {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(date);
  };
  const getClient = () => {
    const existing = [window.supabaseClient, window.mmSupabase, window.sb, window._supabase, window.supabaseInstance]
      .find((client) => client && typeof client.from === 'function');
    if (existing) return existing;
    const config = window.MARIAGE_SUPABASE;
    const sdk = window.supabase;
    if (config?.url && config?.anonKey && sdk?.createClient) {
      const client = sdk.createClient(config.url, config.anonKey);
      window.supabaseClient = client;
      window.mmSupabase = client;
      return client;
    }
    return null;
  };

  const optionsObject = (item) => {
    const value = item?.options_snapshot;
    if (value && typeof value === 'object' && !Array.isArray(value)) return value;
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
      } catch (_) {}
    }
    return {};
  };
  const flatten = (value) => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string' || typeof value === 'number') return String(value);
    if (Array.isArray(value)) return value.map(flatten).filter(Boolean).join(', ');
    if (typeof value === 'object') return Object.values(value).map(flatten).filter(Boolean).join(' · ');
    return '';
  };
  const itemDestination = (item) => {
    const opts = optionsObject(item);
    const direct = pick(opts, ['destination', 'destination_name', 'city', 'location', 'travel_destination', 'destinationLabel', 'lieu', 'ville']);
    if (direct) return typeof direct === 'object' ? flatten(direct) : String(direct);
    const combined = `${item?.product_name || ''} ${item?.variation_name || ''} ${flatten(opts)}`;
    const places = [
      'Nosy Be', 'Nosy Saba', 'Nosy Iranja', 'Sainte-Marie', 'Île Sainte-Marie',
      'Antananarivo', 'Morondava', 'Tuléar', 'Toliara', 'Diego-Suarez',
      'Antsiranana', 'Isalo', 'Madagascar'
    ];
    const found = places.find((place) => new RegExp(place.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(combined));
    return found || '';
  };
  const isWeddingItem = (item) => {
    const value = `${item?.product_name || ''} ${item?.variation_name || ''} ${item?.product_slug || ''} ${item?.item_type || ''}`.toLowerCase();
    return /mariage|wedding|cérémon|ceremon|nuptial|demande en mariage|anniversaire de mariage/.test(value);
  };
  const clientName = (order) => {
    const first = pick(order, ['guest_first_name', 'first_name', 'customer_first_name', 'client_first_name']);
    const last = pick(order, ['guest_last_name', 'last_name', 'customer_last_name', 'client_last_name']);
    return `${first} ${last}`.trim() || pick(order, ['customer_name', 'client_name', 'full_name', 'guest_name', 'billing_name', 'name']) || pick(order, ['guest_email', 'email']) || 'Client non renseigné';
  };
  const statusInfo = (order) => {
    const status = String(pick(order, ['status', 'order_status', 'payment_status']) || '').toLowerCase();
    if (/cancel|annul|fail|refund/.test(status)) return ['Annulé / échoué', 'bg-rose-400/10 text-rose-300'];
    if (/paid|confirm|succeed|complete|success|payé|régl/.test(status)) return ['Confirmé', 'bg-emerald-400/10 text-emerald-300'];
    if (/pending|await|unpaid|processing|draft|attente/.test(status)) return ['En attente', 'bg-amber-400/10 text-amber-300'];
    return [status ? status.replace(/_/g, ' ') : 'Non précisé', 'bg-primary/10 text-primary'];
  };

  let currentRows = [];

  function exportGuestsToCsv(weddingName, guests) {
    if (!guests || !guests.length) {
      alert('Aucun invité à exporter pour ce mariage.');
      return;
    }
    const headers = ['Nom & Prénom', 'E-mail', 'Groupe', 'Statut RSVP', 'Régime alimentaire', 'Table'];
    const rsvpLabels = { confirmed: 'Confirmé', pending: 'En attente', declined: 'Décliné' };
    const rows = guests.map(g => [
      g.name || '',
      g.email || '',
      g.category || '',
      rsvpLabels[g.rsvp_status] || g.rsvp_status || 'En attente',
      g.dietary_requirements || '',
      g.table_name || ''
    ]);
    const csvContent = [
      headers.map(h => `"${h.replace(/"/g, '""')}"`).join(';'),
      ...rows.map(row => row.map(cell => `"${String(cell || '').replace(/"/g, '""')}"`).join(';'))
    ].join('\r\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const safeName = (weddingName || 'mariage').replace(/[^a-z0-9]/gi, '_').toLowerCase();
    link.setAttribute('href', url);
    link.setAttribute('download', `invites_${safeName}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  async function loadGuestsForOrder(order, clientInstance) {
    if (!clientInstance) return { project: null, guests: [] };
    try {
      let projectId = null;
      let project = null;

      // 1. Recherche par user_id du client sur client_projects
      if (order.user_id) {
        const { data: pData } = await clientInstance
          .from('client_projects')
          .select('*')
          .eq('owner_id', order.user_id)
          .limit(1)
          .maybeSingle();
        if (pData) {
          project = pData;
          projectId = pData.id;
        }
      }

      // 2. Recherche par e-mail si aucun user_id ou aucun projet trouvé
      if (!projectId && (order.guest_email || order.email)) {
        const email = (order.guest_email || order.email).trim().toLowerCase();
        // Recherche dans client_profiles
        const { data: profData } = await clientInstance
          .from('client_profiles')
          .select('id')
          .ilike('email', email)
          .limit(1)
          .maybeSingle();
        if (profData && profData.id) {
          const { data: pData } = await clientInstance
            .from('client_projects')
            .select('*')
            .eq('owner_id', profData.id)
            .limit(1)
            .maybeSingle();
          if (pData) {
            project = pData;
            projectId = pData.id;
          }
        }
      }

      if (!projectId) return { project: null, guests: [] };

      // 3. Récupération des invités de ce projet
      const { data: guests, error } = await clientInstance
        .from('client_guests')
        .select('*')
        .eq('project_id', projectId)
        .order('name', { ascending: true });

      if (error) {
        console.warn('[Mariages Admin] Erreur chargement client_guests:', error);
        return { project, guests: [] };
      }
      return { project, guests: guests || [] };
    } catch (e) {
      console.warn('[Mariages Admin] Exception chargement invités:', e);
      return { project: null, guests: [] };
    }
  }

  async function showDetails(row) {
    const dialog = document.createElement('dialog');
    dialog.style.cssText = 'max-width:min(900px,96vw);width:100%;max-height:90vh;overflow:auto;padding:24px;border:1px solid #2a3a48;border-radius:16px;background:#0e1726;color:#e7eef8;';
    const heading = document.createElement('h2');
    heading.textContent = 'Détails du dossier mariage';
    heading.style.cssText = 'font-size:22px;font-weight:700;margin-bottom:16px';
    dialog.append(heading);

    const grid = document.createElement('div');
    grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px';
    const fields = [
      ['Client', row.client], ['E-mail', row.order.guest_email || row.order.email || '—'], ['Téléphone', row.order.guest_phone || '—'],
      ['Formule / prestation', row.products || '—'], ['Destination', row.destination || 'Non renseignée dans la commande'],
      ['Date prévue / arrivée', fmtDate(row.date)], ['Montant commande', money(row.order.total_amount)],
      ['Statut commande', pick(row.order, ['status']) || '—'], ['Statut paiement', pick(row.order, ['payment_status']) || '—'],
      ['Référence', pick(row.order, ['order_number', 'id']) || '—'], ['Notes commande', row.order.notes || '—']
    ];
    fields.forEach(([label, value]) => {
      const box = document.createElement('div');
      box.style.cssText = 'padding:12px;border:1px solid #26364a;border-radius:9px;overflow-wrap:anywhere';
      const small = document.createElement('div');
      small.textContent = label;
      small.style.cssText = 'font-size:11px;color:#86a0bb;margin-bottom:5px';
      const val = document.createElement('div');
      val.textContent = String(value ?? '—');
      box.append(small, val);
      grid.append(box);
    });
    dialog.append(grid);

    // Section Suivi & Affectation de l'équipe interne
    const assignSection = document.createElement('div');
    assignSection.style.cssText = 'margin-top:20px;padding:16px;border:1px solid #26364a;border-radius:12px;background:#141f32';
    assignSection.innerHTML = `
      <h3 style="font-size:15px;font-weight:700;color:#7dd3fc;margin-bottom:10px;display:flex;align-items:center;gap:8px;">
        <svg class="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
        Équipe affectée au dossier
      </h3>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;font-size:13px;">
        <div>
          <span style="color:#86a0bb;display:block;font-size:11px;margin-bottom:4px;">Chargé de production responsable :</span>
          <span id="dossier-assigned-prod" style="font-weight:600;color:#e2e8f0;">${esc(row.order.assigned_production_name || 'En attente d\'attribution')}</span>
        </div>
        <div>
          <span style="color:#86a0bb;display:block;font-size:11px;margin-bottom:4px;">Commercial responsable :</span>
          <span id="dossier-assigned-comm" style="font-weight:600;color:#e2e8f0;">${esc(row.order.assigned_commercial_name || 'En attente d\'attribution')}</span>
        </div>
      </div>
    `;
    dialog.append(assignSection);

    // Prestations de la commande
    const itemHeading = document.createElement('h3');
    itemHeading.textContent = 'Prestations de la commande';
    itemHeading.style.cssText = 'font-size:16px;font-weight:700;margin:20px 0 8px';
    dialog.append(itemHeading);
    const list = document.createElement('ul');
    list.style.cssText = 'padding-left:20px;list-style:disc;font-size:13px;';
    row.items.forEach((item) => {
      const li = document.createElement('li');
      const amount = item.total_price == null ? '' : ` — ${money(item.total_price)}`;
      li.textContent = `${item.product_name || 'Prestation'}${item.variation_name ? ` (${item.variation_name})` : ''}${amount}`;
      list.append(li);
    });
    if (!row.items.length) {
      const li = document.createElement('li');
      li.textContent = 'Aucune ligne de prestation disponible.';
      list.append(li);
    }
    dialog.append(list);

    // Section Rubrique Invités & RSVP
    const guestSection = document.createElement('div');
    guestSection.style.cssText = 'margin-top:24px;border-top:1px solid #2a3a48;padding-top:18px';
    guestSection.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:12px;">
        <div>
          <h3 style="font-size:16px;font-weight:700;color:#e7eef8;margin:0;">Liste des invités & RSVP</h3>
          <p style="font-size:12px;color:#86a0bb;margin:2px 0 0 0;">Synchronisé avec l'espace client du couple</p>
        </div>
        <button type="button" id="btn-export-guests-csv" class="bg-primary/20 border border-primary/40 text-primary hover:bg-primary/30 rounded-lg px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 transition-colors" style="display:none;">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
          Exporter en CSV
        </button>
      </div>
      <div id="guests-stats-box" style="display:none;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px;margin-bottom:14px;">
        <div style="background:#131d2e;border:1px solid #243447;border-radius:8px;padding:8px 12px;text-align:center;">
          <div style="font-size:11px;color:#86a0bb;">Total invités</div>
          <div id="stat-total-guests" style="font-size:18px;font-weight:700;color:#e7eef8;">0</div>
        </div>
        <div style="background:#131d2e;border:1px solid #243447;border-radius:8px;padding:8px 12px;text-align:center;">
          <div style="font-size:11px;color:#34d399;">Confirmés</div>
          <div id="stat-confirmed-guests" style="font-size:18px;font-weight:700;color:#34d399;">0</div>
        </div>
        <div style="background:#131d2e;border:1px solid #243447;border-radius:8px;padding:8px 12px;text-align:center;">
          <div style="font-size:11px;color:#fbbf24;">En attente</div>
          <div id="stat-pending-guests" style="font-size:18px;font-weight:700;color:#fbbf24;">0</div>
        </div>
        <div style="background:#131d2e;border:1px solid #243447;border-radius:8px;padding:8px 12px;text-align:center;">
          <div style="font-size:11px;color:#f87171;">Déclinés</div>
          <div id="stat-declined-guests" style="font-size:18px;font-weight:700;color:#f87171;">0</div>
        </div>
      </div>
      <div id="guests-table-container" style="max-height:260px;overflow:auto;border:1px solid #243447;border-radius:8px;background:#0d1522;">
        <div style="padding:16px;text-align:center;font-size:13px;color:#86a0bb;" id="guests-loading-msg">Chargement des invités depuis le projet client...</div>
      </div>
    `;
    dialog.append(guestSection);

    // Bouton de fermeture
    const closeBtnWrap = document.createElement('div');
    closeBtnWrap.style.cssText = 'display:flex;justify-content:flex-end;margin-top:20px;';
    const close = document.createElement('button');
    close.type = 'button';
    close.textContent = 'Fermer';
    close.className = 'bg-primary/15 border border-primary/30 text-primary hover:bg-primary/25 rounded-lg px-5 py-2 text-sm font-semibold transition-colors';
    close.addEventListener('click', () => dialog.close());
    closeBtnWrap.append(close);
    dialog.append(closeBtnWrap);
    dialog.addEventListener('close', () => dialog.remove());
    document.body.append(dialog);
    dialog.showModal();

    // Chargement asynchrone des invités
    const client = getClient();
    const { project, guests } = await loadGuestsForOrder(row.order, client);
    const container = dialog.querySelector('#guests-table-container');
    const statsBox = dialog.querySelector('#guests-stats-box');
    const exportBtn = dialog.querySelector('#btn-export-guests-csv');

    if (!guests || guests.length === 0) {
      if (container) {
        container.innerHTML = `
          <div style="padding:20px;text-align:center;font-size:13px;color:#86a0bb;">
            ${project ? 'Le couple n\'a pas encore enregistré d\'invités pour ce mariage dans son espace client.' : 'Aucun projet client associé trouvé pour ce dossier.'}
          </div>
        `;
      }
    } else {
      if (statsBox) statsBox.style.display = 'grid';
      if (exportBtn) {
        exportBtn.style.display = 'inline-flex';
        exportBtn.addEventListener('click', () => exportGuestsToCsv(row.client, guests));
      }

      // Stats
      const confirmed = guests.filter(g => g.rsvp_status === 'confirmed').length;
      const pending = guests.filter(g => g.rsvp_status === 'pending').length;
      const declined = guests.filter(g => g.rsvp_status === 'declined').length;

      const tEl = dialog.querySelector('#stat-total-guests');
      const cEl = dialog.querySelector('#stat-confirmed-guests');
      const pEl = dialog.querySelector('#stat-pending-guests');
      const dEl = dialog.querySelector('#stat-declined-guests');
      if (tEl) tEl.textContent = String(guests.length);
      if (cEl) cEl.textContent = String(confirmed);
      if (pEl) pEl.textContent = String(pending);
      if (dEl) dEl.textContent = String(declined);

      // Table HTML
      let html = `
        <table style="width:100%;font-size:12px;border-collapse:collapse;text-align:left;">
          <thead style="background:#162235;color:#94a3b8;text-transform:uppercase;font-size:10px;position:sticky;top:0;">
            <tr>
              <th style="padding:10px 12px;border-bottom:1px solid #243447;">Nom</th>
              <th style="padding:10px 12px;border-bottom:1px solid #243447;">Groupe</th>
              <th style="padding:10px 12px;border-bottom:1px solid #243447;">RSVP</th>
              <th style="padding:10px 12px;border-bottom:1px solid #243447;">Régime alimentaire</th>
              <th style="padding:10px 12px;border-bottom:1px solid #243447;">Table</th>
            </tr>
          </thead>
          <tbody style="divide-y divide-outline-variant/50;">
      `;
      guests.forEach(g => {
        let rsvpBadge = '<span style="background:rgba(251,191,36,0.15);color:#fbbf24;padding:2px 6px;border-radius:4px;font-size:11px;">En attente</span>';
        if (g.rsvp_status === 'confirmed') {
          rsvpBadge = '<span style="background:rgba(52,211,153,0.15);color:#34d399;padding:2px 6px;border-radius:4px;font-size:11px;">Confirmé</span>';
        } else if (g.rsvp_status === 'declined') {
          rsvpBadge = '<span style="background:rgba(248,113,113,0.15);color:#f87171;padding:2px 6px;border-radius:4px;font-size:11px;">Décliné</span>';
        }
        html += `
          <tr style="border-bottom:1px solid #1a273b;">
            <td style="padding:8px 12px;">
              <div style="font-weight:600;color:#e2e8f0;">${esc(g.name)}</div>
              ${g.email ? `<div style="font-size:11px;color:#86a0bb;">${esc(g.email)}</div>` : ''}
            </td>
            <td style="padding:8px 12px;color:#cbd5e1;">${esc(g.category || '—')}</td>
            <td style="padding:8px 12px;">${rsvpBadge}</td>
            <td style="padding:8px 12px;color:#e2e8f0;">
              ${g.dietary_requirements ? `<span style="background:#1e293b;border:1px solid #334155;border-radius:4px;padding:2px 6px;display:inline-block;">${esc(g.dietary_requirements)}</span>` : '<span style="color:#64748b;">Standard</span>'}
            </td>
            <td style="padding:8px 12px;color:#cbd5e1;">${esc(g.table_name || 'Non attribuée')}</td>
          </tr>
        `;
      });
      html += '</tbody></table>';
      if (container) container.innerHTML = html;
    }
  }

  function render(rows) {
    tbody.replaceChildren();
    if (!rows.length) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 6;
      td.className = 'p-5 text-on-surface-variant';
      td.textContent = 'Aucune commande associée à un mariage trouvée. Les données de démonstration ont été retirées.';
      tr.append(td);
      tbody.append(tr);
      return;
    }
    rows.forEach((row) => {
      const tr = document.createElement('tr');
      tr.className = 'hover:bg-primary/5 cursor-pointer';
      tr.tabIndex = 0;
      const values = [row.client, row.destination || 'Non renseignée', fmtDate(row.date), money(row.order.total_amount)];
      values.forEach((value, index) => {
        const td = document.createElement('td');
        td.className = `p-4 ${index === 0 ? 'font-semibold' : ''} ${index === 3 ? 'text-primary' : ''}`;
        td.textContent = value;
        tr.append(td);
      });
      const statusTd = document.createElement('td');
      statusTd.className = 'p-4';
      const badge = document.createElement('span');
      badge.className = `rounded-md px-2 py-1 text-xs ${row.statusClass}`;
      badge.textContent = row.status;
      statusTd.append(badge);
      tr.append(statusTd);
      const actionTd = document.createElement('td');
      actionTd.className = 'p-4';
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'text-primary hover:underline';
      button.textContent = 'Détails';
      button.addEventListener('click', (event) => { event.stopPropagation(); showDetails(row); });
      actionTd.append(button);
      tr.append(actionTd);
      tr.addEventListener('click', () => showDetails(row));
      tr.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); showDetails(row); }
      });
      tbody.append(tr);
    });
  }

  function setKpi(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  }

  async function load() {
    const notice = $('#weddings-data-notice');
    const refreshButtons = [$('#weddings-refresh'), $('#weddings-refresh-top')].filter(Boolean);
    refreshButtons.forEach((button) => { button.disabled = true; button.textContent = 'Chargement…'; });
    if (notice) notice.textContent = 'Chargement des commandes et prestations depuis Supabase…';
    const client = getClient();
    if (!client) {
      if (notice) notice.textContent = 'Client Supabase introuvable. Vérifiez supabase-config.js et admin-auth.js.';
      tbody.innerHTML = '<tr><td class="p-4 text-rose-300" colspan="6">Connexion Supabase indisponible.</td></tr>';
      refreshButtons.forEach((button) => { button.disabled = false; button.textContent = 'Actualiser'; });
      return;
    }
    try {
      const ordersResult = await client.from('orders').select('*').order('created_at', { ascending: false }).limit(500);
      if (ordersResult.error) throw ordersResult.error;
      const orders = Array.isArray(ordersResult.data) ? ordersResult.data : [];

      const itemsResult = await client.from('order_items').select('*').limit(2000);
      if (itemsResult.error) throw itemsResult.error;
      const items = Array.isArray(itemsResult.data) ? itemsResult.data : [];
      const byOrder = new Map();
      items.forEach((item) => {
        const key = String(item.order_id);
        if (!byOrder.has(key)) byOrder.set(key, []);
        byOrder.get(key).push(item);
      });

      const weddingRows = [];
      orders.forEach((order) => {
        const orderItems = byOrder.get(String(order.id)) || [];
        const weddingItems = orderItems.filter(isWeddingItem);
        if (!weddingItems.length) return;
        const dest = weddingItems.map(itemDestination).find(Boolean) || '';
        const firstItem = weddingItems[0];
        const opts = optionsObject(firstItem);
        const date = pick(opts, ['wedding_date', 'event_date', 'arrival_date', 'booking_date', 'date']) ||
          pick(firstItem, ['booking_date']) || pick(order, ['booking_date', 'event_date', 'wedding_date', 'created_at']);
        const [status, statusClass] = statusInfo(order);
        weddingRows.push({
          order,
          items: weddingItems,
          client: clientName(order),
          products: weddingItems.map((item) => `${item.product_name || 'Prestation'}${item.variation_name ? ` — ${item.variation_name}` : ''}`).join(' · '),
          destination: dest,
          date,
          status,
          statusClass
        });
      });

      currentRows = weddingRows;
      render(weddingRows);

      const now = new Date();
      const in30Days = new Date(now.getTime() + 30 * 86400000);
      const upcoming = weddingRows.filter((row) => {
        if (!row.date) return false;
        const date = new Date(row.date);
        return !Number.isNaN(date.getTime()) && date >= new Date(now.toDateString()) && date <= in30Days;
      }).length;
      const amountTotal = weddingRows.reduce((sum, row) => sum + (Number(row.order.total_amount) || 0), 0);
      const guests = weddingRows.reduce((sum, row) => sum + row.items.reduce((n, item) => n + (Number(item.pax) || 0) * (Number(item.quantity) || 1), 0), 0);
      setKpi('weddings-kpi-total', String(weddingRows.length));
      setKpi('weddings-kpi-upcoming', String(upcoming));
      setKpi('weddings-kpi-guests', guests ? new Intl.NumberFormat('fr-FR').format(guests) : '—');
      setKpi('weddings-kpi-revenue', money(amountTotal));

      const statusSummary = $('#weddings-status-summary');
      if (statusSummary) {
        const counts = weddingRows.reduce((acc, row) => { acc[row.status] = (acc[row.status] || 0) + 1; return acc; }, {});
        statusSummary.replaceChildren();
        Object.entries(counts).forEach(([label, count]) => {
          const line = document.createElement('div');
          line.className = 'flex justify-between gap-4';
          const name = document.createElement('span'); name.textContent = label;
          const number = document.createElement('strong'); number.textContent = String(count);
          line.append(name, number); statusSummary.append(line);
        });
        if (!Object.keys(counts).length) statusSummary.textContent = 'Aucun dossier mariage trouvé dans les commandes.';
      }
      if (notice) notice.textContent = `Données réelles chargées depuis Supabase · ${orders.length} commande(s) et ${items.length} ligne(s) consultées · ${weddingRows.length} commande(s) associée(s) à un mariage.`;
      const filter = document.querySelector('[data-filter-target="#mm-weddings-table"]');
      if (filter) filter.dispatchEvent(new Event('input', { bubbles: true }));
    } catch (error) {
      console.error('[Admin mariages] Chargement impossible', error);
      if (notice) notice.textContent = `Erreur de chargement Supabase : ${error.message || 'erreur inconnue'}`;
      tbody.innerHTML = `<tr><td class="p-4 text-rose-300" colspan="6">Impossible de charger les mariages : ${esc(error.message || 'erreur Supabase')}</td></tr>`;
      setKpi('weddings-kpi-total', '—');
      setKpi('weddings-kpi-upcoming', '—');
      setKpi('weddings-kpi-guests', '—');
      setKpi('weddings-kpi-revenue', '—');
    } finally {
      refreshButtons.forEach((button) => { button.disabled = false; button.textContent = 'Actualiser les mariages'; });
    }
  }

  const filter = document.querySelector('[data-filter-target="#mm-weddings-table"]');
  if (filter) filter.addEventListener('input', () => {
    const query = filter.value.toLowerCase();
    [...tbody.rows].forEach((row) => { row.hidden = !row.textContent.toLowerCase().includes(query); });
  });
  $('#weddings-refresh')?.addEventListener('click', load);
  $('#weddings-refresh-top')?.addEventListener('click', load);
  load();
})();
