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

  function showDetails(row) {
    const dialog = document.createElement('dialog');
    dialog.style.cssText = 'max-width:min(760px,94vw);width:100%;max-height:88vh;overflow:auto;padding:24px;border:1px solid #2a3a48;border-radius:16px;background:#0e1726;color:#e7eef8;';
    const heading = document.createElement('h2');
    heading.textContent = 'Détails du dossier mariage';
    heading.style.cssText = 'font-size:22px;font-weight:700;margin-bottom:16px';
    dialog.append(heading);
    const grid = document.createElement('div');
    grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px';
    const fields = [
      ['Client', row.client], ['E-mail', row.order.guest_email || '—'], ['Téléphone', row.order.guest_phone || '—'],
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
    const itemHeading = document.createElement('h3');
    itemHeading.textContent = 'Prestations de la commande';
    itemHeading.style.cssText = 'font-size:16px;font-weight:700;margin:18px 0 8px';
    dialog.append(itemHeading);
    const list = document.createElement('ul');
    list.style.cssText = 'padding-left:20px;list-style:disc';
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
    const close = document.createElement('button');
    close.type = 'button';
    close.textContent = 'Fermer';
    close.className = 'bg-primary/15 border border-primary/30 text-primary rounded-lg px-4 py-2 text-sm mt-5';
    close.addEventListener('click', () => dialog.close());
    dialog.append(close);
    dialog.addEventListener('close', () => dialog.remove());
    document.body.append(dialog);
    dialog.showModal();
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
