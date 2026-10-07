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
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Supabase error [${res.status}] ${path}: ${errorText}`);
  }
  return res.json();
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

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Méthode non autorisée. Utilisez POST.' });
  }

  try {
    const { customer, cart, promoCode } = req.body || {};

    if (!customer || !customer.first_name || !customer.last_name || !customer.email) {
      return res.status(400).json({ message: 'Informations client incomplètes (prénom, nom et email requis).' });
    }

    if (!cart || !Array.isArray(cart) || cart.length === 0) {
      return res.status(400).json({ message: 'Votre panier est vide.' });
    }

    if (!STRIPE_SECRET_KEY) {
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
        booking_date: item.booking_date || null,
        options_snapshot: item.options || {}
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

    if (!stripeRes.ok) {
      const stripeErr = await stripeRes.json();
      throw new Error(`Erreur Stripe Checkout: ${stripeErr.error?.message || 'Impossible de créer la session Stripe'}`);
    }

    const session = await stripeRes.json();

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
