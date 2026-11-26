'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { AuthPageCard, AuthPanelHeader, AuthPanelView } from '@/components/auth/AuthPanel';
import { AuthAlert, AuthPanelHeaderIcon, AuthSubmitButton, PasswordField, authLinkClass } from '@/components/auth/AuthFields';
import { SubmissionStatus, useSubmission, type SubmissionResult } from '@/components/shared/feedback';
import { PanelLoader } from '@/components/shared/loading';
import { NeuButton } from '@/components/shared/neu';

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

const SESSION_ENDED = 'Your reset session has ended. Please request a new link.';

/**
 * /auth/reset-password — Set a new password after clicking the reset email link.
 *
 * The link signs this browser in with a short-lived recovery session (sessionFromResetLink);
 * supabase.auth.updateUser({ password }) then sets the new password for that account.
 */
export default function ResetPasswordPage() {
  const router = useRouter();
  const [link, setLink] = useState<LinkState>({ status: 'checking' });
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [formError, setFormError] = useState<{ field: 'password' | 'confirm'; message: string } | null>(null);
  const [home, setHome] = useState('/client/dashboard');
  const submission = useSubmission();

  async function updatePassword(): Promise<SubmissionResult> {
    const supabase = createClient();
    const { data: current } = await supabase.auth.getUser();
    if (!current.user) {
      setLink({ status: 'invalid', reason: SESSION_ENDED });
      return { ok: false, error: SESSION_ENDED };
    }
    const { data: updated, error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError || !updated.user) {
      const message = updateError?.message ?? 'Your password could not be changed. Please try again.';
      return {
        ok: false,
        error: /different from the old password/i.test(message)
          ? 'Choose a password you have not used for this account before.'
          : /session/i.test(message)
            ? SESSION_ENDED
            : message,
      };
    }

    // A reset usually means the old password may be known: end the other devices' sessions.
    await supabase.auth.signOut({ scope: 'others' }).catch(() => undefined);
    // Then open this account's own portal (the role is the server-written claim).
    const role = (updated.user.app_metadata as { role?: string } | undefined)?.role;
    setHome(role === 'lawyer' ? '/lawyer/dashboard' : role === 'admin' ? '/admin/dashboard' : '/client/dashboard');
    return { ok: true };
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setFormError({ field: 'password', message: 'Password must be at least 8 characters.' });
      return;
    }
    if (password !== confirm) {
      setFormError({ field: 'confirm', message: 'Passwords do not match.' });
      return;
    }
    setFormError(null);
    void submission.run(updatePassword);
  }

  // After the check has been drawn, continue to the account's portal.
  useEffect(() => {
    if (submission.phase !== 'success') return;
    const timer = setTimeout(() => router.replace(home), 2600);
    return () => clearTimeout(timer);
  }, [submission.phase, home, router]);

  useEffect(() => {
    let cancelled = false;
    sessionFromResetLink()
      .then((state) => !cancelled && setLink(state))
      .catch(() => !cancelled && setLink({ status: 'invalid', reason: 'This password reset link is invalid or has expired.' }));
    return () => {
      cancelled = true;
    };
  }, []);

  const requestNewLink = (
    <Link
      href="/forgot-password"
      className="neu-btn-create inline-flex h-12 w-full items-center justify-center rounded-[14px] px-6 font-inter text-[12.5px] font-semibold uppercase tracking-[0.16em] text-[#F3E6D6] transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C58B3C]/70"
    >
      Request a new link
    </Link>
  );

  const mismatch = confirm.length > 0 && confirm !== password;

  let view: React.ReactNode;
  let viewKey: string;
  if (submission.phase !== 'idle') {
    viewKey = 'status';
    view = (
      <SubmissionStatus
        phase={submission.phase}
        titleId="reset-password-title"
        className="pt-2"
        processing={{ title: 'Updating your password', message: 'This only takes a moment.' }}
        success={{
          title: 'Password updated',
          message: 'Use your new password the next time you sign in. Taking you to your dashboard…',
        }}
        failure={{ title: "We couldn't update your password" }}
        error={submission.error}
        onClose={() => router.replace(home)}
        actions={
          submission.phase === 'success' ? (
            <NeuButton variant="primary" onClick={() => router.replace(home)} className="w-full sm:w-48">
              Continue
            </NeuButton>
          ) : link.status === 'invalid' ? (
            <div className="w-full">{requestNewLink}</div>
          ) : (
            <NeuButton variant="primary" onClick={submission.reset} className="w-full sm:w-48">
              Try Again
            </NeuButton>
          )
        }
      />
    );
  } else if (link.status === 'checking') {
    viewKey = 'checking';
    view = <PanelLoader label="Checking your reset link..." />;
  } else if (link.status === 'invalid') {
    viewKey = 'invalid';
    view = (
      <>
        <AuthPanelHeader
          titleId="reset-password-title"
          icon={<AuthPanelHeaderIcon kind="key" />}
          title="This link can't be used"
          subtitle="Reset links work once and expire after an hour. Request a new one and open the newest email."
        />
        <div className="mt-6 space-y-5">
          <AuthAlert title="Reset link problem">{link.reason}</AuthAlert>
          {requestNewLink}
        </div>
      </>
    );
  } else {
    viewKey = 'form';
    view = (
      <>
        <AuthPanelHeader
          titleId="reset-password-title"
          icon={<AuthPanelHeaderIcon kind="shield" />}
          title="Set a new password"
          subtitle={
            link.email ? (
              <>
                For <span className="font-semibold text-[#34150F]">{link.email}</span>. Choose something you haven&apos;t
                used here before.
              </>
            ) : (
              'Choose a strong password for your account.'
            )
          }
        />
        <form onSubmit={handleSubmit} noValidate className="mt-7 space-y-5">
          {submission.error && (
            <AuthAlert title="We couldn't update your password">{submission.error}</AuthAlert>
          )}
          {/* Lets password managers save the new password against the right account. */}
          {link.email && <input type="email" name="username" autoComplete="username" value={link.email} readOnly hidden />}
          <PasswordField
            id="new_password"
            name="new-password"
            label="New password"
            autoComplete="new-password"
            placeholder="At least 8 characters"
            required
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (formError?.field === 'password') setFormError(null);
            }}
            error={formError?.field === 'password' ? formError.message : null}
            meter
            rules
          />
          <PasswordField
            id="confirm_password"
            name="confirm-password"
            label="Confirm new password"
            autoComplete="new-password"
            placeholder="Re-enter your password"
            required
            value={confirm}
            onChange={(e) => {
              setConfirm(e.target.value);
              if (formError?.field === 'confirm') setFormError(null);
            }}
            error={formError?.field === 'confirm' ? formError.message : mismatch ? 'Passwords do not match.' : null}
          />
          <AuthSubmitButton id="reset-password-submit-btn">Update Password</AuthSubmitButton>
        </form>
      </>
    );
  }

  return (
    <AuthPageCard
      footer={
        <>
          Remember your password?{' '}
          <Link href="/login" className={authLinkClass}>
            Sign in
          </Link>
        </>
      }
    >
      <AuthPanelView viewKey={viewKey}>{view}</AuthPanelView>
    </AuthPageCard>
  );
}
