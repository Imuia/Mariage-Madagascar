/* Mariage Madagascar — Paramètres entreprise (Supabase) */
(() => {
  'use strict';

  const TABLE = 'mm_admin_settings';
  const SETTINGS_ID = 'company';
  const form = document.getElementById('mm-company-settings-form');
  const saveButton = document.getElementById('mm-save-company-settings');
  if (!form) return;

  const $ = (id) => document.getElementById(id);
  const toast = (message) => {
    if (typeof window.mmToast === 'function') window.mmToast(message);
    else window.alert(message);
  };

  function getClient() {
    const candidates = [
      window.supabaseClient, window.mmSupabase, window.sb,
      window._supabase, window.supabaseInstance
    ];
    const client = candidates.find((item) => item && typeof item.from === 'function');
    if (client) return client;

    const config = window.MARIAGE_SUPABASE;
    const sdk = window.supabase;
    if (config && config.url && config.anonKey && sdk && typeof sdk.createClient === 'function') {
      const created = sdk.createClient(config.url, config.anonKey);
      window.supabaseClient = created;
      window.mmSupabase = window.mmSupabase || created;
      return created;
    }
    return null;
  }

  function setForm(settings) {
    $('company_name').value = settings.company_name || 'Mariage Madagascar';
    $('contact_email').value = settings.contact_email || '';
    $('company_phone').value = settings.phone || '';
    $('company_currency').value = ['EUR', 'MGA', 'USD'].includes(settings.currency) ? settings.currency : 'EUR';
    $('company_address').value = settings.address || '';
  }

  async function loadSettings() {
    const client = getClient();
    if (!client) {
      toast('Connexion Supabase indisponible. Vérifiez supabase-config.js.');
      return;
    }
    const { data, error } = await client
      .from(TABLE)
      .select('settings')
      .eq('id', SETTINGS_ID)
      .maybeSingle();

    if (error) {
      console.error('[Paramètres Admin] Lecture Supabase impossible :', error);
      toast('Impossible de charger les paramètres. Vérifiez la migration SQL et les autorisations Supabase.');
      return;
    }
    if (data && data.settings) setForm(data.settings);
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const client = getClient();
    if (!client) {
      toast('Connexion Supabase indisponible. Aucun paramètre enregistré.');
      return;
    }

    const settings = {
      company_name: $('company_name').value.trim(),
      contact_email: $('contact_email').value.trim(),
      phone: $('company_phone').value.trim(),
      currency: $('company_currency').value,
      address: $('company_address').value.trim()
    };

    if (!settings.company_name) {
      $('company_name').focus();
      toast('Le nom commercial est obligatoire.');
      return;
    }

    const previousLabel = saveButton.textContent;
    saveButton.disabled = true;
    saveButton.textContent = 'Enregistrement…';

    try {
      const { error } = await client.from(TABLE).upsert({
        id: SETTINGS_ID,
        settings,
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' });

      if (error) throw error;
      toast('Paramètres de l’entreprise enregistrés dans Supabase.');
    } catch (error) {
      console.error('[Paramètres Admin] Enregistrement impossible :', error);
      toast('Échec de l’enregistrement. Vérifiez que la migration SQL est appliquée et que votre session est autorisée.');
    } finally {
      saveButton.disabled = false;
      saveButton.textContent = previousLabel;
    }
  });

  loadSettings();
})();
