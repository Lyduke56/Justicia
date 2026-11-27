/**
 * In-app consultation calls (browser + server safe).
 *
 * A confirmed consultation is held in Justicia itself at /call/<consultationId>: a 1:1 WebRTC
 * call (video, or audio only for audio bookings) between the client and the lawyer. The browsers
 * find each other over a Supabase Realtime topic that only the server can compute and only hands
 * to the two participants inside the join window (see callServer.ts and
 * consultationCallActions.ts). Media goes directly between the browsers, or through a TURN relay
 * when a network blocks direct connections; it never passes through Vercel.
 *
 * Entering the call inside the window [start − 1 hour, end) is what records attendance, which
 * decides "missed" consultations (extras.ts).
 */
import { JOIN_LEAD_MS } from '@/lib/consultations/extras';

/** The in-app call page of a consultation. */
export function consultationCallPath(consultationId: string): string {
  return `/call/${consultationId}`;
}

/** Where a participant may be with respect to entering the call. */
export type CallAvailability =
  /** Inside the join window: the call can be entered. */
  | 'open'
  /** Confirmed, but the window opens later (1 hour before the start). */
  | 'not_yet'
  /** The session's end time has passed. */
  | 'ended'
  /** Not confirmed yet (pending request or payment). */
  | 'not_confirmed'
  /** Cancelled or declined. */
  | 'closed';

export interface CallPerson {
  userId: string;
  name: string;
}

/** What the call page shows before joining (no secrets). */
export interface ConsultationCallDetails {
  consultationId: string;
  side: 'client' | 'lawyer';
  method: 'video' | 'audio';
  availability: CallAvailability;
  /** ISO times; null when the booking has no schedule. */
  startsAt: string | null;
  endsAt: string | null;
  joinOpensAt: string | null;
  /** The server's clock when this was read (epoch ms), so a wrong device clock doesn't matter. */
  serverNow: number;
  me: CallPerson;
  counterpart: CallPerson;
  subject: string;
  /** e.g. "Thursday, November 26, 2026 · 2:00 PM - 3:00 PM" (Manila). */
  scheduleLabel: string;
  /** The portal's Consultations screen. */
  backHref: string;
}

/** An RTCIceServer as sent to the browser. */
export interface CallIceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

/** Granted when entering the call: the signalling topic and the STUN/TURN servers. */
export interface ConsultationCallTicket {
  topic: string;
  iceServers: CallIceServer[];
  /** True when a TURN relay is configured (calls then also work on strict mobile networks). */
  relay: boolean;
  /** True the first time this side entered inside the window (attendance was recorded now). */
  recorded: boolean;
  serverNow: number;
}

/** Where `now` falls for a confirmed consultation with this window. */
export function callAvailability(
  status: string,
  window: { start: number; end: number } | null,
  now: number
): CallAvailability {
  if (status === 'cancelled' || status === 'declined') return 'closed';
  if (status === 'completed') return 'ended';
  if (status !== 'confirmed') return 'not_confirmed';
  if (!window) return 'not_confirmed';
  if (now < window.start - JOIN_LEAD_MS) return 'not_yet';
  if (now >= window.end) return 'ended';
  return 'open';
}

/** "12:05" / "1:02:09" for a call timer. */
export function formatCallDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  return `${h > 0 ? `${h}:` : ''}${mm}:${String(s).padStart(2, '0')}`;
}
