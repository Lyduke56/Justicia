'use server';

/**
 * Profile extras for the signed-in user (#10 photo, #11 city/province, #12 consultation language,
 * #13 contact method and time, #14 member since + summary). Lawyers read a client's preferences
 * only through their consultations (see getLawyerConsultationsAction).
 */
import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import type { SupabaseClient } from '@supabase/supabase-js';
import { guardMessage, requireActiveAccount, requireUser } from '@/lib/auth/guards';
import { checkRateLimit } from '@/lib/security/rateLimit';
import { FILE_CONTENT_MISMATCH, contentMatchesExtension, extensionOf, mimeForExtension } from '@/lib/security/fileType';
import { ensureProfileRow } from '@/lib/moderation/accountStatus';
import {
  CONSULTATION_LANGUAGES,
  CONTACT_METHODS,
  CONTACT_TIMES,
  type ContactMethod,
  type ContactTime,
  type ProfileExtras,
} from '@/lib/account/profileExtras';

const AVATAR_BUCKET = 'avatars';
const AVATAR_MAX_BYTES = 4 * 1024 * 1024;
const AVATAR_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp'];

type Result<T = object> = ({ success: true } & T) | { success: false; error: string };

export interface ProfileSummary {
  memberSince: string;
  consultationsCompleted: number;
  lawyersConsulted: number;
  upcomingConsultations: number;
  lastSignInAt: string | null;
}

function missingColumn(error: { message?: string; code?: string } | null): boolean {
  return !!error && (error.code === '42703' || error.code === 'PGRST204' || /column .* does not exist|could not find the .* column/i.test(error.message ?? ''));
}

async function readExtras(db: SupabaseClient, userId: string): Promise<{ extras: ProfileExtras; fieldsReady: boolean }> {
  const full = await db
    .from('profiles')
    .select('avatar_url, consultation_language, city_province, contact_method, contact_time')
    .eq('user_id', userId)
    .maybeSingle();
  if (!full.error) {
    const row = (full.data ?? {}) as Record<string, string | null>;
    return {
      fieldsReady: true,
      extras: {
        avatarUrl: row.avatar_url ?? null,
        preferredLanguage: row.consultation_language ?? null,
        cityProvince: row.city_province ?? null,
        contactMethod: (row.contact_method as ContactMethod | null) ?? null,
        contactTime: (row.contact_time as ContactTime | null) ?? null,
      },
    };
  }
  // Before supabase/manual/007_profile_fields.sql: only the existing columns.
  const basic = await db.from('profiles').select('avatar_url').eq('user_id', userId).maybeSingle();
  const row = (basic.data ?? {}) as Record<string, string | null>;
  return {
    fieldsReady: false,
    extras: { avatarUrl: row.avatar_url ?? null, preferredLanguage: null, cityProvince: null, contactMethod: null, contactTime: null },
  };
}

export async function getProfileExtrasAction(): Promise<Result<{ extras: ProfileExtras; fieldsReady: boolean; summary: ProfileSummary }>> {
  try {
    const { user, db } = await requireUser();
    const [{ extras, fieldsReady }, { data: consultations }] = await Promise.all([
      readExtras(db, user.id),
      db.from('consultations').select('lawyer_id, status, scheduled_end').eq('client_id', user.id),
    ]);
    const nowIso = new Date().toISOString();
    const rows = (consultations ?? []) as Array<{ lawyer_id: string; status: string; scheduled_end: string | null }>;
    // A confirmed consultation whose time has passed counts as done (same rule as reviews).
    const done = rows.filter((c) => c.status === 'completed' || (c.status === 'confirmed' && !!c.scheduled_end && c.scheduled_end < nowIso));
    const upcoming = rows.filter((c) => ['pending', 'awaiting_client_confirmation', 'confirmed'].includes(c.status) && (!c.scheduled_end || c.scheduled_end >= nowIso));
    return {
      success: true,
      extras,
      fieldsReady,
      summary: {
        memberSince: user.created_at,
        consultationsCompleted: done.length,
        lawyersConsulted: new Set(done.map((c) => c.lawyer_id)).size,
        upcomingConsultations: upcoming.length,
        lastSignInAt: user.last_sign_in_at ?? null,
      },
    };
  } catch (err) {
    return { success: false, error: guardMessage(err, 'Your profile details could not be loaded.') };
  }
}

