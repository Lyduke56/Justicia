/**
 * The "Member since" summary of a lawyer's personal profile page, counted from the lawyer's side
 * (the client page counts by client_id in getProfileExtrasAction). Server only.
 * `lawyersConsulted` holds the number of clients served, so the shared ProfileSummary shape fits.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ProfileSummary } from '@/app/actions/profileExtrasActions';
import { currentUser } from '@/lib/auth/guards';
import { createServiceClient } from '@/lib/supabase/server';

export async function getLawyerProfileSummary(): Promise<ProfileSummary | null> {
  const user = await currentUser();
  if (!user) return null;
  const db = (await createServiceClient()) as unknown as SupabaseClient;
  const { data } = await db.from('consultations').select('client_id, status, scheduled_end').eq('lawyer_id', user.id);
  const rows = (data ?? []) as Array<{ client_id: string; status: string; scheduled_end: string | null }>;
  const nowIso = new Date().toISOString();
  // Same rules as the client page: a confirmed session whose time has passed counts as done.
  const done = rows.filter((c) => c.status === 'completed' || (c.status === 'confirmed' && !!c.scheduled_end && c.scheduled_end < nowIso));
  const upcoming = rows.filter((c) => ['pending', 'awaiting_client_confirmation', 'confirmed'].includes(c.status) && (!c.scheduled_end || c.scheduled_end >= nowIso));
  return {
    memberSince: user.created_at,
    consultationsCompleted: done.length,
    lawyersConsulted: new Set(done.map((c) => c.client_id)).size,
    upcomingConsultations: upcoming.length,
    lastSignInAt: user.last_sign_in_at ?? null,
  };
}
