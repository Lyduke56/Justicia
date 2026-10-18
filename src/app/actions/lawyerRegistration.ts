'use server';

/**
 * Lawyer Registration Server Actions
 * Handles multi-step form save-as-draft and final submission.
 */

import { createClient, createServiceClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { writeAuditLog } from '@/lib/notifications';
import type { Database } from '@/types/database';

export type LawyerRegState = { error?: string; success?: string; step?: number } | null;

// ─── Save draft (any step) ────────────────────────────────────────────────────
export async function saveLawyerDraftAction(
  _prevState: LawyerRegState,
  formData: FormData
): Promise<LawyerRegState> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'You must be signed in to register as a lawyer.' };

    const serviceSupabase = await createServiceClient();

    // Set role to lawyer server-side
    await serviceSupabase
      .from('user_accounts')
      .update({ role: 'lawyer' })
      .eq('id', user.id);

    const profileData: Database['public']['Tables']['lawyer_profiles']['Insert'] = {
      user_id: user.id,
      full_name: formData.get('full_name') as string || '',
      roll_number: formData.get('roll_number') as string || '',
      ibp_chapter: formData.get('ibp_chapter') as string || null,
      about: formData.get('about') as string || null,
      bar_passer_year: formData.get('bar_passer_year') ? Number(formData.get('bar_passer_year')) : null,
      experience_years: formData.get('experience_years') ? Number(formData.get('experience_years')) : null,
      fee_initial_30min: formData.get('fee_initial_30min') ? Number(formData.get('fee_initial_30min')) : null,
      fee_standard_60min: formData.get('fee_standard_60min') ? Number(formData.get('fee_standard_60min')) : null,
      fee_extended_120min: formData.get('fee_extended_120min') ? Number(formData.get('fee_extended_120min')) : null,
      verification_status: 'draft',
    };

    // Handle practice areas array
    const practiceAreas = formData.getAll('practice_areas') as string[];
    if (practiceAreas.length > 0) profileData.practice_areas = practiceAreas;

    // Handle languages
    const languages = formData.getAll('languages') as string[];
    if (languages.length > 0) profileData.languages = languages;

    const { error } = await serviceSupabase
      .from('lawyer_profiles')
      .upsert(profileData, { onConflict: 'user_id' });

    if (error) return { error: error.message };

    return { success: 'Draft saved.' };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'An error occurred';
    return { error: msg };
  }
}

// ─── Submit for review ────────────────────────────────────────────────────────
export async function submitLawyerApplicationAction(
  _prevState: LawyerRegState,
  formData: FormData
): Promise<LawyerRegState> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'You must be signed in.' };

    const serviceSupabase = await createServiceClient();

    // Check roll number uniqueness
    const rollNumber = formData.get('roll_number') as string;
    if (!rollNumber) return { error: 'Roll number is required.' };

    const { data: existing } = await serviceSupabase
      .from('lawyer_profiles')
      .select('user_id')
      .eq('roll_number', rollNumber)
      .neq('user_id', user.id)
      .maybeSingle();

    if (existing) return { error: 'This Roll of Attorneys number is already registered.' };

    // Set role to lawyer
    await serviceSupabase
      .from('user_accounts')
      .update({ role: 'lawyer' })
      .eq('id', user.id);

    const fullName = (formData.get('full_name') as string)?.trim();
    if (!fullName) return { error: 'Full name is required.' };
    if (!rollNumber.trim()) return { error: 'Roll number is required.' };

    const profileData: Database['public']['Tables']['lawyer_profiles']['Insert'] = {
      user_id: user.id,
      full_name: fullName,
      roll_number: rollNumber.trim(),
      ibp_chapter: formData.get('ibp_chapter') as string || null,
      about: formData.get('about') as string || null,
      bar_passer_year: formData.get('bar_passer_year') ? Number(formData.get('bar_passer_year')) : null,
      experience_years: formData.get('experience_years') ? Number(formData.get('experience_years')) : null,
      fee_initial_30min: formData.get('fee_initial_30min') ? Number(formData.get('fee_initial_30min')) : null,
      fee_standard_60min: formData.get('fee_standard_60min') ? Number(formData.get('fee_standard_60min')) : null,
      fee_extended_120min: formData.get('fee_extended_120min') ? Number(formData.get('fee_extended_120min')) : null,
      verification_status: 'pending',
      submitted_at: new Date().toISOString(),
    };

    const practiceAreas = formData.getAll('practice_areas') as string[];
    if (practiceAreas.length > 0) profileData.practice_areas = practiceAreas;
    const languages = formData.getAll('languages') as string[];
    if (languages.length > 0) profileData.languages = languages;

    const { error } = await serviceSupabase
      .from('lawyer_profiles')
      .upsert(profileData, { onConflict: 'user_id' });

    if (error) return { error: error.message };

    await writeAuditLog({
      actorId: user.id,
      action: 'lawyer.submitted',
      targetType: 'lawyer_profile',
      targetId: user.id,
      details: { full_name: fullName, roll_number: rollNumber },
    });

    redirect('/lawyer/verification');
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'NEXT_REDIRECT') throw err;
    const msg = err instanceof Error ? err.message : 'An error occurred';
    return { error: msg };
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
