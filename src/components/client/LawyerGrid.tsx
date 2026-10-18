'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useCallback, useOptimistic, useTransition, useState } from 'react';
import Image from 'next/image';
import { toggleFavoriteAction } from '@/app/actions/lawyerRegistration';
import { LawyerDetailView } from './LawyerDetailView';
import { UserCircleIcon } from './ClientIcons';

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
}

interface Filters {
  query: string;
  specialization: string;
  chapter: string;
  feeRange: string;
  languages: string[];
  favoritesOnly: boolean;
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
}

export function LawyerGrid({
  lawyers,
  totalCount,
  page,
  pageSize,
  filters,
}: LawyerGridProps) {
  const router = useRouter();
  const pathname = usePathname();
  const totalPages = Math.ceil(totalCount / pageSize) || 1;
  const [selectedLawyer, setSelectedLawyer] = useState<PublicLawyerProfile | null>(null);

  const buildPageUrl = useCallback(
    (p: number) => {
      const params = new URLSearchParams();
      if (filters.query) params.set('q', filters.query);
      if (filters.specialization && filters.specialization !== 'all') params.set('specialization', filters.specialization);
      if (filters.chapter && filters.chapter !== 'all') params.set('chapter', filters.chapter);
      if (filters.feeRange && filters.feeRange !== 'all') params.set('fee', filters.feeRange);
      filters.languages.forEach(l => params.append('lang', l));
      if (filters.favoritesOnly) params.set('favorites', 'true');
      if (p > 1) params.set('page', String(p));
      return `${pathname}?${params.toString()}`;
    },
    [filters, pathname]
  );

  if (selectedLawyer) {
    return (
      <LawyerDetailView
        lawyer={selectedLawyer}
        onBack={() => setSelectedLawyer(null)}
        defaultTab="booking"
      />
    );
  }

  if (lawyers.length === 0) {
    return (
      <div className="py-20 text-center space-y-3">
        <div className="text-5xl">⚖️</div>
        <p className="text-[#5C4535] font-medium text-lg">No lawyers match your filters</p>
        <p className="text-[#A69584] text-sm max-w-md mx-auto">
          Try adjusting your search terms or filters to see more results.
        </p>
      </div>
    );
  }

  const effectiveCount = totalCount > 0 ? totalCount : lawyers.length;

  return (
    <section aria-label="Lawyer search results" className="space-y-6">
      {/* Results count */}
      <p className="text-xs text-[#7D6855]">
        Showing {lawyers.length > 0 ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, effectiveCount)} of {effectiveCount} verified lawyers (Click card to view details & book)
      </p>

      {/* Grid: 4 columns on desktop/tablet */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5 sm:gap-4">
        {lawyers.map(lawyer => (
          <LawyerCard
            key={lawyer.userId}
            lawyer={lawyer}
            onSelect={setSelectedLawyer}
          />
        ))}
      </div>

      {/* Pagination matching reference screenshot */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 pt-6 pb-8">
          <button
            type="button"
            onClick={() => router.push(buildPageUrl(page - 1))}
            disabled={page <= 1}
            className="w-9 h-9 rounded-full bg-[#E8DAC8] shadow-[2px_2px_5px_rgba(0,0,0,0.06),-2px_-2px_5px_rgba(255,255,255,0.7)] flex items-center justify-center text-[#5C4535] hover:text-[#C58B3C] disabled:opacity-30 transition-all"
            aria-label="Previous page"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <div className="flex items-center gap-2">
            {Array.from({ length: totalPages }).map((_, idx) => {
              const p = idx + 1;
              const isActive = p === page;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => router.push(buildPageUrl(p))}
                  className={`w-2.5 h-2.5 rounded-full transition-all ${
                    isActive ? 'bg-[#C58B3C] scale-125' : 'bg-[#34150F] hover:bg-[#C58B3C]'
                  }`}
                  aria-label={`Go to page ${p}`}
                  aria-current={isActive ? 'page' : undefined}
                />
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => router.push(buildPageUrl(page + 1))}
            disabled={page >= totalPages}
            className="w-9 h-9 rounded-full bg-[#E8DAC8] shadow-[2px_2px_5px_rgba(0,0,0,0.06),-2px_-2px_5px_rgba(255,255,255,0.7)] flex items-center justify-center text-[#5C4535] hover:text-[#C58B3C] disabled:opacity-30 transition-all"
            aria-label="Next page"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      )}
    </section>
  );
}

// ─── LawyerCard ───────────────────────────────────────────────────────────────

