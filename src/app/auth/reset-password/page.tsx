'use client';

import { JusticiaLogo } from '@/components/brand/JusticiaLogo';
import React, { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';


function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

type LinkState = { status: 'checking' } | { status: 'ready'; email: string } | { status: 'invalid'; reason: string };

/**
 * Signs this browser in with the recovery session carried by the reset link, whatever its form:
 *  - #access_token=…&refresh_token=…&type=recovery (links sent by forgotPasswordAction now;
 *    they work in any browser or device),
 *  - ?token_hash=…&type=recovery (custom email templates),
 *  - ?code=… (older links; only works in the browser that asked for the reset).
 * The link's account replaces any account already signed in here, so the right password changes.
 */
async function sessionFromResetLink(): Promise<LinkState> {
  const supabase = createClient();
  const url = new URL(window.location.href);
  const hash = new URLSearchParams(url.hash.replace(/^#/, ''));
  const linkError = hash.get('error_description') || url.searchParams.get('error_description');
  if (linkError) return { status: 'invalid', reason: linkError.replace(/\+/g, ' ') };

  const accessToken = hash.get('access_token');
  const refreshToken = hash.get('refresh_token');
  const tokenHash = url.searchParams.get('token_hash');
  const code = url.searchParams.get('code');
  let failure: string | null = null;

  if (accessToken && refreshToken) {
    const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
    if (error) failure = error.message;
  } else if (tokenHash) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'recovery' });
    if (error) failure = error.message;
  } else if (code) {
    // The browser client may already have exchanged it while starting up.
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) failure = 'This link can only be used in the browser where you asked for the reset.';
    }
  }
  // Remove the one-time tokens from the address bar.
  if (accessToken || tokenHash || code) window.history.replaceState(null, '', url.pathname);

  const { data, error } = await supabase.auth.getUser();
  if (failure || error || !data.user) {
    return { status: 'invalid', reason: failure ?? 'This password reset link is invalid or has expired.' };
  }
  return { status: 'ready', email: data.user.email ?? '' };
}

/**
 * /auth/reset-password — Set a new password after clicking the reset email link.
 *
 * The link signs this browser in with a short-lived recovery session (sessionFromResetLink);
 * supabase.auth.updateUser({ password }) then sets the new password for that account.
 */
