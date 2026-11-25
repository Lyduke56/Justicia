import { createClient, createServiceClient } from '@/lib/supabase/server';
import { NextResponse, type NextRequest } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getDashboardForRole } from '@/lib/utils/rbac';
import { readDatabaseRole, roleFromAppMetadata, syncAuthClaims } from '@/lib/auth/roles';

/** Only same-site paths ("/client/…"), never "//evil.example" or absolute URLs. */
function safeNext(next: string | null): string | null {
  return next && next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/\\') ? next : null;
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = safeNext(searchParams.get('next'));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        // Role from the server-written claim or the database, never user-editable metadata.
        let role = roleFromAppMetadata(user);
        if (!role) {
          const db = (await createServiceClient()) as unknown as SupabaseClient;
          role = (await readDatabaseRole(db, user.id)) ?? 'client';
          await syncAuthClaims(db, user.id, { role });
        }
        const target = next ?? getDashboardForRole(role);
        return NextResponse.redirect(`${origin}${target}`);
      }
      return NextResponse.redirect(`${origin}${next ?? '/'}`);
    }
  }

  // Redirect to login if exchange failed
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
