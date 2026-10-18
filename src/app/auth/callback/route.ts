import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * /auth/callback — Supabase email link handler
 *
 * Handles two types of Supabase email links:
 *   1. Email confirmation (signup) — exchanges the token, then redirects to dashboard
 *   2. Password reset — exchanges the token, then redirects to /auth/reset-password
 *
 * Supabase sends the user here after they click a link in their email.
 * The URL contains either:
 *   - ?code=...                 (PKCE flow — new default)
 *   - #access_token=...         (implicit flow — older, handled client-side)
 *
 * Set this URL in: Supabase Dashboard → Authentication → URL Configuration
 * Allowed redirect URLs must include: http://localhost:3000/auth/callback
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const type = searchParams.get('type'); // 'recovery' for password reset
  // next param lets Supabase carry a custom redirect (e.g. for social OAuth)
  const next = searchParams.get('next') ?? '/client/dashboard';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Password reset flow → send to reset-password page
      if (type === 'recovery') {
        return NextResponse.redirect(`${origin}/auth/reset-password`);
      }

      // Email confirmation (or OAuth) → send to client dashboard
      const forwardedHost = request.headers.get('x-forwarded-host');
      const isLocalEnv = process.env.NODE_ENV === 'development';
      if (isLocalEnv) {
        return NextResponse.redirect(`${origin}${next}`);
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`);
      } else {
        return NextResponse.redirect(`${origin}${next}`);
      }
    }

    // Code exchange failed — redirect to login with error
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent('Email confirmation failed. Please try again.')}`
    );
  }

  // No code present — redirect to login
  return NextResponse.redirect(`${origin}/login`);
}
