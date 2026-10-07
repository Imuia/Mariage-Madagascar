const SUPABASE_URL = process.env.SUPABASE_URL || 'https://qrkinjuhtyfptldlvdyg.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFya2luanVodHlmcHRsZGx2ZHlnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA4MzY3NzUsImV4cCI6MjEwNjQxMjc3NX0.rKo326yy_QALlLVH5FfFfzyRp_J6Fd6B3EnZhbdIj9I';

async function supabaseFetch(path) {
  const url = `${SUPABASE_URL}/rest/v1/${path}`;
  const headers = {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`
  };

  const res = await fetch(url, { headers });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Supabase error [${res.status}] ${path}: ${errorText}`);
  }
  return res.json();
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Méthode non autorisée.' });
  }

  const { session_id, order_id } = req.query || {};

  if (!session_id && !order_id) {
    return res.status(400).json({ message: 'Identifiant de session ou de commande requis.' });
  }

  try {
    let filter = '';
    if (session_id) {
      filter = `stripe_checkout_session_id=eq.${encodeURIComponent(session_id)}`;
    } else {
      filter = `id=eq.${encodeURIComponent(order_id)}`;
    }

    const orders = await supabaseFetch(`orders?${filter}&limit=1`);

    if (!orders || orders.length === 0) {
      return res.status(404).json({ message: 'Commande non trouvée.' });
    }

    const order = orders[0];
    const orderItems = await supabaseFetch(`order_items?order_id=eq.${order.id}`);

    return res.status(200).json({
      order: {
        order_number: order.order_number,
        guest_first_name: order.guest_first_name,
        guest_last_name: order.guest_last_name,
        guest_email: order.guest_email,
        guest_phone: order.guest_phone,
        guest_country: order.guest_country,
        status: order.status,
        payment_status: order.payment_status,
        currency: order.currency,
        subtotal: order.subtotal,
        discount_amount: order.discount_amount,
        total_amount: order.total_amount,
        booking_date: order.booking_date,
        created_at: order.created_at,
        stripe_checkout_session_id: order.stripe_checkout_session_id
      },
      items: orderItems.map(item => ({
        product_name: item.product_name,
        product_slug: item.product_slug,
        variation_name: item.variation_name,
        unit_price: item.unit_price,
        quantity: item.quantity,
        total_price: item.total_price,
        pax: item.pax,
        booking_date: item.booking_date,
        options: item.options_snapshot || {}
      }))
    });
  } catch (err) {
    console.error('Erreur get-order-confirmation:', err);
    return res.status(500).json({ message: 'Erreur lors de la récupération de la confirmation.' });
  }
};
