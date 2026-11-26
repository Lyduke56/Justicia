'use client';

import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { AnimatePresence, MotionConfig, motion, useReducedMotion, type Variants } from 'motion/react';
import { createClient } from '@/lib/supabase/client';
import { LawyerGrid } from '@/components/client/LawyerGrid';
import { LawyerSearchFilters } from '@/components/client/LawyerSearchFilters';
import { LawyerDetailView } from '@/components/client/LawyerDetailView';
import { PanelLoader } from '@/components/shared/loading';
import type { PublicLawyerProfile } from '@/components/client/LawyerGrid';
import { DEFAULT_LAWYERS, fetchDirectoryLawyer, recallLawyer } from '@/components/client/lawyerDirectory';

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
  // ?lawyer=<id> (from a dashboard "Recommended Lawyers" card) opens that lawyer's profile.
  const lawyerParam = scalar(searchParams.get('lawyer'));

  const [selectedLawyer, setSelectedLawyer] = useState<PublicLawyerProfile | null>(() =>
    lawyerParam ? recallLawyer(lawyerParam) : null
  );
  // The linked lawyer still loading (not remembered from the dashboard); cleared on Back.
  const [linkedLawyerId, setLinkedLawyerId] = useState(lawyerParam);
  const [dismissedLawyerId, setDismissedLawyerId] = useState('');
  if (lawyerParam !== linkedLawyerId) {
    setLinkedLawyerId(lawyerParam);
    if (lawyerParam) {
      setDismissedLawyerId('');
      setSelectedLawyer(recallLawyer(lawyerParam));
    }
  }
  const linkPending = !!lawyerParam && lawyerParam !== dismissedLawyerId && !selectedLawyer;

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
  const entranceStartRef = useRef(0);
  useEffect(() => {
    entranceStartRef.current = performance.now();
  }, []);

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

    loadInitial();
  }, [isLoggedIn, userId]);

  /**
   * Called when a fetch has applied its results. Only a genuinely different query/page
   * (not the first load, not a favorites refresh) triggers the fade-out → re-cascade.
   */
  const finishFetch = useCallback((signature: string) => {
    if (lastSignatureRef.current === null) {
      // First results: deal the cards in once the search area has landed (or right away if
      // the fetch took longer than the search area's entrance).
      const elapsed = (performance.now() - entranceStartRef.current) / 1000;
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

  useEffect(() => {
    fetchLawyers();
  }, [fetchLawyers]);

  // A linked lawyer the dashboard hadn't loaded: fetch it; if it isn't listed, show the list.
  useEffect(() => {
    if (!linkPending) return;
    let active = true;
    fetchDirectoryLawyer(lawyerParam).then((lawyer) => {
      if (!active) return;
      if (lawyer) setSelectedLawyer(lawyer);
      else setDismissedLawyerId(lawyerParam);
    });
    return () => {
      active = false;
    };
  }, [linkPending, lawyerParam]);

  /** Drops ?lawyer= from the address bar (keeps any filters) without reloading the tab. */
  const clearLawyerParam = useCallback(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (!params.has('lawyer')) return;
    params.delete('lawyer');
    const qs = params.toString();
    window.history.replaceState(null, '', `${window.location.pathname}${qs ? `?${qs}` : ''}`);
  }, []);

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
              if (lawyerParam) {
                setDismissedLawyerId(lawyerParam);
                clearLawyerParam();
              }
              setSelectedLawyer(null);
              scrollMainToTop('smooth');
            }}
            defaultTab="about"
          />
        </motion.div>
      ) : linkPending ? (
        // Opening a lawyer linked from the dashboard
        <motion.div
          key="opening"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { delay: 0.3, duration: 0.3 } }}
          exit={{ opacity: 0, transition: { duration: 0.12 } }}
          className="px-8 sm:px-12 lg:px-16 xl:px-20 py-6 sm:py-10 max-w-[1300px] mx-auto bg-[#E5D8CB] min-h-[calc(100vh-4rem)]"
        >
          <PanelLoader label="Opening profile..." className="min-h-[18rem]" />
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
              animate="show"
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
                    ) : (
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