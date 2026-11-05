'use client';

import React, { useCallback, useState, useTransition, useRef, useEffect } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';

interface Filters {
  query: string;
  specialization: string;
  chapter: string;
  feeRange: string;
  languages: string[];
}

interface LawyerSearchFiltersProps {
  filters: Filters;
  isLoggedIn: boolean;
  totalCount: number;
  page: number;
  pageSize: number;
  specializationOptions?: string[];
  chapterOptions?: string[];
  languageOptions?: string[];
}

const FEE_RANGES = [
  { label: '₱1,500 - ₱3,000', value: '1500-3000' },
  { label: 'All Ranges', value: 'all' },
  { label: '₱500 – ₱1,500', value: '500-1500' },
  { label: '₱3,000 – ₱5,000', value: '3000-5000' },
  { label: '₱5,000+', value: '5000-+' },
];

// ─── Custom Animated Neumorphic Dropdown Component ───────────────────────────

interface DropdownOption {
  label: string;
  value: string;
}

interface NeumorphicSelectProps {
  id: string;
  label: string;
  options: DropdownOption[];
  selectedValue: string;
  onSelect: (val: string) => void;
  disabled?: boolean;
}

function NeumorphicSelect({
  id,
  label,
  options,
  selectedValue,
  onSelect,
  disabled = false,
}: NeumorphicSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setIsOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const currentOption = options.find((o) => o.value === selectedValue) || options[0];

  return (
    <div className={`flex flex-col relative ${isOpen ? 'z-40' : 'z-10'}`} ref={containerRef}>
      <label
        htmlFor={id}
        className="text-xs sm:text-[12.5px] font-lora font-semibold text-[#34150F] ml-0.5 mb-1.5 block select-none"
      >
        {label}
      </label>

      {/* Animated Dropdown Trigger Button */}
      <motion.button
        type="button"
        id={id}
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        whileHover={{ scale: 1.015, y: -0.5 }}
        whileTap={{ scale: 0.98, y: 1 }}
        transition={{ type: 'spring', stiffness: 450, damping: 26 }}
        className={`bg-[#E5D8CB] relative flex items-center justify-between w-full h-9 sm:h-9.5 rounded-[9px] px-3 sm:px-3.5 transition-all duration-200 focus:outline-none cursor-pointer select-none ${
          isOpen
            ? 'neu-pressed ring-2 ring-[#B9833C]/50 text-[#34150F]'
            : 'neu-recessed hover:ring-1 hover:ring-[#B9833C]/30 text-[#5C4535]'
        }`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="text-[11px] sm:text-xs font-inter font-normal truncate pr-2 text-left">
          {currentOption?.label}
        </span>

        {/* Animated Rotating Chevron with Color Shift */}
        <motion.span
          animate={{
            rotate: isOpen ? 180 : 0,
            scale: isOpen ? 1.15 : 1,
            color: isOpen ? '#C58B3C' : '#5C4535',
          }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          className="flex items-center justify-center shrink-0"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </motion.span>
      </motion.button>

      {/* Floating Neumorphic Options Menu with Entrance and Exit Animations */}
      <AnimatePresence>
        {isOpen && (
          <motion.ul
            role="listbox"
            aria-labelledby={id}
            initial={{ opacity: 0, y: -10, scale: 0.95, filter: 'blur(4px)' }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -8, scale: 0.96, filter: 'blur(3px)' }}
            transition={{ type: 'spring', stiffness: 450, damping: 27, mass: 0.55 }}
            className="absolute top-[calc(100%+6px)] left-0 right-0 z-50 max-h-60 overflow-y-auto rounded-[13px] p-2 bg-[#E5D8CB] border border-[#D8C6B0] shadow-[0_12px_28px_rgba(180,155,130,0.5),8px_8px_20px_0_rgba(206,194,183,0.9),-8px_-8px_16px_0_rgba(252,238,223,0.9),inset_1px_1px_2px_0_rgba(252,238,223,0.6)] focus:outline-none [scrollbar-width:thin] [scrollbar-color:#C58B3C_transparent]"
            style={{ backgroundColor: '#E5D8CB' }}
          >
            {options.map((opt) => {
              const isSelected = opt.value === selectedValue;
              return (
                <motion.li
                  key={opt.value}
                  role="option"
                  aria-selected={isSelected}
                  whileHover={{ x: 3 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ type: 'spring', stiffness: 450, damping: 25 }}
                  onClick={() => {
                    onSelect(opt.value);
                    setIsOpen(false);
                  }}
                  className={`flex items-center justify-between px-3 py-2 rounded-[9px] text-[11px] sm:text-xs font-inter transition-all duration-150 cursor-pointer select-none my-0.5 ${
                    isSelected
                      ? 'bg-[#D39758]/25 text-[#34150F] font-semibold neu-raised-sm'
                      : 'text-[#5C4535] hover:bg-[#D39758]/15 hover:text-[#34150F]'
                  }`}
                >
                  <span className="truncate">{opt.label}</span>
                  {isSelected && (
                    <span className="text-[#C58B3C] text-xs font-bold ml-1.5 shrink-0 select-none">
                      ✓
                    </span>
                  )}
                </motion.li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── LawyerSearchFilters ─────────────────────────────────────────────────────

export function LawyerSearchFilters({
  filters,
  specializationOptions = [],
  chapterOptions = [],
  languageOptions = [],
}: LawyerSearchFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const currentSearchParams = useSearchParams();
  const fromAI = currentSearchParams.get('from') === 'ai';
  const [isPending, startTransition] = useTransition();
  const [localQuery, setLocalQuery] = useState(filters.query);
  const [isBtnHovered, setIsBtnHovered] = useState(false);

  const buildUrl = useCallback(
    (overrides: Partial<Filters & { page: number }>) => {
      const merged = { ...filters, ...overrides };
      const params = new URLSearchParams();
      if (fromAI) params.set('from', 'ai');
      if (merged.query) params.set('q', merged.query);
      if (merged.specialization && merged.specialization !== 'all') {
        params.set('specialization', merged.specialization);
      }
      if (merged.chapter && merged.chapter !== 'all') {
        params.set('chapter', merged.chapter);
      }
      if (merged.feeRange && merged.feeRange !== 'all') {
        params.set('fee', merged.feeRange);
      }
      merged.languages.forEach((l) => params.append('lang', l));
      const p = (overrides as { page?: number }).page;
      if (p && p > 1) params.set('page', String(p));
      return `${pathname}?${params.toString()}`;
    },
    [filters, pathname, fromAI]
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

  // Dropdown options lists
  const specializationList: DropdownOption[] = [
    { label: 'All Fields(Labor, Corporate, Real...', value: 'all' },
    ...specializationOptions.map((s) => ({ label: s, value: s })),
  ];

  const chapterList: DropdownOption[] = [
    { label: 'NCR: Metro Manila', value: 'all' },
    ...chapterOptions.map((c) => ({ label: c, value: c })),
  ];

  const languageList: DropdownOption[] = [
    { label: 'English, Tagalog, Cebuano', value: 'all' },
    ...languageOptions.map((l) => ({ label: l, value: l })),
  ];

  return (
    <div className="space-y-3.5 select-none relative z-30">
      {/* Top Search Bar with Recessed Input & Tactile Capsule Button */}
      <form
        onSubmit={handleSearch}
        className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3"
        role="search"
      >
        {/* Recessed Prompt Input Field */}
        <div className="neu-recessed bg-[#E5D8CB] flex-1 h-10 sm:h-11 rounded-[9px] px-3.5 sm:px-4.5 flex items-center transition-all duration-200 focus-within:ring-2 focus-within:ring-[#B9833C]/40 focus-within:shadow-[inset_3px_3px_7px_0_rgba(206,194,183,0.95),inset_-3px_-3px_6px_0_rgba(252,238,223,0.95)]">
          <input
            id="lawyer-search-input"
            type="search"
            value={localQuery}
            onChange={(e) => setLocalQuery(e.target.value)}
            placeholder="Search Lawyer Name, Firm Roll No., or Legal Practice Areas"
            className="w-full bg-transparent text-[#34150F] placeholder-[#9A8270] font-inter text-xs sm:text-[13px] focus:outline-none font-normal"
            aria-label="Search lawyers"
            disabled={isPending}
          />
        </div>

        {/* Elevated Tactile Search Button */}
        <motion.button
          type="submit"
          id="lawyer-search-btn"
          disabled={isPending}
          onMouseEnter={() => setIsBtnHovered(true)}
          onMouseLeave={() => setIsBtnHovered(false)}
          whileHover={{ y: -2, scale: 1.02 }}
          whileTap={{ y: 2, scale: 0.96 }}
          transition={{ type: 'spring', stiffness: 500, damping: 25, mass: 0.4 }}
          className="neu-btn-tactile rounded-full h-10 sm:h-11 px-5 sm:px-6.5 text-[#34150F] font-lora font-semibold text-xs sm:text-[13px] flex items-center justify-center gap-1.5 cursor-pointer shrink-0 select-none disabled:opacity-60"
          style={{ backgroundColor: 'rgba(211, 151, 88, 0.30)' }}
          aria-label="Search"
        >
          <motion.span
            animate={isBtnHovered ? { rotate: -15, scale: 1.1 } : { rotate: 0, scale: 1 }}
            transition={{ type: 'spring', stiffness: 350, damping: 20 }}
            className="flex items-center justify-center"
          >
            <svg
              className="w-3.5 h-3.5 stroke-[2.3] text-[#34150F]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
            >
              <circle cx="11" cy="11" r="8" />
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35" />
            </svg>
          </motion.span>
          <span>Search</span>
        </motion.button>
      </form>

      {/* 4-Column Animated Neumorphic Filter Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-3.5 pt-1 relative z-30">
        {/* Specialization Filter */}
        <NeumorphicSelect
          id="filter-specialization"
          label="Specialization:"
          options={specializationList}
          selectedValue={filters.specialization || 'all'}
          onSelect={(val) => navigate({ specialization: val })}
          disabled={isPending}
        />

        {/* IBP Chapter Filter */}
        <NeumorphicSelect
          id="filter-chapter"
          label="IBP Chapter:"
          options={chapterList}
          selectedValue={filters.chapter || 'all'}
          onSelect={(val) => navigate({ chapter: val })}
          disabled={isPending}
        />

        {/* Consultation Fee Range Filter */}
        <NeumorphicSelect
          id="filter-fee"
          label="Consultation Fee Range:"
          options={FEE_RANGES}
          selectedValue={filters.feeRange || 'all'}
          onSelect={(val) => navigate({ feeRange: val })}
          disabled={isPending}
        />

        {/* Dialect/Language Filter */}
        <NeumorphicSelect
          id="filter-language"
          label="Dialect/Language:"
          options={languageList}
          selectedValue={filters.languages[0] || 'all'}
          onSelect={(val) => navigate({ languages: val === 'all' ? [] : [val] })}
          disabled={isPending}
        />
      </div>

      {/* Centered Neumorphic Groove Divider */}
      <div className="w-3/4 max-w-[850px] mx-auto h-[1px] bg-[#D8C6B0] shadow-[0_1px_0_rgba(252,238,223,0.7)] mt-6 sm:mt-7 mb-1 relative z-0" />
    </div>
  );
}
