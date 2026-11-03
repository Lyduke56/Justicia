import type { Metadata } from 'next';
import { createServiceClient } from '@/lib/supabase/server';
import { AdminLawyersView } from '@/components/admin/views/AdminLawyersView';
import type { LawyerDirectoryItem } from '@/components/admin/LawyerDirectoryTable';

export const metadata: Metadata = {
  title: 'Lawyer Directory | Justicia Admin',
  description: 'Manage registered Philippine attorneys, verify Supreme Court credentials, and oversee roster availability.',
};

export default async function AdminLawyersPage() {
  let lawyers: LawyerDirectoryItem[] = [];

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
        practice_areas,
        languages,
        experience_years,
        fee_standard_60min,
        verification_status,
        is_visible,
        is_available,
        submitted_at,
        reviewed_at,
        created_at,
        user_accounts!lawyer_profiles_user_id_fkey ( email )
      `)
      .order('created_at', { ascending: false });

    if (!error && profiles) {
      lawyers = profiles.map((p: any) => ({
        user_id: p.user_id,
        email: (p.user_accounts as any)?.email ?? '',
        full_name: p.full_name,
        roll_number: p.roll_number,
        ibp_chapter: p.ibp_chapter,
        bar_passer_year: p.bar_passer_year,
        practice_areas: p.practice_areas,
        languages: p.languages,
        experience_years: p.experience_years,
        fee_standard_60min: p.fee_standard_60min,
        verification_status: p.verification_status,
        is_visible: p.is_visible,
        is_available: p.is_available,
        submitted_at: p.submitted_at,
        reviewed_at: p.reviewed_at,
        created_at: p.created_at,
      }));
    }
  } catch (err) {
    console.error('[AdminLawyersPage] DB fetch error:', err);
  }

  return <AdminLawyersView lawyers={lawyers} />;
}
