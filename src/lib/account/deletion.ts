/**
 * Account deletion with a 7-day undo window. SERVER-SIDE ONLY (service-role client).
 *
 *  1. Request: the owner confirms with their password and types DELETE. Blocked while they have
 *     upcoming consultations (cancel them or let them finish first). The account becomes
 *     `pending_deletion`, every session is signed out, lawyers leave Find a Lawyer.
 *  2. Undo: signing in during the window opens /account/restore; restoring puts everything back.
 *  3. Purge (daily Vercel Cron, /api/cron/purge-deleted-accounts): after 7 days the personal data
 *     is erased. Rows other people still rely on (consultations, payments, reviews, messages)
 *     stay, but no longer point to a name, email or phone. The sign-in account is renamed to a
 *     placeholder address and blocked, so the original email is free to register again, unless
 *     the account was ever suspended or terminated: then its email hash is kept in
 *     public.blocked_emails and it can never register again.
 */
import { randomBytes } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { blockEmail, normalizeEmail } from '@/lib/auth/email';
import { syncAuthClaims } from '@/lib/auth/roles';
import { DELETION_GRACE_DAYS } from '@/lib/support';

/**
 * public.data_requests values allowed by the live check constraints:
 * request_type access | deletion | correction; status open | in_progress | completed | rejected.
 */
const DELETION_REQUEST = 'deletion';

type Db = SupabaseClient;

const DAY_MS = 86_400_000;
const ACTIVE_STATUSES = ['pending', 'awaiting_client_confirmation', 'confirmed'];
const TERMINATION_BAN = '876000h';

export function deletionDueAt(requestedAt: string): Date {
  return new Date(new Date(requestedAt).getTime() + DELETION_GRACE_DAYS * DAY_MS);
}

/** Upcoming consultations (as client or lawyer) that still have to happen or be cancelled. */
export async function upcomingConsultationCount(db: Db, userId: string): Promise<number> {
  const nowIso = new Date().toISOString();
  const { data } = await db
    .from('consultations')
    .select('id, scheduled_end, scheduled_start')
    .or(`client_id.eq.${userId},lawyer_id.eq.${userId}`)
    .in('status', ACTIVE_STATUSES);
  return ((data ?? []) as Array<{ scheduled_end: string | null; scheduled_start: string | null }>).filter((c) => {
    const end = c.scheduled_end ?? c.scheduled_start;
    return !end || end > nowIso;
  }).length;
}

async function audit(db: Db, actorId: string | null, action: string, targetId: string, details: Record<string, unknown>) {
  const { error } = await db.from('audit_log').insert({ actor_id: actorId, action, target_type: 'user_account', target_id: targetId, details });
  if (error) console.warn('[account deletion audit]', action, error.message);
}

/** Marks the account for deletion. The caller has already verified the password and checks. */
export async function scheduleDeletion(db: Db, userId: string): Promise<{ dueAt: string }> {
  const nowIso = new Date().toISOString();
  const { data: lawyer } = await db.from('lawyer_profiles').select('is_visible, is_available').eq('user_id', userId).maybeSingle();

  const { data: updated, error } = await db
    .from('profiles')
    .update({ account_status: 'pending_deletion', deletion_requested_at: nowIso, updated_at: nowIso })
    .eq('user_id', userId)
    .eq('account_status', 'active')
    .select('user_id');
  if (error) throw new Error('Your account could not be scheduled for deletion. Please try again.');
  if (!updated || updated.length === 0) throw new Error('This account cannot be deleted right now. Refresh the page and try again.');

  if (lawyer) {
    await db.from('lawyer_profiles').update({ is_visible: false, is_available: false, updated_at: nowIso }).eq('user_id', userId);
  }
  const dueAt = deletionDueAt(nowIso).toISOString();
  const { error: requestError } = await db.from('data_requests').insert({
    user_id: userId,
    request_type: DELETION_REQUEST,
    status: 'open',
    details: JSON.stringify({ dueAt }),
  });
  if (requestError) console.warn('[scheduleDeletion] data request not recorded:', requestError.message);
  await syncAuthClaims(db, userId, { account_status: 'pending_deletion' });
  await audit(db, userId, 'account.deletion_requested', userId, {
    dueAt,
    lawyerWasVisible: lawyer?.is_visible === true,
    lawyerWasAvailable: lawyer?.is_available === true,
  });
  return { dueAt };
}

