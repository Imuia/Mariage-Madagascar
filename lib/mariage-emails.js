'use strict';

const crypto = require('crypto');

const ADMIN_EMAILS = [
  'info@mariage-madagascar.com',
  'commercial@mariage-madagascar.com'
];
const BRAND = 'Mariage Madagascar';
const SITE_URL = 'https://mariage-madagascar.vercel.app';

function escapeHtml(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
}

function money(value, currency = 'EUR') {
  const amount = Number(value || 0);
  try {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency', currency, maximumFractionDigits: 2
    }).format(amount);
  } catch (_) {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

function displayDate(value) {
  if (!value) return '';
  const raw = String(value).slice(0, 10);
  const date = new Date(`${raw}T00:00:00`);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

function parseSnapshot(value) {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch (_) { return {}; }
  }
  return {};
}

function renderItems(items = []) {
  if (!items.length) {
    return '<p style="color:#64748b">Le détail des prestations est disponible dans votre espace de commande.</p>';
  }
  return items.map(item => {
    const snapshot = parseSnapshot(item.options_snapshot);
    const arrival = displayDate(item.booking_date || snapshot.arrival_date || snapshot.booking_date);
    const departure = displayDate(snapshot.departure_date || snapshot.booking_end_date);
    const dates = (arrival || departure)
      ? `<div style="font-size:12px;color:#64748b;margin-top:5px">${arrival ? `Arrivée : ${escapeHtml(arrival)}` : ''}${arrival && departure ? ' · ' : ''}${departure ? `Départ : ${escapeHtml(departure)}` : ''}</div>`
      : '';
    const variation = item.variation_name
      ? `<div style="font-size:12px;color:#64748b;margin-top:4px">${escapeHtml(item.variation_name)}</div>`
      : '';
    const total = item.total_price != null ? item.total_price : Number(item.unit_price || 0) * Number(item.quantity || 1);
    return `<tr>
      <td style="padding:12px 0;border-bottom:1px solid #e2e8f0;vertical-align:top">
        <div style="font-weight:600;color:#0f172a">${escapeHtml(item.product_name || item.name || 'Prestation')}</div>
        ${variation}${dates}
        <div style="font-size:12px;color:#64748b;margin-top:4px">Quantité : ${escapeHtml(item.quantity || 1)}</div>
      </td>
      <td style="padding:12px 0;border-bottom:1px solid #e2e8f0;text-align:right;vertical-align:top;white-space:nowrap;font-weight:600;color:#0f172a">${escapeHtml(money(total, 'EUR'))}</td>
    </tr>`;
  }).join('');
}

function emailShell({ eyebrow, title, intro, content, footer }) {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"></head>
  <body style="margin:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
    <div style="max-width:680px;margin:0 auto;padding:24px 12px">
      <div style="background:#08111f;border-radius:16px 16px 0 0;padding:24px 28px;color:#e0f2fe">
        <div style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#7dd3fc">${escapeHtml(eyebrow || BRAND)}</div>
        <div style="font-size:22px;font-weight:700;margin-top:8px">${escapeHtml(title)}</div>
      </div>
      <div style="background:#ffffff;padding:28px;border:1px solid #e2e8f0;border-top:0;border-radius:0 0 16px 16px">
        <p style="font-size:15px;line-height:1.65;margin:0 0 18px">${intro}</p>
        ${content || ''}
        ${footer ? `<p style="font-size:12px;line-height:1.6;color:#64748b;margin:24px 0 0">${footer}</p>` : ''}
      </div>
      <p style="text-align:center;color:#64748b;font-size:12px;margin:18px 0 0">${BRAND} · <a href="${SITE_URL}" style="color:#0284c7;text-decoration:none">mariage-madagascar.vercel.app</a></p>
    </div>
  </body></html>`;
}

function orderSummary(order, items, statusText) {
  const currency = String(order.currency || 'EUR').toUpperCase();
  const firstName = escapeHtml(order.guest_first_name || '');
  const lastName = escapeHtml(order.guest_last_name || '');
  const total = money(order.total_amount, currency);
  const subtotal = money(order.subtotal, currency);
  const discount = Number(order.discount_amount || 0);
  return `
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px;margin:18px 0">
      <div style="font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:1px">Référence de commande</div>
      <div style="font-size:19px;font-weight:700;color:#0369a1;margin-top:4px">${escapeHtml(order.order_number || '')}</div>
      <div style="font-size:13px;color:#475569;margin-top:8px">${firstName} ${lastName}</div>
      <div style="font-size:13px;color:#475569;margin-top:4px">Statut : <strong>${escapeHtml(statusText)}</strong></div>
    </div>
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin:16px 0">
      <thead><tr><th align="left" style="font-size:12px;color:#64748b;text-transform:uppercase;padding-bottom:8px">Prestation</th><th align="right" style="font-size:12px;color:#64748b;text-transform:uppercase;padding-bottom:8px">Montant</th></tr></thead>
      <tbody>${renderItems(items)}</tbody>
    </table>
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin-top:10px">
      <tr><td style="padding:5px 0;color:#64748b;font-size:13px">Sous-total</td><td align="right" style="padding:5px 0;font-size:13px">${escapeHtml(subtotal)}</td></tr>
      ${discount > 0 ? `<tr><td style="padding:5px 0;color:#64748b;font-size:13px">Réduction</td><td align="right" style="padding:5px 0;font-size:13px">− ${escapeHtml(money(discount, currency))}</td></tr>` : ''}
      <tr><td style="padding:12px 0 0;border-top:1px solid #cbd5e1;font-weight:700;font-size:16px">Total de la commande</td><td align="right" style="padding:12px 0 0;border-top:1px solid #cbd5e1;font-weight:700;font-size:16px;color:#0369a1">${escapeHtml(total)}</td></tr>
    </table>`;
}

function transferInstructions(order) {
  return `
    <div style="margin-top:20px;padding:18px;border:1px solid #bae6fd;background:#f0f9ff;border-radius:12px">
      <h3 style="font-size:16px;margin:0 0 10px;color:#075985">Coordonnées de virement communiquées</h3>
      <p style="font-size:13px;line-height:1.65;margin:0 0 12px"><strong>Le compte reçoit des USD uniquement.</strong> Le total de commande affiché sur le site est en EUR : ne transférez pas directement le montant en EUR. Contactez l’équipe pour confirmer le montant exact en USD avant d’émettre le virement.</p>
      <p style="font-size:14px;font-weight:700;margin:12px 0 6px">Virement domestique américain (USD)</p>
      <p style="font-size:13px;line-height:1.6;margin:0">Bénéficiaire : Numixtra LLC<br>Adresse : 30 N Gould St, Sheridan, WY 82801-6317, États-Unis<br>Numéro de compte : <strong>218890536639</strong><br>Routing / ACH : <strong>101019644</strong><br>Wire routing : <strong>101019644</strong><br>Banque : Lead Bank<br>Adresse : 1801 Main Street, Kansas City, MO 64108, États-Unis</p>
      <p style="font-size:14px;font-weight:700;margin:14px 0 6px">Virement international (SWIFT)</p>
      <p style="font-size:13px;line-height:1.6;margin:0">Bénéficiaire : Numixtra LLC<br>Numéro de compte : <strong>218890536639</strong><br>SWIFT / BIC : <strong>REVOUS31</strong><br>BIC intermédiaire : <strong>CHASGB2L</strong><br>Banque : Revolut Technologies Inc.<br>Adresse : 107 Greenwich Street, Floor 20, New York, NY 10006, États-Unis</p>
      <p style="font-size:12px;line-height:1.6;color:#475569;margin:14px 0 0">Référence à indiquer : <strong>${escapeHtml(order.order_number || '')}</strong>. La commande reste en attente jusqu’à réception et vérification effective des fonds. Des frais bancaires peuvent s’appliquer.</p>
    </div>`;
}

function safeKey(input) {
  return crypto.createHash('sha256').update(String(input)).digest('hex').slice(0, 48);
}

async function sendResend({ to, subject, html, idempotencyKey }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL || process.env.EMAIL_FROM || process.env.RESEND_FROM;
  if (!apiKey) throw new Error('RESEND_API_KEY manquante dans Vercel.');
  if (!from) throw new Error('RESEND_FROM_EMAIL (ou EMAIL_FROM) manquante dans Vercel.');

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': safeKey(idempotencyKey)
    },
    body: JSON.stringify({ from, to: [to], subject, html })
  });
  const responseText = await response.text();
  let data = {};
  try { data = responseText ? JSON.parse(responseText) : {}; } catch (_) { data = { response: responseText }; }
  if (!response.ok) {
    throw new Error(`Resend [${response.status}] : ${data.message || data.error || responseText || 'échec de l’envoi'}`);
  }
  return data;
}

async function dispatchEmails(messages, { failOnError = false } = {}) {
  const results = await Promise.allSettled(messages.map(message => sendResend(message)));
  const failures = results.map((result, index) => result.status === 'rejected' ? {
    recipient: messages[index].to,
    error: result.reason?.message || String(result.reason)
  } : null).filter(Boolean);
  if (failures.length) {
    console.error('[Mariage Madagascar email] Envoi partiel/échoué', failures.map(f => ({ recipient: f.recipient, error: f.error })));
    if (failOnError) throw new Error(`Échec d'envoi Resend pour ${failures.map(f => f.recipient).join(', ')}.`);
  }
  return { sent: results.length - failures.length, failed: failures.length };
}

