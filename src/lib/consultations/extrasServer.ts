/**
 * Server-only helpers for consultation extras (attendance and cancellation requests). Added next
 * to the original consultation code in consultationActions.ts, which is reused as-is: these
 * helpers mirror its storage rules (concern_summary JSON, notifications, system messages)
 * instead of editing it.
 */
import { after } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { emitLive, type LiveScope } from '@/lib/realtime/live';
import {
  ATTENDANCE_TRACKED_FROM,
  CANCELLATION_CUTOFF_MS,
  CANCELLATION_NOTICE_MS,
  JOIN_LEAD_MS,
  type CancellationOutcome,
  type CancellationRequestInfo,
  type ConsultationAttendance,
  type ConsultationExtras,
} from './extras';

type Db = SupabaseClient;

export const EXTRAS_COLUMNS = 'id, client_id, lawyer_id, status, scheduled_start, scheduled_end, meeting_url, method, concern_summary, updated_at';

export interface ExtrasRow {
  id: string;
  client_id: string;
  lawyer_id: string;
  status: string;
  scheduled_start: string | null;
  scheduled_end: string | null;
  meeting_url: string | null;
  method: 'video' | 'audio' | null;
  concern_summary: string | null;
  updated_at: string | null;
}

export interface StoredJoins {
  client?: string;
  lawyer?: string;
}

export interface StoredCancellationRequest {
  status: 'pending';
  requestedById: string;
  requestedAt: string;
  reason: string;
}

