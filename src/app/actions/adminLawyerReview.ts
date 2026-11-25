'use server';

import { revalidatePath } from 'next/cache';
import type { SupabaseClient } from '@supabase/supabase-js';
import { writeAuditLog, createNotification } from '@/lib/notifications';
import { formatAttorneyName } from '@/lib/utils/attorneyName';
import { guardMessage, requireRole, UUID_RE } from '@/lib/auth/guards';
import { syncAuthClaims } from '@/lib/auth/roles';
import {
  allowedPostApprovalActions,
  allowedReviewDecisions,
  documentGaps,
  documentLabel,
  type PostApprovalAction,
  type ReviewDecision,
} from '@/lib/lawyer/verification';
import { loadCurrentDocuments } from '@/lib/lawyer/documentsServer';

export type { ReviewDecision } from '@/lib/lawyer/verification';

export interface ReviewLawyerResult {
  success?: boolean;
  message?: string;
  error?: string;
}

/** user_accounts.verification_status values in the live schema for each lawyer status. */
const ACCOUNT_STATUS: Record<string, 'approved' | 'rejected' | 'more_info_requested' | 'pending'> = {
  approved: 'approved',
  rejected: 'rejected',
  needs_resubmission: 'more_info_requested',
  pending: 'pending',
};

const STALE = 'This application changed since you opened it. Refresh the page to see its current status.';

function revalidateLawyer(lawyerId: string) {
  revalidatePath('/admin/lawyers/verification-queue');
  revalidatePath('/admin/lawyers');
  revalidatePath(`/admin/lawyers/${lawyerId}`);
  revalidatePath('/admin/dashboard');
  revalidatePath('/lawyer/verification');
  revalidatePath('/lawyer/dashboard');
  revalidatePath('/client/lawyers');
}

async function syncAccount(db: SupabaseClient, lawyerId: string, status: string) {
  const { data: account } = await db.from('user_accounts').select('role').eq('id', lawyerId).maybeSingle();
  // Never demote an administrator who happens to have a lawyer profile.
  const update: Record<string, unknown> = { verification_status: ACCOUNT_STATUS[status] ?? 'pending' };
  if (account?.role !== 'admin') update.role = 'lawyer';
  const { error } = await db.from('user_accounts').update(update).eq('id', lawyerId);
  if (error) console.warn('[adminLawyerReview] user_accounts sync:', error.message);
  if (account?.role !== 'admin') await syncAuthClaims(db, lawyerId, { role: 'lawyer' });
}

/**
 * Admin decision on an application under review: approve, request more information, or reject.
 * Only valid from the statuses in allowedReviewDecisions(); the update only applies if the status
 * is still the one the admin saw, so a stale tab or a forged request cannot override a decision.
 *
 * Approval needs every required document present and not rejected (approving accepts the
 * documents under review), unless the admin records an exception reason.
 */
export async function reviewLawyerApplicationAction(
  lawyerId: string,
  decision: ReviewDecision,
  reasonOrNotes?: string,
  options: { exceptionReason?: string } = {}
): Promise<ReviewLawyerResult> {
  try {
    if (!UUID_RE.test(lawyerId ?? '')) return { error: 'Lawyer profile not found.' };
    if (!['approved', 'rejected', 'needs_resubmission'].includes(decision)) return { error: 'Choose a valid decision.' };
    const { db, user: adminUser } = await requireRole('admin');

    const { data: profile } = await db
      .from('lawyer_profiles')
      .select('full_name, roll_number, verification_status')
      .eq('user_id', lawyerId)
      .maybeSingle();
    if (!profile) return { error: 'Lawyer profile not found.' };

    const currentStatus = profile.verification_status as string;
    if (!allowedReviewDecisions(currentStatus).includes(decision)) {
      return {
        error:
          currentStatus === 'approved'
            ? 'This lawyer is already verified. Use “Revoke verification” or “Request re-verification” instead.'
            : STALE,
      };
    }

    const note = (reasonOrNotes ?? '').trim().slice(0, 1000);
    if (decision !== 'approved' && note.length < 5) {
      return { error: 'Please write a message for the applicant (at least 5 characters).' };
    }

    // Documents: approval needs the required ones (or an explicit, audited exception).
    let exception: string | null = null;
    const docs = await loadCurrentDocuments(db, lawyerId).catch(() => []);
    if (decision === 'approved') {
      const gaps = documentGaps(docs.map((d) => ({ docType: d.doc_type, reviewStatus: d.review_status ?? 'uploaded' })));
      const problems = [...gaps.missing.map((t) => `${documentLabel(t)} missing`), ...gaps.rejected.map((t) => `${documentLabel(t)} rejected`)];
      if (problems.length) {
        exception = (options.exceptionReason ?? '').trim();
        if (exception.length < 10) {
          return {
            error: `Required documents are incomplete (${problems.join(', ')}). Ask for more information, or record an exception reason (at least 10 characters) to approve anyway.`,
          };
        }
      }
    }

    const now = new Date().toISOString();
    const rejectionReason = decision === 'rejected' ? note : null;
    const adminNotes = decision === 'needs_resubmission' ? note : null;

    const { data: updated, error: updateError } = await db
      .from('lawyer_profiles')
      .update({
        verification_status: decision,
        reviewed_at: now,
        reviewed_by: adminUser.id,
        rejection_reason: rejectionReason,
        admin_notes: adminNotes,
        updated_at: now,
        is_visible: decision === 'approved',
        is_available: decision === 'approved',
      })
      .eq('user_id', lawyerId)
      .eq('verification_status', currentStatus)
      .select('user_id');
    if (updateError) return { error: 'The decision could not be saved. Please try again.' };
    if (!updated || updated.length === 0) return { error: STALE };

    if (decision === 'approved') {
      // Approving the application accepts the documents that were under review.
      await db
        .from('lawyer_verification_documents')
        .update({ review_status: 'accepted', reviewed_by: adminUser.id, reviewed_at: now })
        .eq('lawyer_id', lawyerId)
        .is('superseded_at', null)
        .in('review_status', ['under_review', 'uploaded']);
    }

    await syncAccount(db, lawyerId, decision);

    const title =
      decision === 'approved' ? '🎉 Application Approved!'
      : decision === 'needs_resubmission' ? '📋 Additional Information Required'
      : '✗ Application Not Approved';
    const body =
      decision === 'approved'
        ? 'Congratulations! Your credentials have been verified by the Justicia team. You now have full access to the Lawyer Counsel Portal and your profile is live in Find a Lawyer.'
        : decision === 'needs_resubmission'
          ? `Our team reviewed your lawyer application and requires additional details: ${adminNotes}. Please update and resubmit your application.`
          : `We were unable to approve your application at this time: ${rejectionReason}. You may review and submit a new application.`;
    await createNotification({
      userId: lawyerId,
      type: `lawyer_verification_${decision}`,
      title,
      body,
      metadata: { decision, reason: rejectionReason || adminNotes, roll_number: profile.roll_number },
    });

    await writeAuditLog({
      actorId: adminUser.id,
      action: `lawyer.verification.${decision}`,
      targetType: 'lawyer_profile',
      targetId: lawyerId,
      details: {
        lawyer_name: profile.full_name,
        roll_number: profile.roll_number,
        decision,
        previous_status: currentStatus,
        reason: rejectionReason || adminNotes,
        ...(exception ? { document_exception: exception } : {}),
        documents: docs.map((d) => ({ id: d.id, type: d.doc_type, status: d.review_status })),
      },
    });

    revalidateLawyer(lawyerId);
    const lawyerName = formatAttorneyName(profile.full_name);
    return {
      success: true,
      message: decision === 'approved'
        ? `${lawyerName} has been approved and granted full portal access.`
        : decision === 'needs_resubmission'
        ? `Request for additional info sent to ${lawyerName}.`
        : `Application for ${lawyerName} has been rejected.`,
    };
  } catch (err: unknown) {
    return { error: guardMessage(err, 'An error occurred during review.') };
  }
}

