'use server';

import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createClient as createAuthClient, type SupabaseClient } from '@supabase/supabase-js';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { accountBlockedMessage, checkAccountAccess, ensureProfileRow, getAccountStanding } from '@/lib/moderation/accountStatus';
import { getDashboardForRole, type UserRole } from '@/lib/utils/rbac';
import {
  EMAIL_BLOCKED_MESSAGE,
  EMAIL_IN_USE_MESSAGE,
  emailRegistrationStatus,
  isObfuscatedExistingUser,
  isValidEmail,
  normalizeEmail,
} from '@/lib/auth/email';
import { readDatabaseRole, roleFromAppMetadata, syncAuthClaims } from '@/lib/auth/roles';
import { checkRateLimit, clientIp } from '@/lib/security/rateLimit';
import { recordConsent } from '@/lib/legal';
import { DEMO_COOKIE } from '@/lib/auth/demo';
import { DELETION_GRACE_DAYS } from '@/lib/support';
import { resendSignupVerificationEmail, sendSignupVerificationEmail } from '@/lib/auth/verificationEmail';

// ─── Types ────────────────────────────────────────────────────────────────────

export type AuthState = {
  error?: string;
  success?: string;
  field?: string; // which field triggered the error
  /** Set when sign-in failed because the email is not confirmed yet: the address to resend to. */
  resendEmail?: string;
} | null;

/** Short-lived cookie that lets /verify-email resend the link without asking for the address. */
const PENDING_EMAIL_COOKIE = 'justicia_pending_email';

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? 'https://justicia-chi.vercel.app';
}

async function serviceDb(): Promise<SupabaseClient> {
  return (await createServiceClient()) as unknown as SupabaseClient;
}

// ─── Sign Up ──────────────────────────────────────────────────────────────────

export async function signUpAction(
  _prevState: AuthState,
  formData: FormData
): Promise<AuthState> {
  const fullName = (formData.get('full_name') as string)?.trim();
  const email = normalizeEmail(formData.get('email'));
  const password = formData.get('password') as string;
  const role = (formData.get('role') as string) ?? 'client';

  // Basic validation
  if (!fullName || fullName.length < 2) {
    return { error: 'Full name must be at least 2 characters.', field: 'full_name' };
  }
  if (fullName.length > 120 || /[\u0000-\u001f]/.test(fullName)) {
    return { error: 'Enter your full name (up to 120 characters).', field: 'full_name' };
  }
  if (!email || !isValidEmail(email)) {
    return { error: 'Please enter a valid email address.', field: 'email' };
  }
  if (!password || password.length < 8) {
    return { error: 'Password must be at least 8 characters.', field: 'password' };
  }
  if (password.length > 256) {
    return { error: 'Password must be 256 characters or fewer.', field: 'password' };
  }
  if (!['client', 'lawyer'].includes(role)) {
    return { error: 'Invalid role selected.', field: 'role' };
  }
  if (formData.get('accept_terms') !== 'yes') {
    return { error: 'Please agree to the Terms of Service, Privacy Policy and AI Disclaimer to create an account.' };
  }

  const limited = await checkRateLimit('sign_up', email);
  if (limited) return { error: limited };

  // One account per email, whatever its role or status (also blocks emails of accounts that were
  // suspended or terminated and then deleted).
  const db = await serviceDb();
  const status = await emailRegistrationStatus(db, email);
  if (status === 'blocked') return { error: EMAIL_BLOCKED_MESSAGE, field: 'email' };
  if (status === 'in_use') return { error: EMAIL_IN_USE_MESSAGE, field: 'email' };

  // Created unconfirmed through the admin API: Supabase's "Confirm email" is off (its mailer is
  // rate limited), so a public signUp would sign the person straight in. An unconfirmed account
  // cannot sign in ("Email not confirmed") until the link in our own email confirms it.
  const { data: signUpData, error } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: false,
    user_metadata: {
      full_name: fullName,
      role,
    },
  });

  if (error) {
    if (
      error.message.toLowerCase().includes('already registered') ||
      error.code === 'user_already_exists' ||
      error.code === 'email_exists'
    ) {
      return { error: EMAIL_IN_USE_MESSAGE, field: 'email' };
    }
    if (error.status === 429) {
      return { error: 'Too many sign-up attempts. Please wait a few minutes and try again.' };
    }
    return { error: error.message };
  }

  if (!signUpData?.user || isObfuscatedExistingUser(signUpData.user)) {
    return { error: EMAIL_IN_USE_MESSAGE, field: 'email' };
  }

  const userId = signUpData.user.id;
  // The auth trigger creates user_accounts; this only fills it in if the trigger has not.
  await db.from('user_accounts').upsert(
    {
      id: userId,
      email,
      full_name: fullName,
      role: role as 'client' | 'lawyer',
      verification_status: 'pending',
      mfa_enabled: false,
    },
    { onConflict: 'id', ignoreDuplicates: true }
  );
  // Server-written role claim used by the proxy (users cannot edit app_metadata).
  await syncAuthClaims(db, userId, { role: role as 'client' | 'lawyer' });
  // Consent to the Terms, Privacy Policy and AI disclaimer shown on the sign-up form.
  if (await ensureProfileRow(db, userId)) await recordConsent(db, userId, await clientIp());

  // If it fails, /verify-email offers "send a new link".
  await sendSignupVerificationEmail(userId, email);

  const cookieStore = await cookies();
  cookieStore.set(PENDING_EMAIL_COOKIE, email, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24,
  });

  redirect('/verify-email');
}

