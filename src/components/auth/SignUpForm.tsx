'use client';

import React, { useActionState, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { signUpAction, type AuthState } from '@/app/actions/auth';
import { ScalesLogo } from '@/components/landing/LawIcons';

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

export function SignUpForm() {
  const [state, formAction, isPending] = useActionState(signUpAction, initialState);
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<'client' | 'lawyer'>('client');
  const [passwordStrength, setPasswordStrength] = useState(0);
  const passwordRef = useRef<HTMLInputElement>(null);

  function calcStrength(pw: string): number {
    let score = 0;
    if (pw.length >= 8) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^a-zA-Z0-9]/.test(pw)) score++;
    return score;
  }

  const strengthColors = ['#ef4444', '#f97316', '#eab308', '#22c55e'];
  const strengthLabels = ['Weak', 'Fair', 'Good', 'Strong'];

  return (
    <form
      action={formAction}
      className="space-y-5"
      noValidate
    >
      {/* Global error */}
      {state?.error && !state.field && (
        <div className="px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-start gap-2" role="alert">
          <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4 flex-shrink-0 mt-0.5">
            <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm-.75 4a.75.75 0 0 1 1.5 0v3a.75.75 0 0 1-1.5 0V5zm.75 6.5a.875.875 0 1 1 0-1.75.875.875 0 0 1 0 1.75z" />
          </svg>
          {state.error}
        </div>
      )}

      {/* Full name */}
      <div>
        <label htmlFor="full_name" className="block text-[11px] font-semibold tracking-[0.15em] uppercase text-[#a89a8c] mb-1.5">
          Full Name
        </label>
        <input
          id="full_name"
          name="full_name"
          type="text"
          autoComplete="name"
          placeholder="e.g. Juan dela Cruz"
          required
          className={`w-full bg-[#110a06] border ${state?.field === 'full_name' ? 'border-red-500/60' : 'border-[#3c2a1c]'} rounded-lg px-4 py-2.5 text-sm text-[#ded7cb] placeholder:text-[#5c4a3a] focus:outline-none focus:border-[#c59341]/60 focus:ring-1 focus:ring-[#c59341]/20 transition-all`}
        />
        <FieldError message={state?.field === 'full_name' ? state.error : undefined} />
      </div>

      {/* Email */}
      <div>
        <label htmlFor="email_signup" className="block text-[11px] font-semibold tracking-[0.15em] uppercase text-[#a89a8c] mb-1.5">
          Email Address
        </label>
        <input
          id="email_signup"
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
        <label htmlFor="password_signup" className="block text-[11px] font-semibold tracking-[0.15em] uppercase text-[#a89a8c] mb-1.5">
          Password
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
            onChange={e => setPasswordStrength(calcStrength(e.target.value))}
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
        {/* Strength bar */}
        {passwordRef.current?.value && (
          <div className="mt-2">
            <div className="flex gap-1">
              {[0, 1, 2, 3].map(i => (
                <div
                  key={i}
                  className="h-1 flex-1 rounded-full transition-all duration-300"
                  style={{ background: i < passwordStrength ? strengthColors[passwordStrength - 1] : '#2a1e14' }}
                />
              ))}
            </div>
            {passwordStrength > 0 && (
              <p className="text-[10px] mt-1" style={{ color: strengthColors[passwordStrength - 1] }}>
                {strengthLabels[passwordStrength - 1]}
              </p>
            )}
          </div>
        )}
        <FieldError message={state?.field === 'password' ? state.error : undefined} />
      </div>

      {/* Role selector */}
      <div>
        <p className="block text-[11px] font-semibold tracking-[0.15em] uppercase text-[#a89a8c] mb-2">
          I am joining as a…
        </p>
        <input type="hidden" name="role" value={role} />
        <div className="grid grid-cols-2 gap-2.5">
          {(['client', 'lawyer'] as const).map(r => (
            <button
              key={r}
              type="button"
              onClick={() => setRole(r)}
              className={`relative rounded-lg border py-3 px-3 text-left transition-all ${
                role === r
                  ? 'border-[#c59341]/70 bg-[#c59341]/10 shadow-[0_0_12px_rgba(197,147,65,0.15)]'
                  : 'border-[#3c2a1c] bg-[#110a06] hover:border-[#c59341]/30'
              }`}
            >
              <div className="font-cinzel text-xs font-bold tracking-[0.12em] uppercase text-[#ded7cb]">
                {r === 'client' ? '⚖ Client' : '📜 Lawyer'}
              </div>
              <div className="text-[10px] text-[#7a6a5a] mt-0.5">
                {r === 'client' ? 'Seek legal guidance' : 'Provide legal services'}
              </div>
              {role === r && (
                <span className="absolute top-2 right-2 w-4 h-4 rounded-full bg-[#c59341] flex items-center justify-center">
                  <svg viewBox="0 0 12 12" fill="none" className="w-2.5 h-2.5">
                    <path d="M2 6l3 3 5-5" stroke="#0c0805" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              )}
            </button>
          ))}
        </div>
        {role === 'lawyer' && (
          <p className="mt-2 text-[10px] text-[#7a6a5a]">
            * Lawyer accounts require IBP verification before full access is granted.
          </p>
        )}
      </div>

      {/* Terms */}
      <div className="flex items-start gap-2.5">
        <input
          id="terms"
          type="checkbox"
          required
          className="mt-0.5 accent-[#c59341] w-3.5 h-3.5 rounded cursor-pointer"
        />
        <label htmlFor="terms" className="text-[11px] text-[#7a6a5a] leading-relaxed cursor-pointer">
          I agree to Justicia&apos;s{' '}
          <Link href="/terms" className="text-[#c59341] hover:underline">Terms of Service</Link>{' '}
          and{' '}
          <Link href="/privacy" className="text-[#c59341] hover:underline">Privacy Policy</Link>.
        </label>
      </div>

      {/* Submit */}
      <button
        type="submit"
        id="signup-submit-btn"
        disabled={isPending}
        className="w-full font-cinzel text-xs font-bold tracking-[0.2em] uppercase bg-[#c59341] hover:bg-[#d6a54f] disabled:opacity-50 disabled:cursor-not-allowed text-[#0c0805] py-3 rounded-lg transition-all duration-200 shadow-lg shadow-[#c59341]/20 hover:shadow-[#c59341]/30 hover:-translate-y-0.5 active:translate-y-0"
      >
        {isPending ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.3" />
              <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            </svg>
            Creating account…
          </span>
        ) : (
          'Create Account'
        )}
      </button>
    </form>
  );
}
