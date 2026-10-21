import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { LawyerVerificationStatus } from '@/components/lawyer/LawyerVerificationStatus';

export const metadata: Metadata = {
  title: 'Application Status | Justicia',
  description: 'Check the status of your Justicia lawyer application.',
};

export default async function VerificationPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login?redirectTo=/lawyer/verification');
  }

  // Fetch account + profile
  const { data: account } = await supabase
    .from('user_accounts')
    .select('email, full_name, role')
    .eq('id', user.id)
    .single() as { data: { email: string; full_name: string | null; role: string } | null };

  const { data: profile } = await supabase
    .from('lawyer_profiles')
    .select('verification_status, rejection_reason, admin_notes, submitted_at, reviewed_at, full_name')
    .eq('user_id', user.id)
    .maybeSingle() as {
      data: {
        verification_status: string;
        rejection_reason: string | null;
        admin_notes: string | null;
        submitted_at: string | null;
        reviewed_at: string | null;
        full_name: string | null;
      } | null;
    };

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
