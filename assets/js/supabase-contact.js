(function () {
  const cfg = window.MARIAGE_SUPABASE;
  if (!cfg || !cfg.url || !cfg.anonKey || cfg.anonKey.startsWith('COLLER_')) return;

  const form = document.getElementById('contact-form');
  const status = document.getElementById('contact-status');
  const submit = document.getElementById('contact-submit');
  if (!form || !status || !submit) return;

  const show = (msg, ok) => {
    status.textContent = msg;
    status.classList.remove('hidden','text-primary','text-red-300');
    status.classList.add(ok ? 'text-primary' : 'text-red-300');
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!form.checkValidity()) { form.reportValidity(); return; }

    const data = new FormData(form);
    const payload = {
      name: String(data.get('name') || '').trim(),
      phone: String(data.get('phone') || '').trim(),
      email: String(data.get('email') || '').trim(),
      project: String(data.get('project') || '').trim(),
      destination: String(data.get('destination') || '').trim(),
      vision: String(data.get('vision') || '').trim()
    };

    submit.disabled = true;
    submit.innerHTML = 'Envoi en cours…';

    try {
      const res = await fetch(cfg.url + '/rest/v1/contact_requests', {
        method: 'POST',
        headers: {
          apikey: cfg.anonKey,
          Authorization: 'Bearer ' + cfg.anonKey,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal'
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const detail = await res.text();
        throw new Error(detail || ('HTTP ' + res.status));
      }

      form.reset();
      show('Votre demande a bien été envoyée. Nous vous contacterons rapidement.', true);
    } catch (error) {
      console.error('Supabase contact error:', error);
      show('Impossible d’envoyer la demande pour le moment. Vérifiez la configuration Supabase.', false);
    } finally {
      submit.disabled = false;
      submit.innerHTML = 'Envoyer la Demande <span class="material-symbols-outlined text-[18px]">send</span>';
    }
  });
})();
