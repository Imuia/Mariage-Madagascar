/* Mariage Madagascar — Séjours admin, lecture réelle depuis orders */
(() => {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const tbody = $('#stays-table tbody');
  if (!tbody) return;
  const money = (value) => {
    if (value === null || value === undefined || value === '') return '—';
    let n = Number(value);
    if (!Number.isFinite(n)) return String(value);
    // Stripe et certaines tables stockent les montants en centimes.
    if (Math.abs(n) >= 100000 && Math.abs(n) % 1 === 0) n /= 100;
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(n);
  };
  const text = (v) => (v === null || v === undefined || v === '' ? '' : String(v));
  const pick = (obj, keys) => {
    for (const key of keys) if (obj && obj[key] !== undefined && obj[key] !== null && obj[key] !== '') return obj[key];
    return '';
  };
  const fmtDate = (v) => {
    if (!v) return '—';
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? String(v) : new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(d);
  };
  const getClient = () => {
    const existing = [window.supabaseClient, window.mmSupabase, window.sb, window._supabase, window.supabaseInstance]
      .find((x) => x && typeof x.from === 'function');
    if (existing) return existing;
    const c = window.MARIAGE_SUPABASE, sdk = window.supabase;
    if (c && c.url && c.anonKey && sdk && typeof sdk.createClient === 'function') {
      const client = sdk.createClient(c.url, c.anonKey);
      window.supabaseClient = client; window.mmSupabase = client;
      return client;
    }
    return null;
  };
  const statusInfo = (row) => {
    const raw = String(pick(row, ['status', 'order_status', 'payment_status', 'booking_status', 'state']) || '').toLowerCase();
    if (/paid|paid|confirm|succeeded|complete|success|régl|payé/.test(raw)) return ['Confirmé', 'green'];
    if (/cancel|annul|fail|expired|refund/.test(raw)) return ['Annulé / échoué', ''];
    if (/pending|await|unpaid|processing|en.attente|draft/.test(raw)) return ['En attente', 'orange'];
    return [raw ? raw.replace(/_/g, ' ') : 'Statut non précisé', ''];
  };
  const getName = (row) => pick(row, ['customer_name','client_name','full_name','guest_name','billing_name','name','contact_name','customer_email','email']) || 'Client non renseigné';
  const getProduct = (row) => pick(row, ['product_name','package_name','offer_name','item_name','title','description','product_title','name']) || 'Commande / réservation';
  const getDestination = (row) => pick(row, ['destination','destination_name','city','location','travel_destination']) || '—';
  const getDate = (row) => pick(row, ['booking_date','arrival_date','check_in','start_date','event_date','travel_date','created_at','date']) || '';
  const getAmount = (row) => pick(row, ['total_amount','amount_total','total_price','grand_total','total','amount','price','amount_due','total_eur']);
  function setMetric(label, value, note) {
    const card = [...document.querySelectorAll('.mm-metric')].find(el => el.querySelector('.label')?.textContent.trim() === label);
    if (!card) return;
    card.querySelector('.value').textContent = value;
    const n = card.querySelector('.note'); if (n && note) n.textContent = note;
  }
  function details(row) {
    const existing = document.getElementById('stay-details-dialog');
    if (existing) existing.remove();
    const dialog = document.createElement('dialog');
    dialog.id = 'stay-details-dialog';
    dialog.style.cssText = 'max-width:min(680px,92vw);width:100%;padding:24px;border:1px solid #26364a;border-radius:16px;background:#0e1726;color:#e7eef8;';
    const title = document.createElement('h2'); title.textContent = 'Détails de la commande'; title.style.cssText = 'font-size:20px;font-weight:700;margin-bottom:14px'; dialog.append(title);
    const list = document.createElement('div'); list.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px';
    Object.entries(row).forEach(([key, value]) => {
      if (value === null || typeof value === 'object') return;
      const item = document.createElement('div'); item.style.cssText = 'padding:10px;border:1px solid #26364a;border-radius:8px;overflow-wrap:anywhere';
      const k = document.createElement('small'); k.textContent = key.replace(/_/g, ' '); k.style.cssText = 'display:block;color:#86a0bb;text-transform:capitalize;margin-bottom:4px';
      const v = document.createElement('div'); v.textContent = String(value); item.append(k, v); list.append(item);
    });
    const close = document.createElement('button'); close.textContent = 'Fermer'; close.className = 'mm-btn secondary'; close.style.marginTop = '18px'; close.addEventListener('click', () => dialog.close());
    dialog.append(list, close); document.body.append(dialog); dialog.showModal();
  }
  function render(rows) {
    tbody.replaceChildren();
    if (!rows.length) {
      const tr = document.createElement('tr'), td = document.createElement('td');
      td.colSpan = 7; td.textContent = 'Aucune commande trouvée dans la table orders.'; td.style.textAlign = 'center'; td.style.padding = '28px'; tr.append(td); tbody.append(tr); return;
    }
    rows.forEach(row => {
      const tr = document.createElement('tr');
      const [status, color] = statusInfo(row);
      const date = getDate(row);
      const cells = [getName(row), getProduct(row), getDestination(row), fmtDate(date), money(getAmount(row))];
      cells.forEach((value, i) => { const td = document.createElement('td'); if (i === 0) { const strong = document.createElement('strong'); strong.textContent = value; td.append(strong); } else td.textContent = value; tr.append(td); });
      const st = document.createElement('td'), badge = document.createElement('span'); badge.className = `mm-badge ${color}`.trim(); badge.textContent = status; st.append(badge); tr.append(st);
      const action = document.createElement('td'), btn = document.createElement('button'); btn.className = 'mm-btn secondary'; btn.textContent = 'Détails'; btn.addEventListener('click', () => details(row)); action.append(btn); tr.append(action);
      tbody.append(tr);
    });
  }
  async function load() {
    const refresh = $('#stays-refresh');
    if (refresh) { refresh.disabled = true; refresh.textContent = 'Chargement…'; }
    const client = getClient();
    if (!client) { renderError('Client Supabase introuvable. Vérifiez supabase-config.js.'); return; }
    try {
      const { data, error } = await client.from('orders').select('*').order('created_at', { ascending: false }).limit(500);
      if (error) throw error;
      const rows = Array.isArray(data) ? data : [];
      render(rows);
      const total = rows.reduce((sum, row) => { const n = Number(getAmount(row)); return sum + (Number.isFinite(n) ? (Math.abs(n) >= 100000 ? n / 100 : n) : 0); }, 0);
      const pending = rows.filter(row => /pending|await|unpaid|processing|en.attente|draft/i.test(String(pick(row, ['status','order_status','payment_status','booking_status','state']) || ''))).length;
      setMetric('Séjours suivis', String(rows.length), 'Commandes lues depuis Supabase');
      setMetric('À confirmer', String(pending), 'Statuts en attente détectés');
      setMetric('Valeur estimée', money(total), 'Somme des montants présents dans orders');
      setMetric('Actions à traiter', '—', 'Aucune tâche dédiée dans la base identifiée');
      const notice = $('#stays-data-notice'); if (notice) notice.textContent = `Données réelles chargées depuis Supabase · table orders · ${rows.length} enregistrement(s). Les séjours sont affichés à partir des commandes existantes.`;
      const filter = document.querySelector('[data-filter-target="#stays-table"]');
      if (filter) filter.dispatchEvent(new Event('input', { bubbles: true }));
    } catch (err) {
      console.error('[Séjours admin] Chargement orders impossible', err);
      renderError(`Impossible de lire la table orders : ${err.message || 'erreur Supabase'}`);
    } finally {
      if (refresh) { refresh.disabled = false; refresh.textContent = 'Actualiser'; }
    }
  }
  function renderError(message) {
    tbody.replaceChildren(); const tr = document.createElement('tr'), td = document.createElement('td'); td.colSpan = 7; td.textContent = message; td.style.cssText = 'padding:24px;color:#fca5a5;text-align:left'; tr.append(td); tbody.append(tr);
    const notice = $('#stays-data-notice'); if (notice) notice.textContent = message;
    setMetric('Séjours suivis', '—', 'Données indisponibles'); setMetric('À confirmer', '—', 'Données indisponibles'); setMetric('Valeur estimée', '—', 'Données indisponibles'); setMetric('Actions à traiter', '—', 'Données indisponibles');
    const refresh = $('#stays-refresh'); if (refresh) { refresh.disabled = false; refresh.textContent = 'Réessayer'; }
  }
  const refresh = $('#stays-refresh'); if (refresh) refresh.addEventListener('click', load);
  const filter = document.querySelector('[data-filter-target="#stays-table"]');
  if (filter) filter.addEventListener('input', () => { const q = filter.value.toLowerCase(); [...tbody.rows].forEach(row => row.hidden = !row.textContent.toLowerCase().includes(q)); });
  load();
})();
