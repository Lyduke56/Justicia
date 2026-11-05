'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion, useReducedMotion, type Variants } from 'motion/react';
import { createClient } from '@/lib/supabase/client';
import { LawyerGrid } from '@/components/client/LawyerGrid';
import { LawyerSearchFilters } from '@/components/client/LawyerSearchFilters';
import { LawyerDetailView } from '@/components/client/LawyerDetailView';
import { LawyerGridSkeleton } from '@/components/skeletons';
import type { PublicLawyerProfile } from '@/components/client/LawyerGrid';

const PAGE_SIZE = 9;

interface FindLawyerViewProps {
  isLoggedIn: boolean;
  userId?: string;
}

/** Parse a scalar search-param safely */
function scalar(v: string | null): string {
  return v ?? '';
}

const DEFAULT_SPECIALIZATIONS = [
  'Labor & Employment',
  'Corporate Law',
  'Civil Law',
  'Criminal Law',
  'Family Law',
  'Real Estate',
  'Tax Law',
  'Immigration',
  'Intellectual Property',
  'Environmental Law',
  'Constitutional Law',
  'Banking & Finance',
  'Maritime Law',
  'Human Rights',
  'Commercial Arbitration',
];

const DEFAULT_CHAPTERS = [
  'MAKATI',
  'NCR — QUEZON CITY',
  'NCR — MANILA',
  'PASIG-SAN JUAN',
  'CEBU',
  'CEBU CITY',
  'DAVAO CITY',
  'PAMPANGA',
  'ILOILO',
  'BATANGAS',
];

const DEFAULT_LANGUAGES = [
  'English',
  'Filipino',
  'Tagalog',
  'Spanish',
  'Cebuano',
  'Ilocano',
  'Hiligaynon',
  'Mandarin',
];

