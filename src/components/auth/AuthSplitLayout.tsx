'use client';

/**
 * Split-screen layout for /register and /login.
 *
 * Left: the gavel photograph with the headline and description over a dark scrim, as before.
 * The headline is Lora, the description Inter; a small eyebrow, a caramel rule and three quiet
 * highlights were added, and the photo settles in with a slow zoom.
 * Right: the parchment form panel. It scrolls when the window is short, so the form is never
 * clipped.
 */
import React from 'react';
import Image from 'next/image';
import { motion, useReducedMotion } from 'motion/react';

const EASE = [0.22, 1, 0.36, 1] as const;

const HIGHLIGHTS = ['IBP-verified lawyers', 'AI legal guidance', 'Private document vault'];

export interface AuthSplitLayoutProps {
  /** Headline before the highlighted word, e.g. "Sign Up With". */
  headline: string;
  description: string;
  /** Right panel heading, e.g. "Create Account". */
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  /** Under the form (e.g. "Already have an account? Sign in"). */
  footer?: React.ReactNode;
}

export function AuthSplitLayout({ headline, description, title, subtitle, children, footer }: AuthSplitLayoutProps) {
  const reduce = useReducedMotion();
  const rise = (delay: number, y = 18) =>
    reduce
      ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.3, delay } }
      : { initial: { opacity: 0, y }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.65, ease: EASE, delay } };

  return (
    <div className="h-dvh w-full flex flex-col lg:flex-row overflow-hidden bg-[#E5D8CB]">
      {/* ─── Left: image with text overlay ─────────────────────────────────── */}
      <div className="relative w-full lg:w-1/2 h-48 sm:h-64 lg:h-full flex flex-col justify-end overflow-hidden flex-shrink-0">
        <motion.div
          initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 1.08 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.4, ease: EASE }}
          className="absolute inset-0"
        >
          <Image
            src="/actual_images/gavel.png"
            alt="Judge with gavel and law book"
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 50vw"
            className="object-cover object-center brightness-90"
          />
        </motion.div>
        {/* Scrim: dark at the bottom for the text, plus a soft warm vignette. */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/45 to-transparent pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(197,139,60,0.18),transparent_60%)] pointer-events-none" />

        <div className="relative z-10 p-6 sm:p-8 lg:p-12 xl:p-16 text-left">
          <motion.p
            {...rise(0.05, 10)}
            className="hidden sm:flex items-center gap-3 font-inter text-[10.5px] lg:text-[11px] font-semibold uppercase tracking-[0.28em] text-[#D29D54]"
          >
            <span className="h-px w-8 bg-[#D29D54]/70" aria-hidden="true" />
            Philippine Legal Assistance
          </motion.p>
          <motion.h1
            {...rise(0.12, 22)}
            className="mt-2 sm:mt-3 font-lora text-2xl sm:text-3xl lg:text-4xl xl:text-[44px] font-medium text-[#E2CCB7] leading-[1.1] tracking-tight"
          >
            {headline} <span className="text-[#D29D54]">Justicia</span>
          </motion.h1>
          <motion.p
            {...rise(0.22, 16)}
            className="font-inter text-[#E2CCB7]/80 text-xs sm:text-sm lg:text-[15px] mt-2 sm:mt-3 lg:mt-4 max-w-lg leading-relaxed"
          >
            {description}
          </motion.p>
          <motion.ul {...rise(0.32, 12)} className="hidden lg:flex flex-wrap gap-2 mt-6" aria-label="What Justicia offers">
            {HIGHLIGHTS.map((h) => (
              <li
                key={h}
                className="rounded-full border border-[#E2CCB7]/20 bg-white/5 px-3.5 py-1.5 font-inter text-[11px] font-medium text-[#E2CCB7]/85 backdrop-blur-sm"
              >
                {h}
              </li>
            ))}
          </motion.ul>
        </div>
      </div>

      {/* ─── Right: form panel ─────────────────────────────────────────────── */}
      <div className="w-full lg:w-1/2 min-h-0 flex-1 lg:h-full overflow-y-auto neu-scrollbar-discrete bg-[#E5D8CB]">
        <div className="mx-auto flex min-h-full w-full max-w-[520px] flex-col justify-center px-6 py-8 sm:px-10 lg:px-12 xl:px-14 lg:py-10">
          <motion.div {...rise(0.05, 14)} className="mb-6 sm:mb-7 text-center">
            <h2 className="font-lora text-[28px] sm:text-[32px] lg:text-[35px] font-medium leading-none text-[#34150F] select-none">
              {title}
            </h2>
            {subtitle && <p className="mt-2.5 font-inter text-[13px] text-[#5C4535]">{subtitle}</p>}
          </motion.div>

          {children}

          {footer && (
            <motion.div {...rise(0.4, 10)} className="pt-5 text-center font-inter text-[12px] text-[#7A604D]">
              {footer}
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
