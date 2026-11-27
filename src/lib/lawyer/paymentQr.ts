/**
 * A lawyer's own payment QR (see lawyerPaymentQrActions.ts): where it is stored, and the rule
 * that a lawyer must upload one before approving a consultation request (clients pay with it
 * right after the approval). Browser + server safe (types only).
 */
import type { SupabaseClient } from '@supabase/supabase-js';

/** platform_settings key of a lawyer's payment QR details. */
export const paymentQrKeyFor = (lawyerId: string) => `payment_qr:lawyer:${lawyerId}`;

/** Where the lawyer uploads it (Lawyer portal → My Profile → Payment QR). */
export const PAYMENT_QR_SETUP_HREF = '/lawyer/account';

export const PAYMENT_QR_REQUIRED_MESSAGE =
  'Upload your payment QR first. Clients pay with it right after you approve a request. Add it in My Profile → Payment QR.';

/** True when the lawyer has uploaded their own payment QR. */
export async function hasOwnPaymentQr(db: SupabaseClient, lawyerId: string): Promise<boolean> {
  const { data, error } = await db.from('platform_settings').select('value').eq('key', paymentQrKeyFor(lawyerId)).maybeSingle();
  if (error) console.warn('[paymentQr] read', error.message);
  const value = data?.value as { storagePath?: unknown } | null | undefined;
  return !!value && typeof value.storagePath === 'string' && value.storagePath.length > 0;
}
