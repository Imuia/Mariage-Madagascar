// Vercel Routing Middleware for the static HTML Admin.
// Uses Vercel's supported continuation helper instead of fetch(request).
import { next } from '@vercel/functions';

const SUPABASE_URL = (process.env.SUPABASE_URL || 'https://qrkinjuhtyfptldlvdyg.supabase.co').replace(/\/+$/, '');
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJIUzI1NiIsInJlZiI6InFya2luanVodHlmcHRsZGx2ZHlnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA4MzY3NzUsImV4cCI6MjEwNjQxMjc3NX0.rKo326yy_QALlLVH5FfFfzyRp_J6Fd6B3EnZhbdIj9I';

// Explicit allowlist for the primary admin accounts.
// These emails still must authenticate successfully with Supabase Auth.
const ADMIN_EMAILS = [
  'info@mariage-madagascar.com',
  'contact@mariage-madagascar.com',
  'admin@mariage-madagascar.com',
];

const ROLE_PERMISSIONS = {
  super_admin: ['*'],
  admin: ['*'],
  accounting: ['index.html', 'finance.html', 'paiements.html', 'facturation.html', 'commissions.html', 'rapports.html'],
  commercial: ['index.html', 'crm.html', 'sejours.html', 'mariages.html'],
  wedding_planner: ['index.html', 'crm.html', 'mariages.html', 'sejours.html'],
  travel_planner: ['index.html', 'crm.html', 'sejours.html'],
  support: ['index.html', 'parametres.html'],
};

export const config = {
  matcher: ['/admin/:path*'],
};

const PUBLIC_ADMIN_PATHS = new Set([
  '/admin/connexion.html',
  '/admin/connexion',
  '/admin/reinitialisation.html',
  '/admin/reinitialisation',
]);
const PUBLIC_ASSET_EXTENSIONS = new Set([
  '.css', '.js', '.png', '.jpg', '.jpeg', '.svg', '.ico', '.webp', '.woff', '.woff2', '.map',
]);

function parseCookies(cookieHeader = '') {
  const cookies = {};
  for (const item of cookieHeader.split(';')) {
    const separator = item.indexOf('=');
    if (separator < 1) continue;
    const name = item.slice(0, separator).trim();
    const rawValue = item.slice(separator + 1).trim();
    try {
      cookies[name] = decodeURIComponent(rawValue);
    } catch {
      cookies[name] = rawValue;
    }
  }
  return cookies;
}

function accessCookie(value, maxAge = 3600) {
  return `sb-access-token=${encodeURIComponent(value)}; Path=/; Max-Age=${Math.max(0, maxAge)}; SameSite=Lax; Secure; HttpOnly`;
}

function refreshCookie(value, maxAge = 604800) {
  return `sb-refresh-token=${encodeURIComponent(value)}; Path=/; Max-Age=${Math.max(0, maxAge)}; SameSite=Lax; Secure; HttpOnly`;
}

function expiredCookie(name) {
  return `${name}=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax; Secure; HttpOnly`;
}

function appendCookies(headers, cookieStrings = []) {
  for (const cookie of cookieStrings) headers.append('Set-Cookie', cookie);
  return headers;
}

function redirectResponse(request, pathname, query = {}, cookies = []) {
  const target = new URL(pathname, request.url);
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') target.searchParams.set(key, String(value));
  }

  // Do not use Response.redirect(): its headers may be immutable in this runtime.
  const headers = new Headers();
  headers.set('Location', target.toString());
  headers.set('Cache-Control', 'no-store');
  appendCookies(headers, cookies);
  return new Response(null, { status: 307, headers });
}

function continueRequest(cookies = []) {
  if (!cookies.length) return next();
  const headers = new Headers();
  appendCookies(headers, cookies);
  return next({ headers });
}

function requestedPageName(pathname) {
  const lastSegment = pathname.split('/').filter(Boolean).pop() || 'index.html';
  // Only permit a simple local filename as the return target.
  return /^[a-z0-9][a-z0-9-]*\.html$/i.test(lastSegment) ? lastSegment : 'index.html';
}

function isPublicAsset(pathname) {
  const filename = pathname.split('/').pop() || '';
  const dot = filename.lastIndexOf('.');
  const extension = dot >= 0 ? filename.slice(dot).toLowerCase() : '';
  return PUBLIC_ASSET_EXTENSIONS.has(extension);
}

