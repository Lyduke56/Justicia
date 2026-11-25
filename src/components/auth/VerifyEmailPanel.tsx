'use client';

/**
 * "Check your inbox" — shown right after sign-up. Same panel as the other auth dialogs: an
 * animated envelope, the three steps to finish, a resend link (with a short cooldown) and the
 * way back to sign in. Verification itself is unchanged: the emailed link goes to /auth/callback.
 */
import React from 'react';
import Link from 'next/link';
import { motion, useReducedMotion, type Variants } from 'motion/react';
import { AuthPanelHeader } from './AuthPanel';
import { ResendVerificationButton } from './ResendVerificationButton';
import { authLinkClass } from './AuthFields';

const EASE = [0.22, 1, 0.36, 1] as const;

const list: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.35 } },
};
const item: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE } },
};

const STEPS = [
  { title: 'Open the email from Justicia', text: 'It can take a minute to arrive.' },
  { title: 'Click “Verify email address”', text: 'The link confirms that this inbox is yours.' },
  { title: 'Sign in and get started', text: 'Your account is ready once it is verified.' },
];

/** Envelope with a letter that rises out of it, then settles into a gentle float. */
function EnvelopeIcon() {
  const reduce = useReducedMotion();
  return (
    <span className={`relative flex ${reduce ? '' : 'neu-float'}`}>
      <svg viewBox="0 0 48 48" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <motion.path
          d="M14 22V11a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v11"
          initial={reduce ? false : { y: 8, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.45, ease: EASE }}
        />
        <motion.path
          d="M19 15h10M19 19h6"
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.85 }}
        />
        <path d="M6 20v19a3 3 0 0 0 3 3h30a3 3 0 0 0 3-3V20" />
        <path d="m6 20 18 13 18-13" />
      </svg>
    </span>
  );
}

export function VerifyEmailPanel() {
  return (
    <>
      <AuthPanelHeader
        titleId="verify-email-title"
        icon={<EnvelopeIcon />}
        title="Check your inbox"
        subtitle="We sent a verification link to your email address. Click it to activate your account."
      />

      <motion.ol variants={list} initial="hidden" animate="show" className="mt-7 space-y-3">
        {STEPS.map((step, i) => (
          <motion.li key={step.title} variants={item} className="neu-recessed flex items-start gap-3.5 rounded-2xl px-4 py-3.5">
            <span className="neu-raised-sm grid size-8 shrink-0 place-items-center rounded-full font-lora text-sm font-bold text-[#C58B3C]">
              {i + 1}
            </span>
            <span className="min-w-0 pt-0.5">
              <span className="block font-lora text-[14px] font-semibold text-[#34150F]">{step.title}</span>
              <span className="block font-inter text-[12px] leading-relaxed text-[#5C4535]">{step.text}</span>
            </span>
          </motion.li>
        ))}
      </motion.ol>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.7, ease: EASE }}
        className="mt-6 rounded-2xl border border-dashed border-[#C8B59E] px-4 py-3.5 text-center font-inter text-[12px] leading-relaxed text-[#5C4535]"
      >
        Didn&apos;t get it? Check your spam or promotions folder, or{' '}
        <ResendVerificationButton
          label="send a new link"
          cooldownSeconds={60}
          className={`${authLinkClass} disabled:cursor-not-allowed disabled:opacity-60 disabled:no-underline`}
          messageClassName="block pt-1 font-medium text-[#1F7A3A] data-[tone=error]:text-[#B42318]"
        />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.8, ease: EASE }}
        className="mt-6"
      >
        <motion.span whileHover={{ y: -2 }} whileTap={{ y: 1, scale: 0.98 }} className="block">
          <Link
            href="/login"
            className="neu-btn-create flex h-12 w-full items-center justify-center rounded-[14px] px-6 font-inter text-[12.5px] font-semibold uppercase tracking-[0.16em] text-[#F3E6D6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C58B3C]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#E5D8CB]"
          >
            Back to Sign In
          </Link>
        </motion.span>
      </motion.div>
    </>
  );
}
