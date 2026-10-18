import type { Metadata } from 'next';
import { Suspense } from 'react';
import { connection } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { LawyerSearchFilters } from '@/components/client/LawyerSearchFilters';
import { LawyerGrid } from '@/components/client/LawyerGrid';
import type { PublicLawyerProfile } from '@/components/client/LawyerGrid';

export const metadata: Metadata = {
  title: 'Find a Lawyer',
  description: 'Search and connect with verified Philippine lawyers across specializations.',
};

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

// Parse a scalar search param safely
function scalar(v: string | string[] | undefined): string {
  if (!v) return '';
  return Array.isArray(v) ? v[0] : v;
}

export default async function FindLawyerPage({ searchParams }: PageProps) {
  // Force dynamic rendering (reads searchParams)
  await connection();

  const sp = await searchParams;
  const query = scalar(sp.q) || scalar(sp.query) || '';
  const specialization = scalar(sp.specialization) || '';
  const chapter = scalar(sp.chapter) || '';
  const feeRange = scalar(sp.fee) || '';
  const languages = sp.lang ? (Array.isArray(sp.lang) ? sp.lang : [sp.lang]) : [];
  const favoritesOnly = scalar(sp.favorites) === 'true';
  const page = Math.max(1, Number(scalar(sp.page)) || 1);
  const pageSize = 12;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // ─── Fetch approved + visible lawyers with filters ─────────────────────────
  let dbQuery = supabase
    .from('lawyer_profiles')
    .select(
      `user_id, full_name, roll_number, ibp_chapter, about, practice_areas, languages,
       experience_years, photo_url, is_available, fee_standard_60min, fee_initial_30min,
       fee_extended_120min, bar_passer_year, verification_status`,
      { count: 'exact' }
    )
    .eq('verification_status', 'approved')
    .eq('is_visible', true);

  // Search by name, roll number, or practice area
  if (query) {
    dbQuery = dbQuery.or(
      `full_name.ilike.%${query}%,roll_number.ilike.%${query}%`
    );
  }

  // Filter by specialization
  if (specialization && specialization !== 'all') {
    dbQuery = dbQuery.contains('practice_areas', [specialization]);
  }

  // Filter by IBP chapter
  if (chapter && chapter !== 'all') {
    dbQuery = dbQuery.ilike('ibp_chapter', chapter);
  }

  // Filter by fee range
  if (feeRange && feeRange !== 'all') {
    const [minStr, maxStr] = feeRange.split('-');
    const min = Number(minStr);
    const max = maxStr === '+' ? 999999 : Number(maxStr);
    if (!isNaN(min)) dbQuery = dbQuery.gte('fee_standard_60min', min);
    if (!isNaN(max) && maxStr !== '+') dbQuery = dbQuery.lte('fee_standard_60min', max);
  }

  // Filter by language
  if (languages.length > 0) {
    for (const lang of languages) {
      dbQuery = dbQuery.contains('languages', [lang]);
    }
  }

  // Favorites filter — need user's favorites
  let favoriteIds: string[] = [];
  if (user) {
    const { data: favs } = await supabase
      .from('lawyer_favorites')
      .select('lawyer_id')
      .eq('client_id', user.id);
    favoriteIds = favs?.map(f => f.lawyer_id) ?? [];
  }

  if (favoritesOnly && favoriteIds.length > 0) {
    dbQuery = dbQuery.in('user_id', favoriteIds);
  } else if (favoritesOnly && favoriteIds.length === 0) {
    // No favorites — return empty
    return (
      <FindLawyerLayout
        user={user}
        filters={{ query, specialization, chapter, feeRange, languages, favoritesOnly }}
        totalCount={0}
        page={page}
        pageSize={pageSize}
      >
        <EmptyState message="You have no favorites yet. Click the heart icon on a lawyer card to save them here." />
      </FindLawyerLayout>
    );
  }

  // Pagination
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const { data: lawyers, count, error } = await dbQuery
    .order('full_name', { ascending: true })
    .range(from, to);

  // Filter by practice area text match for query (supplemental — pgvector not seeded yet)
  let filteredLawyers = lawyers ?? [];
  if (query) {
    const lq = query.toLowerCase();
    filteredLawyers = filteredLawyers.filter(l => {
      const nameMatch = l.full_name?.toLowerCase().includes(lq);
      const rollMatch = l.roll_number?.toLowerCase().includes(lq);
      const areaMatch = l.practice_areas?.some((a: string) => a.toLowerCase().includes(lq));
      return nameMatch || rollMatch || areaMatch;
    });
  }

  const totalCount = count && count > 0 ? count : filteredLawyers.length;

  // Build filter options from data (for dropdowns)
  const { data: allForFilters } = await supabase
    .from('lawyer_profiles')
    .select('practice_areas, ibp_chapter, languages, fee_standard_60min')
    .eq('verification_status', 'approved')
    .eq('is_visible', true);

  const specializationOptions = Array.from(
    new Set((allForFilters ?? []).flatMap(l => l.practice_areas ?? []))
  ).sort();

  const chapterOptions = Array.from(
    new Set((allForFilters ?? []).map(l => l.ibp_chapter).filter(Boolean))
  ).sort() as string[];

  const languageOptions = Array.from(
    new Set((allForFilters ?? []).flatMap(l => l.languages ?? []))
  ).sort();

  if (error) {
    return (
      <FindLawyerLayout
        user={user}
        filters={{ query, specialization, chapter, feeRange, languages, favoritesOnly }}
        totalCount={0}
        page={page}
        pageSize={pageSize}
      >
        <div className="p-8 text-center text-[#7D6855]">
          <p>Unable to load lawyers. Please try again later.</p>
        </div>
      </FindLawyerLayout>
    );
  }

  const lawyerProfiles: PublicLawyerProfile[] = filteredLawyers.map(l => ({
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
  }));

  return (
    <FindLawyerLayout
      user={user}
      filters={{ query, specialization, chapter, feeRange, languages, favoritesOnly }}
      totalCount={totalCount}
      page={page}
      pageSize={pageSize}
    >
      <Suspense fallback={<LawyerGridSkeleton />}>
        <LawyerGrid
          lawyers={lawyerProfiles}
          totalCount={totalCount}
          page={page}
          pageSize={pageSize}
          specializationOptions={specializationOptions}
          chapterOptions={chapterOptions}
          languageOptions={languageOptions}
          filters={{ query, specialization, chapter, feeRange, languages, favoritesOnly }}
          isLoggedIn={!!user}
        />
      </Suspense>
    </FindLawyerLayout>
  );
}

