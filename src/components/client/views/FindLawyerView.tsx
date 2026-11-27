'use client';

import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { AnimatePresence, MotionConfig, motion, useReducedMotion, type Variants } from 'motion/react';
import { createClient } from '@/lib/supabase/client';
import { LawyerGrid } from '@/components/client/LawyerGrid';
import { LawyerSearchFilters } from '@/components/client/LawyerSearchFilters';
import { LawyerDetailView } from '@/components/client/LawyerDetailView';
import { PanelLoader, useScreenLoading, useScreenReveal } from '@/components/shared/loading';
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
  },
];

// ─── Motion ──────────────────────────────────────────────────────────────────
const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * Page choreography (list view):
 *   the search well opens and the Search button pops out → the four filters rise in one by one
 *   → the divider draws itself → the lawyer cards deal in as a diagonal wave and fill in
 *   → pagination arrives. (The steps inside the search area live in LawyerSearchFilters and
 *   inherit the "hidden" → "show" labels from here; the grid times itself with `introDelay`.)
 * It plays when the page opens and again when you come back from a lawyer's profile.
 */
const pageVariants: Variants = {
  hidden: {},
  show: { transition: { delayChildren: 0.05 } },
};

/** Seconds the first card waits on the page entrance, so the search area lands first. */
const GRID_INTRO_DELAY = 0.62;
/** Shorter wait when only the results change (new filter or page). */
const GRID_REFRESH_DELAY = 0.08;

/**
 * Result sets swap direction-aware: "next page" slides the old grid out to the left and the
 * new one in from the right (and the reverse for "previous"); a new filter fades up instead.
 */
const resultsVariants: Variants = {
  enter: (dir: number) => ({ opacity: 0, x: dir * 56, y: dir === 0 ? 14 : 0 }),
  center: { opacity: 1, x: 0, y: 0, transition: { duration: 0.45, ease: EASE } },
  leave: (dir: number) => ({
    opacity: 0,
    x: dir * -56,
    y: dir === 0 ? -10 : 0,
    transition: { duration: 0.2, ease: 'easeIn' },
  }),
};

