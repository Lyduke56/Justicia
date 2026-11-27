import { NextResponse, type NextRequest } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getDashboardForRole } from '@/lib/utils/rbac';
import { readDatabaseRole, roleFromAppMetadata, syncAuthClaims } from '@/lib/auth/roles';
import { readVerifyToken } from '@/lib/auth/verifyToken';

/**
 * The link in the sign-up verification email (lib/auth/verificationEmail.ts). Confirms the
 * account's email and signs the person in, like Supabase's own confirmation link did through
 * /auth/callback. A link works once: after the email is confirmed it only says so.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const notice = (status: 'expired' | 'invalid' | 'verified') =>
    NextResponse.redirect(`${origin}/verify-email?link=${status}`);

  const token = readVerifyToken(searchParams.get('token'));
  if (!token.ok) return notice(token.reason);
  const { userId, email } = token.payload;

  const db = (await createServiceClient()) as unknown as SupabaseClient;
  const { data: found, error: lookupError } = await db.auth.admin.getUserById(userId);
  const account = found?.user;
  // Deleted account, or the address changed since the link was sent.
  if (lookupError || !account || account.email?.toLowerCase() !== email) return notice('invalid');
  if (account.email_confirmed_at) return notice('verified');

  const { error: confirmError } = await db.auth.admin.updateUserById(userId, { email_confirm: true });
  if (confirmError) {
    console.warn('[auth/verify] confirm failed:', confirmError.message);
    return notice('invalid');
  }

  // Sign in with a one-time link generated on the server (nothing is emailed). The account is
  // confirmed by now, so this keeps the password (on an unconfirmed account it would clear it).
  const supabase = await createClient();
  const { data: link } = await db.auth.admin.generateLink({ type: 'magiclink', email });
  const tokenHash = link?.properties?.hashed_token;
  const { error: sessionError } = tokenHash
    ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'magiclink' })
    : { error: new Error('no link') };
  // Verified, but no session (e.g. a suspended account): they can still sign in by hand.
  if (sessionError) return notice('verified');

  let role = roleFromAppMetadata(account);
  if (!role) {
    role = (await readDatabaseRole(db, userId)) ?? 'client';
    await syncAuthClaims(db, userId, { role });
  }
  return NextResponse.redirect(`${origin}${getDashboardForRole(role)}`);
}
