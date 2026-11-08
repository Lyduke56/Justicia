'use server';

import { revalidatePath } from 'next/cache';
import { createClient, createServiceClient } from '@/lib/supabase/server';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface SerializedReview {
  id: string;
  name: string;
  stars: number;
  date: string;
  content: string;
  reply?: string;
  helpfulCount?: number;
}

/**
 * Resolves a lawyerId into a valid UUID.
 * Maps strings like 'demo-lawyer-1' or 'lawyer-1' to deterministic UUIDs matching 0004 seed.
 */
function resolveLawyerDeterministicUuid(lawyerId: string): string {
  if (UUID_REGEX.test(lawyerId)) return lawyerId;
  const num = lawyerId.replace(/\D/g, '') || '1';
  const padded = num.padStart(12, '0');
  return `22222222-2222-4222-8222-${padded}`;
}

function resolveClientDeterministicUuid(): string {
  return '33333333-3333-4333-8333-000000000001';
}

/**
 * Ensures a lawyer exists in public.user_accounts so foreign keys succeed.
 */
async function getOrProvisionLawyerUserId(
  serviceClient: any,
  requestedLawyerId: string,
  lawyerName?: string
): Promise<string> {
  const deterministicUuid = resolveLawyerDeterministicUuid(requestedLawyerId);

  // 1. Direct match by UUID
  if (UUID_REGEX.test(requestedLawyerId)) {
    const { data: direct } = await serviceClient
      .from('user_accounts')
      .select('id')
      .eq('id', requestedLawyerId)
      .maybeSingle();
    if (direct?.id) return direct.id;
  }

  // 2. Deterministic UUID check in user_accounts
  const { data: detMatch } = await serviceClient
    .from('user_accounts')
    .select('id')
    .eq('id', deterministicUuid)
    .maybeSingle();
  if (detMatch?.id) return detMatch.id;

  // 3. Upsert into user_accounts
  const slug = requestedLawyerId.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'counsel';
  const email = `lawyer.${slug}@justicia.ph`;
  try {
    const { data: insData, error: insErr } = await serviceClient
      .from('user_accounts')
      .upsert(
        {
          id: deterministicUuid,
          email,
          full_name: lawyerName || 'Verified Counsel',
          role: 'lawyer',
          mfa_enabled: false,
        },
        { onConflict: 'id' }
      )
      .select('id')
      .maybeSingle();

    if (!insErr && insData?.id) return insData.id;
  } catch {
    // fallback
  }

  return deterministicUuid;
}

/**
 * Ensures a client exists in public.user_accounts so foreign keys succeed.
 */
async function getOrProvisionClientUserId(
  serviceClient: any,
  authUserId?: string | null,
  clientName?: string,
  clientEmail?: string
): Promise<string> {
  if (authUserId && UUID_REGEX.test(authUserId)) {
    const { data: direct } = await serviceClient
      .from('user_accounts')
      .select('id, full_name')
      .eq('id', authUserId)
      .maybeSingle();

    if (direct?.id) {
      if (clientName && (!direct.full_name || direct.full_name === 'Verified Client')) {
        await serviceClient
          .from('user_accounts')
          .update({ full_name: clientName })
          .eq('id', authUserId);
      }
      return direct.id;
    }

    try {
      await serviceClient.from('user_accounts').upsert(
        {
          id: authUserId,
          email: clientEmail || `client-${authUserId.slice(0, 8)}@justicia.ph`,
          full_name: clientName || 'Verified Client',
          role: 'client',
          mfa_enabled: false,
        },
        { onConflict: 'id' }
      );
      return authUserId;
    } catch {
      // fallback
    }
  }

  const fallbackId = resolveClientDeterministicUuid();
  try {
    await serviceClient.from('user_accounts').upsert(
      {
        id: fallbackId,
        email: 'client.intake@justicia.ph',
        full_name: clientName || 'Verified Client',
        role: 'client',
        mfa_enabled: false,
      },
      { onConflict: 'id' }
    );
    return fallbackId;
  } catch {
    // fallback
  }

  return fallbackId;
}

/**
 * Fetches reviews for a given lawyer from Supabase.
 */
