'use client';

import React, { useActionState, useRef, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence, useReducedMotion, type Variants } from 'motion/react';
import { signUpAction, type AuthState } from '@/app/actions/auth';

// ─── Font Configuration (Adjust font sizes directly here) ─────────────────────
/**
 * Quick font-size controls for SignUpForm labels.
 * You can change these values to any Tailwind size class (e.g. 'text-xs', 'text-sm', 'text-base')
 * or a specific CSS measurement (e.g. '13px', '14px', '0.85rem').
 * You can also override them per-instance via `labelFontSize` and `roleLabelFontSize` props.
 */
export const FONT_CONFIG = {
  // Font size for "Full Name", "Email", "Password" labels
  inputLabelSize: 'text-[12px] sm:text-[13px]',

  // Font size for "CLIENT" and "LAWYER" role button labels
  roleLabelSize: 'text-xs sm:text-[13px]',
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
      className={`mt-1 text-[11px] flex items-center gap-1 ${variant === 'neumorphic' ? 'text-red-600 font-medium' : 'text-red-400'
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

// ─── Style maps ───────────────────────────────────────────────────────────────

function getInputClass(variant: 'dark' | 'neumorphic', hasError: boolean, withIcon = false) {
  if (variant === 'neumorphic') {
    return `neu-input font-lora w-full h-10 sm:h-[42px] rounded-[11px] px-4.5 ${withIcon ? 'pr-11 sm:pr-12 ' : ''
      }text-sm text-[#34150F] transition-all duration-200 ${hasError ? 'neu-input-error' : ''}`;
  }
  return `w-full bg-[#110a06] border ${hasError ? 'border-red-500/60' : 'border-[#3c2a1c]'
    } rounded-lg px-4 py-2.5 ${withIcon ? 'pr-10 ' : ''
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

export interface SignUpFormProps {
  variant?: 'dark' | 'neumorphic';
  onClose?: () => void;
  onSwitchToSignIn?: () => void;
  inModal?: boolean;
  /** Optionally override font size for Full Name, Email, Password labels (e.g. 'text-sm', '14px') */
  labelFontSize?: string;
  /** Optionally override font size for CLIENT and LAWYER role buttons (e.g. 'text-sm', '14px') */
  roleLabelFontSize?: string;
}

export function SignUpForm({
  variant = 'neumorphic',
  onClose,
  onSwitchToSignIn,
  inModal = false,
  labelFontSize,
  roleLabelFontSize,
}: SignUpFormProps) {
  // If in modal and variant not explicitly specified, default to dark modal style
  const effectiveVariant = inModal && variant === 'neumorphic' ? 'dark' : variant;
  const [state, formAction, isPending] = useActionState(signUpAction, initialState);
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<'client' | 'lawyer'>('client');
  const [passwordValue, setPasswordValue] = useState('');
  const passwordRef = useRef<HTMLInputElement>(null);
  const prefersReducedMotion = useReducedMotion();

  const isNeumorphic = effectiveVariant === 'neumorphic';
  const currentContainerVariants = prefersReducedMotion ? reducedContainerVariants : containerVariants;
  const currentItemVariants = prefersReducedMotion ? reducedItemVariants : itemVariants;

  // Resolved font size objects (className + inline style if custom px)
  const inputLabelSizeObj = resolveFontSize(labelFontSize || FONT_CONFIG.inputLabelSize);
  const roleLabelSizeObj = resolveFontSize(roleLabelFontSize || FONT_CONFIG.roleLabelSize);
  const labelClass = getLabelClass(effectiveVariant, inputLabelSizeObj.className);

  function calcStrength(pw: string): number {
    let score = 0;
    if (pw.length >= 8) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^a-zA-Z0-9]/.test(pw)) score++;
    return score;
  }

  const passwordStrength = calcStrength(passwordValue);
  const strengthColors = ['#ef4444', '#f97316', '#eab308', '#22c55e'];
  const strengthLabels = ['Weak', 'Fair', 'Good', 'Strong'];

  return (
    <form action={formAction} noValidate>
      <motion.div
        variants={currentContainerVariants}
        initial="hidden"
        animate="visible"
        className="space-y-3 sm:space-y-3.5"
      >
        {/* Global error */}
        {state?.error && !state.field && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className={`px-3.5 py-2.5 rounded-lg flex items-start gap-2 text-xs sm:text-sm ${isNeumorphic
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

        {/* Full Name */}
        <motion.div variants={currentItemVariants}>
          <label htmlFor="full_name" className={labelClass} style={inputLabelSizeObj.style}>
            {isNeumorphic ? 'Full Name:' : 'Full Name'}
          </label>
          <input
            id="full_name"
            name="full_name"
            type="text"
            autoComplete="name"
            placeholder="e.g. Juan dela Cruz"
            required
            className={getInputClass(effectiveVariant, state?.field === 'full_name')}
          />
          <FieldError message={state?.field === 'full_name' ? state.error : undefined} variant={effectiveVariant} />
        </motion.div>

        {/* Email */}
        <motion.div variants={currentItemVariants}>
          <label htmlFor="email_signup" className={labelClass} style={inputLabelSizeObj.style}>
            {isNeumorphic ? 'Email:' : 'Email Address'}
          </label>
          <input
            id="email_signup"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            required
            className={getInputClass(effectiveVariant, state?.field === 'email')}
          />
          <FieldError message={state?.field === 'email' ? state.error : undefined} variant={effectiveVariant} />
        </motion.div>

        {/* Password */}
        <motion.div variants={currentItemVariants}>
          <label htmlFor="password_signup" className={labelClass} style={inputLabelSizeObj.style}>
            {isNeumorphic ? 'Password:' : 'Password'}
          </label>
          <div className="relative">
            <input
              id="password_signup"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="Min. 8 characters"
              required
              ref={passwordRef}
              onChange={e => setPasswordValue(e.target.value)}
              className={getInputClass(effectiveVariant, state?.field === 'password', true)}
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

          {/* Strength bar — only shown when typing */}
          {passwordValue && (
            <div className="mt-1.5">
              <div className="flex gap-1">
                {[0, 1, 2, 3].map(i => (
                  <div
                    key={i}
                    className="h-1 flex-1 rounded-full transition-all duration-300"
                    style={{
                      background: i < passwordStrength
                        ? strengthColors[passwordStrength - 1]
                        : isNeumorphic ? '#cfbfad' : '#2a1e14',
                    }}
                  />
                ))}
              </div>
              {passwordStrength > 0 && (
                <motion.p
                  key={strengthLabels[passwordStrength - 1]}
                  initial={{ opacity: 0, y: -2 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18 }}
                  className="text-[10px] mt-0.5 font-medium"
                  style={{ color: strengthColors[passwordStrength - 1] }}
                >
                  {strengthLabels[passwordStrength - 1]}
                </motion.p>
              )}
            </div>
          )}
          <FieldError message={state?.field === 'password' ? state.error : undefined} variant={effectiveVariant} />
        </motion.div>

        {/* Divider with generous padding */}
        <motion.div variants={currentItemVariants} className="pt-3 sm:pt-4 pb-1">
          <div
            role="separator"
            className={`h-[5px] rounded-full w-full ${isNeumorphic
              ? 'bg-orange-950/10'
              : 'bg-[#3c2a1c]'
              }`}
          />
        </motion.div>

        {/* Role selector with increased top padding and clear separation */}
        <motion.div variants={currentItemVariants} className="pt-2 sm:pt-2.5">
          <p className={`${labelClass} text-center mb-3 sm:mb-3.5`} style={inputLabelSizeObj.style}>
            I&apos;m joining as a…
          </p>
          <input type="hidden" name="role" value={role} />
          <div className="grid grid-cols-2 gap-5 sm:gap-6 px-1 py-2">
            {(['client', 'lawyer'] as const).map(r => (
              <motion.button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                aria-pressed={role === r}
                whileHover={prefersReducedMotion ? undefined : { y: role === r ? 0 : -2, scale: 1.012 }}
                whileTap={prefersReducedMotion ? undefined : { scale: 0.985, y: role === r ? 0 : 1 }}
                transition={{ type: 'spring', stiffness: 450, damping: 25 }}
                className={`relative rounded-[13px] py-3.5 sm:py-4 px-4 sm:px-5 text-left transition-colors duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B9833C]/60 ${isNeumorphic
                  ? role === r
                    ? 'neu-pressed'
                    : 'neu-raised-sm'
                  : role === r
                    ? 'border border-[#c59341]/70 bg-[#c59341]/10 shadow-[0_0_12px_rgba(197,147,65,0.15)]'
                    : 'border border-[#3c2a1c] bg-[#110a06] hover:border-[#c59341]/30'
                  }`}
              >
                <div
                  className={`font-lora font-bold tracking-[0.08em] uppercase ${roleLabelSizeObj.className} ${isNeumorphic ? 'text-[#34150F]' : 'text-[#ded7cb]'
                    }`}
                  style={roleLabelSizeObj.style}
                >
                  {r === 'client' ? 'CLIENT' : 'LAWYER'}
                </div>
                <div className={`text-[10px] sm:text-[11px] mt-1 ${isNeumorphic ? 'text-[#7A604D]' : 'text-[#7a6a5a]'}`}>
                  {r === 'client' ? 'Seek legal guidance' : 'Provide legal services'}
                </div>
                <AnimatePresence>
                  {role === r && (
                    <motion.span
                      key={`badge-${r}`}
                      initial={prefersReducedMotion ? { opacity: 0 } : { scale: 0, rotate: -25, opacity: 0 }}
                      animate={{ scale: 1, rotate: 0, opacity: 1 }}
                      exit={{ scale: 0, opacity: 0 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                      className={`absolute top-3 right-3 w-4 h-4 rounded-full flex items-center justify-center ${isNeumorphic ? 'bg-[#B9833C]' : 'bg-[#c59341]'
                        }`}
                    >
                      <svg viewBox="0 0 12 12" fill="none" className="w-2.5 h-2.5">
                        <path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.button>
            ))}
          </div>
        </motion.div>

        {/* Terms */}
        <motion.div variants={currentItemVariants} className="flex items-center justify-start gap-2 pt-1.5 sm:pt-2">
          <input
            id="terms"
            type="checkbox"
            required
            className={`w-3.5 h-3.5 rounded cursor-pointer transition-transform duration-150 hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B9833C]/60 ${isNeumorphic ? 'accent-[#34150F]' : 'accent-[#c59341]'}`}
          />
          <label
            htmlFor="terms"
            className={`text-[11px] sm:text-xs leading-snug cursor-pointer select-none transition-colors duration-150 ${isNeumorphic ? 'text-[#7A604D] hover:text-[#5A4537]' : 'text-[#7a6a5a] hover:text-[#ded7cb]'}`}
          >
            I agree to Justicia&apos;s{' '}
            <Link
              href="/terms"
              className={isNeumorphic ? 'text-[#99431E] hover:text-[#34150F] font-medium hover:underline transition-colors' : 'text-[#c59341] hover:underline transition-colors'}
            >
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link
              href="/privacy"
              className={isNeumorphic ? 'text-[#99431E] hover:text-[#34150F] font-medium hover:underline transition-colors' : 'text-[#c59341] hover:underline transition-colors'}
            >
              Privacy Policy
            </Link>
            .
          </label>
        </motion.div>

        {/* Submit */}
        <motion.div variants={currentItemVariants} className={isNeumorphic ? 'flex justify-center pt-2 sm:pt-3' : ''}>
          <motion.button
            type="submit"
            id="signup-submit-btn"
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
                  Creating account…
                </motion.span>
              ) : (
                <motion.span
                  key="idle"
                  initial={{ opacity: 0, y: -2 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 2 }}
                  transition={{ duration: 0.15 }}
                >
                  {isNeumorphic ? 'CREATE ACCOUNT' : 'Create Account'}
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        </motion.div>

        {/* Switch to sign in for modal */}
        {onSwitchToSignIn && (
          <motion.div variants={currentItemVariants} className="text-center pt-1">
            <p className="text-[11px] text-[#7a6a5a]">
              Already have an account?{' '}
              <button
                type="button"
                onClick={onSwitchToSignIn}
                className="text-[#c59341] hover:text-[#d6a54f] font-medium transition-colors hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#c59341]/60 rounded-sm"
              >
                Sign In
              </button>
            </p>
          </motion.div>
        )}
      </motion.div>
    </form>
  );
}
