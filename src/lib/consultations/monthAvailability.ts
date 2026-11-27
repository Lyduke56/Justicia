/**
 * Per-day availability of one month (Asia/Manila), for the booking and reschedule calendars'
 * day indicators. Server only (reads consultations and lawyer_unavailability with the caller's
 * service client).
 *
 * A day is
 *  - open:   at least one regular slot is still free;
 *  - full:   it is a consultation day, but every remaining slot is booked or blocked;
 *  - closed: no booking is possible (not one of the lawyer's consultation days, blocked for the
 *            whole day, already past, or outside the allowed range).
 * `bookings` counts the active bookings that day (the lawyer's, plus the client's when a client
 * is given), so the calendar can mark days that already have one.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { SLOT_MINUTES, slotStartsFor, type ConsultationHours } from '@/lib/lawyer/consultationHours';

export type CalendarDayState = 'open' | 'full' | 'closed';

export interface CalendarDayMark {
  /** Day of the month (1–31). */
  day: number;
  state: CalendarDayState;
  /** Active bookings on that day (excluding the consultation being moved). */
  bookings: number;
  /** Why the day is full or closed, e.g. "Fully booked", "Not a consultation day". */
  reason: string | null;
}

const ACTIVE = ['pending', 'confirmed', 'awaiting_client_confirmation'];
const pad = (n: number) => String(n).padStart(2, '0');
const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;

interface Range {
  start: number;
  end: number;
}

/** Manila date and minute range of a stored booking (scheduled_start/end, else scheduled_time only). */
function bookingSpan(row: { scheduled_start: string | null; scheduled_end: string | null; scheduled_time: string | null }) {
  if (row.scheduled_start) {
    const s = new Date(Date.parse(row.scheduled_start) + MANILA_OFFSET_MS);
    const iso = s.toISOString().slice(0, 10);
    const start = s.getUTCHours() * 60 + s.getUTCMinutes();
    const endMs = row.scheduled_end ? Date.parse(row.scheduled_end) : NaN;
    const end = Number.isFinite(endMs) ? Math.round((endMs - Date.parse(row.scheduled_start)) / 60000) + start : start + SLOT_MINUTES;
    return { iso, range: { start, end: end > start ? end : start + SLOT_MINUTES } as Range | null };
  }
  return row.scheduled_time ? { iso: row.scheduled_time.slice(0, 10), range: null as Range | null } : null;
}

export async function monthDayMarks(
  db: SupabaseClient,
  opts: {
    lawyerId: string;
    /** Also count this client's bookings (reschedule: both calendars must be free). */
    clientId?: string | null;
    /** The consultation being moved (its own slot doesn't count as taken). */
    excludeId?: string | null;
    year: number;
    /** 0-based. */
    monthIndex: number;
    hours: ConsultationHours;
    /** Session length in minutes. */
    length?: number;
    /** Slots starting before this moment (epoch ms) can't be booked. */
    earliestMs: number;
    /** Last allowed date (YYYY-MM-DD), if any. */
    latestIso?: string | null;
  }
): Promise<CalendarDayMark[]> {
  const { lawyerId, clientId, excludeId, year, monthIndex, hours, earliestMs, latestIso } = opts;
  const length = opts.length ?? SLOT_MINUTES;
  const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const monthStart = `${year}-${pad(monthIndex + 1)}-01`;
  const monthEnd = `${year}-${pad(monthIndex + 1)}-${pad(lastDay)}`;
  // scheduled_time is the Manila date; widen by a day for rows saved with a UTC date.
  const from = new Date(Date.UTC(year, monthIndex, 0)).toISOString().slice(0, 10);
  const to = new Date(Date.UTC(year, monthIndex + 1, 1)).toISOString().slice(0, 10);

  const people = [`lawyer_id.eq.${lawyerId}`, ...(clientId ? [`client_id.eq.${clientId}`] : [])].join(',');
  const [bookingsRes, blocksRes] = await Promise.all([
    db
      .from('consultations')
      .select('id, scheduled_start, scheduled_end, scheduled_time')
      .or(people)
      .in('status', ACTIVE)
      .gte('scheduled_time', from)
      .lte('scheduled_time', to),
    db
      .from('lawyer_unavailability')
      .select('unavailable_date, start_minutes, end_minutes')
      .eq('lawyer_id', lawyerId)
      .gte('unavailable_date', monthStart)
      .lte('unavailable_date', monthEnd),
  ]);
  if (bookingsRes.error) console.warn('[monthDayMarks] bookings', bookingsRes.error.message);
  const blocksErr = blocksRes.error;
  if (blocksErr && blocksErr.code !== 'PGRST205' && blocksErr.code !== '42P01') console.warn('[monthDayMarks] blocks', blocksErr.message);

  const bookingsByDay = new Map<string, Array<Range | null>>();
  for (const row of (bookingsRes.data ?? []) as Array<{ id: string; scheduled_start: string | null; scheduled_end: string | null; scheduled_time: string | null }>) {
    if (row.id === excludeId) continue;
    const span = bookingSpan(row);
    if (!span) continue;
    bookingsByDay.set(span.iso, [...(bookingsByDay.get(span.iso) ?? []), span.range]);
  }
  const blocksByDay = new Map<string, Array<Range | 'all-day'>>();
  for (const b of (blocksRes.data ?? []) as Array<{ unavailable_date: string; start_minutes: number | null; end_minutes: number | null }>) {
    const entry: Range | 'all-day' = b.start_minutes === null || b.end_minutes === null ? 'all-day' : { start: b.start_minutes, end: b.end_minutes };
    blocksByDay.set(b.unavailable_date, [...(blocksByDay.get(b.unavailable_date) ?? []), entry]);
  }

  const todayIso = new Date(earliestMs + MANILA_OFFSET_MS).toISOString().slice(0, 10);
  const marks: CalendarDayMark[] = [];
  for (let day = 1; day <= lastDay; day++) {
    const iso = `${year}-${pad(monthIndex + 1)}-${pad(day)}`;
    const weekday = new Date(Date.UTC(year, monthIndex, day)).getUTCDay();
    const bookings = bookingsByDay.get(iso) ?? [];
    const blocks = blocksByDay.get(iso) ?? [];
    const mark = (state: CalendarDayState, reason: string | null): CalendarDayMark => ({ day, state, bookings: bookings.length, reason });

    if (iso < todayIso) {
      marks.push(mark('closed', 'This date has passed'));
      continue;
    }
    if (latestIso && iso > latestIso) {
      marks.push(mark('closed', 'Too far ahead'));
      continue;
    }
    const starts = slotStartsFor(hours, weekday, length);
    if (starts.length === 0) {
      marks.push(mark('closed', 'Not a consultation day'));
      continue;
    }
    if (blocks.includes('all-day')) {
      marks.push(mark('closed', 'Attorney unavailable'));
      continue;
    }
    let open = 0;
    let taken = 0;
    for (const start of starts) {
      const end = start + length;
      const startMs = Date.parse(`${iso}T${pad(Math.floor(start / 60))}:${pad(start % 60)}:00+08:00`);
      if (startMs < earliestMs) continue;
      if (blocks.some((b) => b !== 'all-day' && start < b.end && b.start < end)) continue;
      // A legacy booking without a time takes the whole day.
      if (bookings.some((r) => !r || (start < r.end && r.start < end))) {
        taken++;
        continue;
      }
      open++;
    }
    if (open > 0) marks.push(mark('open', null));
    else if (taken > 0) marks.push(mark('full', 'Fully booked'));
    else marks.push(mark('closed', iso === todayIso ? 'No times left today' : 'Attorney unavailable'));
  }
  return marks;
}
