/* Session et protection centralisées de l'espace client. */
(async function () {
  const LOGIN = '/espace-client/login.html';
  const client = window.mmSupabase;
  if (!client) {
    console.error('[Espace client] Client Supabase indisponible.');
    return;
  }
  try {
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    if (!data.session) {
      const next = location.pathname + location.search;
      location.replace(LOGIN + '?next=' + encodeURIComponent(next));
      return;
    }
    window.mmCurrentUser = data.session.user;
    document.documentElement.dataset.authReady = 'true';
  } catch (error) {
    console.error('[Espace client] Vérification de session impossible:', error);
    const root = document.getElementById('client-auth-error');
    if (root) {
      root.hidden = false;
      root.textContent = 'Impossible de vérifier votre session. Vérifiez votre connexion puis rechargez la page.';
    }
  }
})();
