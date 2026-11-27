'use client';

import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLawyerReviews } from './useLawyerReviews';
import { getPublicLawyerDetailsAction, type LawyerOwnProfileDetails } from '@/app/actions/lawyerProfileActions';
import { getLawyerUnavailabilityAction, type UnavailabilityBlock } from '@/app/actions/availabilityActions';
import { LawyerUnavailabilityManager } from '@/components/lawyer/LawyerUnavailabilityManager';
import { ConsultationHoursEditor } from '@/components/lawyer/ConsultationHoursEditor';
import { getBookingMonthAction } from '@/app/actions/consultationHoursActions';
import { DEFAULT_CONSULTATION_HOURS, slotLabel, slotStartsFor, type ConsultationHours } from '@/lib/lawyer/consultationHours';
import type { CalendarDayMark } from '@/lib/consultations/monthAvailability';

const LAWYER_UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMPTY_DETAILS: LawyerOwnProfileDetails = {
  practiceAreaDetails: [],
  experiences: [],
  services: [],
  education: [],
  caseSummaries: [],
};
import {
  EditProfileModal,
  ManageCasesModal,
  CaseDetailModal,
  caseDocketLabel,
  type CaseDetailItem,
} from '@/components/lawyer/LawyerProfileEditModals';
import {
  motion,
  AnimatePresence,
  MotionConfig,
  animate,
  useAnimationControls,
  useInView,
  useMotionValue,
  useTransform,
} from 'motion/react';
import type { HTMLMotionProps, Variants } from 'motion/react';
import type { PublicLawyerProfile } from './LawyerGrid';
import {
  bookConsultationAction,
  getBookedSlotsForLawyer,
  getUserDocumentsDataAction,
  createDocumentFolderAction,
  uploadDocumentFileAction,
} from '@/app/actions/consultationActions';
import type {
  DocumentFileItem,
  DocumentFolderItem,
} from '@/app/actions/consultationActions';
import {
  BookingConfirmModal,
  type BookingConfirmDetails,
  type BookingConfirmPhase,
} from './BookingConfirmModal';
import { NeuModal, NeuButton, NeuAlert, EmptyState, StarIcon as NeuStarIcon } from '@/components/shared/neu';
import { SubmissionOverlay, useSubmission, type SubmissionCopy } from '@/components/shared/feedback';
import { useMyAvatar } from '@/components/account/avatarStore';
import { ProfilePhoto } from '@/components/shared/ProfilePhoto';
import { PanelLoader, useScreenLoading, useScreenReveal } from '@/components/shared/loading';

/** A My Documents file attached to the booking (shared with the lawyer by document ID). */
interface BookingAttachment {
  id: string;
  name: string;
  size: string;
}

interface BookingDraft {
  year: number;
  month: number;
  day: number;
  timeSlot: string;
  communicationMode: 'video' | 'audio';
  subject: string;
  description: string;
  attachments: BookingAttachment[];
  agreedToTerms: boolean;
  savedAt: string;
}

const DEFAULT_TIME_SLOT = '2:00 PM - 3:00 PM • PST, GMT+8';
const bookingDraftKey = (lawyerId: string) => `justicia_booking_draft_${lawyerId}`;

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const MONTH_SHORT_NAMES = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEPT', 'OCT', 'NOV', 'DEC'];

/** Parses "2:00 PM - 3:00 PM • …" into minutes-from-midnight. */
function parseSlotMinutes(slot: string): { start: number; end: number } | null {
  const matches = [...slot.matchAll(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)/gi)];
  if (matches.length === 0) return null;
  const toMin = (m: RegExpMatchArray) => {
    let h = Number(m[1]) % 12;
    if (m[3].toUpperCase() === 'PM') h += 12;
    return h * 60 + (m[2] ? Number(m[2]) : 0);
  };
  const start = toMin(matches[0]);
  const end = matches[1] ? toMin(matches[1]) : start + 60;
  return { start, end: end > start ? end : start + 60 };
}

function slotsOverlap(a: string, b: string): boolean {
  if (a === b) return true;
  const ra = parseSlotMinutes(a);
  const rb = parseSlotMinutes(b);
  return !!ra && !!rb && ra.start < rb.end && rb.start < ra.end;
}

export interface ReviewItem {
  id: number | string;
  name: string;
  stars: number;
  date: string;
  content: string;
  reply?: string;
}

interface LawyerDetailViewProps {
  lawyer: PublicLawyerProfile;
  onBack?: () => void;
  defaultTab?: 'about' | 'reviews' | 'booking' | 'cases';
  onEdit?: () => void;
  /**
   * 'owner' = the signed-in lawyer viewing their own profile (Lawyer portal → Lawyer Profile):
   * no back link, editable About / Cases Handled, read-only Reviews, Availability tab instead of booking.
   */
  mode?: 'client' | 'owner';
  /** Persisted About / Cases Handled data. When provided it replaces the placeholder content. */
  details?: LawyerOwnProfileDetails;
}

type TabType = 'about' | 'reviews' | 'booking' | 'cases';
const TABS: { key: TabType; label: string }[] = [
  { key: 'about', label: 'About' },
  { key: 'reviews', label: 'Reviews' },
  { key: 'booking', label: 'Consultation Booking' },
  { key: 'cases', label: 'Cases Handled' },
];
const TAB_ORDER: TabType[] = TABS.map((t) => t.key);

// Always resolves "today" in Philippine time (GMT+8), regardless of device/server timezone
const getTodayPH = () => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(new Date());
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return { year: get('year'), month: get('month') - 1, day: get('day') };
};

// ═════════════════════════════════════════════════════════════════════════════
//  MOTION PRIMITIVES
//  Everything below is reusable. The big idea: buttons behave like physical keys
//  (snap down fast, spring back with a little overshoot), active choices are a
//  single "pill" that slides between options, and content enters in a staggered
//  sequence instead of all at once.
// ═════════════════════════════════════════════════════════════════════════════

/** Overall screen scale. 1 = original size. Lower = smaller (0.9 = 90%). Layout is untouched. */
const SCREEN_SCALE = 0.95;

const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];
const SPRING_PILL = { type: 'spring', stiffness: 520, damping: 38 } as const;

/**
 * Page-load choreography (seconds):
 *   0.00 back button → 0.12 banner (focus-in) → 0.35 avatar → 0.50 name → 0.60–0.80 details
 *   0.95 tabs cascade in → 1.00 sheen sweeps the banner → 1.35 active tab pill settles
 *   1.20 first panel starts, and everything inside it staggers after that.
 */
const INTRO_DELAY = 1.2;
/** Extra delay that content inside the tab panels adds while the page is still introducing itself. */
const IntroContext = createContext(0);

/** Key-press feel: hover lifts, press snaps down in ~60ms, release springs back with overshoot. */
const makeKeyVariants = (travel = 2.5, squish = 0.968, lift = -1.5): Variants => ({
  rest: {
    y: 0,
    scale: 1,
    filter: 'brightness(1)',
    transition: { type: 'spring', stiffness: 560, damping: 15, mass: 0.7 },
  },
  hover: {
    y: lift,
    scale: 1,
    filter: 'brightness(1.03)',
    transition: { type: 'spring', stiffness: 500, damping: 26 },
  },
  pressed: {
    y: travel,
    scale: squish,
    filter: 'brightness(0.95)',
    transition: { duration: 0.06, ease: 'easeOut' },
  },
});
const KEY_VARIANTS = makeKeyVariants();
const CARD_KEY_VARIANTS = makeKeyVariants(2, 0.99, -2);

/** Inset shadow that fades in while pressed, so the face looks pushed into the surface. */
const OVERLAY_VARIANTS: Variants = {
  rest: { opacity: 0, transition: { duration: 0.18 } },
  hover: { opacity: 0 },
  pressed: { opacity: 1, transition: { duration: 0.05 } },
};

function PressOverlay() {
  return (
    <motion.span
      aria-hidden
      variants={OVERLAY_VARIANTS}
      className="pointer-events-none absolute inset-0 z-20 rounded-[inherit]"
      style={{
        boxShadow: 'inset 3px 3px 8px rgba(120,84,48,0.40), inset -2px -2px 5px rgba(255,244,232,0.5)',
        background: 'linear-gradient(145deg, rgba(120,84,48,0.12), rgba(255,255,255,0) 60%)',
      }}
    />
  );
}

type KeyProps = Omit<
  HTMLMotionProps<'button'>,
  'children' | 'variants' | 'initial' | 'animate' | 'whileHover' | 'whileTap'
> & { children?: React.ReactNode };

/** Drop-in tactile <button>. Pass the same classNames you'd give a normal button. */
function Key({ className = '', children, disabled, ...rest }: KeyProps) {
  const on = !disabled;
  return (
    <motion.button
      type="button"
      disabled={disabled}
      variants={KEY_VARIANTS}
      initial="rest"
      animate="rest"
      whileHover={on ? 'hover' : undefined}
      whileTap={on ? 'pressed' : undefined}
      className={`group relative touch-manipulation select-none ${className}`}
      {...rest}
    >
      {children}
      <PressOverlay />
    </motion.button>
  );
}

/** Tactile <Link>. The Link stays a plain anchor; the key face inside it is what moves. */
function KeyLink({ href, className = '', children }: { href: string; className?: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="inline-flex rounded-[12px]">
      <motion.span
        variants={KEY_VARIANTS}
        initial="rest"
        animate="rest"
        whileHover="hover"
        whileTap="pressed"
        className={`relative select-none ${className}`}
      >
        {children}
        <PressOverlay />
      </motion.span>
    </Link>
  );
}

/**
 * The shared "active option" background. Render it inside whichever option is selected
 * and give every instance in a group the same layoutId — it glides from option to option.
 * A solid base sits under the highlight so the old recessed/raised surface never bleeds through.
 */
function HighlightPill({
  layoutId,
  radius,
  variant = 'neu-raised-highlight-sm',
  intro = false,
}: {
  layoutId: string;
  radius: number;
  variant?: string;
  /** Delay (s) for a one-time "settle in" on first page load; false for none. */
  intro?: number | false;
}) {
  return (
    <motion.span
      aria-hidden
      layoutId={layoutId}
      transition={SPRING_PILL}
      initial={intro === false ? undefined : { opacity: 0, scale: 0.8 }}
      animate={
        intro === false
          ? undefined
          : { opacity: 1, scale: 1, transition: { delay: intro, type: 'spring', stiffness: 260, damping: 20 } }
      }
      style={{ borderRadius: radius }}
      className="pointer-events-none absolute inset-0 z-0"
    >
      <span className="absolute inset-0 rounded-[inherit] bg-[#E5D8CB]" />
      <span className={`absolute inset-0 rounded-[inherit] ${variant}`} />
    </motion.span>
  );
}

/** Fade + rise when scrolled into view (once). */
function Reveal({
  children,
  className = '',
  delay = 0,
  y = 18,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  y?: number;
}) {
  const introDelay = useContext(IntroContext);
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.12 }}
      transition={{ duration: 0.7, delay: introDelay + delay, ease: EASE_OUT }}
    >
      {children}
    </motion.div>
  );
}

/**
 * Height-collapsing wrapper for banners/notices. `gap` must equal the parent's space-y
 * (in px) so the layout doesn't jump when the notice mounts or unmounts.
 */
function Collapse({ children, gap = 0, className = '' }: { children: React.ReactNode; gap?: number; className?: string }) {
  return (
    <motion.div
      initial={{ height: 0, opacity: 0, marginBottom: -gap }}
      animate={{ height: 'auto', opacity: 1, marginBottom: 0 }}
      exit={{ height: 0, opacity: 0, marginBottom: -gap }}
      transition={{ duration: 0.3, ease: EASE_OUT }}
      className={`overflow-hidden ${className}`}
    >
      {children}
    </motion.div>
  );
}

/** Number that counts up the first time it scrolls into view and re-tweens when the value changes. */
function CountUp({
  value,
  decimals = 0,
  prefix = '',
  duration = 0.9,
  delay = 0,
  className = '',
}: {
  value: number;
  decimals?: number;
  prefix?: string;
  duration?: number;
  delay?: number;
  className?: string;
}) {
  const introDelay = useContext(IntroContext);
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });
  const mv = useMotionValue(0);
  const text = useTransform(
    mv,
    (v) => prefix + (decimals > 0 ? v.toFixed(decimals) : Math.round(v).toLocaleString())
  );
  useEffect(() => {
    if (!inView) return;
    const controls = animate(mv, value, { duration, delay: introDelay + delay, ease: EASE_OUT });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView, value, duration, mv]);
  return (
    <motion.span ref={ref} className={`tabular-nums ${className}`}>
      {text}
    </motion.span>
  );
}

/** Small odometer-style number: old value rolls up and out, new one rolls in. */
function RollNumber({ value }: { value: number }) {
  return (
    <span className="relative inline-flex overflow-hidden align-bottom tabular-nums">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={value}
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '-100%', opacity: 0 }}
          transition={{ duration: 0.2, ease: EASE_OUT }}
          className="inline-block"
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

// ─── Shared variants ─────────────────────────────────────────────────────────

/** Tab panels and paginated lists: slide in from the direction you navigated. */
const SLIDE_VARIANTS: Variants = {
  enter: (d: number) => ({ opacity: 0, x: d * 28 }),
  center: { opacity: 1, x: 0, transition: { duration: 0.34, ease: EASE_OUT } },
  exit: (d: number) => ({ opacity: 0, x: d * -28, transition: { duration: 0.16, ease: 'easeIn' } }),
};

/** Tab panels: a soft rise + drift from the side you navigated toward. `delay` is only non-zero on first load. */
type PanelCustom = { dir: number; delay: number };
const PANEL_VARIANTS: Variants = {
  enter: ({ dir }: PanelCustom) => ({ opacity: 0, x: dir * 18, y: 14, scale: 0.992 }),
  center: ({ delay }: PanelCustom) => ({
    opacity: 1,
    x: 0,
    y: 0,
    scale: 1,
    transition: { duration: 0.6, delay, ease: EASE_OUT },
  }),
  exit: ({ dir }: PanelCustom) => ({
    opacity: 0,
    x: dir * -14,
    scale: 0.996,
    transition: { duration: 0.2, ease: 'easeIn' },
  }),
};

/** Tab bar: each tab rises in with a little spring. */
const TAB_BAR_VARIANTS: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.075, delayChildren: 0.95 } },
};
const TAB_ITEM_VARIANTS: Variants = {
  hidden: { opacity: 0, y: 16, scale: 0.92 },
  show: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 240, damping: 20 } },
};

const makeRollVariants = (dist: number): Variants => ({
  enter: (d: number) => ({ y: d * dist, opacity: 0 }),
  center: { y: 0, opacity: 1, transition: { type: 'spring', stiffness: 420, damping: 30 } },
  exit: (d: number) => ({ y: d * -dist, opacity: 0, transition: { duration: 0.18 } }),
});
const DAY_ROLL = makeRollVariants(46);
const LABEL_ROLL = makeRollVariants(16);

const STAGGER_VARIANTS: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.04 } },
  exit: { opacity: 0, transition: { duration: 0.14 } },
};
const STAGGER_ITEM: Variants = {
  hidden: { opacity: 0, y: 18, scale: 0.985 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.45, ease: EASE_OUT } },
};

const CASE_PAGE_VARIANTS: Variants = {
  enter: (d: number) => ({ opacity: 0, x: d * 28 }),
  center: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.3, ease: EASE_OUT, staggerChildren: 0.08, delayChildren: 0.05 },
  },
  exit: (d: number) => ({ opacity: 0, x: d * -28, transition: { duration: 0.16, ease: 'easeIn' } }),
};
const CASE_CARD_VARIANTS: Variants = {
  enter: { opacity: 0, y: 20 },
  center: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE_OUT } },
};

const SHAKE = { x: [0, -9, 9, -6, 6, -3, 0], transition: { duration: 0.45 } };

// ─── Neumorphic SVG Icon Helpers (Zero AI Emojis) ───────────────────────────

function StarIcon({ filled = false, className = 'w-4 h-4' }: { filled?: boolean; className?: string }) {
  return (
    <svg
      className={`${className} transition-colors duration-300 ${filled ? 'text-[#C58B3C] fill-[#C58B3C]' : 'text-[#CBB8A4] fill-transparent stroke-current'}`}
      viewBox="0 0 20 20"
      strokeWidth="1.2"
    >
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
    </svg>
  );
}

function ScalesIcon({ className = 'w-3.5 h-3.5 text-[#C58B3C] shrink-0' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 3v18M7 21h10M3 7h18" />
      <path d="M6 7l-3 7c0 1.5 1.5 2.5 3 2.5s3-1 3-2.5L6 7z" />
      <path d="M18 7l-3 7c0 1.5 1.5 2.5 3 2.5s3-1 3-2.5L18 7z" />
    </svg>
  );
}

