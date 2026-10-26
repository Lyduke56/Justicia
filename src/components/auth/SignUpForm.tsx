'use client';

import React, { useActionState, useRef, useState } from 'react';
import Link from 'next/link';
import { signUpAction, type AuthState } from '@/app/actions/auth';

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

// ─── Style maps ───────────────────────────────────────────────────────────────

const neumorphicInputStyle = {
  boxShadow: 'inset 3px 3px 6px rgba(125, 90, 55, 0.28), inset -3px -3px 6px rgba(255, 255, 255, 0.88)',
};

function getInputClass(variant: 'dark' | 'neumorphic', hasError: boolean, withIcon = false) {
  if (variant === 'neumorphic') {
    return `w-full bg-[#EACEAA] rounded-[14px] px-4 py-2.5 sm:py-3 ${withIcon ? 'pr-11 ' : ''}text-sm text-[#34150F] placeholder:text-[#9e836f]/60 focus:outline-none focus:ring-1 ${hasError ? 'ring-red-500/60' : 'focus:ring-[#D29D54]/70'} transition-all border-none`;
  }
  return `w-full bg-[#110a06] border ${hasError ? 'border-red-500/60' : 'border-[#3c2a1c]'} rounded-lg px-4 py-2.5 ${withIcon ? 'pr-10 ' : ''}text-sm text-[#ded7cb] placeholder:text-[#5c4a3a] focus:outline-none focus:border-[#c59341]/60 focus:ring-1 focus:ring-[#c59341]/20 transition-all`;
}

function getLabelClass(variant: 'dark' | 'neumorphic') {
  if (variant === 'neumorphic') return 'block text-xs font-medium text-[#6B5344] mb-1.5 pl-0.5 select-none';
  return 'block text-[11px] font-semibold tracking-[0.15em] uppercase text-[#a89a8c] mb-1.5';
}

// ─── Component ────────────────────────────────────────────────────────────────

const initialState: AuthState = null;

export interface SignUpFormProps {
  variant?: 'dark' | 'neumorphic';
  onClose?: () => void;
  onSwitchToSignIn?: () => void;
  inModal?: boolean;
}

