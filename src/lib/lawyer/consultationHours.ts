/**
 * A lawyer's regular consultation hours (browser + server safe).
 *
 * Each weekday from Monday to Saturday is either closed or open from `start` to `end`, minus any
 * breaks (lunch, dinner, ...). Sunday is never a consultation day. Bookable slots are one hour
 * long, start at the opening time and skip over breaks: 6:00 PM - 11:00 PM with a 9:00 - 9:30 PM
 * break gives 6, 7, 8, 9:30 PM (10:30 PM would run past closing).
 *
 * Times are minutes from midnight, Asia/Manila. Stored in platform_settings under
 * `consultation_hours:lawyer:<lawyerId>` (see consultationHoursServer.ts). A lawyer who never set
 * hours gets DEFAULT_CONSULTATION_HOURS, which matches the fixed slots used before this existed.
 */

export const SLOT_MINUTES = 60;
/** Most breaks per day. */
export const MAX_BREAKS = 4;
/** Earliest opening and latest closing a lawyer can pick (30-minute steps in between). */
export const EARLIEST_MINUTES = 5 * 60;
export const LATEST_MINUTES = 23 * 60 + 30;
export const STEP_MINUTES = 30;

/** Monday (1) to Saturday (6), as Date#getDay() numbers them. */
export const CONSULTATION_WEEKDAYS = [
  { day: 1, label: 'Monday', short: 'Mon' },
  { day: 2, label: 'Tuesday', short: 'Tue' },
  { day: 3, label: 'Wednesday', short: 'Wed' },
  { day: 4, label: 'Thursday', short: 'Thu' },
  { day: 5, label: 'Friday', short: 'Fri' },
  { day: 6, label: 'Saturday', short: 'Sat' },
] as const;

export type WeekdayNumber = (typeof CONSULTATION_WEEKDAYS)[number]['day'];

export interface HoursBreak {
  start: number;
  end: number;
}

export interface DayHours {
  open: boolean;
  start: number;
  end: number;
  breaks: HoursBreak[];
}

export interface ConsultationHours {
  /** Keyed by weekday number ("1" = Monday … "6" = Saturday). */
  days: Record<`${WeekdayNumber}`, DayHours>;
}

const weekdayKey = (day: WeekdayNumber) => String(day) as `${WeekdayNumber}`;

/** 9:00 AM - 5:00 PM with an 11:00 AM - 1:00 PM break, Monday to Saturday (the old fixed slots). */
export const DEFAULT_DAY_HOURS: DayHours = { open: true, start: 9 * 60, end: 17 * 60, breaks: [{ start: 11 * 60, end: 13 * 60 }] };

export const DEFAULT_CONSULTATION_HOURS: ConsultationHours = {
  days: Object.fromEntries(
    CONSULTATION_WEEKDAYS.map((w) => [weekdayKey(w.day), { ...DEFAULT_DAY_HOURS, breaks: DEFAULT_DAY_HOURS.breaks.map((b) => ({ ...b })) }])
  ) as ConsultationHours['days'],
};

