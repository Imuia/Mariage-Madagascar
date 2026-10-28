/* Mariage Madagascar — Finance admin integration.
   Retains the existing Stitch/HTML layouts. All financial reads/writes go through /api/admin-finance.
   Stripe and order payment states are read-only; no banking transfer is initiated. */
(() => {
  'use strict';

  const page = (document.documentElement.dataset.adminPage || '').toLowerCase();
  const pageName = page.replace(/\.html$/, '');
  const allowedPages = new Set(['finance', 'paiements', 'facturation', 'commissions', 'rapports']);
  if (!allowedPages.has(pageName)) return;

  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
  const esc = (value) => String(value == null ? '' : value).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[c]);
  const num = (value) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  };
  const round = (value) => Math.round((num(value) + Number.EPSILON) * 100) / 100;
  const money = (value, currency = 'EUR') => new Intl.NumberFormat('fr-FR', {
    style: 'currency', currency: /^[A-Z]{3}$/.test(String(currency || '')) ? currency : 'EUR', maximumFractionDigits: 2
  }).format(num(value));
  const date = (value) => {
    if (!value) return '—';
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? '—' : new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(d);
  };
  const shortDate = (value) => {
    if (!value) return '—';
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? '—' : new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }).format(d);
  };
  const statusLabel = (status) => ({
    succeeded: 'Encaissé', paid: 'Payé', pending: 'En attente', failed: 'Échoué', refunded: 'Remboursé',
    draft: 'Brouillon', sent: 'Envoyé', accepted: 'Accepté', rejected: 'Refusé', cancelled: 'Annulé',
    converted: 'Converti', recorded: 'Enregistrée'
  }[String(status || '')] || String(status || 'Inconnu'));
  const statusClass = (status) => ({
    succeeded: 'green', paid: 'green', accepted: 'green', recorded: 'green', pending: 'orange',
    draft: 'orange', sent: 'blue', failed: 'red', refunded: 'purple', cancelled: 'red', rejected: 'red', converted: 'purple'
  }[String(status || '')] || 'neutral');
  const statusBadge = (status) => `<span class="mm-badge ${statusClass(status)}">${esc(statusLabel(status))}</span>`;
  const emptyRow = (cols, message) => `<tr><td colspan="${cols}" style="padding:24px 12px;text-align:center;color:var(--mm-muted,#a0b4c4);font-size:12px">${esc(message)}</td></tr>`;
  let data = { orders: [], payments: [], documents: [], commissions: [], expenses: [], settings: [], warnings: [], serverTime: null };
  let initialized = false;
  let busy = false;
  let documentFilter = 'all';
  let paymentFilter = 'all';
  let paymentSearch = '';
  let documentSearch = '';
  let financeDocumentType = 'quote';

  function toast(message, isError = false) {
    if (typeof window.mmToast === 'function') {
      window.mmToast(message);
      const el = $('#mm-toast');
      if (el && isError) el.classList.add('mm-toast-error');
      return;
    }
    let el = $('#mm-toast');
    if (!el) {
      el = document.createElement('div'); el.id = 'mm-toast'; el.className = 'mm-toast'; el.setAttribute('role', 'status');
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.className = `mm-toast show${isError ? ' mm-toast-error' : ''}`;
  }

  function noticeElement() {
    let el = $('#finance-data-notice');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'finance-data-notice';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    const anchor = $('.mm-head') || $('main h1')?.closest('div.flex.flex-col') || $('main h1')?.parentElement;
    if (anchor?.parentNode) anchor.parentNode.insertBefore(el, anchor.nextSibling);
    else document.querySelector('main')?.prepend(el);
    return el;
  }

  function setNotice(message, kind = 'info') {
    const el = noticeElement();
    el.dataset.kind = kind;
    el.innerHTML = message ? esc(message) : '';
  }

  function setNoticeWithWarnings() {
    const warnings = Array.isArray(data.warnings) ? data.warnings : [];
    if (!warnings.length) {
      setNotice(`Données chargées depuis Supabase · ${new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(data.serverTime || Date.now()))}. Les paiements Stripe restent en lecture seule.`, 'info');
      return;
    }
    const migrationWarning = warnings.some((w) => /mm_financial_documents|mm_provider_commissions|mm_financial_expenses|mm_finance_settings|does not exist|schema cache/i.test(w));
    const prefix = migrationWarning
      ? 'Certaines fonctions financières attendent la migration SQL : crée les tables financières avant de saisir devis, dépenses ou commissions. '
      : 'Certaines données ne sont pas disponibles. Les valeurs concernées restent vides, sans chiffres fictifs. ';
    const el = noticeElement();
    el.dataset.kind = migrationWarning ? 'warning' : 'error';
    el.innerHTML = `<strong>${esc(migrationWarning ? 'Migration financière nécessaire' : 'Chargement partiel')}</strong><p>${esc(prefix)}</p><details><summary>Détails techniques</summary><ul>${warnings.map((w) => `<li>${esc(w)}</li>`).join('')}</ul></details>`;
  }

  async function api(action, body) {
    const isWrite = body !== undefined;
    const response = await fetch('/api/admin-finance' + (isWrite ? '' : `?action=${encodeURIComponent(action)}`), {
      method: isWrite ? 'POST' : 'GET', credentials: 'same-origin', cache: 'no-store',
      headers: isWrite ? { 'Content-Type': 'application/json' } : {},
      body: isWrite ? JSON.stringify({ action, ...body }) : undefined
    });
    let payload = {};
    try { payload = await response.json(); } catch (_) {}
    if (!response.ok) throw new Error(payload.error || `Erreur serveur (${response.status}).`);
    return payload;
  }

  function setting(key, fallback) {
    const row = (data.settings || []).find((x) => x.setting_key === key);
    if (!row) return fallback;
    let value = row.setting_value;
    if (typeof value === 'string') { try { value = JSON.parse(value); } catch (_) {} }
    return value == null ? fallback : value;
  }

  function transactions() {
    const orderMap = new Map((data.orders || []).map((x) => [String(x.id), x]));
    const linkedOrders = new Set();
    const output = (data.payments || []).map((payment) => {
      const order = orderMap.get(String(payment.order_id)) || {};
      linkedOrders.add(String(payment.order_id));
      return {
        id: payment.id,
        reference: payment.stripe_payment_intent_id || payment.stripe_checkout_session_id || order.order_number || payment.id,
        order_id: payment.order_id,
        client: `${order.guest_first_name || ''} ${order.guest_last_name || ''}`.trim() || order.guest_email || 'Client non renseigné',
        email: order.guest_email || '',
        description: order.order_number ? `Commande ${order.order_number}` : (order.notes || 'Paiement de commande'),
        created_at: payment.created_at || order.created_at,
        amount: payment.amount,
        currency: payment.currency || order.currency || 'EUR',
        status: payment.status || 'pending',
        method: payment.payment_method || 'Non précisé',
        stripe_id: payment.stripe_payment_intent_id || payment.stripe_charge_id || ''
      };
    });
    (data.orders || []).forEach((order) => {
      if (linkedOrders.has(String(order.id))) return;
      const state = order.payment_status === 'paid' ? 'succeeded' : order.payment_status === 'refunded' ? 'refunded' : order.payment_status === 'failed' ? 'failed' : 'pending';
      output.push({
        id: `order-${order.id}`, reference: order.order_number || order.id, order_id: order.id,
        client: `${order.guest_first_name || ''} ${order.guest_last_name || ''}`.trim() || order.guest_email || 'Client non renseigné',
        email: order.guest_email || '', description: 'Statut de paiement de commande',
        created_at: order.updated_at || order.created_at, amount: order.total_amount,
        currency: order.currency || 'EUR', status: state, method: 'Statut commande',
        stripe_id: order.stripe_payment_intent_id || ''
      });
    });
    return output.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
  }

  function totals() {
    const tx = transactions();
    const currencyRows = (rows, getter) => rows.filter((x) => !x.currency || x.currency === 'EUR').reduce((s, x) => s + num(getter(x)), 0);
    const income = currencyRows(tx.filter((x) => x.status === 'succeeded'), (x) => x.amount);
    const pending = currencyRows(tx.filter((x) => x.status === 'pending'), (x) => x.amount);
    const refunds = currencyRows(tx.filter((x) => x.status === 'refunded'), (x) => x.amount);
    const expenses = currencyRows((data.expenses || []).filter((x) => x.status !== 'cancelled'), (x) => x.amount);
    const paidCommissions = currencyRows((data.commissions || []).filter((x) => x.status === 'paid'), (x) => x.commission_amount);
    const pendingCommissions = currencyRows((data.commissions || []).filter((x) => x.status === 'pending'), (x) => x.commission_amount);
    const outstandingInvoices = currencyRows((data.documents || []).filter((x) => x.document_type === 'invoice' && !['paid', 'cancelled'].includes(x.status)), (x) => x.amount_ttc);
    return {
      income: round(income), pending: round(pending), refunds: round(refunds), expenses: round(expenses),
      paidCommissions: round(paidCommissions), pendingCommissions: round(pendingCommissions),
      outstandingInvoices: round(outstandingInvoices), net: round(income - expenses - paidCommissions),
      paidOrders: (data.orders || []).filter((x) => x.payment_status === 'paid').length,
      totalOrders: (data.orders || []).length
    };
  }

  function makeMonthRows() {
    const rows = [];
    const now = new Date(); now.setDate(1);
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      rows.push({ key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, label: new Intl.DateTimeFormat('fr-FR', { month: 'short' }).format(d), income: 0, expense: 0 });
    }
    const map = new Map(rows.map((x) => [x.key, x]));
    transactions().filter((x) => x.status === 'succeeded' && (!x.currency || x.currency === 'EUR')).forEach((x) => {
      const d = new Date(x.created_at || ''); if (!Number.isNaN(d.getTime())) {
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; if (map.has(key)) map.get(key).income += num(x.amount);
      }
    });
    (data.expenses || []).filter((x) => x.status !== 'cancelled' && (!x.currency || x.currency === 'EUR')).forEach((x) => {
      const d = new Date(x.expense_date || x.created_at || ''); if (!Number.isNaN(d.getTime())) {
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; if (map.has(key)) map.get(key).expense += num(x.amount);
      }
    });
    (data.commissions || []).filter((x) => x.status === 'paid' && (!x.currency || x.currency === 'EUR')).forEach((x) => {
      const d = new Date(x.paid_at || x.updated_at || ''); if (!Number.isNaN(d.getTime())) {
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; if (map.has(key)) map.get(key).expense += num(x.commission_amount);
      }
    });
    return rows.map((x) => ({ ...x, income: round(x.income), expense: round(x.expense), net: round(x.income - x.expense) }));
  }

  function replaceBodyRows(tableOrBody, html, bodySelector = 'tbody') {
    const target = typeof tableOrBody === 'string' ? $(tableOrBody) : tableOrBody;
    if (!target) return;
    const body = target.matches('tbody') ? target : $(bodySelector, target);
    if (body) body.innerHTML = html;
  }

  function resetFictitiousValues() {
    // Immediately hide the hard-coded sample values in the original templates while real data loads.
    if (pageName === 'paiements' || pageName === 'commissions' || pageName === 'rapports') {
      $$('.mm-grid .mm-metric .value').forEach((el) => { el.textContent = '—'; });
      const body = pageName === 'paiements' ? $('#payments-table tbody') : pageName === 'commissions' ? $('table.mm-table tbody') : $('#report-table tbody');
      if (body) body.innerHTML = emptyRow(body.closest('table')?.querySelectorAll('thead th').length || 5, 'Chargement des données Supabase…');
    }
    if (pageName === 'finance') {
      $$('.grid.grid-cols-1.md\\:grid-cols-2.lg\\:grid-cols-4 p.text-3xl').forEach((el) => { el.textContent = '—'; });
      const recent = findSectionByHeading('Flux Financiers Récents');
      if (recent) replaceBodyRows(recent.querySelector('table'), emptyRow(5, 'Chargement des données Supabase…'));
      const docs = findSectionByHeading('Factures & Devis');
      if (docs) { const list = $('.space-y-4', docs); if (list) list.innerHTML = '<p class="text-sm text-on-surface-variant">Chargement…</p>'; }
    }
    if (pageName === 'facturation') {
      const table = findTableAfterHeading('Journal Global des Pièces & Transactions');
      if (table) replaceBodyRows(table, emptyRow(8, 'Chargement des documents Supabase…'));
    }
  }

  function findHeading(text) {
    return $$('h1,h2,h3,h4,p,span').find((el) => (el.textContent || '').trim().replace(/\s+/g, ' ').includes(text));
  }
  function findSectionByHeading(text) {
    const heading = findHeading(text);
    return heading?.closest('section, .glass-panel, .glass-panel-elevated, .mm-card') || heading?.parentElement?.parentElement || null;
  }
  function findTableAfterHeading(text) {
    const heading = findHeading(text);
    if (!heading) return null;
    let node = heading;
    for (let i = 0; node && i < 8; i++, node = node.parentElement) {
      const table = $('table', node);
      if (table) return table;
    }
    return null;
  }
  function setCardByHeading(label, value, note) {
    const heading = findHeading(label);
    const card = heading?.closest('article, .mm-metric, .relative.overflow-hidden, .glass-panel, .glass-panel-elevated');
    if (!card) return;
    const valueNode = $('.value', card) || $('p.text-white.tracking-tight.text-2xl', card) || $('p.text-3xl.font-bold', card) || $('p.text-2xl.font-bold', card);
    if (valueNode) valueNode.textContent = value;
    const noteNode = $('.note', card) || $('.text-xs.text-on-surface-variant.mt-2', card) || $('.text-xs.text-primary.mt-2', card) || $('.text-xs.text-on-surface-variant.mt-1', card);
    if (noteNode && note != null) noteNode.textContent = note;
  }

  function renderPaymentsPage() {
    const t = totals();
    const metrics = $$('.mm-grid .mm-metric');
    const vals = [money(t.income), money(t.pending), money(t.refunds), String(t.paidOrders)];
    const notes = ['Paiements réussis et commandes payées.', 'Commandes et paiements non confirmés.', 'Transactions au statut remboursé.', `${t.paidOrders} commande(s) payée(s) sur ${t.totalOrders}.`];
    metrics.forEach((card, i) => {
      const value = $('.value', card), note = $('.note', card);
      if (value) value.textContent = vals[i] || '—';
      if (note) note.textContent = notes[i] || '';
    });
    const tbody = $('#payments-table tbody');
    if (tbody) {
      const q = paymentSearch.toLocaleLowerCase('fr').trim();
      const list = transactions().filter((x) => {
        const matchesQ = !q || [x.reference, x.client, x.email, x.description, x.method].join(' ').toLocaleLowerCase('fr').includes(q);
        return matchesQ && (paymentFilter === 'all' || x.status === paymentFilter);
      });
      tbody.innerHTML = list.length ? list.map((x) => `<tr>
        <td><span style="font-family:monospace;overflow-wrap:anywhere">${esc(x.reference)}</span></td>
        <td>${esc(x.client)}<small class="fa-cell-sub">${esc(x.email)}</small></td>
        <td>${esc(x.description)}</td><td>${esc(shortDate(x.created_at))}</td><td>${esc(money(x.amount, x.currency))}</td><td>${esc(x.method)}</td>
        <td>${statusBadge(x.status)}</td><td><button type="button" class="mm-btn secondary" data-finance-action="payment-detail" data-id="${esc(x.id)}">Voir</button></td></tr>`).join('') : emptyRow(8, 'Aucun paiement ou statut de commande correspondant.');
    }
    const msg = findHeading('Rapprochement bancaire');
    const bankCard = msg?.closest('section');
    if (bankCard) {
      const p = $('.mm-subtitle', bankCard);
      if (p) p.textContent = 'Aucune banque externe n’est connectée. Cet écran affiche les données Supabase disponibles, sans simuler de synchronisation bancaire.';
      const bar = $('.mm-bar', bankCard); if (bar) bar.style.display = 'none';
      const row = $('.flex.justify-between.text-xs', bankCard); if (row) row.innerHTML = '<span class="mm-muted">Connecteur bancaire</span><strong>Non configuré</strong>';
      const button = $('button', bankCard); if (button) { button.disabled = true; button.classList.add('fa-disabled-action'); button.textContent = 'Aucune banque connectée'; button.removeAttribute('data-demo-action'); }
    }
    const titleDescription = findHeading('Historique de démonstration des acomptes, soldes et règlements.');
    if (titleDescription) titleDescription.textContent = 'Historique provenant des tables payments et orders. Les statuts Stripe ne sont pas modifiés depuis cette page.';
  }

  function renderCommissionsPage() {
    const t = totals();
    const metrics = $$('.mm-grid .mm-metric');
    const uniqueProviders = new Set((data.commissions || []).map((x) => String(x.provider_name || '').trim()).filter(Boolean)).size;
    const vals = [money(t.pendingCommissions), String(uniqueProviders), money(t.paidCommissions), `${num(setting('default_commission_rate', 7.5)).toLocaleString('fr-FR')} %`];
    const notes = ['Somme des commissions en attente.', 'Prestataires présents dans le registre réel.', 'Commissions marquées réglées avec référence.', 'Taux appliqué aux prochaines commissions.'];
    metrics.forEach((card, i) => { const v = $('.value', card), n = $('.note', card); if (v) v.textContent = vals[i] || '—'; if (n) n.textContent = notes[i] || ''; });
    const settingsForm = $('#commission-settings-form');
    if (settingsForm) { const rate = $('input[name="default_commission_rate"]', settingsForm); const trigger = $('select[name="payout_trigger"]', settingsForm); const internalNotes = $('textarea[name="internal_notes"]', settingsForm); if (rate) rate.value = String(num(setting('default_commission_rate', 7.5))); if (trigger) trigger.value = String(setting('payout_trigger', 'after_client_payment')); if (internalNotes) internalNotes.value = String(setting('internal_notes', '')); }
    const body = $('#commissions-table tbody');
    if (body) {
      const list = data.commissions || [];
      body.innerHTML = list.length ? list.map((x) => `<tr>
        <td><strong>${esc(x.provider_name)}</strong><small class="fa-cell-sub">${esc(x.provider_email || '')}</small></td>
        <td>${esc(x.description || '—')}</td><td>${esc(money(x.base_amount, x.currency))}</td>
        <td><strong>${esc(money(x.commission_amount, x.currency))}</strong><small class="fa-cell-sub">Taux ${esc(num(x.commission_rate).toLocaleString('fr-FR'))} %</small></td>
        <td>${statusBadge(x.status)}<small class="fa-cell-sub">${esc(x.payment_reference || '')}</small></td>
        <td><div class="fa-actions">${x.status === 'pending' ? `<button type="button" class="mm-btn" data-finance-action="commission-pay" data-id="${esc(x.id)}">Marquer réglée</button><button type="button" class="mm-btn secondary" data-finance-action="commission-cancel" data-id="${esc(x.id)}">Annuler</button>` : ''}</div></td></tr>`).join('') : emptyRow(6, 'Aucune commission enregistrée. Ajoute la première commission via le formulaire ci-dessus.');
    }
    const demoText = findHeading('Montants fictifs pour illustrer le suivi des règlements.');
    if (demoText) demoText.textContent = 'Registre issu de Supabase ; les actions de règlement enregistrent une référence mais ne font pas de virement bancaire.';
    const payButton = findHeading('Commissions prestataires')?.closest('.mm-card')?.querySelector('.mm-card-head button');
    if (payButton) { payButton.textContent = 'Voir le registre'; payButton.removeAttribute('data-demo-action'); payButton.addEventListener('click', () => $('#commissions-table')?.scrollIntoView({ behavior: 'smooth' }), { once: true }); }
  }

  function documentStatusFilter(status) {
    if (status === 'paid') return 'paye';
    if (['cancelled', 'rejected'].includes(status)) return 'annule';
    return 'attente';
  }

  function renderFacturationPage() {
    const t = totals();
    setCardByHeading('Revenus du mois', money(t.income), 'Encaissements réussis depuis Supabase');
    setCardByHeading('Impayés / En attente', money(t.outstandingInvoices + t.pending), `${money(t.pending)} de paiements en attente`);
    const quotes = (data.documents || []).filter((x) => x.document_type === 'quote' && ['draft', 'sent', 'accepted'].includes(x.status));
    const qValue = findHeading('Devis en cours');
    const qCard = qValue?.closest('.relative.overflow-hidden');
    if (qCard) { const v = $('p.text-white.tracking-tight.text-2xl', qCard); if (v) v.innerHTML = `${quotes.length} <span class="text-sm font-medium text-on-surface">dossiers</span>`; const n = $('p.text-[#0bda57].text-xs.font-semibold.leading-normal', qCard); if (n) n.textContent = `Valeur : ${money(quotes.reduce((s,x)=>s+num(x.amount_ttc),0))}`; }
    setCardByHeading('Commissions prestataires', money(t.pendingCommissions), `${(data.commissions || []).filter((x) => x.status === 'pending').length} commission(s) en attente`);

    const table = findTableAfterHeading('Journal Global des Pièces & Transactions');
    const tbody = table?.querySelector('tbody');
    if (tbody) {
      const docs = [...(data.documents || [])].filter((x) => { const q = documentSearch.toLocaleLowerCase('fr').trim(); return !q || [x.document_number,x.client_name,x.client_email,x.description].join(' ').toLocaleLowerCase('fr').includes(q); }).sort((a,b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
      tbody.innerHTML = docs.length ? docs.map((x) => {
        const commission = (data.commissions || []).find((c) => String(c.document_id || '') === String(x.id));
        const initials = String(x.client_name || 'MM').trim().split(/\s+/).slice(0, 2).map((p) => p[0] || '').join('').toUpperCase();
        const typeLabel = x.document_type === 'quote' ? 'Devis' : 'Facture';
        const badge = statusBadge(x.status);
        return `<tr class="hover:bg-surface-container-high/40 transition-colors group" data-status="${documentStatusFilter(x.status)}">
          <td class="py-3.5 px-4"><div class="flex items-center gap-2"><span class="material-symbols-outlined text-primary text-[18px]">${x.document_type === 'quote' ? 'request_quote' : 'receipt_long'}</span><span class="font-mono font-semibold text-white">${esc(x.document_number)}</span></div><small class="fa-cell-sub">${typeLabel}</small></td>
          <td class="py-3.5 px-4"><div class="flex items-center gap-2.5"><div class="size-7 rounded-lg bg-surface-container-highest flex items-center justify-center font-bold text-xs text-secondary">${esc(initials)}</div><div><p class="font-medium text-white leading-tight">${esc(x.client_name)}</p><p class="text-xs text-secondary">${esc(x.description)}</p></div></div></td>
          <td class="py-3.5 px-4 text-xs font-mono text-secondary">${esc(shortDate(x.created_at))}</td><td class="py-3.5 px-4 text-right font-medium text-white">${esc(money(x.amount_ht, x.currency))}</td><td class="py-3.5 px-4 text-right font-bold text-white">${esc(money(x.amount_ttc, x.currency))}</td>
          <td class="py-3.5 px-4 text-center">${badge}</td><td class="py-3.5 px-4 text-center">${commission ? esc(money(commission.commission_amount, commission.currency)) : '—'}</td>
          <td class="py-3.5 px-4 text-right"><div class="fa-actions">${x.document_type === 'quote' && !['converted','cancelled','rejected'].includes(x.status) ? `<button class="mm-btn secondary" type="button" data-finance-action="convert-quote" data-id="${esc(x.id)}">Convertir</button>` : ''}<button class="mm-btn secondary" type="button" data-finance-action="print-document" data-id="${esc(x.id)}">Imprimer</button>${x.status === 'draft' ? `<button class="mm-btn secondary" type="button" data-finance-action="document-sent" data-id="${esc(x.id)}">Marquer envoyé</button>` : ''}${x.document_type === 'invoice' && !['paid','cancelled'].includes(x.status) ? `<button class="mm-btn secondary" type="button" data-finance-action="document-paid" data-id="${esc(x.id)}">Marquer payé</button>` : ''}${!['paid','cancelled','converted','rejected'].includes(x.status) ? `<button class="mm-btn secondary" type="button" data-finance-action="document-cancel" data-id="${esc(x.id)}">Annuler</button>` : ''}</div></td></tr>`;
      }).join('') : emptyRow(8, 'Aucun devis ni aucune facture enregistrés dans Supabase.');
    }
    const countText = findHeading('Consultez l’historique complet des devis, factures d’acompte et soldes clients.');
    if (countText) countText.textContent = `${(data.documents || []).length} document(s) dans Supabase. Les paiements Stripe restent en lecture seule.`;
    const countFooter = $('#financial-documents-count'); if (countFooter) countFooter.textContent = `${(data.documents || []).length} document(s) enregistré(s) · ${docs.length} affiché(s) après filtre.`;
    renderBillingCommissionCards();
    renderBillingHealth();
  }

  function renderBillingCommissionCards() {
    const heading = findHeading('Commissions Prestataires en Attente de Versement');
    if (!heading) return;
    let list = heading.parentElement;
    for (let i = 0; i < 5 && list && !list.classList.contains('space-y-3'); i++) list = list.parentElement;
    if (!list) return;
    const pending = (data.commissions || []).filter((x) => x.status === 'pending');
    list.innerHTML = pending.length ? pending.map((x) => {
      const initials = String(x.provider_name || 'MM').trim().split(/\s+/).slice(0,2).map((p)=>p[0]||'').join('').toUpperCase();
      return `<div class="flex items-center justify-between p-3 rounded-xl bg-surface-container-highest/60 border border-outline-variant/40"><div class="flex items-center gap-3"><div class="size-8 rounded-full bg-tertiary-container text-tertiary flex items-center justify-center font-bold text-xs">${esc(initials)}</div><div><p class="text-sm font-semibold text-white">${esc(x.provider_name)}</p><p class="text-xs text-secondary">${esc(x.description)}</p></div></div><div class="flex items-center gap-4"><div class="text-right"><p class="text-sm font-bold text-white">${esc(money(x.commission_amount, x.currency))}</p><p class="text-[11px] text-tertiary">Taux ${esc(num(x.commission_rate).toLocaleString('fr-FR'))} %</p></div><button type="button" class="px-3 py-1.5 rounded-lg bg-tertiary/20 hover:bg-tertiary text-tertiary text-xs font-semibold" data-finance-action="commission-pay" data-id="${esc(x.id)}">Marquer réglée</button></div></div>`;
    }).join('') : '<p class="text-xs text-secondary">Aucune commission en attente.</p>';
  }

  function renderBillingHealth() {
    const heading = findHeading('Santé du Bilan Actuel');
    const card = heading?.closest('.rounded-2xl.border');
    if (!card) return;
    const invoices = (data.documents || []).filter((x) => x.document_type === 'invoice' && x.status !== 'cancelled');
    const paidInvoices = invoices.filter((x) => x.status === 'paid').length;
    const collection = invoices.length ? Math.round(paidInvoices / invoices.length * 100) : 0;
    const pendingPayments = transactions().filter((x) => x.status === 'pending').length;
    const waitingPct = transactions().length ? Math.round(pendingPayments / transactions().length * 100) : 0;
    const allCommissions = (data.commissions || []).filter((x) => x.status !== 'cancelled');
    const paidCommissions = allCommissions.filter((x) => x.status === 'paid').length;
    const retention = allCommissions.length ? Math.round(paidCommissions / allCommissions.length * 100) : 0;
    const rows = $$('.space-y-3\.5 > div', card);
    const values = [collection, waitingPct, retention];
    const labels = [`Factures payées (${paidInvoices}/${invoices.length})`, `Paiements en attente (${pendingPayments})`, `Commissions réglées (${paidCommissions}/${allCommissions.length})`];
    rows.forEach((row, index) => {
      const span = $('.flex.justify-between.text-xs.mb-1 span:first-child', row);
      const value = $('.flex.justify-between.text-xs.mb-1 span:last-child', row);
      const bar = $('.w-full.h-2 > div', row);
      if (span) span.textContent = labels[index] || '—';
      if (value) value.textContent = `${values[index] || 0}%`;
      if (bar) bar.style.width = `${values[index] || 0}%`;
    });
    const syncHeading = findHeading('Synchronisation Bancaire');
    if (syncHeading) {
      const detail = syncHeading.parentElement?.querySelector('p.text-secondary');
      if (detail) detail.textContent = 'Aucun connecteur bancaire externe configuré.';
    }
    const ratioText = findHeading('Calcul automatique basé sur 7.5% des encaissements effectifs');
    if (ratioText) ratioText.textContent = 'Commissions en attente enregistrées dans le registre financier.';
  }

  function renderFinancePage() {
    const t = totals();
    const metrics = [
      ['Revenus Total (Entrées)', money(t.income), 'Encaissements confirmés depuis Supabase.'],
      ['Dépenses (Sorties)', money(t.expenses + t.paidCommissions), 'Dépenses enregistrées et commissions réglées.'],
      ['Solde Net', money(t.net), 'Encaissements moins sorties enregistrées.']
    ];
    metrics.forEach(([headingText, value, note]) => {
      const heading = findHeading(headingText); const card = heading?.closest('.glass-panel');
      if (!card) return;
      const valueNode = $('p.text-3xl.font-bold.font-headline', card); if (valueNode) valueNode.textContent = value;
      const notes = $$('p', card).filter((el) => el !== valueNode); if (notes[0]) notes[0].textContent = note;
    });
    const bankHeading = findHeading('Rapprochement Bancaire');
    const bankCard = bankHeading?.closest('.glass-panel');
    if (bankCard) {
      const bar = $('.w-full.bg-surface-dim', bankCard); if (bar) bar.style.display = 'none';
      const textRows = $$('.flex.justify-between.text-xs', bankCard);
      if (textRows[0]) textRows[0].innerHTML = '<span class="text-on-surface-variant">Connecteur bancaire</span><span class="text-on-surface">Non configuré</span>';
    }
    const bankSyncText = findHeading('Dernière synchronisation : Aujourd’hui, 08:30');
    if (bankSyncText) bankSyncText.textContent = 'Aucune connexion bancaire configurée.';
    const syncButton = bankHeading?.closest('.glass-panel')?.querySelector('[data-demo-action]');
    if (syncButton) { syncButton.removeAttribute('data-demo-action'); syncButton.disabled = true; syncButton.classList.add('fa-disabled-action'); syncButton.textContent = 'Non configuré'; }

    const recentSection = findSectionByHeading('Flux Financiers Récents');
    const recentBody = recentSection?.querySelector('table tbody');
    if (recentBody) {
      const rows = [];
      transactions().forEach((x) => rows.push({ date: x.created_at, who: x.client, category: 'Paiement', amount: num(x.amount) * (x.status === 'refunded' ? -1 : 1), currency: x.currency, status: x.status }));
      (data.expenses || []).filter((x) => x.status !== 'cancelled').forEach((x) => rows.push({ date: x.expense_date || x.created_at, who: x.vendor_name, category: x.category, amount: -num(x.amount), currency: x.currency, status: 'recorded' }));
      (data.commissions || []).filter((x) => x.status === 'paid').forEach((x) => rows.push({ date: x.paid_at, who: x.provider_name, category: 'Commission réglée', amount: -num(x.commission_amount), currency: x.currency, status: 'paid' }));
      rows.sort((a,b) => new Date(b.date || 0) - new Date(a.date || 0));
      recentBody.innerHTML = rows.length ? rows.slice(0, 10).map((x) => `<tr class="hover:bg-surface-variant/20 transition-colors"><td class="p-4 text-on-surface-variant">${esc(shortDate(x.date))}</td><td class="p-4 font-medium">${esc(x.who || '—')}</td><td class="p-4"><span class="px-2 py-1 rounded-md text-[10px] bg-primary/10 text-primary border border-primary/20">${esc(x.category)}</span></td><td class="p-4 text-right font-semibold ${x.amount < 0 ? 'fa-negative' : x.status === 'succeeded' ? 'fa-positive' : 'text-on-surface'}">${x.amount > 0 ? '+' : ''}${esc(money(x.amount, x.currency))}</td><td class="p-4 text-center">${statusBadge(x.status)}</td></tr>`).join('') : emptyRow(5, 'Aucun mouvement financier réel enregistré.');
    }
    const invoiceSection = findSectionByHeading('Factures & Devis');
    const invoiceList = invoiceSection?.querySelector('.space-y-4');
    if (invoiceList) {
      const docs = (data.documents || []).slice().sort((a,b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)).slice(0, 5);
      invoiceList.innerHTML = docs.length ? docs.map((x) => `<div class="flex items-center justify-between p-3 rounded-lg border border-outline-variant/20 hover:bg-surface-variant/30 transition-colors"><div class="flex items-center gap-3"><div class="w-10 h-10 rounded-full bg-surface-dim border border-outline-variant/30 flex items-center justify-center"><span class="material-symbols-outlined text-tertiary text-sm">description</span></div><div><p class="text-sm font-medium">${esc(x.document_number)}</p><p class="text-xs text-on-surface-variant">${esc(x.client_name)} · ${esc(x.document_type === 'quote' ? 'Devis' : 'Facture')} · ${esc(money(x.amount_ttc, x.currency))}</p></div></div><button type="button" class="text-on-surface-variant hover:text-primary" data-finance-action="print-document" data-id="${esc(x.id)}" aria-label="Imprimer ${esc(x.document_number)}"><span class="material-symbols-outlined">print</span></button></div>`).join('') : '<p class="text-sm text-on-surface-variant">Aucun devis ou facture enregistré.</p>';
    }
    const expenseRows = $('#finance-recent-expenses');
    if (expenseRows) {
      const expenses = (data.expenses || []).filter((x) => x.status !== 'cancelled').slice().sort((a,b)=>new Date(b.expense_date||b.created_at||0)-new Date(a.expense_date||a.created_at||0)).slice(0, 5);
      expenseRows.innerHTML = expenses.length ? expenses.map((x)=>`<div class="flex items-center justify-between gap-3 py-2 border-b border-outline-variant/20"><div><p class="text-sm font-medium">${esc(x.vendor_name)}</p><p class="text-xs text-on-surface-variant">${esc(x.category)} · ${esc(shortDate(x.expense_date))}</p></div><strong class="text-sm text-error">-${esc(money(x.amount,x.currency))}</strong></div>`).join('') : '<p class="text-xs text-on-surface-variant">Aucune dépense enregistrée.</p>';
    }
    renderFinanceChart();
  }

  function renderFinanceChart() {
    const chartTitle = findHeading('Évolution des Revenus vs Dépenses');
    const card = chartTitle?.closest('.glass-panel-elevated');
    if (!card) return;
    const chart = $('.flex-1.flex.items-end.gap-4', card);
    const labels = $('.flex.justify-between.px-2.text-\[10px\]', card);
    if (!chart) return;
    const months = makeMonthRows();
    const max = Math.max(1, ...months.flatMap((m) => [m.income, m.expense]));
    chart.innerHTML = months.map((m) => `<div class="flex-1 flex items-end gap-1 h-full" title="${esc(m.label)} · Encaissements ${esc(money(m.income))} · Sorties ${esc(money(m.expense))}"><div class="flex-1 bg-primary/40 rounded-t-lg" style="height:${Math.max(2,m.income/max*100)}%"></div><div class="flex-1 bg-error/40 rounded-t-lg" style="height:${Math.max(2,m.expense/max*100)}%"></div></div>`).join('');
    if (labels) labels.innerHTML = months.map((m)=>`<span>${esc(m.label)}</span>`).join('');
    const costHeading = findHeading('Répartition des Coûts');
    const costCard = costHeading?.closest('.glass-panel-elevated');
    if (costCard) {
      const total = (data.expenses || []).filter((x)=>x.status!=='cancelled').reduce((s,x)=>s+num(x.amount),0) + totals().paidCommissions;
      const center = $('p.text-2xl.font-bold', costCard); if (center) center.textContent = money(total);
      const categoryRows = new Map();
      (data.expenses || []).filter((x)=>x.status!=='cancelled').forEach((x)=>categoryRows.set(x.category || 'Autre',(categoryRows.get(x.category||'Autre')||0)+num(x.amount)));
      const paid = totals().paidCommissions; if (paid) categoryRows.set('Prestataires',(categoryRows.get('Prestataires')||0)+paid);
      const list = $('.mt-6.space-y-3', costCard);
      if (list) {
        const top = [...categoryRows.entries()].sort((a,b)=>b[1]-a[1]).slice(0,4);
        list.innerHTML = top.length ? top.map(([name,amount],i)=>`<div class="flex justify-between items-center text-xs"><div class="flex items-center gap-2"><span class="w-2 h-2 rounded-full ${['bg-primary','bg-secondary','bg-tertiary','bg-outline'][i]}"></span>${esc(name)}</div><span class="font-medium">${total ? Math.round(amount/total*100) : 0}%</span></div>`).join('') : '<p class="text-xs text-on-surface-variant">Aucune dépense enregistrée.</p>';
      }
    }
  }

  function renderReportsPage() {
    const t = totals();
    const metrics = $$('.mm-grid .mm-metric');
    const vals = [money(t.income), String(t.paidOrders), money(t.pending), money(t.net)];
    const notes = ['Total des paiements confirmés depuis Supabase.', `Commandes payées sur ${t.totalOrders} commande(s).`, 'Paiements et commandes en attente.', 'Encaissements moins dépenses et commissions réglées.'];
    metrics.forEach((card,i)=>{const value=$('.value',card),note=$('.note',card); if(value)value.textContent=vals[i]||'—';if(note)note.textContent=notes[i]||'';});
    const chartHead = findHeading('Évolution mensuelle des revenus');
    const chartSection = chartHead?.closest('section');
    if (chartSection) {
      const note = $('.mm-muted', chartSection); if (note) note.textContent = 'Données calculées sur les six derniers mois complets et en cours. Les mois sans mouvement affichent zéro.';
      const container = $('#reports-month-chart', chartSection) || $('.mm-bar-row', chartSection)?.parentElement;
      const months = makeMonthRows();
      const max = Math.max(1, ...months.map((m)=>m.income));
      if (container) container.innerHTML = months.map((m)=>`<div class="mm-bar-row"><span>${esc(m.label)}</span><div class="mm-bar"><span style="width:${Math.max(0.5,m.income/max*100)}%" title="${esc(money(m.income))}"></span></div><strong style="text-align:right">${esc(money(m.income))}</strong></div>`).join('');
    }
    const distributionHeading = findHeading('Répartition des dossiers');
    const distributionSection = distributionHeading?.closest('section');
    if (distributionSection) {
      const list = $('.mm-list', distributionSection);
      const quotesSent = (data.documents || []).filter((x)=>x.document_type==='quote' && ['sent','accepted'].includes(x.status)).length;
      const pendingPaymentCount = transactions().filter((x)=>x.status==='pending').length;
      if(list) list.innerHTML = [
        ['Commandes payées',t.paidOrders],['Devis envoyés',quotesSent],['Commandes totales',t.totalOrders],['Paiements en attente',pendingPaymentCount]
      ].map(([label,value])=>`<div class="mm-list-item"><div><strong>${esc(label)}</strong><small>Calculé depuis les données disponibles</small></div><strong>${esc(value)}</strong></div>`).join('');
      const note = $('.mm-muted', distributionSection); if (note) note.textContent = 'Synthèse des commandes, devis et paiements chargés depuis Supabase.';
    }
    const table = $('#report-table tbody');
    if (table) {
      const months = makeMonthRows();
      table.innerHTML = months.map((m)=>`<tr><td>${esc(m.label)} ${esc(m.key.slice(0,4))}</td><td>${esc(money(m.income))}</td><td>${esc(money(m.expense))}</td><td>${esc(money(m.net))}</td></tr>`).join('');
      const head = $('#report-table thead th:nth-child(2)'); if(head)head.textContent='Valeur réelle';
      const head3 = $('#report-table thead th:nth-child(3)'); if(head3)head3.textContent='Commentaire';
    }
    const disclaimer = findHeading('Données fictives de démonstration — à connecter à la base de données avant utilisation réelle.');
    if (disclaimer) disclaimer.textContent = 'Données issues de Supabase. Les prévisions et le rapprochement bancaire ne sont pas simulés.';
  }

  function renderAll() {
    if (pageName === 'finance') renderFinancePage();
    else if (pageName === 'paiements') renderPaymentsPage();
    else if (pageName === 'facturation') { renderFacturationPage(); applyDocumentFilter(documentFilter); }
    else if (pageName === 'commissions') renderCommissionsPage();
    else if (pageName === 'rapports') renderReportsPage();
  }

  function applyDocumentFilter(filter) {
    documentFilter = filter || 'all';
    const table = findTableAfterHeading('Journal Global des Pièces & Transactions');
    const rows = table ? $$('tbody tr[data-status]', table) : [];
    rows.forEach((row) => { row.hidden = documentFilter !== 'all' && row.dataset.status !== documentFilter; });
  }

  function updateKpisAsLoading() {
    // Remove sample financial values before any network request is made.
    if (['paiements','commissions','rapports'].includes(pageName)) $$('.mm-grid .mm-metric .value').forEach((el)=>{el.textContent='—';});
    if (pageName === 'finance') {
      const heading = findHeading('Revenus Total (Entrées)'); const card = heading?.closest('.glass-panel'); const value = card && $('p.text-3xl.font-bold.font-headline',card); if(value)value.textContent='—';
      const heading2 = findHeading('Dépenses (Sorties)'); const card2 = heading2?.closest('.glass-panel'); const value2 = card2 && $('p.text-3xl.font-bold.font-headline',card2); if(value2)value2.textContent='—';
      const heading3 = findHeading('Solde Net'); const card3 = heading3?.closest('.glass-panel'); const value3 = card3 && $('p.text-3xl.font-bold.font-headline',card3); if(value3)value3.textContent='—';
    }
  }

  function renderNoDataError(error) {
    setNotice(`Impossible de charger les données financières : ${error.message || error}`, 'error');
    // Do not leave any of the demo values visible when the API cannot load.
    if (pageName === 'paiements' || pageName === 'commissions' || pageName === 'rapports') {
      $$('.mm-grid .mm-metric .value').forEach((el)=>{el.textContent='—';});
      const table = pageName === 'paiements' ? $('#payments-table') : pageName === 'rapports' ? $('#report-table') : findSectionByHeading('Commissions prestataires')?.querySelector('table');
      if (table) replaceBodyRows(table, emptyRow(table.querySelectorAll('thead th').length || 4, 'Données indisponibles. Consulte les détails du message ci-dessus.'));
    }
    if (pageName === 'finance') {
      ['Revenus Total (Entrées)','Dépenses (Sorties)','Solde Net'].forEach((name)=>{const h=findHeading(name);const card=h?.closest('.glass-panel');const v=card&&$('p.text-3xl.font-bold.font-headline',card);if(v)v.textContent='—';});
    }
  }

  function downloadCsv(fileName, rows) {
    const csv = '\ufeff' + rows.map((row)=>row.map((v)=>`"${String(v ?? '').replace(/"/g,'""').replace(/\s+/g,' ').trim()}"`).join(';')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = fileName; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  }
  function exportPayments() {
    downloadCsv('paiements-mariage-madagascar.csv', [['Référence','Client','E-mail','Commande','Date','Montant','Devise','Moyen','Statut'], ...transactions().map((x)=>[x.reference,x.client,x.email,x.description,x.created_at,x.amount,x.currency,x.method,statusLabel(x.status)])]);
  }
  function exportDocuments() {
    downloadCsv('devis-factures-mariage-madagascar.csv', [['Numéro','Type','Client','E-mail','Description','Date','Échéance','HT','TVA %','TVA','TTC','Devise','Statut'], ...(data.documents || []).map((x)=>[x.document_number,x.document_type,x.client_name,x.client_email,x.description,x.created_at,x.due_date,x.amount_ht,x.tax_rate,x.tax_amount,x.amount_ttc,x.currency,statusLabel(x.status)])]);
  }
  function exportCommissions() {
    downloadCsv('commissions-mariage-madagascar.csv', [['Prestataire','E-mail','Description','Base','Taux','Commission','Devise','Statut','Référence','Date de règlement'], ...(data.commissions || []).map((x)=>[x.provider_name,x.provider_email,x.description,x.base_amount,x.commission_rate,x.commission_amount,x.currency,statusLabel(x.status),x.payment_reference,x.paid_at])]);
  }
  function exportReports() {
    downloadCsv('rapports-financiers-mariage-madagascar.csv', [['Mois','Encaissements','Sorties','Solde'], ...makeMonthRows().map((m)=>[m.key,m.income,m.expense,m.net])]);
  }

  function printDocument(id) {
    const doc = (data.documents || []).find((x)=>String(x.id) === String(id));
    if (!doc) return toast('Document introuvable.', true);
    const win = window.open('', '_blank', 'width=900,height=750');
    if (!win) return toast('Autorise les fenêtres contextuelles pour imprimer le document.', true);
    win.document.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${esc(doc.document_number)}</title><style>body{font:16px Arial,sans-serif;color:#222;max-width:850px;margin:40px auto;padding:20px}h1{font-size:28px}table{width:100%;border-collapse:collapse;margin-top:30px}td,th{border-bottom:1px solid #ddd;padding:12px;text-align:left}.right{text-align:right}.muted{color:#666}.total{font-size:20px;font-weight:bold}</style></head><body><h1>Mariage Madagascar</h1><p class="muted">${doc.document_type==='quote'?'DEVIS':'FACTURE'}</p><h2>${esc(doc.document_number)}</h2><p>Client : <strong>${esc(doc.client_name)}</strong><br>${esc(doc.client_email || '')}</p><p>${esc(doc.description)}</p><p>Date : ${esc(date(doc.created_at))}<br>Échéance : ${esc(date(doc.due_date))}<br>Statut : ${esc(statusLabel(doc.status))}</p><table><tr><th>Montant HT</th><th>TVA (${esc(doc.tax_rate)} %)</th><th class="right">Montant TTC</th></tr><tr><td>${esc(money(doc.amount_ht,doc.currency))}</td><td>${esc(money(doc.tax_amount,doc.currency))}</td><td class="right total">${esc(money(doc.amount_ttc,doc.currency))}</td></tr></table><p class="muted">Document émis depuis l’administration Mariage Madagascar. L’impression n’enregistre ni n’encaisse de paiement.</p><script>window.onload=()=>window.print()<\/script></body></html>`);
    win.document.close();
  }

  function paymentDetail(id) {
    const item = transactions().find((x)=>String(x.id) === String(id));
    if (!item) return toast('Paiement introuvable.', true);
    window.alert([`Référence : ${item.reference}`, `Client : ${item.client}`, `E-mail : ${item.email || '—'}`, `Commande : ${item.description}`, `Date : ${date(item.created_at)}`, `Montant : ${money(item.amount,item.currency)}`, `Moyen : ${item.method}`, `Statut : ${statusLabel(item.status)}`, `Identifiant Stripe : ${item.stripe_id || '—'}`].join('\n'));
  }

  function updateDocumentFormType(type) {
    financeDocumentType = type === 'facture' ? 'invoice' : type === 'commission' ? 'commission' : 'quote';
    const label = $('#btn-submit-label');
    if (label) label.textContent = financeDocumentType === 'invoice' ? 'Émettre Facture' : financeDocumentType === 'commission' ? 'Enregistrer Commission' : 'Créer Devis';
    const active = { devis: $('#btn-toggle-devis'), facture: $('#btn-toggle-facture'), commission: $('#btn-toggle-comm') };
    Object.entries(active).forEach(([key, btn]) => {
      if (!btn) return;
      const isActive = key === type;
      btn.classList.toggle('bg-primary', isActive && key !== 'commission');
      btn.classList.toggle('text-on-primary', isActive && key !== 'commission');
      btn.classList.toggle('bg-tertiary', isActive && key === 'commission');
      btn.classList.toggle('text-on-tertiary', isActive && key === 'commission');
    });
  }

  function dueDateFromTerms(value) {
    if (!value || value === 'immediate') return new Date().toISOString().slice(0,10);
    const days = value === '45' ? 45 : value === 'custom' ? 15 : 30;
    const d = new Date(); d.setDate(d.getDate() + days); return d.toISOString().slice(0,10);
  }

  async function createQuickDocument() {
    if (busy) return;
    const clientName = ($('#doc-client-name')?.value || '').trim();
    const description = ($('#doc-description')?.value || '').trim();
    const amount = Number($('#doc-amount-ht')?.value);
    const rate = Number($('#doc-tax-rate')?.value || 0);
    if (!clientName || !description || !Number.isFinite(amount) || amount < 0) {
      return toast('Renseigne le nom du client, la description et un montant HT valide.', true);
    }
    const btn = $('#create-financial-document');
    busy = true;
    const previous = btn?.textContent;
    if (btn) { btn.disabled = true; btn.textContent = 'Enregistrement…'; }
    try {
      if (financeDocumentType === 'commission') {
        const defaultRate = num(setting('default_commission_rate', 7.5));
        await api('commission.create', { provider_name: clientName, description, base_amount: amount, commission_rate: defaultRate });
        toast('Commission enregistrée dans Supabase. Aucun virement n’a été exécuté.');
      } else {
        const dueTerms = $('#doc-due-terms')?.value || '30';
        await api('document.create', {
          document_type: financeDocumentType,
          client_name: clientName,
          description,
          amount_ht: amount,
          tax_rate: rate,
          due_date: dueDateFromTerms(dueTerms),
          notes: ''
        });
        toast(financeDocumentType === 'invoice' ? 'Facture enregistrée dans Supabase.' : 'Devis enregistré dans Supabase.');
      }
      const form = $('#quick-action-panel');
      if (form) {
        const client = $('#doc-client-name'); const desc = $('#doc-description'); const amountField = $('#doc-amount-ht');
        if (client) client.value = ''; if (desc) desc.value = ''; if (amountField) amountField.value = '';
      }
      await refresh();
    } catch (error) { toast(error.message || String(error), true); }
    finally { busy = false; if (btn) { btn.disabled = false; btn.textContent = previous || 'Créer document'; } }
  }

  async function submitFinanceForm(form) {
    if (busy) return;
    const kind = form.dataset.financeForm;
    const values = Object.fromEntries(new FormData(form).entries());
    const submit = $('button[type="submit"]', form);
    const original = submit?.textContent;
    busy = true;
    if (submit) { submit.disabled = true; submit.textContent = 'Enregistrement…'; }
    try {
      if (kind === 'expense') {
        await api('expense.create', values);
        toast('Dépense enregistrée dans Supabase.');
      } else if (kind === 'commission') {
        await api('commission.create', { ...values, base_amount: Number(values.base_amount), commission_rate: Number(values.commission_rate) });
        toast('Commission enregistrée dans Supabase.');
      } else if (kind === 'settings') {
        await api('settings.update', { settings: {
          default_commission_rate: Number(values.default_commission_rate),
          payout_trigger: values.payout_trigger,
          internal_notes: values.internal_notes || ''
        }});
        toast('Préférences enregistrées dans Supabase.');
      }
      form.reset();
      if (kind === 'settings') {
        const rateInput = $('input[name="default_commission_rate"]', form);
        if (rateInput) rateInput.value = num(setting('default_commission_rate',7.5));
      }
      await refresh();
    } catch (error) { toast(error.message || String(error), true); }
    finally { busy = false; if (submit) { submit.disabled = false; submit.textContent = original || 'Enregistrer'; } }
  }

  async function handleAction(action, id) {
    try {
      if (action === 'refresh') return await refresh();
      if (action === 'export-payments') return exportPayments();
      if (action === 'export-documents') return exportDocuments();
      if (action === 'export-commissions') return exportCommissions();
      if (action === 'export-reports') return exportReports();
      if (action === 'payment-detail') return paymentDetail(id);
      if (action === 'print-document') return printDocument(id);
      if (action === 'create-document') return await createQuickDocument();
      if (action === 'jump-expense') { $('#finance-expense-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
      if (action === 'document-sent') {
        await api('document.update', { id, status: 'sent' });
        toast('Statut de suivi modifié. Aucun e-mail n’a été envoyé.');
        return await refresh();
      }
      if (action === 'document-paid') {
        if (!window.confirm('Confirmer que le règlement de cette facture a réellement été reçu ? Cette action est un suivi comptable manuel : elle ne modifie pas Stripe.')) return;
        await api('document.update', { id, status: 'paid' });
        toast('Facture marquée payée pour le suivi comptable ; Stripe n’a pas été modifié.');
        return await refresh();
      }
      if (action === 'document-cancel') {
        if (!window.confirm('Annuler ce document en conservant son historique ?')) return;
        await api('document.update', { id, status: 'cancelled' });
        toast('Document annulé.'); return await refresh();
      }
      if (action === 'convert-quote') {
        if (!window.confirm('Créer une facture à partir de ce devis ? Le devis d’origine sera marqué comme converti.')) return;
        await api('document.convert', { id }); toast('Facture créée à partir du devis.'); return await refresh();
      }
      if (action === 'commission-pay') {
        const reference = window.prompt('Référence du virement ou du règlement déjà effectué :');
        if (!reference || !reference.trim()) return toast('Référence obligatoire ; aucune modification effectuée.', true);
        await api('commission.update', { id, status: 'paid', payment_reference: reference.trim() });
        toast('Référence de règlement enregistrée. Aucun virement bancaire n’a été lancé.'); return await refresh();
      }
      if (action === 'commission-cancel') {
        if (!window.confirm('Annuler cette commission sans la supprimer de l’historique ?')) return;
        await api('commission.update', { id, status: 'cancelled' }); toast('Commission annulée.'); return await refresh();
      }
    } catch (error) { toast(error.message || String(error), true); }
  }

  async function refresh() {
    setNotice('Chargement des données financières…', 'info');
    try {
      const result = await api('overview');
      data = {
        orders: Array.isArray(result.orders) ? result.orders : [],
        payments: Array.isArray(result.payments) ? result.payments : [],
        documents: Array.isArray(result.documents) ? result.documents : [],
        commissions: Array.isArray(result.commissions) ? result.commissions : [],
        expenses: Array.isArray(result.expenses) ? result.expenses : [],
        settings: Array.isArray(result.settings) ? result.settings : [],
        warnings: Array.isArray(result.warnings) ? result.warnings : [],
        serverTime: result.serverTime || new Date().toISOString()
      };
      renderAll();
      setNoticeWithWarnings();
      initialized = true;
    } catch (error) {
      renderNoDataError(error);
      setNotice(`Impossible de charger les données financières. ${error.message || error}`, 'error');
    }
  }

  function bindEvents() {
    if (initialized) return;
    initialized = true;
    document.addEventListener('click', (event) => {
      const actionButton = event.target.closest('[data-finance-action]');
      if (actionButton) {
        event.preventDefault();
        if (actionButton.disabled) return;
        void handleAction(actionButton.dataset.financeAction, actionButton.dataset.id || '');
        return;
      }
      const exportTable = event.target.closest('[data-export-table]');
      if (exportTable) {
        // admin-shared.js exports tables already. Do not intercept this existing behaviour.
      }
      if (event.target.closest('#finance-refresh-btn')) { event.preventDefault(); void refresh(); }
      if (event.target.closest('#finance-export-btn')) { event.preventDefault(); exportPayments(); }
      if (event.target.closest('#create-financial-document')) { event.preventDefault(); void createQuickDocument(); }
    });
    document.addEventListener('keydown', (event) => {
      if ((event.key === 'Enter' || event.key === ' ') && event.target.matches('[data-finance-action="jump-expense"]')) { event.preventDefault(); $('#finance-expense-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    });
    document.addEventListener('submit', (event) => {
      const form = event.target.closest('form[data-finance-form]');
      if (!form) return;
      event.preventDefault(); void submitFinanceForm(form);
    });
    document.addEventListener('input', (event) => {
      if (event.target.matches('#payments-search')) { paymentSearch = event.target.value; renderPaymentsPage(); }
      if (event.target.matches('#financial-documents-search')) { documentSearch = event.target.value; renderFacturationPage(); applyDocumentFilter(documentFilter); }
    });
    document.addEventListener('change', (event) => {
      if (event.target.matches('#payments-status-filter')) { paymentFilter = event.target.value; renderPaymentsPage(); }
      if (event.target.matches('#doc-tax-rate')) {
        const amount = num($('#doc-amount-ht')?.value), rate = num(event.target.value);
        const output = $('#doc-ttc-preview'); if (output) output.textContent = money(amount * (1 + rate / 100));
      }
      if (event.target.matches('#doc-amount-ht')) {
        const output = $('#doc-ttc-preview'); if (output) output.textContent = money(num(event.target.value) * (1 + num($('#doc-tax-rate')?.value) / 100));
      }
    });
  }

  // Replace the original demo filter handlers with functions scoped to the document table only.
  window.filterTable = function (status) {
    const map = { all: 'all', paye: 'paye', attente: 'attente', annule: 'annule' };
    applyDocumentFilter(map[status] || 'all');
    $$('.filter-btn').forEach((btn) => {
      const isActive = btn.getAttribute('onclick')?.includes(`'${status}'`);
      btn.classList.toggle('bg-secondary-container', Boolean(isActive));
      btn.classList.toggle('text-white', Boolean(isActive));
      btn.classList.toggle('text-secondary', !isActive);
    });
  };
  window.switchActionTab = function (type) { updateDocumentFormType(type); };

  async function initialize() {
    resetFictitiousValues();
    updateKpisAsLoading();
    bindEvents();
    try {
      if (!window.MMAdminAuth || typeof window.MMAdminAuth.checkAdminAuth !== 'function') {
        throw new Error('Authentification admin indisponible. Vérifie admin-auth.js.');
      }
      const auth = await window.MMAdminAuth.checkAdminAuth();
      if (!auth?.isAuthorized) return;
      if (!['super_admin','admin','accounting'].includes(auth.role)) throw new Error('Accès réservé aux administrateurs et au service comptable.');
      if (pageName === 'facturation') updateDocumentFormType('devis');
      const expenseDate = $('input[name="expense_date"]'); if (expenseDate && !expenseDate.value) expenseDate.value = new Date().toISOString().slice(0,10);
      await refresh();
    } catch (error) {
      renderNoDataError(error);
      setNotice(error.message || String(error), 'error');
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
  else void initialize();
})();