/**
 * After approval: revoke the verification (the lawyer leaves Find a Lawyer and the lawyer portal)
 * or ask the lawyer to verify again with new documents. Separate from the pending-review actions
 * and audited under their own names.
 */
export async function postApprovalLawyerAction(
  lawyerId: string,
  action: PostApprovalAction,
  reason: string
): Promise<ReviewLawyerResult> {
  try {
    if (!UUID_RE.test(lawyerId ?? '')) return { error: 'Lawyer profile not found.' };
    if (action !== 'revoke' && action !== 'reverify') return { error: 'Choose a valid action.' };
    const note = (reason ?? '').trim().slice(0, 1000);
    if (note.length < 10) return { error: 'Please explain the reason to the lawyer (at least 10 characters).' };
    const { db, user: adminUser } = await requireRole('admin');

    const { data: profile } = await db
      .from('lawyer_profiles')
      .select('full_name, roll_number, verification_status')
      .eq('user_id', lawyerId)
      .maybeSingle();
    if (!profile) return { error: 'Lawyer profile not found.' };
    if (!allowedPostApprovalActions(profile.verification_status as string).includes(action)) return { error: STALE };

    const nextStatus = action === 'revoke' ? 'rejected' : 'needs_resubmission';
    const now = new Date().toISOString();
    const { data: updated, error } = await db
      .from('lawyer_profiles')
      .update({
        verification_status: nextStatus,
        reviewed_at: now,
        reviewed_by: adminUser.id,
        rejection_reason: action === 'revoke' ? note : null,
        admin_notes: action === 'reverify' ? note : null,
        is_visible: false,
        is_available: false,
        updated_at: now,
      })
      .eq('user_id', lawyerId)
      .eq('verification_status', 'approved')
      .select('user_id');
    if (error) return { error: 'The change could not be saved. Please try again.' };
    if (!updated || updated.length === 0) return { error: STALE };

    await syncAccount(db, lawyerId, nextStatus);
    await createNotification({
      userId: lawyerId,
      type: action === 'revoke' ? 'lawyer_verification_revoked' : 'lawyer_verification_reverify',
      title: action === 'revoke' ? 'Your verification was revoked' : 'Please verify your credentials again',
      body:
        action === 'revoke'
          ? `The Justicia team revoked your lawyer verification: ${note}. Your profile is no longer listed in Find a Lawyer.`
          : `The Justicia team asks you to verify your credentials again: ${note}. Your profile is hidden from Find a Lawyer until you resubmit and are approved.`,
      metadata: { action, reason: note },
    });
    await writeAuditLog({
      actorId: adminUser.id,
      action: action === 'revoke' ? 'lawyer.verification.revoked' : 'lawyer.verification.reverification_requested',
      targetType: 'lawyer_profile',
      targetId: lawyerId,
      details: { lawyer_name: profile.full_name, roll_number: profile.roll_number, reason: note, previous_status: 'approved' },
    });

    revalidateLawyer(lawyerId);
    const name = formatAttorneyName(profile.full_name);
    return {
      success: true,
      message: action === 'revoke'
        ? `${name}'s verification was revoked and the profile is hidden from Find a Lawyer.`
        : `${name} was asked to verify again; the profile is hidden until re-approved.`,
    };
  } catch (err) {
    return { error: guardMessage(err, 'The change could not be saved.') };
  }
}
