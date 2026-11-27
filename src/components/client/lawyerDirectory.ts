/**
 * The Find a Lawyer directory, shared by the Find a Lawyer tab and the client dashboard's
 * "Recommended Lawyers" so both list the same attorneys: approved and visible lawyer profiles,
 * most experienced first, with the same sample list when the database has none.
 *
 * Clicking a dashboard card opens /client/lawyers?lawyer=<id>, which shows that lawyer's
 * profile in the Find a Lawyer tab exactly as clicking the card there does. Lawyers the
 * dashboard already loaded are remembered here so the profile opens without a second fetch.
 */
import { createClient } from '@/lib/supabase/client';
import { attorneyNameOr } from '@/lib/utils/attorneyName';
import type { PublicLawyerProfile } from './LawyerGrid';

/** Columns Find a Lawyer reads from `lawyer_profiles`. */
const DIRECTORY_COLUMNS = `user_id, full_name, roll_number, ibp_chapter, about, practice_areas, languages,
  experience_years, photo_url, is_available, fee_standard_60min, fee_initial_30min,
  fee_extended_120min, bar_passer_year, verification_status`;

/** More than any directory page needs; PostgREST caps a response at 1000 rows anyway. */
const MAX_DIRECTORY_ROWS = 1000;

interface DirectoryRow {
  user_id: string;
  full_name: string | null;
  roll_number: string | null;
  ibp_chapter: string | null;
  about: string | null;
  practice_areas: string[] | null;
  languages: string[] | null;
  experience_years: number | null;
  photo_url: string | null;
  is_available: boolean | null;
  fee_standard_60min: number | string | null;
  fee_initial_30min: number | string | null;
  fee_extended_120min: number | string | null;
  bar_passer_year: number | null;
}

// NUMERIC columns can arrive as strings.
const fee = (v: number | string | null | undefined) => (v === null || v === undefined ? null : Number(v));

function toPublicLawyer(l: DirectoryRow): PublicLawyerProfile {
  return {
    userId: l.user_id,
    fullName: attorneyNameOr(l.full_name, ''),
    rollNumber: l.roll_number ?? '',
    ibpChapter: l.ibp_chapter ?? '',
    practiceAreas: l.practice_areas ?? [],
    languages: l.languages ?? [],
    experienceYears: l.experience_years ?? null,
    photoUrl: l.photo_url ?? null,
    isAvailable: l.is_available ?? true,
    feeStandard60min: fee(l.fee_standard_60min),
    feeInitial30min: fee(l.fee_initial_30min),
    feeExtended120min: fee(l.fee_extended_120min),
    about: l.about ?? null,
    barPasserYear: l.bar_passer_year ?? null,
    isFavorite: false,
  };
}

const remembered = new Map<string, PublicLawyerProfile>();

export function rememberLawyers(lawyers: PublicLawyerProfile[]) {
  for (const l of lawyers) remembered.set(l.userId, l);
}

export function recallLawyer(id: string): PublicLawyerProfile | null {
  return remembered.get(id) ?? null;
}

/** Opens this lawyer's profile in the Find a Lawyer tab. */
export function lawyerProfileHref(id: string): string {
  return `/client/lawyers?lawyer=${encodeURIComponent(id)}`;
}

/** Sample list, most experienced first (Find a Lawyer's order with no filters). */
function sampleDirectory(): PublicLawyerProfile[] {
  return [...DEFAULT_LAWYERS].sort((a, b) => (b.experienceYears ?? 0) - (a.experienceYears ?? 0));
}

/** Every lawyer Find a Lawyer lists (unfiltered), in its order. */
export async function fetchDirectoryLawyers(): Promise<PublicLawyerProfile[]> {
  try {
    const { data, error } = await createClient()
      .from('lawyer_profiles')
      .select(DIRECTORY_COLUMNS)
      .eq('verification_status', 'approved')
      .eq('is_visible', true)
      .order('experience_years', { ascending: false, nullsFirst: false })
      .range(0, MAX_DIRECTORY_ROWS - 1);
    if (!error && data && data.length > 0) {
      const lawyers = (data as unknown as DirectoryRow[]).map(toPublicLawyer);
      rememberLawyers(lawyers);
      return lawyers;
    }
  } catch {
    // Fall through to the sample list, like Find a Lawyer.
  }
  const sample = sampleDirectory();
  rememberLawyers(sample);
  return sample;
}

/** One listed lawyer (approved and visible), or a sample lawyer; null if neither. */
export async function fetchDirectoryLawyer(id: string): Promise<PublicLawyerProfile | null> {
  const cached = recallLawyer(id);
  if (cached) return cached;
  try {
    const { data } = await createClient()
      .from('lawyer_profiles')
      .select(DIRECTORY_COLUMNS)
      .eq('user_id', id)
      .eq('verification_status', 'approved')
      .eq('is_visible', true)
      .maybeSingle();
    if (data) {
      const lawyer = toPublicLawyer(data as unknown as DirectoryRow);
      rememberLawyers([lawyer]);
      return lawyer;
    }
  } catch {
    // Try the sample list below.
  }
  return DEFAULT_LAWYERS.find((l) => l.userId === id) ?? null;
}

/** Shown when the database has no approved lawyers (or cannot be reached). */
export const DEFAULT_LAWYERS: PublicLawyerProfile[] = [
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
