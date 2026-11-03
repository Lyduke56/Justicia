import type { Metadata } from 'next';
import { createServiceClient } from '@/lib/supabase/server';
import { AdminDashboardView } from '@/components/admin/views/AdminDashboardView';

export const metadata: Metadata = {
  title: 'Platform Overview | Justicia Admin',
  description: 'Command center overview of lawyers, verification queues, and system intelligence.',
};

export default async function AdminDashboardPage() {
  let pendingLawyersCount = 0;
  let approvedLawyersCount = 0;
  let totalUsersCount = 0;
  let pendingLawyersPreview: Array<{
    user_id: string;
    full_name: string;
    roll_number: string;
    ibp_chapter: string | null;
  }> = [];
  let recentAuditEntries: Array<{
    id: string;
    action: string;
    targetType?: string;
    timestamp: string;
  }> = [];

  try {
    const supabase = await createServiceClient();

    // Fetch lawyer profile counts
    const { data: profiles } = await supabase
      .from('lawyer_profiles')
      .select('user_id, full_name, roll_number, ibp_chapter, verification_status')
      .order('submitted_at', { ascending: false });

    if (profiles) {
      pendingLawyersCount = profiles.filter((p) => p.verification_status === 'pending').length;
      approvedLawyersCount = profiles.filter((p) => p.verification_status === 'approved').length;

      // Top 5 pending for dashboard preview
      pendingLawyersPreview = profiles
        .filter((p) => p.verification_status === 'pending')
        .slice(0, 5)
        .map((p) => ({
          user_id: p.user_id,
          full_name: p.full_name,
          roll_number: p.roll_number,
          ibp_chapter: p.ibp_chapter,
        }));
    }

    // Fetch total registered users count
    const { count } = await supabase
      .from('user_accounts')
      .select('id', { count: 'exact', head: true });

    if (count !== null) {
      totalUsersCount = count;
    }

    // Fetch recent audit log entries
    const { data: auditRows } = await supabase
      .from('audit_log')
      .select('id, action, target_type, created_at')
      .order('created_at', { ascending: false })
      .limit(4);

    if (auditRows) {
      recentAuditEntries = auditRows.map((row) => ({
        id: row.id,
        action: row.action,
        targetType: row.target_type ?? undefined,
        timestamp: row.created_at,
      }));
    }
  } catch (err) {
    console.error('[AdminDashboardPage] DB fetch error:', err);
  }

  return (
    <AdminDashboardView
      pendingLawyersCount={pendingLawyersCount}
      approvedLawyersCount={approvedLawyersCount}
      totalUsersCount={totalUsersCount}
      pendingLawyersPreview={pendingLawyersPreview}
      recentAuditEntries={recentAuditEntries}
    />
  );
}