/** Undoes a deletion request inside the window. Returns false when it is too late or not pending. */
export async function restoreAccount(db: Db, userId: string): Promise<boolean> {
  const { data: profile } = await db.from('profiles').select('account_status, deletion_requested_at').eq('user_id', userId).maybeSingle();
  if (profile?.account_status !== 'pending_deletion' || !profile.deletion_requested_at) return false;
  if (Date.now() >= deletionDueAt(profile.deletion_requested_at).getTime()) return false;

  const nowIso = new Date().toISOString();
  const { data: updated } = await db
    .from('profiles')
    .update({ account_status: 'active', deletion_requested_at: null, updated_at: nowIso })
    .eq('user_id', userId)
    .eq('account_status', 'pending_deletion')
    .select('user_id');
  if (!updated || updated.length === 0) return false;

  const { data: last } = await db
    .from('audit_log')
    .select('details')
    .eq('action', 'account.deletion_requested')
    .eq('target_id', userId)
    .order('created_at', { ascending: false })
    .limit(1);
  const before = (last?.[0]?.details ?? {}) as { lawyerWasVisible?: boolean; lawyerWasAvailable?: boolean };
  if (before.lawyerWasVisible || before.lawyerWasAvailable) {
    await db
      .from('lawyer_profiles')
      .update({ is_visible: before.lawyerWasVisible === true, is_available: before.lawyerWasAvailable === true, updated_at: nowIso })
      .eq('user_id', userId)
      .eq('verification_status', 'approved');
  }
  // Withdrawn by the owner: closed without being carried out.
  await db
    .from('data_requests')
    .update({ status: 'rejected', completed_at: nowIso, details: JSON.stringify({ outcome: 'withdrawn_by_owner' }) })
    .eq('user_id', userId)
    .eq('request_type', DELETION_REQUEST)
    .eq('status', 'open');
  await syncAuthClaims(db, userId, { account_status: 'active' });
  await audit(db, userId, 'account.deletion_cancelled', userId, {});
  return true;
}

/** Whether the account was ever suspended or terminated (then its email stays blocked). */
async function hasModerationHistory(db: Db, userId: string): Promise<boolean> {
  const { count } = await db
    .from('audit_log')
    .select('id', { count: 'exact', head: true })
    .eq('target_id', userId)
    .in('action', ['account.suspended', 'account.terminated']);
  if ((count ?? 0) > 0) return true;
  const { data: reports } = await db.from('reports').select('id').eq('target_id', userId);
  const ids = ((reports ?? []) as Array<{ id: string }>).map((r) => r.id);
  if (ids.length === 0) return false;
  const { count: actions } = await db
    .from('moderation_actions')
    .select('id', { count: 'exact', head: true })
    .in('report_id', ids)
    .in('action', ['suspension', 'termination']);
  return (actions ?? 0) > 0;
}

async function removeFolder(db: Db, bucket: string, prefix: string) {
  for (let round = 0; round < 20; round++) {
    const { data } = await db.storage.from(bucket).list(prefix, { limit: 100 });
    const entries = (data ?? []) as Array<{ name: string; id: string | null }>;
    if (entries.length === 0) return;
    const files = entries.filter((e) => e.id).map((e) => `${prefix}/${e.name}`);
    for (const dir of entries.filter((e) => !e.id)) await removeFolder(db, bucket, `${prefix}/${dir.name}`);
    if (files.length) await db.storage.from(bucket).remove(files);
    if (entries.length < 100) return;
  }
}

/** Ignores "table/column does not exist" so the purge also runs before optional SQL scripts. */
async function bestEffort(label: string, run: () => PromiseLike<{ error: { message: string } | null }>) {
  const { error } = await run();
  if (error && !/does not exist|could not find/i.test(error.message)) console.warn(`[purge] ${label}:`, error.message);
}

/**
 * Erases one account whose window has passed. Idempotent: running it again on a purged account
 * does nothing harmful. Returns 'purged', 'skipped' (not due) or throws on a failure that must
 * stop the purge (e.g. the email could not be added to the blocked list).
 */
