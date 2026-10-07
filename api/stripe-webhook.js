const SUPABASE_URL = process.env.SUPABASE_URL || 'https://qrkinjuhtyfptldlvdyg.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFya2luanVodHlmcHRsZGx2ZHlnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA4MzY3NzUsImV4cCI6MjEwNjQxMjc3NX0.rKo326yy_QALlLVH5FfFfzyRp_J6Fd6B3EnZhbdIj9I';
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY;

async function supabaseFetch(path, options = {}) {
  const url = `${SUPABASE_URL}/rest/v1/${path}`;
  const headers = {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    ...(options.headers || {})
  };

  const res = await fetch(url, { ...options, headers });
  const text = await res.text();

  if (!res.ok) {
    throw new Error(`Supabase error [${res.status}] ${path}: ${text}`);
  }

  if (!text || !text.trim()) {
    return [];
  }

  try {
    return JSON.parse(text);
  } catch (err) {
    throw new Error(`Erreur parse JSON Supabase sur ${path}: ${text}`);
  }
}

async function fetchStripeInvoiceUrl(invoiceId) {
  if (!invoiceId || !STRIPE_SECRET_KEY) return null;
  try {
    const res = await fetch(`https://api.stripe.com/v1/invoices/${encodeURIComponent(invoiceId)}`, {
      headers: {
        'Authorization': `Bearer ${STRIPE_SECRET_KEY}`
      }
    });
    if (!res.ok) return null;
    const invoice = await res.json();
    return invoice.hosted_invoice_url || invoice.invoice_pdf || null;
  } catch (err) {
    console.error('Erreur récupération facture Stripe:', err);
    return null;
  }
}

