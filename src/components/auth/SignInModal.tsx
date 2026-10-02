'use client';

import React, { useEffect, useRef } from 'react';
import Link from 'next/link';
import { ScalesLogo } from '@/components/landing/LawIcons';
import { SignInForm } from './SignInForm';

interface SignInModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SignInModal({ isOpen, onClose }: SignInModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  // Lock scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
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
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Sign in to Justicia"
    >
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal panel */}
      <div
        ref={dialogRef}
        className="relative w-full max-w-md rounded-2xl border border-[#3c2a1c] bg-[#0e0906] shadow-2xl shadow-black/60 animate-in fade-in zoom-in-95 duration-200"
        style={{
          background: 'linear-gradient(145deg, #140d07 0%, #0c0805 60%, #110a06 100%)',
        }}
      >
        {/* Gold top border accent */}
        <div className="absolute top-0 left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-[#c59341]/60 to-transparent rounded-full" />

        {/* Close button */}
        <button
          onClick={onClose}
          id="signin-modal-close-btn"
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full text-[#6b5c4c] hover:text-[#c59341] hover:bg-[#c59341]/10 transition-all"
          aria-label="Close sign in"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
            <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
          </svg>
        </button>

        <div className="px-8 pb-8 pt-7">
          {/* Header */}
          <div className="text-center mb-7">
            <div className="flex items-center justify-center gap-2 mb-3">
              <ScalesLogo className="w-6 h-6 text-[#c59341]" />
              <span className="font-cinzel font-bold tracking-[0.25em] text-[#e6ded2] text-base">
                JUSTICIA
              </span>
            </div>
            <h2 className="font-cinzel text-xl font-bold text-[#ded7cb] tracking-wide">
              Welcome Back
            </h2>
            <p className="text-[12px] text-[#7a6a5a] mt-1">
              Sign in to your account to continue
            </p>

            {/* Decorative divider */}
            <div className="flex items-center gap-3 mt-4">
              <div className="flex-1 h-px bg-gradient-to-r from-transparent to-[#3c2a1c]" />
              <span className="text-[#c59341] text-[10px]">✦</span>
              <div className="flex-1 h-px bg-gradient-to-l from-transparent to-[#3c2a1c]" />
            </div>
          </div>

          <SignInForm
            onClose={onClose}
            onSwitchToSignUp={() => { onClose(); window.location.href = '/register'; }}
          />
        </div>
      </div>
    </div>
  );
}