export interface StoredCancellationHistory extends Omit<StoredCancellationRequest, 'status'> {
  status: Exclude<CancellationOutcome, 'expired'>;
  respondedAt: string;
  respondedById: string | null;
  responseReason: string | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Meta = Record<string, any>;

/** concern_summary JSON (plain text from old rows becomes the description, like the original code). */
export function parseMeta(concernSummary: string | null | undefined): Meta {
  if (!concernSummary) return {};
  try {
    const parsed = JSON.parse(concernSummary);
    return parsed && typeof parsed === 'object' ? parsed : { description: concernSummary };
  } catch {
    return { description: concernSummary };
  }
}

/** Session start and end (epoch ms), or null when the booking has no scheduled_start. */
export function sessionWindow(row: Pick<ExtrasRow, 'scheduled_start' | 'scheduled_end'>): { start: number; end: number } | null {
  if (!row.scheduled_start) return null;
  const start = Date.parse(row.scheduled_start);
  if (!Number.isFinite(start)) return null;
  const end = row.scheduled_end ? Date.parse(row.scheduled_end) : NaN;
  return { start, end: Number.isFinite(end) && end > start ? end : start + 60 * 60 * 1000 };
}

export function storedJoins(meta: Meta): StoredJoins {
  const raw = meta.meetingJoins;
  if (!raw || typeof raw !== 'object') return {};
  return {
    client: typeof raw.client === 'string' ? raw.client : undefined,
    lawyer: typeof raw.lawyer === 'string' ? raw.lawyer : undefined,
  };
}

export function storedCancellation(meta: Meta): StoredCancellationRequest | null {
  const raw = meta.cancellationRequest;
  return raw && typeof raw === 'object' && raw.status === 'pending' && typeof raw.requestedAt === 'string'
    ? (raw as StoredCancellationRequest)
    : null;
}

export function cancellationHistory(meta: Meta): StoredCancellationHistory[] {
  return Array.isArray(meta.cancellationRequestHistory) ? (meta.cancellationRequestHistory as StoredCancellationHistory[]) : [];
}

/**
 * Cancelling closes 24 hours before the session starts: a pending request lapses then without
 * an answer, and no new request can be sent.
 */
export function cancellationExpired(row: ExtrasRow, now = Date.now()): boolean {
  const w = sessionWindow(row);
  return !!w && now >= w.start - CANCELLATION_CUTOFF_MS;
}

function attendanceOf(row: ExtrasRow, meta: Meta, now: number): ConsultationAttendance {
  const joins = storedJoins(meta);
  const w = sessionWindow(row);
  const tracked = !!w && w.start >= Date.parse(ATTENDANCE_TRACKED_FROM);
  const ended = !!w && now >= w.end;
  const missedClient = !joins.client;
  const missedLawyer = !joins.lawyer;
  return {
    clientJoinedAt: joins.client ?? null,
    lawyerJoinedAt: joins.lawyer ?? null,
    joinOpensAt: w ? new Date(w.start - JOIN_LEAD_MS).toISOString() : null,
    endsAt: w ? new Date(w.end).toISOString() : null,
    missed:
      row.status === 'confirmed' && tracked && ended && (missedClient || missedLawyer)
        ? { client: missedClient, lawyer: missedLawyer }
        : null,
  };
}

function cancellationOf(row: ExtrasRow, meta: Meta, viewerId: string, now: number): CancellationRequestInfo {
  const pending = storedCancellation(meta);
  const history = cancellationHistory(meta);
  const expired = !!pending && (row.status !== 'confirmed' || cancellationExpired(row, now));
  const lastStored = history[history.length - 1] ?? null;
  let last: CancellationRequestInfo['last'] = null;
  if (pending && expired && row.status === 'confirmed') {
    const w = sessionWindow(row);
    const at = w ? new Date(w.start - CANCELLATION_CUTOFF_MS).toISOString() : pending.requestedAt;
    last = {
      status: 'expired',
      requestedAt: pending.requestedAt,
      reason: pending.reason,
      respondedAt: at,
      responseReason: null,
      byMe: pending.requestedById === viewerId,
      recent: now - Date.parse(at) < CANCELLATION_NOTICE_MS,
    };
  } else if (lastStored) {
    last = {
      status: lastStored.status,
      requestedAt: lastStored.requestedAt,
      reason: lastStored.reason,
      respondedAt: lastStored.respondedAt,
      responseReason: lastStored.responseReason ?? null,
      byMe: lastStored.requestedById === viewerId,
      recent: now - Date.parse(lastStored.respondedAt) < CANCELLATION_NOTICE_MS,
    };
  }
  const open = pending && !expired ? pending : null;
  const w = sessionWindow(row);
  return {
    pending: open ? { requestedAt: open.requestedAt, reason: open.reason, byMe: open.requestedById === viewerId } : null,
    last,
    canRequest: row.client_id === viewerId && row.status === 'confirmed' && !open && (!w || now < w.start - CANCELLATION_CUTOFF_MS),
  };
}

/** The extras of one consultation as the viewer (client or lawyer) sees them. */
export function buildExtras(row: ExtrasRow, viewerId: string, now = Date.now()): ConsultationExtras {
  const meta = parseMeta(row.concern_summary);
  return {
    side: row.lawyer_id === viewerId ? 'lawyer' : 'client',
    attendance: attendanceOf(row, meta, now),
    cancellation: cancellationOf(row, meta, viewerId, now),
  };
}

/**
 * Read → change → write of a consultation's concern_summary JSON. The write only lands if the
 * row's updated_at is unchanged since it was read (another action that saved in between is
 * retried on top of, never overwritten). `change` returns the new meta (plus extra columns), or
 * an error message to stop.
 */
export async function updateConsultationMeta(
  db: Db,
  consultationId: string,
  change: (row: ExtrasRow, meta: Meta) => { meta: Meta; columns?: Record<string, unknown> } | { error: string }
): Promise<{ row: ExtrasRow; meta: Meta } | { error: string }> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data, error } = await db.from('consultations').select(EXTRAS_COLUMNS).eq('id', consultationId).maybeSingle();
    if (error || !data) return { error: 'Consultation not found.' };
    const row = data as ExtrasRow;
    const result = change(row, parseMeta(row.concern_summary));
    if ('error' in result) return result;

    const update = db
      .from('consultations')
      .update({ ...result.columns, concern_summary: JSON.stringify(result.meta), updated_at: new Date().toISOString() })
      .eq('id', consultationId);
    const guarded = row.updated_at === null ? update.is('updated_at', null) : update.eq('updated_at', row.updated_at);
    const { data: written, error: writeErr } = await guarded.select('id');
    if (writeErr) {
      console.error('[updateConsultationMeta]', writeErr.message);
      return { error: 'We could not save this change. Please try again.' };
    }
    if (written && written.length > 0) return { row, meta: result.meta };
  }
  return { error: 'This consultation changed while saving. Please try again.' };
}

