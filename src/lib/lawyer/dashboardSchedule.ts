/**
 * Lawyer dashboard: date-range filtering and KPI figures.
 *
 * Shared by GET /api/live/lawyer-dashboard (real records) and the dashboard view (the signed-out
 * demo preview filters its sample records with the same rules). Pure: no I/O, no runtime imports.
 *
 * Dates are calendar days in Asia/Manila (UTC+8, no DST), written as ISO "YYYY-MM-DD" strings so
 * ranges compare as plain strings. Months are 0-based, like LawyerConsultation.month.
 */
import type {
  LawyerConsultation,
  LawyerConsultationStatus,
  LawyerEarningsData,
} from '@/app/actions/consultationActions';

/** Statuses that hold a slot on the lawyer's calendar (requests and cancelled sessions do not). */
export const SCHEDULED_STATUSES: readonly LawyerConsultationStatus[] = [
  'pending_payment',
  'payment_review',
  'confirmed',
  'completed',
];

/** Longest range one request may ask for (a quarter), so a single call stays small. */
export const MAX_RANGE_DAYS = 92;

const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export interface CalendarDay {
  year: number;
  /** 0-based */
  month: number;
  day: number;
}

/** Inclusive range of ISO dates. */
export interface DateRange {
  from: string;
  to: string;
}

export interface LawyerScheduleData {
  range: DateRange;
  /** Today in Manila (ISO). */
  today: string;
  /** Scheduled consultations inside the range, earliest first. */
  consultations: LawyerConsultation[];
  /** Scheduled consultations per ISO date across all dates (for the date picker). */
  activeDates: Record<string, number>;
}

export interface LawyerDashboardStats {
  today: string;
  /** Scheduled consultations today. */
  todayScheduled: number;
  /** Of those, the ones that have not started yet. */
  todayUpcoming: number;
  /** Requests waiting for the lawyer's approval. */
  pendingRequests: number;
  /** Distinct clients behind those requests. */
  pendingClients: number;
  year: number;
  /** 0-based current month in Manila. */
  month: number;
  /** Net earnings of the current month (null when earnings could not be loaded). */
  monthEarnings: number | null;
  /** Net earnings of the previous month (null when earnings could not be loaded). */
  previousMonthEarnings: number | null;
  /** 0–5, or null when the lawyer has no ratings yet. */
  ratingAvg: number | null;
  ratingCount: number;
  /** 0–100, or null when there are no requests yet. */
  responseRate: number | null;
}

type Schedulable = Pick<
  LawyerConsultation,
  'status' | 'year' | 'month' | 'day' | 'scheduledStart' | 'timeRange' | 'timeTag'
>;

/** Enough to place a session in time (lawyer or client consultation). */
export interface Timed {
  year: number;
  /** 0-based */
  month: number;
  day: number;
  scheduledStart: string | null;
  /** e.g. "10:30 AM - 11:30 AM" */
  timeRange?: string | null;
  timeTag?: string | null;
}

// ─── Calendar dates ──────────────────────────────────────────────────────────

export function toIsoDate(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, '0')}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

/** Parses "YYYY-MM-DD"; null for malformed or impossible dates (e.g. 2026-02-30). */
export function parseIsoDate(value: string | null | undefined): CalendarDay | null {
  const match = ISO_DATE.exec(value ?? '');
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  if (year < 2000 || year > 2100 || month < 0 || month > 11) return null;
  if (day < 1 || day > daysInMonth(year, month)) return null;
  return { year, month, day };
}

export function isoOf(c: CalendarDay): string {
  return toIsoDate(c.year, c.month, c.day);
}

/** Shifts an ISO date by whole days. */
export function addDays(iso: string, days: number): string {
  const d = parseIsoDate(iso);
  if (!d) return iso;
  const shifted = new Date(Date.UTC(d.year, d.month, d.day) + days * DAY_MS);
  return toIsoDate(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate());
}

