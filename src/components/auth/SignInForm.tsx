'use client';

import React, { useActionState, useRef, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence, useReducedMotion, type Variants } from 'motion/react';
import { signInAction, type AuthState } from '@/app/actions/auth';

// ─── Font Configuration (Adjust font sizes directly here) ─────────────────────
export const FONT_CONFIG = {
  // Font size for "Email", "Password" labels — matches SignUpForm FONT_CONFIG
  inputLabelSize: 'text-[12px] sm:text-[13px]',
};

function resolveFontSize(value?: string) {
  if (!value) return { className: '', style: undefined };
  if (value.startsWith('text-')) {
    return { className: value, style: undefined };
  }
  return { className: '', style: { fontSize: value } };
}

// ─── Icons ────────────────────────────────────────────────────────────────────

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

function FieldError({ message, variant }: { message?: string; variant: 'dark' | 'neumorphic' }) {
  if (!message) return null;
  return (
    <motion.p
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`mt-1 text-[11px] flex items-center gap-1 ${
        variant === 'neumorphic' ? 'text-red-600 font-medium' : 'text-red-400'
      }`}
      role="alert"
    >
      <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3 flex-shrink-0">
        <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm-.75 4a.75.75 0 0 1 1.5 0v3a.75.75 0 0 1-1.5 0V5zm.75 6.5a.875.875 0 1 1 0-1.75.875.875 0 0 1 0 1.75z" />
      </svg>
      {message}
    </motion.p>
  );
}

// ─── Style helpers ────────────────────────────────────────────────────────────

function getInputClass(variant: 'dark' | 'neumorphic', hasError: boolean, withIcon = false) {
  if (variant === 'neumorphic') {
    return `neu-input font-lora w-full h-10 sm:h-[42px] rounded-[11px] px-4.5 ${
      withIcon ? 'pr-11 sm:pr-12 ' : ''
    }text-sm text-[#34150F] transition-all duration-200 ${hasError ? 'neu-input-error' : ''}`;
  }
  return `w-full bg-[#110a06] border ${
    hasError ? 'border-red-500/60' : 'border-[#3c2a1c]'
  } rounded-lg px-4 py-2.5 ${
    withIcon ? 'pr-10 ' : ''
  }text-sm text-[#ded7cb] placeholder:text-[#5c4a3a] hover:border-[#5c4a3a] focus:outline-none focus:border-[#c59341]/60 focus:ring-1 focus:ring-[#c59341]/20 transition-all duration-200`;
}

function getLabelClass(variant: 'dark' | 'neumorphic', sizeClass: string) {
  if (variant === 'neumorphic') {
    return `block font-lora ${sizeClass} font-medium text-[#5A4537] mb-1.5 pl-0.5 select-none`;
  }
  return `block font-lora ${sizeClass} font-semibold tracking-[0.15em] uppercase text-[#a89a8c] mb-1.5`;
}

// ─── Animation Variants ───────────────────────────────────────────────────────

const containerVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 18,
    scale: 0.985,
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.55,
      ease: [0.22, 1, 0.36, 1],
      staggerChildren: 0.05,
      delayChildren: 0.06,
    },
  },
};

const itemVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 12,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.45,
      ease: [0.22, 1, 0.36, 1],
    },
  },
};

const reducedContainerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.25 },
  },
};

const reducedItemVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.2 },
  },
};

// ─── Component ────────────────────────────────────────────────────────────────

const initialState: AuthState = null;

export interface SignInFormProps {
  /** Visual theme: 'dark' (modal/forgot-password pages) or 'neumorphic' (login page / landing modal) */
  variant?: 'dark' | 'neumorphic';
  /** Called when the modal should close (modal usage only) */
  onClose?: () => void;
  /** Called to switch to sign-up flow (modal usage only) */
  onSwitchToSignUp?: () => void;
  /** Called to switch to forgot-password flow (modal usage only) */
  onSwitchToForgotPassword?: () => void;
  /** Optional redirect URL after login */
  redirectTo?: string;
  /** Whether to show the bottom "Don't have an account? Sign up" link */
  showSignUpLink?: boolean;
  /** Optionally override font size for labels (e.g. 'text-sm', '14px') */
  labelFontSize?: string;
}

