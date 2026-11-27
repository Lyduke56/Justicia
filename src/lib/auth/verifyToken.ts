/**
 * Signed email-verification tokens for the sign-up link (SERVER-SIDE ONLY).
 *
 * Supabase's "Confirm email" setting is off, so the app sends its own verification email through
 * Gmail SMTP instead of Supabase's rate-limited mailer. The link carries a token that says which
 * account and address it is for and when it expires, signed with an HMAC so it cannot be forged
 * or edited. Nothing is stored: the account's own `email_confirmed_at` is what makes a used link
 * stop working (see /auth/verify).
 *
 * Key: EMAIL_VERIFY_SECRET when set, otherwise derived from SUPABASE_SERVICE_ROLE_KEY (which never
 * leaves the server). Changing either one invalidates links that were already sent.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

/** How long a verification link works. */
export const VERIFY_LINK_TTL_MS = 24 * 60 * 60 * 1000;

export interface VerifyTokenPayload {
  /** Auth user id. */
  userId: string;
  /** The address the link was sent to (lower-case). */
  email: string;
  /** Expiry, ms since epoch. */
  expiresAt: number;
}

function signingKey(): Buffer {
  const secret = process.env.EMAIL_VERIFY_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error('EMAIL_VERIFY_SECRET or SUPABASE_SERVICE_ROLE_KEY must be set');
  // A key just for this purpose, so the raw secret is never used to sign anything directly.
  return createHmac('sha256', secret).update('justicia-email-verify-v1').digest();
}

function sign(body: string): string {
  return createHmac('sha256', signingKey()).update(body).digest('base64url');
}

export function createVerifyToken(userId: string, email: string, now: number = Date.now()): string {
  const body = Buffer.from(
    JSON.stringify({ u: userId, e: email.trim().toLowerCase(), x: now + VERIFY_LINK_TTL_MS })
  ).toString('base64url');
  return `${body}.${sign(body)}`;
}

export type VerifyTokenResult =
  | { ok: true; payload: VerifyTokenPayload }
  | { ok: false; reason: 'invalid' | 'expired' };

export function readVerifyToken(token: string | null | undefined, now: number = Date.now()): VerifyTokenResult {
  if (!token || token.length > 2048) return { ok: false, reason: 'invalid' };
  const [body, signature, extra] = token.split('.');
  if (!body || !signature || extra !== undefined) return { ok: false, reason: 'invalid' };

  const expected = Buffer.from(sign(body));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return { ok: false, reason: 'invalid' };

  let data: { u?: unknown; e?: unknown; x?: unknown };
  try {
    data = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    return { ok: false, reason: 'invalid' };
  }
  if (typeof data.u !== 'string' || typeof data.e !== 'string' || typeof data.x !== 'number') {
    return { ok: false, reason: 'invalid' };
  }
  if (now > data.x) return { ok: false, reason: 'expired' };
  return { ok: true, payload: { userId: data.u, email: data.e, expiresAt: data.x } };
}
