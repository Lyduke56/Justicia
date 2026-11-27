'use client';

/**
 * The lawyer onboarding screens (Register as a Verified Lawyer, Application Status) share this
 * frame, the same family as the sign-up page:
 *
 *  - Desktop: a dark espresso rail on the left (5/12 of the window; the gavel photograph, deeply
 *    tinted) with the Justicia mark, the page title and a vertical progress tracker; the
 *    parchment work area on the right (the other 7/12) scrolls on its own.
 *  - Phones and tablets: the rail becomes a compact header (title + segmented progress bar) and
 *    the whole page scrolls.
 *
 * Entrance: the rail slides in from the left while its tracker items cascade down; the work
 * area's content brings its own entrance.
 */
import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { MotionConfig, motion, type Variants } from 'motion/react';
import { JusticiaLogo } from '@/components/brand/JusticiaLogo';
import { ScreenLoader, warmLoadingGifs } from '@/components/shared/loading';
import { SUPPORT_EMAIL } from '@/lib/support';

export const ONBOARD_EASE = [0.22, 1, 0.36, 1] as const;

const RAIL: Variants = {
  hidden: { opacity: 0, x: -28 },
  show: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.6, ease: ONBOARD_EASE, delayChildren: 0.15, staggerChildren: 0.07 },
  },
};

/** Rail content rises in one piece after another. */
export const RAIL_ITEM: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: ONBOARD_EASE } },
};

const TRACKER: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
};

// ─── Progress tracker ─────────────────────────────────────────────────────────

export type TrackerState = 'done' | 'current' | 'upcoming';

export interface TrackerItem {
  key: string;
  label: string;
  description?: string;
  state: TrackerState;
  /** Colour of a finished item's dot (e.g. green for an approval); caramel by default. */
  tone?: string;
  /** Finished items can be reopened (the register form's earlier steps). */
  onSelect?: () => void;
}

const Check = () => (
  <svg viewBox="0 0 12 12" className="h-3.5 w-3.5" fill="none" aria-hidden="true">
    <motion.path
      d="M2 6.2l2.6 2.6L10 3.4"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      initial={{ pathLength: 0 }}
      animate={{ pathLength: 1 }}
      transition={{ duration: 0.4, ease: ONBOARD_EASE, delay: 0.1 }}
    />
  </svg>
);

/** Vertical tracker for the dark rail: dot, label and a short description per item. */
export function RailTracker({ items, label }: { items: TrackerItem[]; label: string }) {
  return (
    <motion.ol variants={TRACKER} aria-label={label} className="relative">
      {items.map((item, i) => {
        const last = i === items.length - 1;
        const { state } = item;
        const body = (
          <>
            <span className="relative z-10 shrink-0">
              <motion.span
                initial={false}
                animate={{ scale: state === 'current' ? 1.06 : 1 }}
                transition={{ type: 'spring', stiffness: 420, damping: 22 }}
                className={`grid size-8 place-items-center rounded-full font-inter text-[12px] font-bold transition-colors duration-300 ${
                  state === 'done'
                    ? 'text-[#2A110E]'
                    : state === 'current'
                      ? 'bg-[#E5D8CB]/10 text-[#E0A458] ring-2 ring-[#D29D54]'
                      : 'text-[#E5D8CB]/45 ring-1 ring-[#E5D8CB]/20'
                }`}
                style={state === 'done' ? { backgroundColor: item.tone ?? '#D29D54' } : undefined}
              >
                {state === 'done' ? <Check /> : i + 1}
              </motion.span>
              {state === 'current' && (
                <span aria-hidden="true" className="neu-beacon absolute inset-0 rounded-full border-2 border-[#D29D54]" />
              )}
            </span>
            <span className="min-w-0 pb-7 pt-1">
              <span
                className={`block font-lora text-[15px] font-semibold leading-tight transition-colors duration-300 ${
                  state === 'upcoming' ? 'text-[#E5D8CB]/50' : 'text-[#F3E6D6]'
                } ${item.onSelect ? 'group-hover:text-[#E0A458]' : ''}`}
              >
                {item.label}
              </span>
              {item.description && (
                <span
                  className={`mt-1 block font-inter text-[12px] leading-snug transition-colors duration-300 ${
                    state === 'current' ? 'text-[#E2CCB7]/80' : 'text-[#E2CCB7]/45'
                  }`}
                >
                  {item.description}
                </span>
              )}
              <span className="sr-only">{state === 'done' ? ' (completed)' : state === 'current' ? ' (current)' : ''}</span>
            </span>
          </>
        );
        return (
          <motion.li key={item.key} variants={RAIL_ITEM} className="relative" aria-current={state === 'current' ? 'step' : undefined}>
            {/* Connector to the next item; it fills caramel once this item is done. */}
            {!last && (
              <span aria-hidden="true" className="absolute left-[15px] top-9 bottom-1 w-0.5 overflow-hidden rounded-full bg-[#E5D8CB]/12">
                <motion.span
                  className="block h-full w-full origin-top rounded-full bg-[#D29D54]"
                  initial={false}
                  animate={{ scaleY: state === 'done' ? 1 : 0 }}
                  transition={{ duration: 0.55, ease: ONBOARD_EASE }}
                />
              </span>
            )}
            {item.onSelect ? (
              <button
                type="button"
                onClick={item.onSelect}
                className="group flex w-full items-start gap-4 rounded-xl text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D29D54]"
              >
                {body}
              </button>
            ) : (
              <div className="flex items-start gap-4">{body}</div>
            )}
          </motion.li>
        );
      })}
    </motion.ol>
  );
}