export function SignInForm({
  variant = 'neumorphic',
  onClose,
  onSwitchToSignUp,
  onSwitchToForgotPassword,
  redirectTo,
  showSignUpLink = false,
  labelFontSize,
}: SignInFormProps) {
  const [state, formAction, isPending] = useActionState(signInAction, initialState);
  const [showPassword, setShowPassword] = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);
  const prefersReducedMotion = useReducedMotion();

  const isNeumorphic = variant === 'neumorphic';
  const currentContainerVariants = prefersReducedMotion ? reducedContainerVariants : containerVariants;
  const currentItemVariants = prefersReducedMotion ? reducedItemVariants : itemVariants;

  const inputLabelSizeObj = resolveFontSize(labelFontSize || FONT_CONFIG.inputLabelSize);
  const labelClass = getLabelClass(variant, inputLabelSizeObj.className);

  return (
    <form action={formAction} noValidate>
      {redirectTo && <input type="hidden" name="redirectTo" value={redirectTo} />}

      <motion.div
        variants={currentContainerVariants}
        initial="hidden"
        animate="visible"
        className="space-y-3.5 sm:space-y-4"
      >
        {/* Global error */}
        {state?.error && !state.field && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className={`px-3.5 py-2.5 rounded-lg flex items-start gap-2 text-xs sm:text-sm ${
              isNeumorphic
                ? 'bg-red-50 border border-red-200 text-red-700'
                : 'bg-red-500/10 border border-red-500/30 text-red-400'
            }`}
            role="alert"
          >
            <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4 flex-shrink-0 mt-0.5">
              <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm-.75 4a.75.75 0 0 1 1.5 0v3a.75.75 0 0 1-1.5 0V5zm.75 6.5a.875.875 0 1 1 0-1.75.875.875 0 0 1 0 1.75z" />
            </svg>
            {state.error}
          </motion.div>
        )}

        {/* Email */}
        <motion.div variants={currentItemVariants}>
          <label htmlFor="email_signin" className={labelClass} style={inputLabelSizeObj.style}>
            {isNeumorphic ? 'Email:' : 'Email Address'}
          </label>
          <input
            id="email_signin"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            required
            className={getInputClass(variant, state?.field === 'email')}
          />
          <FieldError message={state?.field === 'email' ? state.error : undefined} variant={variant} />
        </motion.div>

        {/* Password */}
        <motion.div variants={currentItemVariants}>
          <label htmlFor="password_signin" className={labelClass} style={inputLabelSizeObj.style}>
            {isNeumorphic ? 'Password:' : 'Password'}
          </label>
          <div className="relative">
            <input
              id="password_signin"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="••••••••"
              required
              ref={passwordRef}
              className={getInputClass(variant, state?.field === 'password', true)}
            />
            <motion.button
              type="button"
              onClick={() => setShowPassword(v => !v)}
              whileHover={prefersReducedMotion ? undefined : { scale: 1.15 }}
              whileTap={prefersReducedMotion ? undefined : { scale: 0.88 }}
              transition={{ type: 'spring', stiffness: 500, damping: 22 }}
              className={
                isNeumorphic
                  ? 'absolute right-3.5 top-1/2 -translate-y-1/2 text-[#7A604D] hover:text-[#34150F] transition-colors p-1 rounded-md focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#B9833C]/60 cursor-pointer'
                  : 'absolute right-3 top-1/2 -translate-y-1/2 text-[#6b5c4c] hover:text-[#c59341] transition-colors p-1 rounded-md focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#c59341]/60 cursor-pointer'
              }
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={showPassword ? 'open' : 'closed'}
                  initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.12 }}
                  className="block"
                >
                  <EyeIcon open={showPassword} />
                </motion.span>
              </AnimatePresence>
            </motion.button>
          </div>

          {/* Bottom row under password: Error on the left, "Forgot Password?" on bottom right */}
          <div className="flex items-start justify-between gap-2 mt-1.5 min-h-[18px]">
            <div className="flex-1">
              <FieldError message={state?.field === 'password' ? state.error : undefined} variant={variant} />
            </div>
            <div className="flex-shrink-0 ml-auto">
              {onSwitchToForgotPassword ? (
                <button
                  type="button"
                  onClick={onSwitchToForgotPassword}
                  className={
                    isNeumorphic
                      ? 'text-[11px] sm:text-xs font-inter text-[#7A604D] hover:text-[#99431E] hover:underline transition-colors cursor-pointer select-none'
                      : 'text-[11px] text-[#c59341] hover:text-[#d6a54f] hover:underline transition-colors cursor-pointer'
                  }
                >
                  Forgot Password?
                </button>
              ) : (
                <Link
                  href="/forgot-password"
                  onClick={onClose}
                  className={
                    isNeumorphic
                      ? 'text-[11px] sm:text-xs font-inter text-[#7A604D] hover:text-[#99431E] hover:underline transition-colors cursor-pointer select-none'
                      : 'text-[11px] text-[#c59341] hover:text-[#d6a54f] hover:underline transition-colors cursor-pointer'
                  }
                >
                  Forgot Password?
                </Link>
              )}
            </div>
          </div>
        </motion.div>

        {/* Submit */}
        <motion.div variants={currentItemVariants} className={isNeumorphic ? 'flex justify-center pt-2 sm:pt-3' : ''}>
          <motion.button
            type="submit"
            id="signin-submit-btn"
            disabled={isPending}
            whileHover={prefersReducedMotion || isPending ? undefined : { scale: 1.02, y: -1 }}
            whileTap={prefersReducedMotion || isPending ? undefined : { scale: 0.98, y: 1 }}
            transition={{ type: 'spring', stiffness: 500, damping: 25 }}
            className={
              isNeumorphic
                ? 'neu-btn-create w-[230px] sm:w-[250px] text-xs sm:text-sm font-semibold tracking-[0.16em] uppercase py-3 sm:py-3.5 px-6 rounded-[14px] active:translate-y-0.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B9833C]/60'
                : 'w-full font-cinzel text-xs font-bold tracking-[0.2em] uppercase bg-[#c59341] hover:bg-[#d6a54f] disabled:opacity-50 disabled:cursor-not-allowed text-[#0c0805] py-3 rounded-lg transition-all duration-200 shadow-lg shadow-[#c59341]/20 hover:shadow-[#c59341]/30 hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c59341]/60'
            }
          >
            <AnimatePresence mode="wait">
              {isPending ? (
                <motion.span
                  key="pending"
                  initial={{ opacity: 0, y: 2 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -2 }}
                  transition={{ duration: 0.15 }}
                  className="flex items-center justify-center gap-2"
                >
                  <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.3" />
                    <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                  Signing in…
                </motion.span>
              ) : (
                <motion.span
                  key="idle"
                  initial={{ opacity: 0, y: -2 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 2 }}
                  transition={{ duration: 0.15 }}
                >
                  {isNeumorphic ? 'SIGN IN' : 'Sign In'}
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        </motion.div>

        {/* Switch to sign up */}
        {(showSignUpLink || onSwitchToSignUp) && (
          <motion.div variants={currentItemVariants} className="text-center pt-2 sm:pt-3">
            <p className={`text-[11px] font-inter sm:text-xs ${isNeumorphic ? 'text-[#7A604D]' : 'text-[#7a6a5a]'}`}>
              Don&apos;t have an account?{' '}
              {onSwitchToSignUp ? (
                <button
                  type="button"
                  onClick={onSwitchToSignUp}
                  className={
                    isNeumorphic
                      ? 'text-[#99431E] hover:text-[#34150F] font-semibold underline underline-offset-2 transition-colors cursor-pointer'
                      : 'text-[#c59341] hover:text-[#d6a54f] font-medium transition-colors hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#c59341]/60 rounded-sm'
                  }
                >
                  Sign up
                </button>
              ) : (
                <Link
                  href="/register"
                  onClick={onClose}
                  className={
                    isNeumorphic
                      ? 'text-[#99431E] hover:text-[#34150F] font-semibold underline underline-offset-2 transition-colors'
                      : 'text-[#c59341] hover:text-[#d6a54f] font-medium transition-colors hover:underline'
                  }
                >
                  Sign up
                </Link>
              )}
            </p>
          </motion.div>
        )}
      </motion.div>
    </form>
  );
}
