'use client';

import React, { useActionState, useState } from 'react';
import Link from 'next/link';
import { signInAction, type AuthState } from '@/app/actions/auth';

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

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="mt-1.5 text-[11px] text-red-400 flex items-center gap-1" role="alert">
      <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3 flex-shrink-0">
        <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm-.75 4a.75.75 0 0 1 1.5 0v3a.75.75 0 0 1-1.5 0V5zm.75 6.5a.875.875 0 1 1 0-1.75.875.875 0 0 1 0 1.75z" />
      </svg>
      {message}
    </p>
  );
}

const initialState: AuthState = null;

interface SignInFormProps {
  /** Called when the modal should close */
  onClose?: () => void;
  /** Called to switch to sign-up flow */
  onSwitchToSignUp?: () => void;
}

export function SignInForm({ onClose, onSwitchToSignUp }: SignInFormProps) {
  const [state, formAction, isPending] = useActionState(signInAction, initialState);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {/* Global error */}
      {state?.error && !state.field && (
        <div className="px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-start gap-2" role="alert">
          <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4 flex-shrink-0 mt-0.5">
            <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm-.75 4a.75.75 0 0 1 1.5 0v3a.75.75 0 0 1-1.5 0V5zm.75 6.5a.875.875 0 1 1 0-1.75.875.875 0 0 1 0 1.75z" />
          </svg>
          {state.error}
        </div>
      )}

      {/* Email */}
      <div>
        <label htmlFor="email_signin" className="block text-[11px] font-semibold tracking-[0.15em] uppercase text-[#a89a8c] mb-1.5">
          Email Address
        </label>
        <input
          id="email_signin"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          required
          className={`w-full bg-[#110a06] border ${state?.field === 'email' ? 'border-red-500/60' : 'border-[#3c2a1c]'} rounded-lg px-4 py-2.5 text-sm text-[#ded7cb] placeholder:text-[#5c4a3a] focus:outline-none focus:border-[#c59341]/60 focus:ring-1 focus:ring-[#c59341]/20 transition-all`}
        />
        <FieldError message={state?.field === 'email' ? state.error : undefined} />
      </div>

      {/* Password */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label htmlFor="password_signin" className="block text-[11px] font-semibold tracking-[0.15em] uppercase text-[#a89a8c]">
            Password
          </label>
          <Link
            href="/forgot-password"
            onClick={onClose}
            className="text-[11px] text-[#c59341] hover:text-[#d6a54f] transition-colors"
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
            placeholder="Enter your password"
            required
            className={`w-full bg-[#110a06] border ${state?.field === 'password' ? 'border-red-500/60' : 'border-[#3c2a1c]'} rounded-lg px-4 py-2.5 pr-10 text-sm text-[#ded7cb] placeholder:text-[#5c4a3a] focus:outline-none focus:border-[#c59341]/60 focus:ring-1 focus:ring-[#c59341]/20 transition-all`}
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
        <FieldError message={state?.field === 'password' ? state.error : undefined} />
      </div>

      {/* Submit */}
      <button
        type="submit"
        id="signin-submit-btn"
        disabled={isPending}
        className="w-full font-cinzel text-xs font-bold tracking-[0.2em] uppercase bg-[#c59341] hover:bg-[#d6a54f] disabled:opacity-50 disabled:cursor-not-allowed text-[#0c0805] py-3 rounded-lg transition-all duration-200 shadow-lg shadow-[#c59341]/20 hover:shadow-[#c59341]/30 hover:-translate-y-0.5 active:translate-y-0"
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
          'Sign In'
        )}
      </button>

      {/* Sign up link */}
      <p className="text-center text-[11px] text-[#7a6a5a]">
        Don&apos;t have an account?{' '}
        {onSwitchToSignUp ? (
          <button
            type="button"
            onClick={onSwitchToSignUp}
            className="text-[#c59341] hover:text-[#d6a54f] transition-colors font-medium"
          >
            Sign up free
          </button>
        ) : (
          <Link href="/register" onClick={onClose} className="text-[#c59341] hover:text-[#d6a54f] transition-colors font-medium">
            Sign up free
          </Link>
        )}
      </p>
    </form>
  );
}
