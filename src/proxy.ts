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

  // 2. Allow public routes through without auth checks
  if (isPublicRoute(pathname)) {
    // If already authenticated, redirect away from auth pages to their dashboard
    if (user && (pathname === '/login' || pathname === '/register')) {
      const role = await getUserRole(request, user.id);
      if (role) {
        const dashboardUrl = request.nextUrl.clone();
        dashboardUrl.pathname = getDashboardForRole(role);
        return NextResponse.redirect(dashboardUrl);
      }
    }
    return supabaseResponse;
  }

  // 3. Unauthenticated users → redirect to /login
  if (!user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.searchParams.set('redirectTo', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 4. Fetch the user's role from user_accounts table
  const role = await getUserRole(request, user.id);

  if (!role) {
    // Role not found — force logout and redirect to login
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    return NextResponse.redirect(loginUrl);
  }

  // 5. Check route authorization
  if (!isAuthorizedForRoute(role, pathname)) {
    // Redirect unauthorized user to their own dashboard
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = getDashboardForRole(role);
    return NextResponse.redirect(dashboardUrl);
  }

  return supabaseResponse;
}

/**
 * Fetches the user's role from the user_accounts table.
 * NOTE: This uses a Supabase query inside middleware — keep it lightweight.
 */
async function getUserRole(
  request: NextRequest,
  userId: string
): Promise<UserRole | null> {
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
      .eq('id', userId)
      .single() as { data: { role: string } | null; error: unknown };

    return (data?.role as UserRole) ?? null;
  } catch {
    return null;
  }
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
