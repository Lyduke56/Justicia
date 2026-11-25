'use client';

import React, { startTransition, useActionState, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion, useReducedMotion, type Variants } from 'motion/react';
import { signUpAction, type AuthState } from '@/app/actions/auth';
import { AuthAlert, AuthField, AuthSubmitButton, MailIcon, PasswordField, PersonIcon, authLabelClass } from './AuthFields';

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

// ─── Role choice ─────────────────────────────────────────────────────────────

const ROLES = [
  {
    value: 'client' as const,
    label: 'Client',
    description: 'Seek legal guidance',
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="8" r="3.6" />
        <path d="M5 20c0-3.7 3.1-6.3 7-6.3s7 2.6 7 6.3" />
      </svg>
    ),
  },
  {
    value: 'lawyer' as const,
    label: 'Lawyer',
    description: 'Provide legal services',
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 3v18M7 21h10M5 7h14M5 7l-3 7a3 3 0 0 0 6 0L5 7Zm14 0-3 7a3 3 0 0 0 6 0l-3-7Z" />
      </svg>
    ),
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

const initialState: AuthState = null;

export function SignUpForm() {
  const [state, formAction, isPending] = useActionState(signUpAction, initialState);
  const [role, setRole] = useState<'client' | 'lawyer'>('client');
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

  const selectRole = (index: number) => setRole(ROLES[(index + ROLES.length) % ROLES.length].value);

  return (
    <form onSubmit={onSubmit} noValidate aria-busy={isPending || undefined}>
      <fieldset disabled={isPending} className="m-0 min-w-0 border-0 p-0">
        <motion.div variants={container} initial="hidden" animate="visible" className="space-y-4">
          <AnimatePresence initial={false}>
            {state?.error && !state.field && (
              <motion.div key="error" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                <AuthAlert title="We couldn't create your account">{state.error}</AuthAlert>
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

          {/* ─── Role ─────────────────────────────────────────────────────── */}
          <motion.div variants={item} className="pt-2">
            <div className="flex items-center gap-3 pb-3">
              <span className="h-px flex-1 bg-[#C8B59E]/70" aria-hidden="true" />
              <p id="signup-role-label" className={`${authLabelClass} text-center`}>
                I&apos;m joining as a…
              </p>
              <span className="h-px flex-1 bg-[#C8B59E]/70" aria-hidden="true" />
            </div>
            <input type="hidden" name="role" value={role} />
            <div
              role="radiogroup"
              aria-labelledby="signup-role-label"
              className="grid grid-cols-2 gap-4 sm:gap-5"
              onKeyDown={(e) => {
                const i = ROLES.findIndex((r) => r.value === role);
                if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                  e.preventDefault();
                  selectRole(i + 1);
                } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                  e.preventDefault();
                  selectRole(i - 1);
                }
              }}
            >
              {ROLES.map((r) => {
                const selected = role === r.value;
                return (
                  <motion.button
                    key={r.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    tabIndex={selected ? 0 : -1}
                    onClick={() => setRole(r.value)}
                    whileHover={reduce || selected ? undefined : { y: -2 }}
                    whileTap={reduce ? undefined : { scale: 0.98 }}
                    transition={{ type: 'spring', stiffness: 450, damping: 25 }}
                    className={`relative flex items-center gap-3 rounded-[15px] px-3.5 py-3.5 sm:px-4 text-left transition-[box-shadow,background-color] duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C58B3C]/60 ${
                      selected ? 'neu-pressed' : 'neu-raised-sm'
                    }`}
                  >
                    <span
                      className={`grid size-9 shrink-0 place-items-center rounded-xl transition-colors ${
                        selected ? 'bg-[#C58B3C] text-white' : 'neu-raised-sm text-[#C58B3C]'
                      }`}
                    >
                      {r.icon}
                    </span>
                    <span className="min-w-0">
                      <span className="block font-lora text-[13px] sm:text-[14px] font-bold uppercase tracking-[0.08em] text-[#34150F]">
                        {r.label}
                      </span>
                      <span className="block font-inter text-[10.5px] sm:text-[11.5px] text-[#7A604D] leading-snug">{r.description}</span>
                    </span>
                    <AnimatePresence>
                      {selected && (
                        <motion.span
                          key="check"
                          initial={reduce ? { opacity: 0 } : { scale: 0, rotate: -25, opacity: 0 }}
                          animate={{ scale: 1, rotate: 0, opacity: 1 }}
                          exit={{ scale: 0, opacity: 0 }}
                          transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                          className="absolute right-2.5 top-2.5 grid size-4 place-items-center rounded-full bg-[#B9833C]"
                          aria-hidden="true"
                        >
                          <svg viewBox="0 0 12 12" fill="none" className="h-2.5 w-2.5">
                            <path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </motion.button>
                );
              })}
            </div>
            {fieldError('role') && <p className="pt-1.5 font-inter text-[11.5px] font-medium text-[#B42318]">{fieldError('role')}</p>}
            <AnimatePresence initial={false}>
              {role === 'lawyer' && (
                <motion.p
                  key="lawyer-note"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden pt-2.5 text-center font-inter text-[11.5px] leading-relaxed text-[#7A604D]"
                >
                  After verifying your email you&apos;ll submit your IBP details for review before your profile goes live.
                </motion.p>
              )}
            </AnimatePresence>
          </motion.div>

          {/* ─── Terms ────────────────────────────────────────────────────── */}
          <motion.div variants={item} className="flex items-start gap-3 pt-1">
            <span className="relative mt-0.5 grid size-[18px] shrink-0 place-items-center">
              <input
                id="terms"
                name="accept_terms"
                value="yes"
                type="checkbox"
                required
                className="peer absolute inset-0 size-full cursor-pointer appearance-none rounded-[6px] neu-pressed transition-colors checked:bg-[#34150F]! focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C58B3C]/60"
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
            <label htmlFor="terms" className="cursor-pointer select-none font-inter text-[12px] leading-snug text-[#7A604D]">
              I agree to Justicia&apos;s{' '}
              <Link href="/terms" className="font-semibold text-[#99431E] hover:text-[#34150F] hover:underline">
                Terms of Service
              </Link>
              ,{' '}
              <Link href="/privacy" className="font-semibold text-[#99431E] hover:text-[#34150F] hover:underline">
                Privacy Policy
              </Link>{' '}
              and{' '}
              <Link href="/ai-disclaimer" className="font-semibold text-[#99431E] hover:text-[#34150F] hover:underline">
                AI Disclaimer
              </Link>
              .
            </label>
          </motion.div>

          <motion.div variants={item} className="pt-1">
            <AuthSubmitButton id="signup-submit-btn" pending={isPending} pendingLabel="Creating account…">
              Create Account
            </AuthSubmitButton>
          </motion.div>
        </motion.div>
      </fieldset>
    </form>
  );
}
