/* Mariage Madagascar — configuration publique Supabase.
   IMPORTANT : utiliser uniquement une clé publishable (sb_publishable_...) ou anon legacy.
   NE JAMAIS mettre une clé service_role / secret dans le navigateur. */
window.MARIAGE_SUPABASE = {
  url: 'https://qrkinjuhtyfptldlvdyg.supabase.co',
  // Remplacez cette valeur par la clé Publishable actuelle affichée dans Supabase > Settings > API Keys.
  // La clé anon legacy précédemment communiquée est refusée par l'API en production.
  anonKey: 'sb_publishable_MT2uo1JdbfVSZAjwXqW7gg_NITLziCF'
};

/*
 * Initialisation du client partagé par les pages d'administration.
 * Le SDK @supabase/supabase-js doit être chargé avant ce fichier.
 */
(function initMariageSupabase() {
  'use strict';

  const config = window.MARIAGE_SUPABASE;
  if (!config || !config.url || !config.anonKey) {
    console.error('[Supabase] Configuration MARIAGE_SUPABASE incomplète.');
    return;
  }

  if (!window.supabase || typeof window.supabase.createClient !== 'function') {
    console.error('[Supabase] SDK non chargé. Chargez @supabase/supabase-js avant supabase-config.js.');
    return;
  }

  // Réutiliser un client déjà initialisé pour éviter les connexions en double.
  const existing = [
    window.supabaseClient,
    window.mmSupabase,
    window.sb,
    window._supabase,
    window.supabaseInstance
  ].find(client => client && typeof client.from === 'function');

  const client = existing || window.supabase.createClient(config.url, config.anonKey);

  // Exposer des alias compatibles avec les pages d'administration existantes.
  window.supabaseClient = client;
  window.mmSupabase = window.mmSupabase || client;
  window.sb = window.sb || client;
  window.supabaseInstance = window.supabaseInstance || client;
})();
