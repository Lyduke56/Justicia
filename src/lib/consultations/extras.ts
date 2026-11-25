/**
 * Consultation extras shared by the client and lawyer portals (browser + server safe):
 *  - attendance: who pressed Join, the client's join window and "missed" consultations;
 *  - cancellation requests: a client asks to cancel a paid (confirmed) booking and the lawyer
 *    accepts or declines.
 * Stored in the consultation's concern_summary JSON (meetingJoins, cancellationRequest,
 * cancellationRequestHistory) and served by GET /api/live/consultation-extras.
 */

/** The client can join from this long before the scheduled start. */
export const JOIN_LEAD_MS = 60 * 60 * 1000;

/**
 * Join presses are recorded from this moment on. Sessions that started earlier were never
 * tracked, so they are never marked missed.
 */
export const ATTENDANCE_TRACKED_FROM = '2026-11-25T13:00:00.000Z';

/** Answered cancellation requests stay on screen as a notice for this long. */
export const CANCELLATION_NOTICE_MS = 3 * 24 * 60 * 60 * 1000;

export const CANCELLATION_REASON_MIN = 5;
export const CANCELLATION_REASON_MAX = 500;

export interface ConsultationAttendance {
  /** First join inside the window [start − 1 hour, end). */
  clientJoinedAt: string | null;
  lawyerJoinedAt: string | null;
  /** When the client's Join button opens (start − 1 hour); null when the time is unknown. */
  joinOpensAt: string | null;
  /** End of the session; joining closes then. */
  endsAt: string | null;
  /**
   * Set once a confirmed session has ended and at least one side never pressed Join
   * (sessions before tracking began are never missed).
   */
  missed: { client: boolean; lawyer: boolean } | null;
}

export type CancellationOutcome = 'accepted' | 'declined' | 'withdrawn' | 'expired';

export interface CancellationRequestInfo {
  /** The open request, if any. */
  pending: { requestedAt: string; reason: string; byMe: boolean } | null;
  /** The latest answered request. */
  last: {
    status: CancellationOutcome;
    requestedAt: string;
    reason: string;
    respondedAt: string;
    responseReason: string | null;
    /** True when the viewer sent the request. */
    byMe: boolean;
    /** Answered within the last 3 days (worth showing as a notice). */
    recent: boolean;
  } | null;
  /** The client may send a request now (paid booking, before the session starts, none open). */
  canRequest: boolean;
}

export interface ConsultationExtras {
  /** Which side the signed-in viewer is on. */
  side: 'client' | 'lawyer';
  attendance: ConsultationAttendance;
  cancellation: CancellationRequestInfo;
}

export type ConsultationExtrasMap = Record<string, ConsultationExtras>;

export type JoinState = 'unscheduled' | 'not_yet' | 'open' | 'ended';

/** Where `now` falls in the client's join window. */
export function joinState(attendance: ConsultationAttendance | null | undefined, now: number): JoinState {
  if (!attendance?.joinOpensAt || !attendance.endsAt) return 'unscheduled';
  if (now < Date.parse(attendance.joinOpensAt)) return 'not_yet';
  if (now >= Date.parse(attendance.endsAt)) return 'ended';
  return 'open';
}

/** "1:00 PM" in Manila time. */
export function manilaClock(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-PH', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit' });
}

/** "Thursday, November 26 at 1:00 PM" when not today, else "1:00 PM". */
export function joinOpensLabel(iso: string, now: number): string {
  const day = (ms: number) => new Date(ms).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila' });
  const opens = Date.parse(iso);
  if (day(opens) === day(now)) return manilaClock(iso);
  const date = new Date(opens).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', weekday: 'long', month: 'long', day: 'numeric' });
  return `${date} at ${manilaClock(iso)}`;
}

/** Who missed, from the viewer's side, e.g. "You didn't join this consultation." */
export function missedSummary(
  missed: NonNullable<ConsultationAttendance['missed']>,
  side: 'client' | 'lawyer',
  counterpart: string
): string {
  const me = side === 'client' ? missed.client : missed.lawyer;
  const them = side === 'client' ? missed.lawyer : missed.client;
  if (me && them) return `Neither you nor ${counterpart} joined this consultation.`;
  if (me) return `You didn't join this consultation before it ended.`;
  return `${counterpart} didn't join this consultation before it ended.`;
}
