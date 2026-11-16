'use server';

import { revalidatePath } from 'next/cache';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import type {
  LawyerProfileRow,
  LawyerPracticeAreaDetailRow,
  LawyerExperienceRow,
  LawyerServiceRow,
  LawyerEducationRow,
  LawyerCaseSummaryRow,
} from '@/types/database';

/**
 * Lawyer-side "Lawyer Profile" backend.
 *
 * Every action authenticates the caller with the cookie-bound client, then reads/writes with the
 * service client strictly scoped to `user.id`. The service client is needed because the
 * `lp_lawyer_own_update` RLS policy rejects updates from already-approved lawyers; scoping every
 * query to the caller's own id (and whitelisting columns) keeps this equivalent to an owner-only
 * policy without letting a lawyer touch verification fields.
 */

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_LIST_ITEMS = 30;
const MAX_FEE = 1_000_000;

type ActionResult = { success: true } | { success: false; error: string };

// ─── Shared types (serializable, passed from the server page to the client view) ─────────────

export interface LawyerOwnProfileDetails {
  practiceAreaDetails: LawyerPracticeAreaDetailRow[];
  experiences: LawyerExperienceRow[];
  services: LawyerServiceRow[];
  education: LawyerEducationRow[];
  caseSummaries: LawyerCaseSummaryRow[];
}

export interface LawyerOwnProfileData {
  profile: LawyerProfileRow;
  details: LawyerOwnProfileDetails;
}

export interface PracticeAreaInput { id?: string; area: string; description?: string }
export interface ExperienceInput { id?: string; title: string; organization?: string; years?: string; description?: string }
export interface ServiceInput { id?: string; name: string; description?: string }
export interface EducationInput {
  id?: string;
  degree: string;
  school?: string;
  startYear?: number | null;
  endYear?: number | null;
  description?: string;
}

export interface UpdateLawyerProfileInput {
  about: string;
  ibpChapter: string;
  languages: string[];
  experienceYears: number | null;
  barPasserYear: number | null;
  feeInitial30min: number | null;
  feeStandard60min: number | null;
  feeExtended120min: number | null;
  practiceAreas: PracticeAreaInput[];
  experiences: ExperienceInput[];
  services: ServiceInput[];
  education: EducationInput[];
}

export interface SaveLawyerCaseInput {
  id?: string;
  title: string;
  practiceArea?: string;
  year?: number | null;
  summary: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

class ValidationError extends Error {}

function text(value: unknown, label: string, max: number, required = false): string {
  const s = typeof value === 'string' ? value.trim() : '';
  if (required && !s) throw new ValidationError(`${label} is required.`);
  if (s.length > max) throw new ValidationError(`${label} must be ${max} characters or fewer.`);
  return s;
}

function optionalText(value: unknown, label: string, max: number): string | null {
  return text(value, label, max) || null;
}

function optionalInt(value: unknown, label: string, min: number, max: number): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) {
    throw new ValidationError(`${label} must be a whole number between ${min} and ${max}.`);
  }
  return n;
}

function optionalFee(value: unknown, label: string): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > MAX_FEE) {
    throw new ValidationError(`${label} must be between ₱0 and ₱${MAX_FEE.toLocaleString()}.`);
  }
  return Math.round(n * 100) / 100;
}

function list<T>(value: unknown, label: string): T[] {
  if (!Array.isArray(value)) return [];
  if (value.length > MAX_LIST_ITEMS) throw new ValidationError(`${label} can have at most ${MAX_LIST_ITEMS} entries.`);
  return value as T[];
}

async function requireLawyer() {
  const auth = await createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return { error: 'Please sign in to manage your profile.' } as const;

  const db = await createServiceClient();
  const { data: account } = await db.from('user_accounts').select('role').eq('id', user.id).maybeSingle();
  const role = (account?.role as string | undefined) ?? (user.user_metadata?.role as string | undefined);
  if (role !== 'lawyer') return { error: 'Only lawyer accounts can edit a lawyer profile.' } as const;

  const { data: profile } = await db.from('lawyer_profiles').select('user_id').eq('user_id', user.id).maybeSingle();
  if (!profile) return { error: 'Lawyer profile not found.' } as const;

  return { userId: user.id, db } as const;
}

function revalidateProfilePaths(userId: string) {
  revalidatePath('/lawyer/profile');
  revalidatePath(`/client/lawyers/${userId}`);
  revalidatePath(`/lawyers/${userId}`);
}

