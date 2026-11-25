'use client';

/**
 * Request a password reset link. Used in the landing page's sign-in dialog (switched to in place)
 * and on /forgot-password.
 *
 *  form       → email field; obviously invalid addresses are caught before anything is sent.
 *  processing → the form gives way to the shared submission badge.
 *  success    → the badge writes a check: "Check your email" (wording never reveals whether an
 *               account exists, same as the server action).
 *  error      → the badge writes an X with the reason; "Try Again" returns to the form.
 */
import React, { useId, useState } from 'react';
import Link from 'next/link';
import { forgotPasswordAction } from '@/app/actions/auth';
import { SubmissionStatus, useSubmission } from '@/components/shared/feedback';
import { NeuButton } from '@/components/shared/neu';
import { AuthField, AuthPanelHeaderIcon, AuthSubmitButton, MailIcon, authLinkClass } from './AuthFields';
import { AuthPanelHeader, AuthPanelView } from './AuthPanel';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface ForgotPasswordFormProps {
  onClose?: () => void;
  /** In a dialog: switch back to the sign-in view (otherwise links to /login). */
  onSwitchToSignIn?: () => void;
  /** id for the visible title (the dialog's aria-labelledby). */
  titleId?: string;
}

export function ForgotPasswordForm({ onClose, onSwitchToSignIn, titleId }: ForgotPasswordFormProps) {
  const generatedId = useId();
  const headingId = titleId ?? generatedId;
  const submission = useSubmission();
  const [email, setEmail] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [sentMessage, setSentMessage] = useState<string | null>(null);

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const value = email.trim();
    if (!EMAIL_RE.test(value)) {
      setFieldError('Please enter a valid email address.');
      return;
    }
    setFieldError(null);
    void submission.run(async () => {
      const data = new FormData();
      data.set('email', value);
      const res = await forgotPasswordAction(null, data);
      if (res?.success) {
        setSentMessage(res.success);
        return { ok: true };
      }
      return { ok: false, error: res?.error || 'We could not send the reset link. Please try again.' };
    });
  };

  const backToSignIn = onSwitchToSignIn ? (
    <NeuButton variant="secondary" onClick={onSwitchToSignIn} className="w-full sm:w-auto">
      Back to Sign In
    </NeuButton>
  ) : (
    <Link
      href="/login"
      onClick={onClose}
      className="neu-raised-sm inline-flex h-11 w-full items-center justify-center rounded-xl bg-[#E5D8CB] px-6 font-lora text-sm font-bold text-[#341512] transition-colors hover:text-[#A8742E] sm:w-auto"
    >
      Back to Sign In
    </Link>
  );

  if (submission.phase !== 'idle') {
    return (
      <AuthPanelView viewKey="status">
        <SubmissionStatus
          phase={submission.phase}
          titleId={headingId}
          className="pt-2"
          processing={{ title: 'Sending your reset link', message: `To ${email.trim()}` }}
          success={{
            title: 'Check your email',
            message: `${sentMessage ?? 'If an account exists with that email, you will receive a password reset link shortly.'} The link works once and expires in an hour.`,
          }}
          failure={{ title: "We couldn't send the link" }}
          error={submission.error}
          onClose={onSwitchToSignIn ?? onClose ?? (() => undefined)}
          actions={
            submission.phase === 'error' ? (
              <>
                {backToSignIn}
                <NeuButton variant="primary" onClick={submission.reset} className="w-full sm:w-auto">
                  Try Again
                </NeuButton>
              </>
            ) : (
              backToSignIn
            )
          }
        />
      </AuthPanelView>
    );
  }

  return (
    <AuthPanelView viewKey="form" direction={-1}>
      <AuthPanelHeader
        titleId={headingId}
        icon={<AuthPanelHeaderIcon kind="key" />}
        title="Forgot your password?"
        subtitle="Enter the email you signed up with and we'll send you a secure link to set a new one."
      />
      <form onSubmit={onSubmit} noValidate className="mt-7 space-y-5">
        <AuthField
          id="email_forgot"
          name="email"
          type="email"
          label="Email address"
          icon={<MailIcon />}
          autoComplete="email"
          inputMode="email"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="you@example.com"
          required
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (fieldError) setFieldError(null);
          }}
          error={fieldError}
        />
        <AuthSubmitButton id="forgot-password-submit-btn">Send Reset Link</AuthSubmitButton>
        <p className="text-center font-inter text-[12px] text-[#7A604D]">
          Remembered it?{' '}
          {onSwitchToSignIn ? (
            <button type="button" onClick={onSwitchToSignIn} className={authLinkClass}>
              Back to sign in
            </button>
          ) : (
            <Link href="/login" onClick={onClose} className={authLinkClass}>
              Back to sign in
            </Link>
          )}
        </p>
      </form>
    </AuthPanelView>
  );
}
