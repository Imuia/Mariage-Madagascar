/* Mariage Madagascar — Admin Authentication & Guard Module */
(function () {
  'use strict';

  // Primary Admin email list with automatic super_admin privileges
  const ADMIN_EMAILS = ['info@mariage-madagascar.com'];

  // Allowed admin roles according to schema.sql profiles table constraint:
  // ('super_admin', 'admin', 'commercial', 'wedding_planner', 'travel_planner', 'accounting', 'support')
  const ALLOWED_ADMIN_ROLES = [
    'super_admin',
    'admin',
    'commercial',
    'wedding_planner',
    'travel_planner',
    'accounting',
    'support'
  ];

  // Role permissions matrix
  const ROLE_PERMISSIONS = {
    super_admin: ['*'],
    admin: ['*'],
    accounting: ['index.html', 'finance.html', 'paiements.html', 'facturation.html', 'commissions.html', 'rapports.html'],
    commercial: ['index.html', 'crm.html', 'sejours.html', 'mariages.html'],
    wedding_planner: ['index.html', 'crm.html', 'mariages.html', 'sejours.html'],
    travel_planner: ['index.html', 'crm.html', 'sejours.html'],
    support: ['index.html', 'parametres.html']
  };

  function getSupabaseConfig() {
    if (window.MARIAGE_SUPABASE && window.MARIAGE_SUPABASE.url && window.MARIAGE_SUPABASE.anonKey) {
      return window.MARIAGE_SUPABASE;
    }
    return {
      url: 'https://qrkinjuhtyfptldlvdyg.supabase.co',
      anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFya2luanVodHlmcHRsZGx2ZHlnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA4MzY3NzUsImV4cCI6MjEwNjQxMjc3NX0.rKo326yy_QALlLVH5FfFfzyRp_J6Fd6B3EnZhbdIj9I'
    };
  }

  let supabaseClient = null;

  function getClient() {
    if (supabaseClient) return supabaseClient;
    if (window.supabase && typeof window.supabase.createClient === 'function') {
      const cfg = getSupabaseConfig();
      supabaseClient = window.supabase.createClient(cfg.url, cfg.anonKey);
      return supabaseClient;
    }
    return null;
  }

  async function syncServerSession(accessToken, refreshToken, isLogout = false) {
    const response = await fetch('/api/auth-session', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(isLogout
        ? { action: 'logout' }
        : { action: 'set-session', accessToken, refreshToken })
    });

    let payload = {};
    try {
      payload = await response.json();
    } catch (_) {
      // A non-JSON response is reported below with its HTTP status.
    }

    if (!response.ok) {
      throw new Error(payload.error || `Synchronisation de session impossible (${response.status}).`);
    }

    // The server rotates/validates the refresh token and writes matching
    // HttpOnly cookies. Persist the returned pair in Supabase JS as well.
    if (!isLogout && payload.session && payload.session.access_token && payload.session.refresh_token) {
      const client = getClient();
      if (client) {
        const { error } = await client.auth.setSession({
          access_token: payload.session.access_token,
          refresh_token: payload.session.refresh_token
        });
        if (error) throw error;
      }
    }

    // Clear any older non-HttpOnly cookies left by previous versions.
    if (isLogout) {
      document.cookie = 'sb-access-token=; path=/; max-age=0; SameSite=Lax; Secure';
      document.cookie = 'sb-refresh-token=; path=/; max-age=0; SameSite=Lax; Secure';
    }

    return payload;
  }

  function getCleanCurrentPath() {
    const path = window.location.pathname.split('/').pop() || 'index.html';
    return path;
  }

  function sanitizeRedirect(target) {
    if (!target) return 'index.html';
    const cleanName = target.split('?')[0].split('#')[0].toLowerCase();
    const validPages = [
      'index.html',
      'crm.html',
      'sejours.html',
      'mariages.html',
      'finance.html',
      'paiements.html',
      'facturation.html',
      'commissions.html',
      'rapports.html',
      'parametres.html'
    ];
    if (validPages.includes(cleanName)) {
      return target;
    }
    return 'index.html';
  }


  async function checkAdminAuth() {
    const page = getCleanCurrentPath().toLowerCase();
    const isPublicAuthPage = (page === 'connexion.html' || page === 'reinitialisation.html');

    const client = getClient();
    if (!client) {
      if (!isPublicAuthPage) redirectToLogin();
      return null;
    }

    const { data: sessionData, error: sessionErr } = await client.auth.getSession();
    const session = sessionData ? sessionData.session : null;

    if (sessionErr || !session || !session.user) {
      try {
        await syncServerSession(null, null, true);
      } catch (error) {
        console.warn('Session serveur déjà absente ou indisponible:', error.message);
      }
      if (!isPublicAuthPage) redirectToLogin();
      return null;
    }

    const user = session.user;
    const userEmail = (user.email || '').toLowerCase();

    // The primary account uses a server-side email allowlist. Avoid querying the
    // absent public.profiles table for this account.
    const profile = null; // This project does not currently have public.profiles.
    let effectiveRole = ADMIN_EMAILS.includes(userEmail)
      ? 'super_admin'
      : ((user.app_metadata && user.app_metadata.role) || null);

    const isAdminAuthorized = ALLOWED_ADMIN_ROLES.includes(effectiveRole);

    if (!isAdminAuthorized) {
      try { await syncServerSession(null, null, true); } catch (_) {}
      try { await client.auth.signOut(); } catch (e) { console.warn('SignOut error:', e); }
      if (!isPublicAuthPage) {
        alert("Accès refusé : votre compte n'a pas les autorisations d'administrateur.");
        redirectToLogin();
      }
      return { user, profile, role: effectiveRole, isAuthorized: false };
    }

    // Keep server cookies synchronized. If this fails on an already-open
    // protected page, report it without creating a redirect loop.
    try {
      await syncServerSession(session.access_token, session.refresh_token, false);
    } catch (error) {
      console.error('Synchronisation de session serveur impossible:', error);
      if (isPublicAuthPage) {
        const message = document.getElementById('auth-error') || document.getElementById('login-error');
        if (message) message.textContent = "Connexion établie, mais la session serveur n'a pas pu être synchronisée. Rechargez la page ou contactez l'administrateur.";
      }
    }

    if (page === 'connexion.html') {
      const urlParams = new URLSearchParams(window.location.search);
      const redirectParam = sanitizeRedirect(urlParams.get('redirect'));
      window.location.replace(redirectParam);
      return { user, profile, role: effectiveRole, isAuthorized: true };
    }

    // Keep authorized users on the password-reset page so they can set the new password.
    if (page === 'reinitialisation.html') {
      return { user, profile, role: effectiveRole, isAuthorized: true };
    }

    const allowedPages = ROLE_PERMISSIONS[effectiveRole];
    if (allowedPages && !allowedPages.includes('*') && !allowedPages.includes(page)) {
      alert(`Accès restreint : le rôle ${effectiveRole} n'a pas accès à la page ${page}.`);
      window.location.href = 'index.html';
      return null;
    }

    const userNameEl = document.getElementById('mm-user-name');
    const userRoleEl = document.getElementById('mm-user-role');
    const userAvatarEl = document.getElementById('mm-user-avatar');

    if (userNameEl) {
      const name = profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() : user.email;
      userNameEl.textContent = name || 'Administrateur';
    }
    if (userRoleEl) {
      userRoleEl.textContent = effectiveRole ? effectiveRole.replace('_', ' ').toUpperCase() : 'SUPER ADMIN';
    }
    if (userAvatarEl && profile && profile.avatar_url) {
      userAvatarEl.src = profile.avatar_url;
    }

    return { user, profile, role: effectiveRole, isAuthorized: true };
  }

  function redirectToLogin() {
    const currentPath = getCleanCurrentPath();
    if (currentPath === 'connexion.html' || currentPath === 'reinitialisation.html') return;
    const redirectUrl = `connexion.html?redirect=${encodeURIComponent(currentPath)}`;
    window.location.href = redirectUrl;
  }

  async function signIn(email, password) {
    const client = getClient();
    if (!client) throw new Error('Client Supabase non disponible.');

    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;

    const user = data.user;
    const userEmail = (user.email || '').toLowerCase();
    // Do not query public.profiles: the current Supabase project does not have it.
    const effectiveRole = ADMIN_EMAILS.includes(userEmail)
      ? 'super_admin'
      : ((user.app_metadata && user.app_metadata.role) || null);

    if (!ALLOWED_ADMIN_ROLES.includes(effectiveRole)) {
      try { await syncServerSession(null, null, true); } catch (_) {}
      try { await client.auth.signOut(); } catch (_) {}
      throw new Error("Ce compte ne possède pas les privilèges administrateur.");
    }

    if (!data.session) {
      throw new Error("Supabase n'a pas fourni de session de connexion.");
    }

    try {
      await syncServerSession(data.session.access_token, data.session.refresh_token, false);
    } catch (syncError) {
      try { await client.auth.signOut(); } catch (_) {}
      throw new Error(`Connexion authentifiée, mais synchronisation serveur échouée : ${syncError.message}`);
    }

    return data;
  }

  async function signOut() {
    const client = getClient();
    try {
      await syncServerSession(null, null, true);
    } catch (e) {
      console.warn('Server cookie cleanup warning:', e.message);
    }
    if (client) {
      try {
        await client.auth.signOut();
      } catch (e) {
        console.error('SignOut error:', e);
      }
    }
    window.location.href = 'connexion.html';
  }

  async function resetPasswordForEmail(email) {
    const client = getClient();
    if (!client) throw new Error('Client Supabase non disponible.');

    const redirectTo = `${window.location.origin}/admin/reinitialisation.html`;
    const { data, error } = await client.auth.resetPasswordForEmail(email, {
      redirectTo
    });

    if (error) throw error;
    return data;
  }

  async function updatePassword(newPassword) {
    const client = getClient();
    if (!client) throw new Error('Client Supabase non disponible.');

    const { data, error } = await client.auth.updateUser({
      password: newPassword
    });

    if (error) throw error;
    return data;
  }

  window.MMAdminAuth = {
    checkAdminAuth,
    signIn,
    signOut,
    resetPasswordForEmail,
    updatePassword,
    getClient
  };

  // Run Auth Check on Load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkAdminAuth);
  } else {
    checkAdminAuth();
  }
})();
