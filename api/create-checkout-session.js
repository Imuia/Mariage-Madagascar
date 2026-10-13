const SUPABASE_URL = process.env.SUPABASE_URL || 'https://qrkinjuhtyfptldlvdyg.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFya2luanVodHlmcHRsZGx2ZHlnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA4MzY3NzUsImV4cCI6MjEwNjQxMjc3NX0.rKo326yy_QALlLVH5FfFfzyRp_J6Fd6B3EnZhbdIj9I';
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

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

function isValidHttpUrl(string) {
  let url;
  try {
    url = new URL(string);
  } catch (_) {
    return false;
  }
  return url.protocol === "http:" || url.protocol === "https:";
}

// Validation stricte des dates du tunnel (format attendu : YYYY-MM-DD).
function isValidIsoDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Méthode non autorisée. Utilisez POST.' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      if (!body.trim()) {
        return res.status(400).json({ message: 'Corps de requête vide.' });
      }
      try {
        body = JSON.parse(body);
      } catch (e) {
        return res.status(400).json({ message: 'Format JSON invalide dans la requête.' });
      }
    }

    const { customer, cart, promoCode } = body || {};
    const paymentMethod = (body && body.payment_method) || 'card';

    if (!['card', 'bank_transfer'].includes(paymentMethod)) {
      return res.status(400).json({ message: 'Mode de paiement invalide.' });
    }

    if (!customer || !customer.first_name || !customer.last_name || !customer.email) {
      return res.status(400).json({ message: 'Informations client incomplètes (prénom, nom et email requis).' });
    }

    if (!cart || !Array.isArray(cart) || cart.length === 0) {
      return res.status(400).json({ message: 'Votre panier est vide.' });
    }

    if (paymentMethod === 'card' && !STRIPE_SECRET_KEY) {
      return res.status(500).json({ message: 'Configuration Stripe serveur incomplète : la variable d’environnement STRIPE_SECRET_KEY est manquante dans Vercel.' });
    }

    // 1. RE-VÉRIFICATION STRICTE DES PRIX ET PRODUITS DEPUIS SUPABASE (SERVEUR DE VÉRITÉ)
    let verifiedSubtotal = 0;
    const verifiedOrderItems = [];
    const lineItemsForStripe = [];

    for (const item of cart) {
      if (!item.product_id) {
        return res.status(400).json({ message: 'Produit invalide dans le panier.' });
      }

      // Les dates sont obligatoires pour tous les produits, y compris côté serveur.
      const arrivalDate = item.booking_date || item.arrival_date || '';
      const departureDate = item.booking_end_date || item.departure_date || '';
      if (!isValidIsoDate(arrivalDate) || !isValidIsoDate(departureDate) || departureDate <= arrivalDate) {
        return res.status(400).json({
          message: `Les dates d'arrivée et de départ sont obligatoires et doivent être valides pour « ${item.name || 'cette prestation'} ». Le départ doit être après l'arrivée.`
        });
      }

      // Requête Supabase pour récupérer le produit réel
      const products = await supabaseFetch(`mm_products?id=eq.${item.product_id}&published=eq.true&limit=1`);
      if (!products || products.length === 0) {
        return res.status(400).json({ message: `Le produit "${item.name || 'inconnu'}" n'est plus disponible.` });
      }

      const dbProduct = products[0];
      let unitPrice = 0;
      let variationName = '';

      if (item.variation_id) {
        const variations = await supabaseFetch(`mm_product_variations?id=eq.${item.variation_id}&published=eq.true&limit=1`);
        if (!variations || variations.length === 0) {
          return res.status(400).json({ message: `La formule sélectionnée pour "${dbProduct.name}" n'est plus disponible.` });
        }
        const dbVariation = variations[0];
        unitPrice = Number(dbVariation.regular_price || 0);
        variationName = dbVariation.name || dbVariation.attribute_value || '';
      } else {
        unitPrice = Number(dbProduct.regular_price || 0);
      }

      const quantity = Math.max(1, Number(item.quantity || 1));
      const itemTotal = unitPrice * quantity;
      verifiedSubtotal += itemTotal;

      verifiedOrderItems.push({
        product_id: dbProduct.id,
        variation_id: item.variation_id || null,
        item_type: 'product',
        product_name: dbProduct.name,
        product_slug: dbProduct.slug,
        variation_name: variationName,
        unit_price: unitPrice,
        quantity: quantity,
        total_price: itemTotal,
        pax: item.pax || null,
        // booking_date est la colonne existante pour l'arrivée.
        booking_date: arrivalDate,
        // Conserver le départ dans le JSONB existant, sans exiger de migration SQL.
        options_snapshot: {
          ...(item.options && typeof item.options === 'object' && !Array.isArray(item.options) ? item.options : {}),
          arrival_date: arrivalDate,
          departure_date: departureDate,
          booking_end_date: departureDate
        }
      });

      const imageUrl = isValidHttpUrl(dbProduct.featured_image_url) ? dbProduct.featured_image_url : null;

      lineItemsForStripe.push({
        price_data: {
          currency: 'eur',
          product_data: {
            name: dbProduct.name,
            description: variationName ? `Formule : ${variationName}` : (dbProduct.short_description || undefined),
            images: imageUrl ? [imageUrl] : []
          },
          unit_amount: Math.round(unitPrice * 100) // Montant en centimes
        },
        quantity: quantity
      });
    }

    // 2. VÉRIFICATION SÉCURISÉE DU CODE PROMOTIONNEL (SI FOURNI)
    let discountAmount = 0;
    let verifiedPromoCodeId = null;

    if (promoCode) {
      const promos = await supabaseFetch(
        `promo_codes?code=ilike.${encodeURIComponent(promoCode.trim())}&is_active=eq.true&limit=1`
      );

      if (promos && promos.length > 0) {
        const promo = promos[0];
        const today = new Date().toISOString().split('T')[0];

        const isStarted = !promo.start_date || promo.start_date <= today;
        const isNotExpired = !promo.expiry_date || promo.expiry_date >= today;
        const hasUsesLeft = promo.max_uses == null || promo.usage_count < promo.max_uses;

        if (isStarted && isNotExpired && hasUsesLeft) {
          verifiedPromoCodeId = promo.id;
          if (promo.discount_type === 'percentage') {
            discountAmount = (verifiedSubtotal * Number(promo.discount_value)) / 100;
          } else if (promo.discount_type === 'fixed_amount') {
            discountAmount = Number(promo.discount_value);
          }
        }
      }
    }

    const verifiedTotalAmount = Math.max(0, verifiedSubtotal - discountAmount);
    const orderNumber = `MM-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    // VIREMENT BANCAIRE : créer une commande en attente sans créer de session Stripe.
    // Aucun champ de schéma supplémentaire n'est requis ; le mode est conservé dans notes.
    if (paymentMethod === 'bank_transfer') {
      const bankTransferOrderRecord = {
        order_number: orderNumber,
        guest_first_name: customer.first_name,
        guest_last_name: customer.last_name,
        guest_email: customer.email,
        guest_phone: customer.phone || '',
        guest_country: customer.country || 'France',
        status: 'pending',
        payment_status: 'pending',
        currency: 'EUR',
        subtotal: verifiedSubtotal,
        discount_amount: discountAmount,
        total_amount: verifiedTotalAmount,
        promo_code_id: verifiedPromoCodeId,
        notes: [
          customer.notes || '',
          'Mode de paiement : virement bancaire',
          customer.transfer_account_holder ? `Titulaire du compte émetteur : ${String(customer.transfer_account_holder).slice(0, 160)}` : '',
          customer.planned_transfer_date ? `Date prévue du virement : ${String(customer.planned_transfer_date).slice(0, 10)}` : ''
        ].filter(Boolean).join('\n'),
        booking_date: verifiedOrderItems[0]?.booking_date || null
      };

      const insertedBankOrders = await supabaseFetch('orders', {
        method: 'POST',
        headers: { 'Prefer': 'return=representation' },
        body: JSON.stringify(bankTransferOrderRecord)
      });

      if (!insertedBankOrders || !insertedBankOrders.length) {
        throw new Error('Échec de l’enregistrement de la commande par virement dans Supabase.');
      }

      const insertedBankOrder = insertedBankOrders[0];
      for (const itemRecord of verifiedOrderItems) {
        itemRecord.order_id = insertedBankOrder.id;
        await supabaseFetch('order_items', {
          method: 'POST',
          headers: { 'Prefer': 'return=representation' },
          body: JSON.stringify(itemRecord)
        });
      }

      return res.status(200).json({
        method: 'bank_transfer',
        orderNumber,
        message: 'Commande enregistrée en attente de virement bancaire.'
      });
    }

    // Construction stricte et sécurisée des URLs absolues
    const baseUrl = 'https://mariage-madagascar.vercel.app';
    const successUrl = `${baseUrl}/confirmation-paiement.html?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${baseUrl}/paiement-annule.html`;

    // 3. CRÉATION DU PAIEMENT DANS STRIPE CHECKOUT VIA API STRIPE REST
    const stripeParams = new URLSearchParams();
    stripeParams.append('payment_method_types[0]', 'card');
    stripeParams.append('mode', 'payment');
    stripeParams.append('customer_email', customer.email);
    stripeParams.append('client_reference_id', orderNumber);
    stripeParams.append('success_url', successUrl);
    stripeParams.append('cancel_url', cancelUrl);

    // ACTIVATION FACTURATION NATIVE STRIPE
    stripeParams.append('invoice_creation[enabled]', 'true');

    // TRANSMISSION METADATA CLIENT
    stripeParams.append('payment_intent_data[description]', `Commande ${orderNumber} - Mariage Madagascar Luxe`);
    stripeParams.append('metadata[first_name]', customer.first_name);
    stripeParams.append('metadata[last_name]', customer.last_name);
    stripeParams.append('metadata[phone]', customer.phone || '');
    stripeParams.append('metadata[country]', customer.country || 'France');

    lineItemsForStripe.forEach((item, index) => {
      stripeParams.append(`line_items[${index}][price_data][currency]`, item.price_data.currency);
      stripeParams.append(`line_items[${index}][price_data][product_data][name]`, item.price_data.product_data.name);
      if (item.price_data.product_data.description) {
        stripeParams.append(`line_items[${index}][price_data][product_data][description]`, item.price_data.product_data.description);
      }
      if (item.price_data.product_data.images && item.price_data.product_data.images.length > 0) {
        stripeParams.append(`line_items[${index}][price_data][product_data][images][0]`, item.price_data.product_data.images[0]);
      }
      stripeParams.append(`line_items[${index}][price_data][unit_amount]`, item.price_data.unit_amount);
      stripeParams.append(`line_items[${index}][quantity]`, item.quantity);
    });

    const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: stripeParams
    });

    const stripeText = await stripeRes.text();
    if (!stripeRes.ok) {
      let stripeErr = {};
      try { stripeErr = JSON.parse(stripeText); } catch (_) {}
      throw new Error(`Erreur Stripe Checkout: ${stripeErr.error?.message || stripeText || 'Impossible de créer la session Stripe'}`);
    }

    const session = JSON.parse(stripeText);

    // 4. CRÉATION DE LA COMMANDE EN STATUT 'pending' DANS SUPABASE
    const orderRecord = {
      order_number: orderNumber,
      guest_first_name: customer.first_name,
      guest_last_name: customer.last_name,
      guest_email: customer.email,
      guest_phone: customer.phone || '',
      guest_country: customer.country || 'France',
      status: 'pending',
      payment_status: 'pending',
      currency: 'EUR',
      subtotal: verifiedSubtotal,
      discount_amount: discountAmount,
      total_amount: verifiedTotalAmount,
      promo_code_id: verifiedPromoCodeId,
      stripe_checkout_session_id: session.id,
      notes: customer.notes || '',
      booking_date: cart[0]?.booking_date || null
    };

    const insertedOrders = await supabaseFetch('orders', {
      method: 'POST',
      headers: { 'Prefer': 'return=representation' },
      body: JSON.stringify(orderRecord)
    });

    if (!insertedOrders || !insertedOrders.length) {
      throw new Error('Échec de l’enregistrement de la commande dans Supabase (réponse vide).');
    }

    const insertedOrder = insertedOrders[0];

    // Enregistrement des lignes order_items
    for (const itemRecord of verifiedOrderItems) {
      itemRecord.order_id = insertedOrder.id;
      await supabaseFetch('order_items', {
        method: 'POST',
        headers: { 'Prefer': 'return=representation' },
        body: JSON.stringify(itemRecord)
      });
    }

    return res.status(200).json({
      url: session.url,
      sessionId: session.id,
      orderNumber: orderNumber
    });

  } catch (err) {
    console.error('Erreur create-checkout-session:', err);
    return res.status(500).json({
      message: err.message || 'Une erreur interne est survenue lors de la création de votre session de paiement.'
    });
  }
};
