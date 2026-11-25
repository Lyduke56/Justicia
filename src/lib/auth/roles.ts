/**
 * Where a user's role comes from.
 *
 * `user_metadata` can be changed by the user from the browser (supabase.auth.updateUser), so it
 * is never used for authorization. The authoritative role is `public.user_accounts.role`; a copy
 * is kept in Auth `app_metadata`, which only the service-role key can write, so the proxy can
 * route without a database round trip.
 */
import type { SupabaseClient, User } from '@supabase/supabase-js';

export type AppRole = 'client' | 'lawyer' | 'admin';
export type ClaimStatus = 'active' | 'pending_deletion';

const ROLES: readonly AppRole[] = ['client', 'lawyer', 'admin'];

export function isAppRole(value: unknown): value is AppRole {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}

/** Role from the server-written app_metadata, or null when it has not been set yet. */
export function roleFromAppMetadata(user: Pick<User, 'app_metadata'> | null | undefined): AppRole | null {
  const role = user?.app_metadata?.role;
  return isAppRole(role) ? role : null;
}

/** Account status mirrored into app_metadata (only `pending_deletion` matters for routing). */
export function statusFromAppMetadata(user: Pick<User, 'app_metadata'> | null | undefined): ClaimStatus {
  return user?.app_metadata?.account_status === 'pending_deletion' ? 'pending_deletion' : 'active';
}

/**
 * Writes the role (and optionally the account status) into Auth app_metadata. Needs the
 * service-role client. Never throws; returns false when the write failed.
 */
export async function syncAuthClaims(
  db: SupabaseClient,
  userId: string,
  claims: { role?: AppRole; account_status?: ClaimStatus }
): Promise<boolean> {
  try {
    const { data, error: readError } = await db.auth.admin.getUserById(userId);
    if (readError || !data?.user) return false;
    const next = { ...(data.user.app_metadata ?? {}) } as Record<string, unknown>;
    if (claims.role) next.role = claims.role;
    if (claims.account_status) next.account_status = claims.account_status;
    const { error } = await db.auth.admin.updateUserById(userId, { app_metadata: next });
    if (error) console.warn('[syncAuthClaims]', userId, error.message);
    return !error;
  } catch (err) {
    console.warn('[syncAuthClaims]', userId, err instanceof Error ? err.message : err);
    return false;
  }
}

/** The database role for a user (user_accounts first, then profiles), or null. */
export async function readDatabaseRole(db: SupabaseClient, userId: string): Promise<AppRole | null> {
  const { data: account } = await db.from('user_accounts').select('role').eq('id', userId).maybeSingle();
  if (isAppRole(account?.role)) return account.role;
  const { data: profile } = await db.from('profiles').select('role').eq('user_id', userId).maybeSingle();
  return isAppRole(profile?.role) ? profile.role : null;
}