type ChildTable =
  | 'lawyer_practice_areas_detail'
  | 'lawyer_experience'
  | 'lawyer_services'
  | 'lawyer_education';

/**
 * Syncs one child table to exactly `rows` (in order): updates rows the lawyer already owns,
 * inserts new ones, then deletes rows that were removed. Ids that don't belong to the caller are
 * treated as new rows, so a forged id can never overwrite another lawyer's data.
 */
async function syncChildRows(
  db: Awaited<ReturnType<typeof createServiceClient>>,
  table: ChildTable,
  userId: string,
  rows: Array<Record<string, unknown> & { id?: string }>
) {
  const { data: existing, error: readError } = await db.from(table).select('id').eq('lawyer_id', userId);
  if (readError) throw readError;
  const ownedIds = new Set((existing || []).map((r: { id: string }) => r.id));
  const keptIds = new Set<string>();

  for (const [index, row] of rows.entries()) {
    const { id, ...fields } = row;
    const payload = { ...fields, lawyer_id: userId, sort_order: index };
    if (id && ownedIds.has(id)) {
      keptIds.add(id);
      const { error } = await db.from(table).update(payload as never).eq('id', id).eq('lawyer_id', userId);
      if (error) throw error;
    } else {
      const { data, error } = await db.from(table).insert(payload as never).select('id').single();
      if (error) throw error;
      if (data) keptIds.add((data as { id: string }).id);
    }
  }

  const removed = [...ownedIds].filter((id) => !keptIds.has(id));
  if (removed.length) {
    const { error } = await db.from(table).delete().eq('lawyer_id', userId).in('id', removed);
    if (error) throw error;
  }
}

// ─── Reads ────────────────────────────────────────────────────────────────────

/** Loads the signed-in lawyer's own profile and all About / Cases Handled data. */
export async function getMyLawyerProfileAction(): Promise<
  { success: true; data: LawyerOwnProfileData } | { success: false; error: string }
> {
  try {
    const ctx = await requireLawyer();
    if ('error' in ctx) return { success: false, error: ctx.error! };
    const { db, userId } = ctx;

    const [profileRes, areasRes, expRes, svcRes, eduRes, casesRes] = await Promise.all([
      db.from('lawyer_profiles').select('*').eq('user_id', userId).single(),
      db.from('lawyer_practice_areas_detail').select('*').eq('lawyer_id', userId).order('sort_order'),
      db.from('lawyer_experience').select('*').eq('lawyer_id', userId).order('sort_order'),
      db.from('lawyer_services').select('*').eq('lawyer_id', userId).order('sort_order'),
      db.from('lawyer_education').select('*').eq('lawyer_id', userId).order('sort_order'),
      db.from('lawyer_case_summaries').select('*').eq('lawyer_id', userId)
        .order('sort_order').order('created_at', { ascending: false }),
    ]);

    const firstError = [profileRes, areasRes, expRes, svcRes, eduRes, casesRes].find((r) => r.error)?.error;
    if (firstError || !profileRes.data) throw firstError ?? new Error('Profile not found');

    const profile = profileRes.data as LawyerProfileRow;
    // NUMERIC columns can come back as strings; normalise so the UI always gets numbers.
    const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));

    return {
      success: true,
      data: {
        profile: {
          ...profile,
          fee_initial_30min: num(profile.fee_initial_30min),
          fee_standard_60min: num(profile.fee_standard_60min),
          fee_extended_120min: num(profile.fee_extended_120min),
        },
        details: {
          practiceAreaDetails: (areasRes.data || []) as LawyerPracticeAreaDetailRow[],
          experiences: (expRes.data || []) as LawyerExperienceRow[],
          services: (svcRes.data || []) as LawyerServiceRow[],
          education: (eduRes.data || []) as LawyerEducationRow[],
          caseSummaries: (casesRes.data || []) as LawyerCaseSummaryRow[],
        },
      },
    };
  } catch (error) {
    console.error('[getMyLawyerProfileAction]', error);
    return { success: false, error: 'Unable to load your profile. Please refresh to try again.' };
  }
}

/**
 * Public About / Cases Handled data for the client-side lawyer profile.
 * Uses the caller's own client so the existing RLS "public read" policies apply
 * (only approved + visible lawyers are exposed). Returns null for unknown / mock ids or on error.
 */
