import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';
import { createServerClient } from '@supabase/ssr';
import type { Database } from '@/types/database';
import type { UserRole } from '@/types/database';
import {
  isPublicRoute,
  getDashboardForRole,
  isAuthorizedForRoute,
} from '@/lib/utils/rbac';

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Always refresh the session cookie
  const { supabaseResponse, user } = await updateSession(request);

  // Demo session check (enables viewing Figma mockup experience as 'Clyde' or lawyer 'Atty. Santos')
  const demoParam = request.nextUrl.searchParams.get('demo');
  const hasDemoParam = demoParam === 'true' || demoParam === 'client' || demoParam === 'lawyer';
  const demoCookie = request.cookies.get('justicia_demo_session')?.value;
  const hasDemoCookie = Boolean(demoCookie);

  if (hasDemoParam) {
    const isLawyer = demoParam === 'lawyer' || pathname.startsWith('/lawyer');
    const roleForDemo = isLawyer ? 'lawyer' : 'client';
    const targetPath = isLawyer ? '/lawyer/dashboard' : '/client/dashboard';

    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = targetPath;
    dashboardUrl.searchParams.delete('demo');
    const redirectRes = NextResponse.redirect(dashboardUrl);
    redirectRes.cookies.set('justicia_demo_session', roleForDemo, { path: '/', maxAge: 60 * 60 * 24 });
    return redirectRes;
  }

  // 2. Allow public routes through without auth checks
  if (isPublicRoute(pathname)) {
    // If already authenticated, redirect away from auth pages to their dashboard
    if (user && (pathname === '/login' || pathname === '/register')) {
      const role = resolveRole(user);
      const dashboardUrl = request.nextUrl.clone();
      dashboardUrl.pathname = getDashboardForRole(role);
      return NextResponse.redirect(dashboardUrl);
    }
    return supabaseResponse;
  }

  // Allow demo session through for client routes, lawyer routes, and API routes
  if (!user && hasDemoCookie && (pathname.startsWith('/client') || pathname.startsWith('/lawyer') || pathname.startsWith('/api/'))) {
    return supabaseResponse;
  }

  // 3. Unauthenticated users
  if (!user) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.searchParams.set('redirectTo', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 4. Resolve role: user_accounts table → user_metadata fallback → 'client' default
  const role = await getUserRole(request, user);

  // 5. Check route authorization
  if (!isAuthorizedForRoute(role, pathname)) {
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = getDashboardForRole(role);
    return NextResponse.redirect(dashboardUrl);
  }

  return supabaseResponse;
}

/**
 * Extracts role from JWT user_metadata (no DB call).
 * Safe because user_metadata is signed by Supabase.
 */
function resolveRole(user: { user_metadata?: Record<string, unknown> }): UserRole {
  const meta = user.user_metadata?.role as string | undefined;
  if (meta && ['client', 'lawyer', 'admin'].includes(meta)) {
    return meta as UserRole;
  }
  return 'client';
}

/**
 * Fetches role from user_accounts table; falls back to JWT metadata then 'client'.
 * Never returns null — always resolves a valid role for an authenticated user.
 */
async function getUserRole(
  request: NextRequest,
  user: { id: string; user_metadata?: Record<string, unknown> }
): Promise<UserRole> {
  try {
    const supabase = createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll() {
            // Read-only in this context
          },
        },
      }
    );

    const { data } = await supabase
      .from('user_accounts')
      .select('role')
      .eq('id', user.id)
      .single() as { data: { role: string } | null; error: unknown };

    if (data?.role && ['client', 'lawyer', 'admin'].includes(data.role)) {
      return data.role as UserRole;
    }
  } catch {
    // Fall through to metadata fallback
  }

  // Fallback: role from JWT user_metadata (set during signUp)
  return resolveRole(user);
}

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, sitemap.xml, robots.txt
     * - Public assets (images, fonts, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
