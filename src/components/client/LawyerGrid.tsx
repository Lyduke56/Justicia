'use client';

import React, { useCallback, useMemo, useState, useSyncExternalStore } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { ProfilePhoto } from '@/components/shared/ProfilePhoto';
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  type Variants,
} from 'motion/react';
import { LawyerDetailView } from './LawyerDetailView';
import { ChevronLeftIcon, ChevronRightIcon } from './ClientIcons';
import { EmptyState, NeuButton, SearchIcon, RefreshIcon } from '@/components/shared/neu';

export interface PublicLawyerProfile {
  userId: string;
  fullName: string;
  rollNumber: string;
  ibpChapter: string;
  practiceAreas: string[];
  languages: string[];
  experienceYears: number | null;
  photoUrl: string | null;
  isAvailable: boolean;
  feeStandard60min: number | null;
  feeInitial30min?: number | null;
  feeExtended120min?: number | null;
  about?: string | null;
  barPasserYear: number | null;
  isFavorite: boolean;
  rating?: number;
  reviewCount?: number;
}

interface Filters {
  query: string;
  specialization: string;
  chapter: string;
  feeRange: string;
  languages: string[];
}

interface LawyerGridProps {
  lawyers: PublicLawyerProfile[];
  totalCount: number;
  page: number;
  pageSize: number;
  specializationOptions: string[];
  chapterOptions: string[];
  languageOptions: string[];
  filters: Filters;
  isLoggedIn: boolean;
  onSelectLawyer?: (l: PublicLawyerProfile) => void;
  /** 1 = moved to the next page, -1 = previous page, 0 = first load / new filters. */
  direction?: number;
  /** Seconds to wait before the first card arrives (lets the search bar and filters land first). */
  introDelay?: number;
}

// ─── Grid columns (matches grid-cols-1 / md:grid-cols-2 / lg:grid-cols-3) ────

const COLUMN_QUERIES = ['(min-width: 1024px)', '(min-width: 768px)'] as const;
function subscribeColumns(onChange: () => void) {
  const lists = COLUMN_QUERIES.map((q) => window.matchMedia(q));
  lists.forEach((l) => l.addEventListener('change', onChange));
  return () => lists.forEach((l) => l.removeEventListener('change', onChange));
}
function readColumns() {
  if (window.matchMedia(COLUMN_QUERIES[0]).matches) return 3;
  if (window.matchMedia(COLUMN_QUERIES[1]).matches) return 2;
  return 1;
}
const useGridColumns = () => useSyncExternalStore(subscribeColumns, readColumns, () => 3);

/**
 * Cards deal in as a diagonal wave (top-left first). After "next page" the wave starts
 * from the right edge, so it follows the slide direction; after "previous" from the left.
 */
function waveDelay(index: number, columns: number, direction: number) {
  const row = Math.floor(index / columns);
  const col = index % columns;
  const colOrder = direction === 1 ? columns - 1 - col : col;
  return (row + colOrder) * 0.085;
}

// ─── Card choreography ───────────────────────────────────────────────────────
// Quiet and unhurried: each card drifts up a short distance while it sharpens from a soft
// blur, in a gentle diagonal wave across the grid. Its contents follow a beat later in reading
// order (portrait, then the details line by line, then the metrics panel), each simply fading
// up into place. After a page change the cards glide in from that side instead.
//
// Rules that keep this working (motion only orchestrates elements that *inherit* labels):
//  - no variant-label gestures (whileHover="…") on the card or its parts — that would make
//    them stop inheriting "hidden"/"show" and they would simply appear; hover uses objects/CSS;
//  - card delays come from the grid's `delayChildren`, never from `show`, so a hover ending
//    settles back immediately.

const GRACE = [0.22, 1, 0.36, 1] as const;