function bankTransferEmailMessages({ order, items = [] }) {
  const firstName = escapeHtml(order.guest_first_name || 'Bonjour');
  const orderNumber = String(order.order_number || 'commande');
  const customerIntro = `${firstName}, votre commande a bien été enregistrée. <strong>Le virement n’a pas encore été reçu ni confirmé</strong> : votre réservation reste en attente jusqu’à vérification des fonds.`;
  const content = `${orderSummary(order, items, 'En attente de virement')}${transferInstructions(order)}
    <p style="font-size:13px;line-height:1.65;margin:18px 0 0">Pour toute question sur le montant exact en USD ou les frais de transfert, répondez à cet e-mail ou contactez <a href="mailto:info@mariage-madagascar.com" style="color:#0284c7">info@mariage-madagascar.com</a>.</p>`;
  const customerHtml = emailShell({
    eyebrow: 'Commande enregistrée',
    title: 'Votre commande est en attente de virement',
    intro: customerIntro,
    content,
    footer: 'Cet e-mail confirme l’enregistrement de la commande, et non la réception du paiement.'
  });
  const adminContent = `${orderSummary(order, items, 'Virement bancaire en attente')}
    <div style="padding:16px;background:#fff7ed;border:1px solid #fed7aa;border-radius:12px;font-size:13px;line-height:1.6">
      <strong>Action :</strong> confirmer avec le client le montant USD à envoyer. Le compte bénéficiaire ne reçoit que des USD. Ne marquer la commande comme payée qu’après réception et vérification des fonds.
      <br><br><strong>E-mail client :</strong> ${escapeHtml(order.guest_email || '')}
      <br><strong>Téléphone :</strong> ${escapeHtml(order.guest_phone || 'Non renseigné')}
      <br><strong>Pays :</strong> ${escapeHtml(order.guest_country || 'Non renseigné')}
      <br><strong>Notes :</strong> ${escapeHtml(order.notes || 'Aucune')}
    </div>`;
  const adminHtml = emailShell({ eyebrow: 'Notification administration', title: 'Nouvelle commande par virement bancaire', intro: 'Une commande a été enregistrée. Le paiement est en attente et ne doit pas encore être considéré comme reçu.', content: adminContent });
  return [
    { to: order.guest_email, subject: `Commande ${orderNumber} enregistrée — virement en attente`, html: customerHtml, idempotencyKey: `bank-customer-${orderNumber}` },
    ...ADMIN_EMAILS.map((to, index) => ({ to, subject: `[Mariage Madagascar] Virement en attente — ${orderNumber}`, html: adminHtml, idempotencyKey: `bank-admin-${index}-${orderNumber}` }))
  ];
}

