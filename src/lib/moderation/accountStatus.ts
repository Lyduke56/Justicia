/**
 * Account standing: suspension, termination and automatic reinstatement.
 * SERVER-SIDE ONLY (service-role client, Supabase Auth admin API).
 *
 * Enforcement has two layers:
 *  1. Supabase Auth ban (`ban_duration`). A banned user's existing access token is rejected by
 *     auth.getUser() immediately (403 user_banned), refresh tokens stop working and sign-in is
 *     refused — so the proxy treats them as signed out on their very next request.
 *  2. public.profiles.account_status (active | suspended | terminated), the record the app and
 *     the admin portal read. Server actions also refuse non-active accounts (defence in depth).
 *
 * A suspension ends by itself when the Auth ban expires; the first time the account is seen
 * again (sign-in, any session check, or the admin Reports page) its status is set back to active
 * and a lawyer's directory listing is restored.
 */
import { after } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { emitLive, type LiveScope } from '@/lib/realtime/live';
import { sendEmail } from '@/lib/integrations/email';
import type { AccountStatus } from './constants';

type Db = SupabaseClient;

/** Termination = a ban that never practically expires (~100 years). */
const TERMINATION_BAN = '876000h';
const ACTIVE_CONSULTATION_STATUSES = ['pending', 'awaiting_client_confirmation', 'confirmed'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export interface AccountStanding {
  status: AccountStatus;
  /** ISO time the current suspension ends (null when not suspended). */
  suspendedUntil: string | null;
  /** Upheld suspensions on record (moderation_actions.action = 'suspension'). */
  suspensionCount: number;
}

// ─── Small helpers ──────────────────────────────────────────────────────────

export function formatManilaDateTime(iso: string): string {
  const d = new Date(new Date(iso).getTime() + 8 * 60 * 60 * 1000);
  const h24 = d.getUTCHours();
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const min = String(d.getUTCMinutes()).padStart(2, '0');
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()} at ${h12}:${min} ${h24 < 12 ? 'AM' : 'PM'} (PHT)`;
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

/** Broadcast a refresh to the users' open tabs after the response is sent. */
export function signalUsers(userIds: Array<string | null | undefined>, scopes: LiveScope[]): void {
  try {
    after(() => emitLive(userIds, scopes));
  } catch {
    void emitLive(userIds, scopes);
  }
}

/**
 * Most foreign keys (reports.reporter_id, notifications.user_id, …) point at public.profiles.
 * Older accounts only exist in public.user_accounts, so a profiles row is created on demand.
 */
export async function ensureProfileRow(db: Db, userId: string): Promise<boolean> {
  const { data: existing } = await db.from('profiles').select('user_id').eq('user_id', userId).maybeSingle();
  if (existing) return true;
  const { data: account } = await db
    .from('user_accounts')
    .select('email, full_name, phone, role')
    .eq('id', userId)
    .maybeSingle();
  if (!account?.email) return false;
  const { error } = await db.from('profiles').upsert(
    {
      user_id: userId,
      email: account.email,
      full_name: account.full_name ?? '',
      phone: account.phone ?? null,
      role: account.role ?? 'client',
    },
    { onConflict: 'user_id' }
  );
  if (error) console.warn('[ensureProfileRow]', userId, error.message);
  return !error;
}

/** In-app notification (never throws). */
export async function notifyAccount(
  db: Db,
  userId: string,
  type: string,
  title: string,
  body: string,
  payload: Record<string, unknown> = {}
): Promise<void> {
  try {
    if (!(await ensureProfileRow(db, userId))) return;
    const { error } = await db.from('notifications').insert({
      user_id: userId,
      type,
      title,
      body,
      data: payload,
      metadata: payload,
      channel: 'in_app',
      is_read: false,
    });
    if (error) console.warn('[notifyAccount]', type, error.message);
    else signalUsers([userId], ['notifications']);
  } catch (err) {
    console.warn('[notifyAccount] unexpected', err);
  }
}

async function writeAudit(
  db: Db,
  actorId: string | null,
  action: string,
  targetId: string,
  details: Record<string, unknown>
): Promise<void> {
  const { error } = await db.from('audit_log').insert({
    actor_id: actorId,
    action,
    target_type: 'user_account',
    target_id: targetId,
    details,
  });
  if (error) console.warn('[moderation audit]', action, error.message);
}

// ─── Reading the standing ───────────────────────────────────────────────────

/** Auth ban end (ms since epoch), or null when the user is not banned. */
export async function getBanUntil(db: Db, userId: string): Promise<number | null> {
  try {
    const { data } = await db.auth.admin.getUserById(userId);
    const until = (data?.user as { banned_until?: string | null } | undefined)?.banned_until;
    const ms = until ? new Date(until).getTime() : NaN;
    return Number.isFinite(ms) && ms > Date.now() ? ms : null;
  } catch (err) {
    console.warn('[getBanUntil]', userId, err);
    return null;
  }
}

/** Upheld suspensions on record for the account, across all reports against it. */
export async function countSuspensions(db: Db, userId: string): Promise<number> {
  const { data: reports } = await db.from('reports').select('id').eq('target_id', userId);
  const ids = (reports ?? []).map((r: { id: string }) => r.id);
  if (ids.length === 0) return 0;
  const { count } = await db
    .from('moderation_actions')
    .select('id', { count: 'exact', head: true })
    .in('report_id', ids)
    .eq('action', 'suspension');
  return count ?? 0;
}

async function readStatus(db: Db, userId: string): Promise<AccountStatus> {
  const { data } = await db.from('profiles').select('account_status').eq('user_id', userId).maybeSingle();
  return ((data?.account_status as AccountStatus | undefined) ?? 'active');
}

export async function getAccountStanding(db: Db, userId: string): Promise<AccountStanding> {
  let status = await readStatus(db, userId);
  let suspendedUntil: string | null = null;
  if (status === 'suspended') {
    const until = await getBanUntil(db, userId);
    if (until) suspendedUntil = new Date(until).toISOString();
    else status = await reinstateExpiredSuspension(db, userId);
  }
  return { status, suspendedUntil, suspensionCount: await countSuspensions(db, userId) };
}

/**
 * Sets a suspended account back to active once its Auth ban has expired (idempotent).
 * Returns the resulting status.
 */
export async function reinstateExpiredSuspension(db: Db, userId: string): Promise<AccountStatus> {
  if (await getBanUntil(db, userId)) return 'suspended';

  const { data: updated, error } = await db
    .from('profiles')
    .update({ account_status: 'active', updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('account_status', 'suspended')
    .select('user_id');
  if (error) {
    console.warn('[reinstateExpiredSuspension]', userId, error.message);
    return 'suspended';
  }
  if (!updated || updated.length === 0) return readStatus(db, userId);

  // Restore the lawyer's Find a Lawyer listing if it was visible before the suspension.
  const { data: last } = await db
    .from('audit_log')
    .select('details')
    .eq('action', 'account.suspended')
    .eq('target_id', userId)
    .order('created_at', { ascending: false })
    .limit(1);
  const wasVisible = (last?.[0]?.details as { lawyerWasVisible?: boolean } | null)?.lawyerWasVisible === true;
  if (wasVisible) {
    await db
      .from('lawyer_profiles')
      .update({ is_visible: true, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('verification_status', 'approved');
  }
  await writeAudit(db, null, 'account.reinstated', userId, { reason: 'suspension_expired' });
  await notifyAccount(
    db,
    userId,
    'account_reinstated',
    'Your account is active again',
    'Your suspension has ended and full access to Justicia has been restored. Please keep to the community guidelines; further violations can lead to permanent termination.'
  );
  return 'active';
}

/** Message shown to a user whose account cannot be used. */
export function accountBlockedMessage(standing: Pick<AccountStanding, 'status' | 'suspendedUntil'>): string {
  if (standing.status === 'terminated') {
    return 'This account has been permanently terminated for violating the Justicia community guidelines.';
  }
  if (standing.status === 'pending_deletion') {
    return 'This account is scheduled for deletion and can no longer be used.';
  }
  return standing.suspendedUntil
    ? `This account is suspended until ${formatManilaDateTime(standing.suspendedUntil)} for violating the Justicia community guidelines.`
    : 'This account is currently suspended for violating the Justicia community guidelines.';
}

/**
 * Session guard used by server actions: null when the account may be used, otherwise the
 * message to show. Expired suspensions are reinstated on the spot.
 */
export async function checkAccountAccess(db: Db, userId: string, knownStatus?: string | null): Promise<string | null> {
  const status = (knownStatus as AccountStatus | null | undefined) ?? (await readStatus(db, userId));
  if (status === 'active') return null;
  if (status === 'suspended') {
    const until = await getBanUntil(db, userId);
    if (!until && (await reinstateExpiredSuspension(db, userId)) === 'active') return null;
    return accountBlockedMessage({ status, suspendedUntil: until ? new Date(until).toISOString() : null });
  }
  return accountBlockedMessage({ status, suspendedUntil: null });
}

// ─── Consultations of a suspended / terminated account ─────────────────────

/**
 * Cancels the account's active consultations (as client or lawyer) that start before `beforeMs`
 * (all of them when null). Paid bookings are flagged for refund and leave the lawyer's sales;
 * the other participant is notified. Returns the number cancelled.
 */
async function cancelActiveConsultations(
  db: Db,
  userId: string,
  adminId: string,
  beforeMs: number | null,
  reasonForOthers: string
): Promise<number> {
  const { data } = await db
    .from('consultations')
    .select('id, client_id, lawyer_id, scheduled_start, status, concern_summary')
    .or(`client_id.eq.${userId},lawyer_id.eq.${userId}`)
    .in('status', ACTIVE_CONSULTATION_STATUSES);
  const rows = (data ?? []) as Array<{
    id: string;
    client_id: string;
    lawyer_id: string;
    scheduled_start: string | null;
    status: string;
    concern_summary: string | null;
  }>;

  let cancelled = 0;
  for (const row of rows) {
    const startMs = row.scheduled_start ? new Date(row.scheduled_start).getTime() : null;
    if (beforeMs !== null && startMs !== null && startMs >= beforeMs) continue;

    let meta: Record<string, unknown> = {};
    try {
      const parsed = row.concern_summary ? JSON.parse(row.concern_summary) : {};
      meta = parsed && typeof parsed === 'object' ? parsed : { description: row.concern_summary };
    } catch {
      meta = { description: row.concern_summary };
    }
    const proof = meta.paymentProof as { status?: string } | undefined;
    const paid = row.status === 'confirmed' || proof?.status === 'verified';
    const refundPending = paid || proof?.status === 'submitted';
    const nowIso = new Date().toISOString();
    const nextMeta = {
      ...meta,
      cancellationReason: reasonForOthers,
      cancelledBy: 'admin',
      cancelledAt: nowIso,
      ...(refundPending ? { refundStatus: 'pending' } : {}),
    };

    const { data: updated, error } = await db
      .from('consultations')
      .update({ status: 'cancelled', cancelled_by: adminId, concern_summary: JSON.stringify(nextMeta), updated_at: nowIso })
      .eq('id', row.id)
      .in('status', ACTIVE_CONSULTATION_STATUSES)
      .select('id');
    if (error || !updated?.length) {
      if (error) console.warn('[cancelActiveConsultations]', row.id, error.message);
      continue;
    }
    cancelled++;

    if (paid) {
      await db
        .from('payments')
        .update({ status: 'refunded', payout_status: 'not_applicable', updated_at: nowIso })
        .eq('consultation_id', row.id)
        .eq('status', 'paid');
    }
    // The lawyer no longer needs the documents shared for this booking.
    const shared = Array.isArray(meta.attachedFiles)
      ? (meta.attachedFiles as Array<{ documentId?: unknown }>).map((f) => f?.documentId).filter((id): id is string => typeof id === 'string')
      : [];
    if (shared.length) {
      await db
        .from('document_access_grants')
        .update({ revoked_at: nowIso })
        .eq('grantee_id', row.lawyer_id)
        .eq('granted_by', row.client_id)
        .is('revoked_at', null)
        .in('document_id', shared);
    }

    const otherId = row.client_id === userId ? row.lawyer_id : row.client_id;
    await db.from('messages').insert({
      conversation_or_thread_id: row.id,
      sender_id: adminId,
      role: 'system',
      content: `This consultation was cancelled by Justicia. ${reasonForOthers}`,
      attachment_ids: [],
      citations: null,
    });
    await notifyAccount(
      db,
      otherId,
      'consultation_cancelled',
      'Consultation Cancelled by Justicia',
      `${reasonForOthers}${refundPending ? ' Any payment you made for it will be refunded.' : ''}`,
      { consultationId: row.id, refundPending, cancelledBy: 'admin' }
    );
    signalUsers([row.client_id, row.lawyer_id], ['consultations', 'payments', 'documents', 'messages']);
  }
  return cancelled;
}

/** Hides a lawyer from Find a Lawyer. Returns whether the listing was visible before. */
async function hideLawyerListing(db: Db, userId: string, alreadySuspended: boolean): Promise<boolean> {
  let wasVisible = false;
  if (alreadySuspended) {
    // Keep the visibility recorded by the suspension that is already in force.
    const { data: last } = await db
      .from('audit_log')
      .select('details')
      .eq('action', 'account.suspended')
      .eq('target_id', userId)
      .order('created_at', { ascending: false })
      .limit(1);
    wasVisible = (last?.[0]?.details as { lawyerWasVisible?: boolean } | null)?.lawyerWasVisible === true;
  } else {
    const { data: lawyer } = await db.from('lawyer_profiles').select('is_visible').eq('user_id', userId).maybeSingle();
    wasVisible = lawyer?.is_visible === true;
  }
  await db.from('lawyer_profiles').update({ is_visible: false, updated_at: new Date().toISOString() }).eq('user_id', userId);
  return wasVisible;
}

async function emailAccount(db: Db, userId: string, subject: string, heading: string, paragraphs: string[]): Promise<void> {
  try {
    const { data } = await db.from('profiles').select('email, full_name').eq('user_id', userId).maybeSingle();
    const email = data?.email;
    if (!email) return;
    const name = data?.full_name || 'Justicia user';
    await sendEmail({
      to: email,
      subject,
      html: `
        <div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;background:#fdf8f2;padding:40px;border-radius:8px;">
          <h1 style="color:#34150F;font-size:22px;margin-bottom:8px;">${escapeHtml(heading)}</h1>
          <p style="color:#5C4535;line-height:1.6;">Dear ${escapeHtml(name)},</p>
          ${paragraphs.map((p) => `<p style="color:#5C4535;line-height:1.6;">${escapeHtml(p)}</p>`).join('')}
          <hr style="border:1px solid #E8DCCB;margin:24px 0;" />
          <p style="color:#A69584;font-size:12px;">Justicia — AI-Powered Philippine Legal Assistance</p>
        </div>`,
      text: [heading, `Dear ${name},`, ...paragraphs].join('\n\n'),
    });
  } catch (err) {
    console.warn('[emailAccount]', err);
  }
}

// ─── Enforcement ────────────────────────────────────────────────────────────

export interface EnforcementInput {
  userId: string;
  adminId: string;
  reportId: string;
  /** Shown to the account owner. */
  reason: string;
}

/**
 * Suspends the account for `days`. A suspension issued while another one is still running
 * starts when the current one ends. Returns the new end time.
 */
export async function suspendAccount(db: Db, input: EnforcementInput & { days: number }): Promise<{ until: string }> {
  const { userId, adminId, reportId, reason, days } = input;
  if (!(await ensureProfileRow(db, userId))) throw new Error('The reported account has no profile record.');

  const status = await readStatus(db, userId);
  const currentUntil = status === 'suspended' ? await getBanUntil(db, userId) : null;
  const startMs = Math.max(Date.now(), currentUntil ?? 0);
  const untilMs = startMs + days * 24 * 60 * 60 * 1000;
  const banHours = Math.ceil((untilMs - Date.now()) / (60 * 60 * 1000));

  const { error: banError } = await db.auth.admin.updateUserById(userId, { ban_duration: `${banHours}h` });
  if (banError) throw new Error(`Could not suspend the sign-in: ${banError.message}`);

  const nowIso = new Date().toISOString();
  const { error: statusError } = await db
    .from('profiles')
    .update({ account_status: 'suspended', updated_at: nowIso })
    .eq('user_id', userId);
  if (statusError) {
    // Keep both layers consistent: undo the ban if the status could not be recorded.
    await db.auth.admin.updateUserById(userId, { ban_duration: currentUntil ? `${Math.ceil((currentUntil - Date.now()) / 3600000)}h` : 'none' });
    throw new Error(`Could not record the suspension: ${statusError.message}`);
  }

  const lawyerWasVisible = await hideLawyerListing(db, userId, status === 'suspended');
  const until = new Date(untilMs).toISOString();
  const cancelled = await cancelActiveConsultations(
    db,
    userId,
    adminId,
    untilMs,
    'The other participant’s account was suspended, so this consultation could not go ahead.'
  );
  await writeAudit(db, adminId, 'account.suspended', userId, { reportId, days, until, lawyerWasVisible, cancelledConsultations: cancelled });

  await notifyAccount(
    db,
    userId,
    'account_suspended',
    'Your account has been suspended',
    `After reviewing a report, your account is suspended until ${formatManilaDateTime(until)}. Reason: ${reason}`,
    { reportId, until }
  );
  await emailAccount(db, userId, 'Your Justicia account has been suspended', 'Account suspended', [
    `After reviewing a report about your account, our team has suspended it until ${formatManilaDateTime(until)}.`,
    `Reason: ${reason}`,
    cancelled > 0
      ? `${cancelled} consultation(s) scheduled during the suspension were cancelled, and any payments for them will be refunded.`
      : 'You will be able to sign in again automatically when the suspension ends.',
    'Accounts that receive more than three suspensions are permanently terminated.',
  ]);
  return { until };
}

/** Permanently terminates the account. */
export async function terminateAccount(db: Db, input: EnforcementInput): Promise<void> {
  const { userId, adminId, reportId, reason } = input;
  if (!(await ensureProfileRow(db, userId))) throw new Error('The reported account has no profile record.');
  const previous = await readStatus(db, userId);

  const { error: banError } = await db.auth.admin.updateUserById(userId, { ban_duration: TERMINATION_BAN });
  if (banError) throw new Error(`Could not block the sign-in: ${banError.message}`);

  const nowIso = new Date().toISOString();
  const { error: statusError } = await db
    .from('profiles')
    .update({ account_status: 'terminated', updated_at: nowIso })
    .eq('user_id', userId);
  if (statusError) throw new Error(`Could not record the termination: ${statusError.message}`);

  await db
    .from('lawyer_profiles')
    .update({ is_visible: false, is_available: false, updated_at: nowIso })
    .eq('user_id', userId);
  const cancelled = await cancelActiveConsultations(
    db,
    userId,
    adminId,
    null,
    'The other participant’s account was closed by Justicia, so this consultation will not take place.'
  );
  await writeAudit(db, adminId, 'account.terminated', userId, { reportId, previousStatus: previous, cancelledConsultations: cancelled });

  await emailAccount(db, userId, 'Your Justicia account has been terminated', 'Account terminated', [
    'After reviewing a report about your account, our team has permanently terminated it for violating the Justicia community guidelines.',
    `Reason: ${reason}`,
    'You can no longer sign in. Any pending payments for cancelled consultations will be refunded to the clients concerned.',
  ]);
}
