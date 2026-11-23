import { addDays, dayRange, monthRange, parseIsoDate, type DateRange } from '@/lib/lawyer/dashboardSchedule';

/** What the dashboard's schedule shows: one day or a whole month. */
export type ScheduleFilter =
  | { scope: 'day'; date: string }
  | { scope: 'month'; year: number; month: number };

export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
export const MONTHS_SHORT = MONTHS.map((m) => m.slice(0, 3));
const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function filterRange(f: ScheduleFilter): DateRange {
  return f.scope === 'day' ? dayRange(f.date) : monthRange(f.year, f.month);
}

export function filterKey(f: ScheduleFilter): string {
  return f.scope === 'day' ? f.date : `${f.year}-${f.month}`;
}

export function sameFilter(a: ScheduleFilter, b: ScheduleFilter): boolean {
  return a.scope === b.scope && filterKey(a) === filterKey(b);
}

/** "Tue, Nov 24" (with the year when it isn't this year). */
export function shortDate(iso: string, today: string): string {
  const d = parseIsoDate(iso);
  if (!d) return iso;
  const weekday = WEEKDAYS_SHORT[new Date(Date.UTC(d.year, d.month, d.day)).getUTCDay()];
  const base = `${weekday}, ${MONTHS_SHORT[d.month]} ${d.day}`;
  return iso.slice(0, 4) === today.slice(0, 4) ? base : `${base}, ${d.year}`;
}

/** Today / Tomorrow / Yesterday, or null. */
function relativeDay(iso: string, today: string): 'Today' | 'Tomorrow' | 'Yesterday' | null {
  if (iso === today) return 'Today';
  if (iso === addDays(today, 1)) return 'Tomorrow';
  if (iso === addDays(today, -1)) return 'Yesterday';
  return null;
}

/** Text inside the filter pill. */
export function filterLabel(f: ScheduleFilter, today: string): { prefix: string; value: string } {
  if (f.scope === 'month') return { prefix: 'Filter by month', value: `${MONTHS[f.month]} ${f.year}` };
  const rel = relativeDay(f.date, today);
  const d = parseIsoDate(f.date)!;
  return {
    prefix: 'Filter by date',
    value: rel ? `${rel}, ${MONTHS_SHORT[d.month]} ${d.day}` : shortDate(f.date, today),
  };
}

/** Section heading above the cards / table. */
export function filterHeading(f: ScheduleFilter, today: string): string {
  if (f.scope === 'month') {
    const thisYear = String(f.year) === today.slice(0, 4);
    return thisYear ? `${MONTHS[f.month]}'s Consultations` : `${MONTHS[f.month]} ${f.year} Consultations`;
  }
  const rel = relativeDay(f.date, today);
  if (rel === 'Today') return "Today's Scheduled Consultations";
  if (rel === 'Tomorrow') return "Tomorrow's Scheduled Consultations";
  if (rel === 'Yesterday') return "Yesterday's Consultations";
  return `Consultations on ${shortDate(f.date, today)}`;
}

export function emptyCopy(f: ScheduleFilter, today: string): { title: string; description: string } {
  if (f.scope === 'month') {
    return {
      title: `Nothing scheduled in ${MONTHS[f.month]}`,
      description: 'Confirmed bookings and sessions waiting on payment for this month will appear here.',
    };
  }
  const rel = relativeDay(f.date, today);
  return {
    title: rel === 'Today' ? 'No consultations today' : `No consultations on ${shortDate(f.date, today)}`,
    description:
      f.date < today
        ? 'You had no sessions on this day.'
        : 'Your day is open. Approved bookings for this date will appear here.',
  };
}
