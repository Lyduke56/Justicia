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

/**
 * Admin Layout
 * Restricts access to role = 'admin' and renders persistent admin navigation shell.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login?redirectTo=/admin/dashboard');
  }

  // Verify role
  let role = (user.user_metadata?.role as string) || '';
  let fullName = (user.user_metadata?.full_name as string) || 'Administrator';

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

  if (role !== 'admin') {
    redirect('/client/dashboard');
  }

  return (
    <AdminShell
      user={{
        id: user.id,
        email: user.email,
        fullName,
      }}
    >
      {children}
    </AdminShell>
  );
}
