// Vercel serverless function for Mariage Madagascar admin finance.
// Required Vercel environment variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
// SUPABASE_ANON_KEY (publishable/anon key), ADMIN_EMAIL (optional).
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'info@mariage-madagascar.com').toLowerCase();

function send(res, status, body) {
  res.setHeader('Cache-Control', 'no-store');
  return res.status(status).json(body);
}
function config() {
  const url = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const anon = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || '';
  if (!url || !service || !anon) throw new Error('Variables Vercel manquantes : SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY et SUPABASE_ANON_KEY.');
  return { url, service, anon };
}
async function rest(table, { method = 'GET', query = '', body, prefer = '' } = {}) {
  const c = config();
  const response = await fetch(`${c.url}/rest/v1/${table}${query ? `?${query}` : ''}`, {
    method,
    headers: {
      apikey: c.service,
      Authorization: `Bearer ${c.service}`,
      'Content-Type': 'application/json',
      ...(prefer ? { Prefer: prefer } : {})
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {})
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (_) { data = text; }
  if (!response.ok) {
    const error = new Error(data?.message || data?.hint || data?.details || `Supabase ${response.status} sur ${table}`);
    error.status = response.status;
    error.table = table;
    throw error;
  }
  return data;
}
async function verifyAdmin(req) {
  const c = config();
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return false;
  const response = await fetch(`${c.url}/auth/v1/user`, { headers: { apikey: c.anon, Authorization: `Bearer ${token}` } });
  if (!response.ok) return false;
  const user = await response.json();
  return String(user.email || '').toLowerCase() === ADMIN_EMAIL && !!user.id;
}
async function optional(table, query, warnings) {
  try { return await rest(table, { query }); }
  catch (e) { warnings.push(`${table}: ${e.message}`); return []; }
}
function cleanText(v, max = 2000) { return String(v ?? '').trim().slice(0, max); }
function amount(v) { const n = Number(v); if (!Number.isFinite(n) || n < 0) throw new Error('Montant invalide.'); return Math.round(n * 100) / 100; }

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') { res.setHeader('Allow', 'GET, POST, OPTIONS'); return res.status(204).end(); }
  if (!['GET', 'POST'].includes(req.method)) return send(res, 405, { error: 'Méthode non autorisée.' });
  try {
    if (!(await verifyAdmin(req))) return send(res, 401, { error: `Accès refusé. Connectez-vous avec ${ADMIN_EMAIL}.` });
    const action = req.method === 'GET' ? String(req.query.action || 'overview') : String(req.body?.action || '');
    if (req.method === 'GET' && action !== 'overview') return send(res, 400, { error: 'Action de lecture inconnue.' });

    if (action === 'overview') {
      const warnings = [];
      const [orders, payments, commissions, settings, documents, expenses] = await Promise.all([
        optional('orders', 'select=*&order=created_at.desc&limit=1000', warnings),
        optional('payments', 'select=*&order=created_at.desc&limit=1000', warnings),
        optional('mm_provider_commissions', 'select=*&order=created_at.desc&limit=1000', warnings),
        optional('mm_finance_settings', 'select=*&order=updated_at.desc&limit=100', warnings),
        optional('mm_financial_documents', 'select=*&order=created_at.desc&limit=1000', warnings),
        optional('mm_financial_expenses', 'select=*&order=created_at.desc&limit=1000', warnings)
      ]);
      return send(res, 200, { orders, payments, commissions, settings, documents, expenses, warnings, serverTime: new Date().toISOString() });
    }

    const body = req.body || {};
    if (action === 'commission.create') {
      const provider_name = cleanText(body.provider_name, 250);
      const description = cleanText(body.description, 2000);
      const base_amount = amount(body.base_amount);
      const commission_rate = Number(body.commission_rate);
      if (!provider_name || !description || !Number.isFinite(commission_rate) || commission_rate < 0 || commission_rate > 100) return send(res, 400, { error: 'Prestataire, prestation et taux valide sont obligatoires.' });
      const row = {
        provider_name, provider_email: cleanText(body.provider_email, 320) || null, description,
        base_amount, commission_rate, commission_amount: Math.round(base_amount * commission_rate) / 100,
        currency: 'EUR', status: 'pending', notes: cleanText(body.notes, 1000) || null
      };
      const created = await rest('mm_provider_commissions', { method: 'POST', query: 'select=*', body: row, prefer: 'return=representation' });
      return send(res, 201, { commission: Array.isArray(created) ? created[0] : created });
    }
    if (action === 'commission.update') {
      const id = cleanText(body.id, 100);
      const status = String(body.status || '');
      if (!id || !['paid', 'cancelled'].includes(status)) return send(res, 400, { error: 'Identifiant ou statut de commission invalide.' });
      const patch = { status, updated_at: new Date().toISOString() };
      if (status === 'paid') { patch.paid_at = new Date().toISOString(); patch.payment_reference = cleanText(body.payment_reference, 250); }
      const updated = await rest('mm_provider_commissions', { method: 'PATCH', query: `id=eq.${encodeURIComponent(id)}&select=*`, body: patch, prefer: 'return=representation' });
      if (!updated?.length) return send(res, 404, { error: 'Commission introuvable.' });
      return send(res, 200, { commission: updated[0] });
    }
    if (action === 'settings.update') {
      const incoming = body.settings || {};
      const allowed = ['default_commission_rate', 'payout_trigger', 'internal_notes'];
      const rows = allowed.filter((key) => incoming[key] !== undefined).map((setting_key) => ({ setting_key, setting_value: incoming[setting_key], updated_at: new Date().toISOString() }));
      if (!rows.length) return send(res, 400, { error: 'Aucun paramètre à enregistrer.' });
      const saved = await rest('mm_finance_settings', { method: 'POST', query: 'on_conflict=setting_key&select=*', body: rows, prefer: 'resolution=merge-duplicates,return=representation' });
      return send(res, 200, { settings: saved });
    }
    return send(res, 400, { error: `Action inconnue : ${action}` });
  } catch (error) {
    const status = error.status && error.status >= 400 && error.status < 500 ? error.status : 500;
    return send(res, status, { error: error.message || 'Erreur serveur.' });
  }
};
