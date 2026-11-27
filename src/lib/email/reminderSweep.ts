/**
 * Time-based notifications that must go out even when nobody has Justicia open. SERVER-SIDE ONLY.
 * Run by /api/cron/consultation-reminders every few minutes.
 *
 *  - 24-hour and 1-hour reminders for confirmed consultations (the existing
 *    ensureConsultationReminders, run for both people);
 *  - the 15-minute "starting soon, please prepare" alert (same row shape and de-duplication as
 *    ensureMeetingNotifications in consultationActions.ts, so the bell never shows it twice);
 *  - one "still waiting for your reply" nudge to the lawyer when a request has been pending for
 *    12 hours.
 *
 * Each creates the bell row; the email goes out through the notification helpers' email hook,
 * which applies the user's email settings. Reminders follow the user's "Reminders" switch, as
 * they do on the bell.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { ensureConsultationReminders } from '@/lib/consultationReminders';
import { accountPreferences } from '@/lib/account/preferences';
import { attorneyNameOr } from '@/lib/utils/attorneyName';
import { emitLive } from '@/lib/realtime/live';
import { queueNotificationEmail } from '@/lib/email/notificationEmail';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
/** Same as MEETING_LEAD_MS in consultationActions.ts. */
const MEETING_LEAD_MS = 15 * MINUTE;
/** A request still pending this long gets one nudge to the lawyer. */
export const PENDING_NUDGE_AFTER_MS = 12 * HOUR;

interface ConfirmedRow {
  id: string;
  client_id: string;
  lawyer_id: string;
  scheduled_start: string;
  scheduled_end: string | null;
  method: string | null;
  meeting_url: string | null;
}

interface PendingRow {
  id: string;
  client_id: string;
  lawyer_id: string;
  scheduled_start: string;
  method: string | null;
}

export interface SweepResult {
  consultations: number;
  meetingAlerts: number;
  pendingNudges: number;
}

function clock(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit' });
}

function dayAndTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    timeZone: 'Asia/Manila',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function meetingWindow(row: ConfirmedRow): { start: number; end: number } {
  const start = new Date(row.scheduled_start).getTime();
  const end = row.scheduled_end ? new Date(row.scheduled_end).getTime() : NaN;
  return { start, end: Number.isFinite(end) && end > start ? end : start + HOUR };
}

async function names(db: SupabaseClient, clientIds: string[], lawyerIds: string[]) {
  const [{ data: clients }, { data: lawyers }] = await Promise.all([
    clientIds.length ? db.from('profiles').select('user_id, full_name').in('user_id', clientIds) : Promise.resolve({ data: [] }),
    lawyerIds.length ? db.from('lawyer_profiles').select('user_id, full_name').in('user_id', lawyerIds) : Promise.resolve({ data: [] }),
  ]);
  const client = new Map(((clients ?? []) as Array<{ user_id: string; full_name: string | null }>).map((p) => [p.user_id, p.full_name]));
  const lawyer = new Map(((lawyers ?? []) as Array<{ user_id: string; full_name: string | null }>).map((p) => [p.user_id, p.full_name]));
  return {
    client: (id: string) => client.get(id)?.trim() || 'your client',
    lawyer: (id: string) => attorneyNameOr(lawyer.get(id), 'your attorney'),
  };
}

async function insertNotification(
  db: SupabaseClient,
  userId: string,
  type: string,
  title: string,
  body: string,
  payload: Record<string, unknown>
): Promise<boolean> {
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
  if (error) {
    console.warn('[reminderSweep]', type, error.message);
    return false;
  }
  void emitLive([userId], ['notifications']);
  queueNotificationEmail({ userId, type, title, body, payload });
  return true;
}

