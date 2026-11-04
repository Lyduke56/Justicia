'use server';

import { revalidatePath } from 'next/cache';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { writeAuditLog } from '@/lib/notifications';
import type { AdminUserAccount, AdminAuditEntry } from '@/types/admin';

async function requireAdmin() {
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) throw new Error('Administrator sign-in required.');
  const { data: account } = await client.from('user_accounts').select('role').eq('id', user.id).single();
  if (account?.role !== 'admin') throw new Error('Administrator access required.');
  return user;
}

export interface DashboardData {
  pendingLawyersCount: number;
  approvedLawyersCount: number;
  totalUsersCount: number;
  pendingLawyersPreview: Array<{
    user_id: string;
    full_name: string;
    roll_number: string;
    ibp_chapter: string | null;
  }>;
  recentAuditEntries: Array<{
    id: string;
    action: string;
    targetType?: string;
    timestamp: string;
  }>;
}

export interface LawyerQueueRow {
  user_id: string;
  email: string;
  full_name: string;
  roll_number: string;
  ibp_chapter: string | null;
  bar_passer_year: number | null;
  about: string | null;
  practice_areas: string[] | null;
  languages: string[] | null;
  experience_years: number | null;
  fee_initial_30min: number | null;
  fee_standard_60min: number | null;
  fee_extended_120min: number | null;
  verification_status: string;
  admin_notes: string | null;
  rejection_reason: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export interface LawyerDirectoryRow {
  user_id: string;
  email: string;
  full_name: string;
  roll_number: string | null;
  ibp_chapter: string | null;
  bar_passer_year: number | null;
  practice_areas: string[] | null;
  languages: string[] | null;
  experience_years: number | null;
  fee_standard_60min: number | null;
  verification_status: string;
  is_visible: boolean | null;
  is_available: boolean | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export async function getAdminDashboardData(): Promise<DashboardData> {
  try {
    await requireAdmin();
    const supabase = await createServiceClient();

    const { data: profiles, error: profilesError } = await supabase
      .from('lawyer_profiles')
      .select('user_id, full_name, roll_number, ibp_chapter, verification_status')
      .order('submitted_at', { ascending: false });
    if (profilesError) throw profilesError;

    const pendingLawyersCount = profiles?.filter((p) => p.verification_status === 'pending').length ?? 0;
    const approvedLawyersCount = profiles?.filter((p) => p.verification_status === 'approved').length ?? 0;

    const pendingLawyersPreview =
      profiles
        ?.filter((p) => p.verification_status === 'pending')
        .slice(0, 5)
        .map((p) => ({
          user_id: p.user_id,
          full_name: p.full_name,
          roll_number: p.roll_number,
          ibp_chapter: p.ibp_chapter,
        })) ?? [];

    const { count, error: usersError } = await supabase
      .from('user_accounts')
      .select('id', { count: 'exact', head: true });
    if (usersError) throw usersError;

    const { data: auditRows, error: auditError } = await supabase
      .from('audit_log')
      .select('id, action, target_type, created_at')
      .order('created_at', { ascending: false })
      .limit(4);
    if (auditError) throw auditError;

    const recentAuditEntries =
      auditRows?.map((row) => ({
        id: row.id,
        action: row.action,
        targetType: row.target_type ?? undefined,
        timestamp: row.created_at,
      })) ?? [];

    return {
      pendingLawyersCount,
      approvedLawyersCount,
      totalUsersCount: count ?? 0,
      pendingLawyersPreview,
      recentAuditEntries,
    };
  } catch (err) {
    console.error('[getAdminDashboardData] error:', err);
    throw new Error('Unable to load the admin overview.');
  }
}

export async function getVerificationQueueData(): Promise<LawyerQueueRow[]> {
  try {
    await requireAdmin();
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
        created_at
      `)
      .order('submitted_at', { ascending: false });

    if (error || !profiles) {
      console.error('[getVerificationQueueData] Supabase error:', error);
      throw new Error('Unable to load lawyer applications.');
    }

    const { data: accounts, error: accountsError } = profiles.length
      ? await supabase.from('user_accounts').select('id, email').in('id', profiles.map((profile) => profile.user_id))
      : { data: [], error: null };
    if (accountsError) throw accountsError;
    const emails = new Map(accounts?.map((account) => [account.id, account.email]) ?? []);

    return profiles.map((p) => ({
      user_id: p.user_id,
      email: emails.get(p.user_id) ?? '',
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
  } catch (err) {
    console.error('[getVerificationQueueData] error:', err);
    throw new Error('Unable to load lawyer applications.');
  }
}

export async function getLawyerDirectoryData(): Promise<LawyerDirectoryRow[]> {
  try {
    await requireAdmin();
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
        created_at
      `)
      .order('created_at', { ascending: false });

    if (error || !profiles) {
      console.error('[getLawyerDirectoryData] Supabase error:', error);
      throw new Error('Unable to load the lawyer directory.');
    }

    const { data: accounts, error: accountsError } = profiles.length
      ? await supabase.from('user_accounts').select('id, email').in('id', profiles.map((profile) => profile.user_id))
      : { data: [], error: null };
    if (accountsError) throw accountsError;
    const emails = new Map(accounts?.map((account) => [account.id, account.email]) ?? []);

    return profiles.map((p) => ({
      user_id: p.user_id,
      email: emails.get(p.user_id) ?? '',
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
  } catch (err) {
    console.error('[getLawyerDirectoryData] error:', err);
    throw new Error('Unable to load the lawyer directory.');
  }
}

export async function getAdminUsersData(): Promise<AdminUserAccount[]> {
  try {
    await requireAdmin();
    const supabase = await createServiceClient();

    const { data: users, error } = await supabase
      .from('user_accounts')
      .select('*')
      .order('created_at', { ascending: false });

    if (error || !users) {
      console.error('[getAdminUsersData] error:', error);
      throw new Error('Unable to load user accounts.');
    }

    return users.map((u) => {
      return {
        id: u.id,
        fullName: u.full_name || u.email?.split('@')[0] || 'User Account',
        email: u.email,
        role: u.role,
        createdAt: u.created_at,
      };
    });
  } catch (err) {
    console.error('[getAdminUsersData] error:', err);
    throw new Error('Unable to load user accounts.');
  }
}

export async function updateUserRoleAction(userId: string, newRole: 'client' | 'lawyer' | 'admin') {
  try {
    const adminUser = await requireAdmin();
    const supabase = await createServiceClient();
    const { error: accErr } = await supabase
      .from('user_accounts')
      .update({ role: newRole })
      .eq('id', userId);

    if (accErr) return { error: accErr.message };

    try {
      const { data: authUser } = await supabase.auth.admin.getUserById(userId);
      if (authUser?.user) {
        await supabase.auth.admin.updateUserById(userId, {
          user_metadata: {
            ...authUser.user.user_metadata,
            role: newRole,
          },
        });
      }
    } catch (e) {
      console.warn('Auth sync warn:', e);
    }

    await writeAuditLog({
      actorId: adminUser.id,
      action: 'user.role_change',
      targetType: 'user_account',
      targetId: userId,
      details: { new_role: newRole },
    });

    revalidatePath('/admin/users');
    revalidatePath('/admin/dashboard');
    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error updating user role';
    return { error: msg };
  }
}

export async function toggleUserStatusAction(userId: string, newStatus: 'active' | 'suspended') {
  try {
    const adminUser = await requireAdmin();
    const supabase = await createServiceClient();
    const verificationStatus = newStatus === 'suspended' ? 'rejected' : 'verified';
    const { error } = await supabase
      .from('user_accounts')
      .update({ verification_status: verificationStatus })
      .eq('id', userId);

    if (error) return { error: error.message };

    await writeAuditLog({
      actorId: adminUser.id,
      action: newStatus === 'suspended' ? 'user.suspended' : 'user.reinstated',
      targetType: 'user_account',
      targetId: userId,
      details: { status: newStatus },
    });

    revalidatePath('/admin/users');
    revalidatePath('/admin/dashboard');
    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error updating user status';
    return { error: msg };
  }
}

export async function sendUserPasswordResetAction(email: string) {
  try {
    await requireAdmin();
    const supabase = await createServiceClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/reset-password`,
    });
    if (error) return { error: error.message };
    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error sending password reset';
    return { error: msg };
  }
}

export async function getAdminAuditLogsData(): Promise<AdminAuditEntry[]> {
  try {
    await requireAdmin();
    const supabase = await createServiceClient();

    const { data: logs, error } = await supabase
      .from('audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error || !logs) {
      console.error('[getAdminAuditLogsData] error:', error);
      throw new Error('Unable to load the audit log.');
    }

    const actorIds = logs.map((log) => log.actor_id).filter((id): id is string => Boolean(id));
    const { data: accounts, error: accountsError } = actorIds.length
      ? await supabase.from('user_accounts').select('id, email, full_name, role').in('id', actorIds)
      : { data: [], error: null };
    if (accountsError) throw accountsError;
    const actors = new Map(accounts?.map((account) => [account.id, account]) ?? []);

    return logs.map((log) => {
      const actor = log.actor_id ? actors.get(log.actor_id) : undefined;
      const actorName =
        actor?.full_name ||
        (actor?.email ? actor.email.split('@')[0] : 'Unknown actor');
      const actorEmail = actor?.email || '';

      return {
        id: log.id,
        timestamp: log.created_at,
        actor: {
          id: log.actor_id ?? 'system',
          name: actorName,
          email: actorEmail,
        },
        action: log.action,
        targetType: log.target_type ?? 'system',
        targetId: log.target_id ?? '',
        details: (log.details as Record<string, unknown>) ?? {},
      };
    });
  } catch (err) {
    console.error('[getAdminAuditLogsData] error:', err);
    throw new Error('Unable to load the audit log.');
  }
}