export default function ResetPasswordPage() {
  const router = useRouter();
  const [link, setLink] = useState<LinkState>({ status: 'checking' });
  const [isPending, startTransition] = useTransition();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function calcStrength(pw: string): number {
    let score = 0;
    if (pw.length >= 8) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^a-zA-Z0-9]/.test(pw)) score++;
    return score;
  }

  const strength = calcStrength(password);
  const strengthColors = ['#ef4444', '#f97316', '#eab308', '#22c55e'];
  const strengthLabels = ['Weak', 'Fair', 'Good', 'Strong'];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    startTransition(async () => {
      const supabase = createClient();
      const { data: current } = await supabase.auth.getUser();
      if (!current.user) {
        setLink({ status: 'invalid', reason: 'Your reset session has ended. Please request a new link.' });
        return;
      }
      const { data: updated, error: updateError } = await supabase.auth.updateUser({ password });

      if (updateError || !updated.user) {
        const message = updateError?.message ?? 'Your password could not be changed. Please try again.';
        setError(
          /different from the old password/i.test(message)
            ? 'Choose a password you have not used for this account before.'
            : /session/i.test(message)
              ? 'Your reset session has ended. Please request a new link.'
              : message
        );
        return;
      }

      // A reset usually means the old password may be known: end the other devices' sessions.
      await supabase.auth.signOut({ scope: 'others' }).catch(() => undefined);
      setSuccess(true);
      // Then open this account's own portal (the role is the server-written claim).
      const role = (updated.user.app_metadata as { role?: string } | undefined)?.role;
      const home = role === 'lawyer' ? '/lawyer/dashboard' : role === 'admin' ? '/admin/dashboard' : '/client/dashboard';
      setTimeout(() => router.replace(home), 2000);
    });
  }

  useEffect(() => {
    let cancelled = false;
    sessionFromResetLink()
      .then((state) => !cancelled && setLink(state))
      .catch(() => !cancelled && setLink({ status: 'invalid', reason: 'This password reset link is invalid or has expired.' }));
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center p-4 py-12 bg-[#0c0805]">
      <div className="w-full max-w-md">
        {/* Logo header */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center justify-center gap-2 mb-4 group">
            <JusticiaLogo className="w-44 h-auto text-[#C59341]" />
          </Link>

          <h1 className="font-cinzel text-2xl font-bold text-[#ded7cb] tracking-wide">
            Set New Password
          </h1>
          <p className="text-[12px] text-[#7a6a5a] mt-1.5 leading-relaxed">
            Choose a strong password for your account.
          </p>

          {/* Decorative line */}
          <div className="flex items-center gap-3 mt-5">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent to-[#3c2a1c]" />
            <span className="text-[#c59341] text-[10px]">✦</span>
            <div className="flex-1 h-px bg-gradient-to-l from-transparent to-[#3c2a1c]" />
          </div>
        </div>

        {/* Form card */}
        <div
          className="relative rounded-2xl border border-[#3c2a1c] px-7 py-8 shadow-2xl shadow-black/40"
          style={{ background: 'linear-gradient(145deg, #140d07 0%, #0c0805 60%, #110a06 100%)' }}
        >
          {/* Gold top border accent */}
          <div className="absolute left-1/4 right-1/4 -top-px h-px bg-gradient-to-r from-transparent via-[#c59341]/60 to-transparent rounded-full" />

          {success ? (
            <div className="text-center space-y-4">
              <div className="w-14 h-14 mx-auto rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-7 h-7 text-emerald-400">
                  <path d="M9 12l2 2 4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <p className="font-cinzel text-sm font-bold text-emerald-300 tracking-wide">Password Updated!</p>
              <p className="text-[12px] text-[#8c7a6a]">Use your new password the next time you sign in. Redirecting you to your dashboard…</p>
            </div>
          ) : link.status === 'checking' ? (
            <div className="flex items-center justify-center gap-2 py-6 text-[12px] text-[#8c7a6a]" role="status" aria-busy="true">
              <svg className="w-3.5 h-3.5 animate-spin text-[#c59341]" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.3" />
                <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
              Checking your reset link…
            </div>
          ) : link.status === 'invalid' ? (
            <div className="text-center space-y-4">
              <div className="px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm" role="alert">
                {link.reason}
              </div>
              <p className="text-[12px] text-[#8c7a6a]">Reset links work once and expire after an hour. Request a new one and open the newest email.</p>
              <Link
                href="/forgot-password"
                className="inline-block w-full font-cinzel text-xs font-bold tracking-[0.2em] uppercase bg-[#c59341] hover:bg-[#d6a54f] text-[#0c0805] py-3 rounded-lg transition-all duration-200 shadow-lg shadow-[#c59341]/20"
              >
                Request a new link
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              {link.email && (
                <p className="text-[12px] text-[#8c7a6a] text-center">
                  Resetting the password for <span className="text-[#ded7cb] font-medium">{link.email}</span>
                </p>
              )}
              {/* Error */}
              {error && (
                <div className="px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-start gap-2" role="alert">
                  <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4 flex-shrink-0 mt-0.5">
                    <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm-.75 4a.75.75 0 0 1 1.5 0v3a.75.75 0 0 1-1.5 0V5zm.75 6.5a.875.875 0 1 1 0-1.75.875.875 0 0 1 0 1.75z" />
                  </svg>
                  {error}
                </div>
              )}

              {/* New Password */}
              <div>
                <label htmlFor="new_password" className="block text-[11px] font-semibold tracking-[0.15em] uppercase text-[#a89a8c] mb-1.5">
                  New Password
                </label>
                <div className="relative">
                  <input
                    id="new_password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    autoComplete="new-password"
                    placeholder="Min. 8 characters"
                    required
                    className="w-full bg-[#110a06] border border-[#3c2a1c] rounded-lg px-4 py-2.5 pr-10 text-sm text-[#ded7cb] placeholder:text-[#5c4a3a] focus:outline-none focus:border-[#c59341]/60 focus:ring-1 focus:ring-[#c59341]/20 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6b5c4c] hover:text-[#c59341] transition-colors"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    <EyeIcon open={showPassword} />
                  </button>
                </div>

                {/* Strength bar */}
                {password && (
                  <div className="mt-2">
                    <div className="flex gap-1">
                      {[0, 1, 2, 3].map(i => (
                        <div
                          key={i}
                          className="h-1 flex-1 rounded-full transition-all duration-300"
                          style={{ background: i < strength ? strengthColors[strength - 1] : '#2a1e14' }}
                        />
                      ))}
                    </div>
                    {strength > 0 && (
                      <p className="text-[10px] mt-1" style={{ color: strengthColors[strength - 1] }}>
                        {strengthLabels[strength - 1]}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Confirm Password */}
              <div>
                <label htmlFor="confirm_password" className="block text-[11px] font-semibold tracking-[0.15em] uppercase text-[#a89a8c] mb-1.5">
                  Confirm Password
                </label>
                <div className="relative">
                  <input
                    id="confirm_password"
                    type={showConfirm ? 'text' : 'password'}
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    autoComplete="new-password"
                    placeholder="Re-enter your password"
                    required
                    className={`w-full bg-[#110a06] border ${confirm && confirm !== password ? 'border-red-500/60' : 'border-[#3c2a1c]'} rounded-lg px-4 py-2.5 pr-10 text-sm text-[#ded7cb] placeholder:text-[#5c4a3a] focus:outline-none focus:border-[#c59341]/60 focus:ring-1 focus:ring-[#c59341]/20 transition-all`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6b5c4c] hover:text-[#c59341] transition-colors"
                    aria-label={showConfirm ? 'Hide password' : 'Show password'}
                  >
                    <EyeIcon open={showConfirm} />
                  </button>
                </div>
                {confirm && confirm !== password && (
                  <p className="mt-1.5 text-[11px] text-red-400" role="alert">Passwords do not match.</p>
                )}
              </div>

              {/* Submit */}
              <button
                type="submit"
                id="reset-password-submit-btn"
                disabled={isPending}
                className="w-full font-cinzel text-xs font-bold tracking-[0.2em] uppercase bg-[#c59341] hover:bg-[#d6a54f] disabled:opacity-50 disabled:cursor-not-allowed text-[#0c0805] py-3 rounded-lg transition-all duration-200 shadow-lg shadow-[#c59341]/20 hover:shadow-[#c59341]/30 hover:-translate-y-0.5 active:translate-y-0"
              >
                {isPending ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.3" />
                      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                    </svg>
                    Updating…
                  </span>
                ) : (
                  'Update Password'
                )}
              </button>
            </form>
          )}
        </div>

        {/* Back to login */}
        <p className="text-center text-[11px] text-[#7a6a5a] mt-5">
          Remember your password?{' '}
          <Link href="/login" className="text-[#c59341] hover:text-[#d6a54f] transition-colors font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
