'use server';

/**
 * Consultation extras (new code only; the original consultation actions are reused as-is):
 *  - recordMeetingJoinAction: who pressed Join (attendance, used for "missed" consultations).
 *    The client may join from 1 hour before the start until the end; the lawyer any time, but
 *    only a join inside that window counts.
 *  - Cancellation requests for paid (confirmed) bookings: the client asks, the lawyer accepts
 *    (the booking is cancelled and the payment marked for refund) or declines (it stays booked).
 *    A request nobody answered lapses 24 hours before the session starts, when cancelling closes.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { guardMessage, requireConsultationParticipant } from '@/lib/auth/guards';
import { checkRateLimit } from '@/lib/security/rateLimit';
import { formatAttorneyName } from '@/lib/utils/attorneyName';
import {
  CANCELLATION_CLOSED_MESSAGE,
  CANCELLATION_REASON_MAX,
  CANCELLATION_REASON_MIN,
  JOIN_LEAD_MS,
  joinOpensLabel,
} from '@/lib/consultations/extras';
import {
  cancellationExpired,
  cancellationHistory,
  markLedgerRefunded,
  notify,
  postSystemMessage,
  revokeSharedDocuments,
  sessionLabel,
  sessionWindow,
  signalLive,
  storedCancellation,
  storedJoins,
  updateConsultationMeta,
  type StoredCancellationHistory,
} from '@/lib/consultations/extrasServer';

type Result = { success: true } | { success?: false; error: string };

const ALL_SCOPES = ['consultations', 'payments', 'documents', 'messages'] as const;

async function names(db: SupabaseClient, clientId: string, lawyerId: string) {
  const [{ data: client }, { data: lawyer }] = await Promise.all([
    db.from('profiles').select('full_name, email').eq('user_id', clientId).maybeSingle(),
    db.from('lawyer_profiles').select('full_name').eq('user_id', lawyerId).maybeSingle(),
  ]);
  return {
    client: client?.full_name?.trim() || client?.email || 'The client',
    lawyer: lawyer?.full_name?.trim() ? formatAttorneyName(lawyer.full_name) : 'The attorney',
  };
}

function cleanReason(reason: unknown): string | { error: string } {
  const text = typeof reason === 'string' ? reason.trim() : '';
  if (text.length < CANCELLATION_REASON_MIN) return { error: `Please give a reason (at least ${CANCELLATION_REASON_MIN} characters).` };
  if (text.length > CANCELLATION_REASON_MAX) return { error: `The reason must be ${CANCELLATION_REASON_MAX} characters or fewer.` };
  return text;
}

// ─── Attendance ──────────────────────────────────────────────────────────────

/**
 * Records that the signed-in participant pressed Join for a confirmed consultation (the first
 * press inside the window counts). The browser opens the Meet link itself; for the client this
 * also refuses presses outside the join window.
 */
export async function recordMeetingJoinAction(consultationId: string): Promise<Result & { recorded?: boolean }> {
  try {
    const { db, side, consultation } = await requireConsultationParticipant(consultationId);
    if (consultation.status !== 'confirmed') return { error: 'Only confirmed consultations can be joined.' };

    const now = Date.now();
    let recorded = false;
    const res = await updateConsultationMeta(db, consultationId, (row, meta) => {
      if (!row.meeting_url) return { error: 'The meeting link has not been shared yet.' };
      const w = sessionWindow(row);
      const inWindow = !!w && now >= w.start - JOIN_LEAD_MS && now < w.end;
      if (side === 'client' && w && !inWindow) {
        return now < w.start - JOIN_LEAD_MS
          ? { error: `You can join from ${joinOpensLabel(new Date(w.start - JOIN_LEAD_MS).toISOString(), now)}, 1 hour before the session.` }
          : { error: 'This consultation has already ended.' };
      }
      const joins = storedJoins(meta);
      if (!inWindow || joins[side]) return { error: '' }; // nothing to record
      recorded = true;
      return { meta: { ...meta, meetingJoins: { ...joins, [side]: new Date(now).toISOString() } } };
    });
    if ('error' in res && res.error) return { error: res.error };
    if (recorded) signalLive([consultation.client_id, consultation.lawyer_id], ['consultations']);
    return { success: true, recorded };
  } catch (err) {
    return { error: guardMessage(err, 'We could not open the meeting. Please try again.') };
  }
}

// ─── Cancellation requests (paid bookings) ───────────────────────────────────

/** The client asks the lawyer to cancel a paid (confirmed) booking. */
export async function requestCancellationAction(consultationId: string, reason: string): Promise<Result> {
  try {
    const text = cleanReason(reason);
    if (typeof text !== 'string') return text;
    const { db, user, side, consultation } = await requireConsultationParticipant(consultationId);
    if (side !== 'client') return { error: 'Only the client can ask to cancel a paid consultation.' };
    const limited = await checkRateLimit('reschedule', user.id);
    if (limited) return { error: limited };

    const nowIso = new Date().toISOString();
    const res = await updateConsultationMeta(db, consultationId, (row, meta) => {
      if (row.status !== 'confirmed') return { error: 'Only confirmed (paid) consultations need a cancellation request.' };
      if (cancellationExpired(row)) return { error: CANCELLATION_CLOSED_MESSAGE };
      if (storedCancellation(meta)) return { error: 'You already asked to cancel this consultation. Please wait for the attorney to answer.' };
      return { meta: { ...meta, cancellationRequest: { status: 'pending', requestedById: user.id, requestedAt: nowIso, reason: text } } };
    });
    if ('error' in res) return res;

    const who = await names(db, consultation.client_id, consultation.lawyer_id);
    const when = sessionLabel(res.row);
    await postSystemMessage(db, consultationId, user.id, `${who.client} asked to cancel the consultation on ${when}. Reason: ${text}`);
    await notify(
      db,
      consultation.lawyer_id,
      'consultation_cancellation_requested',
      'Cancellation Requested',
      `${who.client} asked to cancel the paid consultation on ${when}. Reason: ${text}. Accept or decline it in Consultations.`,
      { consultationId, clientId: user.id, reason: text }
    );
    signalLive([consultation.client_id, consultation.lawyer_id], ['consultations', 'messages']);
    return { success: true };
  } catch (err) {
    return { error: guardMessage(err, 'We could not send your cancellation request. Please try again.') };
  }
}

