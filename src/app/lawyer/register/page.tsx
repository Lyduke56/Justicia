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

  return (
    <div className="min-h-screen bg-[#E5D8CB] py-10 sm:py-14 px-4">
      <div className="max-w-3xl mx-auto space-y-8">
        <header className="text-center space-y-3">
          <p className="inline-flex items-center gap-3 font-inter text-[10.5px] font-semibold uppercase tracking-[0.26em] text-[#C58B3C]">
            <span className="h-px w-8 bg-[#C58B3C]/60" aria-hidden="true" />
            For Philippine Lawyers
            <span className="h-px w-8 bg-[#C58B3C]/60" aria-hidden="true" />
          </p>
          <h1 className="font-lora text-3xl sm:text-4xl font-semibold text-[#34150F] leading-tight">
            Register as a Verified Lawyer
          </h1>
          <p className="font-inter text-[13.5px] leading-relaxed text-[#5C4535] max-w-xl mx-auto">
            Join Justicia&rsquo;s network of licensed Philippine lawyers. Your profile will be reviewed by our team before going live.
          </p>
        </header>
        <LawyerRegisterForm
          existingUser={user ? { id: user.id, email: user.email ?? '', fullName: user.user_metadata?.full_name ?? '' } : null}
          emailUnconfirmed={emailUnconfirmed}
          draft={draft}
        />
      </div>
    </div>
  );
}
