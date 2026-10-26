/* Charge le même fragment de navigation sur toutes les pages espace-client. */
(async function(){
  const root=document.getElementById('client-sidebar-root');
  if(!root) return;
  try {
    const response=await fetch('/espace-client/sidebar.html',{cache:'no-cache'});
    if(!response.ok) throw new Error('HTTP '+response.status);
    root.innerHTML=await response.text();
    const current=location.pathname.split('/').pop() || 'index.html';
    root.querySelectorAll('[data-page]').forEach(link=>{
      const active=link.dataset.page===current;
      link.classList.toggle('active',active);
      if(active) link.setAttribute('aria-current','page'); else link.removeAttribute('aria-current');
    });
    // Déconnexion réelle Supabase depuis la sidebar desktop ou mobile.
    root.querySelectorAll('[data-client-logout]').forEach(link=>{
      link.addEventListener('click', async event=>{
        event.preventDefault();
        if(link.dataset.busy === 'true') return;
        link.dataset.busy = 'true';
        const original = link.innerHTML;
        link.setAttribute('aria-busy','true');
        try {
          const client = window.mmSupabase || window.supabaseClient || window.supabase;
          if(!client) throw new Error('Service d’authentification indisponible.');
          const { error } = await client.auth.signOut({ scope: 'local' });
          if(error) throw error;
          window.location.replace('/espace-client/login.html?reason=logout');
        } catch(error) {
          console.error('[Espace client] Déconnexion impossible:', error);
          link.dataset.busy = 'false';
          link.removeAttribute('aria-busy');
          link.innerHTML = original;
          alert('La déconnexion a échoué. Vérifiez votre connexion puis réessayez.');
        }
      });
    });

    const toggle=root.querySelector('.mobile-nav-toggle');
    const mobileNav=root.querySelector('.sidebar-mobile-nav');
    if(toggle&&mobileNav){
      toggle.addEventListener('click',()=>{
        const expanded=mobileNav.classList.toggle('is-expanded');
        toggle.setAttribute('aria-expanded',String(expanded));
        const icon=toggle.querySelector('.material-symbols-outlined');
        if(icon) icon.textContent=expanded?'close':'menu';
      });
      mobileNav.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{
        mobileNav.classList.remove('is-expanded');toggle.setAttribute('aria-expanded','false');
        const icon=toggle.querySelector('.material-symbols-outlined');if(icon)icon.textContent='menu';
      }));
    }
  } catch(error) {
    console.error('Impossible de charger la sidebar commune:',error);
    root.innerHTML='<div role="alert" style="margin:12px;padding:12px;border:1px solid #70444b;color:#ffd7dc;border-radius:10px">La navigation de l’espace client n’a pas pu être chargée. Rechargez la page.</div>';
  }
})();
