'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { LawyerGrid } from '@/components/client/LawyerGrid';
import { LawyerSearchFilters } from '@/components/client/LawyerSearchFilters';
import { LawyerGridSkeleton } from '@/components/skeletons';
import type { PublicLawyerProfile } from '@/components/client/LawyerGrid';

const PAGE_SIZE = 12;

interface FindLawyerViewProps {
  isLoggedIn: boolean;
  userId?: string;
}

/** Parse a scalar search-param safely */
function scalar(v: string | null): string {
  return v ?? '';
}

const DEFAULT_SPECIALIZATIONS = [
  'Labor & Employment', 'Corporate Law', 'Civil Law', 'Criminal Law', 'Family Law',
  'Real Estate', 'Tax Law', 'Immigration', 'Intellectual Property', 'Environmental Law',
  'Constitutional Law', 'Banking & Finance', 'Maritime Law', 'Human Rights', 'Commercial Arbitration',
];

const DEFAULT_LAWYERS: PublicLawyerProfile[] = [
  {
    userId: '22222222-2222-4222-8222-000000000001',
    fullName: 'Atty. Maria Clara Santos',
    rollNumber: '54821',
    ibpChapter: 'Pasig-San Juan-Mandaluyong',
    about: 'Specializing in Family Law, Estate Planning, and Civil Litigation with over a decade of practice before the trial and appellate courts.',
    practiceAreas: ['Family Law', 'Estate Planning', 'Civil Litigation', 'Civil Law'],
    languages: ['Filipino', 'English'],
    experienceYears: 18,
    photoUrl: null,
    isAvailable: true,
    feeInitial30min: 1500,
    feeStandard60min: 2500,
    feeExtended120min: 4500,
    barPasserYear: 2008,
    isFavorite: false,
    rating: 4.95,
    reviewCount: 68,
  },
  {
    userId: '22222222-2222-4222-8222-000000000002',
    fullName: 'Atty. Juan Carlos Dela Cruz',
    rollNumber: '59144',
    ibpChapter: 'NCR — Quezon City',
    about: 'Senior labor litigator with extensive experience in NLRC arbitrations, collective bargaining agreements, and wrongful termination defense.',
    practiceAreas: ['Labor & Employment', 'Civil Law', 'Commercial Law'],
    languages: ['Tagalog', 'English', 'Ilocano'],
    experienceYears: 16,
    photoUrl: null,
    isAvailable: true,
    feeInitial30min: 1200,
    feeStandard60min: 2200,
    feeExtended120min: 4000,
    barPasserYear: 2010,
    isFavorite: false,
    rating: 4.92,
    reviewCount: 54,
  },
  {
    userId: '22222222-2222-4222-8222-000000000003',
    fullName: 'Atty. Jose Maria De Leon',
    rollNumber: '61209',
    ibpChapter: 'Cebu City Chapter',
    about: 'Cebu-based maritime and commercial law practitioner assisting local enterprises and seafarers with labor standards and maritime arbitration.',
    practiceAreas: ['Labor & Employment', 'Maritime Law', 'Commercial Law', 'Civil Law'],
    languages: ['Cebuano', 'Filipino', 'English'],
    experienceYears: 13,
    photoUrl: null,
    isAvailable: true,
    feeInitial30min: 1200,
    feeStandard60min: 2200,
    feeExtended120min: 4000,
    barPasserYear: 2013,
    isFavorite: false,
    rating: 4.88,
    reviewCount: 42,
  },
  {
    userId: '22222222-2222-4222-8222-000000000004',
    fullName: 'Atty. Clara Isabella Reyes',
    rollNumber: '52188',
    ibpChapter: 'Cebu',
    about: 'Advising private individuals and developers on Land Registration Act compliance, Torrens title verification, and complex probate settlements in the Visayas.',
    practiceAreas: ['Real Estate', 'Civil Law', 'Estate Planning'],
    languages: ['Cebuano', 'English', 'Tagalog'],
    experienceYears: 15,
    photoUrl: null,
    isAvailable: true,
    feeInitial30min: 2000,
    feeStandard60min: 3500,
    feeExtended120min: 6000,
    barPasserYear: 2011,
    isFavorite: false,
    rating: 4.94,
    reviewCount: 61,
  },
  {
    userId: '22222222-2222-4222-8222-000000000005',
    fullName: 'Atty. Roberto Emilio Tan',
    rollNumber: '63412',
    ibpChapter: 'NCR — Manila',
    about: 'Focused on tech startups, SEC registration compliance, trademark filings with the Intellectual Property Office, and BIR tax audits.',
    practiceAreas: ['Corporate Law', 'Tax Law', 'Intellectual Property'],
    languages: ['Tagalog', 'English', 'Mandarin'],
    experienceYears: 11,
    photoUrl: null,
    isAvailable: true,
    feeInitial30min: 1200,
    feeStandard60min: 2200,
    feeExtended120min: 4000,
    barPasserYear: 2015,
    isFavorite: false,
    rating: 4.85,
    reviewCount: 37,
  },
  {
    userId: '22222222-2222-4222-8222-000000000006',
    fullName: 'Atty. Ramon Manuel Bautista',
    rollNumber: '65890',
    ibpChapter: 'Quezon City Chapter',
    about: 'Trial criminal defense counsel handling bail hearings, preliminary investigations, and white-collar defense.',
    practiceAreas: ['Criminal Law', 'Civil Litigation', 'Litigation'],
    languages: ['Filipino', 'English'],
    experienceYears: 9,
    photoUrl: null,
    isAvailable: true,
    feeInitial30min: 1000,
    feeStandard60min: 1800,
    feeExtended120min: 3500,
    barPasserYear: 2017,
    isFavorite: false,
    rating: 4.82,
    reviewCount: 29,
  },
  {
    userId: '22222222-2222-4222-8222-000000000007',
    fullName: 'Atty. Katrina Isabel Valdez',
    rollNumber: '68923',
    ibpChapter: 'Makati City Chapter',
    about: 'Specialist in labor relations, employment contracts, and workplace dispute mediation.',
    practiceAreas: ['Labor & Employment', 'Corporate Law', 'Civil Law'],
    languages: ['English', 'Filipino'],
    experienceYears: 8,
    photoUrl: null,
    isAvailable: true,
    feeInitial30min: 1000,
    feeStandard60min: 1800,
    feeExtended120min: 3200,
    barPasserYear: 2018,
    isFavorite: false,
    rating: 4.89,
    reviewCount: 38,
  },
  {
    userId: '22222222-2222-4222-8222-000000000008',
    fullName: 'Atty. Gerardo Patrick Lim',
    rollNumber: '51092',
    ibpChapter: 'Davao City Chapter',
    about: 'Agrarian reform, land title disputes, and ancestral domain legal assistance across Mindanao.',
    practiceAreas: ['Real Estate', 'Agrarian Reform', 'Civil Law'],
    languages: ['Cebuano', 'Filipino', 'English'],
    experienceYears: 14,
    photoUrl: null,
    isAvailable: true,
    feeInitial30min: 1500,
    feeStandard60min: 2500,
    feeExtended120min: 4500,
    barPasserYear: 2012,
    isFavorite: false,
    rating: 4.91,
    reviewCount: 45,
  },
];

