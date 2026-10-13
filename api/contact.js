function text(value, max = 4000) {
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

function json(res, status, payload) {
  res.status(status);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  return res.json(payload);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { success: false, error: 'Méthode non autorisée.' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});

    // Honeypot antispam : répondre comme si l'envoi avait réussi, sans envoyer de mail.
    if (text(body.website, 200)) {
      return json(res, 200, { success: true });
    }

    const name = text(body.name, 160);
    const phone = text(body.phone, 80);
    const email = text(body.email, 254).toLowerCase();
    const project = text(body.project_label || body.project, 160);
    const destination = text(body.destination_label || body.destination, 160);
    const vision = text(body.vision, 5000);
    const pageUrl = text(body.page_url, 1000);

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!name || !phone || !emailRegex.test(email) || !project || !destination || !vision) {
      return json(res, 400, { success: false, error: 'Merci de vérifier tous les champs obligatoires.' });
    }

    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM_EMAIL || process.env.EMAIL_FROM;
    if (!apiKey || !from) {
      console.error('Contact mail config missing:', {
        RESEND_API_KEY: Boolean(apiKey),
        RESEND_FROM_EMAIL_or_EMAIL_FROM: Boolean(from)
      });
      return json(res, 500, {
        success: false,
        error: 'Le service d’envoi d’e-mails n’est pas configuré. Merci de nous contacter directement par e-mail.'
      });
    }

    const safe = {
      name: escapeHtml(name),
      phone: escapeHtml(phone),
      email: escapeHtml(email),
      project: escapeHtml(project),
      destination: escapeHtml(destination),
      vision: escapeHtml(vision).replaceAll('\n', '<br>'),
      pageUrl: escapeHtml(pageUrl)
    };
    const now = new Date().toLocaleString('fr-FR', { timeZone: 'Indian/Antananarivo' });
    const subject = `Nouvelle demande de contact — ${project} — ${name}`;

    const html = `
      <div style="font-family:Inter,Arial,sans-serif;max-width:700px;margin:0 auto;background:#0a0e1a;color:#e0e8f0;padding:28px;border-radius:16px">
        <div style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#7dd3fc">Mariage Madagascar</div>
        <h1 style="font-size:24px;margin:10px 0 8px;color:#e0e8f0">Nouvelle demande de contact</h1>
        <p style="color:#a0b4c4;margin-top:0">Un formulaire vient d’être envoyé depuis le site.</p>
        <table style="width:100%;border-collapse:collapse;margin-top:20px">
          <tr><td style="padding:10px;border-bottom:1px solid #2a3a48;color:#a0b4c4;width:180px">Nom complet</td><td style="padding:10px;border-bottom:1px solid #2a3a48">${safe.name}</td></tr>
          <tr><td style="padding:10px;border-bottom:1px solid #2a3a48;color:#a0b4c4">Téléphone</td><td style="padding:10px;border-bottom:1px solid #2a3a48">${safe.phone}</td></tr>
          <tr><td style="padding:10px;border-bottom:1px solid #2a3a48;color:#a0b4c4">E-mail du client</td><td style="padding:10px;border-bottom:1px solid #2a3a48"><a href="mailto:${safe.email}" style="color:#7dd3fc">${safe.email}</a></td></tr>
          <tr><td style="padding:10px;border-bottom:1px solid #2a3a48;color:#a0b4c4">Nature du projet</td><td style="padding:10px;border-bottom:1px solid #2a3a48">${safe.project}</td></tr>
          <tr><td style="padding:10px;border-bottom:1px solid #2a3a48;color:#a0b4c4">Destination souhaitée</td><td style="padding:10px;border-bottom:1px solid #2a3a48">${safe.destination}</td></tr>
          ${safe.pageUrl ? `<tr><td style="padding:10px;border-bottom:1px solid #2a3a48;color:#a0b4c4">Page source</td><td style="padding:10px;border-bottom:1px solid #2a3a48;word-break:break-word">${safe.pageUrl}</td></tr>` : ''}
        </table>
        <div style="margin-top:20px;padding:16px;background:#111828;border:1px solid #2a3a48;border-radius:10px">
          <div style="color:#7dd3fc;font-weight:700;margin-bottom:8px">Votre vision / message</div>
          <div style="line-height:1.7;overflow-wrap:anywhere">${safe.vision}</div>
        </div>
        <p style="font-size:12px;color:#8092a4;margin-top:22px">Reçu le ${escapeHtml(now)}. Pour répondre au client, utilisez son adresse e-mail ci-dessus.</p>
      </div>`;

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from,
        to: ['info@mariage-madagascar.com', 'commercial@mariage-madagascar.com'],
        reply_to: email,
        subject,
        html
      })
    });

    const resendResult = await resendResponse.json().catch(() => ({}));
    if (!resendResponse.ok) {
      console.error('Resend contact send failed:', resendResponse.status, resendResult?.message || resendResult?.error || 'unknown_error');
      return json(res, 502, { success: false, error: 'L’envoi de l’e-mail a échoué. Merci de réessayer dans quelques instants.' });
    }

    return json(res, 200, { success: true, message: 'Demande envoyée.' });
  } catch (error) {
    console.error('Contact API error:', error && error.message ? error.message : error);
    return json(res, 500, { success: false, error: 'Une erreur est survenue pendant l’envoi de votre demande.' });
  }
}
