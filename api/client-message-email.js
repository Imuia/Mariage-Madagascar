function json(res, status, payload) {
  res.status(status);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  return res.json(payload);
}

function clean(value, max = 5000) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { success: false, error: 'Méthode non autorisée.' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    if (clean(body.website, 200)) return json(res, 200, { success: true });

    const subject = clean(body.subject, 160);
    const message = clean(body.message, 5000);
    if (!subject || !message) {
      return json(res, 400, { success: false, error: 'Merci de renseigner l’objet et le message.' });
    }

    const authorization = req.headers.authorization || '';
    const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
    if (!token) return json(res, 401, { success: false, error: 'Connexion requise. Reconnectez-vous.' });

    const supabaseUrl = (process.env.SUPABASE_URL || 'https://qrkinjuhtyfptldlvdyg.supabase.co').replace(/\/$/, '');
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY
      || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      || process.env.VITE_SUPABASE_ANON_KEY;
    if (!supabaseAnonKey) {
      console.error('Client message API: SUPABASE_ANON_KEY missing.');
      return json(res, 500, { success: false, error: 'Configuration de sécurité Supabase manquante.' });
    }

    const authResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: supabaseAnonKey, Authorization: `Bearer ${token}` }
    });
    const user = await authResponse.json().catch(() => ({}));
    if (!authResponse.ok || !user.id || !user.email) {
      return json(res, 401, { success: false, error: 'Votre session n’est plus valide. Reconnectez-vous.' });
    }

    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM_EMAIL || process.env.EMAIL_FROM;
    if (!apiKey || !from) {
      console.error('Client message API: Resend configuration missing.');
      return json(res, 500, { success: false, error: 'Le service e-mail n’est pas configuré.' });
    }

    const fullName = clean(user.user_metadata?.full_name || user.user_metadata?.name || user.email, 160);
    const safe = {
      subject: escapeHtml(subject),
      message: escapeHtml(message).replaceAll('\n', '<br>'),
      email: escapeHtml(user.email),
      name: escapeHtml(fullName),
      id: escapeHtml(user.id)
    };
    const receivedAt = new Date().toLocaleString('fr-FR', { timeZone: 'Indian/Antananarivo' });
    const emailHtml = `
      <div style="font-family:Arial,sans-serif;max-width:680px;margin:0 auto;background:#101827;color:#e0e8f0;padding:28px;border-radius:14px">
        <div style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#7dd3fc">Mariage Madagascar · Espace client</div>
        <h1 style="font-size:22px;margin:14px 0">Nouveau message d’un client</h1>
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <tr><td style="padding:9px;color:#9bb2c5">Client</td><td style="padding:9px">${safe.name}</td></tr>
          <tr><td style="padding:9px;color:#9bb2c5">E-mail</td><td style="padding:9px"><a href="mailto:${safe.email}" style="color:#7dd3fc">${safe.email}</a></td></tr>
          <tr><td style="padding:9px;color:#9bb2c5">Compte client</td><td style="padding:9px">${safe.id}</td></tr>
          <tr><td style="padding:9px;color:#9bb2c5">Reçu le</td><td style="padding:9px">${escapeHtml(receivedAt)}</td></tr>
        </table>
        <div style="margin-top:20px;padding:18px;background:#0b1220;border:1px solid #2a3a48;border-radius:10px">
          <div style="font-weight:700;color:#7dd3fc;margin-bottom:10px">${safe.subject}</div>
          <div style="line-height:1.7;overflow-wrap:anywhere">${safe.message}</div>
        </div>
        <p style="font-size:12px;color:#9bb2c5;margin-top:22px">Pour répondre directement au client, utilisez la fonction « Répondre » de votre messagerie.</p>
      </div>`;

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: ['info@mariage-madagascar.com', 'commercial@mariage-madagascar.com'],
        reply_to: user.email,
        subject: `Message espace client — ${subject}`,
        html: emailHtml,
        text: `Nouveau message client\n\nClient : ${fullName}\nE-mail : ${user.email}\nObjet : ${subject}\n\n${message}\n\nRépondez directement à cet e-mail pour contacter le client.`
      })
    });
    const resendResult = await resendResponse.json().catch(() => ({}));
    if (!resendResponse.ok) {
      console.error('Resend client message failed:', resendResponse.status, resendResult?.message || resendResult?.error || 'unknown_error');
      return json(res, 502, { success: false, error: 'L’envoi de l’e-mail a échoué. Merci de réessayer.' });
    }
    return json(res, 200, { success: true, message: 'Message envoyé.' });
  } catch (error) {
    console.error('Client message API error:', error?.message || error);
    return json(res, 500, { success: false, error: 'Une erreur est survenue pendant l’envoi du message.' });
  }
}
