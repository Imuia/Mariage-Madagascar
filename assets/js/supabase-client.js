/* Mariage Madagascar — client Supabase partagé, source unique = supabase-config.js */
(function () {
  const config = window.MARIAGE_SUPABASE;
  if (!config || !config.url || !config.anonKey ||
      config.anonKey === 'REMPLACER_PAR_LA_CLE_PUBLISHABLE_ACTUELLE') {
    console.error('[MM Supabase] Clé publique absente ou non configurée dans /assets/js/supabase-config.js.');
    window.mmSupabaseError = 'Configuration Supabase incomplète. Vérifiez la clé publique.';
    return;
  }
  if (!window.supabase || typeof window.supabase.createClient !== 'function') {
    console.error('[MM Supabase] Bibliothèque Supabase JS v2 absente ou non chargée.');
    window.mmSupabaseError = 'La bibliothèque Supabase ne s’est pas chargée.';
    return;
  }
  try {
    if (!window.mmSupabase) {
      window.mmSupabase = window.supabase.createClient(config.url, config.anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      });
    }
    window.mmSupabaseError = null;
  } catch (error) {
    console.error('[MM Supabase] Initialisation impossible:', error);
    window.mmSupabaseError = 'Initialisation Supabase impossible.';
  }
})();
