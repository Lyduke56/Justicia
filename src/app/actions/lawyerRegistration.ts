'use server';

/**
 * Lawyer Registration Server Actions
 * Handles multi-step form save-as-draft and final submission.
 *
 * Rules (src/lib/lawyer/verification.ts):
 *  - Clients may apply to become lawyers; admin accounts cannot.
 *  - The application can be edited while it is a draft, needs more information, or was rejected.
 *    It is locked while under review (pending) and once approved.
 *  - Submitting requires every required verification document; the current documents then move
 *    to "under review" together with the application.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { writeAuditLog } from '@/lib/notifications';
import { guardMessage, requireActiveAccount } from '@/lib/auth/guards';
import { readDatabaseRole, syncAuthClaims } from '@/lib/auth/roles';
import { applicantCanEdit, applicantCanSubmit, documentGapMessage } from '@/lib/lawyer/verification';
import { loadCurrentDocuments } from '@/lib/lawyer/documentsServer';
import type { Database } from '@/types/database';

export type LawyerRegState = { error?: string; success?: string; step?: number } | null;

type LawyerInsert = Database['public']['Tables']['lawyer_profiles']['Insert'];

const MAX_TEXT = 5000;
const MAX_LIST = 30;

function text(formData: FormData, key: string, max = 200): string | null {
  const value = formData.get(key);
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().slice(0, max);
  return trimmed || null;
}

function wholeNumber(formData: FormData, key: string, min: number, max: number): number | null {
  const value = text(formData, key, 20);
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= min && n <= max ? Math.round(n) : null;
}

function list(formData: FormData, key: string): string[] {
  return [...new Set(formData.getAll(key).filter((v): v is string => typeof v === 'string').map((v) => v.trim().slice(0, 80)).filter(Boolean))].slice(0, MAX_LIST);
}

/** Who is applying, and the state of their application (if any). */
async function applicantContext() {
  const ctx = await requireActiveAccount();
  const role = await readDatabaseRole(ctx.db, ctx.user.id);
  if (role === 'admin') {
    return { error: 'Administrator accounts cannot apply as lawyers. Use a separate account.' } as const;
  }
  const { data: existing } = await ctx.db
    .from('lawyer_profiles')
    .select('verification_status')
    .eq('user_id', ctx.user.id)
    .maybeSingle();
  return { ...ctx, role, status: (existing?.verification_status as string | undefined) ?? null } as const;
}

/** Makes the account a lawyer account (database row, profile and the server-written claim). */
async function becomeLawyer(db: SupabaseClient, userId: string): Promise<void> {
  await db.from('user_accounts').update({ role: 'lawyer' }).eq('id', userId);
  await db.from('profiles').update({ role: 'lawyer' }).eq('user_id', userId);
  await syncAuthClaims(db, userId, { role: 'lawyer' });
}

function profileFromForm(formData: FormData, userId: string, fullName: string, rollNumber: string): LawyerInsert {
  const profile: LawyerInsert = {
    user_id: userId,
    full_name: fullName,
    roll_number: rollNumber,
    ibp_chapter: text(formData, 'ibp_chapter', 120),
    about: text(formData, 'about', MAX_TEXT),
    bar_passer_year: wholeNumber(formData, 'bar_passer_year', 1900, new Date().getFullYear()),
    experience_years: wholeNumber(formData, 'experience_years', 0, 80),
    fee_initial_30min: wholeNumber(formData, 'fee_initial_30min', 0, 1_000_000),
    fee_standard_60min: wholeNumber(formData, 'fee_standard_60min', 0, 1_000_000),
    fee_extended_120min: wholeNumber(formData, 'fee_extended_120min', 0, 1_000_000),
  };
  const practiceAreas = list(formData, 'practice_areas');
  if (practiceAreas.length > 0) profile.practice_areas = practiceAreas;
  const languages = list(formData, 'languages');
  if (languages.length > 0) profile.languages = languages;
  return profile;
}

// ─── Save draft (any step) ────────────────────────────────────────────────────
export async function saveLawyerDraftAction(
  _prevState: LawyerRegState,
  formData: FormData
): Promise<LawyerRegState> {
  try {
    const ctx = await applicantContext();
    if ('error' in ctx) return { error: ctx.error };
    if (!applicantCanEdit(ctx.status)) {
      return {
        error: ctx.status === 'pending'
          ? 'Your application is under review and can’t be changed right now.'
          : 'Your lawyer profile is already approved. Edit it from your lawyer profile page.',
      };
    }

    const rollNumber = text(formData, 'roll_number', 60) ?? '';
    if (rollNumber) {
      const { data: taken } = await ctx.db
        .from('lawyer_profiles')
        .select('user_id')
        .eq('roll_number', rollNumber)
        .neq('user_id', ctx.user.id)
        .maybeSingle();
      if (taken) return { error: 'This Roll of Attorneys number is already registered.' };
    }

    await becomeLawyer(ctx.db, ctx.user.id);

    const profileData = profileFromForm(formData, ctx.user.id, text(formData, 'full_name', 120) ?? '', rollNumber);
    profileData.verification_status = 'draft';

    const { error } = await ctx.db
      .from('lawyer_profiles')
      .upsert(profileData, { onConflict: 'user_id' });

    if (error) return { error: error.code === '23505' ? 'This Roll of Attorneys number is already registered.' : 'Your draft could not be saved. Please try again.' };

    return { success: 'Draft saved.' };
  } catch (err: unknown) {
    return { error: guardMessage(err, 'Your draft could not be saved. Please try again.') };
  }
}