export function SignUpForm({
  variant = 'dark',
  onClose,
  onSwitchToSignIn,
  inModal = false,
}: SignUpFormProps) {
  const [state, formAction, isPending] = useActionState(signUpAction, initialState);
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<'client' | 'lawyer'>('client');
  const [passwordValue, setPasswordValue] = useState('');
  const passwordRef = useRef<HTMLInputElement>(null);

  const isNeumorphic = variant === 'neumorphic';
  const labelClass = getLabelClass(variant);

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
    <form action={formAction} className="space-y-4 sm:space-y-5" noValidate>
      {/* Global error */}
      {state?.error && !state.field && (
        <div
          className={`px-4 py-3 rounded-lg flex items-start gap-2 text-sm ${
            isNeumorphic
              ? 'bg-red-100 border border-red-300 text-red-700'
              : 'bg-red-500/10 border border-red-500/30 text-red-400'
          }`}
          role="alert"
        >
          <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4 flex-shrink-0 mt-0.5">
            <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm-.75 4a.75.75 0 0 1 1.5 0v3a.75.75 0 0 1-1.5 0V5zm.75 6.5a.875.875 0 1 1 0-1.75.875.875 0 0 1 0 1.75z" />
          </svg>
          {state.error}
        </div>
      )}

      {/* Full Name */}
      <div>
        <label htmlFor="full_name" className={labelClass}>
          {isNeumorphic ? 'Full Name:' : 'Full Name'}
        </label>
        <input
          id="full_name"
          name="full_name"
          type="text"
          autoComplete="name"
          placeholder="e.g. Juan dela Cruz"
          required
          className={getInputClass(variant, state?.field === 'full_name')}
          style={isNeumorphic ? neumorphicInputStyle : undefined}
        />
        <FieldError message={state?.field === 'full_name' ? state.error : undefined} variant={variant} />
      </div>

      {/* Email */}
      <div>
        <label htmlFor="email_signup" className={labelClass}>
          {isNeumorphic ? 'Email:' : 'Email Address'}
        </label>
        <input
          id="email_signup"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          required
          className={getInputClass(variant, state?.field === 'email')}
          style={isNeumorphic ? neumorphicInputStyle : undefined}
        />
        <FieldError message={state?.field === 'email' ? state.error : undefined} variant={variant} />
      </div>

      {/* Password */}
      <div>
        <label htmlFor="password_signup" className={labelClass}>
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
            className={getInputClass(variant, state?.field === 'password', true)}
            style={isNeumorphic ? neumorphicInputStyle : undefined}
          />
          <button
            type="button"
            onClick={() => setShowPassword(v => !v)}
            className={
              isNeumorphic
                ? 'absolute right-3.5 top-1/2 -translate-y-1/2 text-[#7A604D] hover:text-[#34150F] transition-colors p-1'
                : 'absolute right-3 top-1/2 -translate-y-1/2 text-[#6b5c4c] hover:text-[#c59341] transition-colors'
            }
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            <EyeIcon open={showPassword} />
          </button>
        </div>

        {/* Strength bar — only shown when typing */}
        {passwordValue && (
          <div className="mt-2">
            <div className="flex gap-1">
              {[0, 1, 2, 3].map(i => (
                <div
                  key={i}
                  className="h-1 flex-1 rounded-full transition-all duration-300"
                  style={{
                    background: i < passwordStrength
                      ? strengthColors[passwordStrength - 1]
                      : isNeumorphic ? '#cbb396' : '#2a1e14',
                  }}
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
        <FieldError message={state?.field === 'password' ? state.error : undefined} variant={variant} />
      </div>

      {/* Role selector */}
      <div>
        <p className={labelClass}>I am joining as a…</p>
        <input type="hidden" name="role" value={role} />
        <div className="grid grid-cols-2 gap-2.5">
          {(['client', 'lawyer'] as const).map(r => (
            <button
              key={r}
              type="button"
              onClick={() => setRole(r)}
              className={`relative rounded-[14px] border py-3 px-3 text-left transition-all ${
                isNeumorphic
                  ? role === r
                    ? 'border-[#D29D54]/70 bg-[#D29D54]/10'
                    : 'border-[#cbb396]/60 bg-[#EACEAA] hover:border-[#D29D54]/40'
                  : role === r
                    ? 'border-[#c59341]/70 bg-[#c59341]/10 shadow-[0_0_12px_rgba(197,147,65,0.15)]'
                    : 'border-[#3c2a1c] bg-[#110a06] hover:border-[#c59341]/30'
              }`}
              style={isNeumorphic && role !== r ? neumorphicInputStyle : undefined}
            >
              <div
                className={`text-xs font-bold tracking-[0.12em] uppercase ${
                  isNeumorphic ? 'text-[#34150F]' : 'font-cinzel text-[#ded7cb]'
                }`}
              >
                {r === 'client' ? '⚖ Client' : '📜 Lawyer'}
              </div>
              <div className={`text-[10px] mt-0.5 ${isNeumorphic ? 'text-[#7A604D]' : 'text-[#7a6a5a]'}`}>
                {r === 'client' ? 'Seek legal guidance' : 'Provide legal services'}
              </div>
              {role === r && (
                <span
                  className={`absolute top-2 right-2 w-4 h-4 rounded-full flex items-center justify-center ${
                    isNeumorphic ? 'bg-[#D29D54]' : 'bg-[#c59341]'
                  }`}
                >
                  <svg viewBox="0 0 12 12" fill="none" className="w-2.5 h-2.5">
                    <path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              )}
            </button>
          ))}
        </div>
        {role === 'lawyer' && (
          <p className={`mt-2 text-[10px] ${isNeumorphic ? 'text-[#7A604D]' : 'text-[#7a6a5a]'}`}>
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
          className={`mt-0.5 w-3.5 h-3.5 rounded cursor-pointer ${isNeumorphic ? 'accent-[#D29D54]' : 'accent-[#c59341]'}`}
        />
        <label htmlFor="terms" className={`text-[11px] leading-relaxed cursor-pointer ${isNeumorphic ? 'text-[#7A604D]' : 'text-[#7a6a5a]'}`}>
          I agree to Justicia&apos;s{' '}
          <Link href="/terms" className={isNeumorphic ? 'text-[#99431E] hover:underline' : 'text-[#c59341] hover:underline'}>
            Terms of Service
          </Link>{' '}
          and{' '}
          <Link href="/privacy" className={isNeumorphic ? 'text-[#99431E] hover:underline' : 'text-[#c59341] hover:underline'}>
            Privacy Policy
          </Link>
          .
        </label>
      </div>

      {/* Submit */}
      <div className={isNeumorphic ? 'flex justify-center pt-2' : ''}>
        <button
          type="submit"
          id="signup-submit-btn"
          disabled={isPending}
          className={
            isNeumorphic
              ? 'w-[230px] sm:w-[240px] bg-[#34150F] hover:bg-[#250e0a] text-[#FAF6F0] text-xs sm:text-sm font-semibold tracking-[0.16em] uppercase py-3.5 px-6 rounded-[14px] shadow-[0_6px_16px_rgba(52,21,15,0.35)] hover:shadow-[0_8px_20px_rgba(52,21,15,0.45)] transition-all duration-200 active:translate-y-0.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed'
              : 'w-full font-cinzel text-xs font-bold tracking-[0.2em] uppercase bg-[#c59341] hover:bg-[#d6a54f] disabled:opacity-50 disabled:cursor-not-allowed text-[#0c0805] py-3 rounded-lg transition-all duration-200 shadow-lg shadow-[#c59341]/20 hover:shadow-[#c59341]/30 hover:-translate-y-0.5 active:translate-y-0'
          }
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
            isNeumorphic ? 'CREATE ACCOUNT' : 'Create Account'
          )}
        </button>
      </div>

      {/* Switch to sign in for modal */}
      {onSwitchToSignIn && (
        <div className="text-center pt-1">
          <p className="text-[11px] text-[#7a6a5a]">
            Already have an account?{' '}
            <button
              type="button"
              onClick={onSwitchToSignIn}
              className="text-[#c59341] hover:text-[#d6a54f] font-medium transition-colors"
            >
              Sign In
            </button>
          </p>
        </div>
      )}
    </form>
  );
}