/** "6:30 PM" */
export function formatClock(minutes: number): string {
  const h24 = Math.floor(minutes / 60) % 24;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(minutes % 60).padStart(2, '0')} ${h24 < 12 ? 'AM' : 'PM'}`;
}

/** "2:00 PM - 3:00 PM • PST, GMT+8" (the booking flow's slot label). */
export function slotLabel(start: number, length = SLOT_MINUTES): string {
  return `${formatClock(start)} - ${formatClock(start + length)} • PST, GMT+8`;
}

/** Weekday (0 = Sunday) of a YYYY-MM-DD date. */
export function weekdayOfIso(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** The hours for a weekday (0–6); null when closed (always on Sunday). */
export function hoursForWeekday(hours: ConsultationHours, weekday: number): DayHours | null {
  if (weekday < 1 || weekday > 6) return null;
  const day = hours.days[weekdayKey(weekday as WeekdayNumber)];
  return day && day.open ? day : null;
}

/** Start minutes of the bookable slots on a weekday (empty when closed). */
export function slotStartsFor(hours: ConsultationHours, weekday: number, length = SLOT_MINUTES): number[] {
  const day = hoursForWeekday(hours, weekday);
  if (!day) return [];
  const breaks = [...day.breaks].sort((a, b) => a.start - b.start);
  const starts: number[] = [];
  let t = day.start;
  while (t + length <= day.end) {
    const clash = breaks.find((b) => t < b.end && b.start < t + length);
    if (clash) {
      t = clash.end;
      continue;
    }
    starts.push(t);
    t += length;
  }
  return starts;
}

/** True when [start, start + length) is one of the weekday's slots. */
export function isRegularSlot(hours: ConsultationHours, weekday: number, start: number, length = SLOT_MINUTES): boolean {
  return slotStartsFor(hours, weekday, length).includes(start);
}

/** True when [start, end) lies inside the weekday's open hours and clear of its breaks. */
export function fitsHours(hours: ConsultationHours, weekday: number, start: number, end: number): boolean {
  const day = hoursForWeekday(hours, weekday);
  if (!day || start < day.start || end > day.end) return false;
  return !day.breaks.some((b) => start < b.end && b.start < end);
}

/** "9:00 AM – 5:00 PM · break 11:00 AM – 1:00 PM" or "Closed". */
export function describeDay(day: DayHours | null | undefined): string {
  if (!day || !day.open) return 'Closed';
  const range = `${formatClock(day.start)} – ${formatClock(day.end)}`;
  if (day.breaks.length === 0) return range;
  const breaks = day.breaks.map((b) => `${formatClock(b.start)} – ${formatClock(b.end)}`).join(', ');
  return `${range} · break${day.breaks.length === 1 ? '' : 's'} ${breaks}`;
}

const isStep = (v: unknown): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 24 * 60 && v % STEP_MINUTES === 0;

/**
 * Validates hours sent by the browser (or read from storage). Returns clean hours or the first
 * problem in words.
 */
export function normalizeHours(input: unknown): { hours: ConsultationHours } | { error: string } {
  const rawDays = input && typeof input === 'object' ? (input as { days?: unknown }).days : null;
  if (!rawDays || typeof rawDays !== 'object') return { error: 'Your consultation hours could not be read. Please try again.' };
  const days = {} as ConsultationHours['days'];
  for (const { day, label } of CONSULTATION_WEEKDAYS) {
    const raw = (rawDays as Record<string, unknown>)[String(day)] as Partial<DayHours> | undefined;
    if (!raw || typeof raw !== 'object' || !raw.open) {
      days[weekdayKey(day)] = { open: false, start: DEFAULT_DAY_HOURS.start, end: DEFAULT_DAY_HOURS.end, breaks: [] };
      continue;
    }
    const { start, end } = raw;
    if (!isStep(start) || !isStep(end) || start < EARLIEST_MINUTES || end > LATEST_MINUTES) {
      return { error: `${label}: choose times between ${formatClock(EARLIEST_MINUTES)} and ${formatClock(LATEST_MINUTES)}.` };
    }
    if (end - start < SLOT_MINUTES) return { error: `${label}: the hours must be at least 1 hour long.` };
    const rawBreaks = Array.isArray(raw.breaks) ? raw.breaks : [];
    if (rawBreaks.length > MAX_BREAKS) return { error: `${label}: add up to ${MAX_BREAKS} breaks.` };
    const breaks: HoursBreak[] = [];
    for (const b of rawBreaks as Array<Partial<HoursBreak>>) {
      if (!b || !isStep(b.start) || !isStep(b.end) || b.end <= b.start) {
        return { error: `${label}: each break needs an end time after its start time.` };
      }
      if (b.start < start || b.end > end) return { error: `${label}: breaks must fall inside the consultation hours.` };
      breaks.push({ start: b.start, end: b.end });
    }
    breaks.sort((a, b) => a.start - b.start);
    for (let i = 1; i < breaks.length; i++) {
      if (breaks[i].start < breaks[i - 1].end) return { error: `${label}: breaks can't overlap.` };
    }
    const clean: DayHours = { open: true, start, end, breaks };
    days[weekdayKey(day)] = clean;
    if (slotStartsFor({ days: { ...DEFAULT_CONSULTATION_HOURS.days, [weekdayKey(day)]: clean } }, day).length === 0) {
      return { error: `${label}: the breaks leave no full 1-hour slot. Shorten a break or extend the hours.` };
    }
  }
  return { hours: { days } };
}

/** Stored hours, or the defaults when nothing valid is stored. */
export function hoursOrDefault(stored: unknown): ConsultationHours {
  if (!stored) return DEFAULT_CONSULTATION_HOURS;
  const res = normalizeHours(stored);
  return 'hours' in res ? res.hours : DEFAULT_CONSULTATION_HOURS;
}
