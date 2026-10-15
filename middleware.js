// Vercel Edge Middleware using Standard Web API & @vercel/functions
import { next } from '@vercel/functions';

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

/**
 * Creates a redirection response with mutable headers to avoid "TypeError: immutable at appendHeader"
 */
function createRedirectResponse(url, extraHeaders = []) {
  const headers = new Headers();
  headers.set('Location', url);

  if (Array.isArray(extraHeaders)) {
    extraHeaders.forEach(([name, val]) => {
      headers.append(name, val);
    });
  }

  return new Response(null, {
    status: 307,
    headers: headers
  });
}

function getSafeRedirectPage(path) {
  const rawPage = path.split('/').pop() || 'index.html';
  // Allowed admin pages
  const validPages = [
    'index.html', 'crm.html', 'sejours.html', 'mariages.html',
    'finance.html', 'paiements.html', 'facturation.html', 'commissions.html',
    'rapports.html', 'parametres.html', 'mots-de-passe.html'
  ];
  return validPages.includes(rawPage) ? rawPage : 'index.html';
}

function getClearCookiesHeaders() {
  return [
    ['Set-Cookie', 'sb-access-token=; Path=/; Max-Age=0; SameSite=Lax; Secure'],
    ['Set-Cookie', 'sb-refresh-token=; Path=/; Max-Age=0; SameSite=Lax; Secure']
  ];
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
      path.endsWith('.ico') ||
      path.endsWith('.json') ||
      path.endsWith('.woff') ||
      path.endsWith('.woff2')
    ) {
      return next();
    }

    // Extract access & refresh tokens from cookies
    const cookieHeader = request.headers.get('cookie');
    const cookies = parseCookies(cookieHeader);
    let accessToken = cookies['sb-access-token'] || cookies['sb:token'];
    const refreshToken = cookies['sb-refresh-token'];
    let newCookieHeaders = [];

    if (!accessToken && !refreshToken) {
      const pageName = getSafeRedirectPage(path);
      const loginUrl = new URL('/admin/connexion.html', request.url);
      loginUrl.searchParams.set('redirect', pageName);
      return createRedirectResponse(loginUrl.toString());
    }

    // Validate JWT access token with Supabase Auth server
    let userRes = null;
    if (accessToken) {
      try {
        userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'apikey': SUPABASE_ANON_KEY
          }
        });
      } catch (err) {
        console.warn('Error validating access token:', err);
      }
    }

    // If access token expired or missing, attempt refresh if refresh token is available
    if ((!userRes || !userRes.ok) && refreshToken) {
      try {
        const refreshRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_ANON_KEY
          },
          body: JSON.stringify({ refresh_token: refreshToken })
        });

        if (refreshRes.ok) {
          const sessionData = await refreshRes.json();
          if (sessionData && sessionData.access_token) {
            accessToken = sessionData.access_token;
            const newRefreshToken = sessionData.refresh_token || refreshToken;
            const maxAge = sessionData.expires_in || 3600;

            newCookieHeaders.push(['Set-Cookie', `sb-access-token=${accessToken}; Path=/; Max-Age=${maxAge}; SameSite=Lax; Secure`]);
            newCookieHeaders.push(['Set-Cookie', `sb-refresh-token=${newRefreshToken}; Path=/; Max-Age=604800; SameSite=Lax; Secure`]);

            // Re-verify user with new access token
            userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'apikey': SUPABASE_ANON_KEY
              }
            });
          }
        }
      } catch (refreshErr) {
        console.warn('Error refreshing token:', refreshErr);
      }
    }

    if (!userRes || !userRes.ok) {
      // Invalid or expired token, refresh failed
      const pageName = getSafeRedirectPage(path);
      const loginUrl = new URL('/admin/connexion.html', request.url);
      loginUrl.searchParams.set('redirect', pageName);

      return createRedirectResponse(loginUrl.toString(), getClearCookiesHeaders());
    }

    const user = await userRes.json();
    if (!user || !user.id) {
      const loginUrl = new URL('/admin/connexion.html', request.url);
      return createRedirectResponse(loginUrl.toString(), getClearCookiesHeaders());
    }

    // Determine role:
    // 1) App Metadata / User Metadata
    let role = user.app_metadata?.role || user.user_metadata?.role;

    // 2) Primary admin emails check
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
      return createRedirectResponse(loginUrl.toString());
    }

    // Check Role Permissions Matrix
    const currentPage = path.split('/').pop() || 'index.html';
    const allowedPages = ROLE_PERMISSIONS[role];

    if (!allowedPages) {
      const loginUrl = new URL('/admin/connexion.html', request.url);
      loginUrl.searchParams.set('error', 'forbidden');
      return createRedirectResponse(loginUrl.toString());
    }

    if (!allowedPages.includes('*') && !allowedPages.includes(currentPage)) {
      const indexUrl = new URL('/admin/index.html', request.url);
      indexUrl.searchParams.set('error', 'page_forbidden');
      return createRedirectResponse(indexUrl.toString());
    }

    // User authenticated and authorized
    const response = next();
    if (newCookieHeaders.length > 0) {
      newCookieHeaders.forEach(([name, val]) => {
        response.headers.append(name, val);
      });
    }
    return response;
  } catch (error) {
    console.error('Middleware Critical Catch Error:', error);
    const loginUrl = new URL('/admin/connexion.html', request.url);
    return createRedirectResponse(loginUrl.toString());
  }
}
