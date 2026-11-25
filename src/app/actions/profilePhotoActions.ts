'use server';

/**
 * Change or remove your profile photo (client, lawyer and admin). Uploads and checks go through
 * the existing uploadProfilePhotoAction / removeProfilePhotoAction; this adds what makes the photo
 * show everywhere:
 *  - a lawyer's public profile photo (Find a Lawyer, their profile page) becomes the same photo;
 *  - the open tabs of the person and of everyone they have a consultation with refresh it
 *    (Supabase Realtime "profile" signal), so top bars, Messages and consultation cards update.
 */
import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import { removeProfilePhotoAction, uploadProfilePhotoAction } from '@/app/actions/profileExtrasActions';
import { guardMessage, requireActiveAccount } from '@/lib/auth/guards';
import { counterpartIds } from '@/lib/account/avatar';
import { emitLive } from '@/lib/realtime/live';
import type { SupabaseClient } from '@supabase/supabase-js';

type Result<T = object> = ({ success: true } & T) | { success: false; error: string };

async function syncEverywhere(db: SupabaseClient, userId: string, avatarUrl: string | null) {
  // Lawyers: the public profile photo follows the personal photo.
  const { data: lawyer } = await db.from('lawyer_profiles').select('user_id').eq('user_id', userId).maybeSingle();
  if (lawyer) {
    const { error } = await db.from('lawyer_profiles').update({ photo_url: avatarUrl }).eq('user_id', userId);
    if (error) console.warn('[profilePhoto] lawyer photo sync', error.message);
    revalidatePath('/lawyer/profile');
    revalidatePath(`/lawyers/${userId}`);
  }
  const people = [userId, ...(await counterpartIds(db, userId))];
  try {
    after(() => emitLive(people, ['profile']));
  } catch {
    void emitLive(people, ['profile']);
  }
}

export async function changeProfilePhotoAction(formData: FormData): Promise<Result<{ avatarUrl: string }>> {
  const res = await uploadProfilePhotoAction(formData);
  if (!res.success) return res;
  try {
    const { user, db } = await requireActiveAccount();
    await syncEverywhere(db, user.id, res.avatarUrl);
  } catch (err) {
    console.warn('[changeProfilePhotoAction] sync', guardMessage(err));
  }
  return res;
}

export async function removeMyProfilePhotoAction(): Promise<Result> {
  const res = await removeProfilePhotoAction();
  if (!res.success) return res;
  try {
    const { user, db } = await requireActiveAccount();
    await syncEverywhere(db, user.id, null);
  } catch (err) {
    console.warn('[removeMyProfilePhotoAction] sync', guardMessage(err));
  }
  return res;
}
