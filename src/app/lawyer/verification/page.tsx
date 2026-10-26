import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { LawyerVerificationStatus } from '@/components/lawyer/LawyerVerificationStatus';

export const metadata: Metadata = {
  title: 'Application Status | Justicia',
  description: 'Check the status of your Justicia lawyer application.',
};

export default async function VerificationPage() {
  const cookieStore = await cookies();
  const demoCookie = cookieStore.get('justicia_demo_session')?.value;
  const isDemo = demoCookie === 'lawyer' || demoCookie === 'true';

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    if (isDemo) {
      return (
        <LawyerVerificationStatus
          profile={{
            verification_status: 'pending',
            rejection_reason: null,
            admin_notes: null,
            submitted_at: new Date().toISOString(),
            reviewed_at: null,
            full_name: 'Atty. Maria Santos',
          }}
          email="atty.santos@justicia.ph"
          fullName="Atty. Maria Santos"
        />
      );
    }
    redirect('/login?redirectTo=/lawyer/verification');
  }

  // Fetch account + profile concurrently in parallel
  const [accountResult, profileResult] = await Promise.all([
    supabase
      .from('user_accounts')
      .select('email, full_name, role')
      .eq('id', user.id)
      .maybeSingle(),
    supabase
      .from('lawyer_profiles')
      .select('verification_status, rejection_reason, admin_notes, submitted_at, reviewed_at, full_name')
      .eq('user_id', user.id)
      .maybeSingle(),
  ]);

  const account = accountResult.data as { email: string; full_name: string | null; role: string } | null;
  const profile = profileResult.data as {
    verification_status: string;
    rejection_reason: string | null;
    admin_notes: string | null;
    submitted_at: string | null;
    reviewed_at: string | null;
    full_name: string | null;
  } | null;

  // If approved, redirect to dashboard
  if (profile?.verification_status === 'approved') {
    redirect('/lawyer/dashboard');
  }

  return (
    <LawyerVerificationStatus
      profile={profile}
      email={account?.email ?? user.email ?? ''}
      fullName={profile?.full_name ?? account?.full_name ?? user.user_metadata?.full_name ?? ''}
    />
  );
}
