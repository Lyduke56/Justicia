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
import { DEMO_COOKIE, isDemoEnabled } from '@/lib/auth/demo';
import { safeReturnPath } from '@/lib/auth/returnPath';
import { isAppRole, roleFromAppMetadata, statusFromAppMetadata } from '@/lib/auth/roles';

/**
 * Navigation guard. It keeps signed-out users and the wrong roles out of each portal, but it is
 * not the security boundary: every Server Action and Route Handler checks the session, role and
 * account status itself (src/lib/auth/guards.ts).
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isApi = pathname.startsWith('/api/');

  // 1. Always refresh the session cookie
  const { supabaseResponse, user } = await updateSession(request);

  // Demo portals (sample data, signed out) exist only in local development with JUSTICIA_DEMO=true.
  // They never open the admin portal or any API route, and never imply a real role.
  const demoEnabled = isDemoEnabled();
  const demoParam = request.nextUrl.searchParams.get('demo');
  if (demoEnabled && !isApi && (demoParam === 'true' || demoParam === 'client' || demoParam === 'lawyer')) {
    const roleForDemo = demoParam === 'lawyer' || (demoParam === 'true' && pathname.startsWith('/lawyer')) ? 'lawyer' : 'client';
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = roleForDemo === 'lawyer' ? '/lawyer/dashboard' : '/client/dashboard';
    dashboardUrl.searchParams.delete('demo');
    const redirectRes = NextResponse.redirect(dashboardUrl);
    redirectRes.cookies.set(DEMO_COOKIE, roleForDemo, { path: '/', maxAge: 60 * 60 * 24, httpOnly: true, sameSite: 'lax' });
    return redirectRes;
  }

  // 2. Allow public routes through without auth checks
  if (isPublicRoute(pathname)) {
    // If already authenticated, redirect away from auth pages to their dashboard
    if (user && (pathname === '/login' || pathname === '/register')) {
      const role = await getUserRole(request, user);
      // Already signed in (e.g. in another tab): go straight to the page the link was for.
      const back = pathname === '/login' ? safeReturnPath(request.nextUrl.searchParams.get('redirectTo'), role) : null;
      return NextResponse.redirect(new URL(back ?? getDashboardForRole(role), request.nextUrl));
    }
    return supabaseResponse;
  }

  // Signed-out demo session: sample client and lawyer portals only (pages, never APIs).
  const demoCookie = demoEnabled ? request.cookies.get(DEMO_COOKIE)?.value : undefined;
  if (!user && demoCookie && !isApi) {
    const demoRole = demoCookie === 'lawyer' ? '/lawyer' : '/client';
    if (pathname === demoRole || pathname.startsWith(`${demoRole}/`) || (demoCookie === 'true' && (pathname.startsWith('/client') || pathname.startsWith('/lawyer')))) {
      return supabaseResponse;
    }
  }

  // 3. Unauthenticated users
  if (!user) {
    if (isApi) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    // Keep the query too (e.g. ?thread=… from an email's "Open conversation" button), so
    // sign-in can return to exactly that page.
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.search = '';
    loginUrl.searchParams.set('redirectTo', `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(loginUrl);
  }

  // 4. An account scheduled for deletion can only open the restore page until it is restored.
  if (statusFromAppMetadata(user) === 'pending_deletion' && !pathname.startsWith('/account/restore')) {
    if (isApi) {
      return NextResponse.json({ error: 'This account is scheduled for deletion.' }, { status: 423 });
    }
    const restoreUrl = request.nextUrl.clone();
    restoreUrl.pathname = '/account/restore';
    restoreUrl.search = '';
    return NextResponse.redirect(restoreUrl);
  }

  // 5. Resolve role: app_metadata (server-written) → user_accounts table → 'client' default
  const role = await getUserRole(request, user);

  // 6. Check route authorization
  if (!isAuthorizedForRoute(role, pathname)) {
    if (isApi) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = getDashboardForRole(role);
    return NextResponse.redirect(dashboardUrl);
  }

  return supabaseResponse;
}

/**
 * The user's role for routing. `app_metadata.role` is written only by the server (service-role
 * key); otherwise the user_accounts row is read. `user_metadata` is never used because users can
 * edit it themselves.
 */
async function getUserRole(
  request: NextRequest,
  user: { id: string; app_metadata?: Record<string, unknown> }
): Promise<UserRole> {
  const claimed = roleFromAppMetadata(user as { app_metadata: Record<string, unknown> });
  if (claimed) return claimed;

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

    if (isAppRole(data?.role)) {
      return data.role;
    }
  } catch {
    // Fall through to the least-privileged role
  }

  return 'client';
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