async function sendConfirmationEmail(order, orderItems, invoiceUrl) {
  if (!RESEND_API_KEY) {
    console.log('[Resend] RESEND_API_KEY non configuré. Saut de l’envoi client.');
    return;
  }

  const itemsHtml = orderItems.map(item => `
    <tr>
      <td style="padding: 10px; border-bottom: 1px solid #2a3a48;">${item.product_name} ${item.variation_name ? `(${item.variation_name})` : ''}</td>
      <td style="padding: 10px; border-bottom: 1px solid #2a3a48;">${item.booking_date || 'N/A'}</td>
      <td style="padding: 10px; border-bottom: 1px solid #2a3a48; text-align: right; font-weight: bold; color: #7dd3fc;">${item.total_price} €</td>
    </tr>
  `).join('');

  const invoiceButtonHtml = invoiceUrl ? `
    <div style="margin-top: 25px; text-align: center;">
      <a href="${invoiceUrl}" target="_blank" style="background-color: #7dd3fc; color: #001f2e; padding: 12px 24px; font-weight: bold; text-decoration: none; border-radius: 8px; display: inline-block;">
        Consulter / Télécharger la Facture Officielle Stripe
      </a>
    </div>
  ` : '';

  // Utiliser la boîte d'envoi par défaut ou de domaine vérifié (Resend sandbox impose onlining ou domaine validé)
  const fromAddress = process.env.RESEND_FROM_EMAIL || 'Mariage Madagascar Luxe <onboarding@resend.dev>';

  const emailPayload = {
    from: fromAddress,
    to: [order.guest_email],
    subject: `Confirmation de votre réservation — Mariage Madagascar — ${order.order_number}`,
    html: `
      <div style="font-family: 'Helvetica Neue', Arial, sans-serif; background-color: #0a0e1a; color: #e0e8f0; padding: 30px; border-radius: 12px; border: 1px solid #2a3a48; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #7dd3fc; margin-top: 0;">Bonjour ${order.guest_first_name} ${order.guest_last_name},</h2>
        <p style="font-size: 15px; line-height: 1.6; color: #a0b4c4;">
          Nous avons le plaisir de vous confirmer que votre paiement a été validé avec succès. Votre réservation chez <strong style="color: #e0e8f0;">Mariage Madagascar Luxe</strong> est officiellement confirmée !
        </p>

        <div style="background-color: #141c2e; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid #2a3a48;">
          <p style="margin: 5px 0;"><strong>Numéro de réservation :</strong> <span style="color: #7dd3fc; font-family: monospace; font-size: 16px;">${order.order_number}</span></p>
          <p style="margin: 5px 0;"><strong>Statut du paiement :</strong> <span style="color: #4ade80;">Payé & Confirmé</span></p>
          <p style="margin: 5px 0;"><strong>Mode de paiement :</strong> Carte Bancaire via Stripe</p>
        </div>

        <h3 style="color: #c8a0f0; margin-top: 25px;">Prestations réservées</h3>
        <table style="width: 100%; border-collapse: collapse; margin-top: 10px; color: #e0e8f0; font-size: 14px;">
          <thead>
            <tr style="background-color: #141c2e; color: #7dd3fc;">
              <th style="padding: 10px; text-align: left;">Prestation</th>
              <th style="padding: 10px; text-align: left;">Date</th>
              <th style="padding: 10px; text-align: right;">Montant</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        <div style="text-align: right; margin-top: 20px; font-size: 18px; font-weight: bold; color: #7dd3fc;">
          Total Payé : ${order.total_amount} €
        </div>

        ${invoiceButtonHtml}

        <div style="margin-top: 35px; padding-top: 20px; border-top: 1px solid #2a3a48; font-size: 13px; color: #a0b4c4; line-height: 1.6;">
          <strong style="color: #e0e8f0;">Coordonnées Mariage Madagascar :</strong><br>
          Email : <a href="mailto:info@mariage-madagascar.com" style="color: #7dd3fc;">info@mariage-madagascar.com</a><br>
          Site Web : <a href="https://mariage-madagascar.vercel.app" style="color: #7dd3fc;">mariage-madagascar.vercel.app</a><br>
          Notre équipe prendra contact avec vous très prochainement pour affiner tous les détails de votre séjour.
        </div>
      </div>
    `
  };

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(emailPayload)
    });

    const resText = await res.text();
    console.log(`[Resend client] HTTP Status: ${res.status}, Body: ${resText}`);

    if (res.ok) {
      await supabaseFetch(`orders?id=eq.${order.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ confirmation_email_sent_at: new Date().toISOString() })
      });
    } else {
      console.error(`[Resend client error] HTTP ${res.status}: ${resText}`);
    }
  } catch (err) {
    console.error('Erreur lors de l’envoi de l’email Resend au client:', err);
  }
}

async function sendInternalNotificationEmail(order, orderItems, session, invoiceUrl) {
  if (!RESEND_API_KEY) {
    console.log('[Resend] RESEND_API_KEY non configuré. Saut notification interne.');
    return;
  }

  const itemsList = orderItems.map(item => `
    - ${item.product_name} ${item.variation_name ? `(${item.variation_name})` : ''} | Date : ${item.booking_date || 'N/A'} | Quantité : ${item.quantity} | Prix : ${item.total_price} EUR
  `).join('\n');

  const fromAddress = process.env.RESEND_FROM_EMAIL || 'Mariage Madagascar Luxe <onboarding@resend.dev>';

  const emailPayload = {
    from: fromAddress,
    to: ['info@mariage-madagascar.com'],
    subject: `🔔 Nouvelle réservation PAYÉE — ${order.order_number} — ${order.total_amount} €`,
    text: `
Nouvelle réservation confirmée et PAYÉE !

Numéro : ${order.order_number}
Client : ${order.guest_first_name} ${order.guest_last_name}
Email : ${order.guest_email}
Téléphone : ${order.guest_phone || 'Non renseigné'}
Pays : ${order.guest_country || 'France'}

Prestations :
${itemsList}

Total payé : ${order.total_amount} EUR
Statut : PAYÉ

Identifiants Stripe :
- Checkout Session ID : ${session.id}
- Payment Intent ID : ${session.payment_intent || 'N/A'}
- Invoice ID : ${session.invoice || 'N/A'}
- Lien Facture : ${invoiceUrl || 'N/A'}
    `
  };

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(emailPayload)
    });

    const resText = await res.text();
    console.log(`[Resend interne] HTTP Status: ${res.status}, Body: ${resText}`);

    if (res.ok) {
      await supabaseFetch(`orders?id=eq.${order.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ internal_notification_sent_at: new Date().toISOString() })
      });
    } else {
      console.error(`[Resend interne error] HTTP ${res.status}: ${resText}`);
    }
  } catch (err) {
    console.error('Erreur lors de l’envoi de la notification interne Resend:', err);
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Méthode non autorisée.' });
  }

  try {
    const event = req.body;

    if (!event || !event.type) {
      return res.status(400).json({ message: 'Événement Stripe invalide.' });
    }

    // Traitement de l'événement checkout.session.completed
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const sessionId = session.id;
      const paymentIntentId = session.payment_intent;
      const invoiceId = session.invoice || null;

      console.log(`[Webhook Stripe] Traitement de checkout.session.completed pour session ID: ${sessionId}`);

      // 1. Recherche de la commande dans Supabase
      const orders = await supabaseFetch(`orders?stripe_checkout_session_id=eq.${sessionId}&limit=1`);

      if (!orders || orders.length === 0) {
        console.warn(`[Webhook Stripe] Aucune commande trouvée pour la session Stripe ${sessionId}`);
        return res.status(200).json({ received: true, note: 'Order not found' });
      }

      let order = orders[0];

      // IDEMPOTENCE STRICTE : Si la commande a DEJA été traitée (email client et notification déjà envoyés)
      if (order.payment_status === 'paid' && order.status === 'confirmed' && order.confirmation_email_sent_at && order.internal_notification_sent_at) {
        console.log(`[Webhook Stripe] Commande ${order.order_number} déjà entièrement traitée.`);
        return res.status(200).json({ received: true, note: 'Already fully processed' });
      }

      // 2. Si la commande n'est pas encore 'paid'/'confirmed', mettre à jour les statuts dans Supabase
      if (order.payment_status !== 'paid' || order.status !== 'confirmed') {
        const updatedOrders = await supabaseFetch(`orders?id=eq.${order.id}`, {
          method: 'PATCH',
          headers: { 'Prefer': 'return=representation' },
          body: JSON.stringify({
            status: 'confirmed',
            payment_status: 'paid',
            stripe_payment_intent_id: paymentIntentId,
            stripe_invoice_id: invoiceId,
            updated_at: new Date().toISOString()
          })
        });

        if (updatedOrders && updatedOrders.length) {
          order = updatedOrders[0];
        }

        // 3. Enregistrement de la transaction de paiement dans payments
        await supabaseFetch('payments', {
          method: 'POST',
          body: JSON.stringify({
            order_id: order.id,
            stripe_payment_intent_id: paymentIntentId,
            stripe_checkout_session_id: sessionId,
            payment_method: 'stripe',
            amount: order.total_amount,
            currency: order.currency || 'EUR',
            status: 'succeeded'
          })
        });

        // 4. Incrémentation sécurisée du code promo post-paiement
        if (order.promo_code_id) {
          try {
            const promo = await supabaseFetch(`promo_codes?id=eq.${order.promo_code_id}&limit=1`);
            if (promo && promo.length > 0) {
              await supabaseFetch(`rpc/increment_promo_code_usage`, {
                method: 'POST',
                body: JSON.stringify({ p_code: promo[0].code })
              });
            }
          } catch (promoErr) {
            console.error('Erreur incrémentation code promo:', promoErr);
          }
        }
      }

      // 5. Récupération des détails pour l'envoi des emails
      const orderItems = await supabaseFetch(`order_items?order_id=eq.${order.id}`);
      const invoiceUrl = await fetchStripeInvoiceUrl(invoiceId);

      // Envoi de l'email client s'il n'a pas encore été envoyé
      if (!order.confirmation_email_sent_at) {
        await sendConfirmationEmail(order, orderItems, invoiceUrl);
      }

      // Envoi de l'email interne s'il n'a pas encore été envoyé
      if (!order.internal_notification_sent_at) {
        await sendInternalNotificationEmail(order, orderItems, session, invoiceUrl);
      }
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('[Webhook Stripe Error]:', err);
    return res.status(500).json({ message: 'Erreur interne lors du traitement du webhook.' });
  }
};