export async function runReminderSweep(db: SupabaseClient, now: number = Date.now()): Promise<SweepResult> {
  const result: SweepResult = { consultations: 0, meetingAlerts: 0, pendingNudges: 0 };

  // ── Confirmed consultations in the next 24 hours (or in progress) ─────────
  const { data: confirmedData, error: confirmedErr } = await db
    .from('consultations')
    .select('id, client_id, lawyer_id, scheduled_start, scheduled_end, method, meeting_url')
    .eq('status', 'confirmed')
    .gte('scheduled_start', new Date(now - 6 * HOUR).toISOString())
    .lte('scheduled_start', new Date(now + 24 * HOUR).toISOString());
  if (confirmedErr) throw new Error(confirmedErr.message);
  const confirmed = ((confirmedData ?? []) as ConfirmedRow[]).filter((r) => meetingWindow(r).end > now);
  result.consultations = confirmed.length;

  // Only people who keep the Reminders switch on (the bell applies the same rule).
  const people = [...new Set(confirmed.flatMap((r) => [r.client_id, r.lawyer_id]))];
  const wantsReminders = new Map<string, boolean>();
  await Promise.all(
    people.map(async (id) => {
      const { data } = await db.auth.admin.getUserById(id);
      wantsReminders.set(id, !!data?.user && accountPreferences(data.user.user_metadata).notifications.reminders);
    })
  );

  // 24 h and 1 h reminders.
  for (const id of people) {
    if (wantsReminders.get(id)) await ensureConsultationReminders(db, id);
  }

  // 15-minute "starting soon" alerts.
  const starting = confirmed.filter((r) => {
    const w = meetingWindow(r);
    return now >= w.start - MEETING_LEAD_MS && now < w.end;
  });
  if (starting.length) {
    const { data: existing } = await db
      .from('notifications')
      .select('user_id, metadata')
      .eq('type', 'meeting_starting')
      .in('metadata->>consultationId', starting.map((r) => r.id));
    const sent = new Set(
      ((existing ?? []) as Array<{ user_id: string; metadata: { consultationId?: string; scheduledStart?: string } | null }>).map(
        (n) => `${n.user_id}|${n.metadata?.consultationId}|${n.metadata?.scheduledStart ? new Date(n.metadata.scheduledStart).getTime() : 'any'}`
      )
    );
    const who = await names(db, starting.map((r) => r.client_id), starting.map((r) => r.lawyer_id));
    for (const r of starting) {
      const w = meetingWindow(r);
      for (const userId of [r.client_id, r.lawyer_id]) {
        if (!wantsReminders.get(userId)) continue;
        if (sent.has(`${userId}|${r.id}|${w.start}`) || sent.has(`${userId}|${r.id}|any`)) continue;
        const isLawyer = userId === r.lawyer_id;
        const other = isLawyer ? who.client(r.client_id) : who.lawyer(r.lawyer_id);
        const minutes = Math.max(0, Math.round((w.start - now) / MINUTE));
        const when = minutes > 0 ? `starts in ${minutes} minute${minutes === 1 ? '' : 's'}` : 'has started';
        const ok = await insertNotification(
          db,
          userId,
          'meeting_starting',
          'Consultation starting soon',
          `Your ${r.method === 'audio' ? 'audio call' : 'video consultation'} with ${other} ${when} (${clock(r.scheduled_start)} - ${clock(new Date(w.end).toISOString())}). Open Messages to join the meeting.`,
          { consultationId: r.id, threadId: isLawyer ? r.client_id : r.lawyer_id, meetingUrl: r.meeting_url, scheduledStart: r.scheduled_start }
        );
        if (ok) result.meetingAlerts++;
      }
    }
  }

  // ── Requests still waiting for the lawyer ─────────────────────────────────
  const { data: pendingData, error: pendingErr } = await db
    .from('consultations')
    .select('id, client_id, lawyer_id, scheduled_start, method')
    .eq('status', 'pending')
    .lte('created_at', new Date(now - PENDING_NUDGE_AFTER_MS).toISOString())
    .gte('created_at', new Date(now - 14 * 24 * HOUR).toISOString())
    .gt('scheduled_start', new Date(now).toISOString())
    .limit(200);
  if (pendingErr) throw new Error(pendingErr.message);
  const pending = (pendingData ?? []) as PendingRow[];
  if (pending.length) {
    const { data: nudged } = await db
      .from('notifications')
      .select('metadata')
      .eq('type', 'consultation_request_reminder')
      .in('metadata->>consultationId', pending.map((r) => r.id));
    const done = new Set(((nudged ?? []) as Array<{ metadata: { consultationId?: string } | null }>).map((n) => n.metadata?.consultationId));
    const due = pending.filter((r) => !done.has(r.id));
    const who = await names(db, due.map((r) => r.client_id), []);
    for (const r of due) {
      const ok = await insertNotification(
        db,
        r.lawyer_id,
        'consultation_request_reminder',
        'Consultation request still pending',
        `${who.client(r.client_id)} is still waiting for your reply to the ${r.method === 'audio' ? 'audio call' : 'video consultation'} request for ${dayAndTime(r.scheduled_start)}. Approve or decline it in Consultations.`,
        { consultationId: r.id, clientId: r.client_id }
      );
      if (ok) result.pendingNudges++;
    }
  }

  return result;
}
