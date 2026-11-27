/**
 * Consultation reminders on the notification bell: 24 hours and 1 hour before a confirmed
 * consultation (the 15-minute "starting soon" alert is created by ensureMeetingNotifications in
 * consultationActions.ts). SERVER-SIDE ONLY.
 *
 * Like the 15-minute alert, reminders are created lazily when the user's bell loads, so no
 * scheduler is needed (Vercel's Hobby plan only runs cron jobs once a day). Each reminder is
 * created once per consultation start time, so a rescheduled consultation gets new ones. Only the
 * reminder for the window the consultation is currently in is created (opening the app 30
 * minutes before gives the 1-hour reminder, not a stale 24-hour one).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { emitLive } from '@/lib/realtime/live';
import { attorneyNameOr } from '@/lib/utils/attorneyName';
import { queueNotificationEmail } from '@/lib/email/notificationEmail';

const HOUR = 60 * 60 * 1000;
const STARTING_SOON = 15 * 60 * 1000;

interface Row {
  id: string;
  client_id: string;
  lawyer_id: string;
  scheduled_start: string;
  method: string | null;
}

function windowFor(msUntil: number): { type: 'reminder_24h' | 'reminder_1h'; title: string; when: string } | null {
  if (msUntil > STARTING_SOON && msUntil <= HOUR) return { type: 'reminder_1h', title: 'Consultation in 1 hour', when: 'in about an hour' };
  if (msUntil > HOUR && msUntil <= 24 * HOUR) return { type: 'reminder_24h', title: 'Consultation tomorrow', when: 'within the next 24 hours' };
  return null;
}

function manilaTime(iso: string): string {
  return new Date(iso).toLocaleString('en-PH', { timeZone: 'Asia/Manila', weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export async function ensureConsultationReminders(db: SupabaseClient, userId: string): Promise<void> {
  try {
    const now = Date.now();
    const { data } = await db
      .from('consultations')
      .select('id, client_id, lawyer_id, scheduled_start, method')
      .or(`client_id.eq.${userId},lawyer_id.eq.${userId}`)
      .eq('status', 'confirmed')
      .gt('scheduled_start', new Date(now + STARTING_SOON).toISOString())
      .lte('scheduled_start', new Date(now + 24 * HOUR).toISOString());
    const due = ((data ?? []) as Row[])
      .map((row) => ({ row, slot: windowFor(new Date(row.scheduled_start).getTime() - now) }))
      .filter((d): d is { row: Row; slot: NonNullable<ReturnType<typeof windowFor>> } => !!d.slot);
    if (due.length === 0) return;

    const { data: existing } = await db
      .from('notifications')
      .select('type, metadata')
      .eq('user_id', userId)
      .in('type', ['reminder_24h', 'reminder_1h'])
      .in('metadata->>consultationId', due.map((d) => d.row.id));
    const sent = new Set(
      ((existing ?? []) as Array<{ type: string; metadata: { consultationId?: string; scheduledStart?: string } | null }>).map(
        (n) => `${n.type}|${n.metadata?.consultationId}|${n.metadata?.scheduledStart ? new Date(n.metadata.scheduledStart).getTime() : ''}`
      )
    );

    const otherIds = [...new Set(due.map((d) => (d.row.lawyer_id === userId ? d.row.client_id : d.row.lawyer_id)))];
    const { data: people } = await db.from('profiles').select('user_id, full_name').in('user_id', otherIds);
    const nameOf = new Map(((people ?? []) as Array<{ user_id: string; full_name: string | null }>).map((p) => [p.user_id, p.full_name]));

    let created = 0;
    for (const { row, slot } of due) {
      const key = `${slot.type}|${row.id}|${new Date(row.scheduled_start).getTime()}`;
      if (sent.has(key)) continue;
      const isLawyer = row.lawyer_id === userId;
      const other = isLawyer
        ? nameOf.get(row.client_id) || 'your client'
        : attorneyNameOr(nameOf.get(row.lawyer_id), 'your attorney');
      const kind = row.method === 'audio' ? 'audio call' : 'video consultation';
      const { error } = await db.from('notifications').insert({
        user_id: userId,
        type: slot.type,
        title: slot.title,
        body: `Your ${kind} with ${other} starts ${slot.when} (${manilaTime(row.scheduled_start)}). The meeting link will be in Messages.`,
        data: { consultationId: row.id, scheduledStart: row.scheduled_start },
        metadata: { consultationId: row.id, scheduledStart: row.scheduled_start, threadId: isLawyer ? row.client_id : row.lawyer_id },
        channel: 'in_app',
        is_read: false,
      });
      if (!error) {
        created++;
        queueNotificationEmail({
          userId,
          type: slot.type,
          title: slot.title,
          body: `Your ${kind} with ${other} starts ${slot.when} (${manilaTime(row.scheduled_start)}).`,
          payload: { consultationId: row.id, threadId: isLawyer ? row.client_id : row.lawyer_id },
        });
      }
    }
    if (created) void emitLive([userId], ['notifications']);
  } catch (err) {
    console.warn('[ensureConsultationReminders]', err instanceof Error ? err.message : err);
  }
}
