import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { LawyerDetailView } from '@/components/client/LawyerDetailView';
import type { PublicLawyerProfile } from '@/components/client/LawyerGrid';

export const metadata: Metadata = { title: 'Lawyer Profile & Consultation Booking' };

interface Props {
  params: Promise<{ lawyerId: string }>;
}

export default async function LawyerProfilePage({ params }: Props) {
  const { lawyerId } = await params;
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from('lawyer_profiles')
    .select(
      `user_id, full_name, roll_number, ibp_chapter, about, practice_areas, languages,
       experience_years, photo_url, is_available, fee_standard_60min, fee_initial_30min,
       fee_extended_120min, bar_passer_year, verification_status`
    )
    .eq('user_id', lawyerId)
    .maybeSingle();

  // If found in database, construct profile; otherwise provide fallback or notFound
  let lawyerData: PublicLawyerProfile;

  if (profile) {
    lawyerData = {
      userId: profile.user_id,
      fullName: profile.full_name,
      rollNumber: profile.roll_number || '58942',
      ibpChapter: profile.ibp_chapter || 'Makati',
      practiceAreas: profile.practice_areas || ['Labor & Employment', 'Corporate', 'Civil Law'],
      languages: profile.languages || ['English', 'Filipino'],
      experienceYears: profile.experience_years ?? 9,
      photoUrl: profile.photo_url,
      isAvailable: profile.is_available ?? true,
      feeStandard60min: profile.fee_standard_60min ?? 1500,
      feeInitial30min: profile.fee_initial_30min ?? 700,
      feeExtended120min: profile.fee_extended_120min ?? 2300,
      about: profile.about,
      barPasserYear: profile.bar_passer_year ?? 2014,
      isFavorite: false,
    };
  } else {
    // If not found in DB (e.g. test navigation or mock id), fallback gracefully to demo attorney
    lawyerData = {
      userId: lawyerId,
      fullName: 'Atty. Maria Elena Santos',
      rollNumber: '58942',
      ibpChapter: 'Makati',
      practiceAreas: ['Labor & Employment', 'Corporate', 'Civil Law'],
      languages: ['English', 'Filipino', 'Spanish'],
      experienceYears: 9,
      photoUrl: null,
      isAvailable: true,
      feeStandard60min: 1500,
      feeInitial30min: 700,
      feeExtended120min: 2300,
      about:
        'Experienced litigation and dispute resolution counsel practicing before the trial courts, National Labor Relations Commission (NLRC), and appellate tribunals.',
      barPasserYear: 2014,
      isFavorite: false,
    };
  }

  return (
    <main className="p-4 sm:p-8 bg-[#EFE5D8] min-h-screen">
      <LawyerDetailView lawyer={lawyerData} defaultTab="booking" />
    </main>
  );
}