// ─── Resend verification email ───────────────────────────────────────────────

/**
 * Sends a new confirmation link. Uses the signed-in user's own address when they are signed in
 * but unconfirmed, otherwise the given address (or the one remembered after sign-up). The answer
 * is the same whether or not the address has an account, so it cannot be used to probe emails.
 */
export async function resendVerificationEmailAction(input?: { email?: string }): Promise<
  { success: true; message: string } | { success: false; error: string }
> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.email_confirmed_at) {
      return { success: false, error: 'Your email address is already verified.' };
    }
    const cookieStore = await cookies();
    const email = normalizeEmail(user?.email ?? input?.email ?? cookieStore.get(PENDING_EMAIL_COOKIE)?.value);
    if (!email || !isValidEmail(email)) {
      return { success: false, error: 'Enter the email address you signed up with.' };
    }

    const limited = await checkRateLimit('resend_verification', email);
    if (limited) return { success: false, error: limited };

    // Our own email (Gmail SMTP), only for an account that is still unconfirmed.
    await resendSignupVerificationEmail(await serviceDb(), email);
    return {
      success: true,
      message: user
        ? `We sent a new verification link to ${email}.`
        : 'If that address has an unverified Justicia account, a new verification link is on its way.',
    };
  } catch (err) {
    console.warn('[resendVerificationEmailAction]', err);
    return { success: false, error: 'We could not send the email right now. Please try again.' };
  }
}

// ─── Sign In ──────────────────────────────────────────────────────────────────

