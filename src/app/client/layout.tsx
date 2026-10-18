import React from 'react';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { ClientShell } from '@/components/client/ClientShell';

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
  const isDemo = cookieStore.get('justicia_demo_session')?.value === 'true';

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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
    <ClientShell
      user={{
        id: userId,
        email,
        fullName,
      }}
    >
      {children}
    </ClientShell>
  );
}