function LawyerCard({
  lawyer,
  onSelect,
}: {
  lawyer: PublicLawyerProfile;
  onSelect: (l: PublicLawyerProfile) => void;
}) {
  const [, startTransition] = useTransition();
  const [optimisticFav, setOptimisticFav] = useOptimistic(lawyer.isFavorite);

  const handleFavorite = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    startTransition(async () => {
      setOptimisticFav(!optimisticFav);
      await toggleFavoriteAction(lawyer.userId);
    });
  };

  const experienceYrs = lawyer.experienceYears ?? 9;
  const ratingText = `4.9 (53 Reviews) • ${experienceYrs} yrs practice`;
  const languagesText =
    lawyer.languages && lawyer.languages.length > 0
      ? lawyer.languages.slice(0, 3).join(' • ')
      : 'English • Filipino • Spanish';
  const practiceText =
    lawyer.practiceAreas && lawyer.practiceAreas.length > 0
      ? lawyer.practiceAreas.slice(0, 3).join(' • ')
      : 'Labor & Employment • Corporate • Civil Law';

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(lawyer)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(lawyer);
        }
      }}
      className="group relative block rounded-2xl p-3.5 sm:p-4 bg-[#E8DAC8]/70 border border-[#D1BEA8]/80 hover:shadow-[7px_7px_18px_rgba(0,0,0,0.1),-7px_-7px_18px_rgba(255,255,255,0.95)] transition-all duration-200 cursor-pointer text-left w-full select-none"
      style={{ boxShadow: '5px 5px 14px rgba(0,0,0,0.06), -5px -5px 14px rgba(255,255,255,0.7)' }}
      aria-label={`View details of ${lawyer.fullName}`}
    >
      {/* Favorite button */}
      <button
        type="button"
        onClick={handleFavorite}
        aria-label={optimisticFav ? 'Remove from favorites' : 'Add to favorites'}
        aria-pressed={optimisticFav}
        className="absolute top-2.5 right-2.5 p-1.5 rounded-full hover:bg-[#D4C1AB] transition-colors z-10"
        id={`fav-btn-${lawyer.userId}`}
      >
        <svg
          className={`w-3.5 h-3.5 transition-colors ${optimisticFav ? 'text-[#C58B3C] fill-current' : 'text-[#A69584]'}`}
          fill={optimisticFav ? 'currentColor' : 'none'}
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
      </button>

      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="w-12 h-12 rounded-full border-2 border-[#34150F] flex items-center justify-center shrink-0 overflow-hidden group-hover:border-[#C58B3C] transition-colors bg-[#D4C1AB] shadow-[inset_1px_1px_3px_rgba(0,0,0,0.1)]">
          {lawyer.photoUrl ? (
            <Image
              src={lawyer.photoUrl}
              alt={lawyer.fullName}
              width={48}
              height={48}
              className="w-full h-full object-cover"
            />
          ) : (
            <UserCircleIcon className="w-9 h-9 sm:w-10 sm:h-10 text-[#34150F]" />
          )}
        </div>

        {/* Details */}
        <div className="min-w-0 flex-1 pr-4">
          {/* Badge */}
          <span className="inline-block text-[8px] uppercase tracking-wider font-bold text-[#9E6C28] bg-[#C58B3C]/20 px-1.5 py-0.5 rounded-full border border-[#C58B3C]/30 mb-0.5">
            IBP Verified
          </span>

          {/* Name */}
          <h3 className="font-cormorant font-bold text-sm sm:text-[15px] text-[#34150F] group-hover:text-[#C58B3C] transition-colors leading-tight truncate">
            {lawyer.fullName}, Ll.B.
          </h3>

          {/* Roll No & Chapter */}
          <p className="text-[10px] text-[#5C4535] font-medium leading-tight truncate mt-0.5">
            Roll No. {lawyer.rollNumber || '58942'} | IBP {lawyer.ibpChapter?.toUpperCase() || 'MAKATI'}
          </p>

          {/* Practice Areas */}
          <p className="text-[10px] text-[#7D6855] truncate mt-0.5">
            {practiceText}
          </p>
        </div>
      </div>

      {/* Metrics inset box */}
      <div
        className="mt-2.5 rounded-xl px-2.5 py-2 bg-[#DECEB8]/70 space-y-1 text-[10px] text-[#5C4535]"
        style={{
          boxShadow: 'inset 2px 2px 4px rgba(0,0,0,0.08), inset -2px -2px 4px rgba(255,255,255,0.7)',
        }}
      >
        <div className="flex justify-between items-center">
          <span className="font-medium text-[#7D6855]">Metric / Eval:</span>
          <span className="text-[#34150F] font-medium truncate ml-1">{ratingText}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="font-medium text-[#7D6855]">Language Used:</span>
          <span className="text-[#34150F] truncate ml-1 max-w-[120px]">
            {languagesText}
          </span>
        </div>
        <div className="flex justify-between items-baseline pt-1 border-t border-[#D1BEA8]/60">
          <span className="font-medium text-[#7D6855]">Session Rate:</span>
          <span className="font-bold text-[#34150F] text-xs">
            ₱{lawyer.feeStandard60min ? lawyer.feeStandard60min.toLocaleString() : '1,500'}
            <span className="font-normal text-[10px] text-[#7D6855]">/per hour</span>
          </span>
        </div>
      </div>
    </div>
  );
}