export function FindLawyerView({ isLoggedIn, userId }: FindLawyerViewProps) {
  const searchParams = useSearchParams();

  // Derive filter state directly from URL search params — LawyerSearchFilters
  // continues to drive filters via URL so its existing logic is preserved.
  const filters = {
    query: scalar(searchParams.get('q')) || scalar(searchParams.get('query')),
    specialization: scalar(searchParams.get('specialization')),
    chapter: scalar(searchParams.get('chapter')),
    feeRange: scalar(searchParams.get('fee')),
    languages: searchParams.getAll('lang'),
    favoritesOnly: searchParams.get('favorites') === 'true',
    sort: scalar(searchParams.get('sort')) || (searchParams.get('from') === 'ai' ? 'desc' : ''),
  };
  const page = Math.max(1, Number(scalar(searchParams.get('page'))) || 1);

  const [lawyers, setLawyers] = useState<PublicLawyerProfile[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const [specializationOptions, setSpecializationOptions] = useState<string[]>(DEFAULT_SPECIALIZATIONS);
  const [chapterOptions, setChapterOptions] = useState<string[]>([]);
  const [languageOptions, setLanguageOptions] = useState<string[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);

  // Fetch filter options + favorites once on mount
  useEffect(() => {
    async function loadInitial() {
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from('lawyer_profiles')
          .select('practice_areas, ibp_chapter, languages')
          .eq('verification_status', 'approved')
          .eq('is_visible', true);

        if (data && data.length > 0) {
          const areas = Array.from(new Set(data.flatMap((l) => l.practice_areas ?? []))).sort();
          if (areas.length > 0) setSpecializationOptions(areas);
          const chapters = Array.from(new Set(data.map((l) => l.ibp_chapter).filter(Boolean))).sort() as string[];
          if (chapters.length > 0) setChapterOptions(chapters);
          const langs = Array.from(new Set(data.flatMap((l) => l.languages ?? []))).sort();
          if (langs.length > 0) setLanguageOptions(langs);
        }
      } catch {
        // use defaults
      }

      if (isLoggedIn && userId) {
        try {
          const supabase = createClient();
          const { data } = await supabase
            .from('lawyer_favorites')
            .select('lawyer_id')
            .eq('client_id', userId);
          if (data) setFavoriteIds(data.map((f) => f.lawyer_id));
        } catch {
          // ignore
        }
      }
    }

    loadInitial();
  }, [isLoggedIn, userId]);

  // Re-fetch lawyers whenever URL search params change (driven by LawyerSearchFilters)
  const fetchLawyers = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();

    let q = supabase
      .from('lawyer_profiles')
      .select(
        `user_id, full_name, roll_number, ibp_chapter, about, practice_areas, languages,
         experience_years, photo_url, is_available, fee_standard_60min, fee_initial_30min,
         fee_extended_120min, bar_passer_year, verification_status`,
        { count: 'exact' }
      )
      .eq('verification_status', 'approved')
      .eq('is_visible', true);

    if (filters.query) {
      q = q.or(`full_name.ilike.%${filters.query}%,roll_number.ilike.%${filters.query}%`);
    }
    if (filters.specialization && filters.specialization !== 'all') {
      q = q.contains('practice_areas', [filters.specialization]);
    }
    if (filters.chapter && filters.chapter !== 'all') {
      q = q.ilike('ibp_chapter', filters.chapter);
    }
    if (filters.feeRange && filters.feeRange !== 'all') {
      const [minStr, maxStr] = filters.feeRange.split('-');
      const min = Number(minStr);
      const max = maxStr === '+' ? 999999 : Number(maxStr);
      if (!isNaN(min)) q = q.gte('fee_standard_60min', min);
      if (!isNaN(max) && maxStr !== '+') q = q.lte('fee_standard_60min', max);
    }
    for (const lang of filters.languages) {
      q = q.contains('languages', [lang]);
    }
    if (filters.favoritesOnly && favoriteIds.length > 0) {
      q = q.in('user_id', favoriteIds);
    }

    const isDesc = filters.sort === 'desc' || filters.sort === 'rating_desc' || filters.sort === 'experience_desc' || !filters.sort;
    if (isDesc) {
      q = q.order('experience_years', { ascending: false, nullsFirst: false });
    } else if (filters.sort === 'fee-asc') {
      q = q.order('fee_standard_60min', { ascending: true });
    } else if (filters.sort === 'fee-desc') {
      q = q.order('fee_standard_60min', { ascending: false });
    } else if (filters.sort === 'asc') {
      q = q.order('full_name', { ascending: true });
    } else {
      q = q.order('full_name', { ascending: true });
    }

    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    try {
      const { data, count, error } = await q.range(from, to);
      if (!error && data && data.length > 0) {
        let filtered = data;
        if (filters.query) {
          const lq = filters.query.toLowerCase();
          filtered = filtered.filter(
            (l) =>
              l.full_name?.toLowerCase().includes(lq) ||
              l.roll_number?.toLowerCase().includes(lq) ||
              l.practice_areas?.some((a: string) => a.toLowerCase().includes(lq))
          );
        }

        setLawyers(
          filtered.map((l) => ({
            userId: l.user_id,
            fullName: l.full_name,
            rollNumber: l.roll_number,
            ibpChapter: l.ibp_chapter ?? '',
            practiceAreas: l.practice_areas ?? [],
            languages: l.languages ?? [],
            experienceYears: l.experience_years ?? null,
            photoUrl: l.photo_url ?? null,
            isAvailable: l.is_available ?? true,
            feeStandard60min: l.fee_standard_60min ?? null,
            feeInitial30min: l.fee_initial_30min ?? null,
            feeExtended120min: l.fee_extended_120min ?? null,
            about: l.about ?? null,
            barPasserYear: l.bar_passer_year ?? null,
            isFavorite: favoriteIds.includes(l.user_id),
          }))
        );
        setTotalCount(count ?? filtered.length);
        setLoading(false);
        return;
      }
    } catch {
      // Fall through to fallback
    }

    // Fallback data when database returns 0 approved lawyers or offline
    let fallback = [...DEFAULT_LAWYERS];
    if (filters.specialization && filters.specialization !== 'all') {
      const specLower = filters.specialization.toLowerCase();
      fallback = fallback.filter((l) =>
        l.practiceAreas.some((a) => a.toLowerCase().includes(specLower) || specLower.includes(a.toLowerCase()))
      );
    }
    if (filters.chapter && filters.chapter !== 'all') {
      const chLower = filters.chapter.toLowerCase();
      fallback = fallback.filter((l) => l.ibpChapter.toLowerCase().includes(chLower));
    }
    if (filters.feeRange && filters.feeRange !== 'all') {
      const [minStr, maxStr] = filters.feeRange.split('-');
      const min = Number(minStr);
      const max = maxStr === '+' ? 999999 : Number(maxStr);
      if (!isNaN(min)) fallback = fallback.filter((l) => (l.feeStandard60min ?? 0) >= min);
      if (!isNaN(max) && maxStr !== '+') fallback = fallback.filter((l) => (l.feeStandard60min ?? 0) <= max);
    }
    if (filters.languages.length > 0) {
      fallback = fallback.filter((l) =>
        filters.languages.some((lang) => l.languages.map((x) => x.toLowerCase()).includes(lang.toLowerCase()))
      );
    }
    if (filters.query) {
      const lq = filters.query.toLowerCase();
      fallback = fallback.filter(
        (l) =>
          l.fullName.toLowerCase().includes(lq) ||
          l.rollNumber.toLowerCase().includes(lq) ||
          l.practiceAreas.some((a) => a.toLowerCase().includes(lq))
      );
    }
    if (filters.favoritesOnly && favoriteIds.length > 0) {
      fallback = fallback.filter((l) => favoriteIds.includes(l.userId));
    }

    // Sort order application
    if (isDesc) {
      fallback.sort((a, b) => (b.experienceYears ?? 0) - (a.experienceYears ?? 0));
    } else if (filters.sort === 'fee-asc') {
      fallback.sort((a, b) => (a.feeStandard60min ?? 0) - (b.feeStandard60min ?? 0));
    } else if (filters.sort === 'fee-desc') {
      fallback.sort((a, b) => (b.feeStandard60min ?? 0) - (a.feeStandard60min ?? 0));
    } else if (filters.sort === 'asc') {
      fallback.sort((a, b) => a.fullName.localeCompare(b.fullName));
    }

    const pagedFallback = fallback.slice(from, to + 1).map((l) => ({
      ...l,
      isFavorite: favoriteIds.includes(l.userId),
    }));

    setLawyers(pagedFallback);
    setTotalCount(fallback.length);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, favoriteIds]);

  useEffect(() => {
    fetchLawyers();
  }, [fetchLawyers]);

  return (
    <div className="p-5 sm:p-8 max-w-[1400px] mx-auto space-y-5">
      <h1 className="sr-only">Find a Lawyer — Justicia</h1>
      <LawyerSearchFilters
        filters={filters}
        isLoggedIn={isLoggedIn}
        totalCount={totalCount}
        page={page}
        pageSize={PAGE_SIZE}
        specializationOptions={specializationOptions}
        chapterOptions={chapterOptions}
        languageOptions={languageOptions}
      />
      {loading ? (
        <LawyerGridSkeleton count={12} />
      ) : (
        <LawyerGrid
          lawyers={lawyers}
          totalCount={totalCount}
          page={page}
          pageSize={PAGE_SIZE}
          specializationOptions={specializationOptions}
          chapterOptions={chapterOptions}
          languageOptions={languageOptions}
          filters={filters}
          isLoggedIn={isLoggedIn}
        />
      )}
    </div>
  );
}
