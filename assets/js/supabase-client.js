/* Configuration Supabase partagée — Mariage Madagascar.
   Utilise uniquement la clé anon/publishable côté navigateur. Ne jamais mettre la service_role ici. */
(function () {
  const SUPABASE_URL = 'https://qrkinjuhtyfptldlvdyg.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJIUzI1NiIsInJlZiI6InFya2luanVodHlmcHRsZGx2ZHlnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA4MzY3NzUsImV4cCI6MjEwNjQxMjc3NX0.rKo326yy_QALlLVH5FfFfzyRp_J6Fd6B3EnZhbdIj9I';
  if (!window.supabase) {
    console.error('[Mariage Madagascar] Supabase JS ne s’est pas chargé.');
    return;
  }
  if (!window.mmSupabase) {
    window.mmSupabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
  }
})();
