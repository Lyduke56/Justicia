import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { LawyerRegisterForm } from '@/components/lawyer/LawyerRegisterForm';

export const metadata: Metadata = {
  title: 'Register as a Lawyer | Justicia',
  description: 'Apply to join Justicia as a verified Philippine lawyer.',
};

export default async function LawyerRegisterPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // ── Logged-in user checks ────────────────────────────────────────────────
  let emailUnconfirmed = false;
  let draft: Record<string, unknown> | null = null;

  if (user) {
    // Check if email is confirmed
    if (!user.email_confirmed_at) {
      emailUnconfirmed = true;
    } else {
      // Email confirmed — check existing profile
      const { data: profile } = await supabase
        .from('lawyer_profiles')
        .select('verification_status, full_name, roll_number, ibp_chapter, bar_passer_year, about, practice_areas, languages, experience_years, fee_initial_30min, fee_standard_60min, fee_extended_120min')
        .eq('user_id', user.id)
        .maybeSingle();

      if (profile) {
        if (profile.verification_status === 'approved') {
          redirect('/lawyer/dashboard');
        }
        if (profile.verification_status === 'pending') {
          redirect('/lawyer/verification');
        }
        // draft / rejected / needs_resubmission → let them continue; pre-fill form
        draft = profile as Record<string, unknown>;
      }
    }
  }

  // The form brings its own full-screen onboarding layout (rail + work area).
  return (
    <LawyerRegisterForm
      existingUser={user ? { id: user.id, email: user.email ?? '', fullName: user.user_metadata?.full_name ?? '' } : null}
      emailUnconfirmed={emailUnconfirmed}
      draft={draft}
    />
  );
}
