import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { attorneyNameOr } from '@/lib/utils/attorneyName';
import { DEMO_COOKIE, isDemoFor } from '@/lib/auth/demo';
import type { SupabaseClient } from '@supabase/supabase-js';
import { loadCurrentDocuments } from '@/lib/lawyer/documentsServer';
import { documentGaps } from '@/lib/lawyer/verification';
import { LawyerVerificationStatus } from '@/components/lawyer/LawyerVerificationStatus';

export const metadata: Metadata = {
  title: 'Application Status | Justicia',
  description: 'Check the status of your Justicia lawyer application.',
};

export default async function VerificationPage() {
  const cookieStore = await cookies();
  const isDemo = isDemoFor(cookieStore.get(DEMO_COOKIE)?.value, 'lawyer');

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

  // Approved lawyers go to their dashboard, unless they were approved before proof documents
  // were required and still have required ones to upload (they do that here).
  if (profile?.verification_status === 'approved') {
    const docs = await loadCurrentDocuments(supabase as unknown as SupabaseClient, user.id).catch(() => null);
    const missing = docs ? documentGaps(docs.map((d) => ({ docType: d.doc_type, reviewStatus: d.review_status ?? 'uploaded' }))).missing : [];
    if (missing.length === 0) redirect('/lawyer/dashboard');
  }

  return (
    <LawyerVerificationStatus
      profile={profile}
      email={account?.email ?? user.email ?? ''}
      fullName={attorneyNameOr(profile?.full_name ?? account?.full_name ?? user.user_metadata?.full_name, '')}
    />
  );
}
