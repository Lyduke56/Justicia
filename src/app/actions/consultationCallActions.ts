'use server';

/**
 * In-app consultation calls (replaces Google Meet links).
 *  - getConsultationCallAction: what the call page shows before joining (who, when, and whether
 *    the call can be entered now). No secrets.
 *  - joinConsultationCallAction: enters the call. Allowed for the client and the lawyer from
 *    1 hour before the start until the end of a confirmed consultation. The first entry inside
 *    that window records the side's attendance (meetingJoins, which decides "missed"), and tells
 *    the other side once that they are waiting. Returns the private signalling topic and the
 *    STUN/TURN servers for the browser.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { guardMessage, requireConsultationParticipant } from '@/lib/auth/guards';
import { formatAttorneyName } from '@/lib/utils/attorneyName';
import { JOIN_LEAD_MS, joinOpensLabel } from '@/lib/consultations/extras';
import {
  callAvailability,
  consultationCallPath,
  type ConsultationCallDetails,
  type ConsultationCallTicket,
} from '@/lib/consultations/call';
import { callTopicFor, iceServersForCall } from '@/lib/consultations/callServer';
import {
  EXTRAS_COLUMNS,
  notify,
  parseMeta,
  sessionLabel,
  sessionWindow,
  signalLive,
  storedJoins,
  updateConsultationMeta,
  type ExtrasRow,
} from '@/lib/consultations/extrasServer';

type Failure = { success?: false; error: string };

async function participantNames(db: SupabaseClient, clientId: string, lawyerId: string) {
  const [{ data: client }, { data: lawyer }] = await Promise.all([
    db.from('profiles').select('full_name, email').eq('user_id', clientId).maybeSingle(),
    db.from('lawyer_profiles').select('full_name').eq('user_id', lawyerId).maybeSingle(),
  ]);
  return {
    client: client?.full_name?.trim() || client?.email || 'Your client',
    lawyer: lawyer?.full_name?.trim() ? formatAttorneyName(lawyer.full_name) : 'Your attorney',
  };
}

async function loadRow(db: SupabaseClient, consultationId: string): Promise<ExtrasRow | null> {
  const { data } = await db.from('consultations').select(EXTRAS_COLUMNS).eq('id', consultationId).maybeSingle();
  return (data as ExtrasRow | null) ?? null;
}

function windowMessage(row: ExtrasRow, now: number): string | null {
  const w = sessionWindow(row);
  switch (callAvailability(row.status, w, now)) {
    case 'open':
      return null;
    case 'not_yet':
      return `You can join from ${joinOpensLabel(new Date(w!.start - JOIN_LEAD_MS).toISOString(), now)}, 1 hour before the session.`;
    case 'ended':
      return 'This consultation has already ended.';
    case 'closed':
      return 'This consultation was cancelled.';
    default:
      return 'Only confirmed consultations can be joined.';
  }
}

/** The call page's details for the signed-in participant. */
export async function getConsultationCallAction(
  consultationId: string
): Promise<{ success: true; call: ConsultationCallDetails } | Failure> {
  try {
    const { db, user, side } = await requireConsultationParticipant(consultationId);
    const row = await loadRow(db, consultationId);
    if (!row) return { error: 'Consultation not found.' };

    const now = Date.now();
    const w = sessionWindow(row);
    const who = await participantNames(db, row.client_id, row.lawyer_id);
    const meta = parseMeta(row.concern_summary);
    const isClient = side === 'client';
    return {
      success: true,
      call: {
        consultationId: row.id,
        side,
        method: row.method === 'audio' ? 'audio' : 'video',
        availability: callAvailability(row.status, w, now),
        startsAt: w ? new Date(w.start).toISOString() : null,
        endsAt: w ? new Date(w.end).toISOString() : null,
        joinOpensAt: w ? new Date(w.start - JOIN_LEAD_MS).toISOString() : null,
        serverNow: now,
        me: { userId: user.id, name: isClient ? who.client : who.lawyer },
        counterpart: isClient ? { userId: row.lawyer_id, name: who.lawyer } : { userId: row.client_id, name: who.client },
        subject: typeof meta.subject === 'string' && meta.subject.trim() ? meta.subject.trim() : 'Legal Consultation',
        scheduleLabel: sessionLabel(row),
        backHref: isClient ? '/client/consultations' : '/lawyer/consultations',
      },
    };
  } catch (err) {
    return { error: guardMessage(err, 'We could not open this call. Please try again.') };
  }
}

/**
 * Enters the call. Records attendance on the first entry inside the window and returns what
 * the browser needs to connect.
 */
export async function joinConsultationCallAction(
  consultationId: string
): Promise<({ success: true } & ConsultationCallTicket) | Failure> {
  try {
    const { db, user, side, consultation } = await requireConsultationParticipant(consultationId);
    const now = Date.now();

    const current = await loadRow(db, consultationId);
    if (!current) return { error: 'Consultation not found.' };
    const refused = windowMessage(current, now);
    if (refused) return { error: refused };

    const topic = callTopicFor(current.id, current.scheduled_start);
    if (!topic) {
      console.error('[joinConsultationCallAction] no REALTIME_TOPIC_SECRET / SUPABASE_SERVICE_ROLE_KEY');
      return { error: 'Calls are not available right now. Please try again later.' };
    }

    // Attendance: the first entry of this side inside the window.
    let recorded = false;
    let otherJoined = !!storedJoins(parseMeta(current.concern_summary))[side === 'client' ? 'lawyer' : 'client'];
    let row = current;
    if (!storedJoins(parseMeta(current.concern_summary))[side]) {
      const ALREADY = '__already_recorded__';
      const res = await updateConsultationMeta(db, consultationId, (fresh, meta) => {
        const stillRefused = windowMessage(fresh, now);
        if (stillRefused) return { error: stillRefused };
        const joins = storedJoins(meta);
        if (joins[side]) return { error: ALREADY };
        return { meta: { ...meta, meetingJoins: { ...joins, [side]: new Date(now).toISOString() } } };
      });
      if ('error' in res) {
        if (res.error !== ALREADY) return { error: res.error };
      } else {
        recorded = true;
        row = res.row;
        otherJoined = !!storedJoins(res.meta)[side === 'client' ? 'lawyer' : 'client'];
      }
    }

    if (recorded) {
      signalLive([consultation.client_id, consultation.lawyer_id], ['consultations']);
      // The other side hasn't entered yet: let them know someone is waiting (once per side).
      if (!otherJoined) {
        const who = await participantNames(db, consultation.client_id, consultation.lawyer_id);
        const me = side === 'client' ? who.client : who.lawyer;
        const otherId = side === 'client' ? consultation.lawyer_id : consultation.client_id;
        const kind = row.method === 'audio' ? 'audio call' : 'video consultation';
        await notify(
          db,
          otherId,
          'consultation_call_waiting',
          `${me} joined the call`,
          `${me} is in the ${kind} for ${sessionLabel(row)} and is waiting for you. Open Consultations and press Join Call.`,
          { consultationId, threadId: user.id, callPath: consultationCallPath(consultationId), scheduledStart: row.scheduled_start }
        );
      }
    }

    const { iceServers, relay } = await iceServersForCall();
    return { success: true, topic, iceServers, relay, recorded, serverNow: now };
  } catch (err) {
    return { error: guardMessage(err, 'We could not join the call. Please try again.') };
  }
}
