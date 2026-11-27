'use server';

/**
 * A lawyer's own payment QR (GCash, Maya, bank…): clients pay with it when they settle an
 * approved consultation. New code only, no schema change:
 *  - the image is stored privately in the `lawyer-credentials` bucket
 *    (`<lawyerId>/payment-qr/qr-<uuid>.<ext>`) and shown through short-lived signed links;
 *  - its details live in platform_settings under `payment_qr:lawyer:<lawyerId>`
 *    (that table is not readable by browsers).
 * When a lawyer has not set one up, the platform-wide QR (platform_settings.payment_qr) is used,
 * as before.
 */
import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getPaymentChannelAction, type PaymentChannel } from '@/app/actions/consultationActions';
import { guardMessage, requireConsultationParticipant, requireRole } from '@/lib/auth/guards';
import { checkRateLimit } from '@/lib/security/rateLimit';
import { FILE_CONTENT_MISMATCH, contentMatchesExtension, extensionOf, mimeForExtension } from '@/lib/security/fileType';
import { hasOwnPaymentQr, paymentQrKeyFor } from '@/lib/lawyer/paymentQr';

const BUCKET = 'lawyer-credentials';
const MAX_BYTES = 5 * 1024 * 1024;
const EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp'];
const SIGNED_SECONDS = 60 * 60;
const keyFor = paymentQrKeyFor;

interface StoredQr {
  storagePath: string;
  channel: string;
  accountName: string;
  accountNumber: string;
  updatedAt: string;
}

export interface LawyerPaymentQr {
  imageUrl: string | null;
  channel: string;
  accountName: string;
  accountNumber: string;
  updatedAt: string;
}

type Result<T = object> = ({ success: true } & T) | { success: false; error: string };

async function readStored(db: SupabaseClient, lawyerId: string): Promise<StoredQr | null> {
  const { data } = await db.from('platform_settings').select('value').eq('key', keyFor(lawyerId)).maybeSingle();
  const value = data?.value as Partial<StoredQr> | null | undefined;
  return value && typeof value.storagePath === 'string' && value.storagePath
    ? {
        storagePath: value.storagePath,
        channel: String(value.channel ?? ''),
        accountName: String(value.accountName ?? ''),
        accountNumber: String(value.accountNumber ?? ''),
        updatedAt: String(value.updatedAt ?? ''),
      }
    : null;
}

async function signedUrl(db: SupabaseClient, path: string): Promise<string | null> {
  const { data } = await db.storage.from(BUCKET).createSignedUrl(path, SIGNED_SECONDS);
  return data?.signedUrl ?? null;
}

async function toView(db: SupabaseClient, stored: StoredQr): Promise<LawyerPaymentQr> {
  return {
    imageUrl: await signedUrl(db, stored.storagePath),
    channel: stored.channel,
    accountName: stored.accountName,
    accountNumber: stored.accountNumber,
    updatedAt: stored.updatedAt,
  };
}

const captionOf = (q: Pick<StoredQr, 'channel' | 'accountName' | 'accountNumber'>) =>
  [q.channel, q.accountName, q.accountNumber].map((s) => s.trim()).filter(Boolean).join(' • ') || null;

