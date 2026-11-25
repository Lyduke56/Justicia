/**
 * One account per email address, whatever the role (admin, lawyer, client) or status
 * (unconfirmed, active, suspended, terminated, pending deletion).
 *
 * SERVER-SIDE ONLY (uses the service-role client).
 *
 * Checked before sign-up and before any other place that sets an email. The database also
 * enforces it with unique indexes on lower(email) (supabase/manual/001_email_uniqueness.sql),
 * and Supabase Auth refuses a second auth user with the same email.
 *
 * Emails of accounts that were suspended or terminated stay blocked after the account is
 * deleted: only a SHA-256 hash is kept, in public.blocked_emails.
 */
import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

export type EmailStatus = 'available' | 'in_use' | 'blocked';

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(raw: unknown): string {
  return typeof raw === 'string' ? raw.trim().toLowerCase() : '';
}

export function isValidEmail(email: string): boolean {
  return email.length > 3 && email.length <= 254 && EMAIL_PATTERN.test(email);
}

/** Stable hash used for the blocked-email list (never store the address itself). */
export function emailHash(email: string): string {
  return createHash('sha256').update(`justicia-email:${normalizeEmail(email)}`).digest('hex');
}

/** Escapes LIKE wildcards so an address containing `_` or `%` only matches itself. */
function exactPattern(email: string): string {
  return email.replace(/[\\%_]/g, (c) => `\\${c}`);
}

function isMissingObject(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  return (
    error.code === 'PGRST202' || // function not found
    error.code === 'PGRST205' || // table not found
    error.code === '42P01' ||
    error.code === '42883' ||
    /could not find|does not exist/i.test(error.message ?? '')
  );
}

/**
 * Whether an email can be used for a new account. Uses the `email_registration_status` database
 * function when it exists (it also sees auth.users); otherwise checks user_accounts, profiles and
 * the blocked list directly. Errors are treated as "in use" so a failure never lets a duplicate
 * through.
 */
export async function emailRegistrationStatus(db: SupabaseClient, rawEmail: string): Promise<EmailStatus> {
  const email = normalizeEmail(rawEmail);
  const hash = emailHash(email);

  const rpc = await db.rpc('email_registration_status', { p_email: email, p_email_hash: hash });
  if (!rpc.error && (rpc.data === 'available' || rpc.data === 'in_use' || rpc.data === 'blocked')) {
    return rpc.data;
  }
  if (rpc.error && !isMissingObject(rpc.error)) {
    console.warn('[emailRegistrationStatus] rpc failed:', rpc.error.message);
  }

  const blocked = await db.from('blocked_emails').select('email_hash').eq('email_hash', hash).limit(1);
  if (blocked.error && !isMissingObject(blocked.error)) return 'in_use';
  if (blocked.data && blocked.data.length > 0) return 'blocked';

  for (const table of ['user_accounts', 'profiles'] as const) {
    const { data, error } = await db.from(table).select('email').ilike('email', exactPattern(email)).limit(1);
    if (error) {
      console.warn(`[emailRegistrationStatus] ${table} lookup failed:`, error.message);
      return 'in_use';
    }
    if (data && data.length > 0) return 'in_use';
  }
  return 'available';
}

export const EMAIL_IN_USE_MESSAGE = 'This email is already registered. Sign in or reset your password.';
export const EMAIL_BLOCKED_MESSAGE =
  'This email cannot be used to create a Justicia account. If you think this is a mistake, contact support.';

/**
 * Adds an email to the blocked list (accounts deleted after a suspension or termination).
 * Returns false when it could not be recorded, so callers can stop before erasing the account.
 */
export async function blockEmail(
  db: SupabaseClient,
  email: string,
  reason: string,
  accountId: string | null
): Promise<boolean> {
  const { error } = await db
    .from('blocked_emails')
    .upsert({ email_hash: emailHash(email), reason, account_id: accountId }, { onConflict: 'email_hash' });
  if (error) console.error('[blockEmail]', error.message);
  return !error;
}

/**
 * Supabase hides whether an email exists when email confirmation is on: signing up with an
 * address that already has a confirmed account returns a user object with no identities instead
 * of an error. Treat that as "already registered".
 */
export function isObfuscatedExistingUser(user: { identities?: unknown[] | null } | null | undefined): boolean {
  return !!user && Array.isArray(user.identities) && user.identities.length === 0;
}
