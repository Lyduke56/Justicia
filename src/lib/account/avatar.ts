/**
 * Profile photos (server only). One photo per person: the personal photo (profiles.avatar_url)
 * and, for lawyers, the public photo on their profile (lawyer_profiles.photo_url) are kept the
 * same when either is changed through profilePhotoActions; when only one exists, it is used.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { currentUser } from '@/lib/auth/guards';
import { createServiceClient } from '@/lib/supabase/server';

/** The signed-in user's photo (server components), or null. */
export async function getMyAvatarUrl(): Promise<string | null> {
  try {
    const user = await currentUser();
    if (!user) return null;
    return await readAvatarUrl((await createServiceClient()) as unknown as SupabaseClient, user.id);
  } catch {
    return null;
  }
}

/** Photo URL by user id (only users that have one). The personal photo wins. */
export async function readAvatars(db: SupabaseClient, ids: string[]): Promise<Record<string, string>> {
  const unique = [...new Set(ids.filter(Boolean))].slice(0, 500);
  if (unique.length === 0) return {};
  const [profiles, lawyers] = await Promise.all([
    db.from('profiles').select('user_id, avatar_url').in('user_id', unique),
    db.from('lawyer_profiles').select('user_id, photo_url').in('user_id', unique),
  ]);
  const out: Record<string, string> = {};
  for (const r of (lawyers.data ?? []) as Array<{ user_id: string; photo_url: string | null }>) {
    if (r.photo_url) out[r.user_id] = r.photo_url;
  }
  for (const r of (profiles.data ?? []) as Array<{ user_id: string; avatar_url: string | null }>) {
    if (r.avatar_url) out[r.user_id] = r.avatar_url;
  }
  return out;
}

export async function readAvatarUrl(db: SupabaseClient, userId: string): Promise<string | null> {
  return (await readAvatars(db, [userId]))[userId] ?? null;
}

/** Everyone who shares a consultation with `userId` (the people who may see their photo in a conversation). */
export async function counterpartIds(db: SupabaseClient, userId: string): Promise<string[]> {
  const { data } = await db
    .from('consultations')
    .select('client_id, lawyer_id')
    .or(`client_id.eq.${userId},lawyer_id.eq.${userId}`);
  const ids = new Set<string>();
  for (const c of (data ?? []) as Array<{ client_id: string; lawyer_id: string }>) {
    ids.add(c.client_id === userId ? c.lawyer_id : c.client_id);
  }
  ids.delete(userId);
  return [...ids];
}
