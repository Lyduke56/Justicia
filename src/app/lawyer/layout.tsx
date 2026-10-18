import React from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { LawyerShell } from '@/components/lawyer/LawyerShell';

export const metadata = {
  title: {
    template: '%s | Justicia Counsel Portal',
    default: 'Lawyer Portal | Justicia',
  },
};

/**
 * Lawyer Layout
 * Restricts access to role = 'lawyer' and renders persistent lawyer navigation shell.
 */
export default async function LawyerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login?redirectTo=/lawyer/dashboard');
  }

  // Resolve lawyer profile details
  let role = (user.user_metadata?.role as string) || '';
  let fullName = (user.user_metadata?.full_name as string) || 'Attorney';
  let rollNumber = '';
  let ibpChapter = '';
  let isVerified = false;

  try {
    const { data: userAcc } = await supabase
      .from('user_accounts')
      .select('role, full_name')
      .eq('id', user.id)
      .single() as { data: { role: string | null; full_name: string | null } | null };

    if (userAcc?.role) role = userAcc.role;
    if (userAcc?.full_name) fullName = userAcc.full_name;

    const { data: prof } = await supabase
      .from('lawyer_profiles')
      .select('roll_number, ibp_chapter, verification_status')
      .eq('user_id', user.id)
      .single() as { data: { roll_number: string | null; ibp_chapter: string | null; verification_status: string | null } | null };

    if (prof) {
      rollNumber = prof.roll_number || '';
      ibpChapter = prof.ibp_chapter || '';
      isVerified = prof.verification_status === 'approved';
    }
  } catch {
    // Continue with defaults
  }

  // If client or admin tries to view lawyer portal, redirect
  if (role !== 'lawyer') {
    redirect('/client/dashboard');
  }

  return (
    <LawyerShell
      user={{
        id: user.id,
        email: user.email,
        fullName,
        rollNumber,
        ibpChapter,
        isVerified,
      }}
    >
      {children}
    </LawyerShell>
  );
}
