const SUPABASE_URL = process.env.SUPABASE_URL || 'https://qrkinjuhtyfptldlvdyg.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY;

async function supabaseFetch(path, options = {}) {
  const url = `${SUPABASE_URL}/rest/v1/${path}`;
  const headers = {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_SERVICE_ROLE_KEY,
    'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    ...(options.headers || {})
  };

  const res = await fetch(url, { ...options, headers });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Supabase error [${res.status}] ${path}: ${errorText}`);
  }
  return res.json();
}

async function sendConfirmationEmail(order, orderItems) {
  if (!RESEND_API_KEY) {
    console.log('RESEND_API_KEY non configuré. Saut de l’envoi de l’email.');
    return;
  }

  const itemsHtml = orderItems.map(item => `
    <tr>
      <td style="padding: 8px; border-bottom: 1px solid #2a3a48;">${item.product_name} ${item.variation_name ? `(${item.variation_name})` : ''}</td>
      <td style="padding: 8px; border-bottom: 1px solid #2a3a48;">${item.booking_date || 'N/A'}</td>
      <td style="padding: 8px; border-bottom: 1px solid #2a3a48; text-align: right;">${item.total_price} €</td>
    </tr>
  `).join('');

  const emailPayload = {
    from: 'Mariage Madagascar Luxe <contact@mariage-madagascar.com>',
    to: [order.guest_email],
    subject: `Confirmation de votre réservation — Commande N° ${order.order_number}`,
    html: `
      <div style="font-family: Arial, sans-serif; background-color: #0a0e1a; color: #e0e8f0; padding: 20px; border-radius: 8px;">
        <h2 style="color: #7dd3fc;">Merci pour votre réservation, ${order.guest_first_name} !</h2>
        <p>Votre paiement a été confirmé avec succès. Voici le récapitulatif de votre commande :</p>

        <p><strong>Numéro de commande :</strong> ${order.order_number}</p>
        <p><strong>Statut du paiement :</strong> Payé & Confirmé</p>

        <table style="width: 100%; border-collapse: collapse; margin-top: 15px; color: #e0e8f0;">
          <thead>
            <tr style="background-color: #141c2e; color: #7dd3fc;">
              <th style="padding: 8px; text-align: left;">Produit</th>
              <th style="padding: 8px; text-align: left;">Date</th>
              <th style="padding: 8px; text-align: right;">Montant</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        <h3 style="color: #7dd3fc; margin-top: 20px;">Montant Total : ${order.total_amount} €</h3>

        <p style="margin-top: 30px; font-size: 12px; color: #a0b4c4;">
          Notre équipe Mariage Madagascar va prendre contact avec vous très prochainement pour affiner les derniers détails de votre expérience.
        </p>
      </div>
    `
  };

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(emailPayload)
    });
    console.log(`Email de confirmation envoyé à ${order.guest_email}`);
  } catch (err) {
    console.error('Erreur lors de l’envoi de l’email Resend:', err);
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

      // 1. Recherche de la commande dans Supabase
      const orders = await supabaseFetch(`orders?stripe_checkout_session_id=eq.${sessionId}&limit=1`);

      if (!orders || orders.length === 0) {
        console.warn(`Aucune commande trouvée pour la session Stripe ${sessionId}`);
        return res.status(200).json({ received: true, note: 'Order not found' });
      }

      const order = orders[0];

      // IDEMPOTENCE : Si la commande est déjà confirmée/payée, ne rien faire de plus
      if (order.payment_status === 'paid' && order.status === 'confirmed') {
        return res.status(200).json({ received: true, note: 'Already processed' });
      }

      // 2. Mise à jour de la commande vers 'paid' et 'confirmed'
      await supabaseFetch(`orders?id=eq.${order.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: 'confirmed',
          payment_status: 'paid',
          stripe_payment_intent_id: paymentIntentId,
          updated_at: new Date().toISOString()
        })
      });

      // 3. Enregistrement de la transaction de paiement
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

      // 4. Incrémentation sécurisée du code promo si un code promo était associé
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

      // 5. Récupération des lignes de commande et envoi de l'email de confirmation
      const orderItems = await supabaseFetch(`order_items?order_id=eq.${order.id}`);
      await sendConfirmationEmail(order, orderItems);
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('Erreur webhook Stripe:', err);
    return res.status(500).json({ message: 'Erreur interne lors du traitement du webhook.' });
  }
};
