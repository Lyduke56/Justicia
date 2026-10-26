import { createClient } from '@/lib/supabase/server';
import { NextResponse, type NextRequest } from 'next/server';
import { getDashboardForRole, type UserRole } from '@/lib/utils/rbac';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next');

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: account } = (await supabase
          .from('user_accounts')
          .select('role')
          .eq('id', user.id)
          .single()) as { data: { role: string } | null; error: unknown };

        const role = (account?.role ?? user.user_metadata?.role ?? 'client') as UserRole;
        const target = next ?? getDashboardForRole(role);
        return NextResponse.redirect(`${origin}${target}`);
      }
      return NextResponse.redirect(`${origin}${next ?? '/'}`);
    }
  }

  // Redirect to login if exchange failed
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
