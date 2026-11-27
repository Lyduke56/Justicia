'use server';

/**
 * Account reports (client ⇄ lawyer, filed from Messages) and their admin review.
 *
 *  - submitAccountReportAction    a client or lawyer reports the other participant of a conversation,
 *                                 with a reason, details, evidence files and (optionally) the conversation.
 *  - getAdminReportsData          admin Reports tab list.
 *  - getAdminReportEvidenceAction short-lived links to the evidence + the captured conversation.
 *  - moderateReportAction         suspend / terminate / dismiss. Each account can be suspended
 *                                 MAX_SUSPENSIONS times; an upheld report after that terminates it.
 *
 * Evidence is stored in the private `case-documents` bucket under `report-evidence/{reportId}/…`,
 * which only the service role can read.
 */

import { randomUUID } from 'crypto';
import { attorneyNameOr } from '@/lib/utils/attorneyName';
import { checkRateLimit } from '@/lib/security/rateLimit';
import { FILE_CONTENT_MISMATCH, fileMatchesExtension } from '@/lib/security/fileType';
import { revalidatePath } from 'next/cache';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import {
  MAX_SUSPENSIONS,
  REPORT_DAILY_LIMIT,
  REPORT_DETAILS_MAX,
  REPORT_DETAILS_MIN,
  REPORT_FILE_EXTENSIONS,
  REPORT_MAX_FILES,
  REPORT_MAX_FILE_BYTES,
  REPORT_MAX_TOTAL_BYTES,
  REPORT_REASONS,
  SUSPENSION_DAY_OPTIONS,
  parseReportReason,
  type AccountStatus,
} from '@/lib/moderation/constants';
import {
  checkAccountAccess,
  ensureProfileRow,
  getBanUntil,
  notifyAccount,
  reinstateExpiredSuspension,
  suspendAccount,
  terminateAccount,
} from '@/lib/moderation/accountStatus';
import type {
  AdminReportEvidence,
  AdminReportEvidenceFile,
  AdminReportItem,
  AdminReportStatus,
  AdminModerationDecision,
  AdminReportConversationMessage,
} from '@/types/admin';

type Db = SupabaseClient;

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EVIDENCE_BUCKET = 'case-documents';
const EVIDENCE_PREFIX = 'report-evidence';
const CONVERSATION_FILE = 'conversation.json';
const MAX_CONVERSATION_MESSAGES = 300;
const OPEN_STATUSES: AdminReportStatus[] = ['open', 'under_review'];
/** A report left "under review" by an interrupted decision can be picked up again after this. */
const CLAIM_TIMEOUT_MS = 2 * 60 * 1000;
const MIME_BY_EXT: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  pdf: 'application/pdf',
};

async function getDb(): Promise<Db> {
  return (await createServiceClient()) as unknown as Db;
}

function fileExtension(name: string): string {
  const idx = name.lastIndexOf('.');
  return idx === -1 ? '' : name.slice(idx + 1).toLowerCase();
}

function evidenceKind(path: string): AdminReportEvidenceFile['kind'] {
  if (path.endsWith(`/${CONVERSATION_FILE}`)) return 'conversation';
  const ext = fileExtension(path);
  if (ext === 'pdf') return 'pdf';
  if (['png', 'jpg', 'jpeg', 'webp'].includes(ext)) return 'image';
  return 'file';
}

/** `report-evidence/{id}/2-screenshot.png` → `screenshot.png` */
function evidenceName(path: string): string {
  if (path.endsWith(`/${CONVERSATION_FILE}`)) return 'Conversation transcript';
  const base = path.split('/').pop() ?? path;
  return base.replace(/^\d+-/, '');
}

function safeFileName(name: string): string {
  const ext = fileExtension(name);
  const stem = name.slice(0, name.length - (ext ? ext.length + 1 : 0));
  const clean = stem.normalize('NFKD').replace(/[^\w.-]+/g, '_').replace(/_+/g, '_').slice(0, 60) || 'evidence';
  return ext ? `${clean}.${ext}` : clean;
}

