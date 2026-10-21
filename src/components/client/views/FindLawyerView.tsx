'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { LawyerGrid } from '@/components/client/LawyerGrid';
import { LawyerSearchFilters } from '@/components/client/LawyerSearchFilters';
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
  };
  const page = Math.max(1, Number(scalar(searchParams.get('page'))) || 1);

  const [lawyers, setLawyers] = useState<PublicLawyerProfile[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const [specializationOptions, setSpecializationOptions] = useState<string[]>([]);
  const [chapterOptions, setChapterOptions] = useState<string[]>([]);
  const [languageOptions, setLanguageOptions] = useState<string[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);

  // Fetch filter options + favorites once on mount
  useEffect(() => {
    const supabase = createClient();
    supabase
      .from('lawyer_profiles')
      .select('practice_areas, ibp_chapter, languages')
      .eq('verification_status', 'approved')
      .eq('is_visible', true)
      .then(({ data }) => {
        if (!data) return;
        setSpecializationOptions(
          Array.from(new Set(data.flatMap((l) => l.practice_areas ?? []))).sort()
        );
        setChapterOptions(
          Array.from(new Set(data.map((l) => l.ibp_chapter).filter(Boolean))).sort() as string[]
        );
        setLanguageOptions(
          Array.from(new Set(data.flatMap((l) => l.languages ?? []))).sort()
        );
      });

    if (isLoggedIn && userId) {
      supabase
        .from('lawyer_favorites')
        .select('lawyer_id')
        .eq('client_id', userId)
        .then(({ data }) => {
          setFavoriteIds(data?.map((f) => f.lawyer_id) ?? []);
        });
    }
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

    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { data, count } = await q.order('full_name', { ascending: true }).range(from, to);

    let filtered = data ?? [];
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="rounded-2xl p-5 bg-[#EFE5D8] animate-pulse h-52"
              style={{ boxShadow: '5px 5px 12px rgba(0,0,0,0.06),-5px -5px 12px rgba(255,255,255,0.9)' }}
            />
          ))}
        </div>
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
