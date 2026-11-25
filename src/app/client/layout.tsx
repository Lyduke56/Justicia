import React from 'react';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { ClientShell } from '@/components/client/ClientShell';
import { LiveProvider } from '@/components/live/LiveProvider';
import { liveTopicFor } from '@/lib/realtime/live';
import { DEMO_COOKIE, isDemoFor } from '@/lib/auth/demo';

export const metadata = {
  title: {
    template: '%s | Justicia Client Portal',
    default: 'Client Portal | Justicia',
  },
};

/**
 * Client Portal Layout
 * Authenticates client (or honors demo preview session) and renders persistent navigation shell.
 */
export default async function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  // Signed-out sample portal: local development with JUSTICIA_DEMO=true only.
  const demoCookieOk = isDemoFor(cookieStore.get(DEMO_COOKIE)?.value, 'client');

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // A demo cookie only matters while signed out; a real session always uses real data and checks.
  const isDemo = !user && demoCookieOk;

  if (!user && !isDemo) {
    redirect('/login?redirectTo=/client/dashboard');
  }

  // Resolve user identity
  const userId = user?.id || 'demo-clyde';
  const email = user?.email || 'clyde@justicia.ph';
  let fullName =
    (user?.user_metadata?.full_name as string) ||
    (isDemo ? 'Clyde' : user?.email?.split('@')[0] || 'Client');

  if (user) {
    try {
      const { data: profile } = await supabase
        .from('user_accounts')
        .select('full_name')
        .eq('id', user.id)
        .single() as { data: { full_name: string | null } | null };

      if (profile?.full_name) {
        fullName = profile.full_name;
      }
    } catch {
      // Continue with metadata name
    }
  }

  return (
    <LiveProvider topic={user ? liveTopicFor(user.id) : null}>
      <ClientShell
        user={{
          id: userId,
          email,
          fullName,
        }}
      >
        {children}
      </ClientShell>
    </LiveProvider>
  );
}