function paidOrderEmailMessages({ order, items = [] }) {
  const firstName = escapeHtml(order.guest_first_name || 'Bonjour');
  const orderNumber = String(order.order_number || 'commande');
  const detail = orderSummary(order, items, 'Paiement confirmé');
  const customerHtml = emailShell({
    eyebrow: 'Paiement confirmé',
    title: 'Nous avons bien reçu votre paiement',
    intro: `${firstName}, votre paiement pour la commande <strong>${escapeHtml(orderNumber)}</strong> a été confirmé. Merci d’avoir choisi Mariage Madagascar.`,
    content: `${detail}<p style="font-size:14px;line-height:1.65;margin:18px 0 0">Notre équipe reste à votre disposition pour finaliser les détails de votre expérience.</p><p style="margin:22px 0 0"><a href="${SITE_URL}" style="display:inline-block;padding:12px 18px;border-radius:8px;background:#0c4a6e;color:#ffffff;text-decoration:none;font-weight:700">Visiter Mariage Madagascar</a></p>`,
    footer: 'Conservez cet e-mail avec votre référence de commande.'
  });
  const adminHtml = emailShell({ eyebrow: 'Notification administration', title: 'Paiement reçu — commande confirmée', intro: `Stripe confirme la réception du paiement de la commande <strong>${escapeHtml(orderNumber)}</strong>.`, content: `${detail}<div style="margin-top:18px;padding:14px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;font-size:13px;line-height:1.6"><strong>Client :</strong> ${escapeHtml(order.guest_first_name || '')} ${escapeHtml(order.guest_last_name || '')}<br><strong>E-mail :</strong> ${escapeHtml(order.guest_email || '')}<br><strong>Téléphone :</strong> ${escapeHtml(order.guest_phone || 'Non renseigné')}<br><strong>Mode :</strong> Carte bancaire via Stripe</div>` });
  return [
    { to: order.guest_email, subject: `Paiement confirmé — commande ${orderNumber}`, html: customerHtml, idempotencyKey: `paid-customer-${orderNumber}` },
    ...ADMIN_EMAILS.map((to, index) => ({ to, subject: `[Mariage Madagascar] Paiement reçu — ${orderNumber}`, html: adminHtml, idempotencyKey: `paid-admin-${index}-${orderNumber}` }))
  ];
}

async function sendBankTransferOrderEmails(args) {
  return dispatchEmails(bankTransferEmailMessages(args), { failOnError: false });
}

async function sendPaidOrderEmails(args) {
  return dispatchEmails(paidOrderEmailMessages(args), { failOnError: true });
}

module.exports = {
  ADMIN_EMAILS,
  sendBankTransferOrderEmails,
  sendPaidOrderEmails
};
