'use server';

import { revalidatePath } from 'next/cache';
import { createClient, createServiceClient } from '@/lib/supabase/server';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export interface SerializedReview {
  id: string;
  name: string;
  stars: number;
  date: string;
  content: string;
  reply?: string;
  helpfulCount?: number;
}

export async function getLawyerReviewsAction(lawyerId?: string): Promise<{
  success: boolean; reviews: SerializedReview[]; error?: string;
}> {
  try {
    if (!lawyerId) {
      const auth = await createClient();
      const { data: { user } } = await auth.auth.getUser();
      if (!user) return { success: false, reviews: [], error: 'Please sign in to view your reviews.' };
      lawyerId = user.id;
    }
    if (!UUID_REGEX.test(lawyerId)) return { success: true, reviews: [] };
    const db = await createServiceClient();
    const { data, error } = await db.from('reviews')
      .select('id,client_id,rating,comment,counsel_reply,helpful_count,created_at')
      .eq('lawyer_id', lawyerId).eq('is_hidden', false).not('consultation_id', 'is', null)
      .order('created_at', { ascending: false });
    if (error) throw error;
    const rows = data || [];
    const names = new Map<string, string>();
    if (rows.length) {
      // Avoid assuming the live review FK points at user_accounts: older deployments use profiles.
      const { data: accounts, error: accountError } = await db.from('user_accounts')
        .select('id,full_name').in('id', [...new Set(rows.map(row => row.client_id))]);
      if (accountError) throw accountError;
      for (const account of accounts || []) if (account.full_name) names.set(account.id, account.full_name);
    }
    return { success: true, reviews: rows.map(row => ({
      id: row.id, name: names.get(row.client_id) || 'Verified Client', stars: row.rating,
      date: new Date(row.created_at).toLocaleDateString('en-US'), content: row.comment || '',
      reply: row.counsel_reply || undefined, helpfulCount: row.helpful_count || 0,
    })) };
  } catch (error) {
    console.error('[getLawyerReviewsAction]', error);
    return { success: false, reviews: [], error: 'Unable to load reviews. Please try again.' };
  }
}

export async function getMyConsultationRatingsAction(): Promise<{
  success: boolean; ratings: Record<string, { rating: number; comment?: string }>; error?: string;
}> {
  try {
    const auth = await createClient();
    const { data: { user } } = await auth.auth.getUser();
    if (!user) return { success: false, ratings: {}, error: 'Please sign in to view your ratings.' };
    const db = await createServiceClient();
    const { data, error } = await db.from('reviews').select('consultation_id,rating,comment')
      .eq('client_id', user.id).not('consultation_id', 'is', null);
    if (error) throw error;
    const ratings: Record<string, { rating: number; comment?: string }> = {};
    for (const row of data || []) {
      if (row.consultation_id) ratings[row.consultation_id] = { rating: row.rating, comment: row.comment || undefined };
    }
    return { success: true, ratings };
  } catch (error) {
    console.error('[getMyConsultationRatingsAction]', error);
    return { success: false, ratings: {}, error: 'Unable to load your ratings. Please refresh to try again.' };
  }
}

export async function addLawyerReviewAction(input: {
  consultationId: string; rating: number; comment: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    if (!UUID_REGEX.test(input.consultationId) || !Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) {
      return { success: false, error: 'Choose a valid consultation and a rating from 1 to 5.' };
    }
    if (!input.comment?.trim() || input.comment.length > 5000) {
      return { success: false, error: 'Please enter feedback of up to 5,000 characters.' };
    }
    const auth = await createClient();
    const { data: { user } } = await auth.auth.getUser();
    if (!user) return { success: false, error: 'Please sign in to submit a review.' };
    const db = await createServiceClient();
    const { data: consultation, error: lookupError } = await db.from('consultations')
      .select('id,client_id,lawyer_id,status').eq('id', input.consultationId).eq('client_id', user.id).maybeSingle();
    if (lookupError) throw lookupError;
    if (!consultation || consultation.status !== 'completed') {
      return { success: false, error: 'You can only rate your own completed consultation.' };
    }
    const { error } = await db.from('reviews').insert({
      consultation_id: consultation.id, client_id: user.id, lawyer_id: consultation.lawyer_id,
      rating: input.rating, comment: input.comment.trim(),
    });
    if (error?.code === '23505') return { success: false, error: 'You have already rated this consultation. Refresh to see your saved rating.' };
    if (error) throw error;
    revalidatePath('/client');
    revalidatePath('/lawyer/reviews');
    revalidatePath(`/client/lawyers/${consultation.lawyer_id}`);
    revalidatePath(`/lawyers/${consultation.lawyer_id}`);
    return { success: true };
  } catch (error) {
    console.error('[addLawyerReviewAction]', error);
    return { success: false, error: 'Your review could not be saved. Please try again.' };
  }
}

export async function addReviewReplyAction(input: {
  reviewId: string; replyText: string; lawyerId?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    if (!UUID_REGEX.test(input.reviewId) || !input.replyText?.trim() || input.replyText.length > 5000) {
      return { success: false, error: 'Enter a reply of up to 5,000 characters.' };
    }
    const auth = await createClient();
    const { data: { user } } = await auth.auth.getUser();
    if (!user) return { success: false, error: 'Please sign in to reply.' };
    const db = await createServiceClient();
    const { data, error } = await db.from('reviews').update({
      counsel_reply: input.replyText.trim(), counsel_replied_at: new Date().toISOString(),
    }).eq('id', input.reviewId).eq('lawyer_id', user.id).not('consultation_id', 'is', null).select('id').maybeSingle();
    if (error) throw error;
    if (!data) return { success: false, error: 'You can only reply to your own consultation reviews.' };
    revalidatePath('/lawyer/reviews');
    revalidatePath(`/client/lawyers/${user.id}`);
    revalidatePath(`/lawyers/${user.id}`);
    return { success: true };
  } catch (error) {
    console.error('[addReviewReplyAction]', error);
    return { success: false, error: 'Your reply could not be saved. Please try again.' };
  }
}
