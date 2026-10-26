'use client';

import React, { useActionState } from 'react';
import { forgotPasswordAction, type AuthState } from '@/app/actions/auth';

import Link from 'next/link';

const initialState: AuthState = null;

export interface ForgotPasswordFormProps {
  onClose?: () => void;
  onSwitchToSignIn?: () => void;
}

export function ForgotPasswordForm({ onClose, onSwitchToSignIn }: ForgotPasswordFormProps) {
  const [state, formAction, isPending] = useActionState(forgotPasswordAction, initialState);

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {/* Success state */}
      {state?.success && (
        <div className="px-4 py-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm flex items-start gap-3" role="status">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5 flex-shrink-0 mt-0.5">
            <path d="M9 12l2 2 4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div>
            <p className="font-semibold text-emerald-300 mb-0.5">Email sent!</p>
            <p className="text-[12px] leading-relaxed opacity-90">{state.success}</p>
          </div>
        </div>
      )}

      {/* Global error */}
      {state?.error && !state.field && (
        <div className="px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-start gap-2" role="alert">
          <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4 flex-shrink-0 mt-0.5">
            <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm-.75 4a.75.75 0 0 1 1.5 0v3a.75.75 0 0 1-1.5 0V5zm.75 6.5a.875.875 0 1 1 0-1.75.875.875 0 0 1 0 1.75z" />
          </svg>
          {state.error}
        </div>
      )}

      {/* Email field — hide after success */}
      {!state?.success && (
        <div>
          <label htmlFor="email_forgot" className="block text-[11px] font-semibold tracking-[0.15em] uppercase text-[#a89a8c] mb-1.5">
            Email Address
          </label>
          <input
            id="email_forgot"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            required
            className={`w-full bg-[#110a06] border ${state?.field === 'email' ? 'border-red-500/60' : 'border-[#3c2a1c]'} rounded-lg px-4 py-2.5 text-sm text-[#ded7cb] placeholder:text-[#5c4a3a] focus:outline-none focus:border-[#c59341]/60 focus:ring-1 focus:ring-[#c59341]/20 transition-all`}
          />
          {state?.field === 'email' && state.error && (
            <p className="mt-1.5 text-[11px] text-red-400 flex items-center gap-1" role="alert">
              <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4 flex-shrink-0">
                <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm-.75 4a.75.75 0 0 1 1.5 0v3a.75.75 0 0 1-1.5 0V5zm.75 6.5a.875.875 0 1 1 0-1.75.875.875 0 0 1 0 1.75z" />
              </svg>
              {state.error}
            </p>
          )}
        </div>
      )}

      {/* Submit */}
      {!state?.success && (
        <button
          type="submit"
          id="forgot-password-submit-btn"
          disabled={isPending}
          className="w-full font-cinzel text-xs font-bold tracking-[0.2em] uppercase bg-[#c59341] hover:bg-[#d6a54f] disabled:opacity-50 disabled:cursor-not-allowed text-[#0c0805] py-3 rounded-lg transition-all duration-200 shadow-lg shadow-[#c59341]/20 hover:shadow-[#c59341]/30 hover:-translate-y-0.5 active:translate-y-0"
        >
          {isPending ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.3" />
                <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
              Sending link…
            </span>
          ) : (
            'Send Reset Link'
          )}
        </button>
      )}

      {/* Back to sign in */}
      <div className="text-center pt-1">
        {onSwitchToSignIn ? (
          <button
            type="button"
            onClick={onSwitchToSignIn}
            className="text-[11px] text-[#c59341] hover:text-[#d6a54f] transition-colors font-medium"
          >
            ← Back to Sign In
          </button>
        ) : (
          <p className="text-[11px] text-[#7a6a5a]">
            Remember your password?{' '}
            <Link href="/login" onClick={onClose} className="text-[#c59341] hover:text-[#d6a54f] transition-colors font-medium">
              Sign in
            </Link>
          </p>
        )}
      </div>
    </form>
  );
}
