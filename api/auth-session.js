/**
 * Mariage Madagascar Admin session endpoint for Vercel Node Functions.
 *
 * Routes:
 *   POST /api/auth-session { action: "set-session", accessToken, refreshToken }
 *   POST /api/auth-session { action: "logout" }
 *
 * Uses only the public Supabase anon key; never use service_role here.
 */
const SUPABASE_URL = (
  process.env.SUPABASE_URL ||
  'https://qrkinjuhtyfptldlvdyg.supabase.co'
).replace(/\/+$/, '');

const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFya2luanVodHlmcHRsZGx2ZHlnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA4MzY3NzUsImV4cCI6MjEwNjQxMjc3NX0.rKo326yy_QALlLVH5FfFfzyRp_J6Fd6B3EnZhbdIj9I";

const ADMIN_EMAILS = new Set(['info@mariage-madagascar.com']);
const ALLOWED_ADMIN_ROLES = new Set([
  'super_admin',
  'admin',
  'commercial',
  'wedding_planner',
  'travel_planner',
  'accounting',
  'support',
]);

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

function parseBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch (_) { return {}; }
  }
  return {};
}

function parseCookies(header = '') {
  const result = {};
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i < 1) continue;
    result[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  return result;
}

function readJwtSubject(token) {
  try {
    const parts = String(token || '').split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    return typeof payload.sub === 'string' ? payload.sub : null;
  } catch (_) {
    return null;
  }
}

function cookie(name, value, maxAge) {
  return `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${Math.max(0, maxAge)}; SameSite=Lax; Secure; HttpOnly`;
}

function clearCookies(res) {
  res.setHeader('Set-Cookie', [
    'sb-access-token=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax; Secure; HttpOnly',
    'sb-refresh-token=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax; Secure; HttpOnly',
  ]);
}

function isAllowedAdmin(user) {
  const email = String(user?.email || '').toLowerCase();
  const role = user?.app_metadata?.role;
  return ADMIN_EMAILS.has(email) || ALLOWED_ADMIN_ROLES.has(role);
}

module.exports = async function authSession(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { error: 'Method not allowed' });
  }

  // Reject cross-origin browser POSTs. Same-origin fetches from production
  // and Vercel preview URLs pass this check.
  const origin = req.headers.origin;
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  if (origin) {
    try {
      if (new URL(origin).host !== host) {
        return json(res, 403, { error: 'Cross-origin request refused' });
      }
    } catch (_) {
      return json(res, 403, { error: 'Invalid Origin header' });
    }
  }

  const body = parseBody(req);

  if (body.action === 'logout') {
    const existing = parseCookies(req.headers.cookie || '');
    const accessToken = existing['sb-access-token'];
    if (accessToken) {
      // Best effort: revoke the server-side session; cookie clearing must
      // still succeed if the token has already expired.
      try {
        await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${decodeURIComponent(accessToken)}`,
            apikey: SUPABASE_ANON_KEY,
          },
        });
      } catch (_) {}
    }
    clearCookies(res);
    return json(res, 200, { ok: true });
  }

  if (body.action !== 'set-session') {
    return json(res, 400, { error: 'Unsupported action' });
  }

  const accessToken = String(body.accessToken || '');
  const refreshToken = String(body.refreshToken || '');
  if (!accessToken || !refreshToken) {
    return json(res, 400, { error: 'Missing access or refresh token' });
  }

  // Bind the refresh token to the same user represented by the access token.
  // Supabase rotates the refresh token; both new tokens are then returned to
  // the browser SDK and stored in HttpOnly cookies.
  const expectedUserId = readJwtSubject(accessToken);
  if (!expectedUserId) {
    clearCookies(res);
    return json(res, 401, { error: 'Invalid session token' });
  }

  let refreshResponse;
  try {
    refreshResponse = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
  } catch (error) {
    console.error('Supabase session refresh request failed:', error);
    return json(res, 503, { error: 'Authentication service temporarily unavailable' });
  }

  if (!refreshResponse.ok) {
    clearCookies(res);
    return json(res, 401, { error: 'Session expired; please sign in again' });
  }

  const session = await refreshResponse.json();
  if (!session?.access_token || !session?.refresh_token || !session?.user?.id) {
    clearCookies(res);
    return json(res, 401, { error: 'Supabase returned an incomplete session' });
  }

  if (session.user.id !== expectedUserId) {
    clearCookies(res);
    return json(res, 401, { error: 'Access token and refresh token do not belong to the same user' });
  }

  if (!isAllowedAdmin(session.user)) {
    clearCookies(res);
    return json(res, 403, { error: 'This account is not authorized for the Admin' });
  }

  const expiresIn = Number(session.expires_in);
  const accessMaxAge = Number.isFinite(expiresIn) && expiresIn > 0 ? expiresIn : 3600;
  res.setHeader('Set-Cookie', [
    cookie('sb-access-token', session.access_token, accessMaxAge),
    cookie('sb-refresh-token', session.refresh_token, 7 * 24 * 60 * 60),
  ]);

  // Supabase JS must receive the rotated pair to keep its local session in sync.
  return json(res, 200, {
    ok: true,
    session: {
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    },
  });
};