/** Today's date in Asia/Manila. */
export function todayInManila(now: number = Date.now()): string {
  const d = new Date(now + MANILA_OFFSET_MS);
  return toIsoDate(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

export function dayRange(iso: string): DateRange {
  return { from: iso, to: iso };
}

export function monthRange(year: number, month: number): DateRange {
  return { from: toIsoDate(year, month, 1), to: toIsoDate(year, month, daysInMonth(year, month)) };
}

/** Validates a requested range: both real dates, from ≤ to, at most `maxDays` long. */
export function parseDateRange(
  from: string | null | undefined,
  to: string | null | undefined,
  maxDays: number = MAX_RANGE_DAYS
): DateRange | null {
  const a = parseIsoDate(from);
  const b = parseIsoDate(to);
  if (!a || !b) return null;
  const span = (Date.UTC(b.year, b.month, b.day) - Date.UTC(a.year, a.month, a.day)) / DAY_MS;
  if (span < 0 || span + 1 > maxDays) return null;
  return { from: isoOf(a), to: isoOf(b) };
}

// ─── Times ───────────────────────────────────────────────────────────────────

/** Minutes after midnight of the first "h:mm AM/PM" in a label like "3:00 PM - 4:00 PM". */
export function startMinutes(label: string | null | undefined): number | null {
  const match = /(\d{1,2}):(\d{2})\s*([AP]M)/i.exec(label ?? '');
  if (!match) return null;
  const hours = Number(match[1]) % 12 + (match[3].toUpperCase() === 'PM' ? 12 : 0);
  return hours * 60 + Number(match[2]);
}

/** Epoch ms of a consultation's start (falls back to the slot label, then Manila midnight). */
export function startMsOf(c: Timed): number {
  if (c.scheduledStart) {
    const ms = Date.parse(c.scheduledStart);
    if (!Number.isNaN(ms)) return ms;
  }
  const minutes = startMinutes(c.timeRange) ?? startMinutes(c.timeTag) ?? 0;
  return Date.UTC(c.year, c.month, c.day) + minutes * 60_000 - MANILA_OFFSET_MS;
}

/** Length of a "h:mm AM - h:mm PM" range in minutes, or null when it can't be read. */
function rangeMinutes(label: string | null | undefined): number | null {
  const times = [...(label ?? '').matchAll(/(\d{1,2}):(\d{2})\s*([AP]M)/gi)];
  if (times.length < 2) return null;
  const toMinutes = (m: RegExpMatchArray) => (Number(m[1]) % 12 + (m[3].toUpperCase() === 'PM' ? 12 : 0)) * 60 + Number(m[2]);
  const length = toMinutes(times[1]) - toMinutes(times[0]);
  return length > 0 ? length : length + 24 * 60;
}

/** Epoch ms of a consultation's end: its start plus the booked length (an hour if unknown). */
export function endMsOf(c: Timed): number {
  const minutes = rangeMinutes(c.timeRange) ?? rangeMinutes(c.timeTag) ?? 60;
  return startMsOf(c) + minutes * 60_000;
}

/**
 * "Soonest first": sessions that are still ahead or in progress and still live (`isLive`),
 * earliest start first, then everything else (finished, closed, cancelled), most recent first.
 * So the consultation shown first is always the next one to happen.
 */
export function orderSoonestFirst<T extends Timed>(items: readonly T[], isLive: (c: T) => boolean, now: number = Date.now()): T[] {
  return items
    .map((c) => ({ c, start: startMsOf(c), ahead: isLive(c) && endMsOf(c) > now }))
    .sort((a, b) => (a.ahead === b.ahead ? (a.ahead ? a.start - b.start : b.start - a.start) : a.ahead ? -1 : 1))
    .map(({ c }) => c);
}

// ─── Filtering ───────────────────────────────────────────────────────────────

export function isScheduled(c: Pick<LawyerConsultation, 'status'>): boolean {
  return SCHEDULED_STATUSES.includes(c.status);
}

/** Scheduled consultations whose date falls inside the range, earliest first. */
export function scheduleInRange<T extends Schedulable>(items: readonly T[], range: DateRange): T[] {
  return items
    .filter((c) => {
      if (!isScheduled(c)) return false;
      const iso = isoOf(c);
      return iso >= range.from && iso <= range.to;
    })
    .map((c) => ({ c, start: startMsOf(c) }))
    .sort((a, b) => a.start - b.start)
    .map(({ c }) => c);
}

/** Number of scheduled consultations on each date. */
export function countByDate(items: readonly Schedulable[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const c of items) {
    if (!isScheduled(c)) continue;
    const iso = isoOf(c);
    counts[iso] = (counts[iso] ?? 0) + 1;
  }
  return counts;
}

export function buildSchedule(
  items: readonly LawyerConsultation[],
  range: DateRange,
  now: number = Date.now()
): LawyerScheduleData {
  return {
    range,
    today: todayInManila(now),
    consultations: scheduleInRange(items, range),
    activeDates: countByDate(items),
  };
}

// ─── KPI figures ─────────────────────────────────────────────────────────────

export function buildDashboardStats({
  consultations,
  earnings,
  rating,
  now = Date.now(),
}: {
  consultations: readonly LawyerConsultation[];
  earnings: LawyerEarningsData | null;
  rating: { avg: number | null; count: number } | null;
  now?: number;
}): LawyerDashboardStats {
  const today = todayInManila(now);
  const todays = scheduleInRange(consultations, dayRange(today));
  const pending = consultations.filter((c) => c.status === 'pending');
  const { year, month } = parseIsoDate(today)!;

  let monthEarnings: number | null = null;
  let previousMonthEarnings: number | null = null;
  if (earnings && earnings.year === year) {
    monthEarnings = earnings.monthlyEarnings[month] ?? 0;
    previousMonthEarnings = month > 0 ? earnings.monthlyEarnings[month - 1] ?? 0 : earnings.previousDecemberEarnings;
  }

  const avg = rating?.avg;
  const ratingCount = Math.max(rating?.count ?? 0, earnings?.reviewCount ?? 0);
  return {
    today,
    todayScheduled: todays.length,
    todayUpcoming: todays.filter((c) => c.status !== 'completed' && startMsOf(c) > now).length,
    pendingRequests: pending.length,
    pendingClients: new Set(pending.map((c) => c.clientId)).size,
    year,
    month,
    monthEarnings,
    previousMonthEarnings,
    ratingAvg: typeof avg === 'number' && avg > 0 && ratingCount > 0 ? Math.min(5, avg) : null,
    ratingCount,
    responseRate: earnings?.responseRate ?? null,
  };
}