export async function getPublicLawyerDetailsAction(lawyerId: string): Promise<LawyerOwnProfileDetails | null> {
  try {
    if (!UUID_REGEX.test(lawyerId ?? '')) return null;
    const db = await createClient();
    const [areasRes, expRes, svcRes, eduRes, casesRes] = await Promise.all([
      db.from('lawyer_practice_areas_detail').select('*').eq('lawyer_id', lawyerId).order('sort_order'),
      db.from('lawyer_experience').select('*').eq('lawyer_id', lawyerId).order('sort_order'),
      db.from('lawyer_services').select('*').eq('lawyer_id', lawyerId).order('sort_order'),
      db.from('lawyer_education').select('*').eq('lawyer_id', lawyerId).order('sort_order'),
      db.from('lawyer_case_summaries').select('*').eq('lawyer_id', lawyerId)
        .order('sort_order').order('created_at', { ascending: false }),
    ]);
    const firstError = [areasRes, expRes, svcRes, eduRes, casesRes].find((r) => r.error)?.error;
    if (firstError) throw firstError;
    return {
      practiceAreaDetails: (areasRes.data || []) as LawyerPracticeAreaDetailRow[],
      experiences: (expRes.data || []) as LawyerExperienceRow[],
      services: (svcRes.data || []) as LawyerServiceRow[],
      education: (eduRes.data || []) as LawyerEducationRow[],
      caseSummaries: (casesRes.data || []) as LawyerCaseSummaryRow[],
    };
  } catch (error) {
    console.error('[getPublicLawyerDetailsAction]', error);
    return null;
  }
}

// ─── About tab: Edit Information ──────────────────────────────────────────────

export async function updateLawyerProfileAction(input: UpdateLawyerProfileInput): Promise<ActionResult> {
  try {
    const ctx = await requireLawyer();
    if ('error' in ctx) return { success: false, error: ctx.error! };
    const { db, userId } = ctx;

    const currentYear = new Date().getFullYear();

    const practiceAreas = list<PracticeAreaInput>(input?.practiceAreas, 'Areas of Practice')
      .map((p) => ({
        id: UUID_REGEX.test(p?.id ?? '') ? p.id : undefined,
        area: text(p?.area, 'Practice area name', 120, true),
        description: optionalText(p?.description, 'Practice area description', 1000),
      }));
    if (practiceAreas.length === 0) {
      return { success: false, error: 'Add at least one area of practice.' };
    }

    const experiences = list<ExperienceInput>(input?.experiences, 'Legal Experience').map((e) => ({
      id: UUID_REGEX.test(e?.id ?? '') ? e.id : undefined,
      title: text(e?.title, 'Experience title', 200, true),
      organization: optionalText(e?.organization, 'Organization', 200),
      years: optionalText(e?.years, 'Experience years', 50),
      description: optionalText(e?.description, 'Experience description', 1000),
    }));

    const services = list<ServiceInput>(input?.services, 'Consultation Services').map((s) => ({
      id: UUID_REGEX.test(s?.id ?? '') ? s.id : undefined,
      name: text(s?.name, 'Service name', 200, true),
      description: optionalText(s?.description, 'Service description', 1000),
    }));

    const education = list<EducationInput>(input?.education, 'Educational Background').map((e) => {
      const startYear = optionalInt(e?.startYear, 'Education start year', 1900, currentYear + 10);
      const endYear = optionalInt(e?.endYear, 'Education end year', 1900, currentYear + 10);
      if (startYear && endYear && endYear < startYear) {
        throw new ValidationError('Education end year cannot be before the start year.');
      }
      return {
        id: UUID_REGEX.test(e?.id ?? '') ? e.id : undefined,
        degree: text(e?.degree, 'Degree', 200, true),
        school: optionalText(e?.school, 'School', 200),
        start_year: startYear,
        end_year: endYear,
        description: optionalText(e?.description, 'Education details', 2000),
      };
    });

    const languages = list<string>(input?.languages, 'Languages')
      .map((l) => text(l, 'Language', 60))
      .filter(Boolean);

    const profileUpdate = {
      about: optionalText(input?.about, 'About', 5000),
      ibp_chapter: optionalText(input?.ibpChapter, 'IBP chapter', 120),
      languages: [...new Set(languages)],
      experience_years: optionalInt(input?.experienceYears, 'Years of practice', 0, 80),
      bar_passer_year: optionalInt(input?.barPasserYear, 'Bar passer year', 1900, currentYear),
      fee_initial_30min: optionalFee(input?.feeInitial30min, 'Initial consultation fee'),
      fee_standard_60min: optionalFee(input?.feeStandard60min, 'Standard consultation fee'),
      fee_extended_120min: optionalFee(input?.feeExtended120min, 'Extended consultation fee'),
      // Banner tags + directory filters stay in sync with the Areas of Practice list.
      practice_areas: [...new Set(practiceAreas.map((p) => p.area))],
      updated_at: new Date().toISOString(),
    };

    const { error: profileError } = await db.from('lawyer_profiles').update(profileUpdate).eq('user_id', userId);
    if (profileError) throw profileError;

    const sections: Array<[ChildTable, string, Array<Record<string, unknown> & { id?: string }>]> = [
      ['lawyer_practice_areas_detail', 'Areas of Practice', practiceAreas],
      ['lawyer_experience', 'Legal Experience', experiences],
      ['lawyer_services', 'Consultation Services', services],
      ['lawyer_education', 'Educational Background', education],
    ];
    for (const [table, label, rows] of sections) {
      try {
        await syncChildRows(db, table, userId, rows);
      } catch (sectionError) {
        console.error(`[updateLawyerProfileAction] ${table}`, sectionError);
        revalidateProfilePaths(userId);
        return { success: false, error: `Your other details were saved, but ${label} could not be updated. Please try again.` };
      }
    }

    revalidateProfilePaths(userId);
    return { success: true };
  } catch (error) {
    if (error instanceof ValidationError) return { success: false, error: error.message };
    console.error('[updateLawyerProfileAction]', error);
    return { success: false, error: 'Unable to update your profile. Please try again.' };
  }
}

