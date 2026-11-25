/**
 * Legal documents users agree to, and the consent records kept for them
 * (public.consent_records: user_id, document_type, version, accepted_at, ip_address).
 * document_type must be one of the live check constraint's values: terms | privacy_policy |
 * ai_disclaimer.
 *
 * Bump LEGAL_VERSION whenever the text of /terms, /privacy or /ai-disclaimer changes materially;
 * users whose latest consent is older are asked to accept again in Settings.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export const LEGAL_VERSION = '2026-11-25';

export const LEGAL_DOCUMENTS = [
  { type: 'terms', title: 'Terms of Service', href: '/terms' },
  { type: 'privacy_policy', title: 'Privacy Policy', href: '/privacy' },
  { type: 'ai_disclaimer', title: 'AI Disclaimer', href: '/ai-disclaimer' },
] as const;

export type LegalDocumentType = (typeof LEGAL_DOCUMENTS)[number]['type'];

export interface ConsentStatus {
  /** When the user last accepted the current version of every document (null = not yet). */
  acceptedAt: string | null;
  version: string | null;
  current: boolean;
}

function validIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  return /^[0-9a-f:.]{3,45}$/i.test(ip) ? ip : null;
}

/** Records acceptance of every legal document at the current version. Returns false on failure. */
export async function recordConsent(db: SupabaseClient, userId: string, ip?: string | null): Promise<boolean> {
  const acceptedAt = new Date().toISOString();
  const { error } = await db.from('consent_records').insert(
    LEGAL_DOCUMENTS.map((doc) => ({
      user_id: userId,
      document_type: doc.type,
      version: LEGAL_VERSION,
      accepted_at: acceptedAt,
      ip_address: validIp(ip),
    }))
  );
  if (error) console.warn('[recordConsent]', error.message);
  return !error;
}

/** The user's consent for the current legal version. */
export async function readConsent(db: SupabaseClient, userId: string): Promise<ConsentStatus> {
  const { data } = await db
    .from('consent_records')
    .select('document_type, version, accepted_at')
    .eq('user_id', userId)
    .order('accepted_at', { ascending: false })
    .limit(30);
  const rows = (data ?? []) as Array<{ document_type: string; version: string; accepted_at: string }>;
  const latest = rows[0] ?? null;
  const current = LEGAL_DOCUMENTS.every((doc) => rows.some((r) => r.document_type === doc.type && r.version === LEGAL_VERSION));
  return { acceptedAt: latest?.accepted_at ?? null, version: latest?.version ?? null, current };
}
