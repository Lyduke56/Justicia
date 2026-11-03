'use server';

import { revalidatePath } from 'next/cache';
import { createServiceClient } from '@/lib/supabase/server';
import { writeAuditLog } from '@/lib/notifications';
import type { AdminUserAccount, AdminAuditEntry } from '@/lib/mock/adminMockData';

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
    const supabase = await createServiceClient();

    const { data: profiles } = await supabase
      .from('lawyer_profiles')
      .select('user_id, full_name, roll_number, ibp_chapter, verification_status')
      .order('submitted_at', { ascending: false });

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

    const { count } = await supabase
      .from('user_accounts')
      .select('id', { count: 'exact', head: true });

    const { data: auditRows } = await supabase
      .from('audit_log')
      .select('id, action, target_type, created_at')
      .order('created_at', { ascending: false })
      .limit(4);

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
    return {
      pendingLawyersCount: 0,
      approvedLawyersCount: 0,
      totalUsersCount: 0,
      pendingLawyersPreview: [],
      recentAuditEntries: [],
    };
  }
}

export async function getVerificationQueueData(): Promise<LawyerQueueRow[]> {
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

    if (error || !profiles) {
      console.error('[getVerificationQueueData] Supabase error:', error);
      return [];
    }

    return profiles.map((p: any) => ({
      user_id: p.user_id,
      email: p.user_accounts?.email ?? '',
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
    return [];
  }
}

export async function getLawyerDirectoryData(): Promise<LawyerDirectoryRow[]> {
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

    if (error || !profiles) {
      console.error('[getLawyerDirectoryData] Supabase error:', error);
      return [];
    }

    return profiles.map((p: any) => ({
      user_id: p.user_id,
      email: p.user_accounts?.email ?? '',
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
    return [];
  }
}

export async function getAdminUsersData(): Promise<AdminUserAccount[]> {
  try {
    const supabase = await createServiceClient();

    const { data: users, error } = await supabase
      .from('user_accounts')
      .select(`
        *,
        lawyer_profiles!lawyer_profiles_user_id_fkey (
          ibp_chapter,
          verification_status
        )
      `)
      .order('created_at', { ascending: false });

    if (error || !users) {
      console.error('[getAdminUsersData] error:', error);
      return [];
    }

    return users.map((u: any) => {
      const location = u.lawyer_profiles?.ibp_chapter || 'Metro Manila, PH';
      let status: AdminUserAccount['status'] = 'active';

      if (u.role === 'lawyer') {
        // For lawyers, standing is determined by lawyer_profiles.verification_status
        const lpStatus = u.lawyer_profiles?.verification_status as string | undefined;
        if (lpStatus === 'approved') {
          status = 'active';
        } else if (lpStatus === 'rejected') {
          status = 'suspended';
        } else {
          // draft | pending | needs_resubmission | no profile yet
          status = 'unverified';
        }
        // If the account itself was explicitly suspended via user_accounts, honour that
        if (u.verification_status === 'rejected') {
          status = 'suspended';
        }
      } else {
        // clients and admins: base on user_accounts.verification_status
        if (u.verification_status === 'rejected') {
          status = 'suspended';
        } else {
          status = 'active';
        }
      }

      return {
        id: u.id,
        fullName: u.full_name || u.email?.split('@')[0] || 'User Account',
        email: u.email,
        phone: u.phone || '',
        role: (u.role as 'client' | 'lawyer' | 'admin') || 'client',
        status,
        mfaEnabled: !!u.mfa_enabled,
        location,
        casesCount: 0,
        consultationsCount: 0,
        createdAt: u.created_at,
        lastActiveAt: u.created_at,
      };
    });
  } catch (err) {
    console.error('[getAdminUsersData] error:', err);
    return [];
  }
}

export async function updateUserRoleAction(userId: string, newRole: 'client' | 'lawyer' | 'admin') {
  try {
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
      actorId: 'admin-action',
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
    const supabase = await createServiceClient();
    const verificationStatus = newStatus === 'suspended' ? 'rejected' : 'verified';
    const { error } = await supabase
      .from('user_accounts')
      .update({ verification_status: verificationStatus })
      .eq('id', userId);

    if (error) return { error: error.message };

    await writeAuditLog({
      actorId: 'admin-action',
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
    const supabase = await createServiceClient();

    const { data: logs, error } = await supabase
      .from('audit_log')
      .select(`
        *,
        user_accounts (
          email,
          full_name,
          role
        )
      `)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error || !logs) {
      console.error('[getAdminAuditLogsData] error:', error);
      return [];
    }

    return logs.map((log: any) => {
      const action = String(log.action || '');
      let category: AdminAuditEntry['category'] = 'auth';
      if (action.includes('lawyer')) category = 'lawyer_verification';
      else if (action.includes('user')) category = 'user_management';
      else if (action.includes('ai')) category = 'ai_config';
      else if (action.includes('financial') || action.includes('payment')) category = 'financial';

      let severity: AdminAuditEntry['severity'] = 'low';
      if (action.includes('rejected') || action.includes('suspended')) severity = 'high';
      else if (action.includes('approved') || action.includes('role')) severity = 'medium';

      const actorName =
        log.user_accounts?.full_name ||
        (log.user_accounts?.email ? log.user_accounts.email.split('@')[0] : 'System Administrator');
      const actorRole = (log.user_accounts?.role as AdminAuditEntry['actor']['role']) || 'admin';
      const actorEmail = log.user_accounts?.email || 'admin@justicia.ph';

      return {
        id: log.id,
        timestamp: log.created_at,
        actor: {
          id: log.actor_id ?? 'system',
          name: actorName,
          role: actorRole,
          email: actorEmail,
        },
        action: log.action,
        category,
        severity,
        targetType: log.target_type ?? 'system',
        targetId: log.target_id ?? '',
        ipAddress: 'Direct System Session',
        details: (log.details as Record<string, unknown>) ?? {},
      };
    });
  } catch (err) {
    console.error('[getAdminAuditLogsData] error:', err);
    return [];
  }
}
