import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createServiceClient } from '@/lib/supabase/server';
import { formatAttorneyName } from '@/lib/utils/attorneyName';
import { LawyerDossierView, type DossierLawyer } from '@/components/admin/dossier/LawyerDossierView';
import { dossierOrigin } from '@/components/admin/dossier/origin';
import type { ActivityEntry } from '@/components/admin/overview/activity';

export const metadata: Metadata = {
  title: 'Lawyer Credential Dossier | Justicia Admin',
};

interface Props {
  params: Promise<{ lawyerId: string }>;
  /** `from`: the screen that opened the dossier (directory | queue | overview), for the back button. */
  searchParams: Promise<{ from?: string }>;
}

export default async function AdminLawyerDetailPage({ params, searchParams }: Props) {
  const { lawyerId } = await params;
  const { from } = await searchParams;
  const serviceSupabase = await createServiceClient();

  // 1. Fetch lawyer profile
  const { data: profile } = await serviceSupabase
    .from('lawyer_profiles')
    .select('*')
    .eq('user_id', lawyerId)
    .maybeSingle();

  if (!profile) {
    notFound();
  }

  // 2. Fetch user account details
  const { data: account } = await serviceSupabase
    .from('user_accounts')
    .select('email, role, verification_status, created_at')
    .eq('id', lawyerId)
    .maybeSingle();

  // 3. Fetch audit logs for this lawyer
  const { data: auditLogs } = await serviceSupabase
    .from('audit_log')
    .select('id, action, actor_id, details, created_at')
    .eq('target_id', lawyerId)
    .order('created_at', { ascending: false })
    .limit(8);

  // 4. Names of the people in the audit trail (read-only)
  const actorIds = [...new Set((auditLogs ?? []).map((log) => log.actor_id).filter((id): id is string => Boolean(id)))];
  const { data: actors } = actorIds.length
    ? await serviceSupabase.from('user_accounts').select('id, email, full_name').in('id', actorIds)
    : { data: [] as Array<{ id: string; email: string | null; full_name: string | null }> };
  const actorName = new Map((actors ?? []).map((a) => [a.id, a.full_name || a.email?.split('@')[0] || null]));

  // rating_avg / rating_count exist on the live table but not in the generated types.
  const ratings = profile as typeof profile & { rating_avg?: number | null; rating_count?: number | null };

  const lawyer: DossierLawyer = {
    userId: profile.user_id,
    fullName: formatAttorneyName(profile.full_name),
    email: account?.email ?? null,
    photoUrl: profile.photo_url,
    rollNumber: profile.roll_number,
    ibpChapter: profile.ibp_chapter,
    barPasserYear: profile.bar_passer_year,
    experienceYears: profile.experience_years,
    practiceAreas: (profile.practice_areas ?? []).filter(Boolean),
    languages: (profile.languages ?? []).filter(Boolean),
    about: profile.about,
    feeInitial30: profile.fee_initial_30min,
    feeStandard60: profile.fee_standard_60min,
    feeExtended120: profile.fee_extended_120min,
    status: profile.verification_status,
    isVisible: Boolean(profile.is_visible),
    isAvailable: Boolean(profile.is_available),
    adminNotes: profile.admin_notes,
    rejectionReason: profile.rejection_reason,
    submittedAt: profile.submitted_at,
    reviewedAt: profile.reviewed_at,
    accountCreatedAt: account?.created_at ?? profile.created_at,
    ratingAvg: ratings.rating_avg ?? null,
    ratingCount: ratings.rating_count ?? null,
  };

  const activity: ActivityEntry[] = (auditLogs ?? []).map((log) => ({
    id: log.id,
    action: log.action,
    targetType: null,
    targetId: null,
    details: (log.details as Record<string, unknown> | null) ?? {},
    actorName: log.actor_id ? (actorName.get(log.actor_id) ?? null) : null,
    timestamp: log.created_at,
  }));

  return <LawyerDossierView lawyer={lawyer} activity={activity} from={dossierOrigin(from)} />;
}
