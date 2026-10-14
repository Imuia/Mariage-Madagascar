// Vercel Edge Middleware for Server-Side Protection on /admin/* routes
import { NextResponse } from 'next/server';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://qrkinjuhtyfptldlvdyg.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFya2luanVodHlmcHRsZGx2ZHlnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA4MzY3NzUsImV4cCI6MjEwNjQxMjc3NX0.rKo326yy_QALlLVH5FfFfzyRp_J6Fd6B3EnZhbdIj9I';

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
  matcher: '/admin/:path*',
};

export async function middleware(request) {
  const url = request.nextUrl.clone();
  const path = url.pathname.toLowerCase();

  // Allow public admin auth pages
  if (
    path === '/admin/connexion.html' ||
    path === '/admin/connexion' ||
    path === '/admin/reinitialisation.html' ||
    path === '/admin/reinitialisation'
  ) {
    return NextResponse.next();
  }

  // Extract access token from cookies
  const accessToken = request.cookies.get('sb-access-token')?.value || request.cookies.get('sb:token')?.value;

  if (!accessToken) {
    const pageName = path.split('/').pop() || 'index.html';
    url.pathname = '/admin/connexion.html';
    url.searchParams.set('redirect', pageName);
    return NextResponse.redirect(url);
  }

  try {
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
      url.pathname = '/admin/connexion.html';
      url.searchParams.set('redirect', pageName);
      const response = NextResponse.redirect(url);
      response.cookies.delete('sb-access-token');
      response.cookies.delete('sb-refresh-token');
      return response;
    }

    const user = await userRes.json();
    if (!user || !user.id) {
      url.pathname = '/admin/connexion.html';
      return NextResponse.redirect(url);
    }

    // Fetch Profile Role from DB
    const profileRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${user.id}&select=role`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'apikey': SUPABASE_ANON_KEY
      }
    });

    let role = user.app_metadata?.role || user.user_metadata?.role;

    if (profileRes.ok) {
      const profiles = await profileRes.json();
      if (profiles && profiles.length > 0 && profiles[0].role) {
        role = profiles[0].role;
      }
    }

    if (!role) {
      url.pathname = '/admin/connexion.html';
      url.searchParams.set('error', 'unauthorized_role');
      return NextResponse.redirect(url);
    }

    // Check Granular Role Matrix
    const currentPage = path.split('/').pop() || 'index.html';
    const allowedPages = ROLE_PERMISSIONS[role];

    if (!allowedPages) {
      // Role not in admin list (e.g. 'client', 'provider')
      url.pathname = '/admin/connexion.html';
      url.searchParams.set('error', 'forbidden');
      return NextResponse.redirect(url);
    }

    if (!allowedPages.includes('*') && !allowedPages.includes(currentPage)) {
      // Authorized admin, but no permission for this specific page -> redirect to index.html or first allowed page
      url.pathname = '/admin/index.html';
      url.searchParams.set('error', 'page_forbidden');
      return NextResponse.redirect(url);
    }

    // User authenticated and authorized for this route -> allow request
    return NextResponse.next();
  } catch (error) {
    console.error('Middleware Auth Check Error:', error);
    url.pathname = '/admin/connexion.html';
    return NextResponse.redirect(url);
  }
}