/** Tells the users' open tabs to re-fetch `scopes` (after the response, like the original code). */
export function signalLive(userIds: Array<string | null | undefined>, scopes: LiveScope[]): void {
  try {
    after(() => emitLive(userIds, scopes));
  } catch {
    void emitLive(userIds, scopes);
  }
}

/** In-app bell notification (same row shape as the original notifyUser). */
export async function notify(db: Db, userId: string, type: string, title: string, body: string, payload: Record<string, unknown>) {
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
  if (error) console.warn('[consultation extras] notify', type, error.message);
  else signalLive([userId], ['notifications']);
}

/** A status line in the pair's conversation (same row shape as the original postSystemMessage). */
export async function postSystemMessage(db: Db, consultationId: string, senderId: string, content: string) {
  const { error } = await db.from('messages').insert({
    conversation_or_thread_id: consultationId,
    sender_id: senderId,
    role: 'system',
    content,
    attachment_ids: [],
    citations: null,
  });
  if (error) console.warn('[consultation extras] system message', error.message);
}

/** The paid ledger row of a cancelled booking becomes a refund (out of the lawyer's sales). */
export async function markLedgerRefunded(db: Db, consultationId: string) {
  const { error } = await db
    .from('payments')
    .update({ status: 'refunded', payout_status: 'not_applicable', updated_at: new Date().toISOString() })
    .eq('consultation_id', consultationId)
    .eq('status', 'paid');
  if (error) console.error('[consultation extras] refund', consultationId, error.message);
}

const ACTIVE_BOOKING_STATUSES = ['pending', 'confirmed', 'awaiting_client_confirmation'];

function sharedDocumentIds(meta: Meta): string[] {
  const raw = Array.isArray(meta.attachedFiles) ? meta.attachedFiles : [];
  return raw
    .map((f: unknown) => (f && typeof f === 'object' ? (f as { documentId?: unknown }).documentId : null))
    .filter((id: unknown): id is string => typeof id === 'string');
}

/**
 * Removes the lawyer's access to documents shared for this booking, unless another active
 * booking between the same two people still shares them (same rule as the original code).
 */
export async function revokeSharedDocuments(db: Db, row: ExtrasRow, meta: Meta) {
  const sharedIds = sharedDocumentIds(meta);
  if (sharedIds.length === 0) return;
  const { data: others } = await db
    .from('consultations')
    .select('id, concern_summary')
    .eq('client_id', row.client_id)
    .eq('lawyer_id', row.lawyer_id)
    .in('status', ACTIVE_BOOKING_STATUSES)
    .neq('id', row.id);
  const stillShared = new Set(
    ((others ?? []) as Array<{ concern_summary: string | null }>).flatMap((o) => sharedDocumentIds(parseMeta(o.concern_summary)))
  );
  const toRevoke = sharedIds.filter((id) => !stillShared.has(id));
  if (toRevoke.length === 0) return;
  const { error } = await db
    .from('document_access_grants')
    .update({ revoked_at: new Date().toISOString() })
    .eq('grantee_id', row.lawyer_id)
    .eq('granted_by', row.client_id)
    .is('revoked_at', null)
    .in('document_id', toRevoke);
  if (error) console.warn('[consultation extras] revoke documents', error.message);
}

/** "Thursday, November 26, 2026 · 2:00 PM - 3:00 PM" (Manila). */
export function sessionLabel(row: ExtrasRow): string {
  const w = sessionWindow(row);
  if (!w) return 'the scheduled date';
  const tz = { timeZone: 'Asia/Manila' } as const;
  const date = new Date(w.start).toLocaleDateString('en-PH', { ...tz, weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const clock = (ms: number) => new Date(ms).toLocaleTimeString('en-PH', { ...tz, hour: 'numeric', minute: '2-digit' });
  return `${date} · ${clock(w.start)} - ${clock(w.end)}`;
}
