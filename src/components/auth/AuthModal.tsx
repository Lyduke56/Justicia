'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ScalesLogo } from '@/components/landing/LawIcons';
import { SignInForm } from './SignInForm';
import { SignUpForm } from './SignUpForm';
import { ForgotPasswordForm } from './ForgotPasswordForm';

export type AuthMode = 'signin' | 'signup' | 'forgot-password';

export interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: AuthMode;
  redirectTo?: string;
}

export function AuthModal({
  isOpen,
  onClose,
  initialMode = 'signin',
  redirectTo,
}: AuthModalProps) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [prevInitialMode, setPrevInitialMode] = useState(initialMode);

  if (initialMode !== prevInitialMode) {
    setPrevInitialMode(initialMode);
    setMode(initialMode);
  }
  const dialogRef = useRef<HTMLDivElement>(null);

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Authentication modal"
    >
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/75 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal panel */}
      <div
        ref={dialogRef}
        className="relative my-8 w-full max-w-md rounded-2xl border border-[#3c2a1c] bg-[#0e0906] shadow-2xl shadow-black/70 animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto"
        style={{
          background: 'linear-gradient(145deg, #140d07 0%, #0c0805 60%, #110a06 100%)',
        }}
      >
        {/* Gold top border accent */}
        <div className="sticky top-0 left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-[#c59341]/60 to-transparent rounded-full z-20" />

        {/* Close button */}
        <button
          onClick={onClose}
          id="auth-modal-close-btn"
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full text-[#6b5c4c] hover:text-[#c59341] hover:bg-[#c59341]/10 transition-all z-20"
          aria-label="Close modal"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
            <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
          </svg>
        </button>

        <div className="px-7 sm:px-8 pb-8 pt-7">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="flex items-center justify-center gap-2 mb-3">
              <ScalesLogo className="w-6 h-6 text-[#c59341]" />
              <span className="font-cinzel font-bold tracking-[0.25em] text-[#e6ded2] text-base">
                JUSTICIA
              </span>
            </div>
            <h2 className="font-cinzel text-xl font-bold text-[#ded7cb] tracking-wide">
              {mode === 'signin' && 'Welcome Back'}
              {mode === 'signup' && 'Create Your Account'}
              {mode === 'forgot-password' && 'Reset Password'}
            </h2>
            <p className="text-[12px] text-[#7a6a5a] mt-1">
              {mode === 'signin' && 'Sign in to your account to continue'}
              {mode === 'signup' && 'Philippine Legal Assistance Platform'}
              {mode === 'forgot-password' && 'Enter your email to receive a reset link'}
            </p>

            {/* Mode Tab Switcher (Sign In vs Sign Up) */}
            {mode !== 'forgot-password' && (
              <div className="grid grid-cols-2 rounded-lg border border-[#3c2a1c] bg-[#110a06] p-1 mt-4">
                <button
                  type="button"
                  onClick={() => setMode('signin')}
                  className={`py-1.5 text-xs font-cinzel font-bold tracking-wider rounded transition-all ${
                    mode === 'signin'
                      ? 'bg-[#c59341] text-[#0c0805] shadow'
                      : 'text-[#8c7b6c] hover:text-[#ded7cb]'
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => setMode('signup')}
                  className={`py-1.5 text-xs font-cinzel font-bold tracking-wider rounded transition-all ${
                    mode === 'signup'
                      ? 'bg-[#c59341] text-[#0c0805] shadow'
                      : 'text-[#8c7b6c] hover:text-[#ded7cb]'
                  }`}
                >
                  Sign Up
                </button>
              </div>
            )}

            {/* Decorative divider */}
            <div className="flex items-center gap-3 mt-4">
              <div className="flex-1 h-px bg-gradient-to-r from-transparent to-[#3c2a1c]" />
              <span className="text-[#c59341] text-[10px]">✦</span>
              <div className="flex-1 h-px bg-gradient-to-l from-transparent to-[#3c2a1c]" />
            </div>
          </div>

          {/* Form Views */}
          {mode === 'signin' && (
            <SignInForm
              onClose={onClose}
              onSwitchToSignUp={() => setMode('signup')}
              onSwitchToForgotPassword={() => setMode('forgot-password')}
              redirectTo={redirectTo}
            />
          )}

          {mode === 'signup' && (
            <SignUpForm
              onClose={onClose}
              onSwitchToSignIn={() => setMode('signin')}
              inModal={true}
            />
          )}

          {mode === 'forgot-password' && (
            <ForgotPasswordForm
              onClose={onClose}
              onSwitchToSignIn={() => setMode('signin')}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// Backward compatibility alias
export const SignInModal = AuthModal;
