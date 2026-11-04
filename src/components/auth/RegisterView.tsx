'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion, useReducedMotion } from 'motion/react';
import { SignUpForm } from '@/components/auth/SignUpForm';

/**
 * RegisterView — split-screen layout with synchronized smooth-landing entrance animations:
 * - Left column: Gavel image softly focuses/settles + bottom text overlay glides up
 * - Right column: "Create Account" header lands smoothly alongside the SignUpForm cascade and footer link
 */
export function RegisterView() {
  const prefersReducedMotion = useReducedMotion();

  // Premium easing curve matching Justicia's design system
  const smoothEase = [0.22, 1, 0.36, 1] as const;

  return (
    <div className="h-screen max-h-screen w-full flex flex-col lg:flex-row overflow-hidden">
      {/* Left Column: Image with Text Overlay */}
      <div className="relative w-full lg:w-1/2 h-44 sm:h-64 lg:h-full flex flex-col justify-end overflow-hidden flex-shrink-0">
        <motion.div
          initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 1.05 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.9, ease: smoothEase }}
          className="absolute inset-0"
        >
          <Image
            src="/actual_images/gavel.png"
            alt="Judge with gavel and law book"
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 50vw"
            className="object-cover object-center filter brightness-90"
          />
        </motion.div>
        {/* Gradient Scrim */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/45 to-transparent pointer-events-none" />

        {/* Text Overlay at bottom */}
        <div className="relative z-10 p-6 sm:p-8 lg:p-12 xl:p-16 text-left">
          <motion.h1
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, ease: smoothEase, delay: 0.1 }}
            className="font-lora text-2xl sm:text-3xl lg:text-4xl xl:text-[43px] font-normal text-[#E2CCB7] leading-[1.1] tracking-tight"
          >
            Sign Up With <span className="text-[#D29D54]">Justicia</span>
          </motion.h1>
          <motion.p
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, ease: smoothEase, delay: 0.2 }}
            className="text-[#E2CCB7]/80 text-xs sm:text-sm mt-2 sm:mt-3 lg:mt-4 max-w-lg leading-relaxed font-light"
          >
            Access reliable Philippine legal guidance powered by AI, designed to help you better understand your rights, explore legal concerns, and navigate complex legal matters with greater confidence.
          </motion.p>
        </div>
      </div>

      {/* Right Column: Form Panel */}
      <div className="w-full lg:w-1/2 h-full flex flex-col items-center justify-center bg-[#E5D8CB] px-6 py-6 sm:px-10 lg:px-12 xl:px-16 overflow-y-auto lg:overflow-hidden">
        <div className="w-full max-w-[480px] sm:max-w-[500px] lg:max-w-[520px] mx-auto my-auto flex flex-col justify-center">
          <motion.h2
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: smoothEase, delay: 0.05 }}
            className="font-lora text-2xl sm:text-3xl lg:text-[35px] font-normal text-[#34150F] text-center leading-none mb-5 sm:mb-6 select-none"
          >
            Create Account
          </motion.h2>

          <SignUpForm variant="neumorphic" />

          {/* Sign In Link */}
          <motion.p
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: smoothEase, delay: 0.35 }}
            className="text-center text-[11px] font-inter sm:text-xs text-[#7A604D] pt-3 sm:pt-4"
          >
            Already have an account?{' '}
            <Link
              href="/login"
              className="text-[#99431E] hover:text-[#34150F] font-semibold underline underline-offset-2 transition-colors"
            >
              Sign in
            </Link>
          </motion.p>
        </div>
      </div>
    </div>
  );
}