async function getSupabaseUser(accessToken) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: SUPABASE_ANON_KEY,
    },
  });

  if (response.status === 401 || response.status === 403) return null;
  if (!response.ok) throw new Error(`Supabase user validation failed (${response.status})`);

  const user = await response.json();
  return user && user.id ? user : null;
}

async function refreshSupabaseSession(refreshToken) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  if (response.status === 400 || response.status === 401) return null;
  if (!response.ok) throw new Error(`Supabase session refresh failed (${response.status})`);

  const session = await response.json();
  if (!session?.access_token || !session?.refresh_token) return null;
  return session;
}

function sessionCookies(session) {
  const expiresIn = Number(session.expires_in);
  const accessMaxAge = Number.isFinite(expiresIn) && expiresIn > 0 ? expiresIn : 3600;
  return [accessCookie(session.access_token, accessMaxAge), refreshCookie(session.refresh_token, 604800)];
}

export default async function middleware(request) {
  const url = new URL(request.url);
  const path = url.pathname.toLowerCase();

  // Authentication pages and their assets must remain accessible without a session.
  if (PUBLIC_ADMIN_PATHS.has(path) || isPublicAsset(path)) {
    return next();
  }

  try {
    const cookies = parseCookies(request.headers.get('cookie') || '');
    let accessToken = cookies['sb-access-token'] || cookies['sb:token'] || '';
    let refreshToken = cookies['sb-refresh-token'] || '';
    let user = null;
    let renewedCookies = [];

    if (accessToken) {
      user = await getSupabaseUser(accessToken);
    }

    // Renew an expired/missing access token when a refresh token is available.
    if (!user && refreshToken) {
      const session = await refreshSupabaseSession(refreshToken);
      if (session) {
        accessToken = session.access_token;
        refreshToken = session.refresh_token;
        renewedCookies = sessionCookies(session);
        user = await getSupabaseUser(accessToken);
      }
    }

    const page = requestedPageName(path);
    if (!user) {
      const clearCookies = (cookies['sb-access-token'] || cookies['sb:token'] || cookies['sb-refresh-token'])
        ? [expiredCookie('sb-access-token'), expiredCookie('sb-refresh-token')]
        : [];
      return redirectResponse(
        request,
        '/admin/connexion.html',
        { redirect: page },
        clearCookies,
      );
    }

    // Only trust app_metadata for assigned roles; user_metadata is user-editable.
    let role = user.app_metadata?.role || null;

    // An authenticated account on this explicit allowlist is the configured primary admin.
    const userEmail = (user.email || '').toLowerCase();
    if (ADMIN_EMAILS.includes(userEmail)) role = 'super_admin';

    // Older/other roles may be stored in profiles. Fail closed if the table is absent/unavailable.
    if (!role) {
      try {
        const profileRes = await fetch(
          `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=role`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              apikey: SUPABASE_ANON_KEY,
            },
          },
        );
        if (profileRes.ok) {
          const profiles = await profileRes.json();
          if (Array.isArray(profiles) && profiles.length && profiles[0]?.role) role = profiles[0].role;
        } else if (profileRes.status >= 500) {
          throw new Error(`Supabase profile lookup failed (${profileRes.status})`);
        }
      } catch (error) {
        console.warn('Admin role lookup unavailable:', error);
      }
    }

    if (!role || !ROLE_PERMISSIONS[role]) {
      return redirectResponse(
        request,
        '/admin/connexion.html',
        { error: 'forbidden' },
        [...renewedCookies, expiredCookie('sb-access-token'), expiredCookie('sb-refresh-token')],
      );
    }

    const allowedPages = ROLE_PERMISSIONS[role];
    if (!allowedPages.includes('*') && !allowedPages.includes(page)) {
      return redirectResponse(
        request,
        '/admin/index.html',
        { error: 'page_forbidden' },
        renewedCookies,
      );
    }

    return continueRequest(renewedCookies);
  } catch (error) {
    // Fail closed. Avoid turning a temporary auth/backend problem into an unhandled 500.
    console.error('Admin middleware authentication error:', error);
    return new Response('Service d’authentification temporairement indisponible. Réessayez dans un instant.', {
      status: 503,
      headers: new Headers({
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
      }),
    });
  }
}
