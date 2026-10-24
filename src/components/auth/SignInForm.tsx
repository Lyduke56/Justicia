'use client';

import React, { useActionState, useState } from 'react';
import Link from 'next/link';
import { signInAction, type AuthState } from '@/app/actions/auth';

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
    <p
      className={`mt-1.5 text-[11px] flex items-center gap-1 ${
        variant === 'neumorphic' ? 'text-red-600' : 'text-red-400'
      }`}
      role="alert"
    >
      <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3 flex-shrink-0">
        <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm-.75 4a.75.75 0 0 1 1.5 0v3a.75.75 0 0 1-1.5 0V5zm.75 6.5a.875.875 0 1 1 0-1.75.875.875 0 0 1 0 1.75z" />
      </svg>
      {message}
    </p>
  );
}

// ─── Styles per variant ───────────────────────────────────────────────────────

const styles = {
  dark: {
    label: 'block text-[11px] font-semibold tracking-[0.15em] uppercase text-[#a89a8c] mb-1.5',
    input: (hasError: boolean) =>
      `w-full bg-[#110a06] border ${hasError ? 'border-red-500/60' : 'border-[#3c2a1c]'} rounded-lg px-4 py-2.5 text-sm text-[#ded7cb] placeholder:text-[#5c4a3a] focus:outline-none focus:border-[#c59341]/60 focus:ring-1 focus:ring-[#c59341]/20 transition-all`,
    inputWithIcon: (hasError: boolean) =>
      `w-full bg-[#110a06] border ${hasError ? 'border-red-500/60' : 'border-[#3c2a1c]'} rounded-lg px-4 py-2.5 pr-10 text-sm text-[#ded7cb] placeholder:text-[#5c4a3a] focus:outline-none focus:border-[#c59341]/60 focus:ring-1 focus:ring-[#c59341]/20 transition-all`,
    eyeBtn: 'absolute right-3 top-1/2 -translate-y-1/2 text-[#6b5c4c] hover:text-[#c59341] transition-colors',
    forgotLink: 'text-[11px] text-[#c59341] hover:text-[#d6a54f] transition-colors',
    submitBtn: 'w-full font-cinzel text-xs font-bold tracking-[0.2em] uppercase bg-[#c59341] hover:bg-[#d6a54f] disabled:opacity-50 disabled:cursor-not-allowed text-[#0c0805] py-3 rounded-lg transition-all duration-200 shadow-lg shadow-[#c59341]/20 hover:shadow-[#c59341]/30 hover:-translate-y-0.5 active:translate-y-0',
    errorBox: 'px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-start gap-2',
    signupLinkColor: 'text-[#c59341] hover:text-[#d6a54f] transition-colors font-medium',
  },
  neumorphic: {
    label: 'block text-xs font-medium text-[#6B5344] mb-1.5 pl-0.5 select-none',
    input: (hasError: boolean) =>
      `w-full bg-[#EACEAA] rounded-[14px] px-4 py-2.5 sm:py-3 text-sm text-[#34150F] placeholder:text-[#9e836f]/60 focus:outline-none focus:ring-1 ${hasError ? 'ring-red-500/60' : 'focus:ring-[#D29D54]/70'} transition-all border-none`,
    inputWithIcon: (hasError: boolean) =>
      `w-full bg-[#EACEAA] rounded-[14px] px-4 py-2.5 sm:py-3 pr-11 text-sm text-[#34150F] placeholder:text-[#9e836f]/60 focus:outline-none focus:ring-1 ${hasError ? 'ring-red-500/60' : 'focus:ring-[#D29D54]/70'} transition-all border-none`,
    eyeBtn: 'absolute right-3.5 top-1/2 -translate-y-1/2 text-[#7A604D] hover:text-[#34150F] transition-colors p-1',
    forgotLink: 'text-[11px] text-[#7A604D] hover:text-[#99431E] transition-colors',
    submitBtn: 'w-[210px] sm:w-[220px] bg-[#34150F] hover:bg-[#250e0a] text-[#FAF6F0] text-xs sm:text-sm font-semibold tracking-[0.16em] uppercase py-3 px-6 rounded-[14px] shadow-[0_6px_16px_rgba(52,21,15,0.35)] hover:shadow-[0_8px_20px_rgba(52,21,15,0.45)] transition-all duration-200 active:translate-y-0.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed',
    errorBox: 'px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-600 text-sm flex items-start gap-2',
    signupLinkColor: 'text-[#99431E] hover:text-[#34150F] font-semibold underline underline-offset-2 transition-colors',
  },
} as const;

// ─── Neumorphic input box-shadow inline style ─────────────────────────────────
const neumorphicInputStyle = {
  boxShadow: 'inset 3px 3px 6px rgba(125, 90, 55, 0.28), inset -3px -3px 6px rgba(255, 255, 255, 0.88)',
};

// ─── Component ────────────────────────────────────────────────────────────────

const initialState: AuthState = null;