const CARD: Variants = {
  hidden: (dir: number) => ({
    opacity: 0,
    x: dir * 36,
    y: dir === 0 ? 26 : 0,
    filter: 'blur(6px)',
  }),
  show: {
    opacity: 1,
    x: 0,
    y: 0,
    filter: 'blur(0px)',
    transition: {
      duration: 0.85,
      ease: GRACE,
      opacity: { duration: 0.6, ease: 'easeOut' },
      delayChildren: 0.18,
      staggerChildren: 0.09,
    },
    transitionEnd: { filter: 'none' },
  },
};

/** Content inside a card: a short, soft rise. */
const FADE_UP: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: GRACE } },
};
const AVATAR: Variants = {
  hidden: { opacity: 0, scale: 0.94 },
  show: { opacity: 1, scale: 1, transition: { duration: 0.7, ease: GRACE } },
};
const DETAILS: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};

export function LawyerGrid({
  lawyers,
  totalCount,
  page,
  pageSize,
  filters,
  onSelectLawyer,
  direction = 0,
  introDelay = 0,
}: LawyerGridProps) {
  const router = useRouter();
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();
  const columns = useGridColumns();
  const totalPages = Math.ceil(totalCount / pageSize) || 1;
  const [selectedLawyer, setSelectedLawyer] = useState<PublicLawyerProfile | null>(null);

  const delays = useMemo(
    () => lawyers.map((_, i) => introDelay + waveDelay(i, columns, direction)),
    [lawyers, introDelay, columns, direction]
  );
  const gridVariants = useMemo<Variants>(
    () => ({
      hidden: {},
      show: { transition: { delayChildren: (i: number) => delays[i] ?? 0 } },
    }),
    [delays]
  );
  // Pagination arrives once the last card has started settling in
  const paginationDelay = (delays.length ? Math.max(...delays) : introDelay) + 0.25;

  const handleSelectLawyer = (lawyer: PublicLawyerProfile) => {
    if (onSelectLawyer) {
      onSelectLawyer(lawyer);
    } else {
      setSelectedLawyer(lawyer);
    }
    if (typeof document !== 'undefined') {
      const mainContent = document.getElementById('client-main-content');
      if (mainContent) {
        mainContent.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  };

  const buildPageUrl = useCallback(
    (p: number) => {
      const params = new URLSearchParams();
      if (filters.query) params.set('q', filters.query);
      if (filters.specialization && filters.specialization !== 'all') {
        params.set('specialization', filters.specialization);
      }
      if (filters.chapter && filters.chapter !== 'all') {
        params.set('chapter', filters.chapter);
      }
      if (filters.feeRange && filters.feeRange !== 'all') {
        params.set('fee', filters.feeRange);
      }
      filters.languages.forEach((l) => params.append('lang', l));
      if (p > 1) params.set('page', String(p));
      return `${pathname}?${params.toString()}`;
    },
    [filters, pathname]
  );

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return;
    router.push(buildPageUrl(newPage));
    if (typeof document !== 'undefined') {
      const mainContent = document.getElementById('client-main-content');
      if (mainContent) {
        mainContent.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  };

  if (!onSelectLawyer && selectedLawyer) {
    return (
      <LawyerDetailView
        lawyer={selectedLawyer}
        onBack={() => {
          setSelectedLawyer(null);
          if (typeof document !== 'undefined') {
            document.getElementById('client-main-content')?.scrollTo({ top: 0, behavior: 'smooth' });
          }
        }}
        defaultTab="about"
      />
    );
  }

  if (lawyers.length === 0) {
    return (
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 22, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 320, damping: 24, delay: introDelay }}
        className="my-8"
      >
        <EmptyState
          variant="card"
          icon={<SearchIcon />}
          title="No Verified Counsel Found"
          description="No attorneys match your current filters. Try a different practice area, IBP chapter or fee range."
          action={
            <NeuButton variant="secondary" icon={<RefreshIcon className="w-4 h-4" />} onClick={() => router.push(pathname)}>
              Reset Filters
            </NeuButton>
          }
        />
      </motion.div>
    );
  }

  const canPrev = page > 1;
  const canNext = page < totalPages;
  const arrowBase =
    'size-10 rounded-full neu-raised-sm bg-[#E5D8CB] flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B9833C]/50 text-[#583C37] transition-colors duration-200';

  return (
    <section aria-label="Lawyer search results" className="space-y-6 relative z-10">
      {/* 3-column grid; cards deal in as a diagonal wave */}
      <motion.div
        key={page}
        variants={gridVariants}
        initial={reduceMotion ? false : 'hidden'}
        animate="show"
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 lg:gap-6"
      >
        {lawyers.map((lawyer) => (
          <FindLawyerCard
            key={lawyer.userId}
            lawyer={lawyer}
            onSelect={handleSelectLawyer}
            direction={direction}
          />
        ))}
      </motion.div>

      {/* Pagination */}
      <motion.nav
        aria-label="Lawyer results pages"
        initial={reduceMotion ? false : { opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 26, delay: paginationDelay }}
        className="flex items-center justify-center gap-5 sm:gap-6 pt-6 sm:pt-8 pb-8"
      >
        <motion.button
          type="button"
          onClick={() => handlePageChange(page - 1)}
          disabled={!canPrev}
          whileHover={canPrev ? { x: -3, scale: 1.06 } : undefined}
          whileTap={canPrev ? { scale: 0.88 } : undefined}
          transition={{ type: 'spring', stiffness: 500, damping: 20 }}
          className={`${arrowBase} ${canPrev ? 'hover:text-[#C58B3C] cursor-pointer' : 'opacity-30 cursor-not-allowed'}`}
          aria-label="Previous lawyers page"
        >
          <ChevronLeftIcon className="w-6 h-6 stroke-[2.2]" />
        </motion.button>

        {/* Page dots; the caramel dot slides over from the page you came from */}
        <div className="flex items-center gap-2">
          {Array.from({ length: totalPages }).map((_, idx) => {
            const pageNum = idx + 1;
            const isActive = pageNum === page;
            return (
              <button
                key={pageNum}
                type="button"
                onClick={() => handlePageChange(pageNum)}
                className="group/dot size-3 flex items-center justify-center rounded-full cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B9833C]/50"
                aria-label={`Go to page ${pageNum}`}
                aria-current={isActive ? 'page' : undefined}
              >
                {isActive ? (
                  <motion.span
                    initial={reduceMotion ? false : { x: -direction * 20, scale: direction ? 1 : 0.3 }}
                    animate={{ x: 0, scale: 1 }}
                    transition={{ type: 'spring', stiffness: 380, damping: 22, delay: direction ? 0.05 : paginationDelay + 0.1 }}
                    className="size-3 rounded-full bg-[#D39758] shadow-[0_0_0_3px_rgba(211,151,88,0.2)]"
                  />
                ) : (
                  <span className="size-2 rounded-full bg-[#34150F] transition-[background-color,scale] duration-200 group-hover/dot:bg-[#C58B3C] group-hover/dot:scale-125" />
                )}
              </button>
            );
          })}
        </div>

        <motion.button
          type="button"
          onClick={() => handlePageChange(page + 1)}
          disabled={!canNext}
          whileHover={canNext ? { x: 3, scale: 1.06 } : undefined}
          whileTap={canNext ? { scale: 0.88 } : undefined}
          transition={{ type: 'spring', stiffness: 500, damping: 20 }}
          className={`${arrowBase} ${canNext ? 'hover:text-[#C58B3C] cursor-pointer' : 'opacity-30 cursor-not-allowed'}`}
          aria-label="Next lawyers page"
        >
          <ChevronRightIcon className="w-6 h-6 stroke-[2.2]" />
        </motion.button>
      </motion.nav>
    </section>
  );
}

// ─── FindLawyerCard Component ────────────────────────────────────────────────

function FindLawyerCard({
  lawyer,
  onSelect,
  direction,
}: {
  lawyer: PublicLawyerProfile;
  onSelect: (l: PublicLawyerProfile) => void;
  direction: number;
}) {
  const reduceMotion = useReducedMotion();

  // Gentle 3D tilt that follows the mouse (mouse only; never on touch)
  const pointerX = useMotionValue(0.5);
  const pointerY = useMotionValue(0.5);
  const spring = { stiffness: 260, damping: 24, mass: 0.6 };
  const rotateX = useSpring(useTransform(pointerY, [0, 1], [4, -4]), spring);
  const rotateY = useSpring(useTransform(pointerX, [0, 1], [-5, 5]), spring);

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'mouse' || reduceMotion) return;
    const rect = e.currentTarget.getBoundingClientRect();
    pointerX.set((e.clientX - rect.left) / rect.width);
    pointerY.set((e.clientY - rect.top) / rect.height);
  };
  const resetPointer = () => {
    pointerX.set(0.5);
    pointerY.set(0.5);
  };

  const experienceYrs = lawyer.experienceYears ?? 9;
  const ratingText = typeof lawyer.rating === 'number' && typeof lawyer.reviewCount === 'number'
    ? `${lawyer.rating.toFixed(1)} (${lawyer.reviewCount} Reviews) • ${experienceYrs} yrs practice`
    : `View consultation reviews on profile • ${experienceYrs} yrs practice`;

  const languagesText =
    lawyer.languages && lawyer.languages.length > 0
      ? lawyer.languages.slice(0, 3).join(' • ')
      : 'English • Filipino • Spanish';

  const practiceText =
    lawyer.practiceAreas && lawyer.practiceAreas.length > 0
      ? lawyer.practiceAreas.slice(0, 3).join(' • ')
      : 'Labor & Employment • Corporate • Civil Law';

  const rate = lawyer.feeStandard60min ?? 1500;

  return (
    // Outer layer: the mouse tilt. Inner layer: the card itself (entrance + hover lift).
    <motion.div
      onPointerMove={handlePointerMove}
      onPointerLeave={resetPointer}
      style={{ rotateX, rotateY, transformPerspective: 900 }}
    >
      <motion.div
        variants={CARD}
        custom={direction}
        whileHover={{ y: -5, scale: 1.015 }}
        whileTap={{ y: 2, scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 420, damping: 24, mass: 0.5 }}
        role="button"
        tabIndex={0}
        onClick={() => onSelect(lawyer)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect(lawyer);
          }
        }}
        className="neu-card-interactive transition-[box-shadow,filter]! group block rounded-[22px] p-4 sm:p-5 select-none relative cursor-pointer text-left w-full will-change-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B9833C]/50"
        aria-label={`View details and book consultation with ${lawyer.fullName}`}
      >
        {/* Top Section matching Client Dashboard LawyerCard spacing and font sizes */}
        <div className="relative flex items-center gap-3 sm:gap-2">
          {/* Silhouette Avatar Circle - height aligns with IBP Verified capsule & Specializations line */}
          <motion.div
            variants={AVATAR}
            className="w-[64px] h-[64px] sm:w-[80px] sm:h-[80px] shrink-0 rounded-full"
          >
            <div className="w-full h-full flex items-center justify-center text-[#4A3528] overflow-hidden rounded-full transition-[color,scale,rotate,translate] duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] group-hover:text-[#C58B3C] group-hover:scale-107 group-hover:-rotate-4 group-hover:-translate-y-px">
            <ProfilePhoto src={lawyer.photoUrl} alt={lawyer.fullName} className="w-full h-full" ringed />
            </div>
          </motion.div>

          {/* Lawyer Details - height matches profile icon; justify-between provides generous vertical breathing room */}
          <motion.div
            variants={DETAILS}
            className="min-w-0 flex-1 flex flex-col justify-between h-[68px] sm:h-[76px] overflow-x-clip py-0.5"
          >
            {/* Encapsulated IBP Verified Badge with Raised Look */}
            <div className="flex items-center">
              <motion.span
                variants={FADE_UP}
                className="inline-flex items-center px-2.5 py-0.5 rounded-full neu-raised-sm bg-[#E5D8CB] text-[9.5px] sm:text-[10px] font-lora font-semibold text-[#D39758] tracking-wide select-none leading-none"
              >
                IBP Verified
              </motion.span>
            </div>

            {/* Full Name in Lora with truncation */}
            <motion.h3
              variants={FADE_UP}
              title={`${lawyer.fullName}, Ll.B.`}
              className="font-lora font-bold text-xs sm:text-[13.5px] lg:text-[14px] text-[#34150F] truncate block w-full group-hover:text-[#C58B3C] transition-colors leading-snug"
            >
              {lawyer.fullName}, Ll.B.
            </motion.h3>

            {/* Roll No & IBP Chapter in Inter with truncation */}
            <motion.p
              variants={FADE_UP}
              title={`Roll No. ${lawyer.rollNumber || '58942'} | IBP ${lawyer.ibpChapter?.toUpperCase() || 'MAKATI'}`}
              className="text-[10px] sm:text-[10.5px] text-[#5C4535] font-inter font-normal truncate block w-full leading-none"
            >
              <span>Roll No. {lawyer.rollNumber || '58942'}</span>
              <span className="text-[#A89685] select-none mx-1.5">|</span>
              <span>IBP {lawyer.ibpChapter?.toUpperCase() || 'MAKATI'}</span>
            </motion.p>

            {/* Specializations in Inter with truncation */}
            <motion.p
              variants={FADE_UP}
              title={practiceText}
              className="text-[9.5px] sm:text-[10.5px] text-[#5C4535] font-inter font-normal truncate block w-full leading-none"
            >
              {practiceText}
            </motion.p>
          </motion.div>
        </div>

        {/* Metrics Container: Raised look, #D39758 at 30% opacity, rounded-[10px], specific shadows, and text in #341512 at 70% opacity */}
        <motion.div
          variants={FADE_UP}
          className="relative mt-4 sm:mt-4.5 w-full rounded-[10px] px-3.5 py-2.5 sm:py-3 space-y-1.5 select-none origin-top shadow-[5px_5px_13px_0px_rgba(206,194,183,0.90),-5px_-5px_10px_0px_rgba(252,238,223,0.90),5px_-5px_10px_0px_rgba(206,194,183,0.20),-5px_5px_10px_0px_rgba(206,194,183,0.20),inset_-1px_-1px_2px_0px_rgba(206,194,183,0.50),inset_1px_1px_2px_0px_rgba(252,238,223,0.30)] text-[#341512]/70"
          style={{ backgroundColor: 'rgba(211, 151, 88, 0.30)' }}
        >
          <motion.div variants={FADE_UP} className="flex justify-between items-center text-[10px] sm:text-[10.5px]">
            <span className="font-inter font-normal text-[#341512]/70 truncate">Metric / Eval:</span>
            <span className="font-inter font-medium truncate ml-2 text-[#341512]/70">
              {ratingText}
            </span>
          </motion.div>
          <motion.div variants={FADE_UP} className="flex justify-between items-center text-[10px] sm:text-[10.5px]">
            <span className="font-inter font-normal text-[#341512]/70 truncate">Language Used:</span>
            <span className="font-inter font-medium truncate ml-2 text-[#341512]/70">
              {languagesText}
            </span>
          </motion.div>
          <motion.div variants={FADE_UP} className="flex justify-between items-baseline text-[10px] sm:text-[10.5px]">
            <span className="font-inter font-normal text-[#341512]/70 truncate">Session Rate:</span>
            <span className="font-inter truncate ml-2 text-[#341512]/70">
              <span className="inline-block origin-right transition-[scale] duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] group-hover:scale-108 font-bold text-xs sm:text-[13px] text-[#341512]/70 tabular-nums">
                ₱{rate.toLocaleString()}
              </span>
              <span className="text-[10px] font-normal text-[#341512]/70">/per hour</span>
            </span>
          </motion.div>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
