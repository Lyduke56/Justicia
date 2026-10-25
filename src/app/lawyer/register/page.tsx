import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { LawyerRegisterForm } from '@/components/lawyer/LawyerRegisterForm';

export const metadata: Metadata = {
  title: 'Apply as Verified Philippine Counsel | Justicia',
  description: 'Join Justicia’s network of licensed Philippine lawyers and Supreme Court roll members.',
};

export default async function LawyerRegisterPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // If already a lawyer with a profile, go to verification page
  if (user) {
    const { data: profile } = await supabase
      .from('lawyer_profiles')
      .select('verification_status')
      .eq('user_id', user.id)
      .maybeSingle();

    if (profile) {
      if (profile.verification_status === 'approved') {
        redirect('/lawyer/dashboard');
      }
      if (profile.verification_status === 'pending') {
        redirect('/lawyer/verification');
      }
    }
  }

  return (
    <div className="min-h-screen bg-[#EFE5D8] py-8 sm:py-12 px-4 selection:bg-[#C58B3C]/30">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Navigation Breadcrumb / Header */}
        <div className="flex items-center justify-between text-xs text-[#7D6855]">
          <Link href="/" className="hover:text-[#34150F] font-medium flex items-center gap-1.5">
            ← Return to Justicia Home
          </Link>
          <Link href="/lawyer/verification" className="text-[#99431E] hover:underline font-semibold">
            Already applied? Check Status →
          </Link>
        </div>

        {/* Hero Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full neu-plate-sm text-[#34150F] text-xs font-semibold">
            <span>⚖</span>
            <span>Philippine Bar Member Onboarding</span>
          </div>
          <h1 className="font-cormorant text-4xl sm:text-5xl font-bold text-[#34150F]">
            Join the Verified <span className="text-[#C58B3C]">Counsel Network</span>
          </h1>
          <p className="text-xs sm:text-sm text-[#7D6855] max-w-2xl mx-auto leading-relaxed">
            Expand your legal practice with AI-assisted document triage, secure client video consultations, and direct retainers with verified Philippine clients.
          </p>
        </div>

        {/* Benefits Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="neu-card-md rounded-2xl p-4 text-center space-y-1">
            <span className="text-base block">🛡</span>
            <span className="font-bold text-xs text-[#34150F] block">Supreme Court Verified</span>
            <span className="text-[10px] text-[#7D6855] block">Official IBP Chapter & Roll Number verification</span>
          </div>
          <div className="neu-card-md rounded-2xl p-4 text-center space-y-1">
            <span className="text-base block">💳</span>
            <span className="font-bold text-xs text-[#34150F] block">Guaranteed Payouts</span>
            <span className="text-[10px] text-[#7D6855] block">Escrow consultation fees settled to Philippine banks</span>
          </div>
          <div className="neu-card-md rounded-2xl p-4 text-center space-y-1">
            <span className="text-base block">🤖</span>
            <span className="font-bold text-xs text-[#34150F] block">AI Legal Assistant</span>
            <span className="text-[10px] text-[#7D6855] block">Pre-screened client case summaries before consultation</span>
          </div>
        </div>

        {/* Registration Form Card */}
        <LawyerRegisterForm existingUser={user ? { id: user.id, email: user.email ?? '' } : null} />
      </div>
    </div>
  );
}
