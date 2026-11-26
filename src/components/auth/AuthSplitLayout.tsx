'use client';

/**
 * Split-screen layout for /register and /login.
 *
 * Left: the gavel photograph with the page headline (Lora) and description (Inter) over a dark
 * scrim; the photo settles in with a slow zoom.
 * Right: the parchment form panel, on one wide column: a centred heading (e.g. "Sign In",
 * "Sign Up as a Lawyer") with the form under it, centred in the panel, and a quiet legal footer.
 * The panel scrolls when the window is short, so the form is never clipped.
 */
import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion, useReducedMotion } from 'motion/react';

const EASE = [0.22, 1, 0.36, 1] as const;

const LEGAL_LINKS = [
  { href: '/terms', label: 'Terms' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/ai-disclaimer', label: 'AI Disclaimer' },
];

export interface AuthSplitLayoutProps {
  /** Headline before the highlighted word, e.g. "Sign Up With". */
  headline: string;
  description: string;
  /** Centred heading above the form, e.g. "Sign In". */
  title: React.ReactNode;
  children: React.ReactNode;
}

export function AuthSplitLayout({ headline, description, title, children }: AuthSplitLayoutProps) {
  const reduce = useReducedMotion();
  const rise = (delay: number, y = 18) =>
    reduce
      ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.3, delay } }
      : { initial: { opacity: 0, y }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.65, ease: EASE, delay } };

  return (
    <main className="h-dvh w-full flex flex-col lg:flex-row overflow-hidden bg-[#E5D8CB]">
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

        <div className="relative z-10 p-6 sm:p-8 lg:p-14 xl:p-16 text-left">
          <motion.h1
            {...rise(0.1, 22)}
            className="font-lora text-[26px] sm:text-[34px] lg:text-[44px] xl:text-[52px] font-medium text-[#E2CCB7] leading-[1.06] tracking-[-0.015em]"
          >
            {headline} <span className="text-[#D29D54]">Justicia</span>
          </motion.h1>
          <motion.p
            {...rise(0.2, 16)}
            className="font-inter text-[#E2CCB7]/80 text-xs sm:text-sm lg:text-base mt-2 sm:mt-3 lg:mt-5 max-w-lg xl:max-w-xl leading-relaxed"
          >
            {description}
          </motion.p>
        </div>
      </div>

      {/* ─── Right: form panel ─────────────────────────────────────────────── */}
      <div className="w-full lg:w-1/2 min-h-0 flex-1 lg:h-full overflow-y-auto neu-scrollbar-discrete bg-[#E5D8CB]">
        <div className="flex min-h-full w-full flex-col px-5 sm:px-10 lg:px-12 xl:px-16">
          <div className="mx-auto flex w-full max-w-[576px] flex-1 flex-col">
            {/* Heading + form: from the top when stacked; on desktop centred in the panel, sitting
                a little above the middle so it doesn't look like it's sinking. */}
            <div className="flex flex-1 flex-col justify-start pb-10 pt-8 sm:pt-11 lg:justify-center lg:pb-16 lg:pt-14">
              <motion.h2
                {...rise(0.05, 12)}
                className="mb-7 text-balance text-center font-lora text-[30px] font-medium leading-[1.12] tracking-[-0.015em] text-[#34150F] sm:mb-9 sm:text-[36px] lg:text-[40px]"
              >
                {title}
              </motion.h2>
              {children}
            </div>

            <motion.footer
              {...rise(0.45, 0)}
              className="flex flex-col-reverse items-center gap-2 border-t border-[#C8B59E]/50 py-5 font-inter text-[11.5px] text-[#9A8270] sm:flex-row sm:justify-between"
            >
              <span>© {new Date().getFullYear()} Justicia</span>
              <nav aria-label="Legal" className="flex items-center gap-4">
                {LEGAL_LINKS.map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    className="rounded-sm transition-colors hover:text-[#34150F] focus-visible:outline-2 focus-visible:outline-[#C58B3C]/70"
                  >
                    {l.label}
                  </Link>
                ))}
              </nav>
            </motion.footer>
          </div>
        </div>
      </div>
    </main>
  );
}