function PaperclipIcon({ className = 'w-3.5 h-3.5 text-[#C58B3C] shrink-0' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="m18.375 12.739-7.693 7.693a4.5 4.5 0 0 1-6.364-6.364l10.94-10.94A3 3 0 1 1 19.5 7.373L8.558 18.315a1.5 1.5 0 0 1-2.121-2.121l7.693-7.693" />
    </svg>
  );
}

function FolderIcon({ className = 'w-4 h-4 text-[#C58B3C] shrink-0' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />
    </svg>
  );
}

function FileDocIcon({ className = 'w-4 h-4 text-[#7A6756] shrink-0' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
    </svg>
  );
}

function CloseIcon({ className = 'w-3 h-3' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

/** Check mark that draws itself. */
function AnimatedCheck({ className = 'w-4 h-4', delay = 0 }: { className?: string; delay?: number }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
      <motion.path
        d="M5 12.5l4.5 4.5L19 7"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.35, delay, ease: EASE_OUT }}
      />
    </svg>
  );
}

function Spinner({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={`${className} animate-spin motion-reduce:animate-none`} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  );
}

function LineIcon({
  children,
  className = 'w-8 h-8 text-[#341512]/80 shrink-0',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      {children}
    </svg>
  );
}

// ─── Small composed components ───────────────────────────────────────────────

const LOREM_BIO =
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.';

const LOREM_CASE =
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.';

const BULLETS = [
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
  'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
  'Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.',
];

/** Bullets that slide in one after another when the list scrolls into view. */
function BulletList({
  items = BULLETS,
  className = '',
  emptyText = 'Nothing added yet.',
}: {
  items?: string[];
  className?: string;
  emptyText?: string;
}) {
  const introDelay = useContext(IntroContext);
  if (items.length === 0) {
    return <p className={`text-xs sm:text-[13px] text-[#341512]/60 italic font-inter ${className}`}>{emptyText}</p>;
  }
  return (
    <motion.ul
      className={`space-y-1.5 text-xs sm:text-[13px] text-[#341512]/80 leading-relaxed font-inter ${className}`}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.4 }}
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.09, delayChildren: 0.15 + introDelay } } }}
    >
      {items.map((t, i) => (
        <motion.li
          key={`${i}-${t}`}
          variants={{
            hidden: { opacity: 0, x: -10 },
            show: { opacity: 1, x: 0, transition: { duration: 0.4, ease: EASE_OUT } },
          }}
          className="flex items-start gap-2"
        >
          <span className="text-[8px] mt-1.5 shrink-0 text-[#341512]/80">●</span>
          <span>{t}</span>
        </motion.li>
      ))}
    </motion.ul>
  );
}

/** Professional / educational background card. Rises in, lifts on hover, and its icon wiggles. */
function InfoCard({
  icon,
  title,
  subtitle,
  delay = 0,
  items,
  emptyText,
}: {
  icon: React.ReactNode;
  title: React.ReactNode;
  subtitle?: string;
  delay?: number;
  /** Bullet lines; omit to keep the placeholder bullets. */
  items?: string[];
  emptyText?: string;
}) {
  const introDelay = useContext(IntroContext);
  return (
    <motion.div
      initial={{ opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.7, delay: introDelay + delay, ease: EASE_OUT }}
      whileHover="hover"
      variants={{ hover: { y: -3, transition: { type: 'spring', stiffness: 400, damping: 22 } } }}
      className="neu-card-recessed-to-rise rounded-[20px] sm:rounded-[24px] p-6 space-y-3 cursor-default"
    >
      <div className="flex items-center gap-3.5">
        <motion.span
          variants={{ hover: { rotate: [0, -10, 8, 0], scale: 1.1, transition: { duration: 0.5 } } }}
          className="inline-flex shrink-0"
        >
          {icon}
        </motion.span>
        <div>
          <h4 className="font-lora font-bold text-base sm:text-lg text-[#341512]/80 leading-tight">{title}</h4>
          {subtitle && <p className="text-xs text-[#341512]/80 font-inter">{subtitle}</p>}
        </div>
      </div>
      <BulletList className={subtitle ? 'pt-1' : ''} items={items} emptyText={emptyText} />
    </motion.div>
  );
}

/** Previous / next keys plus a row of dots where the active dot glides between pages. */
function PageControls({
  total,
  current,
  onChange,
  idPrefix,
  label,
}: {
  total: number;
  current: number;
  onChange: (page: number) => void;
  idPrefix: string;
  label: string;
}) {
  const arrow =
    'w-9 h-9 sm:w-10 sm:h-10 rounded-full neu-raised-sm bg-[#E5D8CB] hover:bg-[#D39758]/20 flex items-center justify-center text-[#341512]/80 hover:text-[#341512] disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer';
  return (
    <div className="flex items-center justify-center gap-4 pt-3 pb-4">
      <Key onClick={() => onChange(Math.max(1, current - 1))} disabled={current <= 1} className={arrow} aria-label={`Previous ${label} page`}>
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </Key>

      <div className="flex items-center gap-1">
        {Array.from({ length: total }).map((_, idx) => {
          const p = idx + 1;
          const active = p === current;
          return (
            <motion.button
              key={p}
              type="button"
              onClick={() => onChange(p)}
              whileHover={{ scale: 1.25 }}
              whileTap={{ scale: 0.8 }}
              aria-label={`Go to ${label} page ${p}`}
              aria-current={active || undefined}
              className="relative w-5 h-5 flex items-center justify-center cursor-pointer"
            >
              <span className="w-2 h-2 rounded-full bg-[#341512]/70" />
              {active && (
                <motion.span
                  layoutId={`${idPrefix}-dot`}
                  transition={SPRING_PILL}
                  className="absolute w-3 h-3 rounded-full bg-[#D39758]"
                />
              )}
            </motion.button>
          );
        })}
      </div>

      <Key onClick={() => onChange(Math.min(total, current + 1))} disabled={current >= total} className={arrow} aria-label={`Next ${label} page`}>
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </Key>
    </div>
  );
}