export async function getLawyerReviewsAction(
  lawyerId: string
): Promise<{ success: boolean; reviews: SerializedReview[]; error?: string }> {
  try {
    const serviceClient = await createServiceClient();
    const resolvedLawyerId = resolveLawyerDeterministicUuid(lawyerId);

    // Fetch matching either the direct ID or deterministic UUID
    const targetIds = Array.from(new Set([lawyerId, resolvedLawyerId].filter(id => UUID_REGEX.test(id))));
    if (targetIds.length === 0) {
      return { success: true, reviews: [] };
    }

    const { data, error } = await serviceClient
      .from('reviews')
      .select(`
        id,
        lawyer_id,
        rating,
        comment,
        counsel_reply,
        helpful_count,
        created_at,
        client:user_accounts!reviews_client_id_fkey (
          id,
          full_name,
          email
        )
      `)
      .in('lawyer_id', targetIds)
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('[getLawyerReviewsAction] Supabase select notice:', error.message);
      return { success: false, reviews: [], error: error.message };
    }

    const reviews: SerializedReview[] = (data || []).map((row: any) => ({
      id: row.id,
      name: row.client?.full_name || 'Verified Client',
      stars: row.rating,
      date: new Date(row.created_at).toLocaleDateString('en-US', {
        month: '2-digit',
        day: '2-digit',
        year: 'numeric',
      }),
      content: row.comment || '',
      reply: row.counsel_reply || undefined,
      helpfulCount: row.helpful_count || 0,
    }));

    return { success: true, reviews };
  } catch (err: any) {
    console.warn('[getLawyerReviewsAction] Exception:', err?.message || err);
    return { success: false, reviews: [], error: err?.message };
  }
}

/**
 * Saves a new review into Supabase reviews table.
 */
export async function addLawyerReviewAction(input: {
  lawyerId: string;
  lawyerName?: string;
  rating: number;
  comment: string;
  reviewerName?: string;
}): Promise<{ success: boolean; review?: SerializedReview; error?: string }> {
  try {
    if (!input.comment || !input.comment.trim()) {
      return { success: false, error: 'Review content cannot be empty.' };
    }

    const userClient = await createClient();
    const serviceClient = await createServiceClient();

    const {
      data: { user },
    } = await userClient.auth.getUser();

    const resolvedLawyerId = await getOrProvisionLawyerUserId(
      serviceClient,
      input.lawyerId,
      input.lawyerName
    );

    const resolvedClientId = await getOrProvisionClientUserId(
      serviceClient,
      user?.id,
      input.reviewerName?.trim() || 'Verified Client',
      user?.email
    );

    const validRating = Math.max(1, Math.min(5, Math.round(input.rating || 5)));
    const cleanComment = input.comment.trim();

    const { data: inserted, error: insertError } = await serviceClient
      .from('reviews')
      .insert({
        client_id: resolvedClientId,
        lawyer_id: resolvedLawyerId,
        rating: validRating,
        comment: cleanComment,
      })
      .select(`
        id,
        lawyer_id,
        rating,
        comment,
        counsel_reply,
        helpful_count,
        created_at,
        client:user_accounts!reviews_client_id_fkey (
          id,
          full_name
        )
      `)
      .single();

    if (insertError || !inserted) {
      console.warn('[addLawyerReviewAction] Insert error notice:', insertError?.message);
      return { success: false, error: insertError?.message || 'Failed to insert review.' };
    }

    const row = inserted as any;
    const serialized: SerializedReview = {
      id: row.id,
      name: input.reviewerName?.trim() || row.client?.full_name || 'Verified Client',
      stars: row.rating,
      date: new Date(row.created_at).toLocaleDateString('en-US', {
        month: '2-digit',
        day: '2-digit',
        year: 'numeric',
      }),
      content: row.comment || '',
      reply: row.counsel_reply || undefined,
      helpfulCount: row.helpful_count || 0,
    };

    try {
      revalidatePath(`/client/lawyers`);
      revalidatePath(`/client/lawyers/${input.lawyerId}`);
      revalidatePath(`/lawyers/${input.lawyerId}`);
      revalidatePath(`/lawyer/reviews`);
    } catch {
      // revalidate not in request context
    }

    return { success: true, review: serialized };
  } catch (err: any) {
    console.warn('[addLawyerReviewAction] Exception:', err?.message || err);
    return { success: false, error: err?.message };
  }
}

/**
 * Counsel replies to a client review.
 */
export async function addReviewReplyAction(input: {
  reviewId: string;
  replyText: string;
  lawyerId?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    if (!input.replyText?.trim()) {
      return { success: false, error: 'Reply text cannot be empty.' };
    }

    const serviceClient = await createServiceClient();

    // Check if counsel_reply column exists and update
    const { error } = await serviceClient
      .from('reviews')
      .update({
        counsel_reply: input.replyText.trim(),
        counsel_replied_at: new Date().toISOString(),
      })
      .eq('id', input.reviewId);

    if (error) {
      console.warn('[addReviewReplyAction] Reply update notice:', error.message);
      return { success: false, error: error.message };
    }

    if (input.lawyerId) {
      try {
        revalidatePath(`/client/lawyers/${input.lawyerId}`);
        revalidatePath(`/lawyer/reviews`);
      } catch {
        // ignore
      }
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message };
  }
}