/** Compact progress for the phone header: "Step 2 of 5 · Credentials" over a segmented bar. */
export function CompactTracker({ items, caption }: { items: TrackerItem[]; caption: React.ReactNode }) {
  return (
    <motion.div variants={RAIL_ITEM} className="space-y-2.5">
      <p className="font-inter text-[11.5px] font-semibold text-[#E2CCB7]/85">{caption}</p>
      <div className="flex gap-1.5" aria-hidden="true">
        {items.map((item) => (
          <span key={item.key} className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#E5D8CB]/15">
            <motion.span
              className="block h-full origin-left rounded-full"
              style={{ backgroundColor: item.state === 'done' ? (item.tone ?? '#D29D54') : '#D29D54' }}
              initial={false}
              animate={{ scaleX: item.state === 'done' ? 1 : item.state === 'current' ? 0.5 : 0 }}
              transition={{ duration: 0.5, ease: ONBOARD_EASE }}
            />
          </span>
        ))}
      </div>
    </motion.div>
  );
}

// ─── Leaving the screen ───────────────────────────────────────────────────────

/**
 * Shows the app's full-window loading screen the moment the user leaves for another page (the
 * next page's own loading screen then takes over), so a click never looks like it did nothing.
 */
export function useLeaveLoader() {
  const [leaving, setLeaving] = useState<string | null>(null);
  return {
    /** For links: call from onClick (ignored for new-tab / modified clicks). */
    onLinkClick: (label = 'Loading...') => (event: React.MouseEvent<HTMLAnchorElement>) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
      setLeaving(label);
    },
    /** Hard navigation with the loader up. */
    go: (href: string, label = 'Loading...') => {
      setLeaving(label);
      window.location.href = href;
    },
    loader: leaving ? <ScreenLoader variant="fullscreen" label={leaving} /> : null,
  };
}

// ─── Shell ────────────────────────────────────────────────────────────────────

export interface OnboardingShellProps {
  eyebrow: string;
  title: string;
  description?: React.ReactNode;
  /** Desktop rail content (usually a RailTracker). */
  rail?: React.ReactNode;
  /** Phone header content (usually a CompactTracker). */
  compactRail?: React.ReactNode;
  /** Extra link in the rail footer (e.g. "Return to Home"). */
  footerLink?: React.ReactNode;
  children: React.ReactNode;
}

