import type { Metadata } from 'next';
import { connection } from 'next/server';
import { LawyerDetailView } from '@/components/client/LawyerDetailView';
import type { PublicLawyerProfile } from '@/components/client/LawyerGrid';
import { getMyLawyerProfileAction } from '@/app/actions/lawyerProfileActions';

export const metadata: Metadata = { title: 'Lawyer Profile' };

/**
 * Lawyer Portal → Lawyer Profile
 * The signed-in lawyer's own profile, rendered with the same view clients see, in "owner" mode:
 *  - About: persisted data, editable via "Edit Information" (+ update confirmation modal)
 *  - Reviews: read-only verified consultation reviews
 *  - Cases Handled: add / edit / delete via "Edit Visible Cases"
 */
const TAB_PARAM: Record<string, 'about' | 'reviews' | 'booking' | 'cases'> = {
  about: 'about',
  reviews: 'reviews',
  availability: 'booking',
  booking: 'booking',
  cases: 'cases',
};

export default async function LawyerProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const defaultTab = (tab && TAB_PARAM[tab]) || 'about';
  // Per-user page: opt out of prerendering before the loader (whose try/catch would otherwise
  // swallow Next's dynamic-rendering bailout and bake the error state into a static page).
  await connection();
  const result = await getMyLawyerProfileAction();

  if (!result.success) {
    return (
      <div className="px-8 sm:px-12 lg:px-16 xl:px-20 py-10 max-w-[1300px] mx-auto">
        <div className="neu-recessed rounded-[24px] bg-[#E5D8CB] p-8 text-center space-y-2">
          <h1 className="font-lora text-xl font-bold text-[#341512]/80">Lawyer Profile</h1>
          <p role="alert" className="text-sm text-[#341512]/70 font-inter">{result.error}</p>
        </div>
      </div>
    );
  }

  const { profile, details } = result.data;

  const lawyer: PublicLawyerProfile = {
    userId: profile.user_id,
    fullName: profile.full_name,
    rollNumber: profile.roll_number,
    ibpChapter: profile.ibp_chapter ?? '',
    practiceAreas: profile.practice_areas ?? [],
    languages: profile.languages ?? [],
    experienceYears: profile.experience_years,
    photoUrl: profile.photo_url,
    isAvailable: profile.is_available,
    feeStandard60min: profile.fee_standard_60min,
    feeInitial30min: profile.fee_initial_30min,
    feeExtended120min: profile.fee_extended_120min,
    about: profile.about,
    barPasserYear: profile.bar_passer_year,
    isFavorite: false,
  };

  return (
    <div className="px-8 sm:px-12 lg:px-16 xl:px-20 py-6 sm:py-10 max-w-[1300px] mx-auto bg-[#E5D8CB] min-h-[calc(100vh-4rem)]">
      <LawyerDetailView lawyer={lawyer} details={details} mode="owner" defaultTab={defaultTab} />
    </div>
  );
}