const DEFAULT_LAWYERS: PublicLawyerProfile[] = [
  {
    userId: '22222222-2222-4222-8222-000000000001',
    fullName: 'Atty. Maria Elena Santos',
    rollNumber: '58942',
    ibpChapter: 'MAKATI',
    about: 'Specializing in Labor & Employment, Corporate restructuring, and Civil disputes with over 9 years of active litigation and corporate counseling.',
    practiceAreas: ['Labor & Employment', 'Corporate', 'Civil Law'],
    languages: ['English', 'Filipino', 'Spanish'],
    experienceYears: 9,
    photoUrl: null,
    isAvailable: true,
    feeInitial30min: 800,
    feeStandard60min: 1500,
    feeExtended120min: 2800,
    barPasserYear: 2017,
    isFavorite: false,
    rating: 4.9,
    reviewCount: 53,
  },
  {
    userId: '22222222-2222-4222-8222-000000000002',
    fullName: 'Atty. Juan Carlos Dela Cruz',
    rollNumber: '59144',
    ibpChapter: 'NCR — QUEZON CITY',
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
    ibpChapter: 'CEBU CITY',
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
    ibpChapter: 'CEBU',
    about: 'Advising private individuals and developers on Land Registration Act compliance, Torrens title verification, and complex probate settlements in the Visayas.',
    practiceAreas: ['Real Estate', 'Civil Law', 'Estate Planning'],
    languages: ['Cebuano', 'English', 'Tagalog'],
    experienceYears: 15,
    photoUrl: null,
    isAvailable: true,
    feeInitial30min: 1800,
    feeStandard60min: 3000,
    feeExtended120min: 5500,
    barPasserYear: 2011,
    isFavorite: false,
    rating: 4.94,
    reviewCount: 61,
  },
  {
    userId: '22222222-2222-4222-8222-000000000005',
    fullName: 'Atty. Roberto Emilio Tan',
    rollNumber: '63412',
    ibpChapter: 'NCR — MANILA',
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
    ibpChapter: 'QUEZON CITY',
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
    ibpChapter: 'MAKATI',
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
    ibpChapter: 'DAVAO CITY',
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
  {
    userId: '22222222-2222-4222-8222-000000000009',
    fullName: 'Atty. Maria Clara Santos',
    rollNumber: '54821',
    ibpChapter: 'PASIG-SAN JUAN',
    about: 'Specializing in Family Law, Estate Planning, and Civil Litigation with over a decade of practice.',
    practiceAreas: ['Family Law', 'Estate Planning', 'Civil Law'],
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
    userId: '22222222-2222-4222-8222-000000000010',
    fullName: 'Atty. Patricia Ann Lim',
    rollNumber: '64910',
    ibpChapter: 'NCR — MANILA',
    about: 'Intellectual Property attorney handling patent prosecution, copyright licensing, and data privacy compliance.',
    practiceAreas: ['Intellectual Property', 'Corporate Law', 'Tech & Privacy'],
    languages: ['English', 'Filipino', 'Mandarin'],
    experienceYears: 10,
    photoUrl: null,
    isAvailable: true,
    feeInitial30min: 1200,
    feeStandard60min: 2000,
    feeExtended120min: 3800,
    barPasserYear: 2016,
    isFavorite: false,
    rating: 4.87,
    reviewCount: 31,
  },
  {
    userId: '22222222-2222-4222-8222-000000000011',
    fullName: 'Atty. Rafael Vicente Cruz',
    rollNumber: '53188',
    ibpChapter: 'PAMPANGA',
    about: 'Commercial litigator advising SMEs and multinational corporations on regulatory compliance and arbitration.',
    practiceAreas: ['Corporate Law', 'Banking & Finance', 'Commercial Arbitration'],
    languages: ['Filipino', 'English', 'Kapampangan'],
    experienceYears: 17,
    photoUrl: null,
    isAvailable: true,
    feeInitial30min: 1500,
    feeStandard60min: 2800,
    feeExtended120min: 5000,
    barPasserYear: 2009,
    isFavorite: false,
    rating: 4.93,
    reviewCount: 49,
  },
  {
    userId: '22222222-2222-4222-8222-000000000012',
    fullName: 'Atty. Teresa Beatriz Morales',
    rollNumber: '67455',
    ibpChapter: 'ILOILO',
    about: 'Family and matrimonial law advocate with deep compassion for adoption, annulment, and custody proceedings.',
    practiceAreas: ['Family Law', 'Civil Law', 'Human Rights'],
    languages: ['Hiligaynon', 'Filipino', 'English'],
    experienceYears: 7,
    photoUrl: null,
    isAvailable: true,
    feeInitial30min: 900,
    feeStandard60min: 1600,
    feeExtended120min: 3000,
    barPasserYear: 2019,
    isFavorite: false,
    rating: 4.86,
    reviewCount: 26,
  },
  {
    userId: '22222222-2222-4222-8222-000000000013',
    fullName: 'Atty. Gabriel Antonio Ramos',
    rollNumber: '57321',
    ibpChapter: 'NCR — QUEZON CITY',
    about: 'Specialist in appellate review, constitutional issues, and certiorari petitions before the Supreme Court.',
    practiceAreas: ['Constitutional Law', 'Civil Litigation', 'Criminal Law'],
    languages: ['English', 'Filipino'],
    experienceYears: 12,
    photoUrl: null,
    isAvailable: true,
    feeInitial30min: 1400,
    feeStandard60min: 2400,
    feeExtended120min: 4400,
    barPasserYear: 2014,
    isFavorite: false,
    rating: 4.9,
    reviewCount: 39,
  },
  {
    userId: '22222222-2222-4222-8222-000000000014',
    fullName: 'Atty. Carmela Denise Aquino',
    rollNumber: '62901',
    ibpChapter: 'MAKATI',
    about: 'Tax dispute specialist assisting taxpayers with BIR assessments, Court of Tax Appeals litigation, and tax treaties.',
    practiceAreas: ['Tax Law', 'Corporate Law', 'Banking & Finance'],
    languages: ['Filipino', 'English', 'Spanish'],
    experienceYears: 11,
    photoUrl: null,
    isAvailable: true,
    feeInitial30min: 1600,
    feeStandard60min: 2800,
    feeExtended120min: 5200,
    barPasserYear: 2015,
    isFavorite: false,
    rating: 4.92,
    reviewCount: 44,
  },
  {
    userId: '22222222-2222-4222-8222-000000000015',
    fullName: 'Atty. Leandro Miguel Ocampo',
    rollNumber: '55432',
    ibpChapter: 'BATANGAS',
    about: 'Expert in real estate title transfers, subdivision titling, and DAR land conversion issues in Southern Luzon.',
    practiceAreas: ['Real Estate', 'Civil Law', 'Agrarian Reform'],
    languages: ['Tagalog', 'English'],
    experienceYears: 15,
    photoUrl: null,
    isAvailable: true,
    feeInitial30min: 1100,
    feeStandard60min: 2000,
    feeExtended120min: 3800,
    barPasserYear: 2011,
    isFavorite: false,
    rating: 4.88,
    reviewCount: 35,
  },
  {
    userId: '22222222-2222-4222-8222-000000000016',
    fullName: 'Atty. Francesca Sophia Villar',
    rollNumber: '69112',
    ibpChapter: 'NCR — PASAY',
    about: 'Immigration lawyer assisting foreigners, dual citizenship applicants, visa conversions, and deportation defense.',
    practiceAreas: ['Immigration', 'Labor & Employment', 'Civil Law'],
    languages: ['English', 'Filipino', 'Mandarin'],
    experienceYears: 6,
    photoUrl: null,
    isAvailable: true,
    feeInitial30min: 800,
    feeStandard60min: 1500,
    feeExtended120min: 2700,
    barPasserYear: 2020,
    isFavorite: false,
    rating: 4.84,
    reviewCount: 22,
  },
  {
    userId: '22222222-2222-4222-8222-000000000017',
    fullName: 'Atty. Dominic Salvador Flores',
    rollNumber: '60128',
    ibpChapter: 'MISAMIS ORIENTAL',
    about: 'Environmental, mining, and regulatory compliance counsel for industrial concerns across Northern Mindanao.',
    practiceAreas: ['Environmental Law', 'Corporate Law', 'Litigation'],
    languages: ['Cebuano', 'Filipino', 'English'],
    experienceYears: 13,
    photoUrl: null,
    isAvailable: true,
    feeInitial30min: 1300,
    feeStandard60min: 2300,
    feeExtended120min: 4200,
    barPasserYear: 2013,
    isFavorite: false,
    rating: 4.89,
    reviewCount: 33,
  },
  {
    userId: '22222222-2222-4222-8222-000000000018',
    fullName: 'Atty. Bianca Clarisse Navarro',
    rollNumber: '66340',
    ibpChapter: 'MAKATI',
    about: 'Banking regulatory compliance, debt restructuring, fintech licensing, and financial consumer protection.',
    practiceAreas: ['Banking & Finance', 'Corporate Law', 'Commercial Law'],
    languages: ['English', 'Filipino'],
    experienceYears: 9,
    photoUrl: null,
    isAvailable: true,
    feeInitial30min: 1200,
    feeStandard60min: 2200,
    feeExtended120min: 4000,
    barPasserYear: 2017,
    isFavorite: false,
    rating: 4.91,
    reviewCount: 40,
  },
];

// Motion Variants matching DashboardView & AIAssistantChat
const EASE = [0.16, 1, 0.3, 1] as const;

const pageVariants: Variants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.12,
      delayChildren: 0.05,
    },
  },
};

