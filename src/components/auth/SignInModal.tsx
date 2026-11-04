'use client';

import React, { useEffect, useRef } from 'react';
import { SignInForm } from '@/components/auth/SignInForm';

interface SignInModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSwitchToSignUp?: () => void;
  onSwitchToForgotPassword?: () => void;
}

/**
 * SignInModal — the landing page sign-in overlay.
 * Uses the same neumorphic style as SignUpForm inside an expanded .neu-modal container with a #D39758 border.
 */
export function SignInModal({
  isOpen,
  onClose,
  onSwitchToSignUp,
  onSwitchToForgotPassword,
}: SignInModalProps) {
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

      {/* Modal Panel — neumorphic card (shadows + #D39758 border come from .neu-modal) */}
      <div
        ref={dialogRef}
        className="neu-modal outline-[#D39758] relative w-full max-w-[480px] sm:max-w-[500px] px-7 sm:px-11 pt-9 pb-9 sm:pt-10 sm:pb-10 animate-in fade-in zoom-in-95 duration-200"
      >

        {/* Title styled like SignUpForm / RegisterView */}
        <h2 className="font-lora text-2xl sm:text-3xl sm:text-[34px] font-normal text-[#34150F] text-center leading-none mb-6 sm:mb-7 select-none">
          Sign In
        </h2>

        {/* Real server-action form matching SignUpForm styling */}
        <SignInForm
          variant="neumorphic"
          onClose={onClose}
          onSwitchToSignUp={onSwitchToSignUp}
          onSwitchToForgotPassword={onSwitchToForgotPassword}
          showSignUpLink={true}
        />
      </div>
    </div>
  );
}
