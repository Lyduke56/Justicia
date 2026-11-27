/**
 * Server-side storage of a lawyer's regular consultation hours: one platform_settings row per
 * lawyer (`consultation_hours:lawyer:<lawyerId>`, value = ConsultationHours). No schema change;
 * platform_settings is not readable by browsers, so reads go through server actions.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { hoursOrDefault, type ConsultationHours } from '@/lib/lawyer/consultationHours';

export const hoursKeyFor = (lawyerId: string) => `consultation_hours:lawyer:${lawyerId}`;

/** The lawyer's saved hours (or the defaults), plus whether anything was saved. */
export async function readConsultationHours(
  db: SupabaseClient,
  lawyerId: string
): Promise<{ hours: ConsultationHours; saved: boolean; updatedAt: string | null }> {
  const { data, error } = await db.from('platform_settings').select('value, updated_at').eq('key', hoursKeyFor(lawyerId)).maybeSingle();
  if (error) console.warn('[consultationHours] read', error.message);
  const value = data?.value as unknown;
  return { hours: hoursOrDefault(value), saved: !!value, updatedAt: (data?.updated_at as string | null | undefined) ?? null };
}

/** The hours used for booking checks (defaults when none are saved). */
export async function loadConsultationHours(db: SupabaseClient, lawyerId: string): Promise<ConsultationHours> {
  return (await readConsultationHours(db, lawyerId)).hours;
}
