'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getDashboardForRole, isAuthorizedForRoute, type UserRole } from '@/lib/utils/rbac';

// ─── Types ────────────────────────────────────────────────────────────────────

export type AuthState = {
  error?: string;
  success?: string;
  field?: string; // which field triggered the error
} | null;

// ─── Sign Up ──────────────────────────────────────────────────────────────────

export async function signUpAction(
  _prevState: AuthState,
  formData: FormData
): Promise<AuthState> {
  const fullName = (formData.get('full_name') as string)?.trim();
  const email = (formData.get('email') as string)?.trim().toLowerCase();
  const password = formData.get('password') as string;
  const confirmPassword = formData.get('confirm_password') as string | null;
  const role = (formData.get('role') as string) ?? 'client';
  const inModal = formData.get('inModal') === 'true';

  // Basic validation
  if (!fullName || fullName.length < 2) {
    return { error: 'Full name must be at least 2 characters.', field: 'full_name' };
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: 'Please enter a valid email address.', field: 'email' };
  }
  if (!password || password.length < 8) {
    return { error: 'Password must be at least 8 characters.', field: 'password' };
  }
  if (confirmPassword !== null && password !== confirmPassword) {
    return { error: 'Passwords do not match.', field: 'confirm_password' };
  }
  if (!['client', 'lawyer'].includes(role)) {
    return { error: 'Invalid role selected.', field: 'role' };
  }

  const supabase = await createClient();

  const { data: signUpData, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        role,
      },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'}/auth/callback`,
    },
  });

  if (error) {
    if (error.message.toLowerCase().includes('already registered')) {
      return { error: 'An account with this email already exists.', field: 'email' };
    }
    return { error: error.message };
  }

  // Insert matching row into user_accounts so role-based routing works at login
  if (signUpData?.user?.id) {
    await (supabase.from('user_accounts') as ReturnType<typeof supabase.from>).upsert(
      {
        id: signUpData.user.id,
        email,
        role: role as 'client' | 'lawyer',
        verification_status: 'pending' as const,
        mfa_enabled: false,
      } as Record<string, unknown>,
      { onConflict: 'id', ignoreDuplicates: true }
    );
  }

  // If email confirmation is disabled in Supabase, the user is already logged in
  if (signUpData?.session) {
    redirect(getDashboardForRole(role as UserRole));
  }

  // When used inside a modal, return a friendly confirmation state instead of navigating away
  if (inModal) {
    return {
      success:
        'Account created successfully! We sent a confirmation link to your email. Please verify your email before logging in.',
    };
  }

  redirect('/verify-email');
}

// ─── Sign In ──────────────────────────────────────────────────────────────────

export async function signInAction(
  _prevState: AuthState,
  formData: FormData
): Promise<AuthState> {
  const email = (formData.get('email') as string)?.trim().toLowerCase();
  const password = formData.get('password') as string;
  const redirectTo = (formData.get('redirectTo') as string)?.trim();

  if (!email) return { error: 'Email is required.', field: 'email' };
  if (!password) return { error: 'Password is required.', field: 'password' };

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
      return { error: 'Please verify your email before signing in.', field: 'email' };
    }
    return { error: error.message };
  }

  // Determine the user's role — check user_accounts first, then auth metadata as fallback
  let resolvedRole: UserRole = 'client';

  if (signInData?.user?.id) {
    // 1. Try the authoritative source: user_accounts table
    const { data: account } = await supabase
      .from('user_accounts')
      .select('role')
      .eq('id', signInData.user.id)
      .single() as { data: { role: string } | null; error: unknown };

    if (account?.role) {
      resolvedRole = account.role as UserRole;
    } else {
      // 2. Fall back to auth user_metadata (set during signUp)
      const metaRole = signInData.user.user_metadata?.role as string | undefined;
      if (metaRole && ['client', 'lawyer', 'admin'].includes(metaRole)) {
        resolvedRole = metaRole as UserRole;

        // 3. Back-fill user_accounts so future logins use the table
        await (supabase.from('user_accounts') as ReturnType<typeof supabase.from>).upsert(
          {
            id: signInData.user.id,
            email: signInData.user.email ?? email,
            role: resolvedRole,
            verification_status: 'pending' as const,
            mfa_enabled: false,
          } as Record<string, unknown>,
          { onConflict: 'id', ignoreDuplicates: true }
        );
      }
    }
  }

  if (redirectTo && isAuthorizedForRoute(resolvedRole, redirectTo)) {
    redirect(redirectTo);
  }

  redirect(getDashboardForRole(resolvedRole));
}

// ─── Forgot Password ──────────────────────────────────────────────────────────

export async function forgotPasswordAction(
  _prevState: AuthState,
  formData: FormData
): Promise<AuthState> {
  const email = (formData.get('email') as string)?.trim().toLowerCase();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: 'Please enter a valid email address.', field: 'email' };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'}/auth/reset-password`,
  });

  if (error) {
    return { error: error.message };
  }

  return {
    success:
      'If an account exists with that email, you will receive a password reset link shortly.',
  };
}
