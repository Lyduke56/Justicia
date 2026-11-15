'use server';

import { revalidatePath } from 'next/cache';
import { createClient, createServiceClient } from '@/lib/supabase/server';

/**
 * Lawyer availability: days / time ranges a lawyer has blocked off
 * (table public.lawyer_unavailability — supabase/migrations/0008_lawyer_unavailability.sql).
 *
 * All times are Asia/Manila. A NULL start/end means the whole day is blocked.
 * Writes authenticate with the cookie client and then use the service client scoped to the
 * caller's own id, matching the rest of the lawyer-profile backend.
 */

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const TABLE = 'lawyer_unavailability';
const ACTIVE_BOOKING_STATUSES = ['pending', 'confirmed', 'awaiting_client_confirmation'];
const MAX_REASON_LENGTH = 300;
const MISSING_TABLE_ERROR =
  'Availability settings are not set up yet. Please run supabase/migrations/0008_lawyer_unavailability.sql in Supabase.';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

/** Public shape (used by the client booking calendar). */
export interface UnavailabilityBlock {
  /** YYYY-MM-DD (Manila) */
  date: string;
  /** null = whole day */
  startMinutes: number | null;
  endMinutes: number | null;
}

/** Owner shape (Lawyer Profile → Availability list). */
export interface MyUnavailabilityEntry extends UnavailabilityBlock {
  id: string;
  reason: string | null;
  label: string;
}

export interface AddUnavailabilityInput {
  date: string;
  allDay: boolean;
  startMinutes?: number | null;
  endMinutes?: number | null;
  reason?: string;
}

