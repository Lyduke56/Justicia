import React from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AdminShell } from '@/components/admin/AdminShell';

export const metadata = {
  title: {
    template: '%s | Justicia Admin',
    default: 'Admin Portal | Justicia',
  },
};

import { cookies } from 'next/headers';

/**
 * Admin Layout
 * Restricts access to role = 'admin' (or honors demo preview session) and renders persistent admin navigation shell.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const demoCookie = cookieStore.get('justicia_demo_session')?.value;
  const isDemo = demoCookie === 'admin' || demoCookie === 'true';

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !isDemo) {
    redirect('/login?redirectTo=/admin/dashboard');
  }

  // Verify role
  let role = (user?.user_metadata?.role as string) || (isDemo ? 'admin' : '');
  let fullName = (user?.user_metadata?.full_name as string) || (isDemo ? 'Atty. Rafael Mendoza' : 'Administrator');
  const userId = user?.id || 'demo-admin-id';
  const email = user?.email || 'admin.mendoza@justicia.ph';

  if (user) {
    try {
      const { data: profile } = await supabase
        .from('user_accounts')
        .select('role, full_name')
        .eq('id', user.id)
        .single() as { data: { role: string | null; full_name: string | null } | null };

      if (profile?.role) {
        role = profile.role;
      }
      if (profile?.full_name) {
        fullName = profile.full_name;
      }
    } catch {
      // Continue with metadata
    }
  }

  if (role !== 'admin' && !isDemo) {
    redirect('/client/dashboard');
  }

  return (
    <AdminShell
      user={{
        id: userId,
        email,
        fullName,
      }}
    >
      {children}
    </AdminShell>
  );
}