// ─── Layout wrapper ────────────────────────────────────────────────────────────
function FindLawyerLayout({
  children,
  user,
  filters,
  totalCount,
  page,
  pageSize,
}: {
  children: React.ReactNode;
  user: { id: string } | null;
  filters: {
    query: string;
    specialization: string;
    chapter: string;
    feeRange: string;
    languages: string[];
    favoritesOnly: boolean;
  };
  totalCount: number;
  page: number;
  pageSize: number;
}) {
  return (
    <div className="p-5 sm:p-8 max-w-[1400px] mx-auto space-y-5">
      <h1 className="sr-only">Find a Lawyer — Justicia</h1>
      <Suspense fallback={null}>
        <LawyerSearchFilters
          filters={filters}
          isLoggedIn={!!user}
          totalCount={totalCount}
          page={page}
          pageSize={pageSize}
        />
      </Suspense>
      {children}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="py-20 text-center space-y-3">
      <div className="text-5xl">🔍</div>
      <p className="text-[#5C4535] font-medium">No lawyers match your filters</p>
      <p className="text-[#A69584] text-sm max-w-md mx-auto">{message}</p>
    </div>
  );
}

function LawyerGridSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
      {Array.from({ length: 12 }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl p-5 bg-[#EFE5D8] animate-pulse h-52"
          style={{ boxShadow: '5px 5px 12px rgba(0,0,0,0.06),-5px -5px 12px rgba(255,255,255,0.9)' }}
        />
      ))}
    </div>
  );
}
