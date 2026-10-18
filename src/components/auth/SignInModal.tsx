'use client';

import React, { useEffect, useRef } from 'react';
import { SignInForm } from '@/components/auth/SignInForm';

interface SignInModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSwitchToSignUp?: () => void;
}

/**
 * SignInModal — the landing page sign-in overlay.
 * Uses the same SignInForm component (dark variant) as the standalone /login page.
 */
export function SignInModal({ isOpen, onClose, onSwitchToSignUp }: SignInModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  // Lock scroll when open
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
    /* Backdrop */
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Sign In"
    >
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/75 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Panel — dark theme matching existing design */}
      <div
        ref={dialogRef}
        className="relative w-full max-w-[420px] rounded-[24px] border border-[#3c2a1c] px-8 sm:px-10 pt-10 pb-9 shadow-2xl shadow-black/60 animate-in fade-in zoom-in-95 duration-200"
        style={{ background: 'linear-gradient(145deg, #140d07 0%, #0c0805 60%, #110a06 100%)' }}
      >
        {/* Gold top border accent */}
        <div className="absolute left-1/4 right-1/4 -top-px h-px bg-gradient-to-r from-transparent via-[#c59341]/60 to-transparent rounded-full" />

        {/* Close button */}
        <button
          onClick={onClose}
          id="signin-modal-close-btn"
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full text-[#6b5a4a] hover:text-[#ded7cb] hover:bg-white/5 transition-colors"
          aria-label="Close"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
            <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {/* Title */}
        <h2 className="font-cinzel text-xl font-bold text-[#ded7cb] tracking-[0.12em] text-center mb-7 select-none">
          SIGN IN
        </h2>

        {/* Real server-action form */}
        <SignInForm
          variant="dark"
          onClose={onClose}
          onSwitchToSignUp={onSwitchToSignUp}
        />
      </div>
    </div>
  );
}
