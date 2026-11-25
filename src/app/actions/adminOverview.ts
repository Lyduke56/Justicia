'use server';

/**
 * Extra figures for the admin Overview tab. Read-only: it adds to the existing
 * `getAdminDashboardData` (the tab's first paint) without changing it.
 *  - KPI notes: clients and lawyers, recent approvals, open reports.
 *  - Longer application and activity lists, so a tall screen can fill its panels.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export interface AdminOverviewApplication {
  user_id: string;
  full_name: string;
  roll_number: string;
  ibp_chapter: string | null;
  submitted_at: string | null;
}

export interface AdminOverviewActivity {
  id: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  details: Record<string, unknown>;
  actorName: string | null;
  timestamp: string;
}

export interface AdminOverviewData {
  approvedLast30Days: number;
  oldestPendingAt: string | null;
  users: { client: number; lawyer: number };
  /** null when the reports table could not be read. */
  reports: { open: number; underReview: number } | null;
  applications: AdminOverviewApplication[];
  activity: AdminOverviewActivity[];
}

const LIST_LIMIT = 12;
const DAY_MS = 24 * 60 * 60 * 1000;

async function requireAdmin() {
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) throw new Error('Administrator sign-in required.');
  const { data: account } = await client.from('user_accounts').select('role').eq('id', user.id).single();
  if (account?.role !== 'admin') throw new Error('Administrator access required.');
}

type ProfileRow = AdminOverviewApplication & { verification_status: string; reviewed_at: string | null };
type AuditRow = { id: string; actor_id: string | null; action: string; target_type: string | null; target_id: string | null; details: Record<string, unknown> | null; created_at: string };

export async function getAdminOverviewData(): Promise<AdminOverviewData> {
  try {
    await requireAdmin();
    const db = (await createServiceClient()) as unknown as SupabaseClient;
    const now = Date.now();

    const countUsers = (role: string) => db.from('user_accounts').select('id', { count: 'exact', head: true }).eq('role', role);
    // Same report scope as the Reports tab (accounts filed from Messages).
    const countReports = (status: string) =>
      db.from('reports').select('id', { count: 'exact', head: true }).in('target_type', ['user', 'lawyer']).eq('status', status);

    const [profiles, clients, lawyers, open, underReview, audit] = await Promise.all([
      db.from('lawyer_profiles').select('user_id, full_name, roll_number, ibp_chapter, verification_status, submitted_at, reviewed_at').order('submitted_at', { ascending: false }),
      countUsers('client'),
      countUsers('lawyer'),
      countReports('open'),
      countReports('under_review'),
      db.from('audit_log').select('id, actor_id, action, target_type, target_id, details, created_at').order('created_at', { ascending: false }).limit(LIST_LIMIT),
    ]);
    if (profiles.error) throw profiles.error;
    if (audit.error) throw audit.error;

    const rows = (profiles.data ?? []) as ProfileRow[];
    const pending = rows.filter((p) => p.verification_status === 'pending');
    const oldestPendingAt = pending.reduce<string | null>(
      (oldest, p) => (p.submitted_at && (!oldest || p.submitted_at < oldest) ? p.submitted_at : oldest),
      null
    );
    const monthAgo = now - 30 * DAY_MS;
    const approvedLast30Days = rows.filter(
      (p) => p.verification_status === 'approved' && p.reviewed_at && Date.parse(p.reviewed_at) >= monthAgo
    ).length;

    const auditRows = (audit.data ?? []) as AuditRow[];
    const actorIds = [...new Set(auditRows.map((r) => r.actor_id).filter((id): id is string => Boolean(id)))];
    const { data: actors } = actorIds.length
      ? await db.from('user_accounts').select('id, email, full_name').in('id', actorIds)
      : { data: [] as Array<{ id: string; email: string | null; full_name: string | null }> };
    const actorName = new Map(
      (actors ?? []).map((a: { id: string; email: string | null; full_name: string | null }) => [a.id, a.full_name || a.email?.split('@')[0] || null])
    );

    return {
      approvedLast30Days,
      oldestPendingAt,
      users: {
        client: clients.count ?? 0,
        lawyer: lawyers.count ?? 0,
      },
      reports: open.error || underReview.error ? null : { open: open.count ?? 0, underReview: underReview.count ?? 0 },
      applications: pending.slice(0, LIST_LIMIT).map(({ user_id, full_name, roll_number, ibp_chapter, submitted_at }) => ({
        user_id,
        full_name,
        roll_number,
        ibp_chapter,
        submitted_at,
      })),
      activity: auditRows.map((r) => ({
        id: r.id,
        action: r.action,
        targetType: r.target_type,
        targetId: r.target_id,
        details: r.details ?? {},
        actorName: r.actor_id ? (actorName.get(r.actor_id) ?? null) : null,
        timestamp: r.created_at,
      })),
    };
  } catch (err) {
    console.error('[getAdminOverviewData] error:', err);
    throw new Error('Unable to load the admin overview.');
  }
}
