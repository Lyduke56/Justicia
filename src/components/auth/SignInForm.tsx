'use client';

import React, { startTransition, useActionState, useEffect, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { AnimatePresence, motion, useReducedMotion, type Variants } from 'motion/react';
import { signInAction, type AuthState } from '@/app/actions/auth';
import { ScreenLoader } from '@/components/shared/loading';
import { ResendVerificationButton } from './ResendVerificationButton';
import {
  AuthAlert,
  AuthField,
  AuthSubmitArrow,
  AuthSubmitButton,
  MailIcon,
  PasswordField,
  authFormFooterClass,
  authLinkClass,
  authSubtleLinkClass,
} from './AuthFields';

// ─── Animation ────────────────────────────────────────────────────────────────

const EASE = [0.22, 1, 0.36, 1] as const;

const containerVariants: Variants = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE, staggerChildren: 0.06, delayChildren: 0.05 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE } },
};

const reducedVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.2 } },
};

/**
 * After this long the request is almost always past the password check and on to opening the
 * portal (role lookups, then the dashboard), so the global loading screen takes over.
 */
const HANDOFF_DELAY_MS = 900;

// ─── Component ────────────────────────────────────────────────────────────────

const initialState: AuthState = null;
const noopSubscribe = () => () => {};

export interface SignInFormProps {
  /** Kept for compatibility; the form always uses the neumorphic style. */
  variant?: 'dark' | 'neumorphic';
  /** Called when the modal should close (modal usage only) */
  onClose?: () => void;
  /** Called to switch to sign-up flow (modal usage only) */
  onSwitchToSignUp?: () => void;
  /** Called to switch to forgot-password flow (modal usage only) */
  onSwitchToForgotPassword?: () => void;
  /** Optional redirect URL after login */
  redirectTo?: string;
  /** Whether to show the bottom "New to Justicia? Create an account" link */
  showSignUpLink?: boolean;
}

export function SignInForm({
  onClose,
  onSwitchToSignUp,
  onSwitchToForgotPassword,
  redirectTo,
  showSignUpLink = false,
}: SignInFormProps) {
  const [state, formAction, isPending] = useActionState(signInAction, initialState);
  const reduce = useReducedMotion();
  const container = reduce ? reducedVariants : containerVariants;
  const item = reduce ? reducedVariants : itemVariants;

  // Long-running sign-in → the portal is being opened: show the global loading screen.
  // Each submit gets a number; the loader shows only for the submit that is still pending.
  const [submitCount, setSubmitCount] = useState(0);
  const [handoffFor, setHandoffFor] = useState(-1);
  const handoff = isPending && handoffFor === submitCount;
  useEffect(() => {
    if (!isPending) return;
    const timer = setTimeout(() => setHandoffFor(submitCount), HANDOFF_DELAY_MS);
    return () => clearTimeout(timer);
  }, [isPending, submitCount]);
  const inBrowser = useSyncExternalStore(noopSubscribe, () => true, () => false);

  // Submit through a transition instead of the form `action` prop, so React doesn't clear the
  // fields when the server answers with an error (the email stays filled in for a retry).
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isPending) return;
    const data = new FormData(e.currentTarget);
    setSubmitCount((n) => n + 1);
    startTransition(() => formAction(data));
  };

  const fieldError = (field: 'email' | 'password') => (state?.field === field ? state.error : undefined);

  const forgotLink = onSwitchToForgotPassword ? (
    <button type="button" onClick={onSwitchToForgotPassword} className={authSubtleLinkClass}>
      Forgot password?
    </button>
  ) : (
    <Link href="/forgot-password" onClick={onClose} className={authSubtleLinkClass}>
      Forgot password?
    </Link>
  );

  return (
    <form onSubmit={onSubmit} noValidate aria-busy={isPending || undefined}>
      {redirectTo && <input type="hidden" name="redirectTo" value={redirectTo} />}

      {/* A disabled fieldset locks every field while the request runs (no double submits). */}
      <fieldset disabled={isPending} className="m-0 min-w-0 border-0 p-0">
        <motion.div variants={container} initial="hidden" animate="visible" className="flex flex-col gap-5">
          <AnimatePresence initial={false}>
            {state?.error && !state.field && (
              <motion.div key="error" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                <AuthAlert title="We couldn't sign you in">{state.error}</AuthAlert>
              </motion.div>
            )}
          </AnimatePresence>

          <motion.div variants={item}>
            <AuthField
              id="email_signin"
              name="email"
              type="email"
              label="Email address"
              icon={<MailIcon />}
              autoComplete="username"
              inputMode="email"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="you@example.com"
              required
              error={fieldError('email')}
            />
            {state?.resendEmail && (
              <div className="pt-2 pl-0.5">
                <ResendVerificationButton
                  email={state.resendEmail}
                  className={`font-inter text-[11.5px] disabled:opacity-60 ${authLinkClass}`}
                  messageClassName="font-inter text-[11.5px] text-[#7A604D]"
                />
              </div>
            )}
          </motion.div>

          {/* "Forgot password?" sits under the field, right-aligned with its edge. */}
          <motion.div variants={item}>
            <PasswordField
              id="password_signin"
              name="password"
              label="Password"
              autoComplete="current-password"
              placeholder="Enter your password"
              required
              error={fieldError('password')}
            />
            <div className="mt-2.5 flex justify-end pr-0.5">{forgotLink}</div>
          </motion.div>

          <motion.div variants={item} className="pt-1">
            <AuthSubmitButton id="signin-submit-btn" pending={isPending} pendingLabel="Signing in…">
              Sign In
              <AuthSubmitArrow />
            </AuthSubmitButton>
          </motion.div>

          {(showSignUpLink || onSwitchToSignUp) && (
            <motion.p variants={item} className={`mt-1 ${authFormFooterClass}`}>
              New to Justicia?{' '}
              {onSwitchToSignUp ? (
                <button type="button" onClick={onSwitchToSignUp} className={authLinkClass}>
                  Create an account
                </button>
              ) : (
                <Link href="/register" onClick={onClose} className={authLinkClass}>
                  Create an account
                </Link>
              )}
            </motion.p>
          )}
        </motion.div>
      </fieldset>

      {/* Credentials accepted and the portal is opening (or the server is slow): global loader.
          Portalled so a transformed ancestor (the sign-in modal) can't confine it. */}
      {inBrowser &&
        createPortal(
          <AnimatePresence>
            {handoff && (
              <motion.div
                key="handoff"
                className="fixed inset-0 z-[300]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, transition: { duration: 0.25 } }}
                exit={{ opacity: 0, transition: { duration: 0.2 } }}
              >
                <ScreenLoader variant="fullscreen" srLabel="Signing you in" />
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </form>
  );
}
