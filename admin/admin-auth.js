/* Mariage Madagascar — Admin Authentication & Guard Module */
(function () {
  'use strict';

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

  function getCleanCurrentPath() {
    const path = window.location.pathname.split('/').pop() || 'index.html';
    return path;
  }

  function sanitizeRedirect(target) {
    if (!target) return 'index.html';
    // Remove query params or hashes for safety check
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

  async function getUserProfile(userId) {
    const client = getClient();
    if (!client || !userId) return null;

    try {
      const { data, error } = await client
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.warn('Error fetching profile from DB:', error.message);
        return null;
      }
      return data;
    } catch (err) {
      console.error('Failed profile request:', err);
      return null;
    }
  }

  async function checkAdminAuth() {
    const page = getCleanCurrentPath().toLowerCase();
    const isPublicAuthPage = (page === 'connexion.html' || page === 'reinitialisation.html');

    const client = getClient();
    if (!client) {
      console.warn('Supabase SDK not initialized yet.');
      if (!isPublicAuthPage) {
        redirectToLogin();
      }
      return null;
    }

    const { data: sessionData, error: sessionErr } = await client.auth.getSession();
    const session = sessionData ? sessionData.session : null;

    if (sessionErr || !session || !session.user) {
      if (!isPublicAuthPage) {
        redirectToLogin();
      }
      return null;
    }

    const user = session.user;
    const profile = await getUserProfile(user.id);

    // Determine admin privilege
    // 1) App Metadata or User Metadata role
    const appRole = user.app_metadata && user.app_metadata.role;
    const userRole = user.user_metadata && user.user_metadata.role;
    const profileRole = profile ? profile.role : null;

    const effectiveRole = profileRole || appRole || userRole;
    const isAdminAuthorized = ALLOWED_ADMIN_ROLES.includes(effectiveRole);

    if (isPublicAuthPage) {
      if (isAdminAuthorized) {
        const urlParams = new URLSearchParams(window.location.search);
        const redirectParam = sanitizeRedirect(urlParams.get('redirect'));
        window.location.href = redirectParam;
      }
      return { user, profile, role: effectiveRole, isAuthorized: isAdminAuthorized };
    }

    if (!isAdminAuthorized) {
      alert("Accès refusé : votre compte n'a pas les autorisations d'administrateur.");
      await client.auth.signOut();
      redirectToLogin();
      return null;
    }

    // Populate sidebar user details if elements exist
    const userNameEl = document.getElementById('mm-user-name');
    const userRoleEl = document.getElementById('mm-user-role');
    const userAvatarEl = document.getElementById('mm-user-avatar');

    if (userNameEl) {
      const name = profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() : user.email;
      userNameEl.textContent = name || 'Administrateur';
    }
    if (userRoleEl) {
      userRoleEl.textContent = effectiveRole ? effectiveRole.replace('_', ' ').toUpperCase() : 'ADMIN';
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

    const { data, error } = await client.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      throw error;
    }

    const user = data.user;
    const profile = await getUserProfile(user.id);
    const effectiveRole = (profile && profile.role) || (user.app_metadata && user.app_metadata.role) || (user.user_metadata && user.user_metadata.role);

    if (!ALLOWED_ADMIN_ROLES.includes(effectiveRole)) {
      await client.auth.signOut();
      throw new Error("Ce compte ne possède pas les privilèges administrateur.");
    }

    return data;
  }

  async function signOut() {
    const client = getClient();
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
