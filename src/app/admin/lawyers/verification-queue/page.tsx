import type { Metadata } from 'next';
import { createServiceClient } from '@/lib/supabase/server';
import { AdminVerificationQueueView } from '@/components/admin/views/AdminVerificationQueueView';
import type { LawyerQueueItem } from '@/components/admin/LawyerVerificationQueue';

export const metadata: Metadata = {
  title: 'Lawyer Verification Queue | Justicia Admin',
  description: 'Review and verify Philippine lawyer roll credentials and applications.',
};

export default async function AdminVerificationQueuePage() {
  let queueItems: LawyerQueueItem[] = [];

  try {
    const supabase = await createServiceClient();

    const { data: profiles, error } = await supabase
      .from('lawyer_profiles')
      .select(`
        user_id,
        full_name,
        roll_number,
        ibp_chapter,
        bar_passer_year,
        about,
        practice_areas,
        languages,
        experience_years,
        fee_initial_30min,
        fee_standard_60min,
        fee_extended_120min,
        verification_status,
        admin_notes,
        rejection_reason,
        submitted_at,
        reviewed_at,
        created_at,
        user_accounts!lawyer_profiles_user_id_fkey ( email )
      `)
      .order('submitted_at', { ascending: false });

    if (!error && profiles) {
      queueItems = profiles.map((p: any) => ({
        user_id: p.user_id,
        email: (p.user_accounts as any)?.email ?? '',
        full_name: p.full_name,
        roll_number: p.roll_number,
        ibp_chapter: p.ibp_chapter,
        bar_passer_year: p.bar_passer_year,
        about: p.about,
        practice_areas: p.practice_areas,
        languages: p.languages,
        experience_years: p.experience_years,
        fee_initial_30min: p.fee_initial_30min,
        fee_standard_60min: p.fee_standard_60min,
        fee_extended_120min: p.fee_extended_120min,
        verification_status: p.verification_status,
        admin_notes: p.admin_notes,
        rejection_reason: p.rejection_reason,
        submitted_at: p.submitted_at,
        reviewed_at: p.reviewed_at,
        created_at: p.created_at,
      }));
    }
  } catch (err) {
    console.error('[VerificationQueuePage] DB fetch error:', err);
  }

  return <AdminVerificationQueueView lawyers={queueItems} />;
}