/** Radio-style option for the communication mode. */
function ModeCard({
  selected,
  onSelect,
  icon,
  title,
  description,
  badge,
}: {
  selected: boolean;
  onSelect: () => void;
  icon: React.ReactNode;
  title: string;
  description: string;
  badge?: string;
}) {
  return (
    <motion.div
      role="radio"
      aria-checked={selected}
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          onSelect();
        }
      }}
      variants={CARD_KEY_VARIANTS}
      initial="rest"
      animate="rest"
      whileHover="hover"
      whileTap="pressed"
      className={`group relative isolate w-full flex items-start gap-3.5 p-4 sm:p-5 rounded-[20px] cursor-pointer select-none ${selected ? '' : 'neu-recessed hover:bg-[#E5D8CB]/40'
        }`}
    >
      {selected && <HighlightPill layoutId="mode-pill" radius={20} variant="neu-raised-highlight" />}

      <div className="relative z-10 mt-0.5">
        <div
          className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${selected ? 'border-[#341512]' : 'border-[#341512]/60'
            }`}
        >
          <AnimatePresence initial={false}>
            {selected && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                transition={{ type: 'spring', stiffness: 600, damping: 18 }}
                className="w-2 h-2 rounded-full bg-[#341512]"
              />
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="relative z-10 space-y-1">
        <div className="flex items-center gap-2">
          <motion.span
            animate={selected ? { scale: [1, 1.3, 1], rotate: [0, -8, 0] } : { scale: 1, rotate: 0 }}
            transition={{ duration: 0.45 }}
            className="inline-flex"
          >
            {icon}
          </motion.span>
          <span className="font-lora text-xs sm:text-sm font-bold text-[#341512]">{title}</span>
          {badge && (
            <span
              className={`text-[8px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full ml-1 select-none transition-all duration-200 ${selected
                  ? 'bg-[#D39758]/30 text-[#341512] shadow-[1.5px_1.5px_3px_rgba(145,110,75,0.35),-1px_-1px_2.5px_rgba(252,238,223,0.4)]'
                  : 'bg-[#E5D8CB]/80 text-[#341512]/70 shadow-[1.5px_1.5px_3px_rgba(182,155,130,0.35),-1px_-1px_2px_rgba(252,238,223,0.35)]'
                }`}
            >
              {badge}
            </span>
          )}
        </div>
        <p className="text-[11px] sm:text-xs text-[#341512]/80 leading-normal font-inter">{description}</p>
      </div>

      <PressOverlay />
    </motion.div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ═════════════════════════════════════════════════════════════════════════════

/** Banner entrance: each line is staggered by its delay. */
const enter = (delay: number, y = 14) => ({
  initial: { opacity: 0, y },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.75, delay, ease: EASE_OUT },
});

export function LawyerDetailView({
  lawyer,
  onBack,
  defaultTab = 'about',
  onEdit,
  mode = 'client',
  details: detailsProp,
}: LawyerDetailViewProps) {
  const isOwner = mode === 'owner';
  // The owner sees a photo change at once (shared with the top bar); visitors see the saved photo.
  const myAvatar = useMyAvatar(lawyer.photoUrl ?? null);
  const photoUrl = isOwner ? myAvatar : lawyer.photoUrl;

  // Real (database) lawyers opened without server-loaded details — e.g. inline from the Find Lawyer
  // list — load their persisted About / Cases data here. Mock/demo lawyers keep the placeholder content.
  const shouldFetchDetails = !detailsProp && LAWYER_UUID_REGEX.test(lawyer.userId);
  const [fetchedDetails, setFetchedDetails] = useState<{ id: string; details: LawyerOwnProfileDetails | null; failed?: boolean } | null>(null);
  // Bumped by "Try again" after a failed load.
  const [detailsAttempt, setDetailsAttempt] = useState(0);
  useEffect(() => {
    if (!shouldFetchDetails) return;
    let active = true;
    getPublicLawyerDetailsAction(lawyer.userId)
      .then((d) => active && setFetchedDetails({ id: lawyer.userId, details: d }))
      .catch(() => active && setFetchedDetails({ id: lawyer.userId, details: null, failed: true }));
    return () => {
      active = false;
    };
  }, [shouldFetchDetails, lawyer.userId, detailsAttempt]);
  const detailsLoading = shouldFetchDetails && fetchedDetails?.id !== lawyer.userId;
  // In a portal shell, the loading screen stays up until the profile details are here, and the
  // whole page (banner, tabs, cards) enters once it lifts.
  useScreenLoading(detailsLoading);
  const { revealed } = useScreenReveal();
  const detailsFailed = shouldFetchDetails && fetchedDetails?.id === lawyer.userId && !!fetchedDetails.failed;
  const retryDetails = () => {
    setFetchedDetails(null);
    setDetailsAttempt((n) => n + 1);
  };
  const details: LawyerOwnProfileDetails | undefined =
    detailsProp ??
    (shouldFetchDetails
      ? (fetchedDetails?.id === lawyer.userId ? fetchedDetails.details : null) ?? EMPTY_DETAILS
      : undefined);
  const router = useRouter();
  // Owner mode: the booking tab becomes "Availability" — the same calendar, used to block off dates/times.
  const tabs = isOwner
    ? TABS.map((t) => (t.key === 'booking' ? { ...t, label: 'Availability' } : t))
    : TABS;
  const keyboardTabOrder = TAB_ORDER;

  const [showEditProfile, setShowEditProfile] = useState<boolean>(false);
  const [showManageCases, setShowManageCases] = useState<boolean>(false);
  const [ownerNotice, setOwnerNotice] = useState<string | null>(null);
  useEffect(() => {
    if (!ownerNotice) return;
    const t = setTimeout(() => setOwnerNotice(null), 4500);
    return () => clearTimeout(t);
  }, [ownerNotice]);

  const [activeTab, setActiveTab] = useState<TabType>(defaultTab);
  const [tabDir, setTabDir] = useState<number>(1);

  // True only during the first-load sequence. Once it ends (or you switch tabs), content stops waiting for the intro.
  const [introActive, setIntroActive] = useState<boolean>(true);
  useEffect(() => {
    // Counted from the reveal, when the first-load sequence actually plays.
    if (!revealed) return;
    const t = setTimeout(() => setIntroActive(false), (INTRO_DELAY + 1.6) * 1000);
    return () => clearTimeout(t);
  }, [revealed]);
  const introDelay = introActive ? INTRO_DELAY : 0;
  const panelCustom: PanelCustom = { dir: tabDir, delay: introDelay };

  const changeTab = (next: TabType) => {
    if (next === activeTab) return;
    setIntroActive(false);
    setTabDir(TAB_ORDER.indexOf(next) > TAB_ORDER.indexOf(activeTab) ? 1 : -1);
    setActiveTab(next);
  };

  const handleTabKeyDown = (e: React.KeyboardEvent) => {
    const order = keyboardTabOrder;
    const i = order.indexOf(activeTab);
    let next: TabType;
    if (e.key === 'ArrowRight') next = order[(i + 1) % order.length];
    else if (e.key === 'ArrowLeft') next = order[(i - 1 + order.length) % order.length];
    else return;
    e.preventDefault();
    changeTab(next);
    requestAnimationFrame(() => document.getElementById(`lawyer-tab-${next}`)?.focus());
  };

  const [currentYear, setCurrentYear] = useState<number>(() => getTodayPH().year);
  const [currentMonth, setCurrentMonth] = useState<number>(() => getTodayPH().month);
  const [selectedDay, setSelectedDay] = useState<number>(() => getTodayPH().day);

  useEffect(() => {
    const t = getTodayPH();
    setCurrentYear(t.year);
    setCurrentMonth(t.month);
    setSelectedDay(t.day);
  }, []);

  // The slot the user picked; `selectedTimeSlot` (below) is it, or the day's first free slot.
  const [pickedTimeSlot, setSelectedTimeSlot] = useState<string>(DEFAULT_TIME_SLOT);
  const [communicationMode, setCommunicationMode] = useState<'video' | 'audio'>('video');
  const [subject, setSubject] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [agreedToTerms, setAgreedToTerms] = useState<boolean>(false);

  // ─── Documents Vault Picker Modal State ───
  const [showDocPickerModal, setShowDocPickerModal] = useState<boolean>(false);
  const [docPickerFolders, setDocPickerFolders] = useState<DocumentFolderItem[]>([]);
  const [loadingDocPicker, setLoadingDocPicker] = useState<boolean>(false);
  const [selectedDocPickerFiles, setSelectedDocPickerFiles] = useState<string[]>([]);
  const [activePickerFolderId, setActivePickerFolderId] = useState<string | null>(null);
  const [pickerNewFolderName, setPickerNewFolderName] = useState<string>('');
  const [isCreatingPickerFolder, setIsCreatingPickerFolder] = useState<boolean>(false);
  const [isUploadingPickerFile, setIsUploadingPickerFile] = useState<boolean>(false);
  const [pickerNotice, setPickerNotice] = useState<string | null>(null);
  // Uploading attachments and creating folders show the submission card: loader, then check / X.
  const fileSubmission = useSubmission();
  const [fileCard, setFileCard] = useState<{ processing: SubmissionCopy; success: SubmissionCopy; failure: string }>({
    processing: { title: 'Uploading…' },
    success: { title: 'Uploaded' },
    failure: 'Something went wrong',
  });
  const pickerFileInputRef = useRef<HTMLInputElement>(null);
  const [attachedFiles, setAttachedFiles] = useState<BookingAttachment[]>([]);
  const [bookingStatus, setBookingStatus] = useState<'idle' | 'saved'>('idle');
  const [bookedSlots, setBookedSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState<boolean>(false);
  const [submittingBooking, setSubmittingBooking] = useState<boolean>(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [invalidField, setInvalidField] = useState<'subject' | 'terms' | null>(null);
  // Review → submit dialog. Details are snapshotted when it opens so the sheet can't drift.
  const [confirmPhase, setConfirmPhase] = useState<BookingConfirmPhase | null>(null);
  const [confirmDetails, setConfirmDetails] = useState<BookingConfirmDetails | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState<boolean>(false);
  const [isDraggingFiles, setIsDraggingFiles] = useState<boolean>(false);
  const draftRestoredRef = useRef<boolean>(false);

  // Shake controls for fields that fail validation
  const subjectShake = useAnimationControls();
  const termsShake = useAnimationControls();

  // Direction tracking so the calendar rolls the right way (forward = up/right)
  const monthKey = currentYear * 12 + currentMonth;
  const prevMonthKeyRef = useRef<number>(monthKey);
  const monthDir = monthKey >= prevMonthKeyRef.current ? 1 : -1;
  useEffect(() => {
    prevMonthKeyRef.current = monthKey;
  }, [monthKey]);

  const prevDayRef = useRef<number>(selectedDay);
  const dayDir = selectedDay >= prevDayRef.current ? 1 : -1;
  useEffect(() => {
    prevDayRef.current = selectedDay;
  }, [selectedDay]);

  useEffect(() => {
    if (activeTab === 'booking') {
      const t = getTodayPH();
      setCurrentYear(t.year);
      setCurrentMonth(t.month);
      setSelectedDay(t.day);

      // Restore a previously saved draft for this lawyer (once per visit).
      if (draftRestoredRef.current) return;
      draftRestoredRef.current = true;
      let draft: BookingDraft | null = null;
      try {
        const raw = localStorage.getItem(bookingDraftKey(lawyer.userId));
        draft = raw ? (JSON.parse(raw) as BookingDraft) : null;
      } catch {
        draft = null;
      }
      if (!draft) return;

      const draftDate = Date.UTC(draft.year, draft.month, draft.day);
      if (draftDate >= Date.UTC(t.year, t.month, t.day)) {
        setCurrentYear(draft.year);
        setCurrentMonth(draft.month);
        setSelectedDay(draft.day);
        if (draft.timeSlot) setSelectedTimeSlot(draft.timeSlot);
      }
      setCommunicationMode(draft.communicationMode === 'audio' ? 'audio' : 'video');
      setSubject(draft.subject ?? '');
      setDescription(draft.description ?? '');
      setAttachedFiles(Array.isArray(draft.attachments) ? draft.attachments : []);
      setAgreedToTerms(!!draft.agreedToTerms);
    }
  }, [activeTab, lawyer.userId]);

  // Banner avatar: a quarter taller than the info column beside it (name → specializations),
  // centred on it, so the photo leads the banner. CSS can't size a square from a sibling's height,
  // so the column is measured.
  const [bannerInfoEl, setBannerInfoEl] = useState<HTMLDivElement | null>(null);
  const [bannerAvatarSize, setBannerAvatarSize] = useState<number | null>(null);
  useEffect(() => {
    if (!bannerInfoEl) return;
    const measure = () => {
      // Capped so a long, wrapping specializations line can't balloon the avatar.
      const next = Math.min(Math.round(bannerInfoEl.getBoundingClientRect().height * 1.25), 168);
      setBannerAvatarSize((prev) => (prev !== null && Math.abs(prev - next) <= 1 ? prev : next));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(bannerInfoEl);
    return () => ro.disconnect();
  }, [bannerInfoEl]);

  const bioRef = useRef<HTMLDivElement>(null);
  const [showBioFade, setShowBioFade] = useState(false);

  const updateBioFade = useCallback(() => {
    const el = bioRef.current;
    if (!el) return;
    // true only if there's more content below the visible area
    setShowBioFade(el.scrollHeight - el.scrollTop - el.clientHeight > 4);
  }, []);

  useEffect(() => {
    const el = bioRef.current;
    if (!el) return;
    updateBioFade();
    const ro = new ResizeObserver(updateBioFade);
    ro.observe(el);
    return () => ro.disconnect();
  }, [updateBioFade, lawyer.about, activeTab]);

  // Escape closes the documents vault
  useEffect(() => {
    if (!showDocPickerModal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowDocPickerModal(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showDocPickerModal]);

  // ─── Document Vault Picker Handlers ──────────────────────────────────────────
  const handleOpenDocPicker = async () => {
    setShowDocPickerModal(true);
    setLoadingDocPicker(true);
    setPickerNotice(null);
    // Pre-select files already attached to this booking.
    setSelectedDocPickerFiles(attachedFiles.map((f) => f.id));
    try {
      const data = await getUserDocumentsDataAction('client');
      const folders = Array.isArray(data) ? data : [];
      setDocPickerFolders(folders);
      if (folders.length > 0) {
        setActivePickerFolderId(folders[0].id);
      }
    } catch (err) {
      console.error('Error fetching documents for picker:', err);
      setPickerNotice('We could not load My Documents. Please try again.');
    } finally {
      setLoadingDocPicker(false);
    }
  };

  const handleToggleSelectDoc = (fileId: string) => {
    setSelectedDocPickerFiles((prev) =>
      prev.includes(fileId) ? prev.filter((id) => id !== fileId) : [...prev, fileId]
    );
  };

  /** Uploads files to My Documents and returns the stored document records. */
  const uploadToMyDocuments = async (
    files: File[],
    folderId: string | null
  ): Promise<{ uploaded: DocumentFileItem[]; errors: string[] }> => {
    const uploaded: DocumentFileItem[] = [];
    const errors: string[] = [];
    for (const file of files) {
      const fd = new FormData();
      fd.append('file', file);
      if (folderId) fd.append('folderId', folderId);
      const res = await uploadDocumentFileAction(fd);
      if ('file' in res && res.file) uploaded.push(res.file);
      else errors.push(('error' in res && res.error) || `Failed to upload "${file.name}".`);
    }
    return { uploaded, errors };
  };

  /** Dropzone / browse: uploads to My Documents, then attaches to this booking. */
  const handleAttachLocalFiles = async (fileList: FileList | File[] | null) => {
    const files = fileList ? Array.from(fileList) : [];
    if (files.length === 0 || isUploadingAttachment) return;
    setIsUploadingAttachment(true);
    setBookingError(null);
    const many = files.length > 1;
    setFileCard({
      processing: { title: many ? 'Uploading your files' : 'Uploading your file', message: 'Saving to My Documents and attaching to this booking.' },
      success: { title: many ? 'Files attached' : 'File attached', message: 'They are in My Documents and attached to this booking.' },
      failure: "We couldn't upload your files",
    });
    const result = await fileSubmission.run(async () => {
      try {
        const { uploaded, errors } = await uploadToMyDocuments(files, null);
        if (uploaded.length > 0) {
          setAttachedFiles((prev) => {
            const seen = new Set(prev.map((f) => f.id));
            return [...prev, ...uploaded.filter((f) => !seen.has(f.id)).map(({ id, name, size }) => ({ id, name, size }))];
          });
        }
        if (uploaded.length === 0) return { ok: false, error: errors.join(' ') || 'We could not upload your files. Please try again.' };
        // Some files made it: keep them, and say which ones didn't.
        if (errors.length > 0) setBookingError(errors.join(' '));
        return { ok: true };
      } catch {
        return { ok: false, error: 'We could not upload your files. Please try again.' };
      }
    });
    if (result && !result.ok) setBookingError(result.error);
    setIsUploadingAttachment(false);
  };

  const handleCreatePickerFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pickerNewFolderName.trim() || isCreatingPickerFolder) return;
    const name = pickerNewFolderName.trim();
    setIsCreatingPickerFolder(true);
    setPickerNotice(null);
    setFileCard({
      processing: { title: 'Creating your folder', message: `Adding “${name}” to My Documents.` },
      success: { title: 'Folder created', message: `“${name}” is ready for your files.` },
      failure: "We couldn't create the folder",
    });
    const result = await fileSubmission.run(async () => {
      try {
        const res = await createDocumentFolderAction(name);
        if (!('folder' in res) || !res.folder) return { ok: false, error: ('error' in res && res.error) || 'Failed to create folder' };
        const newFolder = res.folder;
        setDocPickerFolders((prev) => [newFolder, ...prev]);
        setActivePickerFolderId(newFolder.id);
        setPickerNewFolderName('');
        return { ok: true };
      } catch {
        return { ok: false, error: 'Failed to create folder. Please try again.' };
      }
    });
    if (result && !result.ok) setPickerNotice(result.error);
    setIsCreatingPickerFolder(false);
  };

  const handlePickerFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const file = input.files?.[0];
    if (!file || isUploadingPickerFile) return;

    setIsUploadingPickerFile(true);
    setPickerNotice(null);

    // Only user-created folders are real storage folders; anything else goes to the vault root.
    const activeFolder = docPickerFolders.find((f) => f.id === activePickerFolderId);
    const targetFolderId =
      activeFolder && activeFolder.kind === 'owned' && activeFolder.id !== 'uploaded-records'
        ? activeFolder.id
        : null;

    setFileCard({
      processing: { title: 'Uploading your file', message: `Saving “${file.name}” to My Documents.` },
      success: { title: 'File uploaded', message: 'It is saved in My Documents and added to your selection.' },
      failure: "We couldn't upload the file",
    });
    const result = await fileSubmission.run(async () => {
     try {
      const { uploaded, errors } = await uploadToMyDocuments([file], targetFolderId);
      const newFileItem = uploaded[0];
      if (!newFileItem) return { ok: false, error: errors[0] || 'Failed to upload document' };

      setDocPickerFolders((prev) => {
        const destinationId = targetFolderId ?? 'uploaded-records';
        if (prev.some((f) => f.id === destinationId)) {
          return prev.map((f) => (f.id === destinationId ? { ...f, files: [newFileItem, ...f.files] } : f));
        }
        return [
          { id: 'uploaded-records', name: 'Client Vault & Uploaded Records', kind: 'owned', isRecentlyCreated: false, files: [newFileItem] },
          ...prev,
        ];
      });
      if (!targetFolderId) setActivePickerFolderId('uploaded-records');

      // Auto-select the newly uploaded file
      setSelectedDocPickerFiles((prev) => Array.from(new Set([...prev, newFileItem.id])));
      return { ok: true };
     } catch {
      return { ok: false, error: 'Failed to upload document. Please try again.' };
     }
    });
    if (result && !result.ok) setPickerNotice(result.error);
    setIsUploadingPickerFile(false);
    input.value = '';
  };

  const handleConfirmDocPicker = () => {
    const allFiles = new Map<string, DocumentFileItem>();
    docPickerFolders.forEach((folder) => folder.files.forEach((f) => allFiles.set(f.id, f)));
    setAttachedFiles((prev) => {
      const keep = prev.filter((f) => selectedDocPickerFiles.includes(f.id) || !allFiles.has(f.id));
      const seen = new Set(keep.map((f) => f.id));
      const added = selectedDocPickerFiles
        .filter((id) => !seen.has(id) && allFiles.has(id))
        .map((id) => {
          const f = allFiles.get(id)!;
          return { id: f.id, name: f.name, size: f.size };
        });
      return [...keep, ...added];
    });
    setSelectedDocPickerFiles([]);
    setShowDocPickerModal(false);
  };

  // ─── Reviews State ────────────────────────────────────────────────────────────
  const { reviews: reviewsList, loading: reviewsLoading, error: reviewsError } = useLawyerReviews(lawyer.userId);
  const [selectedReviewStar, setSelectedReviewStar] = useState<number | 'all'>('all');
  const [reviewPage, setReviewPage] = useState<number>(1);
  const [helpfulCounts, setHelpfulCounts] = useState<{ [id: string | number]: number }>({});
  const [userVotedHelpful, setUserVotedHelpful] = useState<{ [id: string | number]: boolean }>({});

  // Fetch booked slots for the selected day to prevent duplicate appointments
  const [slotsRefreshKey, setSlotsRefreshKey] = useState<number>(0);
  const isSlotBooked = (slot: string) => bookedSlots.some((booked) => slotsOverlap(booked, slot));

  // ─── Lawyer unavailability (blocked days / time ranges) ──────────────────────
  const [monthBlocks, setMonthBlocks] = useState<UnavailabilityBlock[]>([]);
  const [availabilityRefreshKey, setAvailabilityRefreshKey] = useState<number>(0);
  useEffect(() => {
    if (!LAWYER_UUID_REGEX.test(lawyer.userId)) return;
    let stale = false;
    const lastDay = new Date(currentYear, currentMonth + 1, 0).getDate();
    const mm = String(currentMonth + 1).padStart(2, '0');
    getLawyerUnavailabilityAction(lawyer.userId, `${currentYear}-${mm}-01`, `${currentYear}-${mm}-${String(lastDay).padStart(2, '0')}`)
      .then((blocks) => {
        if (!stale) setMonthBlocks(blocks);
      })
      .catch(() => {
        if (!stale) setMonthBlocks([]);
      });
    return () => {
      stale = true;
    };
  }, [lawyer.userId, currentYear, currentMonth, availabilityRefreshKey]);

  const isoForDay = (day: number) =>
    `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const blocksForDay = (day: number) => monthBlocks.filter((b) => b.date === isoForDay(day));
  const isDayFullyUnavailable = (day: number) => blocksForDay(day).some((b) => b.startMinutes === null);
  const selectedDayBlocks = blocksForDay(selectedDay);
  const selectedDayFullyBlocked = selectedDayBlocks.some((b) => b.startMinutes === null);
  const isSlotUnavailable = (slot: string) => {
    if (selectedDayFullyBlocked) return true;
    const r = parseSlotMinutes(slot);
    return !!r && selectedDayBlocks.some((b) => b.startMinutes !== null && b.endMinutes !== null && r.start < b.endMinutes && b.startMinutes < r.end);
  };

  useEffect(() => {
    if (!lawyer.userId) return;
    let stale = false;
    setLoadingSlots(true);
    const dateStr = `${MONTH_NAMES[currentMonth]} ${selectedDay}, ${currentYear}`;
    getBookedSlotsForLawyer(lawyer.userId, dateStr)
      .then((slots) => {
        if (stale) return;
        // The chosen time moves to a free slot in the effect below.
        setBookedSlots(slots || []);
      })
      .finally(() => {
        if (!stale) setLoadingSlots(false);
      });
    return () => {
      stale = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lawyer.userId, selectedDay, currentMonth, currentYear, slotsRefreshKey]);

  // ─── Cases State ──────────────────────────────────────────────────────────────
  const [casePage, setCasePage] = useState<number>(1);
  const [caseDir, setCaseDir] = useState<number>(1);
  const [viewingCase, setViewingCase] = useState<CaseDetailItem | null>(null);

  const todayPH = getTodayPH();
  const totalDaysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(currentYear, currentMonth, 1).getDay(); // 0 = Sun

  const daysInMonth = useMemo(() => {
    const slots: Array<{ day: number | null }> = [];
    for (let i = 0; i < firstDayOfWeek; i++) {
      slots.push({ day: null });
    }
    for (let d = 1; d <= totalDaysInMonth; d++) {
      slots.push({ day: d });
    }
    return slots;
  }, [firstDayOfWeek, totalDaysInMonth]);

  // ─── Regular consultation hours + the month's day indicators ─────────────────
  // Slots come from the attorney's weekly hours; each day is marked open, fully booked or not
  // available, and days that already have bookings get a dot (getBookingMonthAction).
  const [hours, setHours] = useState<ConsultationHours>(DEFAULT_CONSULTATION_HOURS);
  const [monthMarks, setMonthMarks] = useState<{ key: string; days: CalendarDayMark[] } | null>(null);
  const [hoursRefreshKey, setHoursRefreshKey] = useState<number>(0);
  const monthMarksKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
  useEffect(() => {
    if (!LAWYER_UUID_REGEX.test(lawyer.userId)) return;
    let stale = false;
    getBookingMonthAction(lawyer.userId, monthMarksKey)
      .then((res) => {
        if (stale) return;
        if (res.success) {
          setHours(res.hours);
          setMonthMarks({ key: monthMarksKey, days: res.days });
        } else {
          setMonthMarks(null);
        }
      })
      .catch(() => {
        if (!stale) setMonthMarks(null);
      });
    return () => {
      stale = true;
    };
  }, [lawyer.userId, monthMarksKey, availabilityRefreshKey, slotsRefreshKey, hoursRefreshKey]);
  const currentMarks = monthMarks?.key === monthMarksKey ? monthMarks.days : null;
  const markForDay = (day: number) => currentMarks?.find((m) => m.day === day) ?? null;
  const selectedWeekday = new Date(currentYear, currentMonth, Math.min(selectedDay, totalDaysInMonth)).getDay();
  const daySlots = useMemo(() => slotStartsFor(hours, selectedWeekday).map((s) => slotLabel(s)), [hours, selectedWeekday]);

  // The chosen time is always one of the day's free slots (the owner may pick any unbooked one).
  const slotIsFree = (s: string) => !bookedSlots.some((b) => slotsOverlap(b, s)) && (isOwner || !isSlotUnavailable(s));
  const selectedTimeSlot =
    daySlots.includes(pickedTimeSlot) && (loadingSlots || slotIsFree(pickedTimeSlot))
      ? pickedTimeSlot
      : daySlots.find(slotIsFree) ?? daySlots[0] ?? '';

  // Clients land on a bookable day: when a month's indicators arrive and the selected day can't
  // be booked, move to the next open day (state adjusted during render, once per load).
  const [marksSeen, setMarksSeen] = useState<CalendarDayMark[] | null>(null);
  if (currentMarks !== marksSeen) {
    setMarksSeen(currentMarks);
    const current = !isOwner && currentMarks ? currentMarks.find((m) => m.day === selectedDay) : null;
    if (current && current.state !== 'open') {
      const next = currentMarks!.find((m) => m.day > selectedDay && m.state === 'open');
      if (next) setSelectedDay(next.day);
    }
  }

  const selectedDateObj = useMemo(() => {
    const validDay = Math.min(selectedDay, totalDaysInMonth);
    return new Date(currentYear, currentMonth, validDay);
  }, [currentYear, currentMonth, selectedDay, totalDaysInMonth]);

  const selectedDayOfWeek = useMemo(() => {
    return selectedDateObj.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();
  }, [selectedDateObj]);

  const selectedMonthName = MONTH_NAMES[currentMonth];
  const selectedMonthShort = MONTH_SHORT_NAMES[currentMonth];
  const isTodaySelected =
    currentYear === todayPH.year && currentMonth === todayPH.month && selectedDay === todayPH.day;
  const clampDay = (year: number, month: number) =>
    setSelectedDay((d) => Math.min(d, new Date(year, month + 1, 0).getDate()));

  const handlePrevMonth = () => {
    const y = currentMonth === 0 ? currentYear - 1 : currentYear;
    const m = currentMonth === 0 ? 11 : currentMonth - 1;
    setCurrentYear(y);
    setCurrentMonth(m);
    clampDay(y, m);
  };

  const handleNextMonth = () => {
    const y = currentMonth === 11 ? currentYear + 1 : currentYear;
    const m = currentMonth === 11 ? 0 : currentMonth + 1;
    setCurrentYear(y);
    setCurrentMonth(m);
    clampDay(y, m);
  };

  const handleGoToToday = () => {
    const t = getTodayPH();
    setCurrentYear(t.year);
    setCurrentMonth(t.month);
    setSelectedDay(t.day);
  };

  const resetBookingForm = () => {
    const t = getTodayPH();
    setCurrentYear(t.year);
    setCurrentMonth(t.month);
    setSelectedDay(t.day);
    setSelectedTimeSlot(DEFAULT_TIME_SLOT);
    setCommunicationMode('video');
    setSubject('');
    setDescription('');
    setAttachedFiles([]);
    setAgreedToTerms(false);
    setBookingError(null);
    setInvalidField(null);
    try {
      localStorage.removeItem(bookingDraftKey(lawyer.userId));
    } catch {
      // storage unavailable — nothing to clear
    }
  };

  const handleClearInputs = () => {
    resetBookingForm();
    setBookingStatus('idle');
  };

  const savedNoticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (savedNoticeTimer.current) clearTimeout(savedNoticeTimer.current);
  }, []);

  const handleSaveDraft = () => {
    const draft: BookingDraft = {
      year: currentYear,
      month: currentMonth,
      day: selectedDay,
      timeSlot: selectedTimeSlot,
      communicationMode,
      subject,
      description,
      attachments: attachedFiles,
      agreedToTerms,
      savedAt: new Date().toISOString(),
    };
    try {
      localStorage.setItem(bookingDraftKey(lawyer.userId), JSON.stringify(draft));
      setBookingError(null);
      setBookingStatus('saved');
      // One timer: saving again restarts the 5s window instead of an older timer cutting it short.
      if (savedNoticeTimer.current) clearTimeout(savedNoticeTimer.current);
      savedNoticeTimer.current = setTimeout(() => setBookingStatus((s) => (s === 'saved' ? 'idle' : s)), 5000);
    } catch {
      setBookingError('Your browser blocked saving the draft. Please check your storage settings and try again.');
    }
  };

  const flagInvalid = (field: 'subject' | 'terms', message: string) => {
    setBookingError(message);
    setInvalidField(field);
    (field === 'subject' ? subjectShake : termsShake).start(SHAKE);
  };

  const handleSubmitBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingBooking) return;
    setBookingError(null);
    setInvalidField(null);

    if (isUploadingAttachment) {
      setBookingError('Please wait for your files to finish uploading.');
      return;
    }
    if (!subject.trim()) {
      flagInvalid('subject', 'Please enter a consultation subject.');
      return;
    }
    if (!agreedToTerms) {
      flagInvalid('terms', 'Please agree to the attorney-client privilege review terms.');
      return;
    }
    if (!daySlots.includes(selectedTimeSlot) || markForDay(selectedDay)?.state === 'closed') {
      setBookingError(
        daySlots.length === 0
          ? 'The attorney does not take consultations on this day. Please choose another date.'
          : 'Please choose one of the available time slots.'
      );
      return;
    }
    if (isSlotBooked(selectedTimeSlot)) {
      setBookingError('This time slot is already booked. Please choose another time slot.');
      return;
    }
    if (isSlotUnavailable(selectedTimeSlot)) {
      setBookingError(
        selectedDayFullyBlocked
          ? 'The attorney is unavailable on this date. Please choose another day.'
          : 'The attorney is unavailable at this time. Please choose another time slot.'
      );
      return;
    }

    // Valid: open the review sheet; the request is only sent from there. One idempotency key per
    // review, so a double click or a retry after a timeout can't create a second booking.
    bookingRequestId.current = crypto.randomUUID();
    setConfirmError(null);
    setConfirmDetails({
      dateStr: `${selectedMonthName} ${selectedDay}, ${currentYear}`.toUpperCase(),
      timeSlot: selectedTimeSlot.split(' • ')[0],
      communicationMode,
      lawyerName: lawyer.fullName,
      lawyerLines: [
        [lawyer.rollNumber && `Roll No. ${lawyer.rollNumber}`, lawyer.ibpChapter && `IBP ${lawyer.ibpChapter}`]
          .filter(Boolean)
          .join('  |  '),
        (lawyer.practiceAreas || []).join(' • '),
      ],
      rate: standardFee,
      subject: subject.trim(),
      description: description.trim(),
      attachments: attachedFiles,
    });
    setConfirmPhase('review');
  };

  const bookingRequestId = useRef<string | null>(null);

  const handleConfirmBooking = async () => {
    if (submittingBooking) return;
    setConfirmError(null);
    setConfirmPhase('submitting');
    setSubmittingBooking(true);
    try {
      // Keep the loader on screen long enough to read, even when the server answers instantly.
      const [res] = await Promise.all([
        bookConsultationAction({
          lawyerId: lawyer.userId,
          dateStr: `${selectedMonthName} ${selectedDay}, ${currentYear}`,
          timeSlot: selectedTimeSlot,
          communicationMode,
          subject,
          description,
          documentIds: attachedFiles.map((f) => f.id),
          requestId: bookingRequestId.current ?? undefined,
        }),
        new Promise((resolve) => setTimeout(resolve, 1300)),
      ]);

      if (!('consultation' in res) || !res.consultation) {
        const msg = ('error' in res && res.error) || 'Error submitting booking';
        setConfirmError(msg);
        setBookingError(msg);
        // The badge writes an X; "Review Booking" returns to the sheet with the error on top.
        setConfirmPhase('error');
        setSlotsRefreshKey((k) => k + 1);
        return;
      }

      setConfirmPhase('success');
      resetBookingForm();
      setBookingStatus('idle');
      setSlotsRefreshKey((k) => k + 1);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error submitting booking';
      setConfirmError(msg);
      setBookingError(msg);
      setConfirmPhase('error');
    } finally {
      setSubmittingBooking(false);
    }
  };

  const closeConfirm = () => {
    if (confirmPhase === 'submitting') return;
    setConfirmPhase(null);
  };

  const toggleHelpful = (idx: string | number) => {
    const hasVoted = userVotedHelpful[idx];
    setHelpfulCounts((prev) => ({
      ...prev,
      [idx]: (prev[idx] || 0) + (hasVoted ? -1 : 1),
    }));
    setUserVotedHelpful((prev) => ({
      ...prev,
      [idx]: !hasVoted,
    }));
  };

  // With persisted data (owner mode) unset fees stay unset instead of showing sample prices.
  const isLive = !!details;
  const standardFee: number | null = isLive ? lawyer.feeStandard60min ?? null : lawyer.feeStandard60min ?? 1500;
  const initialFee: number | null = isLive ? lawyer.feeInitial30min ?? null : lawyer.feeInitial30min ?? 700;
  const extendedFee: number | null = isLive ? lawyer.feeExtended120min ?? null : lawyer.feeExtended120min ?? 2300;

  const bioText = isLive
    ? lawyer.about?.trim() || (isOwner ? 'You haven’t written an introduction yet. Click “Edit Information” to tell clients about your practice.' : 'No bio available.')
    : LOREM_BIO;
  const ownerEmpty = (what: string) =>
    detailsLoading
      ? 'Loading…'
      : isOwner
        ? `No ${what} added yet. Click “Edit Information” to add some.`
        : `No ${what} listed.`;

  const practiceAreaItems = details
    ? details.practiceAreaDetails.length
      ? details.practiceAreaDetails.map((p) => (p.description ? `${p.area}: ${p.description}` : p.area))
      : lawyer.practiceAreas || []
    : undefined;
  const experienceItems = details?.experiences.map((e) =>
    [
      [e.title, e.organization].filter(Boolean).join(' — '),
      e.years ? `(${e.years})` : '',
      e.description ? `· ${e.description}` : '',
    ].filter(Boolean).join(' ')
  );
  const serviceItems = details?.services.map((s) => (s.description ? `${s.name}: ${s.description}` : s.name));
  const barItems = details
    ? [
        lawyer.rollNumber ? `Roll of Attorneys No. ${lawyer.rollNumber}` : '',
        lawyer.ibpChapter ? `Member, Integrated Bar of the Philippines — ${lawyer.ibpChapter} Chapter` : '',
        lawyer.experienceYears != null ? `${lawyer.experienceYears} year${lawyer.experienceYears === 1 ? '' : 's'} of legal practice` : '',
      ].filter(Boolean)
    : undefined;
  const barTitle = isLive
    ? lawyer.barPasserYear
      ? `Philippine Bar Examination Passer (${lawyer.barPasserYear})`
      : 'Philippine Bar Examination Passer'
    : `Philippine Bar Examination Passer (${lawyer.barPasserYear ?? 2022})`;
  const educationCards = details?.education.map((edu) => ({
    id: edu.id,
    title: `${edu.degree}${edu.start_year || edu.end_year ? ` (${[edu.start_year, edu.end_year].filter(Boolean).join(' - ')})` : ''}`,
    subtitle: edu.school || undefined,
    items: (edu.description || '').split('\n').map((l) => l.trim()).filter(Boolean),
    isLaw: /juris|law|ll\.?\s?[bm]/i.test(edu.degree),
  }));

  const rateRows: { label: string; value: number | null }[] = [
    { label: 'Initial Consultation (30 mins)', value: initialFee },
    { label: 'Standard Consultation (1 hr)', value: standardFee },
    { label: 'Extended Consultation (2 hrs)', value: extendedFee },
  ];

  // Filtered reviews and dynamic rating metrics
  const filteredReviews = reviewsList.filter((rev) => {
    if (selectedReviewStar === 'all') return true;
    return rev.stars === selectedReviewStar;
  });

  const averageRating =
    reviewsList.length > 0
      ? reviewsList.reduce((acc, r) => acc + r.stars, 0) / reviewsList.length
      : 0;

  const REVIEWS_PER_PAGE = 4;
  const totalReviewsCount = reviewsList.length;
  const totalReviewPages = Math.max(1, Math.ceil(filteredReviews.length / REVIEWS_PER_PAGE));
  const pagedReviews = filteredReviews.slice(
    (reviewPage - 1) * REVIEWS_PER_PAGE,
    reviewPage * REVIEWS_PER_PAGE
  );

  // Cases handled matching Figma design (persisted cases when available, 4 per page)
  const CASES_PER_PAGE = 4;
  const allCases: Array<{ id: number | string; docket: string; title: string; content: string }> = details
    ? details.caseSummaries.map((c) => ({
        id: c.id,
        docket: caseDocketLabel(c),
        title: c.title,
        content: c.anonymized_summary,
      }))
    : [1, 2, 3, 4].map((id) => ({
        id,
        docket: 'SUBJECT MATTER & CASE DOCKET',
        title: 'Makati Residential Lease Deposit Dispute & Formal Notice to Vacate',
        content: LOREM_CASE,
      }));
  const totalCasePages = details ? Math.max(1, Math.ceil(allCases.length / CASES_PER_PAGE)) : 4;
  const safeCasePage = Math.min(casePage, totalCasePages);
  const casesHandled = details
    ? allCases.slice((safeCasePage - 1) * CASES_PER_PAGE, safeCasePage * CASES_PER_PAGE)
    : allCases;

  // Documents vault: current folder + its files
  const currentPickerFolder =
    docPickerFolders.find((f) => f.id === activePickerFolderId) || docPickerFolders[0];
  const pickerFiles = (currentPickerFolder?.files || []) as Array<DocumentFileItem & { updatedAt?: string }>;

  const backArrow = (
    <motion.svg
      variants={{ rest: { x: 0 }, hover: { x: -4 }, pressed: { x: -2 } }}
      transition={{ type: 'spring', stiffness: 500, damping: 22 }}
      className="w-4 h-4 text-[#341512]/80 shrink-0"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2.2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
    </motion.svg>
  );
  const backClasses =
    'neu-raised-sm bg-[#E5D8CB] hover:bg-[#D39758]/20 rounded-[12px] px-4 py-2 inline-flex items-center gap-2.5 font-lora text-xs sm:text-[13px] font-semibold text-[#341512]/80 hover:text-[#341512] transition-colors cursor-pointer';

  const fieldRing = (on: boolean) =>
    on ? 'ring-2 ring-rose-400/80' : 'ring-0 ring-transparent';

  // Under the portal's loading screen: the data above keeps loading, and the page mounts (so all
  // of its entrance animations play) only once the loading screen lifts.
  if (!revealed) return <div aria-hidden className="min-h-[60vh]" />;

  return (
    <MotionConfig reducedMotion="user">
      <div className="space-y-6 sm:space-y-7 select-none" style={{ zoom: SCREEN_SCALE }}>
        {/* ─── Back Navigation ────────────────── */}
        {!isOwner && (
        <motion.div {...enter(0, 10)} className="flex items-center justify-start pb-1">
          {onBack ? (
            <Key onClick={onBack} className={backClasses}>
              {backArrow}
              <span>Back to Lawyers Directory</span>
            </Key>
          ) : (
            <KeyLink href="/client/lawyers" className={backClasses}>
              {backArrow}
              <span>Back to Lawyers Directory</span>
            </KeyLink>
          )}
        </motion.div>
        )}

        {/* ─── Owner: save confirmation notice ─── */}
        <AnimatePresence initial={false}>
          {isOwner && ownerNotice && (
            <Collapse key="owner-notice" gap={24}>
              {/* The same pressed-in notice as the rest of the system (not a flat yellow box). */}
              <NeuAlert tone="success" onDismiss={() => setOwnerNotice(null)}>
                {ownerNotice}
              </NeuAlert>
            </Collapse>
          )}
        </AnimatePresence>

        {/* ─── Lawyer Banner Header Card ───────── */}
        <motion.div
          initial={{ opacity: 0, y: 26, scale: 0.98, filter: 'blur(10px)' }}
          animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
          transition={{ duration: 0.9, delay: 0.12, ease: EASE_OUT }}
          className="neu-raised-highlight relative w-full rounded-[20px] sm:rounded-[22px] px-6 py-5 sm:px-8 sm:py-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-5 select-none"
        >
          {/* One soft sheen sweeps across the banner right after it lands */}
          <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
            <motion.span
              initial={{ x: '-140%' }}
              animate={{ x: '420%' }}
              transition={{ duration: 1.5, delay: 1.0, ease: 'easeInOut' }}
              className="absolute inset-y-0 w-1/4 -skew-x-12 bg-gradient-to-r from-transparent via-white/30 to-transparent"
            />
          </div>

          <div className="flex items-center gap-3.5 sm:gap-4">
            {/* Avatar — from sm up, a quarter taller than the info column and centred on it, with
                the details close beside it. Phones keep a fixed size (the column is too narrow
                there for a tall avatar to leave the text room). */}
            <motion.div
              initial={{ opacity: 0, scale: 0.6, rotate: -8 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 220, damping: 18, delay: 0.35 }}
              className="shrink-0"
            >
              <div
                style={{ '--banner-avatar-size': bannerAvatarSize ? `${bannerAvatarSize}px` : undefined } as React.CSSProperties}
                className="size-[72px] sm:size-[var(--banner-avatar-size,6.5rem)] flex items-center justify-center overflow-hidden rounded-full text-[#341512]/80"
              >
                <ProfilePhoto src={photoUrl} alt={lawyer.fullName} className="w-full h-full" ringed />
              </div>
            </motion.div>

            {/* Lawyer Info */}
            <div ref={setBannerInfoEl} className="space-y-1">
              {/* The name slides up out of a mask — the one "signature" moment on the page */}
              <div className="overflow-hidden pb-1 -mb-1">
                <motion.h1
                  initial={{ y: '110%' }}
                  animate={{ y: 0 }}
                  transition={{ duration: 0.85, delay: 0.5, ease: EASE_OUT }}
                  className="font-lora text-xl sm:text-2xl font-bold text-[#341512]/80 leading-snug"
                >
                  {lawyer.fullName}
                </motion.h1>
              </div>
              <motion.p {...enter(0.62)} className="text-xs sm:text-[13px] text-[#341512]/80 font-inter font-normal leading-tight">
                Roll No. {lawyer.rollNumber || (isLive ? '—' : '58942')} <span className="mx-2 text-[#341512]/80">|</span> IBP {lawyer.ibpChapter?.toUpperCase() || (isLive ? '—' : 'MAKATI')}
              </motion.p>
              <motion.div {...enter(0.7)} className="flex items-center gap-1.5 text-xs sm:text-[13px] text-[#341512]/80 font-inter">
                <svg className="w-3.5 h-3.5 fill-transparent stroke-current text-[#341512]/80" viewBox="0 0 20 20" strokeWidth="1.6">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                {totalReviewsCount > 0 ? (
                  <span>
                    <CountUp value={averageRating} decimals={1} delay={0.8} /> (<CountUp value={totalReviewsCount} duration={0.7} delay={0.8} /> {totalReviewsCount === 1 ? 'Review' : 'Reviews'})
                  </span>
                ) : (
                  <span>No reviews yet</span>
                )}
                {(!isLive || lawyer.experienceYears != null) && (
                  <>
                    <span className="mx-1">•</span>
                    <span>{lawyer.experienceYears ?? 9} years of practice</span>
                  </>
                )}
              </motion.div>
              <motion.p {...enter(0.78)} className="text-xs sm:text-[13px] text-[#341512]/80 font-inter">
                {lawyer.practiceAreas && lawyer.practiceAreas.length > 0
                  ? lawyer.practiceAreas.join(' • ')
                  : isLive
                    ? ''
                    : 'Labor & Employment • Corporate • Civil Law'}
              </motion.p>
            </div>
          </div>

          {/* Rate on the right side */}
          <motion.div {...enter(0.75)} className="flex flex-col items-start md:items-end gap-3 shrink-0 self-start md:self-center">
            <div className="flex items-baseline gap-1">
              {standardFee != null ? (
                <>
                  <span className="font-lora text-2xl sm:text-3xl font-bold text-[#341512]/80">
                    <CountUp value={standardFee} prefix="₱" duration={1.2} delay={0.85} />
                  </span>
                  <span className="text-xs sm:text-sm font-inter text-[#341512]/80 font-normal">/per hour</span>
                </>
              ) : (
                <span className="font-inter text-xs sm:text-sm italic text-[#341512]/60">Rate not set yet</span>
              )}
            </div>
          </motion.div>
        </motion.div>

        {/* ─── Navigation Tabs: a single raised pill glides between tabs ───── */}
        <div className="flex flex-wrap items-center justify-between gap-3">
        <motion.div
          variants={TAB_BAR_VARIANTS}
          initial="hidden"
          animate="show"
          role="tablist"
          aria-label="Lawyer profile sections"
          onKeyDown={handleTabKeyDown}
          className="flex flex-wrap items-center gap-x-3 gap-y-2 sm:gap-x-6 pt-1 pb-1 select-none"
        >
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <motion.div key={tab.key} variants={TAB_ITEM_VARIANTS} role="presentation" className="flex">
                <Key
                  id={`lawyer-tab-${tab.key}`}
                  role="tab"
                  aria-selected={isActive}
                  aria-controls={`lawyer-panel-${tab.key}`}
                  tabIndex={isActive ? 0 : -1}
                  onClick={() => changeTab(tab.key)}
                  className={`rounded-[12px] px-6 py-2 font-lora text-sm sm:text-base font-semibold cursor-pointer transition-colors ${isActive ? 'text-[#341512]' : 'text-[#341512]/70 hover:text-[#341512]'
                    }`}
                >
                  {isActive && (
                    <HighlightPill layoutId="lawyer-tab-pill" radius={12} intro={introActive ? 1.35 : false} />
                  )}
                  <span className="relative z-10 inline-flex items-center gap-2">
                    {tab.label}
                    {tab.key === 'reviews' && totalReviewsCount > 0 && (
                      <span className="rounded-full bg-[#C58B3C]/20 px-2 py-0.5 font-inter text-[10.5px] font-bold text-[#7A4E14] tabular-nums">
                        {totalReviewsCount}
                        <span className="sr-only"> reviews</span>
                      </span>
                    )}
                  </span>
                </Key>
              </motion.div>
            );
          })}
        </motion.div>

          {/* Owner-only edit action on the right of the tab bar (Figma: "Edit Information" / "Edit Visible Cases") */}
          <AnimatePresence mode="wait" initial={false}>
            {isOwner && details && (activeTab === 'about' || activeTab === 'cases') && (
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0, transition: { duration: 0.35, delay: introActive ? 1.2 : 0, ease: EASE_OUT } }}
                exit={{ opacity: 0, y: -6, transition: { duration: 0.15 } }}
                className="flex ml-auto"
              >
                <Key
                  onClick={() => (activeTab === 'about' ? setShowEditProfile(true) : setShowManageCases(true))}
                  className="neu-raised-highlight-sm rounded-[12px] px-6 py-2 font-lora text-sm sm:text-base font-semibold text-[#341512]/80 hover:text-[#341512] cursor-pointer transition-colors"
                >
                  <span className="relative z-10">{activeTab === 'about' ? 'Edit Information' : 'Edit Visible Cases'}</span>
                </Key>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ─── Tab panels: slide in from the side you navigated toward ───── */}
        <IntroContext.Provider value={introDelay}>
          <AnimatePresence mode="wait" custom={panelCustom}>
            {/* ─── TAB 1: ABOUT ─────────────────────────────────── */}
            {activeTab === 'about' && (
              <motion.div
                key="about"
                id="lawyer-panel-about"
                role="tabpanel"
                aria-labelledby="lawyer-tab-about"
                custom={panelCustom}
                variants={PANEL_VARIANTS}
                initial="enter"
                animate="center"
                exit="exit"
                className="space-y-8"
              >
                {/* Top Row: Bio (flexible) & Consultation Rates (fixed width — edit the px value) */}
                <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_415px] gap-6 items-stretch">
                  {/* Bio Card */}
                  <Reveal className="h-full">
                    <div className="relative h-full rounded-[20px] sm:rounded-[24px] neu-recessed bg-[#E5D8CB] flex flex-col max-h-[220px] sm:max-h-[235px] overflow-hidden">
                      <div
                        ref={bioRef}
                        onScroll={updateBioFade}
                        className="flex-1 min-h-0 overflow-y-auto neu-scrollbar-discrete space-y-3 py-6 sm:py-7 pl-6 sm:pl-7 pr-3 sm:pr-4 mr-1.5"
                      >
                        <p className="text-xs sm:text-[13px] text-[#341512]/80 leading-relaxed text-justify font-inter whitespace-pre-line">
                          {bioText}
                        </p>
                      </div>
                      {/* Soft fade appears only while there's more bio to scroll */}
                      <AnimatePresence>
                        {showBioFade && (
                          <motion.div
                            key="bio-fade"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.25 }}
                            className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-[#E5D8CB] to-transparent"
                          />
                        )}
                      </AnimatePresence>
                    </div>
                  </Reveal>

                  {/* Consultation Rates Card */}
                  <Reveal className="h-full" delay={0.08}>
                    <div className="h-full rounded-[20px] sm:rounded-[24px] px-6 py-6 sm:px-7 sm:py-7 neu-raised-highlight flex flex-col justify-center space-y-4 sm:space-y-5">
                      <h3 className="font-lora text-xl sm:text-2xl font-bold text-[#341512]/80 text-center">
                        Consultation Rates:
                      </h3>

                      <motion.div
                        className="space-y-3.5 sm:space-y-4 font-inter text-[#341512]/80"
                        initial="hidden"
                        whileInView="show"
                        viewport={{ once: true, amount: 0.5 }}
                        variants={{ hidden: {}, show: { transition: { staggerChildren: 0.12, delayChildren: 0.2 + introDelay } } }}
                      >
                        {rateRows.map((row) => (
                          <motion.div
                            key={row.label}
                            variants={{
                              hidden: { opacity: 0, x: 18 },
                              show: { opacity: 1, x: 0, transition: { duration: 0.5, ease: EASE_OUT } },
                            }}
                            className="flex justify-between items-baseline gap-4"
                          >
                            <span className="text-xs sm:text-[15px] font-lora font-medium text-[#341512]/80">{row.label}</span>
                            <div className="text-right shrink-0 whitespace-nowrap">
                              {row.value != null ? (
                                <>
                                  <span className="font-lora font-bold text-sm sm:text-base text-[#341512]/80">
                                    <CountUp value={row.value} prefix="₱" />
                                  </span>
                                  <span className="text-xs sm:text-[13px] text-[#341512]/80 ml-0.5">/session</span>
                                </>
                              ) : (
                                <span className="text-xs sm:text-[13px] italic text-[#341512]/60">Not set</span>
                              )}
                            </div>
                          </motion.div>
                        ))}
                      </motion.div>
                    </div>
                  </Reveal>
                </div>

                {/* Details that load separately: a loader while they arrive, a notice if they fail */}
                {detailsFailed && (
                  <NeuAlert
                    tone="error"
                    title="Some profile details couldn't be loaded"
                    action={
                      <NeuButton size="sm" variant="secondary" onClick={retryDetails}>
                        Try again
                      </NeuButton>
                    }
                  >
                    Practice areas, experience and education may be missing below.
                  </NeuAlert>
                )}
                {detailsLoading ? (
                  <PanelLoader label="Loading profile details..." className="min-h-[16rem]" />
                ) : (
                <>
                {/* Professional Background Section */}
                <div className="space-y-4">
                  <Reveal>
                    <h2 className="font-lora text-xl sm:text-2xl font-bold text-[#341512]/80">Professional Background</h2>
                  </Reveal>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
                    <InfoCard
                      title="Areas of Practice"
                      items={practiceAreaItems}
                      emptyText={ownerEmpty('areas of practice')}
                      icon={
                        <LineIcon>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
                        </LineIcon>
                      }
                    />
                    <InfoCard
                      title="Legal Experience"
                      delay={0.08}
                      items={experienceItems}
                      emptyText={ownerEmpty('legal experience')}
                      icon={
                        <LineIcon>
                          <path strokeLinecap="round" strokeLinejoin="round" d="m14 13-7.5 7.5a2.12 2.12 0 1 1-3-3L11 10" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="m16 16 6-6" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="m8 8 6-6" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="m9 7 8 8" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="m21 11-8-8" />
                        </LineIcon>
                      }
                    />
                    <InfoCard
                      title="Consultation Services"
                      items={serviceItems}
                      emptyText={ownerEmpty('consultation services')}
                      icon={
                        <LineIcon>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 6.75 3.19-1.595A3 3 0 0 1 7.234 16H18a3 3 0 0 0 3-3V6a3 3 0 0 0-3-3H6a3 3 0 0 0-3 3v12.75Z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 16v2.25a2.25 2.25 0 0 1-2.25 2.25H9.75l-2.25 1.125" />
                        </LineIcon>
                      }
                    />
                    <InfoCard
                      title={barTitle}
                      delay={0.08}
                      items={barItems}
                      emptyText={ownerEmpty('bar details')}
                      icon={
                        <LineIcon>
                          <circle cx="12" cy="8" r="5.5" strokeLinecap="round" strokeLinejoin="round" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.5 13.5 17.5 21l-5.5-2.75L6.5 21l2-7.5" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="m9.75 8 1.5 1.5 3-3" />
                        </LineIcon>
                      }
                    />
                  </div>
                </div>

                {/* Educational Background Section */}
                <div className="space-y-4">
                  <Reveal>
                    <h2 className="font-lora text-xl sm:text-2xl font-bold text-[#341512]/80">Educational Background</h2>
                  </Reveal>
                  {educationCards ? (
                    educationCards.length === 0 ? (
                      <Reveal>
                        <p className="text-xs sm:text-[13px] text-[#341512]/60 italic font-inter">{ownerEmpty('educational background')}</p>
                      </Reveal>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
                        {educationCards.map((edu, i) => (
                          <InfoCard
                            key={edu.id}
                            title={edu.title}
                            subtitle={edu.subtitle}
                            delay={i % 2 ? 0.08 : 0}
                            items={edu.items}
                            emptyText=" "
                            icon={
                              edu.isLaw ? (
                                <ScalesIcon className="w-8 h-8 text-[#341512]/80 shrink-0" />
                              ) : (
                                <LineIcon>
                                  <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                                  <path d="M6 12v5c3 3 9 3 12 0v-5" />
                                </LineIcon>
                              )
                            }
                          />
                        ))}
                      </div>
                    )
                  ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
                    <InfoCard
                      title="Juris Doctor (2017 - 2021)"
                      subtitle="University of the Philippines - Cebu"
                      icon={<ScalesIcon className="w-8 h-8 text-[#341512]/80 shrink-0" />}
                    />
                    <InfoCard
                      title="Bachelor of Arts in Political Science (2013 - 2017)"
                      subtitle="University of San Carlos - Main Campus"
                      delay={0.08}
                      icon={
                        <LineIcon>
                          <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                          <path d="M6 12v5c3 3 9 3 12 0v-5" />
                        </LineIcon>
                      }
                    />
                  </div>
                  )}
                </div>
                </>
                )}
              </motion.div>
            )}

            {/* ─── TAB 2: REVIEWS ─────────────────────────────────── */}
            {activeTab === 'reviews' && (
              <motion.div
                key="reviews"
                id="lawyer-panel-reviews"
                role="tabpanel"
                aria-labelledby="lawyer-tab-reviews"
                custom={panelCustom}
                variants={PANEL_VARIANTS}
                initial="enter"
                animate="center"
                exit="exit"
                className="space-y-6"
              >
                <AnimatePresence initial={false}>
                  {reviewsError && (
                    <Collapse key="reviews-error" gap={24}>
                      <NeuAlert tone="error">{reviewsError}</NeuAlert>
                    </Collapse>
                  )}
                </AnimatePresence>

                {/* Main Large Reviews Outer Container (Recessed Look) */}
                <Reveal>
                  <div className="rounded-[28px] sm:rounded-[32px] p-6 sm:p-9 neu-recessed bg-[#E5D8CB] space-y-6 select-none">
                    {reviewsLoading && <p role="status" className="sr-only">Loading reviews…</p>}

                    {/* Score header: 4.9/5 ★★★★★ (53 Reviews) */}
                    <div className="flex flex-wrap items-baseline gap-2 sm:gap-3">
                      <span className="font-lora text-4xl sm:text-5xl font-bold text-[#341512]/80 leading-none">
                        <CountUp value={averageRating} decimals={1} duration={1.1} />
                      </span>
                      <span className="font-lora text-2xl sm:text-3xl font-bold text-[#341512]/80">/5</span>

                      {/* Stars pop in one by one */}
                      <div className="flex items-center gap-1 text-[#C58B3C] text-xl sm:text-2xl ml-2 sm:ml-4">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <motion.span
                            key={s}
                            initial={{ scale: 0, rotate: -45, opacity: 0 }}
                            animate={{ scale: 1, rotate: 0, opacity: 1 }}
                            transition={{ type: 'spring', stiffness: 420, damping: 15, delay: 0.25 + s * 0.07 }}
                            className="inline-flex"
                          >
                            <StarIcon filled={s <= Math.round(averageRating)} className="w-5 h-5 sm:w-6 sm:h-6" />
                          </motion.span>
                        ))}
                      </div>

                      <span className="font-lora text-sm sm:text-base font-normal text-[#341512]/80 ml-2">
                        (<CountUp value={totalReviewsCount} duration={0.7} /> Reviews)
                      </span>
                    </div>

                    {/* Filter pills: the highlight glides between the selected rating */}
                    <div className="flex flex-wrap items-center gap-3 sm:gap-4 pt-1">
                      {[5, 4, 3, 2, 1].map((s) => {
                        const isActive = selectedReviewStar === s;
                        return (
                          <Key
                            key={s}
                            aria-pressed={isActive}
                            onClick={() => {
                              setSelectedReviewStar((prev) => (prev === s ? 'all' : s));
                              setReviewPage(1);
                            }}
                            className={`rounded-[12px] px-5 py-1.5 sm:px-6 sm:py-2 text-xs sm:text-sm font-semibold cursor-pointer inline-flex items-center gap-1.5 ${isActive ? '' : 'neu-raised-sm bg-[#E5D8CB] hover:bg-[#D39758]/20'
                              } text-[#341512]/80`}
                          >
                            {isActive && <HighlightPill layoutId="review-filter-pill" radius={12} />}
                            <motion.span
                              animate={isActive ? { rotate: [0, -20, 15, 0], scale: [1, 1.3, 1] } : { rotate: 0, scale: 1 }}
                              transition={{ duration: 0.5 }}
                              className="relative z-10 inline-flex"
                            >
                              <StarIcon filled className="w-3.5 h-3.5 text-[#C58B3C]" />
                            </motion.span>
                            <span className="relative z-10 font-lora font-bold text-[#341512]/80">{s}</span>
                          </Key>
                        );
                      })}
                    </div>

                    {/* Review Cards Stack: re-staggers whenever the filter or page changes */}
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={
                          reviewsLoading && reviewsList.length === 0
                            ? 'loading'
                            : `${selectedReviewStar}-${reviewPage}`
                        }
                        variants={STAGGER_VARIANTS}
                        initial="hidden"
                        animate="show"
                        exit="exit"
                        className="space-y-4 pt-1"
                      >
                        {reviewsLoading && reviewsList.length === 0 && (
                          <PanelLoader label="Loading reviews..." />
                        )}

                        {pagedReviews.map((rev) => {
                          const voted = !!userVotedHelpful[rev.id];
                          const helpfulCount = helpfulCounts[rev.id] || 0;
                          return (
                            <motion.div
                              key={rev.id}
                              variants={STAGGER_ITEM}
                              whileHover={{ y: -2 }}
                              className="neu-raised-highlight rounded-[18px] sm:rounded-[20px] p-5 sm:p-6 space-y-2.5 select-none"
                            >
                              {/* Header: Avatar, Name, Stars, Date */}
                              <div className="flex items-center gap-3.5">
                                <div className="w-8 h-8 sm:w-9 sm:h-9 shrink-0 flex items-center justify-center text-[#341512]/80">
                                  <svg className="w-full h-full" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="4.2">
                                    <circle cx="32" cy="32" r="28" />
                                    <circle cx="32" cy="24" r="8" />
                                    <path d="M16 48c0-8.837 7.163-14 16-14s16 5.163 16 14" strokeLinecap="round" />
                                  </svg>
                                </div>

                                <div>
                                  <h4 className="font-lora font-bold text-sm sm:text-base text-[#341512]/80 leading-tight">
                                    {rev.name}
                                  </h4>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <div className="flex items-center text-[#C58B3C]">
                                      {[1, 2, 3, 4, 5].map((st) => (
                                        <StarIcon key={st} filled={st <= rev.stars} className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                                      ))}
                                    </div>
                                    <span className="text-[10px] sm:text-[11px] text-[#341512]/70 font-inter">{rev.date}</span>
                                  </div>
                                </div>
                              </div>

                              {/* Body Text */}
                              <p className="text-xs sm:text-[13px] text-[#341512]/80 leading-relaxed text-justify font-inter">
                                {rev.content}
                              </p>

                              {/* Helpful feedback: thumb pops, count rolls */}
                              {isOwner ? (
                                // Reviews are view-only for the lawyer: show the persisted helpful count, no interactions.
                                (rev.helpfulCount ?? 0) > 0 && (
                                  <div className="pt-1 text-[11px] font-medium text-[#341512]/70 font-inter">
                                    {rev.helpfulCount} client{rev.helpfulCount === 1 ? '' : 's'} found this helpful
                                  </div>
                                )
                              ) : (
                              <div className="flex items-center gap-4 pt-1 text-[11px] font-medium text-[#341512]/80 font-inter">
                                <Key
                                  aria-pressed={voted}
                                  onClick={() => toggleHelpful(rev.id)}
                                  className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 -ml-2.5 hover:text-[#341512] transition-colors cursor-pointer"
                                >
                                  <motion.svg
                                    animate={voted ? { rotate: [0, -24, 10, 0], scale: [1, 1.4, 1] } : { rotate: 0, scale: 1 }}
                                    transition={{ duration: 0.5, ease: EASE_OUT }}
                                    className={`w-3.5 h-3.5 ${voted ? 'fill-current text-[#C58B3C]' : 'text-[#341512]/80'}`}
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  >
                                    <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
                                  </motion.svg>
                                  <span>Helpful?</span>
                                  {helpfulCount > 0 && <RollNumber value={helpfulCount} />}
                                </Key>
                              </div>
                              )}

                              {/* Attorney Reply Bubble if present */}
                              {rev.reply && (
                                <motion.div
                                  initial={{ opacity: 0, y: -6 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  transition={{ delay: 0.3, duration: 0.4, ease: EASE_OUT }}
                                  className="mt-2 p-3.5 rounded-[14px] bg-[#E5D8CB]/80 neu-recessed text-xs space-y-1"
                                >
                                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#341512]/80 font-lora">
                                    <ScalesIcon className="w-3.5 h-3.5 text-[#C58B3C]" />
                                    <span>Response from {lawyer.fullName}</span>
                                  </div>
                                  <p className="text-[#341512]/80 text-xs leading-relaxed font-inter">{rev.reply}</p>
                                </motion.div>
                              )}
                            </motion.div>
                          );
                        })}

                        {filteredReviews.length === 0 && !(reviewsLoading && reviewsList.length === 0) && (
                          <motion.div variants={STAGGER_ITEM}>
                            <EmptyState
                              size="sm"
                              icon={<NeuStarIcon />}
                              title={
                                reviewsError
                                  ? 'Reviews are unavailable'
                                  : reviewsList.length === 0
                                    ? 'No reviews yet'
                                    : 'No reviews match this rating'
                              }
                              description={
                                reviewsError
                                  ? 'Please try again in a moment.'
                                  : reviewsList.length === 0
                                    ? 'Reviews appear here after clients complete a consultation.'
                                    : 'Try a different star filter to see more reviews.'
                              }
                            />
                          </motion.div>
                        )}
                      </motion.div>
                    </AnimatePresence>
                  </div>
                </Reveal>

                {/* Bottom Pagination: < ● ● ● ● > */}
                {totalReviewPages > 1 && (
                  <PageControls
                    total={totalReviewPages}
                    current={reviewPage}
                    onChange={setReviewPage}
                    idPrefix="review"
                    label="reviews"
                  />
                )}
              </motion.div>
            )}

            {/* ─── TAB 3: CONSULTATION BOOKING ─────────────────────── */}
            {activeTab === 'booking' && (
              <motion.form
                key="booking"
                id="lawyer-panel-booking"
                role="tabpanel"
                aria-labelledby="lawyer-tab-booking"
                onSubmit={isOwner ? (e) => e.preventDefault() : handleSubmitBooking}
                custom={panelCustom}
                variants={PANEL_VARIANTS}
                initial="enter"
                animate="center"
                exit="exit"
                className="space-y-8"
              >
                {/* Calendar & Time Slots Grid */}
                <Reveal>
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
                    {/* Calendar Card (Left - 8 cols) */}
                    <div className="lg:col-span-8 rounded-[24px] neu-raised bg-[#E5D8CB] flex flex-col justify-center px-5 py-3.5 sm:px-6 sm:py-3.5">
                      <div className="w-full flex flex-col sm:flex-row items-center gap-5 sm:gap-6 lg:gap-8">
                        {/* Left column: month, giant day number, weekday */}
                        <div className="flex flex-col items-center justify-center sm:min-w-[120px] lg:min-w-[140px] shrink-0 select-none pl-1 sm:pl-2">
                          {/* Month with left/right chevrons; the label rolls in the direction you navigate */}
                          <div className="flex items-center justify-center gap-3">
                            <Key
                              onClick={handlePrevMonth}
                              className="w-6 h-6 rounded-full flex items-center justify-center text-[#341512]/70 hover:text-[#341512] hover:bg-[#DDCFC0]/50 transition-colors cursor-pointer"
                              title="Previous Month"
                              aria-label="Previous Month"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                              </svg>
                            </Key>

                            <div className="relative overflow-hidden h-7 lg:h-9 min-w-[4.5rem] flex items-center justify-center">
                              <AnimatePresence mode="popLayout" custom={monthDir} initial={false}>
                                <motion.span
                                  key={`${currentYear}-${currentMonth}`}
                                  custom={monthDir}
                                  variants={LABEL_ROLL}
                                  initial="enter"
                                  animate="center"
                                  exit="exit"
                                  className="font-lora text-sm sm:text-base lg:text-[24px] font-semibold tracking-wide text-[#341512]/80 uppercase"
                                >
                                  {selectedMonthShort}
                                </motion.span>
                              </AnimatePresence>
                            </div>

                            <Key
                              onClick={handleNextMonth}
                              className="w-6 h-6 rounded-full flex items-center justify-center text-[#341512]/70 hover:text-[#341512] hover:bg-[#DDCFC0]/50 transition-colors cursor-pointer"
                              title="Next Month"
                              aria-label="Next Month"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                              </svg>
                            </Key>
                          </div>

                          {/* Giant day number rolls like an odometer */}
                          <div className="relative overflow-hidden flex justify-center px-1 mb-2">
                            <AnimatePresence mode="popLayout" custom={dayDir} initial={false}>
                              <motion.span
                                key={selectedDay}
                                custom={dayDir}
                                variants={DAY_ROLL}
                                initial="enter"
                                animate="center"
                                exit="exit"
                                className="font-lora text-5xl sm:text-6xl lg:text-[130px] font-semibold text-[#D39758] leading-none select-none"
                              >
                                {String(selectedDay).padStart(2, '0')}
                              </motion.span>
                            </AnimatePresence>
                          </div>

                          <span className="font-lora text-[11px] sm:text-sm lg:text-[20px] font-semibold tracking-wider text-[#341512]/80 uppercase pt-0.5">
                            {selectedDayOfWeek}
                          </span>

                          {/* "Today" shortcut appears only when you've wandered off today */}
                          <div className="h-7 mt-1 flex items-center justify-center">
                            <AnimatePresence>
                              {!isTodaySelected && (
                                <motion.div
                                  key="today-btn"
                                  initial={{ opacity: 0, y: -6, scale: 0.9 }}
                                  animate={{ opacity: 1, y: 0, scale: 1 }}
                                  exit={{ opacity: 0, y: -6, scale: 0.9 }}
                                  transition={{ duration: 0.2 }}
                                >
                                  <Key
                                    onClick={handleGoToToday}
                                    className="neu-raised-sm bg-[#E5D8CB] rounded-full px-3 py-0.5 font-lora text-[11px] font-semibold text-[#341512]/80 hover:text-[#341512] cursor-pointer"
                                  >
                                    Jump to today
                                  </Key>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        </div>

                        {/* Right column: month grid slides when the month changes */}
                        <div className="flex-1 w-full min-w-0 pr-1 sm:pr-2">
                          <div className="grid grid-cols-7 justify-items-center mb-1.5">
                            {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map((d) => (
                              <span
                                key={d}
                                className="font-lora text-xs sm:text-[15px] font-semibold text-[#341512]/80 tracking-wide text-center"
                              >
                                {d}
                              </span>
                            ))}
                          </div>

                          <AnimatePresence mode="wait" custom={monthDir} initial={false}>
                            <motion.div
                              key={`${currentYear}-${currentMonth}`}
                              custom={monthDir}
                              variants={SLIDE_VARIANTS}
                              initial="enter"
                              animate="center"
                              exit="exit"
                              className="grid grid-cols-7 justify-items-center gap-y-1"
                            >
                              {daysInMonth.map((item, idx) => {
                                if (!item.day) {
                                  return <div key={`empty-${idx}`} className="size-7 sm:size-8 lg:size-8.5" />;
                                }
                                const isSelected = item.day === selectedDay;
                                const isToday =
                                  item.day === todayPH.day &&
                                  currentMonth === todayPH.month &&
                                  currentYear === todayPH.year;
                                const fullyBlocked = isDayFullyUnavailable(item.day);
                                const hasBlocks = fullyBlocked || blocksForDay(item.day).length > 0;
                                // Not bookable: blocked entirely, not a consultation day, fully booked or past.
                                const mark = markForDay(item.day);
                                // Days outside the weekly hours (e.g. Sunday) are known before the month's marks load.
                                const offDay = slotStartsFor(hours, new Date(currentYear, currentMonth, item.day).getDay()).length === 0;
                                const notBookable = fullyBlocked || offDay || (!!mark && mark.state !== 'open');
                                const bookingCount = mark?.bookings ?? 0;
                                // Clients cannot pick a day that can't be booked; the owner can (to review / manage it).
                                const clientDisabled = !isOwner && notBookable;
                                const dayTitle = fullyBlocked
                                  ? 'Unavailable'
                                  : offDay && !(mark && mark.state !== 'open')
                                    ? 'Not a consultation day'
                                    : mark && mark.state !== 'open'
                                    ? mark.reason ?? 'Not available'
                                    : hasBlocks && isOwner
                                      ? 'Partly unavailable'
                                      : bookingCount > 0
                                        ? `${bookingCount} booking${bookingCount === 1 ? '' : 's'} on this day`
                                        : undefined;

                                return (
                                  <Key
                                    key={`day-${item.day}`}
                                    aria-pressed={isSelected}
                                    aria-current={isToday ? 'date' : undefined}
                                    disabled={clientDisabled}
                                    title={dayTitle}
                                    onClick={() => !clientDisabled && setSelectedDay(item.day!)}
                                    className={`size-7 sm:size-8 lg:size-9 flex items-center justify-center rounded-full font-lora text-xs sm:text-[15px] select-none transition-colors ${clientDisabled
                                      ? 'text-[#341512]/30 line-through cursor-not-allowed'
                                      : isSelected
                                        ? 'text-[#D39758] font-bold cursor-pointer'
                                        : `${isOwner && fullyBlocked ? 'text-rose-800/70 line-through' : isOwner && notBookable ? 'text-[#341512]/30 line-through' : 'text-[#341512]/80'} hover:bg-[#DDCFC0]/60 cursor-pointer`
                                      }`}
                                  >
                                    {isSelected && <HighlightPill layoutId="booking-day-pill" radius={9999} variant="neu-raised-sm" />}
                                    <span className="relative z-10">{String(item.day).padStart(2, '0')}</span>
                                    {isToday && (
                                      <span className="absolute bottom-[3px] left-1/2 z-10 h-1 w-1 -translate-x-1/2 rounded-full bg-[#D39758]" />
                                    )}
                                    {isOwner && hasBlocks && (
                                      <span className="absolute top-[2px] right-[2px] z-10 h-1.5 w-1.5 rounded-full bg-rose-700/80" />
                                    )}
                                    {bookingCount > 0 && (
                                      <span aria-hidden="true" className="absolute top-[2px] left-[2px] z-10 h-1.5 w-1.5 rounded-full bg-[#946525]" />
                                    )}
                                  </Key>
                                );
                              })}
                            </motion.div>
                          </AnimatePresence>

                          {/* Day indicators */}
                          <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 font-inter text-[10.5px] text-[#341512]/60 select-none">
                            <span className="inline-flex items-center gap-1.5">
                              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[#946525]" />
                              Has bookings
                            </span>
                            <span className="inline-flex items-center gap-1.5">
                              <span aria-hidden="true" className="font-lora text-[11px] text-[#341512]/30 line-through">00</span>
                              Not available for booking
                            </span>
                            {isOwner && (
                              <span className="inline-flex items-center gap-1.5">
                                <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-rose-700/80" />
                                Unavailability set
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Time Slots Card (Right - 4 cols, matching calendar height) */}
                    <div className="lg:col-span-4 flex flex-col h-full space-y-3">
                      {/* Header Badge */}
                      <div className="neu-raised-sm !bg-[#D39758]/30 w-full py-2.5 rounded-[16px] text-center shrink-0">
                        <span className="font-lora text-[11px] sm:text-xs font-bold tracking-wider text-[#341512] uppercase">
                          Available Time Slots
                        </span>
                      </div>

                      {/* Recessed Slots Container — slots re-stagger each time the date changes */}
                      <motion.div
                        aria-busy={loadingSlots}
                        animate={{ opacity: loadingSlots ? 0.55 : 1 }}
                        transition={{ duration: 0.2 }}
                        className="neu-recessed rounded-[24px] px-9 py-7 flex-1 min-h-0 max-h-[250px] overflow-y-auto neu-scrollbar-discrete"
                      >
                        <motion.div
                          key={`${currentYear}-${currentMonth}-${selectedDay}`}
                          initial="hidden"
                          animate="show"
                          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05 } } }}
                          className="flex flex-col gap-5 justify-start"
                        >
                          {daySlots.length === 0 && (
                            <p className="py-6 text-center font-lora text-xs text-[#341512]/70 leading-relaxed">
                              {isOwner
                                ? 'You don’t take consultations on this day. Change it under Regular Consultation Hours below.'
                                : 'The attorney doesn’t take consultations on this day. Please choose another date.'}
                            </p>
                          )}
                          {daySlots.map((slot) => {
                            const isSelected = selectedTimeSlot === slot;
                            const isBookedSlot = isSlotBooked(slot);
                            const isUnavailableSlot = !isBookedSlot && isSlotUnavailable(slot);
                            // Owner: booked slots stay locked, but any other slot can be picked to prefill "Set Unavailability".
                            const isBooked = isOwner ? isBookedSlot : isBookedSlot || isUnavailableSlot;
                            return (
                              <motion.div
                                key={slot}
                                variants={{
                                  hidden: { opacity: 0, x: 16 },
                                  show: { opacity: 1, x: 0, transition: { duration: 0.35, ease: EASE_OUT } },
                                }}
                                className="shrink-0"
                              >
                                <Key
                                  disabled={isBooked}
                                  aria-pressed={isSelected}
                                  onClick={() => !isBooked && setSelectedTimeSlot(slot)}
                                  className={`w-full py-2 px-3 rounded-full text-xs font-lora font-medium text-center transition-colors ${isBooked
                                      ? 'opacity-40 cursor-not-allowed bg-stone-300 text-stone-500 line-through'
                                      : isSelected
                                        ? 'text-[#341512] font-bold cursor-pointer'
                                        : 'neu-raised-sm bg-[#E5D8CB] text-[#341512]/80 hover:text-[#341512] cursor-pointer'
                                    }`}
                                >
                                  {isSelected && !isBooked && <HighlightPill layoutId="slot-pill" radius={9999} />}
                                  <span className={`relative z-10 ${isOwner && isUnavailableSlot ? 'line-through opacity-60' : ''}`}>{slot}</span>
                                  {(isBookedSlot || isUnavailableSlot) && (
                                    <motion.span
                                      initial={{ opacity: 0, scale: 0.6 }}
                                      animate={{ opacity: 1, scale: 1 }}
                                      transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                                      className="relative z-10 ml-2 inline-block text-[10px] font-bold uppercase tracking-wider text-rose-700 not-italic no-underline"
                                    >
                                      {isBookedSlot ? '(Booked)' : '(Unavailable)'}
                                    </motion.span>
                                  )}
                                </Key>
                              </motion.div>
                            );
                          })}
                        </motion.div>
                      </motion.div>
                    </div>
                  </div>
                </Reveal>

                {isOwner ? (
                  /* Owner: weekly consultation hours, then block off days / time ranges + list of all upcoming unavailability */
                  <>
                  <ConsultationHoursEditor onSaved={() => setHoursRefreshKey((k) => k + 1)} />
                  <LawyerUnavailabilityManager
                    selectedDateIso={isoForDay(Math.min(selectedDay, totalDaysInMonth))}
                    selectedDateLabel={`${selectedDayOfWeek.charAt(0)}${selectedDayOfWeek.slice(1).toLowerCase()}, ${selectedMonthName} ${selectedDay}, ${currentYear}`}
                    selectedSlot={pickedTimeSlot}
                    onChanged={() => setAvailabilityRefreshKey((k) => k + 1)}
                    onJumpToDate={(iso) => {
                      const [y, m, d] = iso.split('-').map(Number);
                      setCurrentYear(y);
                      setCurrentMonth(m - 1);
                      setSelectedDay(d);
                    }}
                  />
                  </>
                ) : (
                <>
                {/* Mode of Communication Section */}
                <Reveal>
                  <div className="space-y-3">
                    <h2 className="font-lora text-xl sm:text-2xl font-bold text-[#341512] mb-5">Mode of Communication</h2>
                    <div
                      role="radiogroup"
                      aria-label="Mode of communication"
                      className="neu-recessed rounded-[24px] sm:rounded-[28px] p-6 sm:p-7 space-y-4 sm:space-y-5"
                    >
                      <ModeCard
                        selected={communicationMode === 'video'}
                        onSelect={() => setCommunicationMode('video')}
                        title="Video Consultation"
                        badge="Recommended"
                        description="Meet face-to-face in a private video call right here in Justicia, with screen sharing on computers."
                        icon={
                          <svg className="w-4 h-4 text-[#341512]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        }
                      />
                      <ModeCard
                        selected={communicationMode === 'audio'}
                        onSelect={() => setCommunicationMode('audio')}
                        title="Audio Call"
                        description="Speak with your attorney by voice only in a private audio call right here in Justicia."
                        icon={
                          <svg className="w-4 h-4 text-[#341512]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                          </svg>
                        }
                      />
                    </div>
                  </div>
                </Reveal>

                {/* Purpose of Consultation Section */}
                <Reveal>
                  <div className="space-y-3">
                    <h2 className="font-lora text-xl sm:text-2xl font-bold text-[#341512] mb-5">Purpose of Consultation</h2>
                    <div className="neu-raised rounded-[24px] sm:rounded-[28px] p-6 sm:p-8 bg-[#E5D8CB] space-y-5">
                      {/* Subject Input */}
                      <div className="group/field space-y-1.5">
                        <label className="block font-lora text-sm font-medium text-[#341512] mb-2 transition-colors group-focus-within/field:text-[#9A5F22]">
                          Subject:
                        </label>
                        <motion.div animate={subjectShake} className="rounded-full">
                          <input
                            type="text"
                            value={subject}
                            onChange={(e) => {
                              setSubject(e.target.value);
                              if (invalidField === 'subject') setInvalidField(null);
                            }}
                            placeholder="e.g., Makati Residential Lease Deposit Dispute & Formal Notice to Vacate"
                            className={`neu-input select-text w-full rounded-full py-2.5 sm:py-3 px-5 text-xs sm:text-sm text-[#341512] placeholder:text-[#341512]/40 font-inter transition-shadow duration-300 ${fieldRing(invalidField === 'subject')}`}
                          />
                        </motion.div>
                      </div>

                      {/* Subject Description */}
                      <div className="group/field space-y-1.5">
                        <label className="block font-lora text-sm font-medium text-[#341512] mb-2 transition-colors group-focus-within/field:text-[#9A5F22]">
                          Subject Description:
                        </label>
                        <textarea
                          rows={5}
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          placeholder="Provide concise facts, key contract dates, and specific legal queries for counsel to review..."
                          className="neu-input neu-scrollbar-discrete select-text w-full rounded-[20px] p-4 sm:p-5 text-xs sm:text-sm text-[#341512] placeholder:text-[#341512]/40 font-inter resize-none h-36 sm:h-40 transition-shadow duration-300"
                        />
                      </div>

                      {/* File Attachments Dropzone */}
                      <div className="space-y-2">
                        <label className="block font-lora text-sm font-medium text-[#341512] mb-2">File Attachments</label>
                        <motion.label
                          animate={isDraggingFiles ? { scale: 1.015 } : { scale: 1 }}
                          whileTap={{ scale: 0.99 }}
                          transition={{ type: 'spring', stiffness: 400, damping: 24 }}
                          className={`neu-recessed w-full py-9 px-6 rounded-[20px] flex flex-col items-center justify-center text-center transition-colors block relative overflow-hidden ${isDraggingFiles ? 'bg-[#DECDBA]' : 'bg-[#E5D8CB] hover:bg-[#DECDBA]/40'
                            } ${isUploadingAttachment ? 'cursor-wait opacity-80' : 'cursor-pointer'}`}
                          onDragOver={(e) => {
                            e.preventDefault();
                            if (!isDraggingFiles) setIsDraggingFiles(true);
                          }}
                          onDragLeave={() => setIsDraggingFiles(false)}
                          onDrop={(e) => {
                            e.preventDefault();
                            setIsDraggingFiles(false);
                            handleAttachLocalFiles(e.dataTransfer.files);
                          }}
                        >
                          <input
                            type="file"
                            multiple
                            className="hidden"
                            disabled={isUploadingAttachment}
                            accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.png,.jpg,.jpeg,.txt,.mp4"
                            onChange={(e) => {
                              const input = e.target;
                              handleAttachLocalFiles(input.files ? Array.from(input.files) : null).finally(() => {
                                input.value = '';
                              });
                            }}
                          />
                          {/* The tray icon bobs while you're dragging files over it */}
                          <motion.div
                            animate={isDraggingFiles ? { y: [0, -8, 0] } : { y: 0 }}
                            transition={
                              isDraggingFiles
                                ? { duration: 0.9, repeat: Infinity, ease: 'easeInOut' }
                                : { duration: 0.2 }
                            }
                            className="mx-auto"
                          >
                            {isUploadingAttachment ? (
                              <Spinner className="w-11 h-11 text-[#341512]/60" />
                            ) : (
                              <svg className="w-11 h-11 text-[#341512]/60 mx-auto" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                <polyline points="7 10 12 15 17 10" />
                                <line x1="12" y1="15" x2="12" y2="3" />
                              </svg>
                            )}
                          </motion.div>
                          <span className="relative mt-3 block h-5 w-full">
                            <AnimatePresence mode="wait" initial={false}>
                              <motion.span
                                key={isUploadingAttachment ? 'uploading' : isDraggingFiles ? 'dragging' : 'idle'}
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -6 }}
                                transition={{ duration: 0.15 }}
                                className="absolute inset-0 font-lora text-xs sm:text-sm text-[#341512]/70 font-medium"
                              >
                                {isUploadingAttachment
                                  ? 'Uploading to My Documents...'
                                  : isDraggingFiles
                                    ? 'Drop to attach'
                                    : 'Drag and Drop, or Attach Relevant Files'}
                              </motion.span>
                            </AnimatePresence>
                          </span>

                          {/* Indeterminate progress bar while uploading */}
                          <AnimatePresence>
                            {isUploadingAttachment && (
                              <motion.span
                                key="upload-bar"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="absolute inset-x-0 bottom-0 h-1 overflow-hidden"
                              >
                                <motion.span
                                  animate={{ x: ['-100%', '260%'] }}
                                  transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
                                  className="block h-full w-2/5 rounded-full bg-[#D39758]"
                                />
                              </motion.span>
                            )}
                          </AnimatePresence>
                        </motion.label>

                        {/* Attached files: one raised card per file with its type, size and an
                            "Attached" status; cards pop in and out. Removing only takes the file
                            off this booking (it stays in My Documents). */}
                        <AnimatePresence initial={false}>
                          {attachedFiles.length > 0 && (
                            // Extra room around the list so Collapse's overflow clip doesn't cut the cards' shadows.
                            <Collapse key="attached-files" gap={8} className="-mx-4 px-4 pt-2 pb-4">
                              <div className="space-y-3">
                                <div className="flex items-center gap-2 px-1 font-inter text-[11.5px] sm:text-xs text-[#7A6756]">
                                  <PaperclipIcon className="w-3.5 h-3.5 text-[#C58B3C] shrink-0" />
                                  <span>
                                    {attachedFiles.length} {attachedFiles.length === 1 ? 'file' : 'files'} attached to this booking
                                  </span>
                                </div>
                                <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  <AnimatePresence initial={false} mode="popLayout">
                                    {attachedFiles.map((file) => {
                                      const ext = (file.name.includes('.') ? file.name.split('.').pop() ?? '' : '').slice(0, 4).toUpperCase() || 'FILE';
                                      return (
                                        <motion.li
                                          key={file.id}
                                          layout
                                          initial={{ opacity: 0, scale: 0.94, y: 6 }}
                                          animate={{ opacity: 1, scale: 1, y: 0 }}
                                          exit={{ opacity: 0, scale: 0.94, transition: { duration: 0.16 } }}
                                          transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                                          className="neu-raised-sm rounded-2xl pl-3 pr-2 py-2.5 flex items-center gap-3 min-w-0"
                                        >
                                          <span
                                            aria-hidden="true"
                                            className="neu-recessed size-10 shrink-0 rounded-xl grid place-items-center font-inter text-[9.5px] font-bold tracking-[0.06em] text-[#A8742E]"
                                          >
                                            {ext}
                                          </span>
                                          <div className="min-w-0 flex-1">
                                            <p className="truncate font-inter text-xs sm:text-[13px] font-medium text-[#341512]" title={file.name}>
                                              {file.name}
                                            </p>
                                            <p className="mt-0.5 flex items-center gap-1.5 font-inter text-[11px] text-[#7A6756]">
                                              <span>{file.size}</span>
                                              <span aria-hidden="true">•</span>
                                              <span className="inline-flex items-center gap-1 font-medium text-[#1F7A3A]">
                                                <AnimatedCheck className="w-3 h-3" delay={0.15} />
                                                Attached
                                              </span>
                                            </p>
                                          </div>
                                          <Key
                                            aria-label={`Remove ${file.name} from this booking`}
                                            title="Remove from this booking"
                                            onClick={() => setAttachedFiles((prev) => prev.filter((f) => f.id !== file.id))}
                                            className="size-8 shrink-0 rounded-full flex items-center justify-center text-[#9A8270] hover:text-[#B42318] hover:bg-[#B42318]/[0.07] transition-colors cursor-pointer"
                                          >
                                            <CloseIcon className="w-3 h-3" />
                                          </Key>
                                        </motion.li>
                                      );
                                    })}
                                  </AnimatePresence>
                                </ul>
                              </div>
                            </Collapse>
                          )}
                        </AnimatePresence>

                        <div className="flex items-center gap-4 py-2" aria-hidden="true">
                          <span className="h-px flex-1 bg-[#C8B59E]/70" />
                          <span className="font-lora text-xs sm:text-sm font-semibold tracking-wider text-[#341512]/60 uppercase">or</span>
                          <span className="h-px flex-1 bg-[#C8B59E]/70" />
                        </div>

                        <Key
                          onClick={handleOpenDocPicker}
                          className="neu-raised-highlight-sm px-7 py-2.5 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-lora font-semibold text-[#341512] mx-auto block cursor-pointer select-none"
                        >
                          Share Uploaded Files from your Documents
                        </Key>
                      </div>

                      <AnimatePresence initial={false}>
                        {bookingError && (
                          <Collapse key="booking-error" gap={20}>
                            <NeuAlert tone="error">{bookingError}</NeuAlert>
                          </Collapse>
                        )}
                      </AnimatePresence>

                      {/* Privilege Agreement Checkbox — same build as the Sign Up terms box: a real
                          checkbox (so clicking the box, the text, Space or Tab all just work) with a
                          <label> for the text. It shakes and rings red if submitted unticked. */}
                      <motion.div animate={termsShake} className="flex items-start gap-3 pt-3">
                        <span className="relative mt-0.5 grid size-5 shrink-0 place-items-center">
                          <input
                            id="booking-privilege-agreement"
                            type="checkbox"
                            checked={agreedToTerms}
                            onChange={(e) => {
                              setAgreedToTerms(e.target.checked);
                              if (invalidField === 'terms') setInvalidField(null);
                            }}
                            aria-invalid={invalidField === 'terms' || undefined}
                            className={`peer absolute inset-0 size-full cursor-pointer appearance-none rounded-[6px] neu-pressed transition-colors checked:bg-[#431407]! focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C58B3C]/70 ${
                              invalidField === 'terms' ? 'outline-2 outline-offset-2 outline-[#B42318]/60' : ''
                            }`}
                          />
                          <svg
                            viewBox="0 0 12 12"
                            fill="none"
                            className="pointer-events-none relative h-3 w-3 opacity-0 transition-opacity peer-checked:opacity-100"
                            aria-hidden="true"
                          >
                            <path d="M2 6l3 3 5-5" stroke="#F3E6D6" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </span>
                        <label
                          htmlFor="booking-privilege-agreement"
                          className="cursor-pointer select-none font-inter text-xs text-[#341512]/80 leading-relaxed"
                        >
                          I agree that this intake form and attached records will be reviewed strictly under confidential attorney-client privilege prior to the scheduled consultation session.
                        </label>
                      </motion.div>
                    </div>
                  </div>
                </Reveal>

                {/* Action Buttons Row — the "draft saved" confirmation appears right above the
                    buttons, in the system's notice style, where the click happened. */}
                <Reveal>
                  <AnimatePresence initial={false}>
                    {bookingStatus === 'saved' && (
                      <Collapse key="draft-saved" gap={16} className="-mx-1 px-1 pt-1">
                        <NeuAlert tone="success" title="Draft saved" onDismiss={() => setBookingStatus('idle')} className="mb-4">
                          Your booking details are saved on this device. You can come back and submit anytime.
                        </NeuAlert>
                      </Collapse>
                    )}
                  </AnimatePresence>
                  <div className="flex items-center justify-end gap-3 pt-1">
                    <Key
                      onClick={handleClearInputs}
                      className="rounded-xl border border-[#341512]/60 px-5 py-2 text-xs sm:text-sm font-lora font-semibold text-[#341512] hover:bg-[#341512]/5 transition-colors cursor-pointer select-none"
                    >
                      Clear All Inputs
                    </Key>
                    <Key
                      onClick={handleSaveDraft}
                      className="neu-raised-sm !bg-[#D39758]/70 rounded-xl px-7 py-2 min-w-[96px] text-xs sm:text-sm font-lora font-semibold text-[#341512] cursor-pointer select-none"
                    >
                      <AnimatePresence mode="wait" initial={false}>
                        {bookingStatus === 'saved' ? (
                          <motion.span
                            key="saved"
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            transition={{ duration: 0.15 }}
                            className="inline-flex items-center gap-1.5"
                          >
                            <AnimatedCheck className="w-3.5 h-3.5" />
                            Saved
                          </motion.span>
                        ) : (
                          <motion.span
                            key="save"
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            transition={{ duration: 0.15 }}
                            className="inline-block"
                          >
                            Save
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </Key>
                  </div>
                </Reveal>

                {/* Divider draws outward from the center */}
                <motion.hr
                  initial={{ scaleX: 0 }}
                  whileInView={{ scaleX: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, ease: EASE_OUT }}
                  className="border-t-2 border-[#C8B59E] my-8 sm:my-10 origin-center"
                />

                {/* Centered Large Submit Button */}
                <Reveal className="pt-2 pb-6">
                  <Key
                    type="submit"
                    disabled={submittingBooking}
                    className="neu-raised-sm !bg-[#D39758]/70 w-full max-w-sm mx-auto block py-3.5 px-8 rounded-xl sm:rounded-2xl text-base font-lora font-bold text-[#341512] text-center cursor-pointer shadow-none disabled:opacity-60 disabled:cursor-wait"
                  >
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.span
                        key={submittingBooking ? 'submitting' : 'idle'}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.15 }}
                        className="inline-flex items-center justify-center gap-2.5"
                      >
                        {submittingBooking && <Spinner className="w-4 h-4" />}
                        {submittingBooking ? 'Submitting Request...' : 'Submit Booking'}
                      </motion.span>
                    </AnimatePresence>
                  </Key>
                </Reveal>
                </>
                )}
              </motion.form>
            )}

            {/* ─── TAB 4: CASES HANDLED ────────────────────────────── */}
            {activeTab === 'cases' && (
              <motion.div
                key="cases"
                id="lawyer-panel-cases"
                role="tabpanel"
                aria-labelledby="lawyer-tab-cases"
                custom={panelCustom}
                variants={PANEL_VARIANTS}
                initial="enter"
                animate="center"
                exit="exit"
                className="space-y-6"
              >
                {/* Stack of Case Cards: paging slides the whole stack and staggers the cards */}
                <AnimatePresence mode="wait" custom={caseDir} initial={false}>
                  <motion.div
                    key={safeCasePage}
                    custom={caseDir}
                    variants={CASE_PAGE_VARIANTS}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    className="space-y-6"
                  >
                    {casesHandled.length === 0 && (
                      <motion.div
                        variants={CASE_CARD_VARIANTS}
                        className="neu-recessed rounded-[24px] sm:rounded-[28px] p-8 sm:p-10 bg-[#E5D8CB] text-center text-xs sm:text-sm text-[#341512]/70 font-lora"
                      >
                        {detailsLoading
                          ? 'Loading cases…'
                          : isOwner
                            ? 'No cases on your profile yet. Click “Edit Visible Cases” to add the matters you’ve handled.'
                            : 'No case summaries available.'}
                      </motion.div>
                    )}
                    {casesHandled.map((caseItem) => (
                      <motion.div
                        key={caseItem.id}
                        variants={CASE_CARD_VARIANTS}
                        whileHover={{ y: -4, transition: { type: 'spring', stiffness: 400, damping: 22 } }}
                        whileTap={{ scale: 0.99, y: 1, transition: { duration: 0.06 } }}
                        role="button"
                        tabIndex={0}
                        aria-haspopup="dialog"
                        aria-label={`View full case: ${caseItem.title}`}
                        onClick={() => setViewingCase(caseItem)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setViewingCase(caseItem);
                          }
                        }}
                        className="neu-raised rounded-[24px] sm:rounded-[28px] p-6 sm:p-8 bg-[#E5D8CB] space-y-2.5 mb-10 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D39758]/70"
                      >
                        <div className="font-inter font-bold text-[10px] sm:text-[11px] text-[#D39758] uppercase tracking-wider">
                          {caseItem.docket}
                        </div>
                        <h3 className="font-lora text-lg sm:text-xl font-bold text-[#341512] leading-tight">
                          {caseItem.title}
                        </h3>
                        <p className="font-inter text-xs sm:text-[13px] text-[#341512]/80 leading-relaxed text-justify line-clamp-5">
                          {caseItem.content}
                        </p>
                        <span className="inline-flex items-center gap-1 pt-1 font-inter text-[11px] font-semibold text-[#341512]/60">
                          Read full case
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                          </svg>
                        </span>
                      </motion.div>
                    ))}
                  </motion.div>
                </AnimatePresence>

                {/* Bottom Pagination: < ● ● ● ● > */}
                {totalCasePages > 1 && (
                  <PageControls
                    total={totalCasePages}
                    current={safeCasePage}
                    onChange={(p) => {
                      setCaseDir(p >= safeCasePage ? 1 : -1);
                      setCasePage(p);
                    }}
                    idPrefix="case"
                    label="case"
                  />
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </IntroContext.Provider>

        {/* ─── Share From My Documents Vault Modal ─────────────────────────────── */}
        <AnimatePresence>
        {showDocPickerModal && (
          <NeuModal
            key="doc-picker-modal"
            onClose={() => setShowDocPickerModal(false)}
            size="xl"
            icon={<FolderIcon className="w-5 h-5" />}
            title="My Documents Vault"
            subtitle="Select files from your vault, or upload new ones, to share with the attorney for this consultation."
            bodyClassName="space-y-5"
            footerStart={
              <>
                <RollNumber value={selectedDocPickerFiles.length} /> file{selectedDocPickerFiles.length === 1 ? '' : 's'} selected
              </>
            }
            footer={
              <>
                <NeuButton variant="secondary" onClick={() => setShowDocPickerModal(false)}>
                  Cancel
                </NeuButton>
                <NeuButton variant="dark" onClick={handleConfirmDocPicker} disabled={selectedDocPickerFiles.length === 0}>
                  Attach Selected (<RollNumber value={selectedDocPickerFiles.length} />)
                </NeuButton>
              </>
            }
          >
            {/* Notification Notice */}
            <AnimatePresence initial={false}>
              {pickerNotice && (
                <Collapse key="picker-notice">
                  <NeuAlert tone="info" onDismiss={() => setPickerNotice(null)}>
                    {pickerNotice}
                  </NeuAlert>
                </Collapse>
              )}
            </AnimatePresence>

            {/* Quick Upload & Create Folder Bar */}
            <div className="neu-recessed rounded-[20px] p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <input type="file" ref={pickerFileInputRef} className="hidden" onChange={handlePickerFileUpload} />
                <NeuButton
                  size="sm"
                  variant="dark"
                  loading={isUploadingPickerFile}
                  onClick={() => pickerFileInputRef.current?.click()}
                >
                  {isUploadingPickerFile ? 'Uploading…' : '+ Upload to Vault'}
                </NeuButton>
                <span className="font-inter text-[11px] text-[#7D6855] hidden md:inline">PDF, Word, images</span>
              </div>

              <form onSubmit={handleCreatePickerFolder} className="flex items-center gap-2.5">
                <input
                  type="text"
                  value={pickerNewFolderName}
                  onChange={(e) => setPickerNewFolderName(e.target.value)}
                  placeholder="New folder name…"
                  aria-label="New folder name"
                  className="neu-input select-text h-9 px-3.5 rounded-xl font-inter text-xs text-[#23150F] flex-1 sm:flex-none sm:w-48"
                />
                <NeuButton
                  size="sm"
                  type="submit"
                  variant="secondary"
                  loading={isCreatingPickerFolder}
                  disabled={!pickerNewFolderName.trim()}
                >
                  + Folder
                </NeuButton>
              </form>
            </div>

            {/* Folder & Files Browser Layout */}
            <div className="min-h-[300px] flex flex-col sm:flex-row gap-4 sm:gap-5">
              {/* Folders List (Left Sidebar): the dark pill glides to the active folder */}
              <div className="neu-recessed rounded-[20px] w-full sm:w-56 shrink-0 p-2.5 space-y-1.5 overflow-y-auto max-h-[240px] sm:max-h-[360px] neu-scrollbar-discrete">
                <div className="font-lora text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#946525] px-2.5 pt-1 pb-1.5">
                  Folders ({docPickerFolders.length})
                </div>

                {loadingDocPicker ? (
                  <PanelLoader srLabel="Loading your folders" className="py-6!" />
                ) : docPickerFolders.length === 0 ? (
                  <EmptyState size="sm" icon={<FolderIcon />} title="No folders yet" description="Create one with “+ Folder” above." />
                ) : (
                  docPickerFolders.map((folder) => {
                    const isActive = activePickerFolderId === folder.id;
                    return (
                      <Key
                        key={folder.id}
                        onClick={() => setActivePickerFolderId(folder.id)}
                        className={`w-full text-left px-3 py-2.5 rounded-xl font-inter text-xs flex items-center justify-between cursor-pointer transition-colors ${isActive ? 'text-[#F3E6D6] font-semibold' : 'text-[#3E2A1E] hover:bg-[#D39758]/12'
                          }`}
                      >
                        {isActive && (
                          <motion.span
                            aria-hidden
                            layoutId="picker-folder-pill"
                            transition={SPRING_PILL}
                            style={{ borderRadius: 12 }}
                            className="absolute inset-0 z-0 neu-btn-espresso"
                          />
                        )}
                        <span className="relative z-10 flex items-center gap-2 truncate">
                          <FolderIcon className="w-3.5 h-3.5 shrink-0 text-current opacity-80" />
                          <span className="truncate">{folder.name}</span>
                        </span>
                        <span className="relative z-10 text-[10px] opacity-75 shrink-0 ml-1">{folder.files?.length || 0}</span>
                      </Key>
                    );
                  })
                )}
              </div>

              {/* Files list (right): re-staggers per folder */}
              <div className="flex-1 min-w-0 overflow-y-auto max-h-[320px] sm:max-h-[360px] neu-scrollbar-discrete px-1 pb-1">
                <AnimatePresence mode="wait" initial={false}>
                  {!currentPickerFolder ? (
                    <motion.div key="no-folder" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full flex items-center justify-center">
                      <EmptyState
                        size="sm"
                        icon={<FolderIcon />}
                        title="No folder selected"
                        description="Pick a folder on the left, or create one and upload a file."
                      />
                    </motion.div>
                  ) : pickerFiles.length === 0 ? (
                    <motion.div
                      key={`empty-${currentPickerFolder.id}`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="h-full flex items-center justify-center"
                    >
                      <EmptyState
                        size="sm"
                        icon={<FileDocIcon />}
                        title="This folder is empty"
                        description="Use “+ Upload to Vault” above to add documents here."
                      />
                    </motion.div>
                  ) : (
                    <motion.div
                      key={currentPickerFolder.id}
                      variants={{
                        hidden: {},
                        show: { transition: { staggerChildren: 0.045 } },
                        exit: { opacity: 0, transition: { duration: 0.12 } },
                      }}
                      initial="hidden"
                      animate="show"
                      exit="exit"
                      className="space-y-3"
                    >
                      <div className="flex items-center justify-between px-1 font-lora text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#946525]">
                        <span className="truncate">Files in {currentPickerFolder.name}</span>
                        <span className="font-inter normal-case tracking-normal font-medium text-[#7D6855] shrink-0 ml-2">
                          {pickerFiles.length} available
                        </span>
                      </div>

                      {pickerFiles.map((file) => {
                        const isSelected = selectedDocPickerFiles.includes(file.id);
                        return (
                          <motion.div
                            key={file.id || file.name}
                            role="checkbox"
                            aria-checked={isSelected}
                            tabIndex={0}
                            variants={{
                              hidden: { opacity: 0, x: 14 },
                              show: { opacity: 1, x: 0, transition: { duration: 0.3, ease: EASE_OUT } },
                            }}
                            whileTap={{ scale: 0.985, transition: { duration: 0.06 } }}
                            onClick={() => handleToggleSelectDoc(file.id)}
                            onKeyDown={(e) => {
                              if (e.key === ' ' || e.key === 'Enter') {
                                e.preventDefault();
                                handleToggleSelectDoc(file.id);
                              }
                            }}
                            // Raised when available; pressed in (with a caramel check) once selected.
                            className={`flex items-center justify-between gap-3 p-3 sm:p-3.5 rounded-2xl cursor-pointer transition-shadow ${isSelected ? 'neu-recessed' : 'neu-raised-sm bg-[#E5D8CB]'
                              }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <span
                                className={`size-5 shrink-0 rounded-md flex items-center justify-center transition-colors ${isSelected ? 'neu-btn-caramel text-[#341512]' : 'neu-recessed'
                                  }`}
                                aria-hidden="true"
                              >
                                {isSelected && (
                                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M5 12.5l4.5 4.5L19 7.5" />
                                  </svg>
                                )}
                              </span>
                              <FileDocIcon className="w-4 h-4 text-[#7A6756] shrink-0" />
                              <div className="min-w-0">
                                <div className="font-inter text-xs font-semibold text-[#23150F] truncate">{file.name}</div>
                                <div className="font-inter text-[10.5px] text-[#7D6855]">
                                  {file.size} • {file.updatedAt || 'Recent'}
                                </div>
                              </div>
                            </div>
                            <span
                              className={`font-inter text-[10px] font-bold uppercase tracking-wider shrink-0 ${isSelected ? 'text-[#A8742E]' : 'text-[#9E8E7D]'}`}
                            >
                              {isSelected ? 'Selected' : 'Select'}
                            </span>
                          </motion.div>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </NeuModal>
        )}
        </AnimatePresence>

        {/* ─── Cases Handled: full case view (clients and owner) ─── */}
        <CaseDetailModal caseItem={viewingCase} onClose={() => setViewingCase(null)} />

        {/* ─── Owner: Edit Information (+ "Update Lawyer Profile?" confirmation) & Edit Visible Cases ─── */}
        {isOwner && details && (
          <>
            <EditProfileModal
              open={showEditProfile}
              onClose={() => setShowEditProfile(false)}
              onSaved={() => {
                setShowEditProfile(false);
                setOwnerNotice('Your lawyer profile has been updated.');
                router.refresh();
              }}
              lawyer={lawyer}
              details={details}
            />
            <ManageCasesModal
              open={showManageCases}
              onClose={() => setShowManageCases(false)}
              cases={details.caseSummaries}
              practiceAreaSuggestions={lawyer.practiceAreas || []}
              onChanged={(message) => {
                setOwnerNotice(message);
                router.refresh();
              }}
            />
          </>
        )}

        {/* ─── Booking: review → submitting → recorded ─────── */}
        <AnimatePresence>
        {confirmPhase && confirmDetails && (
          <BookingConfirmModal
            key="booking-confirm-modal"
            phase={confirmPhase}
            details={confirmDetails}
            error={confirmError}
            onConfirm={handleConfirmBooking}
            onClose={closeConfirm}
            onRetry={() => setConfirmPhase('review')}
          />
        )}
        </AnimatePresence>

        {/* ─── Attachment uploads & new folders: loader → check / X ─── */}
        <SubmissionOverlay
          submission={fileSubmission}
          processing={fileCard.processing}
          success={fileCard.success}
          failure={{ title: fileCard.failure }}
        />
      </div>
    </MotionConfig>
  );
}

export default LawyerDetailView;