// ─── Cases Handled: add / edit / delete ───────────────────────────────────────

export async function saveLawyerCaseAction(
  input: SaveLawyerCaseInput
): Promise<{ success: true; caseSummary: LawyerCaseSummaryRow } | { success: false; error: string }> {
  try {
    const ctx = await requireLawyer();
    if ('error' in ctx) return { success: false, error: ctx.error! };
    const { db, userId } = ctx;

    const fields = {
      title: text(input?.title, 'Case title', 200, true),
      practice_area: optionalText(input?.practiceArea, 'Subject matter', 120),
      year: optionalInt(input?.year, 'Year', 1900, new Date().getFullYear()),
      anonymized_summary: text(input?.summary, 'Case summary', 5000, true),
    };

    if (input?.id) {
      if (!UUID_REGEX.test(input.id)) return { success: false, error: 'Case not found.' };
      const { data, error } = await db.from('lawyer_case_summaries')
        .update(fields).eq('id', input.id).eq('lawyer_id', userId).select('*').maybeSingle();
      if (error) throw error;
      if (!data) return { success: false, error: 'Case not found.' };
      revalidateProfilePaths(userId);
      return { success: true, caseSummary: data as LawyerCaseSummaryRow };
    }

    // New cases go to the top of the list.
    const { data: first } = await db.from('lawyer_case_summaries').select('sort_order')
      .eq('lawyer_id', userId).order('sort_order', { ascending: true }).limit(1).maybeSingle();
    const sortOrder = first ? (first as { sort_order: number }).sort_order - 1 : 0;

    const { data, error } = await db.from('lawyer_case_summaries')
      .insert({ ...fields, lawyer_id: userId, sort_order: sortOrder }).select('*').single();
    if (error) throw error;

    revalidateProfilePaths(userId);
    return { success: true, caseSummary: data as LawyerCaseSummaryRow };
  } catch (error) {
    if (error instanceof ValidationError) return { success: false, error: error.message };
    console.error('[saveLawyerCaseAction]', error);
    return { success: false, error: 'Unable to save this case. Please try again.' };
  }
}

export async function deleteLawyerCaseAction(caseId: string): Promise<ActionResult> {
  try {
    if (!UUID_REGEX.test(caseId)) return { success: false, error: 'Case not found.' };
    const ctx = await requireLawyer();
    if ('error' in ctx) return { success: false, error: ctx.error! };
    const { db, userId } = ctx;

    const { data, error } = await db.from('lawyer_case_summaries')
      .delete().eq('id', caseId).eq('lawyer_id', userId).select('id');
    if (error) throw error;
    if (!data?.length) return { success: false, error: 'Case not found.' };

    revalidateProfilePaths(userId);
    return { success: true };
  } catch (error) {
    console.error('[deleteLawyerCaseAction]', error);
    return { success: false, error: 'Unable to delete this case. Please try again.' };
  }
}
