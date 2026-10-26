/* Client Supabase partagé — Mariage Madagascar.
   Charger supabase-js v2, puis supabase-config.js, puis ce fichier. */
(function () {
  const config = window.MARIAGE_SUPABASE;

  if (!config || !config.url || !config.anonKey) {
    console.error('[Mariage Madagascar] Configuration absente. Vérifiez le chargement de /assets/js/supabase-config.js avant ce fichier.');
    return;
  }
  if (!window.supabase || typeof window.supabase.createClient !== 'function') {
    console.error('[Mariage Madagascar] Supabase JS v2 ne s’est pas chargé avant supabase-client.js.');
    return;
  }

  // Une seule instance partagée sur toutes les pages.
  if (!window.mmSupabase) {
    window.mmSupabase = window.supabase.createClient(config.url, config.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });
  }
})();