const topSectionVariants: Variants = {
  hidden: { opacity: 0, y: -18, filter: 'blur(5px)' },
  show: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { duration: 0.55, ease: EASE },
  },
};

export function FindLawyerView({ isLoggedIn, userId }: FindLawyerViewProps) {
  const searchParams = useSearchParams();
  const reduceMotion = useReducedMotion();

  // Extract primitive strings from searchParams to prevent reference-churn infinite render loops
  const queryParam = scalar(searchParams.get('q')) || scalar(searchParams.get('query'));
  const specParam = scalar(searchParams.get('specialization'));
  const chapterParam = scalar(searchParams.get('chapter'));
  const feeParam = scalar(searchParams.get('fee'));
  const langKey = searchParams.getAll('lang').join(',');
  const pageParam = Math.max(1, Number(scalar(searchParams.get('page'))) || 1);

  const filters = useMemo(
    () => ({
      query: queryParam,
      specialization: specParam,
      chapter: chapterParam,
      feeRange: feeParam,
      languages: langKey ? langKey.split(',') : [],
    }),
    [queryParam, specParam, chapterParam, feeParam, langKey]
  );

  const [lawyers, setLawyers] = useState<PublicLawyerProfile[]>(() =>
    DEFAULT_LAWYERS.slice(0, PAGE_SIZE)
  );
  const [totalCount, setTotalCount] = useState(DEFAULT_LAWYERS.length);
  const [loading, setLoading] = useState(false);

  const [specializationOptions, setSpecializationOptions] = useState<string[]>(DEFAULT_SPECIALIZATIONS);
  const [chapterOptions, setChapterOptions] = useState<string[]>(DEFAULT_CHAPTERS);
  const [languageOptions, setLanguageOptions] = useState<string[]>(DEFAULT_LANGUAGES);
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

  // Re-fetch lawyers whenever primitive URL search params change
  const fetchLawyers = useCallback(async () => {
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

    if (queryParam) {
      q = q.or(`full_name.ilike.%${queryParam}%,roll_number.ilike.%${queryParam}%`);
    }
    if (specParam && specParam !== 'all') {
      q = q.contains('practice_areas', [specParam]);
    }
    if (chapterParam && chapterParam !== 'all') {
      q = q.ilike('ibp_chapter', chapterParam);
    }
    if (feeParam && feeParam !== 'all') {
      const [minStr, maxStr] = feeParam.split('-');
      const min = Number(minStr);
      const max = maxStr === '+' ? 999999 : Number(maxStr);
      if (!isNaN(min)) q = q.gte('fee_standard_60min', min);
      if (!isNaN(max) && maxStr !== '+') q = q.lte('fee_standard_60min', max);
    }
    const currentLanguages = langKey ? langKey.split(',') : [];
    for (const lang of currentLanguages) {
      q = q.contains('languages', [lang]);
    }

    q = q.order('experience_years', { ascending: false, nullsFirst: false });

    const from = (pageParam - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    try {
      const { data, count, error } = await q.range(from, to);
      if (!error && data && data.length > 0) {
        let filtered = data;
        if (queryParam) {
          const lq = queryParam.toLowerCase();
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
    if (specParam && specParam !== 'all') {
      const specLower = specParam.toLowerCase();
      fallback = fallback.filter((l) =>
        l.practiceAreas.some(
          (a) => a.toLowerCase().includes(specLower) || specLower.includes(a.toLowerCase())
        )
      );
    }
    if (chapterParam && chapterParam !== 'all') {
      const chLower = chapterParam.toLowerCase();
      fallback = fallback.filter((l) => l.ibpChapter.toLowerCase().includes(chLower));
    }
    if (feeParam && feeParam !== 'all') {
      const [minStr, maxStr] = feeParam.split('-');
      const min = Number(minStr);
      const max = maxStr === '+' ? 999999 : Number(maxStr);
      if (!isNaN(min)) fallback = fallback.filter((l) => (l.feeStandard60min ?? 0) >= min);
      if (!isNaN(max) && maxStr !== '+') fallback = fallback.filter((l) => (l.feeStandard60min ?? 0) <= max);
    }
    if (currentLanguages.length > 0) {
      fallback = fallback.filter((l) =>
        currentLanguages.some((lang) =>
          l.languages.map((x) => x.toLowerCase()).includes(lang.toLowerCase())
        )
      );
    }
    if (queryParam) {
      const lq = queryParam.toLowerCase();
      fallback = fallback.filter(
        (l) =>
          l.fullName.toLowerCase().includes(lq) ||
          l.rollNumber.toLowerCase().includes(lq) ||
          l.practiceAreas.some((a) => a.toLowerCase().includes(lq))
      );
    }

    fallback.sort((a, b) => (b.experienceYears ?? 0) - (a.experienceYears ?? 0));

    const pagedFallback = fallback.slice(from, to + 1).map((l) => ({
      ...l,
      isFavorite: favoriteIds.includes(l.userId),
    }));

    setLawyers(pagedFallback);
    setTotalCount(fallback.length);
    setLoading(false);
  }, [queryParam, specParam, chapterParam, feeParam, langKey, pageParam, favoriteIds]);

  const [selectedLawyer, setSelectedLawyer] = useState<PublicLawyerProfile | null>(null);

  useEffect(() => {
    fetchLawyers();
  }, [fetchLawyers]);

  // When a lawyer is selected, render LawyerDetailView without the search bar or filters
  if (selectedLawyer) {
    return (
      <motion.div
        variants={pageVariants}
        initial={reduceMotion ? false : 'hidden'}
        animate="show"
        className="px-8 sm:px-12 lg:px-16 xl:px-20 py-6 sm:py-10 max-w-[1300px] mx-auto bg-[#E5D8CB] min-h-[calc(100vh-4rem)]"
      >
        <LawyerDetailView
          lawyer={selectedLawyer}
          onBack={() => {
            setSelectedLawyer(null);
            if (typeof document !== 'undefined') {
              const mainContent = document.getElementById('client-main-content');
              if (mainContent) {
                mainContent.scrollTo({ top: 0, behavior: 'smooth' });
              } else {
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }
            }
          }}
          defaultTab="about"
        />
      </motion.div>
    );
  }

  return (
    <motion.div
      variants={pageVariants}
      initial={reduceMotion ? false : 'hidden'}
      animate="show"
      className="px-8 sm:px-12 lg:px-16 xl:px-20 py-6 sm:py-10 max-w-[1300px] mx-auto space-y-6 sm:space-y-7 bg-[#E5D8CB] min-h-[calc(100vh-4rem)]"
    >
      <h1 className="sr-only">Find a Lawyer — Justicia Philippine Legal Intelligence</h1>

      {/* Top Search & 4-Column Filters matching Reference Image */}
      <motion.div variants={topSectionVariants} className="relative z-30">
        <LawyerSearchFilters
          filters={filters}
          isLoggedIn={isLoggedIn}
          totalCount={totalCount}
          page={pageParam}
          pageSize={PAGE_SIZE}
          specializationOptions={specializationOptions}
          chapterOptions={chapterOptions}
          languageOptions={languageOptions}
        />
      </motion.div>

      {/* Lawyer Cards 3x3 Grid & Pagination with Smooth Cascading Animation */}
      <div className="relative z-10">
        {loading ? (
          <LawyerGridSkeleton count={PAGE_SIZE} />
        ) : (
          <LawyerGrid
            lawyers={lawyers}
            totalCount={totalCount}
            page={pageParam}
            pageSize={PAGE_SIZE}
            specializationOptions={specializationOptions}
            chapterOptions={chapterOptions}
            languageOptions={languageOptions}
            filters={filters}
            isLoggedIn={isLoggedIn}
            onSelectLawyer={setSelectedLawyer}
          />
        )}
      </div>
    </motion.div>
  );
}
