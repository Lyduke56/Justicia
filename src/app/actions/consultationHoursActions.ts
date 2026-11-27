'use server';

/**
 * Regular consultation hours (new code only; stored in platform_settings, no schema change):
 *  - the lawyer reads and saves their weekly hours (Lawyer Profile → Availability);
 *  - the booking calendar reads a lawyer's hours and the month's day indicators.
 * Bookings and reschedules are checked against the same hours on the server
 * (bookConsultationAction, getRescheduleOptionsAction, requestRescheduleAction).
 */
import { revalidatePath } from 'next/cache';
import { guardMessage, requireActiveAccount, requireRole } from '@/lib/auth/guards';
import { normalizeHours, type ConsultationHours } from '@/lib/lawyer/consultationHours';
import { hoursKeyFor, readConsultationHours } from '@/lib/lawyer/consultationHoursServer';
import { monthDayMarks, type CalendarDayMark } from '@/lib/consultations/monthAvailability';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MONTH_REGEX = /^(\d{4})-(\d{2})$/;

type Result<T = object> = ({ success: true } & T) | { success: false; error: string };

// ─── Lawyer: their own hours ──────────────────────────────────────────────────

export async function getMyConsultationHoursAction(): Promise<Result<{ hours: ConsultationHours; saved: boolean }>> {
  try {
    const { user, db } = await requireRole('lawyer');
    const { hours, saved } = await readConsultationHours(db, user.id);
    return { success: true, hours, saved };
  } catch (err) {
    return { success: false, error: guardMessage(err, 'Your consultation hours could not be loaded.') };
  }
}

/**
 * Saves the weekly hours. Bookings already made outside the new hours stay as they are; only
 * new bookings and reschedules follow the new hours.
 */
export async function saveMyConsultationHoursAction(input: ConsultationHours): Promise<Result<{ hours: ConsultationHours }>> {
  try {
    const clean = normalizeHours(input);
    if ('error' in clean) return { success: false, error: clean.error };
    const { user, db } = await requireRole('lawyer');

    const nowIso = new Date().toISOString();
    const { error } = await db.from('platform_settings').upsert(
      {
        key: hoursKeyFor(user.id),
        value: clean.hours,
        description: 'Regular consultation hours of a lawyer (Monday to Saturday, with breaks)',
        updated_by: user.id,
        updated_at: nowIso,
      },
      { onConflict: 'key' }
    );
    if (error) {
      console.error('[saveMyConsultationHoursAction]', error.message);
      return { success: false, error: 'Your consultation hours could not be saved. Please try again.' };
    }
    // Shown to admins as "Lawyer profile updated" (best effort).
    await db.from('audit_log').insert({
      actor_id: user.id,
      action: 'lawyer.hours.updated',
      target_type: 'lawyer_profile',
      target_id: user.id,
      details: { hours: clean.hours },
    });
    try {
      revalidatePath('/lawyer/profile');
      revalidatePath(`/client/lawyers/${user.id}`);
    } catch {
      // no request scope
    }
    return { success: true, hours: clean.hours };
  } catch (err) {
    return { success: false, error: guardMessage(err, 'Your consultation hours could not be saved.') };
  }
}

// ─── Booking calendar ─────────────────────────────────────────────────────────

/**
 * A lawyer's hours and the day indicators of one month ("YYYY-MM") for the booking calendar:
 * which days are open, fully booked or not available, and which already have bookings.
 */
export async function getBookingMonthAction(
  lawyerId: string,
  month: string
): Promise<Result<{ hours: ConsultationHours; days: CalendarDayMark[] }>> {
  try {
    if (!UUID_REGEX.test(lawyerId ?? '')) return { success: false, error: 'Attorney not found.' };
    const m = MONTH_REGEX.exec(month ?? '');
    if (!m || Number(m[2]) < 1 || Number(m[2]) > 12) return { success: false, error: 'Please choose a valid month.' };
    const { db } = await requireActiveAccount();
    const { hours } = await readConsultationHours(db, lawyerId);
    const days = await monthDayMarks(db, {
      lawyerId,
      year: Number(m[1]),
      monthIndex: Number(m[2]) - 1,
      hours,
      earliestMs: Date.now(),
    });
    return { success: true, hours, days };
  } catch (err) {
    return { success: false, error: guardMessage(err, 'Availability could not be loaded. Please try again.') };
  }
}