export async function updateProfileExtrasAction(input: {
  cityProvince?: string;
  preferredLanguage?: string;
  contactMethod?: string;
  contactTime?: string;
}): Promise<Result<{ extras: ProfileExtras }>> {
  try {
    const { user, db } = await requireActiveAccount();
    const city = typeof input?.cityProvince === 'string' ? input.cityProvince.trim().replace(/\s+/g, ' ') : '';
    if (city.length > 120 || /[\u0000-\u001f<>]/.test(city)) return { success: false, error: 'Enter a city or province (up to 120 characters).' };
    const language = typeof input?.preferredLanguage === 'string' ? input.preferredLanguage : '';
    if (language && !(CONSULTATION_LANGUAGES as readonly string[]).includes(language)) return { success: false, error: 'Choose a language from the list.' };
    const method = typeof input?.contactMethod === 'string' ? input.contactMethod : '';
    if (method && !CONTACT_METHODS.some((m) => m.value === method)) return { success: false, error: 'Choose a contact method from the list.' };
    const time = typeof input?.contactTime === 'string' ? input.contactTime : '';
    if (time && !CONTACT_TIMES.some((t) => t.value === time)) return { success: false, error: 'Choose a contact time from the list.' };

    if (!(await ensureProfileRow(db, user.id))) return { success: false, error: 'Your profile could not be found.' };
    const { error } = await db
      .from('profiles')
      .update({
        city_province: city || null,
        consultation_language: language || null,
        contact_method: method || null,
        contact_time: time || null,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id);
    if (missingColumn(error)) {
      return { success: false, error: 'Saving these details needs a database update (supabase/manual/007_profile_fields.sql).' };
    }
    if (error) return { success: false, error: 'Your details could not be saved. Please try again.' };
    revalidatePath('/client/profile');
    return { success: true, extras: (await readExtras(db, user.id)).extras };
  } catch (err) {
    return { success: false, error: guardMessage(err, 'Your details could not be saved.') };
  }
}

async function removeOldAvatars(db: SupabaseClient, userId: string, keep?: string) {
  const { data } = await db.storage.from(AVATAR_BUCKET).list(userId, { limit: 100 });
  const old = ((data ?? []) as Array<{ name: string }>).map((f) => `${userId}/${f.name}`).filter((p) => p !== keep);
  if (old.length) await db.storage.from(AVATAR_BUCKET).remove(old);
}

/** Uploads a profile photo (PNG, JPG or WebP up to 4 MB). FormData: file. */
export async function uploadProfilePhotoAction(formData: FormData): Promise<Result<{ avatarUrl: string }>> {
  try {
    const file = formData.get('file');
    if (!(file instanceof File) || file.size === 0) return { success: false, error: 'Choose a photo to upload.' };
    if (file.size > AVATAR_MAX_BYTES) return { success: false, error: 'Your photo must be 4 MB or smaller.' };
    const ext = extensionOf(file.name);
    if (!AVATAR_EXTENSIONS.includes(ext)) return { success: false, error: 'Upload a PNG, JPG or WebP image.' };

    const { user, db } = await requireActiveAccount();
    const limited = await checkRateLimit('upload', user.id);
    if (limited) return { success: false, error: limited };
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!contentMatchesExtension(bytes.subarray(0, 512), ext)) return { success: false, error: FILE_CONTENT_MISMATCH };

    // The path is chosen here, never by the uploader.
    const path = `${user.id}/avatar-${randomUUID()}.${ext === 'jpeg' ? 'jpg' : ext}`;
    const { error: uploadError } = await db.storage.from(AVATAR_BUCKET).upload(path, bytes, { contentType: mimeForExtension(ext), upsert: false });
    if (uploadError) return { success: false, error: 'Your photo could not be uploaded. Please try again.' };
    const avatarUrl = db.storage.from(AVATAR_BUCKET).getPublicUrl(path).data.publicUrl;

    if (!(await ensureProfileRow(db, user.id))) return { success: false, error: 'Your profile could not be found.' };
    const { error } = await db.from('profiles').update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() }).eq('user_id', user.id);
    if (error) {
      await db.storage.from(AVATAR_BUCKET).remove([path]);
      return { success: false, error: 'Your photo could not be saved. Please try again.' };
    }
    await removeOldAvatars(db, user.id, path);
    revalidatePath('/client/profile');
    revalidatePath('/client/settings');
    return { success: true, avatarUrl };
  } catch (err) {
    return { success: false, error: guardMessage(err, 'Your photo could not be uploaded.') };
  }
}

export async function removeProfilePhotoAction(): Promise<Result> {
  try {
    const { user, db } = await requireActiveAccount();
    const { error } = await db.from('profiles').update({ avatar_url: null, updated_at: new Date().toISOString() }).eq('user_id', user.id);
    if (error) return { success: false, error: 'Your photo could not be removed. Please try again.' };
    await removeOldAvatars(db, user.id);
    revalidatePath('/client/profile');
    return { success: true };
  } catch (err) {
    return { success: false, error: guardMessage(err, 'Your photo could not be removed.') };
  }
}
