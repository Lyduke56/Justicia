import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { LawyerProfileView } from '@/components/lawyer/views/LawyerProfileView';

export const metadata: Metadata = {
  title: 'Counsel Profile Editor | Justicia Counsel',
  description: 'Manage Supreme Court Bar credentials, practice areas, and consultation fees.',
};

export default async function LawyerProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let fullName = (user?.user_metadata?.full_name as string) || 'Atty. Maria Santos';
  let email = user?.email || 'atty.santos@justicia.ph';
  let rollNumber = '78910';
  let ibpChapter = 'Quezon City Chapter';
  let barPasserYear = '2016';
  let about = 'Senior practicing attorney with a decade of expertise in Philippine labor relations, civil disputes, and corporate compliance.';
  let practiceAreas: string[] = ['Labor & Employment', 'Civil Litigation', 'Corporate & Commercial', 'Family & Custody Law'];
  let feeInitial = 1500;
  let feeStandard = 2500;
  let feeExtended = 4500;

  if (user) {
    try {
      const { data: prof } = await supabase
        .from('lawyer_profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (prof) {
        if (prof.full_name) fullName = prof.full_name;
        if (prof.roll_number) rollNumber = prof.roll_number;
        if (prof.ibp_chapter) ibpChapter = prof.ibp_chapter;
        if (prof.bar_passer_year) barPasserYear = String(prof.bar_passer_year);
        if (prof.about) about = prof.about;
        if (prof.practice_areas && prof.practice_areas.length > 0) practiceAreas = prof.practice_areas;
        if (prof.fee_initial_30min) feeInitial = prof.fee_initial_30min;
        if (prof.fee_standard_60min) feeStandard = prof.fee_standard_60min;
        if (prof.fee_extended_120min) feeExtended = prof.fee_extended_120min;
      }
    } catch {
      // Fallback to default preview state
    }
  }

  return (
    <LawyerProfileView
      initialData={{
        fullName,
        email,
        rollNumber,
        ibpChapter,
        barPasserYear,
        about,
        practiceAreas,
        feeInitial,
        feeStandard,
        feeExtended,
      }}
    />
  );
}
