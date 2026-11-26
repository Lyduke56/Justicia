'use client';

import React, { startTransition, useActionState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion, useReducedMotion, type Variants } from 'motion/react';
import { signUpAction, type AuthState } from '@/app/actions/auth';
import {
  AuthAlert,
  AuthField,
  AuthSubmitArrow,
  AuthSubmitButton,
  InfoIcon,
  MailIcon,
  PasswordField,
  PersonIcon,
} from './AuthFields';
import type { SignUpRole } from './signUpRole';

// ─── Animation ────────────────────────────────────────────────────────────────

const EASE = [0.22, 1, 0.36, 1] as const;

const containerVariants: Variants = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE, staggerChildren: 0.055, delayChildren: 0.08 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE } },
};

const reducedVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.2 } },
};

const termsLinkClass = 'font-semibold text-[#99431E] hover:text-[#34150F] hover:underline';

// ─── Component ────────────────────────────────────────────────────────────────

const initialState: AuthState = null;

export interface SignUpFormProps {
  /** The account type chosen in the role-selection modal; sent as the form's `role`. */
  role: SignUpRole;
}

export function SignUpForm({ role }: SignUpFormProps) {
  const [state, formAction, isPending] = useActionState(signUpAction, initialState);
  const reduce = useReducedMotion();
  const container = reduce ? reducedVariants : containerVariants;
  const item = reduce ? reducedVariants : itemVariants;

  // Submit through a transition instead of the form `action` prop, so React doesn't clear what
  // was typed when the server answers with an error.
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isPending) return;
    const data = new FormData(e.currentTarget);
    startTransition(() => formAction(data));
  };

  const fieldError = (field: string) => (state?.field === field ? state.error : undefined);
  // The role isn't a field here any more, so a role error shows in the banner.
  const bannerError = state?.error && (!state.field || state.field === 'role') ? state.error : null;

  return (
    <form onSubmit={onSubmit} noValidate aria-busy={isPending || undefined}>
      <input type="hidden" name="role" value={role} />
      <fieldset disabled={isPending} className="m-0 min-w-0 border-0 p-0">
        <motion.div variants={container} initial="hidden" animate="visible" className="flex flex-col gap-5">
          <AnimatePresence initial={false}>
            {bannerError && (
              <motion.div key="error" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                <AuthAlert title="We couldn't create your account">{bannerError}</AuthAlert>
              </motion.div>
            )}
          </AnimatePresence>

          {/* What happens after sign-up, for lawyers. */}
          <AnimatePresence initial={false}>
            {role === 'lawyer' && (
              <motion.div
                key="lawyer-note"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25, ease: EASE }}
                className="overflow-hidden"
              >
                <p className="flex items-start gap-2.5 text-pretty rounded-xl border border-[#D39758]/35 bg-[#D39758]/10 px-3.5 py-2.5 font-inter text-[12px] leading-relaxed text-[#6E5545]">
                  <InfoIcon className="mt-0.5 h-4 w-4 shrink-0 text-[#B9833C]" />
                  After verifying your email you&apos;ll submit your IBP details for review before your profile goes live.
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          <motion.div variants={item}>
            <AuthField
              id="full_name"
              name="full_name"
              type="text"
              label="Full name"
              icon={<PersonIcon />}
              autoComplete="name"
              autoCapitalize="words"
              placeholder="e.g. Juan dela Cruz"
              required
              error={fieldError('full_name')}
            />
          </motion.div>

          <motion.div variants={item}>
            <AuthField
              id="email_signup"
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
              error={fieldError('email')}
            />
          </motion.div>

          <motion.div variants={item}>
            <PasswordField
              id="password_signup"
              name="password"
              label="Password"
              autoComplete="new-password"
              placeholder="At least 8 characters"
              required
              error={fieldError('password')}
              meter
            />
          </motion.div>

          {/* ─── Terms: the checkbox + text centred as one group; wrapped lines stay aligned
                 with the text's own left edge, next to the checkbox. ───────────────── */}
          <motion.div variants={item} className="flex justify-center pt-1">
            <div className="flex max-w-full items-start gap-3">
              <span className="relative mt-px grid size-5 shrink-0 place-items-center">
                <input
                  id="terms"
                  name="accept_terms"
                  value="yes"
                  type="checkbox"
                  required
                  className="peer absolute inset-0 size-full cursor-pointer appearance-none rounded-[6px] neu-pressed transition-colors checked:bg-[#431407]! focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C58B3C]/70"
                />
                <svg
                  viewBox="0 0 12 12"
                  fill="none"
                  className="pointer-events-none relative h-3 w-3 opacity-0 transition-opacity peer-checked:opacity-100"
                  aria-hidden="true"
                >
                  <path d="M2 6l3 3 5-5" stroke="#F3E6D6" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <label htmlFor="terms" className="cursor-pointer select-none font-inter text-[12.5px] leading-relaxed text-[#6E5545]">
                I agree to Justicia&apos;s{' '}
                <Link href="/terms" className={termsLinkClass}>
                  Terms of Service
                </Link>
                ,{' '}
                <Link href="/privacy" className={termsLinkClass}>
                  Privacy Policy
                </Link>{' '}
                and{' '}
                <Link href="/ai-disclaimer" className={termsLinkClass}>
                  AI Disclaimer
                </Link>
                .
              </label>
            </div>
          </motion.div>

          <motion.div variants={item} className="pt-1">
            <AuthSubmitButton id="signup-submit-btn" pending={isPending} pendingLabel="Creating account…">
              Create Account
              <AuthSubmitArrow />
            </AuthSubmitButton>
          </motion.div>
        </motion.div>
      </fieldset>
    </form>
  );
}