function revalidateReports() {
  try {
    revalidatePath('/admin/reports');
  } catch {
    // no request scope (tests / scripts)
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// Client / lawyer: report the other participant of a conversation
// ═════════════════════════════════════════════════════════════════════════════

export type SubmitReportResult =
  | { success: true; reportId: string; targetName: string }
  | { success?: false; error: string };

interface PairInfo {
  otherId: string;
  consultationIds: string[];
}

/** threadId is the other participant's user id (or any consultation id between the two). */
async function resolvePair(db: Db, threadId: string, userId: string): Promise<PairInfo | null> {
  if (!UUID_REGEX.test(threadId)) return null;
  let otherId = threadId;
  const { data: byConsultation } = await db
    .from('consultations')
    .select('client_id, lawyer_id')
    .eq('id', threadId)
    .or(`client_id.eq.${userId},lawyer_id.eq.${userId}`)
    .maybeSingle();
  if (byConsultation) {
    otherId = byConsultation.client_id === userId ? byConsultation.lawyer_id : byConsultation.client_id;
  }
  if (!UUID_REGEX.test(otherId) || otherId === userId) return null;

  const { data } = await db
    .from('consultations')
    .select('id')
    .or(`and(client_id.eq.${userId},lawyer_id.eq.${otherId}),and(client_id.eq.${otherId},lawyer_id.eq.${userId})`);
  const ids = (data ?? []).map((r: { id: string }) => r.id);
  return ids.length ? { otherId, consultationIds: ids } : null;
}

/**
 * FormData fields: threadId, reasonKey, details, includeConversation ("true" | "false"),
 * files (0–5 images / PDFs).
 */
export async function submitAccountReportAction(formData: FormData): Promise<SubmitReportResult> {
  const uploaded: string[] = [];
  let db: Db | null = null;
  try {
    const threadId = String(formData.get('threadId') ?? '').trim();
    const reasonKey = String(formData.get('reasonKey') ?? '').trim();
    const details = String(formData.get('details') ?? '').trim();
    const includeConversation = String(formData.get('includeConversation') ?? 'true') !== 'false';
    const files = formData.getAll('files').filter((f): f is File => typeof f === 'object' && f !== null && 'arrayBuffer' in f && (f as File).size > 0);

    const reason = REPORT_REASONS.find((r) => r.key === reasonKey);
    if (!reason) return { error: 'Please choose what the problem is.' };
    if (details.length < REPORT_DETAILS_MIN) {
      return { error: `Please describe what happened (at least ${REPORT_DETAILS_MIN} characters).` };
    }
    if (details.length > REPORT_DETAILS_MAX) return { error: `The details must be ${REPORT_DETAILS_MAX} characters or fewer.` };
    if (files.length > REPORT_MAX_FILES) return { error: `You can attach up to ${REPORT_MAX_FILES} files.` };
    let totalBytes = 0;
    for (const file of files) {
      const ext = fileExtension(file.name);
      if (!(REPORT_FILE_EXTENSIONS as readonly string[]).includes(ext)) {
        return { error: `“${file.name}” is not supported. Attach PNG, JPG, WEBP or PDF files.` };
      }
      if (file.size > REPORT_MAX_FILE_BYTES) return { error: `“${file.name}” is larger than 5 MB.` };
      totalBytes += file.size;
    }
    if (totalBytes > REPORT_MAX_TOTAL_BYTES) return { error: 'The attached files must be 8 MB or less in total.' };

    // ── Session ──
    const auth = await createClient();
    const { data: authData } = await auth.auth.getUser();
    const user = authData?.user;
    if (!user) return { error: 'Your session has expired. Please sign in again to continue.' };
    db = await getDb();
    const blocked = await checkAccountAccess(db, user.id);
    if (blocked) return { error: blocked };
    const limited = await checkRateLimit('report', user.id);
    if (limited) return { error: limited };
    for (const file of files) {
      if (!(await fileMatchesExtension(file, fileExtension(file.name)))) {
        return { error: `“${file.name}”: ${FILE_CONTENT_MISMATCH}` };
      }
    }
    if (!(await ensureProfileRow(db, user.id))) {
      return { error: 'We could not load your account profile. Please sign out and sign in again.' };
    }

    // ── Who is being reported ──
    const pair = await resolvePair(db, threadId, user.id);
    if (!pair) return { error: 'You can only report someone you have had a consultation with.' };
    const { data: target } = await db
      .from('user_accounts')
      .select('id, full_name, email, role')
      .eq('id', pair.otherId)
      .maybeSingle();
    if (!target) return { error: 'This account could not be found.' };
    if (target.role === 'admin') return { error: 'This account cannot be reported.' };
    let targetName = target.full_name || target.email?.split('@')[0] || 'this user';
    if (target.role === 'lawyer') {
      const { data: lawyer } = await db.from('lawyer_profiles').select('full_name').eq('user_id', target.id).maybeSingle();
      if (lawyer?.full_name) targetName = attorneyNameOr(lawyer.full_name, targetName);
    }

    // ── Abuse limits ──
    const { data: duplicate } = await db
      .from('reports')
      .select('id')
      .eq('reporter_id', user.id)
      .eq('target_id', pair.otherId)
      .in('status', OPEN_STATUSES)
      .limit(1);
    if (duplicate?.length) {
      return { error: `You already have a report about ${targetName} under review. Our team will update you once it is resolved.` };
    }
    const { count: recent } = await db
      .from('reports')
      .select('id', { count: 'exact', head: true })
      .eq('reporter_id', user.id)
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
    if ((recent ?? 0) >= REPORT_DAILY_LIMIT) {
      return { error: 'You have reached the daily limit for reports. Please try again tomorrow.' };
    }

    // ── Evidence ──
    const reportId = randomUUID();
    for (const [index, file] of files.entries()) {
      const path = `${EVIDENCE_PREFIX}/${reportId}/${index + 1}-${safeFileName(file.name)}`;
      const { error } = await db.storage.from(EVIDENCE_BUCKET).upload(path, Buffer.from(await file.arrayBuffer()), {
        contentType: MIME_BY_EXT[fileExtension(file.name)] ?? 'application/octet-stream',
        upsert: false,
      });
      if (error) {
        console.error('[submitAccountReportAction] upload failed:', error.message);
        throw new Error('upload');
      }
      uploaded.push(path);
    }

    if (includeConversation) {
      const { data: msgs } = await db
        .from('messages')
        .select('id, sender_id, role, content, sent_at')
        .in('conversation_or_thread_id', pair.consultationIds)
        .order('sent_at', { ascending: false })
        .limit(MAX_CONVERSATION_MESSAGES);
      const transcript: AdminReportConversationMessage[] = ((msgs ?? []) as Array<{
        id: string;
        sender_id: string;
        role: string | null;
        content: string;
        sent_at: string;
      }>)
        .reverse()
        .map((m) => ({
          id: m.id,
          from: m.role === 'system' ? 'system' : m.sender_id === user.id ? 'reporter' : 'reported',
          content: m.content,
          sentAt: m.sent_at,
        }));
      if (transcript.length) {
        const path = `${EVIDENCE_PREFIX}/${reportId}/${CONVERSATION_FILE}`;
        const body = JSON.stringify({ version: 1, capturedAt: new Date().toISOString(), messages: transcript });
        const { error } = await db.storage
          .from(EVIDENCE_BUCKET)
          .upload(path, Buffer.from(body, 'utf8'), { contentType: 'application/json', upsert: false });
        if (error) {
          console.error('[submitAccountReportAction] transcript upload failed:', error.message);
          throw new Error('upload');
        }
        uploaded.push(path);
      }
    }

    // ── Report row ──
    const { error: insertError } = await db.from('reports').insert({
      id: reportId,
      reporter_id: user.id,
      target_type: target.role === 'lawyer' ? 'lawyer' : 'user',
      target_id: pair.otherId,
      category: reason.category,
      reason: `${reason.label}\n${details}`,
      evidence_paths: uploaded,
      status: 'open',
    });
    if (insertError) {
      console.error('[submitAccountReportAction] insert failed:', insertError.message);
      throw new Error('insert');
    }

    await db.from('audit_log').insert({
      actor_id: user.id,
      action: 'report.submitted',
      target_type: 'report',
      target_id: reportId,
      details: { targetId: pair.otherId, category: reason.category, reason: reason.key, evidenceCount: uploaded.length },
    });
    await notifyAccount(
      db,
      user.id,
      'report_submitted',
      'Report received',
      `Thank you. Your report about ${targetName} was sent to the Justicia team. We will notify you once it has been reviewed.`,
      { reportId }
    );
    revalidateReports();
    return { success: true, reportId, targetName };
  } catch (err) {
    if (db && uploaded.length) await db.storage.from(EVIDENCE_BUCKET).remove(uploaded);
    if (!(err instanceof Error && ['upload', 'insert'].includes(err.message))) {
      console.error('[submitAccountReportAction] unexpected error:', err);
    }
    return { error: 'We could not send your report right now. Please try again in a moment.' };
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// Admin: Reports tab
// ═════════════════════════════════════════════════════════════════════════════

async function requireAdmin(): Promise<{ id: string }> {
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) throw new Error('Administrator sign-in required.');
  const db = await getDb();
  const { data: account } = await db.from('user_accounts').select('role').eq('id', user.id).maybeSingle();
  if (account?.role !== 'admin') throw new Error('Administrator access required.');
  return { id: user.id };
}

interface ReportRow {
  id: string;
  reporter_id: string;
  target_type: string;
  target_id: string;
  category: string;
  reason: string;
  evidence_paths: string[] | null;
  status: AdminReportStatus;
  resolution_notes: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

const REPORT_COLUMNS =
  'id, reporter_id, target_type, target_id, category, reason, evidence_paths, status, resolution_notes, resolved_at, created_at, updated_at';

/** Builds the admin view of the given reports (people, account standing, decisions). */
async function buildReportItems(db: Db, rows: ReportRow[]): Promise<AdminReportItem[]> {
  if (rows.length === 0) return [];
  const targetIds = [...new Set(rows.map((r) => r.target_id))];
  const peopleIds = [...new Set([...targetIds, ...rows.map((r) => r.reporter_id)])];

  const [{ data: accounts }, { data: profiles }, { data: lawyers }, { data: allAgainst }, { data: decisions }] = await Promise.all([
    db.from('user_accounts').select('id, full_name, email, role').in('id', peopleIds),
    db.from('profiles').select('user_id, full_name, email, role, account_status').in('user_id', peopleIds),
    db.from('lawyer_profiles').select('user_id, full_name').in('user_id', peopleIds),
    db.from('reports').select('id, target_id, status').in('target_id', targetIds),
    db.from('moderation_actions').select('report_id, admin_id, action, rationale, created_at').in('report_id', rows.map((r) => r.id)).order('created_at', { ascending: false }),
  ]);

  const accountById = new Map((accounts ?? []).map((a: { id: string }) => [a.id, a as { id: string; full_name: string | null; email: string | null; role: string | null }]));
  const profileById = new Map(
    (profiles ?? []).map((p: { user_id: string }) => [p.user_id, p as { user_id: string; full_name: string | null; email: string | null; role: string | null; account_status: AccountStatus | null }])
  );
  const lawyerName = new Map((lawyers ?? []).map((l: { user_id: string; full_name: string | null }) => [l.user_id, l.full_name]));

  // Suspensions on record per target, across every report against them.
  const againstRows = (allAgainst ?? []) as Array<{ id: string; target_id: string; status: AdminReportStatus }>;
  const targetOfReport = new Map(againstRows.map((r) => [r.id, r.target_id]));
  const { data: suspensions } = againstRows.length
    ? await db.from('moderation_actions').select('report_id').in('report_id', againstRows.map((r) => r.id)).eq('action', 'suspension')
    : { data: [] };
  const suspensionCount = new Map<string, number>();
  for (const s of (suspensions ?? []) as Array<{ report_id: string }>) {
    const t = targetOfReport.get(s.report_id);
    if (t) suspensionCount.set(t, (suspensionCount.get(t) ?? 0) + 1);
  }

  // Current account status (expired suspensions are reinstated here).
  const statusById = new Map<string, AccountStatus>();
  const untilById = new Map<string, string | null>();
  for (const id of targetIds) {
    let status = (profileById.get(id)?.account_status ?? 'active') as AccountStatus;
    let until: string | null = null;
    if (status === 'suspended') {
      const ms = await getBanUntil(db, id);
      if (ms) until = new Date(ms).toISOString();
      else status = await reinstateExpiredSuspension(db, id);
    }
    statusById.set(id, status);
    untilById.set(id, until);
  }

  const decisionByReport = new Map<string, { admin_id: string; action: AdminModerationDecision; rationale: string; created_at: string }>();
  for (const d of (decisions ?? []) as Array<{ report_id: string; admin_id: string; action: AdminModerationDecision; rationale: string; created_at: string }>) {
    if (!decisionByReport.has(d.report_id)) decisionByReport.set(d.report_id, d);
  }
  const adminIds = [...new Set([...decisionByReport.values()].map((d) => d.admin_id))].filter((id) => !accountById.has(id));
  if (adminIds.length) {
    const { data: admins } = await db.from('user_accounts').select('id, full_name, email, role').in('id', adminIds);
    for (const a of (admins ?? []) as Array<{ id: string; full_name: string | null; email: string | null; role: string | null }>) accountById.set(a.id, a);
  }

  const person = (id: string) => {
    const account = accountById.get(id);
    const profile = profileById.get(id);
    const email = account?.email || profile?.email || '';
    const role = (account?.role || profile?.role || 'unknown') as AdminReportItem['reporter']['role'];
    const name = lawyerName.get(id) || account?.full_name || profile?.full_name || email.split('@')[0] || 'Unknown account';
    return { id, name, email, role };
  };

  return rows.map((r) => {
    const { label, details } = parseReportReason(r.reason);
    const against = againstRows.filter((x) => x.target_id === r.target_id);
    const decision = decisionByReport.get(r.id);
    return {
      id: r.id,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      status: r.status,
      category: r.category,
      reasonLabel: label,
      details,
      reporter: person(r.reporter_id),
      target: {
        ...person(r.target_id),
        accountStatus: statusById.get(r.target_id) ?? 'active',
        suspendedUntil: untilById.get(r.target_id) ?? null,
        suspensionCount: suspensionCount.get(r.target_id) ?? 0,
        openReportCount: against.filter((x) => OPEN_STATUSES.includes(x.status)).length,
        totalReportCount: against.length,
      },
      evidence: (r.evidence_paths ?? []).map((path) => ({ path, name: evidenceName(path), kind: evidenceKind(path) })),
      resolution:
        r.status === 'resolved' || r.status === 'dismissed'
          ? {
              action: decision?.action ?? (r.status === 'dismissed' ? 'no_action' : 'termination'),
              notes: r.resolution_notes ?? decision?.rationale ?? '',
              resolvedAt: r.resolved_at,
              adminName: decision ? person(decision.admin_id).name : 'Justicia',
            }
          : null,
    };
  });
}

export async function getAdminReportsData(): Promise<AdminReportItem[]> {
  try {
    await requireAdmin();
    const db = await getDb();
    const { data, error } = await db.from('reports').select(REPORT_COLUMNS).in('target_type', ['user', 'lawyer']).order('created_at', { ascending: false }).limit(500);
    if (error) throw error;
    return await buildReportItems(db, (data ?? []) as ReportRow[]);
  } catch (err) {
    console.error('[getAdminReportsData] error:', err);
    throw new Error('Unable to load reports.');
  }
}

export async function getAdminReportEvidenceAction(
  reportId: string
): Promise<{ success: true; evidence: AdminReportEvidence } | { success?: false; error: string }> {
  try {
    if (!UUID_REGEX.test(reportId ?? '')) return { error: 'Report not found.' };
    await requireAdmin();
    const db = await getDb();
    const { data: report } = await db.from('reports').select('id, evidence_paths').eq('id', reportId).maybeSingle();
    if (!report) return { error: 'Report not found.' };

    const paths = ((report.evidence_paths ?? []) as string[]).filter((p) => p.startsWith(`${EVIDENCE_PREFIX}/${reportId}/`));
    const files: AdminReportEvidence['files'] = [];
    let conversation: AdminReportConversationMessage[] | null = null;
    for (const path of paths) {
      const kind = evidenceKind(path);
      if (kind === 'conversation') {
        const { data: blob } = await db.storage.from(EVIDENCE_BUCKET).download(path);
        if (blob) {
          try {
            const parsed = JSON.parse(await blob.text()) as { messages?: AdminReportConversationMessage[] };
            conversation = Array.isArray(parsed.messages) ? parsed.messages : [];
          } catch {
            conversation = [];
          }
        }
        continue;
      }
      const { data: signed } = await db.storage.from(EVIDENCE_BUCKET).createSignedUrl(path, 10 * 60);
      files.push({ path, name: evidenceName(path), kind, url: signed?.signedUrl ?? null });
    }
    return { success: true, evidence: { files, conversation } };
  } catch (err) {
    console.error('[getAdminReportEvidenceAction] error:', err);
    return { error: 'The evidence could not be loaded. Please try again.' };
  }
}

export type ModerationDecisionInput = 'suspend' | 'terminate' | 'dismiss';

export type ModerateReportResult =
  | {
      success: true;
      outcome: 'suspended' | 'terminated' | 'dismissed';
      /** True when a suspension was escalated to termination (offense after the 3rd suspension). */
      escalated: boolean;
      suspendedUntil: string | null;
      report: AdminReportItem | null;
    }
  | { success?: false; error: string };

export async function moderateReportAction(
  reportId: string,
  decision: ModerationDecisionInput,
  options: { days?: number; notes?: string } = {}
): Promise<ModerateReportResult> {
  let db: Db | null = null;
  let claimed = false;
  try {
    if (!UUID_REGEX.test(reportId ?? '')) return { error: 'Report not found.' };
    if (!['suspend', 'terminate', 'dismiss'].includes(decision)) return { error: 'Choose an action.' };
    const notes = typeof options.notes === 'string' ? options.notes.trim() : '';
    if (notes.length < 10) {
      return { error: decision === 'dismiss' ? 'Please note why the report is dismissed (at least 10 characters).' : 'Please give the reason the account owner will see (at least 10 characters).' };
    }
    if (notes.length > 1000) return { error: 'The note must be 1000 characters or fewer.' };
    const days = Number(options.days);
    if (decision === 'suspend' && !(SUSPENSION_DAY_OPTIONS as readonly number[]).includes(days)) {
      return { error: 'Choose a suspension length.' };
    }

    const admin = await requireAdmin();
    db = await getDb();
    if (!(await ensureProfileRow(db, admin.id))) return { error: 'Your administrator profile could not be loaded.' };

    const { data: found } = await db.from('reports').select(REPORT_COLUMNS).eq('id', reportId).maybeSingle();
    const report = found as ReportRow | null;
    if (!report) return { error: 'Report not found.' };
    if (!OPEN_STATUSES.includes(report.status)) return { error: 'This report has already been resolved. Refresh to see the decision.' };
    if (report.target_id === admin.id) return { error: 'You cannot decide on a report about your own account.' };
    const { data: targetAccount } = await db.from('user_accounts').select('role, full_name, email').eq('id', report.target_id).maybeSingle();
    if (targetAccount?.role === 'admin') return { error: 'Administrator accounts cannot be suspended from reports.' };

    // Claim the report so two administrators cannot decide on it at the same time.
    const nowIso = new Date().toISOString();
    const staleIso = new Date(Date.now() - CLAIM_TIMEOUT_MS).toISOString();
    const { data: claim } = await db
      .from('reports')
      .update({ status: 'under_review', assigned_admin_id: admin.id, updated_at: nowIso })
      .eq('id', reportId)
      .or(`status.eq.open,and(status.eq.under_review,updated_at.lt."${staleIso}")`)
      .select('id');
    if (!claim?.length) return { error: 'This report is already being decided (by you in another tab or by another administrator). Please refresh in a moment.' };
    claimed = true;

    const status = (await db.from('profiles').select('account_status').eq('user_id', report.target_id).maybeSingle()).data?.account_status as AccountStatus | undefined;
    if (decision !== 'dismiss' && status === 'terminated') {
      await db.from('reports').update({ status: 'open', updated_at: new Date().toISOString() }).eq('id', reportId);
      claimed = false;
      return { error: 'This account is already terminated. Dismiss the report or close it with a note.' };
    }

    // Offense checklist: suspensions 1–3, then the next upheld report terminates the account.
    const { data: againstIds } = await db.from('reports').select('id').eq('target_id', report.target_id);
    const { count: priorSuspensions } = await db
      .from('moderation_actions')
      .select('id', { count: 'exact', head: true })
      .in('report_id', (againstIds ?? []).map((r: { id: string }) => r.id))
      .eq('action', 'suspension');
    const escalated = decision === 'suspend' && (priorSuspensions ?? 0) >= MAX_SUSPENSIONS;
    const finalAction: AdminModerationDecision =
      decision === 'dismiss' ? 'no_action' : decision === 'terminate' || escalated ? 'termination' : 'suspension';

    let suspendedUntil: string | null = null;
    if (finalAction === 'suspension') {
      suspendedUntil = (await suspendAccount(db, { userId: report.target_id, adminId: admin.id, reportId, reason: notes, days })).until;
    } else if (finalAction === 'termination') {
      await terminateAccount(db, {
        userId: report.target_id,
        adminId: admin.id,
        reportId,
        reason: escalated ? `${notes} (This is a further violation after ${MAX_SUSPENSIONS} suspensions.)` : notes,
      });
    }

    const rationale = escalated
      ? `${notes}\n[Offense ${(priorSuspensions ?? 0) + 1}: suspension limit of ${MAX_SUSPENSIONS} reached — account terminated.]`
      : finalAction === 'suspension'
        ? `${notes}\n[Suspension ${(priorSuspensions ?? 0) + 1} of ${MAX_SUSPENSIONS}: ${days} days.]`
        : notes;
    const { error: actionError } = await db.from('moderation_actions').insert({ report_id: reportId, admin_id: admin.id, action: finalAction, rationale });
    if (actionError) console.error('[moderateReportAction] moderation_actions insert failed:', actionError.message);

    const resolvedAt = new Date().toISOString();
    const { error: resolveError } = await db
      .from('reports')
      .update({
        status: finalAction === 'no_action' ? 'dismissed' : 'resolved',
        resolution_notes: rationale,
        resolved_at: resolvedAt,
        assigned_admin_id: admin.id,
        updated_at: resolvedAt,
      })
      .eq('id', reportId);
    if (resolveError) console.error('[moderateReportAction] report update failed:', resolveError.message);
    claimed = false;

    // A terminated account needs no further decisions: close its other open reports.
    let reportersToTell = [report.reporter_id];
    if (finalAction === 'termination') {
      const { data: others } = await db
        .from('reports')
        .update({
          status: 'resolved',
          resolution_notes: `Closed: the account was terminated after report ${reportId.slice(0, 8)}.`,
          resolved_at: resolvedAt,
          assigned_admin_id: admin.id,
          updated_at: resolvedAt,
        })
        .eq('target_id', report.target_id)
        .in('status', OPEN_STATUSES)
        .neq('id', reportId)
        .select('reporter_id');
      reportersToTell = [...new Set([...reportersToTell, ...((others ?? []) as Array<{ reporter_id: string }>).map((o) => o.reporter_id)])];
    }

    let targetName = targetAccount?.full_name || targetAccount?.email?.split('@')[0] || 'the account';
    if (targetAccount?.role === 'lawyer') {
      const { data: lawyer } = await db.from('lawyer_profiles').select('full_name').eq('user_id', report.target_id).maybeSingle();
      if (lawyer?.full_name) targetName = attorneyNameOr(lawyer.full_name, targetName);
    }
    for (const reporterId of reportersToTell) {
      await notifyAccount(
        db,
        reporterId,
        'report_resolved',
        'Update on your report',
        finalAction === 'no_action'
          ? `We reviewed your report about ${targetName} and did not find a violation of our community guidelines. Thank you for helping keep Justicia safe.`
          : `We reviewed your report about ${targetName} and took action under our community guidelines. Thank you for helping keep Justicia safe.`,
        { reportId: reporterId === report.reporter_id ? reportId : null }
      );
    }

    await db.from('audit_log').insert({
      actor_id: admin.id,
      action: finalAction === 'no_action' ? 'report.dismissed' : 'report.resolved',
      target_type: 'report',
      target_id: reportId,
      details: { targetId: report.target_id, action: finalAction, escalated, suspensionNumber: finalAction === 'suspension' ? (priorSuspensions ?? 0) + 1 : null, days: finalAction === 'suspension' ? days : null },
    });

    revalidateReports();
    try {
      revalidatePath('/admin/settings/security-audit-log');
    } catch {
      // no request scope
    }
    const { data: fresh } = await db.from('reports').select(REPORT_COLUMNS).eq('id', reportId).maybeSingle();
    const [item] = fresh ? await buildReportItems(db, [fresh as ReportRow]) : [null];
    return {
      success: true,
      outcome: finalAction === 'no_action' ? 'dismissed' : finalAction === 'suspension' ? 'suspended' : 'terminated',
      escalated,
      suspendedUntil,
      report: item ?? null,
    };
  } catch (err) {
    console.error('[moderateReportAction] error:', err);
    if (db && claimed) {
      await db.from('reports').update({ status: 'open', updated_at: new Date().toISOString() }).eq('id', reportId);
    }
    const raw = (err as { message?: unknown } | null)?.message;
    const message = typeof raw === 'string' && /^(Could not|The reported|Administrator)/.test(raw) ? raw : null;
    return { error: message ?? 'The decision could not be saved. Please try again.' };
  }
}