export async function purgeAccount(db: Db, userId: string): Promise<'purged' | 'skipped'> {
  const { data: profile } = await db.from('profiles').select('account_status, deletion_requested_at, email').eq('user_id', userId).maybeSingle();
  // Purged accounts keep pending_deletion with deletion_requested_at cleared.
  if (profile?.account_status !== 'pending_deletion' || !profile.deletion_requested_at) return 'skipped';
  if (Date.now() < deletionDueAt(profile.deletion_requested_at).getTime()) return 'skipped';
  const { data: done } = await db
    .from('data_requests')
    .select('id')
    .eq('user_id', userId)
    .eq('request_type', DELETION_REQUEST)
    .eq('status', 'completed')
    .limit(1);
  if (done && done.length > 0) return 'skipped';

  const placeholder = `deleted-${userId}@deleted.justicia.invalid`;
  const { data: authData } = await db.auth.admin.getUserById(userId);
  const { data: account } = await db.from('user_accounts').select('email').eq('id', userId).maybeSingle();
  const emails = [...new Set([authData?.user?.email, account?.email, profile.email].map(normalizeEmail).filter((e) => e && e !== placeholder))];

  // 1. Suspended or terminated before: keep the email blocked forever (hash only).
  const moderated = await hasModerationHistory(db, userId);
  if (moderated) {
    for (const email of emails) {
      if (!(await blockEmail(db, email, 'deleted_after_moderation', userId))) {
        throw new Error('Could not record the blocked email; purge stopped so the address is not freed.');
      }
    }
  }

  const nowIso = new Date().toISOString();

  // 2. Files: the user's documents, verification files and photo.
  const { data: docs } = await db.from('documents').select('id, storage_path').eq('owner_id', userId);
  const paths = ((docs ?? []) as Array<{ storage_path: string | null }>).map((d) => d.storage_path).filter((p): p is string => !!p);
  for (let i = 0; i < paths.length; i += 100) await db.storage.from('case-documents').remove(paths.slice(i, i + 100));
  await removeFolder(db, 'case-documents', userId);
  await removeFolder(db, 'lawyer-credentials', userId);
  await removeFolder(db, 'avatars', userId);
  await bestEffort('documents', () =>
    db.from('documents').update({ filename: 'Deleted file', deleted_at: nowIso, updated_at: nowIso }).eq('owner_id', userId)
  );
  await bestEffort('grants', () => db.from('document_access_grants').update({ revoked_at: nowIso }).eq('granted_by', userId).is('revoked_at', null));
  await bestEffort('verification documents', () => db.from('lawyer_verification_documents').delete().eq('lawyer_id', userId));

  // 3. Personal records nobody else needs.
  for (const [table, column] of [
    ['notifications', 'user_id'],
    ['search_history', 'user_id'],
    ['source_bookmarks', 'user_id'],
    ['lawyer_favorites', 'client_id'],
    ['favorite_lawyers', 'client_id'],
    ['consent_records', 'user_id'],
    ['lawyer_education', 'lawyer_id'],
    ['lawyer_experience', 'lawyer_id'],
    ['lawyer_services', 'lawyer_id'],
    ['lawyer_case_summaries', 'lawyer_id'],
    ['lawyer_practice_areas_detail', 'lawyer_id'],
    ['lawyer_unavailability', 'lawyer_id'],
  ] as const) {
    await bestEffort(table, () => db.from(table).delete().eq(column, userId));
  }
  const { data: convs } = await db.from('conversations').select('id').eq('user_id', userId);
  const convIds = ((convs ?? []) as Array<{ id: string }>).map((c) => c.id);
  if (convIds.length) await bestEffort('ai messages', () => db.from('messages').delete().in('conversation_or_thread_id', convIds));
  await bestEffort('conversations', () => db.from('conversations').delete().eq('user_id', userId));

  // 4. Anonymize the rows other people's records point to.
  await bestEffort('profile extras', () =>
    db.from('profiles').update({ city_province: null, consultation_language: null, contact_method: null, contact_time: null }).eq('user_id', userId)
  );
  await bestEffort('profiles', () =>
    db
      .from('profiles')
      // deletion_requested_at is cleared so the daily purge does not pick this account up again.
      .update({ full_name: 'Deleted user', email: placeholder, phone: null, avatar_url: null, last_login_at: null, deletion_requested_at: null, updated_at: nowIso })
      .eq('user_id', userId)
  );
  await bestEffort('user_accounts', () => db.from('user_accounts').update({ full_name: 'Deleted user', email: placeholder, phone: null }).eq('id', userId));
  await bestEffort('lawyer_profiles', () =>
    db
      .from('lawyer_profiles')
      .update({
        full_name: 'Deleted lawyer',
        roll_number: `deleted-${userId.slice(0, 8)}`,
        about: null,
        photo_url: null,
        is_visible: false,
        is_available: false,
        admin_notes: null,
        updated_at: nowIso,
      })
      .eq('user_id', userId)
  );

  // 5. The sign-in account: placeholder address, random password, blocked for good.
  const { error: authError } = await db.auth.admin.updateUserById(userId, {
    email: placeholder,
    email_confirm: true,
    password: randomBytes(32).toString('base64url'),
    user_metadata: {},
    app_metadata: { role: (authData?.user?.app_metadata as { role?: string } | undefined)?.role ?? 'client', account_status: 'deleted' },
    ban_duration: TERMINATION_BAN,
  });
  if (authError) throw new Error(`Could not close the sign-in account: ${authError.message}`);

  await db
    .from('data_requests')
    .update({ status: 'completed', completed_at: nowIso })
    .eq('user_id', userId)
    .eq('request_type', DELETION_REQUEST)
    .eq('status', 'open');
  await audit(db, null, 'account.deleted', userId, { blockedEmail: moderated && emails.length > 0 });
  return 'purged';
}

/** Purges every account whose undo window has passed. */
export async function purgeDueAccounts(db: Db): Promise<{ purged: number; failed: number }> {
  const cutoff = new Date(Date.now() - DELETION_GRACE_DAYS * DAY_MS).toISOString();
  const { data } = await db
    .from('profiles')
    .select('user_id')
    .eq('account_status', 'pending_deletion')
    .lte('deletion_requested_at', cutoff)
    .limit(50);
  let purged = 0;
  let failed = 0;
  for (const row of (data ?? []) as Array<{ user_id: string }>) {
    try {
      if ((await purgeAccount(db, row.user_id)) === 'purged') purged++;
    } catch (err) {
      failed++;
      console.error('[purgeDueAccounts]', row.user_id, err instanceof Error ? err.message : err);
    }
  }
  return { purged, failed };
}