export function OnboardingShell({ eyebrow, title, description, rail, compactRail, footerLink, children }: OnboardingShellProps) {
  // Leaving these screens shows the loading screen; have its pictures ready.
  useEffect(() => {
    warmLoadingGifs();
  }, []);
  return (
    <MotionConfig reducedMotion="user">
      <div className="flex min-h-dvh w-full flex-col bg-[#E5D8CB] lg:h-dvh lg:flex-row lg:overflow-hidden">
        {/* ─── Rail ──────────────────────────────────────────────────────────── */}
        <motion.aside
          variants={RAIL}
          initial="hidden"
          animate="show"
          className="relative shrink-0 overflow-hidden bg-[#2A110E] text-[#E5D8CB] lg:h-full lg:w-5/12"
        >
          <motion.div
            className="pointer-events-none absolute inset-0"
            initial={{ opacity: 0, scale: 1.08 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.4, ease: ONBOARD_EASE }}
            aria-hidden="true"
          >
            <Image src="/actual_images/gavel.png" alt="" fill priority sizes="(min-width: 1024px) 42vw, 100vw" className="object-cover object-center opacity-25" />
          </motion.div>
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#341512]/85 via-[#2A110E]/92 to-[#1E0C09]" aria-hidden="true" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(210,157,84,0.22),transparent_60%)]" aria-hidden="true" />

          <div className="relative flex flex-col px-5 pb-6 pt-5 sm:px-8 lg:h-full lg:overflow-y-auto lg:px-14 lg:pb-8 lg:pt-10 xl:px-16 neu-scrollbar-discrete">
            <motion.div variants={RAIL_ITEM}>
              <Link href="/" aria-label="Justicia home" className="inline-block rounded-md text-[#E5D8CB] transition-colors hover:text-[#D29D54] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D29D54]">
                <JusticiaLogo className="h-auto w-28 lg:w-32" />
              </Link>
            </motion.div>

            <div className="mt-6 lg:mt-12">
              <motion.p variants={RAIL_ITEM} className="inline-flex items-center gap-3 font-inter text-[10px] font-semibold uppercase tracking-[0.26em] text-[#D29D54] sm:text-[10.5px]">
                <span className="h-px w-6 bg-[#D29D54]/60" aria-hidden="true" />
                {eyebrow}
              </motion.p>
              <motion.h1 variants={RAIL_ITEM} className="mt-3 text-balance font-lora text-[26px] font-medium leading-[1.12] tracking-[-0.015em] text-[#F3E6D6] sm:text-[30px] lg:text-[40px] xl:text-[44px]">
                {title}
              </motion.h1>
              {description && (
                <motion.p variants={RAIL_ITEM} className="mt-3 hidden max-w-[44ch] font-inter text-[13px] leading-relaxed text-[#E2CCB7]/75 sm:block lg:text-[14px]">
                  {description}
                </motion.p>
              )}
            </div>

            {compactRail && <div className="mt-5 lg:hidden">{compactRail}</div>}
            {rail && <div className="mt-10 hidden max-w-[440px] lg:block">{rail}</div>}

            <motion.div variants={RAIL_ITEM} className="mt-auto hidden space-y-1.5 border-t border-[#E5D8CB]/12 pt-5 font-inter text-[11.5px] text-[#E2CCB7]/55 lg:block">
              <p>
                Questions? Write to{' '}
                <a href={`mailto:${SUPPORT_EMAIL}`} className="font-semibold text-[#D29D54] transition-colors hover:text-[#E0A458] hover:underline">
                  {SUPPORT_EMAIL}
                </a>
              </p>
              {footerLink}
            </motion.div>
          </div>
        </motion.aside>

        {/* ─── Work area ─────────────────────────────────────────────────────── */}
        <div id="onboarding-main" className="relative flex min-w-0 flex-1 flex-col lg:h-full lg:w-7/12 lg:overflow-y-auto neu-scrollbar-discrete">
          {children}
        </div>
      </div>
    </MotionConfig>
  );
}

/** Heading block at the top of the work area: eyebrow, title and intro. */
export function WorkAreaHeading({ eyebrow, title, intro, id }: { eyebrow: string; title: string; intro?: React.ReactNode; id?: string }) {
  return (
    <header className="space-y-1.5">
      <motion.p variants={RAIL_ITEM} className="font-inter text-[10.5px] font-semibold uppercase tracking-[0.22em] text-[#A8742E]">
        {eyebrow}
      </motion.p>
      <motion.h2 variants={RAIL_ITEM} id={id} className="text-balance font-lora text-[26px] font-semibold leading-tight tracking-[-0.01em] text-[#34150F] sm:text-[30px]">
        {title}
      </motion.h2>
      {intro && (
        <motion.p variants={RAIL_ITEM} className="max-w-[60ch] font-inter text-[13.5px] leading-relaxed text-[#5C4535]">
          {intro}
        </motion.p>
      )}
    </header>
  );
}
