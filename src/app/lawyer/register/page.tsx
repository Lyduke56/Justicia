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

  // If already a lawyer with a profile, go to verification page
  if (user) {
    const { data: profile } = await supabase
      .from('lawyer_profiles')
      .select('verification_status')
      .eq('user_id', user.id)
      .maybeSingle();

    if (profile && profile.verification_status !== 'draft') {
      redirect('/lawyer/verification');
    }
  }

  return (
    <div className="min-h-screen bg-[#EFE5D8] py-10 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <h1 className="font-cormorant text-4xl font-bold text-[#34150F]">
            Register as a Verified Lawyer
          </h1>
          <p className="text-sm text-[#7D6855] max-w-xl mx-auto">
            Join Justicia&rsquo;s network of licensed Philippine lawyers. Your profile will be reviewed by our team before going live.
          </p>
        </div>
        <LawyerRegisterForm existingUser={user ? { id: user.id, email: user.email ?? '' } : null} />
      </div>
    </div>
  );
}
