'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useCallback, useState, useTransition } from 'react';

interface Filters {
  query: string;
  specialization: string;
  chapter: string;
  feeRange: string;
  languages: string[];
  favoritesOnly: boolean;
}

interface LawyerSearchFiltersProps {
  filters: Filters;
  isLoggedIn: boolean;
  totalCount: number;
  page: number;
  pageSize: number;
}

const FEE_RANGES = [
  { label: 'All Ranges', value: 'all' },
  { label: '₱500 – ₱1,500', value: '500-1500' },
  { label: '₱1,500 – ₱3,000', value: '1500-3000' },
  { label: '₱3,000 – ₱5,000', value: '3000-5000' },
  { label: '₱5,000+', value: '5000-+' },
];

export function LawyerSearchFilters({
  filters,
  isLoggedIn,
}: LawyerSearchFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [localQuery, setLocalQuery] = useState(filters.query);

  const buildUrl = useCallback(
    (overrides: Partial<Filters & { page: number }>) => {
      const merged = { ...filters, ...overrides };
      const params = new URLSearchParams();
      if (merged.query) params.set('q', merged.query);
      if (merged.specialization && merged.specialization !== 'all') params.set('specialization', merged.specialization);
      if (merged.chapter && merged.chapter !== 'all') params.set('chapter', merged.chapter);
      if (merged.feeRange && merged.feeRange !== 'all') params.set('fee', merged.feeRange);
      merged.languages.forEach(l => params.append('lang', l));
      if (merged.favoritesOnly) params.set('favorites', 'true');
      const p = (overrides as { page?: number }).page;
      if (p && p > 1) params.set('page', String(p));
      return `${pathname}?${params.toString()}`;
    },
    [filters, pathname]
  );

  const navigate = useCallback(
    (overrides: Partial<Filters & { page: number }>) => {
      startTransition(() => {
        router.push(buildUrl({ page: 1, ...overrides }));
      });
    },
    [buildUrl, router]
  );

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    navigate({ query: localQuery });
  };

  return (
    <div className="space-y-3">
      {/* Search Bar */}
      <form onSubmit={handleSearch} className="flex gap-2" role="search">
        <input
          id="lawyer-search-input"
          type="search"
          value={localQuery}
          onChange={e => setLocalQuery(e.target.value)}
          placeholder="Search Lawyer Name, Roll No., or Legal Practice Areas"
          className="flex-1 px-5 py-3 rounded-xl bg-[#EFE5D8] border border-[#D8CAAD]/70 text-sm text-[#34150F] placeholder-[#A69584] focus:outline-none focus:ring-2 focus:ring-[#C58B3C]/40 shadow-[inset_2px_2px_5px_rgba(0,0,0,0.07),inset_-2px_-2px_5px_rgba(255,255,255,0.8)]"
          aria-label="Search lawyers"
          disabled={isPending}
        />
        <button
          type="submit"
          id="lawyer-search-btn"
          disabled={isPending}
          className="px-6 py-3 rounded-xl bg-[#C58B3C] text-white text-sm font-semibold hover:bg-[#B07A2E] transition-colors disabled:opacity-60 shadow-md flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <circle cx="11" cy="11" r="8" />
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35" />
          </svg>
          Search
        </button>
      </form>

      {/* Filter Row */}
      <div className="flex flex-wrap gap-3 items-center">
        {/* Specialization */}
        <div className="flex flex-col gap-0.5">
          <label className="text-[11px] text-[#7D6855] font-medium uppercase tracking-wide">Specialization:</label>
          <select
            id="filter-specialization"
            value={filters.specialization || 'all'}
            onChange={e => navigate({ specialization: e.target.value })}
            disabled={isPending}
            className="px-3 py-2 rounded-lg text-[#34150F] text-xs bg-[#EFE5D8] border border-[#D8CAAD]/70 focus:outline-none focus:ring-2 focus:ring-[#C58B3C]/40 shadow-[2px_2px_5px_rgba(0,0,0,0.06),-2px_-2px_5px_rgba(255,255,255,0.85)] min-w-[160px]"
            aria-label="Filter by specialization"
          >
            <option value="all">All Fields</option>
          </select>
        </div>

        {/* IBP Chapter */}
        <div className="flex flex-col gap-0.5">
          <label className="text-[11px] text-[#7D6855] font-medium uppercase tracking-wide">IBP Chapter:</label>
          <select
            id="filter-chapter"
            value={filters.chapter || 'all'}
            onChange={e => navigate({ chapter: e.target.value })}
            disabled={isPending}
            className="px-3 py-2 rounded-lg text-[#34150F] text-xs bg-[#EFE5D8] border border-[#D8CAAD]/70 focus:outline-none focus:ring-2 focus:ring-[#C58B3C]/40 shadow-[2px_2px_5px_rgba(0,0,0,0.06),-2px_-2px_5px_rgba(255,255,255,0.85)] min-w-[160px]"
            aria-label="Filter by IBP chapter"
          >
            <option value="all">All Chapters</option>
          </select>
        </div>

        {/* Fee Range */}
        <div className="flex flex-col gap-0.5">
          <label className="text-[11px] text-[#7D6855] font-medium uppercase tracking-wide">Consultation Fee Range:</label>
          <select
            id="filter-fee"
            value={filters.feeRange || 'all'}
            onChange={e => navigate({ feeRange: e.target.value })}
            disabled={isPending}
            className="px-3 py-2 rounded-lg text-[#34150F] text-xs bg-[#EFE5D8] border border-[#D8CAAD]/70 focus:outline-none focus:ring-2 focus:ring-[#C58B3C]/40 shadow-[2px_2px_5px_rgba(0,0,0,0.06),-2px_-2px_5px_rgba(255,255,255,0.85)] min-w-[160px]"
            aria-label="Filter by consultation fee"
          >
            {FEE_RANGES.map(r => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </div>

        {/* Dialect/Language */}
        <div className="flex flex-col gap-0.5">
          <label className="text-[11px] text-[#7D6855] font-medium uppercase tracking-wide">Dialect/Language:</label>
          <select
            id="filter-language"
            value={filters.languages[0] || 'all'}
            onChange={e => navigate({ languages: e.target.value === 'all' ? [] : [e.target.value] })}
            disabled={isPending}
            className="px-3 py-2 rounded-lg text-[#34150F] text-xs bg-[#EFE5D8] border border-[#D8CAAD]/70 focus:outline-none focus:ring-2 focus:ring-[#C58B3C]/40 shadow-[2px_2px_5px_rgba(0,0,0,0.06),-2px_-2px_5px_rgba(255,255,255,0.85)] min-w-[160px]"
            aria-label="Filter by dialect or language"
          >
            <option value="all">All Languages</option>
          </select>
        </div>

        {/* Favorites toggle — only when logged in */}
        {isLoggedIn && (
          <div className="flex flex-col gap-0.5 self-end">
            <button
              id="filter-favorites-toggle"
              type="button"
              onClick={() => navigate({ favoritesOnly: !filters.favoritesOnly })}
              disabled={isPending}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all border ${
                filters.favoritesOnly
                  ? 'bg-[#C58B3C] text-white border-[#C58B3C] shadow-md'
                  : 'bg-[#EFE5D8] text-[#5C4535] border-[#D8CAAD]/70 hover:border-[#C58B3C]/50'
              }`}
              aria-pressed={filters.favoritesOnly}
              aria-label="Show favorites only"
            >
              <svg className="w-3.5 h-3.5" fill={filters.favoritesOnly ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
              Favorites only
            </button>
          </div>
        )}
      </div>

      {/* Loading indicator */}
      {isPending && (
        <div className="text-xs text-[#C58B3C] animate-pulse">Updating results…</div>
      )}
    </div>
  );
}