export async function signInAction(
  _prevState: AuthState,
  formData: FormData
): Promise<AuthState> {
  const email = normalizeEmail(formData.get('email'));
  const password = formData.get('password') as string;

  if (!email) return { error: 'Email is required.', field: 'email' };
  if (!password) return { error: 'Password is required.', field: 'password' };

  const limited = await checkRateLimit('sign_in', email);
  if (limited) return { error: limited };

  const supabase = await createClient();

  const { data: signInData, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    if (
      error.message.toLowerCase().includes('invalid login') ||
      error.message.toLowerCase().includes('invalid credentials')
    ) {
      return { error: 'Invalid email or password.', field: 'password' };
    }
    if (error.message.toLowerCase().includes('email not confirmed')) {
      return { error: 'Please verify your email before signing in.', field: 'email', resendEmail: email };
    }
    // Suspended / terminated accounts are banned in Supabase Auth (see lib/moderation).
    if (error.code === 'user_banned' || error.message.toLowerCase().includes('banned')) {
      return { error: await bannedAccountMessage(email), field: 'email' };
    }
    return { error: error.message };
  }

  const user = signInData?.user;
  if (!user?.id) return { error: 'Sign-in failed. Please try again.' };

  const db = await serviceDb();
  let restore = false;
  try {
    const { data: profile } = await db
      .from('profiles')
      .select('account_status, deletion_requested_at')
      .eq('user_id', user.id)
      .maybeSingle();

    if (profile?.account_status === 'pending_deletion') {
      const requestedMs = profile.deletion_requested_at ? new Date(profile.deletion_requested_at).getTime() : NaN;
      const inGrace = Number.isFinite(requestedMs) && Date.now() < requestedMs + DELETION_GRACE_DAYS * 86_400_000;
      if (!inGrace) {
        await supabase.auth.signOut();
        return { error: 'This account has been deleted and can no longer be used.', field: 'email' };
      }
      // Keep the session: the proxy sends the user to /account/restore until they decide.
      await syncAuthClaims(db, user.id, { account_status: 'pending_deletion' });
      restore = true;
    } else {
      // A suspension that has ended is lifted here; a blocked account is signed straight out again.
      const blocked = await checkAccountAccess(db, user.id, profile?.account_status ?? null);
      if (blocked) {
        await supabase.auth.signOut();
        return { error: blocked, field: 'email' };
      }
    }
  } catch (err) {
    console.warn('[signInAction] account status check failed:', err);
  }
  if (restore) redirect('/account/restore');

  // Role: server-written app_metadata, then the database. Never user_metadata (user-editable).
  let resolvedRole: UserRole = roleFromAppMetadata(user) ?? 'client';
  if (!roleFromAppMetadata(user)) {
    const dbRole = await readDatabaseRole(db, user.id);
    if (dbRole) {
      resolvedRole = dbRole;
    } else {
      // No account row yet (very old accounts): create it as a client, the least-privileged role.
      await db.from('user_accounts').upsert(
        { id: user.id, email: user.email ?? email, role: 'client', verification_status: 'pending', mfa_enabled: false },
        { onConflict: 'id', ignoreDuplicates: true }
      );
    }
    await syncAuthClaims(db, user.id, { role: resolvedRole });
  }

  // Best effort: shown later as "last signed in".
  void db.from('profiles').update({ last_login_at: new Date().toISOString() }).eq('user_id', user.id).then(
    () => undefined,
    () => undefined
  );

  // Direct unapproved lawyers to the appropriate page without dashboard bounce
  if (resolvedRole === 'lawyer') {
    const { data: prof } = await supabase
      .from('lawyer_profiles')
      .select('verification_status')
      .eq('user_id', user.id)
      .maybeSingle() as { data: { verification_status: string } | null };

    if (!prof || prof.verification_status === 'draft') {
      redirect('/lawyer/register');
    }
    if (prof.verification_status !== 'approved') {
      redirect('/lawyer/verification');
    }
  }

  redirect(getDashboardForRole(resolvedRole));
}

/** Explains why a banned account cannot sign in (suspended until …, or terminated). */
async function bannedAccountMessage(email: string): Promise<string> {
  const fallback = 'This account is currently suspended for violating the Justicia community guidelines.';
  try {
    const db = await serviceDb();
    const { data: account } = await db.from('user_accounts').select('id').eq('email', email).maybeSingle();
    if (!account?.id) return fallback;
    const standing = await getAccountStanding(db, account.id);
    return standing.status === 'active'
      ? 'This account cannot sign in right now. Please contact Justicia support.'
      : accountBlockedMessage(standing);
  } catch {
    return fallback;
  }
}

// ─── Forgot Password ──────────────────────────────────────────────────────────

export async function forgotPasswordAction(
  _prevState: AuthState,
  formData: FormData
): Promise<AuthState> {
  const email = normalizeEmail(formData.get('email'));

  if (!email || !isValidEmail(email)) {
    return { error: 'Please enter a valid email address.', field: 'email' };
  }

  const limited = await checkRateLimit('password_reset', email);
  if (limited) return { error: limited };

  // A stateless client with the implicit flow: the emailed link then carries the recovery session
  // itself (#access_token…), so it works in any browser or device. The cookie-based (PKCE) client
  // ties the link to a code verifier saved in *this* browser, so opening the email elsewhere
  // (Gmail app, another browser) left the reset page without a session and the password unchanged.
  const supabase = createAuthClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { flowType: 'implicit', persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl()}/auth/reset-password`,
  });

  if (error) {
    if (error.status === 429) return { error: 'Too many reset requests. Please wait a few minutes and try again.' };
    return { error: error.message };
  }

  return {
    success:
      'If an account exists with that email, you will receive a password reset link shortly.',
  };
}

// ─── Sign Out ─────────────────────────────────────────────────────────────────

export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const cookieStore = await cookies();
  cookieStore.delete(DEMO_COOKIE);
  redirect('/');
}