/** The client takes back their open cancellation request; the booking stays. */
export async function withdrawCancellationRequestAction(consultationId: string): Promise<Result> {
  try {
    const { db, user, side, consultation } = await requireConsultationParticipant(consultationId);
    if (side !== 'client') return { error: 'Only the client can withdraw this request.' };

    const nowIso = new Date().toISOString();
    const res = await updateConsultationMeta(db, consultationId, (_row, meta) => {
      const pending = storedCancellation(meta);
      if (!pending) return { error: 'There is no open cancellation request to withdraw.' };
      const entry: StoredCancellationHistory = { ...pending, status: 'withdrawn', respondedAt: nowIso, respondedById: user.id, responseReason: null };
      return { meta: { ...meta, cancellationRequest: null, cancellationRequestHistory: [...cancellationHistory(meta), entry] } };
    });
    if ('error' in res) return res;

    const who = await names(db, consultation.client_id, consultation.lawyer_id);
    await postSystemMessage(db, consultationId, user.id, `${who.client} withdrew the cancellation request. The consultation stays booked.`);
    await notify(
      db,
      consultation.lawyer_id,
      'consultation_cancellation_withdrawn',
      'Cancellation Request Withdrawn',
      `${who.client} withdrew their request to cancel the consultation on ${sessionLabel(res.row)}. It stays booked.`,
      { consultationId, clientId: user.id }
    );
    signalLive([consultation.client_id, consultation.lawyer_id], ['consultations', 'messages']);
    return { success: true };
  } catch (err) {
    return { error: guardMessage(err, 'We could not withdraw the request. Please try again.') };
  }
}

/**
 * The lawyer answers a client's cancellation request.
 *  - accept: the booking is cancelled (as requested by the client), the payment is marked for
 *    refund, and access to the documents shared for it ends;
 *  - decline (reason required): the booking stays as it is.
 */
export async function respondToCancellationRequestAction(
  consultationId: string,
  decision: 'accept' | 'decline',
  reason?: string
): Promise<Result> {
  try {
    if (decision !== 'accept' && decision !== 'decline') return { error: 'Choose to accept or decline the request.' };
    let responseReason: string | null = null;
    if (decision === 'decline') {
      const text = cleanReason(reason);
      if (typeof text !== 'string') return text;
      responseReason = text;
    }
    const { db, user, side, consultation } = await requireConsultationParticipant(consultationId);
    if (side !== 'lawyer') return { error: 'Only the attorney can answer this request.' };

    const nowIso = new Date().toISOString();
    let requestReason = '';
    const res = await updateConsultationMeta(db, consultationId, (row, meta) => {
      const pending = storedCancellation(meta);
      if (!pending) return { error: 'This cancellation request is no longer open.' };
      if (row.status !== 'confirmed') return { error: 'This consultation is no longer confirmed.' };
      if (cancellationExpired(row)) {
        return { error: 'The session starts in less than 24 hours, so this cancellation request has lapsed and the booking stays.' };
      }
      requestReason = pending.reason;
      const entry: StoredCancellationHistory = {
        ...pending,
        status: decision === 'accept' ? 'accepted' : 'declined',
        respondedAt: nowIso,
        respondedById: user.id,
        responseReason,
      };
      const next = { ...meta, cancellationRequest: null, cancellationRequestHistory: [...cancellationHistory(meta), entry] };
      if (decision === 'decline') return { meta: next };
      return {
        meta: {
          ...next,
          cancellationReason: pending.reason,
          cancelledBy: 'client',
          cancelledAt: nowIso,
          cancellationApprovedBy: user.id,
          refundStatus: 'pending',
        },
        columns: { status: 'cancelled', cancelled_by: row.client_id },
      };
    });
    if ('error' in res) return res;

    const who = await names(db, consultation.client_id, consultation.lawyer_id);
    const when = sessionLabel(res.row);
    if (decision === 'accept') {
      await markLedgerRefunded(db, consultationId);
      await revokeSharedDocuments(db, res.row, res.meta);
      await postSystemMessage(db, consultationId, user.id, `${who.lawyer} accepted the cancellation request. The consultation on ${when} is cancelled and a refund is pending.`);
      await notify(
        db,
        consultation.client_id,
        'consultation_cancelled',
        'Cancellation Approved',
        `${who.lawyer} accepted your request to cancel the consultation on ${when}. Your payment will be refunded.`,
        { consultationId, lawyerId: user.id, reason: requestReason, refundPending: true }
      );
    } else {
      await postSystemMessage(db, consultationId, user.id, `${who.lawyer} declined the cancellation request, so the consultation on ${when} stays booked. Reason: ${responseReason}`);
      await notify(
        db,
        consultation.client_id,
        'consultation_cancellation_declined',
        'Cancellation Request Declined',
        `${who.lawyer} declined your request to cancel the consultation on ${when}. It stays booked. Reason: ${responseReason}`,
        { consultationId, lawyerId: user.id, reason: responseReason }
      );
    }
    signalLive([consultation.client_id, consultation.lawyer_id], [...ALL_SCOPES]);
    return { success: true };
  } catch (err) {
    return { error: guardMessage(err, 'We could not answer the request. Please try again.') };
  }
}