// ─── Submit for review ────────────────────────────────────────────────────────
export async function submitLawyerApplicationAction(
  _prevState: LawyerRegState,
  formData: FormData
): Promise<LawyerRegState> {
  try {
    const ctx = await applicantContext();
    if ('error' in ctx) return { error: ctx.error };
    if (!applicantCanSubmit(ctx.status)) {
      return {
        error: ctx.status === 'pending'
          ? 'Your application is already under review.'
          : 'Your lawyer profile is already approved.',
      };
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email_confirmed_at) return { error: 'Please verify your email address before submitting.' };

    const rollNumber = text(formData, 'roll_number', 60);
    if (!rollNumber) return { error: 'Roll number is required.' };
    const fullName = text(formData, 'full_name', 120);
    if (!fullName) return { error: 'Full name is required.' };

    const { data: existing } = await ctx.db
      .from('lawyer_profiles')
      .select('user_id')
      .eq('roll_number', rollNumber)
      .neq('user_id', ctx.user.id)
      .maybeSingle();
    if (existing) return { error: 'This Roll of Attorneys number is already registered.' };

    // Required proof documents must be uploaded (and none of them rejected).
    if (!ctx.status) {
      return { error: 'Please save your credentials and upload your verification documents before submitting.' };
    }
    const docs = await loadCurrentDocuments(ctx.db, ctx.user.id);
    const gap = documentGapMessage(docs.map((d) => ({ docType: d.doc_type, reviewStatus: d.review_status ?? 'uploaded' })));
    if (gap) return { error: gap };

    await becomeLawyer(ctx.db, ctx.user.id);
    await supabase.auth.updateUser({ data: { full_name: fullName } });

    const profileData = profileFromForm(formData, ctx.user.id, fullName, rollNumber);
    profileData.verification_status = 'pending';
    profileData.submitted_at = new Date().toISOString();

    // Only from an editable state, so two tabs can't submit over a decision.
    const { data: saved, error } = await ctx.db
      .from('lawyer_profiles')
      .update(profileData)
      .eq('user_id', ctx.user.id)
      .in('verification_status', ['draft', 'needs_resubmission', 'rejected'])
      .select('user_id');

    if (error) return { error: error.code === '23505' ? 'This Roll of Attorneys number is already registered.' : 'Your application could not be submitted. Please try again.' };
    if (!saved || saved.length === 0) return { error: 'Your application changed in another window. Refresh the page and try again.' };

    // The submitted documents are now under review (accepted ones from an earlier round stay accepted).
    await ctx.db
      .from('lawyer_verification_documents')
      .update({ review_status: 'under_review' })
      .eq('lawyer_id', ctx.user.id)
      .is('superseded_at', null)
      .eq('review_status', 'uploaded');

    await writeAuditLog({
      actorId: ctx.user.id,
      action: 'lawyer.submitted',
      targetType: 'lawyer_profile',
      targetId: ctx.user.id,
      details: { full_name: fullName, roll_number: rollNumber, documents: docs.length, previous_status: ctx.status },
    });

    revalidatePath('/lawyer/verification');
    revalidatePath('/admin/lawyers/verification-queue');
    return { success: 'Application submitted.' };
  } catch (err: unknown) {
    return { error: guardMessage(err, 'Your application could not be submitted. Please try again.') };
  }
}

// ─── Toggle favorite ─────────────────────────────────────────────────────────
export async function toggleFavoriteAction(lawyerId: string): Promise<{ isFavorite: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { isFavorite: false, error: 'Sign in to save favorites.' };

    const { data: existing } = await supabase
      .from('lawyer_favorites')
      .select('client_id')
      .eq('client_id', user.id)
      .eq('lawyer_id', lawyerId)
      .maybeSingle();

    if (existing) {
      await supabase
        .from('lawyer_favorites')
        .delete()
        .eq('client_id', user.id)
        .eq('lawyer_id', lawyerId);
      return { isFavorite: false };
    } else {
      await supabase
        .from('lawyer_favorites')
        .insert({ client_id: user.id, lawyer_id: lawyerId });
      return { isFavorite: true };
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'An error occurred';
    return { isFavorite: false, error: msg };
  }
}