export interface SignInFormProps {
  /** Visual theme: 'dark' (modal/forgot-password pages) or 'neumorphic' (login page) */
  variant?: 'dark' | 'neumorphic';
  /** Called when the modal should close (modal usage only) */
  onClose?: () => void;
  /** Called to switch to sign-up flow (modal usage only) */
  onSwitchToSignUp?: () => void;
}

export function SignInForm({ variant = 'dark', onClose, onSwitchToSignUp }: SignInFormProps) {
  const [state, formAction, isPending] = useActionState(signInAction, initialState);
  const [showPassword, setShowPassword] = useState(false);

  const s = styles[variant];
  const isNeumorphic = variant === 'neumorphic';

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {/* Global error */}
      {state?.error && !state.field && (
        <div className={s.errorBox} role="alert">
          <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4 flex-shrink-0 mt-0.5">
            <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm-.75 4a.75.75 0 0 1 1.5 0v3a.75.75 0 0 1-1.5 0V5zm.75 6.5a.875.875 0 1 1 0-1.75.875.875 0 0 1 0 1.75z" />
          </svg>
          {state.error}
        </div>
      )}

      {/* Email */}
      <div>
        <label htmlFor="email_signin" className={s.label}>
          {isNeumorphic ? 'Email:' : 'Email Address'}
        </label>
        <input
          id="email_signin"
          name="email"
          type="email"
          autoComplete="email"
          placeholder={isNeumorphic ? 'sample@gmail.com' : 'you@example.com'}
          required
          className={s.input(state?.field === 'email')}
          style={isNeumorphic ? neumorphicInputStyle : undefined}
        />
        <FieldError message={state?.field === 'email' ? state.error : undefined} variant={variant} />
      </div>

      {/* Password */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label htmlFor="password_signin" className={s.label.replace('mb-1.5', '')}>
            Password{isNeumorphic ? ':' : ''}
          </label>
          <Link
            href="/forgot-password"
            onClick={onClose}
            className={s.forgotLink}
          >
            Forgot password?
          </Link>
        </div>
        <div className="relative">
          <input
            id="password_signin"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            placeholder="••••••••"
            required
            className={s.inputWithIcon(state?.field === 'password')}
            style={isNeumorphic ? neumorphicInputStyle : undefined}
          />
          <button
            type="button"
            onClick={() => setShowPassword(v => !v)}
            className={s.eyeBtn}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            <EyeIcon open={showPassword} />
          </button>
        </div>
        <FieldError message={state?.field === 'password' ? state.error : undefined} variant={variant} />
      </div>

      {/* Submit */}
      <div className={isNeumorphic ? 'flex justify-center pt-2' : ''}>
        <button
          type="submit"
          id="signin-submit-btn"
          disabled={isPending}
          className={s.submitBtn}
        >
          {isPending ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.3" />
                <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
              Signing in…
            </span>
          ) : (
            isNeumorphic ? 'SIGN IN' : 'Sign In'
          )}
        </button>
      </div>

      {/* Demo links for quick portal evaluation */}
      {isNeumorphic ? (
        <div className="pt-2 flex flex-col items-center gap-1.5 text-center">
          <Link
            href="/client/dashboard?demo=true"
            id="demo-client-bypass-btn"
            className="inline-flex items-center gap-1.5 text-xs text-[#99431E] hover:text-[#34150F] font-semibold transition-colors"
          >
            <span>Explore Client Portal as Clyde (Demo)</span>
            <span>→</span>
          </Link>
          <Link
            href="/lawyer/dashboard?demo=lawyer"
            id="demo-lawyer-bypass-btn"
            className="inline-flex items-center gap-1.5 text-xs text-[#8A5A1E] hover:text-[#34150F] font-semibold transition-colors"
          >
            <span>Explore Lawyer Portal as Atty. Santos (Demo)</span>
            <span>→</span>
          </Link>
        </div>
      ) : (
        <div className="pt-2 flex flex-col items-center gap-1 text-center">
          <Link
            href="/client/dashboard?demo=true"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 text-[11px] text-[#C58B3C] hover:text-[#FAF6F0] font-medium transition-colors"
          >
            <span>Client Portal Demo (Clyde) →</span>
          </Link>
          <Link
            href="/lawyer/dashboard?demo=lawyer"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 text-[11px] text-[#D29D54] hover:text-[#FAF6F0] font-medium transition-colors"
          >
            <span>Lawyer Portal Demo (Atty. Santos) →</span>
          </Link>
        </div>
      )}

      {/* Sign up link */}
      {!isNeumorphic && (
        <p className="text-center text-[11px] text-[#7a6a5a]">
          Don&apos;t have an account?{' '}
          {onSwitchToSignUp ? (
            <button
              type="button"
              onClick={onSwitchToSignUp}
              className={s.signupLinkColor}
            >
              Sign up free
            </button>
          ) : (
            <Link href="/register" onClick={onClose} className={s.signupLinkColor}>
              Sign up free
            </Link>
          )}
        </p>
      )}
    </form>
  );
}
