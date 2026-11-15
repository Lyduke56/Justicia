import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { LawyerDetailView } from '@/components/client/LawyerDetailView';
import type { PublicLawyerProfile } from '@/components/client/LawyerGrid';
import { getPublicLawyerDetailsAction, type LawyerOwnProfileDetails } from '@/app/actions/lawyerProfileActions';

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
  // Persisted About / Cases Handled data (what the lawyer edits on their own Lawyer Profile).
  let details: LawyerOwnProfileDetails | undefined;

  if (profile) {
    // NUMERIC columns can arrive as strings; keep unset values unset instead of showing sample prices.
    const fee = (v: number | string | null) => (v === null || v === undefined ? null : Number(v));
    lawyerData = {
      userId: profile.user_id,
      fullName: profile.full_name,
      rollNumber: profile.roll_number ?? '',
      ibpChapter: profile.ibp_chapter ?? '',
      practiceAreas: profile.practice_areas ?? [],
      languages: profile.languages ?? [],
      experienceYears: profile.experience_years ?? null,
      photoUrl: profile.photo_url,
      isAvailable: profile.is_available ?? true,
      feeStandard60min: fee(profile.fee_standard_60min),
      feeInitial30min: fee(profile.fee_initial_30min),
      feeExtended120min: fee(profile.fee_extended_120min),
      about: profile.about,
      barPasserYear: profile.bar_passer_year ?? null,
      isFavorite: false,
    };
    details = (await getPublicLawyerDetailsAction(profile.user_id)) ?? {
      practiceAreaDetails: [],
      experiences: [],
      services: [],
      education: [],
      caseSummaries: [],
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
    <div className="px-8 sm:px-12 lg:px-16 xl:px-20 py-6 sm:py-10 max-w-[1300px] mx-auto bg-[#E5D8CB] min-h-[calc(100vh-4rem)]">
      <LawyerDetailView lawyer={lawyerData} details={details} defaultTab="about" />
    </div>
  );
}