const clean = (value: FormDataEntryValue | null, max: number) =>
  String(value ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().replace(/\s+/g, ' ').slice(0, max);

// ─── Lawyer: manage their QR (Settings) ──────────────────────────────────────

export async function getMyPaymentQrAction(): Promise<Result<{ qr: LawyerPaymentQr | null }>> {
  try {
    const { user, db } = await requireRole('lawyer');
    const stored = await readStored(db, user.id);
    return { success: true, qr: stored ? await toView(db, stored) : null };
  } catch (err) {
    return { success: false, error: guardMessage(err, 'Your payment QR could not be loaded.') };
  }
}

/**
 * Saves the payment QR. FormData: `file` (PNG, JPG or WebP up to 5 MB; required the first time,
 * optional when only the details change), `channel`, `accountName`, `accountNumber`.
 */
export async function saveMyPaymentQrAction(formData: FormData): Promise<Result<{ qr: LawyerPaymentQr }>> {
  try {
    const channel = clean(formData.get('channel'), 40);
    const accountName = clean(formData.get('accountName'), 80);
    const accountNumber = clean(formData.get('accountNumber'), 40);
    const file = formData.get('file');
    const hasFile = file instanceof File && file.size > 0;

    const { user, db } = await requireRole('lawyer');
    const previous = await readStored(db, user.id);
    if (!hasFile && !previous) return { success: false, error: 'Choose the QR code image clients will scan.' };
    if (!channel) return { success: false, error: 'Enter the payment channel (for example GCash or Maya).' };

    let storagePath = previous?.storagePath ?? '';
    if (hasFile) {
      if (file.size > MAX_BYTES) return { success: false, error: 'The QR image must be 5 MB or smaller.' };
      const ext = extensionOf(file.name);
      if (!EXTENSIONS.includes(ext)) return { success: false, error: 'Upload the QR code as a PNG, JPG or WebP image.' };
      const limited = await checkRateLimit('upload', user.id);
      if (limited) return { success: false, error: limited };
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (!contentMatchesExtension(bytes.subarray(0, 512), ext)) return { success: false, error: FILE_CONTENT_MISMATCH };
      // The path is chosen here, never by the uploader.
      storagePath = `${user.id}/payment-qr/qr-${randomUUID()}.${ext === 'jpeg' ? 'jpg' : ext}`;
      const { error } = await db.storage.from(BUCKET).upload(storagePath, bytes, { contentType: mimeForExtension(ext), upsert: false });
      if (error) return { success: false, error: 'The QR image could not be uploaded. Please try again.' };
    }

    const stored: StoredQr = { storagePath, channel, accountName, accountNumber, updatedAt: new Date().toISOString() };
    const { error } = await db.from('platform_settings').upsert(
      { key: keyFor(user.id), value: stored, description: 'Payment QR of a lawyer (shown to their clients when paying)', updated_by: user.id, updated_at: stored.updatedAt },
      { onConflict: 'key' }
    );
    if (error) {
      if (hasFile) await db.storage.from(BUCKET).remove([storagePath]);
      console.error('[saveMyPaymentQrAction]', error.message);
      return { success: false, error: 'Your payment QR could not be saved. Please try again.' };
    }
    if (hasFile && previous?.storagePath && previous.storagePath !== storagePath) {
      await db.storage.from(BUCKET).remove([previous.storagePath]);
    }
    // Shown to admins as "Lawyer profile updated" (best effort).
    await db.from('audit_log').insert({
      actor_id: user.id,
      action: 'lawyer.payment_qr.updated',
      target_type: 'lawyer_profile',
      target_id: user.id,
      details: { channel, newImage: hasFile },
    });
    return { success: true, qr: await toView(db, stored) };
  } catch (err) {
    return { success: false, error: guardMessage(err, 'Your payment QR could not be saved.') };
  }
}

/** Whether the signed-in lawyer has uploaded a payment QR (required before approving requests). */
export async function hasMyPaymentQrAction(): Promise<Result<{ hasQr: boolean }>> {
  try {
    const { user, db } = await requireRole('lawyer');
    return { success: true, hasQr: await hasOwnPaymentQr(db, user.id) };
  } catch (err) {
    return { success: false, error: guardMessage(err, 'Your payment QR could not be checked.') };
  }
}

export async function removeMyPaymentQrAction(): Promise<Result> {
  try {
    const { user, db } = await requireRole('lawyer');
    const previous = await readStored(db, user.id);
    const { error } = await db.from('platform_settings').delete().eq('key', keyFor(user.id));
    if (error) return { success: false, error: 'Your payment QR could not be removed. Please try again.' };
    if (previous?.storagePath) await db.storage.from(BUCKET).remove([previous.storagePath]);
    return { success: true };
  } catch (err) {
    return { success: false, error: guardMessage(err, 'Your payment QR could not be removed.') };
  }
}

// ─── Client: the QR to pay a consultation with ───────────────────────────────

/**
 * The QR the client pays this consultation with: the attorney's own QR when they set one up,
 * otherwise the platform QR. Only the consultation's client (or lawyer) can read it.
 */
export async function getConsultationPaymentChannelAction(
  consultationId: string
): Promise<PaymentChannel & { source: 'lawyer' | 'platform' }> {
  try {
    const { db, consultation } = await requireConsultationParticipant(consultationId);
    const stored = await readStored(db, consultation.lawyer_id);
    if (stored) {
      const url = await signedUrl(db, stored.storagePath);
      if (url) return { qrImageUrl: url, caption: captionOf(stored), source: 'lawyer' };
    }
  } catch (err) {
    console.warn('[getConsultationPaymentChannelAction]', guardMessage(err));
  }
  return { ...(await getPaymentChannelAction()), source: 'platform' };
}