/** Thin sweeping line above the results while a new filter/page is loading. */
function RefreshBar({ active }: { active: boolean }) {
  return (
    <AnimatePresence>
      {active && (
        <motion.div
          key="refresh-bar"
          aria-hidden
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="absolute inset-x-0 -top-3 h-[3px] overflow-hidden rounded-full bg-[#341512]/10"
        >
          <motion.span
            animate={{ x: ['-100%', '260%'] }}
            transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
            className="block h-full w-2/5 rounded-full bg-[#D39758]"
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

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
  // The grid waits for the first real result set. Rendering the placeholder list first and then
  // swapping in fetched cards mid-entrance made the new cards skip the wave and pop in at once.
  const [hasResults, setHasResults] = useState(false);
  const [introDelay, setIntroDelay] = useState(GRID_INTRO_DELAY);
  // The page entrance (search area, then the cards) plays when the portal's loading screen
  // lifts; the loading screen itself waits for the first results and the filter options.
  const { revealed } = useScreenReveal();
  const revealedRef = useRef(revealed);
  const entranceStartRef = useRef(0);
  useEffect(() => {
    revealedRef.current = revealed;
    if (revealed) entranceStartRef.current = performance.now();
  }, [revealed]);
  const [optionsLoaded, setOptionsLoaded] = useState(false);
  useScreenLoading(!hasResults || !optionsLoaded);

  // Results transitions: `refreshing` dims the grid while a new filter/page loads;
  // `resultsVersion` bumps when a *different* result set lands so the grid fades out and re-cascades in.
  const [refreshing, setRefreshing] = useState(false);
  const [resultsVersion, setResultsVersion] = useState(0);
  const lastSignatureRef = useRef<string | null>(null);

  // The result set shown when the page entrance plays (first load, or back from a profile):
  // it waits for the search area to land and does not slide. Later result sets swap quickly.
  const [introResultsVersion, setIntroResultsVersion] = useState(0);

  // Which way the results should slide: by page number, or not at all for new filters.
  const filterKey = [queryParam, specParam, chapterParam, feeParam, langKey].join('|');
  const [seenQuery, setSeenQuery] = useState({ page: pageParam, filterKey });
  const [pageDir, setPageDir] = useState(0);
  if (seenQuery.page !== pageParam || seenQuery.filterKey !== filterKey) {
    setPageDir(seenQuery.filterKey === filterKey ? Math.sign(pageParam - seenQuery.page) : 0);
    setSeenQuery({ page: pageParam, filterKey });
  }
  const isIntroResults = resultsVersion === introResultsVersion;

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

    loadInitial().finally(() => setOptionsLoaded(true));
  }, [isLoggedIn, userId]);

  /**
   * Called when a fetch has applied its results. Only a genuinely different query/page
   * (not the first load, not a favorites refresh) triggers the fade-out → re-cascade.
   */
  const finishFetch = useCallback((signature: string) => {
    if (lastSignatureRef.current === null) {
      // First results: deal the cards in once the search area has landed (or right away if
      // the fetch took longer than the search area's entrance). Before the reveal the whole
      // entrance is still ahead.
      const elapsed = revealedRef.current ? (performance.now() - entranceStartRef.current) / 1000 : 0;
      setIntroDelay(Math.max(GRID_REFRESH_DELAY, GRID_INTRO_DELAY - elapsed));
      setHasResults(true);
    } else if (lastSignatureRef.current !== signature) {
      setResultsVersion((v) => v + 1);
    }
    lastSignatureRef.current = signature;
    setRefreshing(false);
  }, []);

  // Re-fetch lawyers whenever primitive URL search params change
  const fetchLawyers = useCallback(async () => {
    const signature = [queryParam, specParam, chapterParam, feeParam, langKey, pageParam].join('|');
    if (lastSignatureRef.current !== null && lastSignatureRef.current !== signature) {
      setRefreshing(true);
    }

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
        finishFetch(signature);
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
    finishFetch(signature);
  }, [queryParam, specParam, chapterParam, feeParam, langKey, pageParam, favoriteIds, finishFetch]);

  const [selectedLawyer, setSelectedLawyer] = useState<PublicLawyerProfile | null>(null);

  useEffect(() => {
    fetchLawyers();
  }, [fetchLawyers]);

  const scrollMainToTop = useCallback((behavior: ScrollBehavior) => {
    if (typeof document === 'undefined') return;
    const mainContent = document.getElementById('client-main-content');
    if (mainContent) {
      mainContent.scrollTo({ top: 0, behavior });
    } else {
      window.scrollTo({ top: 0, behavior });
    }
  }, []);

  // Jump to the top right away so the detail page's intro plays where you can see it
  const handleSelectLawyer = useCallback(
    (lawyer: PublicLawyerProfile) => {
      scrollMainToTop('auto');
      setSelectedLawyer(lawyer);
    },
    [scrollMainToTop]
  );

  return (
    // mode="wait": the list fades out, then the detail page arrives (and vice versa)
    <AnimatePresence mode="wait">
      {selectedLawyer ? (
        // LawyerDetailView runs its own intro, so this wrapper only crossfades
        <motion.div
          key="detail"
          initial={reduceMotion ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10, transition: { duration: 0.22, ease: 'easeIn' } }}
          transition={{ duration: 0.45, ease: EASE }}
          className="px-8 sm:px-12 lg:px-16 xl:px-20 py-6 sm:py-10 max-w-[1300px] mx-auto bg-[#E5D8CB] min-h-[calc(100vh-4rem)]"
        >
          <LawyerDetailView
            lawyer={selectedLawyer}
            onBack={() => {
              // The list remounts, so give it the full page entrance again
              setIntroResultsVersion(resultsVersion);
              setIntroDelay(GRID_INTRO_DELAY);
              setSelectedLawyer(null);
              scrollMainToTop('smooth');
            }}
            defaultTab="about"
          />
        </motion.div>
      ) : (
        <motion.div
          key="list"
          exit={{ opacity: 0, y: -10, transition: { duration: 0.22, ease: 'easeIn' } }}
          className="bg-[#E5D8CB] min-h-[calc(100vh-4rem)]"
        >
          <MotionConfig reducedMotion="user">
            <motion.div
              variants={pageVariants}
              initial={reduceMotion ? false : 'hidden'}
              animate={revealed ? 'show' : 'hidden'}
              className="px-8 sm:px-12 lg:px-16 xl:px-20 py-6 sm:py-10 max-w-[1300px] mx-auto space-y-6 sm:space-y-7"
            >
              <h1 className="sr-only">Find a Lawyer — Justicia Philippine Legal Intelligence</h1>

              {/* Top Search & 4-Column Filters matching Reference Image */}
              <div className="relative z-30">
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
              </div>

              {/* Lawyer Cards 3x3 Grid & Pagination */}
              <div className="relative z-10">
                <RefreshBar active={refreshing} />
                <span role="status" aria-live="polite" className="sr-only">
                  {refreshing ? 'Updating results…' : ''}
                </span>

                {/* Dims while a new filter/page loads */}
                <div className={`transition-opacity duration-300 ${refreshing ? 'opacity-60' : 'opacity-100'}`}>
                  {/* New result set: old grid fades up and out, new one fades in and its cards cascade again */}
                  <AnimatePresence mode="wait" custom={pageDir}>
                    {!hasResults ? (
                      // Only shows if the first fetch is slow
                      <motion.div
                        key="waiting"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1, transition: { delay: 0.9, duration: 0.3 } }}
                        exit={{ opacity: 0, transition: { duration: 0.12 } }}
                      >
                        <PanelLoader label="Finding lawyers..." className="min-h-[18rem]" />
                      </motion.div>
                    ) : !revealed ? null : (
                      <motion.div
                        key={resultsVersion}
                        custom={pageDir}
                        variants={resultsVariants}
                        initial={isIntroResults || reduceMotion ? false : 'enter'}
                        animate="center"
                        exit="leave"
                      >
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
                          onSelectLawyer={handleSelectLawyer}
                          direction={isIntroResults ? 0 : pageDir}
                          introDelay={isIntroResults ? introDelay : GRID_REFRESH_DELAY}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          </MotionConfig>
        </motion.div>
      )}
    </AnimatePresence>
  );
}