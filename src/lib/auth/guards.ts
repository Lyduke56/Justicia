/**
 * Central authorization checks for Server Actions and Route Handlers. SERVER-SIDE ONLY.
 *
 * The proxy and layouts only steer navigation; every action that reads or changes protected data
 * calls one of these first. Each guard re-reads the session from Supabase Auth and the role and
 * account status from the database (never from user-editable metadata), and throws a GuardError
 * with a message that is safe to show.
 *
 *   const ctx = await requireRole('admin');            // throws GuardError
 *   ...
 *   catch (err) { return { error: guardMessage(err) } }
 */
import { cache } from 'react';
import { createClient as createAuthClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { checkAccountAccess } from '@/lib/moderation/accountStatus';
import { readDatabaseRole, type AppRole } from '@/lib/auth/roles';

export class GuardError extends Error {
  constructor(
    message: string,
    readonly status: 401 | 403 | 404 | 423
  ) {
    super(message);
    this.name = 'GuardError';
  }
}

export interface GuardContext {
  user: User;
  /** Service-role client: use only after the guard has authorized the caller. */
  db: SupabaseClient;
}

export interface RoleContext extends GuardContext {
  role: AppRole;
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The signed-in user for this request (validated with Supabase Auth, cached per request). */
export const currentUser = cache(async (): Promise<User | null> => {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    return error ? null : data.user ?? null;
  } catch {
    return null;
  }
});

async function serviceDb(): Promise<SupabaseClient> {
  return (await createServiceClient()) as unknown as SupabaseClient;
}

export async function requireUser(): Promise<GuardContext> {
  const user = await currentUser();
  if (!user) throw new GuardError('Please sign in to continue.', 401);
  return { user, db: await serviceDb() };
}

/** Signed in, and the account is not suspended, terminated or scheduled for deletion. */
export async function requireActiveAccount(): Promise<GuardContext> {
  const ctx = await requireUser();
  const blocked = await checkAccountAccess(ctx.db, ctx.user.id);
  if (blocked) throw new GuardError(blocked, 423);
  return ctx;
}

export async function requireRole(...roles: AppRole[]): Promise<RoleContext> {
  const ctx = await requireActiveAccount();
  const role = await readDatabaseRole(ctx.db, ctx.user.id);
  if (!role || !roles.includes(role)) {
    throw new GuardError(
      roles.length === 1 && roles[0] === 'admin' ? 'Administrator access required.' : 'You do not have access to this action.',
      403
    );
  }
  return { ...ctx, role };
}

/** A lawyer whose credentials are approved. */
export async function requireVerifiedLawyer(): Promise<RoleContext> {
  const ctx = await requireRole('lawyer');
  const { data } = await ctx.db.from('lawyer_profiles').select('verification_status').eq('user_id', ctx.user.id).maybeSingle();
  if (data?.verification_status !== 'approved') {
    throw new GuardError('Only verified attorneys can do this.', 403);
  }
  return ctx;
}

export interface ConsultationParticipant extends GuardContext {
  consultation: { id: string; client_id: string; lawyer_id: string; status: string };
  side: 'client' | 'lawyer';
}

/** The caller is the client or the lawyer of the consultation. */
export async function requireConsultationParticipant(consultationId: string): Promise<ConsultationParticipant> {
  if (!UUID_RE.test(consultationId ?? '')) throw new GuardError('Consultation not found.', 404);
  const ctx = await requireActiveAccount();
  const { data } = await ctx.db
    .from('consultations')
    .select('id, client_id, lawyer_id, status')
    .eq('id', consultationId)
    .maybeSingle();
  if (!data || (data.client_id !== ctx.user.id && data.lawyer_id !== ctx.user.id)) {
    throw new GuardError('Consultation not found.', 404);
  }
  return { ...ctx, consultation: data, side: data.client_id === ctx.user.id ? 'client' : 'lawyer' };
}

/** The caller owns the document or holds an access grant that has not been revoked. */
export async function requireDocumentAccess(documentId: string): Promise<GuardContext & { owner: boolean }> {
  if (!UUID_RE.test(documentId ?? '')) throw new GuardError('Document not found.', 404);
  const ctx = await requireActiveAccount();
  const { data: doc } = await ctx.db
    .from('documents')
    .select('id, owner_id, deleted_at')
    .eq('id', documentId)
    .maybeSingle();
  if (!doc || doc.deleted_at) throw new GuardError('Document not found.', 404);
  if (doc.owner_id === ctx.user.id) return { ...ctx, owner: true };
  const { data: grant } = await ctx.db
    .from('document_access_grants')
    .select('id')
    .eq('document_id', documentId)
    .eq('grantee_id', ctx.user.id)
    .is('revoked_at', null)
    .limit(1);
  if (!grant || grant.length === 0) throw new GuardError('Document not found.', 404);
  return { ...ctx, owner: false };
}

/**
 * Re-checks the caller's password (for irreversible actions such as terminating an account or
 * deleting one's own). Uses a separate client so a failed check never touches the session cookies.
 */
export async function verifyPassword(user: User, password: unknown): Promise<boolean> {
  if (typeof password !== 'string' || !password || password.length > 256 || !user.email) return false;
  const verifier = createAuthClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  try {
    const { data, error } = await verifier.auth.signInWithPassword({ email: user.email, password });
    return !error && data.user?.id === user.id;
  } catch {
    return false;
  } finally {
    // Only ends the throwaway session created by this check.
    await verifier.auth.signOut({ scope: 'local' }).catch(() => undefined);
  }
}

export async function requireAdminReauthentication(password: unknown): Promise<RoleContext> {
  const ctx = await requireRole('admin');
  if (!(await verifyPassword(ctx.user, password))) {
    throw new GuardError('Your password is incorrect. Please re-enter it to confirm this action.', 403);
  }
  return ctx;
}

/** A message that is safe to show for any error thrown inside a guarded action. */
export function guardMessage(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (err instanceof GuardError) return err.message;
  return fallback;
}

export function guardStatus(err: unknown): number {
  return err instanceof GuardError ? err.status : 500;
}
