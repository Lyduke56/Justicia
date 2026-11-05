'use client';

import React, { useCallback, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Image from 'next/image';
import { motion, useReducedMotion, type Variants } from 'motion/react';
import { LawyerDetailView } from './LawyerDetailView';
import { ChevronLeftIcon, ChevronRightIcon } from './ClientIcons';

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
}

// ─── Cascading Entrance Animation Variants ───────────────────────────────────

const gridVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.07,
      delayChildren: 0.08,
    },
  },
};

const cardCascadeVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 38,
    scale: 0.96,
    filter: 'blur(6px)',
  },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: 'blur(0px)',
    transition: {
      type: 'spring',
      stiffness: 280,
      damping: 24,
      mass: 0.75,
    },
  },
};

export function LawyerGrid({
  lawyers,
  totalCount,
  page,
  pageSize,
  filters,
  onSelectLawyer,
}: LawyerGridProps) {
  const router = useRouter();
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();
  const totalPages = Math.ceil(totalCount / pageSize) || 1;
  const [selectedLawyer, setSelectedLawyer] = useState<PublicLawyerProfile | null>(null);

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
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 350, damping: 25 }}
        className="neu-raised bg-[#E5D8CB] rounded-[24px] p-8 sm:p-12 max-w-lg mx-auto text-center space-y-4 my-8 select-none"
      >
        <div className="neu-recessed size-14 sm:size-16 rounded-full flex items-center justify-center mx-auto text-[#C58B3C]">
          <svg
            className="w-7 h-7 stroke-[1.8]"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
          >
            <circle cx="11" cy="11" r="8" />
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35" />
          </svg>
        </div>
        <div className="space-y-1.5">
          <h3 className="text-[#34150F] font-lora font-bold text-lg sm:text-xl">
            No Verified Counsel Found
          </h3>
          <p className="text-[#7A6756] text-xs sm:text-[13px] max-w-sm mx-auto font-inter leading-relaxed">
            No attorneys match your current search filters. Try adjusting your practice area, IBP chapter, or consultation fee criteria.
          </p>
        </div>
        <div className="pt-2">
          <motion.button
            type="button"
            onClick={() => router.push(pathname)}
            whileHover={{ scale: 1.03, y: -1 }}
            whileTap={{ scale: 0.96, y: 1 }}
            transition={{ type: 'spring', stiffness: 450, damping: 25 }}
            className="neu-raised-sm bg-[#E5D8CB] px-5 py-2.5 rounded-full text-xs font-inter font-semibold text-[#34150F] hover:text-[#C58B3C] transition-all inline-flex items-center gap-2 cursor-pointer"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
            </svg>
            <span>Reset Search Filters</span>
          </motion.button>
        </div>
      </motion.div>
    );
  }

  return (
    <section aria-label="Lawyer search results" className="space-y-6 relative z-10">
      {/* 3-Column Lawyer Cards Grid with Fluid Cascading Upward Animation */}
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
            variants={cardCascadeVariants}
          />
        ))}
      </motion.div>

      {/* Pagination Controls at the bottommost part of the screen */}
      <div className="flex items-center justify-center gap-5 sm:gap-6 pt-6 sm:pt-8 pb-8">
        {/* Previous Page Button - circular raised button */}
        <button
          type="button"
          onClick={() => handlePageChange(page - 1)}
          disabled={page <= 1}
          className={`size-10 rounded-full neu-raised-sm bg-[#E5D8CB] flex items-center justify-center transition-all focus:outline-none ${
            page <= 1
              ? 'opacity-30 cursor-not-allowed text-[#583C37]'
              : 'text-[#583C37] hover:text-[#C58B3C] active:scale-95 cursor-pointer'
          }`}
          aria-label="Previous lawyers page"
        >
          <ChevronLeftIcon className="w-6 h-6 stroke-[2.2]" />
        </button>

        {/* Page Dots / Indicators matching DashboardView */}
        <div className="flex items-center gap-2">
          {Array.from({ length: totalPages }).map((_, idx) => {
            const pageNum = idx + 1;
            const isActive = pageNum === page;
            return (
              <button
                key={pageNum}
                type="button"
                onClick={() => handlePageChange(pageNum)}
                className={`rounded-full transition-all cursor-pointer focus:outline-none ${
                  isActive
                    ? 'w-3 h-3 bg-[#D39758]'
                    : 'w-2 h-2 bg-[#34150F] hover:bg-[#C58B3C]'
                }`}
                aria-label={`Go to page ${pageNum}`}
              />
            );
          })}
        </div>

        {/* Next Page Button - circular raised button */}
        <button
          type="button"
          onClick={() => handlePageChange(page + 1)}
          disabled={page >= totalPages}
          className={`size-10 rounded-full neu-raised-sm bg-[#E5D8CB] flex items-center justify-center transition-all focus:outline-none ${
            page >= totalPages
              ? 'opacity-30 cursor-not-allowed text-[#583C37]'
              : 'text-[#583C37] hover:text-[#C58B3C] active:scale-95 cursor-pointer'
          }`}
          aria-label="Next lawyers page"
        >
          <ChevronRightIcon className="w-6 h-6 stroke-[2.2]" />
        </button>
      </div>
    </section>
  );
}

