import React from 'react';
import { redirect } from 'next/navigation';
import { headers, cookies } from 'next/headers';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { readAvatarUrl } from '@/lib/account/avatar';
import type { SupabaseClient } from '@supabase/supabase-js';
import { LawyerShell } from '@/components/lawyer/LawyerShell';
import { LiveProvider } from '@/components/live/LiveProvider';
import { liveTopicFor } from '@/lib/realtime/live';
import { DEMO_COOKIE, isDemoFor } from '@/lib/auth/demo';
import { roleFromAppMetadata } from '@/lib/auth/roles';
import { attorneyNameOr } from '@/lib/utils/attorneyName';

export const metadata = {
  title: {
    template: '%s | Justicia Counsel Portal',
    default: 'Lawyer Portal | Justicia',
  },
};

/**
 * Lawyer Layout
 * Restricts access to role = 'lawyer' (or honors demo preview session) and renders persistent lawyer navigation shell.
 */
export default async function LawyerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Read current pathname injected by proxy via updateSession()
  const headersList = await headers();
  const currentPath = headersList.get('x-pathname') ?? '';

  const isVerificationOrRegisterRoute =
    currentPath.startsWith('/lawyer/verification') ||
    currentPath.startsWith('/lawyer/register');

  // Verification and register pages are standalone flows outside the LawyerShell navigation portal.
  // Bypassing immediately eliminates all redundant layout database queries.
  if (isVerificationOrRegisterRoute) {
    return <>{children}</>;
  }

  const cookieStore = await cookies();
  // Signed-out sample portal: local development with JUSTICIA_DEMO=true only.
  const demoCookieOk = isDemoFor(cookieStore.get(DEMO_COOKIE)?.value, 'lawyer');

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // A demo cookie only matters while signed out; a real session always uses real data and checks.
  const isDemo = !user && demoCookieOk;

  if (!user && !isDemo) {
    redirect('/login?redirectTo=/lawyer/dashboard');
  }

  // Resolve lawyer profile details
  // Role: server-written app_metadata, then the user_accounts row below. Never user_metadata,
  // which users can edit themselves.
  let role: string = (user ? roleFromAppMetadata(user) : null) ?? (isDemo ? 'lawyer' : '');
  let fullName = (user?.user_metadata?.full_name as string) || (isDemo ? 'Atty. Maria Santos' : 'Attorney');
  let rollNumber = isDemo ? '78910' : '';
  let ibpChapter = isDemo ? 'Quezon City Chapter' : '';
  let isVerified = isDemo ? true : false;

  if (user) {
    try {
      const [userAccRes, profRes] = await Promise.all([
        supabase
          .from('user_accounts')
          .select('role, full_name')
          .eq('id', user.id)
          .single(),
        supabase
          .from('lawyer_profiles')
          .select('roll_number, ibp_chapter, verification_status')
          .eq('user_id', user.id)
          .single(),
      ]);

      const userAcc = userAccRes.data as { role: string | null; full_name: string | null } | null;
      const prof = profRes.data as { roll_number: string | null; ibp_chapter: string | null; verification_status: string | null } | null;

      if (userAcc?.role) role = userAcc.role;
      if (userAcc?.full_name) fullName = userAcc.full_name;
      fullName = attorneyNameOr(fullName, fullName);

      if (prof) {
        rollNumber = prof.roll_number || rollNumber;
        ibpChapter = prof.ibp_chapter || ibpChapter;
        isVerified = prof.verification_status === 'approved' || isDemo;
      }
    } catch {
      // Continue with defaults
    }
  }

  // If client or admin tries to view lawyer portal, redirect
  if (!isDemo && role !== 'lawyer') {
    redirect('/client/dashboard');
  }

  // Block unapproved lawyers from accessing portal pages
  // - If application has not been submitted yet or is draft -> send to /lawyer/register
  // - If application is submitted and pending review -> send to /lawyer/verification
  if (!isDemo && !isVerified && user) {
    const { data: statusCheck } = await supabase
      .from('lawyer_profiles')
      .select('verification_status')
      .eq('user_id', user.id)
      .maybeSingle() as { data: { verification_status: string } | null };

    if (!statusCheck || statusCheck.verification_status === 'draft') {
      redirect('/lawyer/register');
    }

    if (statusCheck.verification_status !== 'approved') {
      redirect('/lawyer/verification');
    }
  }



  // Profile photo for the top bar and account menu (the icon shows without one).
  let avatarUrl: string | null = null;
  if (user) {
    try {
      avatarUrl = await readAvatarUrl((await createServiceClient()) as unknown as SupabaseClient, user.id);
    } catch {
      avatarUrl = null;
    }
  }

  return (
    <LiveProvider topic={user ? liveTopicFor(user.id) : null}>
      <LawyerShell
        user={{
          id: user?.id || 'demo-lawyer-santos',
          email: user?.email || 'atty.santos@justicia.ph',
          fullName,
          avatarUrl,
          rollNumber,
          ibpChapter,
          isVerified,
        }}
      >
        {children}
      </LawyerShell>
    </LiveProvider>
  );
}
