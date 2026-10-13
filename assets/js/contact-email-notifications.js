(() => {
  'use strict';
  const form = document.getElementById('contact-form');
  const status = document.getElementById('contact-email-status');
  const submit = document.getElementById('contact-submit');
  if (!form || !status || !submit) return;

  let sending = false;
  const projectLabels = {
    wedding: 'Mariage & cérémonie',
    honeymoon: 'Lune de miel',
    proposal: 'Demande en fiançailles',
    other: 'Autre événement privé'
  };
  const destinationLabels = {
    nosy_be: 'Nosy Be & archipels',
    sainte_marie: 'Sainte-Marie',
    morondava: 'Morondava & Ouest',
    tulear: 'Tuléar & Sud',
    diego: 'Diego-Suarez'
  };

  const showStatus = (message, ok) => {
    status.textContent = message;
    status.classList.remove('hidden', 'text-primary', 'text-red-300', 'bg-primary/10', 'bg-red-500/10', 'border-primary/20', 'border-red-300/20');
    status.classList.add('border', ok ? 'text-primary' : 'text-red-300', ok ? 'bg-primary/10' : 'bg-red-500/10', ok ? 'border-primary/20' : 'border-red-300/20');
  };
  const value = (data, key) => String(data.get(key) || '').trim();

  // Capture phase: collect the values before another form handler may reset the form.
  // This is additive: it does not stop the existing Supabase contact handler from running.
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (sending) return;
    if (!form.checkValidity()) {
      form.reportValidity();
      showStatus('Merci de compléter les champs obligatoires avec des informations valides.', false);
      return;
    }

    const data = new FormData(form);
    const payload = {
      name: value(data, 'name'),
      phone: value(data, 'phone'),
      email: value(data, 'email').toLowerCase(),
      project: value(data, 'project'),
      project_label: projectLabels[value(data, 'project')] || value(data, 'project'),
      destination: value(data, 'destination'),
      destination_label: destinationLabels[value(data, 'destination')] || value(data, 'destination'),
      vision: value(data, 'vision'),
      website: value(data, 'website'),
      page_url: window.location.href
    };

    sending = true;
    submit.dataset.emailSending = 'true';
    showStatus('Transmission de votre demande à notre équipe…', true);

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.success !== true) {
        throw new Error(result.message || result.error || 'L’envoi par e-mail a échoué. Merci de réessayer.');
      }
      showStatus('Votre demande a été envoyée à info@mariage-madagascar.com et commercial@mariage-madagascar.com.', true);
    } catch (error) {
      console.error('Erreur envoi e-mail formulaire contact :', error);
      showStatus(error && error.message ? error.message : 'Impossible d’envoyer votre demande pour le moment. Merci de réessayer.', false);
    } finally {
      sending = false;
      delete submit.dataset.emailSending;
    }
  }, true);
})();
