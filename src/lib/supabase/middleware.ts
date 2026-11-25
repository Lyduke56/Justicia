import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from '@/types/database';

/**
 * Refreshes the Supabase session inside Next.js middleware.
 * Must be called on every request so the session cookie stays valid.
 * Returns the (possibly modified) response with fresh cookies set.
 */
export async function updateSession(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-pathname', request.nextUrl.pathname);
  // One id per request, readable by server code (headers()) and returned to the caller for support.
  const requestId = /^[\w-]{8,64}$/.test(request.headers.get('x-request-id') ?? '')
    ? request.headers.get('x-request-id')!
    : crypto.randomUUID();
  requestHeaders.set('x-request-id', requestId);

  let supabaseResponse = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request: {
              headers: requestHeaders,
            },
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh the session (IMPORTANT: do not add any logic between createServerClient and getUser)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  supabaseResponse.headers.set('x-request-id', requestId);
  return { supabaseResponse, user };
}