interface Row {
  id: string;
  lawyer_id: string;
  unavailable_date: string;
  start_minutes: number | null;
  end_minutes: number | null;
  reason: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const isMissingTable = (error: { code?: string } | null | undefined) =>
  error?.code === 'PGRST205' || error?.code === '42P01';

function todayManilaIso(): string {
  return new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function nowManilaMinutes(): number {
  const d = new Date(Date.now() + 8 * 60 * 60 * 1000);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

function toManilaParts(timestamp: string): { isoDate: string; minutes: number } {
  const shifted = new Date(new Date(timestamp).getTime() + 8 * 60 * 60 * 1000);
  return { isoDate: shifted.toISOString().slice(0, 10), minutes: shifted.getUTCHours() * 60 + shifted.getUTCMinutes() };
}

function formatClock(minutes: number): string {
  const h24 = Math.floor(minutes / 60) % 24;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(minutes % 60).padStart(2, '0')} ${h24 < 12 ? 'AM' : 'PM'}`;
}

function formatDateLabel(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', {
    weekday: 'short', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  });
}

function blockLabel(row: Pick<Row, 'start_minutes' | 'end_minutes'>): string {
  return row.start_minutes === null || row.end_minutes === null
    ? 'Entire day'
    : `${formatClock(row.start_minutes)} – ${formatClock(row.end_minutes)}`;
}

function isValidIsoDate(iso: string): boolean {
  if (!ISO_DATE_REGEX.test(iso)) return false;
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number) {
  return aStart < bEnd && bStart < aEnd;
}

async function requireLawyerId(): Promise<{ userId: string; db: Db } | { error: string }> {
  const auth = await createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return { error: 'Please sign in to manage your availability.' };
  const db = (await createServiceClient()) as Db;
  const { data: profile } = await db.from('lawyer_profiles').select('user_id').eq('user_id', user.id).maybeSingle();
  if (!profile) return { error: 'Only lawyers can manage consultation availability.' };
  return { userId: user.id, db };
}

function revalidateAvailability(lawyerId: string) {
  revalidatePath('/lawyer/profile');
  revalidatePath(`/client/lawyers/${lawyerId}`);
}

// ─── Reads ────────────────────────────────────────────────────────────────────

/**
 * Blocked days / time ranges of a lawyer between two Manila dates (inclusive).
 * Public: used by the client booking calendar to disable unavailable days and slots.
 */
export async function getLawyerUnavailabilityAction(
  lawyerId: string,
  fromDate: string,
  toDate: string
): Promise<UnavailabilityBlock[]> {
  try {
    if (!UUID_REGEX.test(lawyerId ?? '') || !isValidIsoDate(fromDate) || !isValidIsoDate(toDate)) return [];
    const db = (await createServiceClient()) as Db;
    const { data, error } = await db
      .from(TABLE)
      .select('unavailable_date, start_minutes, end_minutes')
      .eq('lawyer_id', lawyerId)
      .gte('unavailable_date', fromDate)
      .lte('unavailable_date', toDate);
    if (error) {
      if (!isMissingTable(error)) console.error('[getLawyerUnavailabilityAction]', error.message);
      return [];
    }
    return (data ?? []).map((r: Row) => ({
      date: r.unavailable_date,
      startMinutes: r.start_minutes,
      endMinutes: r.end_minutes,
    }));
  } catch (err) {
    console.error('[getLawyerUnavailabilityAction]', err);
    return [];
  }
}

/** The signed-in lawyer's upcoming (today onward) blocked days / time ranges. */
export async function getMyUnavailabilityAction(): Promise<
  { success: true; entries: MyUnavailabilityEntry[] } | { success: false; error: string }
> {
  try {
    const ctx = await requireLawyerId();
    if ('error' in ctx) return { success: false, error: ctx.error };
    const { data, error } = await ctx.db
      .from(TABLE)
      .select('id, lawyer_id, unavailable_date, start_minutes, end_minutes, reason')
      .eq('lawyer_id', ctx.userId)
      .gte('unavailable_date', todayManilaIso())
      .order('unavailable_date', { ascending: true })
      .order('start_minutes', { ascending: true, nullsFirst: true });
    if (error) {
      if (isMissingTable(error)) return { success: false, error: MISSING_TABLE_ERROR };
      throw error;
    }
    return {
      success: true,
      entries: (data ?? []).map((r: Row) => ({
        id: r.id,
        date: r.unavailable_date,
        startMinutes: r.start_minutes,
        endMinutes: r.end_minutes,
        reason: r.reason,
        label: `${formatDateLabel(r.unavailable_date)} · ${blockLabel(r)}`,
      })),
    };
  } catch (err) {
    console.error('[getMyUnavailabilityAction]', err);
    return { success: false, error: 'Unable to load your unavailable dates. Please try again.' };
  }
}

// ─── Writes ───────────────────────────────────────────────────────────────────

export async function addUnavailabilityAction(
  input: AddUnavailabilityInput
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const ctx = await requireLawyerId();
    if ('error' in ctx) return { success: false, error: ctx.error };
    const { db, userId } = ctx;

    const date = typeof input?.date === 'string' ? input.date : '';
    if (!isValidIsoDate(date)) return { success: false, error: 'Please choose a valid date.' };
    const today = todayManilaIso();
    if (date < today) return { success: false, error: 'You can only set unavailability for today or a future date.' };

    let start: number | null = null;
    let end: number | null = null;
    if (!input.allDay) {
      start = Number(input.startMinutes);
      end = Number(input.endMinutes);
      if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end > 1440 || end <= start) {
        return { success: false, error: 'Please choose a valid time range (the end time must be after the start time).' };
      }
      if (date === today && end <= nowManilaMinutes()) {
        return { success: false, error: 'That time range has already passed today.' };
      }
    }
    const reason = typeof input.reason === 'string' ? input.reason.trim() : '';
    if (reason.length > MAX_REASON_LENGTH) {
      return { success: false, error: `The note must be ${MAX_REASON_LENGTH} characters or fewer.` };
    }

    // Avoid duplicate / redundant blocks.
    const { data: existing, error: existingErr } = await db
      .from(TABLE)
      .select('id, start_minutes, end_minutes')
      .eq('lawyer_id', userId)
      .eq('unavailable_date', date);
    if (existingErr) {
      if (isMissingTable(existingErr)) return { success: false, error: MISSING_TABLE_ERROR };
      throw existingErr;
    }
    const rows = (existing ?? []) as Row[];
    if (rows.some((r) => r.start_minutes === null)) {
      return { success: false, error: 'This whole day is already marked as unavailable.' };
    }
    if (start !== null && end !== null) {
      const clash = rows.find((r) => r.start_minutes !== null && r.end_minutes !== null && overlaps(start!, end!, r.start_minutes, r.end_minutes));
      if (clash) {
        return { success: false, error: `This overlaps an existing unavailable time (${blockLabel(clash)}). Remove it first or choose another range.` };
      }
    }

    // Don't silently block time a client has already booked.
    const { data: bookings } = await db
      .from('consultations')
      .select('scheduled_start, scheduled_end')
      .eq('lawyer_id', userId)
      .in('status', ACTIVE_BOOKING_STATUSES)
      .gte('scheduled_time', date)
      .lte('scheduled_time', date);
    const conflicting = ((bookings ?? []) as Array<{ scheduled_start: string | null; scheduled_end: string | null }>)
      .filter((b) => b.scheduled_start)
      .map((b) => {
        const s = toManilaParts(b.scheduled_start!);
        const e = b.scheduled_end ? toManilaParts(b.scheduled_end).minutes : s.minutes + 60;
        return { date: s.isoDate, start: s.minutes, end: e > s.minutes ? e : s.minutes + 60 };
      })
      .filter((b) => b.date === date && (start === null || overlaps(start, end!, b.start, b.end)));
    if (conflicting.length > 0) {
      const when = conflicting.map((b) => `${formatClock(b.start)} – ${formatClock(b.end)}`).join(', ');
      return {
        success: false,
        error: `You already have a consultation booked on this day (${when}). Cancel or reschedule it from Consultations first, or choose a different time.`,
      };
    }

    const { error } = await db.from(TABLE).insert({
      lawyer_id: userId,
      unavailable_date: date,
      start_minutes: start,
      end_minutes: end,
      reason: reason || null,
    });
    if (error) {
      if (isMissingTable(error)) return { success: false, error: MISSING_TABLE_ERROR };
      throw error;
    }

    revalidateAvailability(userId);
    return { success: true };
  } catch (err) {
    console.error('[addUnavailabilityAction]', err);
    return { success: false, error: 'Unable to save your unavailability. Please try again.' };
  }
}

export async function removeUnavailabilityAction(
  id: string
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    if (!UUID_REGEX.test(id ?? '')) return { success: false, error: 'Entry not found.' };
    const ctx = await requireLawyerId();
    if ('error' in ctx) return { success: false, error: ctx.error };
    const { data, error } = await ctx.db.from(TABLE).delete().eq('id', id).eq('lawyer_id', ctx.userId).select('id');
    if (error) {
      if (isMissingTable(error)) return { success: false, error: MISSING_TABLE_ERROR };
      throw error;
    }
    if (!data?.length) return { success: false, error: 'Entry not found.' };
    revalidateAvailability(ctx.userId);
    return { success: true };
  } catch (err) {
    console.error('[removeUnavailabilityAction]', err);
    return { success: false, error: 'Unable to remove this entry. Please try again.' };
  }
}
