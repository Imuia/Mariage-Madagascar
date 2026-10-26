// Shared Supabase Auth and Client Helper for Espace Client Mariage Madagascar
(function() {
  const SUPABASE_URL = 'https://qrkinjuhtyfptldlvdyg.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFya2luanVodHlmcHRsZGx2ZHlnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA4MzY3NzUsImV4cCI6MjEwNjQxMjc3NX0.rKo326yy_QALlLVH5FfFfzyRp_J6Fd6B3EnZhbdIj9I';

  if (typeof window.supabase === 'undefined' && typeof supabase === 'undefined') {
    console.error('Supabase JS library missing. Please load @supabase/supabase-js beforehand.');
  }

  const supabaseClient = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;
  window.clientSupabase = supabaseClient;

  // Protect private client pages
  window.requireClientAuth = async function() {
    if (!supabaseClient) return null;
    const { data: { session }, error } = await supabaseClient.auth.getSession();

    if (error || !session) {
      window.location.href = '/espace-client/login.html';
      return null;
    }

    // Ensure profile and project exist, and auto-link guest orders
    try {
      await supabaseClient.rpc('ensure_client_profile_and_project');
    } catch (e) {
      try {
        await supabaseClient.rpc('claim_guest_orders');
      } catch (err) {
        // Ignored if RPC is not yet registered
      }
    }

    // Render user profile info if elements exist
    const user = session.user;
    const userEmailEls = document.querySelectorAll('.client-user-email');
    userEmailEls.forEach(el => el.textContent = user.email || '');

    // Bind logout buttons
    const logoutBtns = document.querySelectorAll('.client-logout-btn, #logoutBtn, a[href*="logout"]');
    logoutBtns.forEach(btn => {
      btn.onclick = async (e) => {
        e.preventDefault();
        await supabaseClient.auth.signOut();
        window.location.href = '/espace-client/login.html';
      };
    });

    return session;
  };
})();