// ─── FindLawyerCard Component ────────────────────────────────────────────────

function FindLawyerCard({
  lawyer,
  onSelect,
  variants,
}: {
  lawyer: PublicLawyerProfile;
  onSelect: (l: PublicLawyerProfile) => void;
  variants: Variants;
}) {
  const experienceYrs = lawyer.experienceYears ?? 9;
  const ratingNum = typeof lawyer.rating === 'number' ? lawyer.rating.toFixed(1) : '4.9';
  const reviewsCount = typeof lawyer.reviewCount === 'number' ? lawyer.reviewCount : 53;
  const ratingText = `${ratingNum} (${reviewsCount} Reviews) • ${experienceYrs} yrs practice`;

  const languagesText =
    lawyer.languages && lawyer.languages.length > 0
      ? lawyer.languages.slice(0, 3).join(' • ')
      : 'English • Filipino • Spanish';

  const practiceText =
    lawyer.practiceAreas && lawyer.practiceAreas.length > 0
      ? lawyer.practiceAreas.slice(0, 3).join(' • ')
      : 'Labor & Employment • Corporate • Civil Law';

  const formattedRate = lawyer.feeStandard60min
    ? lawyer.feeStandard60min.toLocaleString()
    : '1500';

  return (
    <motion.div
      variants={variants}
      whileHover={{ y: -4, scale: 1.015 }}
      whileTap={{ y: 2, scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 450, damping: 25, mass: 0.5 }}
      role="button"
      tabIndex={0}
      onClick={() => onSelect(lawyer)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(lawyer);
        }
      }}
      className="neu-card-interactive group block rounded-[22px] p-4 sm:p-5 select-none relative cursor-pointer text-left w-full will-change-transform"
      aria-label={`View details and book consultation with ${lawyer.fullName}`}
    >
      {/* Top Section matching Client Dashboard LawyerCard spacing and font sizes */}
      <div className="flex items-center gap-3 sm:gap-3.5">
        {/* Silhouette Avatar Circle - height aligns with IBP Verified capsule & Specializations line */}
        <div className="w-[64px] h-[64px] sm:w-[76px] sm:h-[76px] shrink-0 flex items-center justify-center text-[#4A3528] group-hover:text-[#C58B3C] transition-colors overflow-hidden">
          {lawyer.photoUrl ? (
            <Image
              src={lawyer.photoUrl}
              alt={lawyer.fullName}
              width={76}
              height={76}
              className="w-full h-full object-cover rounded-full"
            />
          ) : (
            <svg
              className="w-full h-full"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M17.982 18.725A7.488 7.488 0 0 0 12 15.75a7.488 7.488 0 0 0-5.982 2.975m11.963 0a9 9 0 1 0-11.963 0m11.963 0A8.966 8.966 0 0 1 12 21a8.966 8.966 0 0 1-5.982-2.275M15 9.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
            </svg>
          )}
        </div>

        {/* Lawyer Details - height matches profile icon; justify-between provides generous vertical breathing room */}
        <div className="min-w-0 flex-1 flex flex-col justify-between h-[68px] sm:h-[76px] overflow-hidden py-0.5">
          {/* Encapsulated IBP Verified Badge with Raised Look */}
          <div className="flex items-center">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full neu-raised-sm bg-[#E5D8CB] text-[9.5px] sm:text-[10px] font-lora font-semibold text-[#D39758] tracking-wide select-none leading-none">
              IBP Verified
            </span>
          </div>

          {/* Full Name in Lora with truncation */}
          <h3
            title={`${lawyer.fullName}, Ll.B.`}
            className="font-lora font-bold text-xs sm:text-[13.5px] lg:text-[14px] text-[#34150F] truncate block w-full group-hover:text-[#C58B3C] transition-colors leading-snug"
          >
            {lawyer.fullName}, Ll.B.
          </h3>

          {/* Roll No & IBP Chapter in Inter with truncation */}
          <p
            title={`Roll No. ${lawyer.rollNumber || '58942'} | IBP ${lawyer.ibpChapter?.toUpperCase() || 'MAKATI'}`}
            className="text-[10px] sm:text-[10.5px] text-[#5C4535] font-inter font-normal truncate block w-full leading-none"
          >
            <span>Roll No. {lawyer.rollNumber || '58942'}</span>
            <span className="text-[#A89685] select-none mx-1.5">|</span>
            <span>IBP {lawyer.ibpChapter?.toUpperCase() || 'MAKATI'}</span>
          </p>

          {/* Specializations in Inter with truncation */}
          <p
            title={practiceText}
            className="text-[9.5px] sm:text-[10.5px] text-[#5C4535] font-inter font-normal truncate block w-full leading-none"
          >
            {practiceText}
          </p>
        </div>
      </div>

      {/* Metrics Container: Raised look, #D39758 at 30% opacity, rounded-[10px], specific shadows, and text in #341512 at 70% opacity */}
      <div
        className="mt-4 sm:mt-4.5 w-full rounded-[10px] px-3.5 py-2.5 sm:py-3 space-y-1.5 select-none shadow-[5px_5px_13px_0px_rgba(206,194,183,0.90),-5px_-5px_10px_0px_rgba(252,238,223,0.90),5px_-5px_10px_0px_rgba(206,194,183,0.20),-5px_5px_10px_0px_rgba(206,194,183,0.20),inset_-1px_-1px_2px_0px_rgba(206,194,183,0.50),inset_1px_1px_2px_0px_rgba(252,238,223,0.30)] text-[#341512]/70"
        style={{ backgroundColor: 'rgba(211, 151, 88, 0.30)' }}
      >
        <div className="flex justify-between items-center text-[10px] sm:text-[10.5px]">
          <span className="font-inter font-normal text-[#341512]/70 truncate">Metric / Eval:</span>
          <span className="font-inter font-medium truncate ml-2 text-[#341512]/70">
            {ratingText}
          </span>
        </div>
        <div className="flex justify-between items-center text-[10px] sm:text-[10.5px]">
          <span className="font-inter font-normal text-[#341512]/70 truncate">Language Used:</span>
          <span className="font-inter font-medium truncate ml-2 text-[#341512]/70">
            {languagesText}
          </span>
        </div>
        <div className="flex justify-between items-baseline text-[10px] sm:text-[10.5px]">
          <span className="font-inter font-normal text-[#341512]/70 truncate">Session Rate:</span>
          <span className="font-inter truncate ml-2 text-[#341512]/70">
            <span className="font-bold text-xs sm:text-[13px] text-[#341512]/70">₱{formattedRate}</span>
            <span className="text-[10px] font-normal text-[#341512]/70">/per hour</span>
          </span>
        </div>
      </div>
    </motion.div>
  );
}
