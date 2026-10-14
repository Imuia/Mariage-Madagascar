// Vercel Edge Middleware using Standard Web API (Request / Response)
// No Next.js or 'next/server' dependencies

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://qrkinjuhtyfptldlvdyg.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFya2luanVodHlmcHRsZGx2ZHlnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA4MzY3NzUsImV4cCI6MjEwNjQxMjc3NX0.rKo326yy_QALlLVH5FfFfzyRp_J6Fd6B3EnZhbdIj9I';

// Primary Admin email list with automatic super_admin privileges
const ADMIN_EMAILS = [
  'info@mariage-madagascar.com',
  'contact@mariage-madagascar.com',
  'admin@mariage-madagascar.com'
];

// Route Permission Matrix by Role
const ROLE_PERMISSIONS = {
  super_admin: ['*'],
  admin: ['*'],
  accounting: ['index.html', 'finance.html', 'paiements.html', 'facturation.html', 'commissions.html', 'rapports.html'],
  commercial: ['index.html', 'crm.html', 'sejours.html', 'mariages.html'],
  wedding_planner: ['index.html', 'crm.html', 'mariages.html', 'sejours.html'],
  travel_planner: ['index.html', 'crm.html', 'sejours.html'],
  support: ['index.html', 'parametres.html']
};

export const config = {
  matcher: ['/admin/:path*'],
};

function parseCookies(cookieHeader) {
  const cookies = {};
  if (!cookieHeader) return cookies;
  cookieHeader.split(';').forEach(cookie => {
    const parts = cookie.split('=');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const val = parts.slice(1).join('=').trim();
      cookies[key] = decodeURIComponent(val);
    }
  });
  return cookies;
}

export default async function middleware(request) {
  try {
    const url = new URL(request.url);
    const path = url.pathname.toLowerCase();

    // 1. ABSOLUTE TOP PRIORITY: Exclude public auth pages & static assets
    if (
      path === '/admin/connexion.html' ||
      path === '/admin/connexion' ||
      path === '/admin/reinitialisation.html' ||
      path === '/admin/reinitialisation' ||
      path.endsWith('.css') ||
      path.endsWith('.js') ||
      path.endsWith('.png') ||
      path.endsWith('.jpg') ||
      path.endsWith('.jpeg') ||
      path.endsWith('.svg') ||
      path.endsWith('.ico')
    ) {
      return; // Return void / undefined to continue to static page
    }

    // Extract access token from cookies
    const cookieHeader = request.headers.get('cookie');
    const cookies = parseCookies(cookieHeader);
    const accessToken = cookies['sb-access-token'] || cookies['sb:token'];

    if (!accessToken) {
      const pageName = path.split('/').pop() || 'index.html';
      const loginUrl = new URL('/admin/connexion.html', request.url);
      loginUrl.searchParams.set('redirect', pageName);
      return Response.redirect(loginUrl.toString(), 307);
    }

    // Validate JWT token with Supabase Auth server
    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'apikey': SUPABASE_ANON_KEY
      }
    });

    if (!userRes.ok) {
      // Invalid or expired token
      const pageName = path.split('/').pop() || 'index.html';
      const loginUrl = new URL('/admin/connexion.html', request.url);
      loginUrl.searchParams.set('redirect', pageName);

      const response = Response.redirect(loginUrl.toString(), 307);
      response.headers.append('Set-Cookie', 'sb-access-token=; Path=/; Max-Age=0; SameSite=Lax; Secure');
      response.headers.append('Set-Cookie', 'sb-refresh-token=; Path=/; Max-Age=0; SameSite=Lax; Secure');
      return response;
    }

    const user = await userRes.json();
    if (!user || !user.id) {
      const loginUrl = new URL('/admin/connexion.html', request.url);
      return Response.redirect(loginUrl.toString(), 307);
    }

    // Determine role:
    // 1) App Metadata / User Metadata / DB Profile
    let role = user.app_metadata?.role || user.user_metadata?.role;

    // 2) If user email is in official ADMIN_EMAILS list, automatically grant super_admin
    const userEmail = (user.email || '').toLowerCase();
    if (ADMIN_EMAILS.includes(userEmail)) {
      role = 'super_admin';
    }

    // 3) Query profiles table if role is not yet super_admin
    if (!role || role !== 'super_admin') {
      try {
        const profileRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${user.id}&select=role`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'apikey': SUPABASE_ANON_KEY
          }
        });

        if (profileRes.ok) {
          const profiles = await profileRes.json();
          if (Array.isArray(profiles) && profiles.length > 0 && profiles[0].role) {
            role = profiles[0].role;
          }
        }
      } catch (dbErr) {
        console.warn('Profile fetch warning in middleware:', dbErr);
      }
    }

    if (!role) {
      const loginUrl = new URL('/admin/connexion.html', request.url);
      loginUrl.searchParams.set('error', 'unauthorized_role');
      return Response.redirect(loginUrl.toString(), 307);
    }

    // Check Granular Role Matrix
    const currentPage = path.split('/').pop() || 'index.html';
    const allowedPages = ROLE_PERMISSIONS[role];

    if (!allowedPages) {
      const loginUrl = new URL('/admin/connexion.html', request.url);
      loginUrl.searchParams.set('error', 'forbidden');
      return Response.redirect(loginUrl.toString(), 307);
    }

    if (!allowedPages.includes('*') && !allowedPages.includes(currentPage)) {
      const indexUrl = new URL('/admin/index.html', request.url);
      indexUrl.searchParams.set('error', 'page_forbidden');
      return Response.redirect(indexUrl.toString(), 307);
    }

    // User authenticated and authorized for this route -> allow request
    return;
  } catch (error) {
    console.error('Middleware Critical Catch Error:', error);
    const loginUrl = new URL('/admin/connexion.html', request.url);
    return Response.redirect(loginUrl.toString(), 307);
  }
}
