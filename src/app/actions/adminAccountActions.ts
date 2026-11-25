'use server';

/**
 * Admin account controls: suspend, reinstate early, terminate. These work for client and lawyer
 * accounts with or without a report (report decisions use the same enforcement code through
 * moderateReportAction). Every action re-checks that the caller is an active administrator,
 * refuses to act on the caller's own or another admin's account, and is written to the audit
 * log by src/lib/moderation/accountStatus.ts. Terminating also asks for the admin's password.
 */
import { revalidatePath } from 'next/cache';
import { guardMessage, requireAdminReauthentication, requireRole, UUID_RE } from '@/lib/auth/guards';
import { readDatabaseRole } from '@/lib/auth/roles';
import {
  getAccountStanding,
  reinstateAccount,
  signalUsers,
  suspendAccount,
  terminateAccount,
  type AccountStanding,
} from '@/lib/moderation/accountStatus';
import type { SupabaseClient } from '@supabase/supabase-js';

/** Suspension lengths offered to admins (days). 0 = until an admin reinstates the account. */
export type AdminSuspensionLength = 3 | 7 | 14 | 30 | 90 | 0;
const LENGTHS: AdminSuspensionLength[] = [3, 7, 14, 30, 90, 0];
/** "Until reinstated" is a ban of ten years that an admin lifts with Reinstate. */
const UNTIL_REINSTATED_DAYS = 3650;

type Result<T = object> = ({ success: true; message: string } & T) | { success: false; error: string };

export interface AccountStandingView extends AccountStanding {
  role: 'client' | 'lawyer' | 'admin' | null;
  history: Array<{ id: string; action: string; at: string; reason: string | null; until: string | null }>;
}

function cleanReason(reason: unknown): string | null {
  if (typeof reason !== 'string') return null;
  const value = reason.trim().replace(/[\u0000-\u0008\u000b-\u001f]/g, '');
  return value.length >= 10 && value.length <= 1000 ? value : null;
}

/** Loads the target and refuses self-actions and actions on other administrators. */
async function target(db: SupabaseClient, adminId: string, userId: string) {
  if (!UUID_RE.test(userId ?? '')) throw new Error('Account not found.');
  if (userId === adminId) throw new Error('You cannot change the standing of your own account.');
  const role = await readDatabaseRole(db, userId);
  if (!role) throw new Error('Account not found.');
  if (role === 'admin') throw new Error('Administrator accounts cannot be suspended here. Change the role first.');
  return role;
}

function refresh(userId: string) {
  revalidatePath('/admin/users');
  revalidatePath(`/admin/users/${userId}`);
  revalidatePath(`/admin/lawyers/${userId}`);
  revalidatePath('/admin/lawyers');
  revalidatePath('/admin/reports');
  revalidatePath('/client/lawyers');
  signalUsers([userId], ['notifications', 'consultations']);
}

function errorText(err: unknown, fallback: string): string {
  const guarded = guardMessage(err, '');
  if (guarded) return guarded;
  return err instanceof Error && err.message ? err.message : fallback;
}

export async function getAccountStandingAction(userId: string): Promise<Result<{ standing: AccountStandingView }>> {
  try {
    const { db } = await requireRole('admin');
    if (!UUID_RE.test(userId ?? '')) return { success: false, error: 'Account not found.' };
    const [standing, role, { data: log }] = await Promise.all([
      getAccountStanding(db, userId),
      readDatabaseRole(db, userId),
      db
        .from('audit_log')
        .select('id, action, created_at, details')
        .eq('target_id', userId)
        .in('action', ['account.suspended', 'account.reinstated', 'account.terminated'])
        .order('created_at', { ascending: false })
        .limit(10),
    ]);
    const history = ((log ?? []) as Array<{ id: string; action: string; created_at: string; details: Record<string, unknown> | null }>).map((row) => ({
      id: row.id,
      action: row.action,
      at: row.created_at,
      reason: typeof row.details?.reason === 'string' ? row.details.reason : null,
      until: typeof row.details?.until === 'string' ? row.details.until : null,
    }));
    return { success: true, message: '', standing: { ...standing, role, history } };
  } catch (err) {
    return { success: false, error: errorText(err, 'The account standing could not be loaded.') };
  }
}

export async function adminSuspendAccountAction(input: {
  userId: string;
  reason: string;
  length: AdminSuspensionLength;
}): Promise<Result<{ until: string }>> {
  try {
    const { db, user } = await requireRole('admin');
    await target(db, user.id, input?.userId);
    const reason = cleanReason(input?.reason);
    if (!reason) return { success: false, error: 'Write the reason the user will see (10 to 1000 characters).' };
    if (!LENGTHS.includes(input?.length)) return { success: false, error: 'Choose how long the suspension lasts.' };
    const standing = await getAccountStanding(db, input.userId);
    if (standing.status === 'terminated') return { success: false, error: 'This account is already terminated.' };
    if (standing.status === 'pending_deletion') return { success: false, error: 'This account is scheduled for deletion.' };

    const days = input.length === 0 ? UNTIL_REINSTATED_DAYS : input.length;
    const { until } = await suspendAccount(db, { userId: input.userId, adminId: user.id, reportId: null, reason, days });
    refresh(input.userId);
    return {
      success: true,
      until,
      message: input.length === 0 ? 'The account is suspended until you reinstate it.' : `The account is suspended for ${input.length} days.`,
    };
  } catch (err) {
    return { success: false, error: errorText(err, 'The account could not be suspended.') };
  }
}

export async function adminReinstateAccountAction(input: { userId: string; reason: string }): Promise<Result> {
  try {
    const { db, user } = await requireRole('admin');
    await target(db, user.id, input?.userId);
    const reason = cleanReason(input?.reason);
    if (!reason) return { success: false, error: 'Write why the suspension is ending (10 to 1000 characters).' };
    const { changed } = await reinstateAccount(db, { userId: input.userId, adminId: user.id, reason });
    refresh(input.userId);
    return { success: true, message: changed ? 'The account is active again.' : 'The account was already active.' };
  } catch (err) {
    return { success: false, error: errorText(err, 'The account could not be reinstated.') };
  }
}

export async function adminTerminateAccountAction(input: { userId: string; reason: string; password: string }): Promise<Result> {
  try {
    const { db, user } = await requireAdminReauthentication(input?.password);
    await target(db, user.id, input?.userId);
    const reason = cleanReason(input?.reason);
    if (!reason) return { success: false, error: 'Write the reason the user will see (10 to 1000 characters).' };
    const standing = await getAccountStanding(db, input.userId);
    if (standing.status === 'terminated') return { success: true, message: 'The account was already terminated.' };
    await terminateAccount(db, { userId: input.userId, adminId: user.id, reportId: null, reason });
    refresh(input.userId);
    return { success: true, message: 'The account is permanently terminated.' };
  } catch (err) {
    return { success: false, error: errorText(err, 'The account could not be terminated.') };
  }
}
