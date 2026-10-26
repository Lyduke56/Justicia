'use server';

import { revalidatePath } from 'next/cache';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { writeAuditLog, createNotification } from '@/lib/notifications';
import type { LawyerVerificationStatus, VerificationStatus } from '@/types/database';

export type ReviewDecision = 'approved' | 'rejected' | 'needs_resubmission';

export interface ReviewLawyerResult {
  success?: boolean;
  message?: string;
  error?: string;
}

/**
 * Server Action for Administrator to Review and Decide on Lawyer Verification
 */
export async function reviewLawyerApplicationAction(
  lawyerId: string,
  decision: ReviewDecision,
  reasonOrNotes?: string
): Promise<ReviewLawyerResult> {
  try {
    const supabase = await createClient();
    const {
      data: { user: adminUser },
    } = await supabase.auth.getUser();

    // Verify admin role
    const serviceSupabase = await createServiceClient();
    if (adminUser) {
      const { data: adminAcc } = await serviceSupabase
        .from('user_accounts')
        .select('role')
        .eq('id', adminUser.id)
        .single() as { data: { role: string } | null };

      if (adminAcc?.role !== 'admin' && adminUser.user_metadata?.role !== 'admin') {
        return { error: 'Unauthorized: Only platform administrators can review applications.' };
      }
    }

    const now = new Date().toISOString();

    // 1. Fetch current profile
    const { data: profile, error: fetchErr } = await serviceSupabase
      .from('lawyer_profiles')
      .select('full_name, roll_number, verification_status')
      .eq('user_id', lawyerId)
      .maybeSingle() as { data: { full_name: string; roll_number: string; verification_status: string } | null; error: unknown };

    if (fetchErr || !profile) {
      return { error: 'Lawyer profile not found.' };
    }

    const rejectionReason = decision === 'rejected' ? (reasonOrNotes?.trim() || 'Credentials could not be verified with IBP records.') : null;
    const adminNotes = decision === 'needs_resubmission' ? (reasonOrNotes?.trim() || 'Additional credential verification required.') : null;

    // 2. Update lawyer_profiles table
    const updatePayload: Record<string, unknown> = {
      verification_status: decision as LawyerVerificationStatus,
      reviewed_at: now,
      reviewed_by: adminUser?.id || 'admin-system',
      rejection_reason: rejectionReason,
      admin_notes: adminNotes,
      updated_at: now,
    };

    if (decision === 'approved') {
      updatePayload.is_visible = true;
      updatePayload.is_available = true;
    } else {
      updatePayload.is_visible = false;
      updatePayload.is_available = false;
    }

    const { error: updateProfErr } = await (serviceSupabase
      .from('lawyer_profiles') as any)
      .update(updatePayload)
      .eq('user_id', lawyerId);

    if (updateProfErr) {
      return { error: `Failed to update lawyer profile: ${updateProfErr.message}` };
    }

    // 3. Update user_accounts table
    const userAccStatus: VerificationStatus = decision === 'approved' ? 'verified' : decision === 'rejected' ? 'rejected' : 'pending';
    await (serviceSupabase
      .from('user_accounts') as any)
      .update({
        role: 'lawyer',
        verification_status: userAccStatus,
      })
      .eq('id', lawyerId);

    // 4. Update Supabase Auth user_metadata so JWT session matches
    try {
      const { data: authUser } = await serviceSupabase.auth.admin.getUserById(lawyerId);
      if (authUser?.user) {
        await serviceSupabase.auth.admin.updateUserById(lawyerId, {
          user_metadata: {
            ...authUser.user.user_metadata,
            role: 'lawyer',
            verification_status: decision,
          },
        });
      }
    } catch (e) {
      console.warn('[ReviewAction] Auth metadata sync warning:', e);
    }

    // 5. In-app Notification for the lawyer
    let notificationTitle = '';
    let notificationBody = '';

    if (decision === 'approved') {
      notificationTitle = '🎉 Application Approved!';
      notificationBody = 'Congratulations! Your credentials have been verified by the Justicia team. You now have full access to the Lawyer Counsel Portal and your profile is live in Find a Lawyer.';
    } else if (decision === 'needs_resubmission') {
      notificationTitle = '📋 Additional Information Required';
      notificationBody = `Our team reviewed your lawyer application and requires additional details: ${adminNotes}. Please update and resubmit your application.`;
    } else {
      notificationTitle = '✗ Application Not Approved';
      notificationBody = `We were unable to approve your application at this time: ${rejectionReason}. You may review and submit a new application.`;
    }

    await createNotification({
      userId: lawyerId,
      type: `lawyer_verification_${decision}`,
      title: notificationTitle,
      body: notificationBody,
      metadata: {
        decision,
        reason: rejectionReason || adminNotes,
        roll_number: profile.roll_number,
      },
    });

    // 6. Security Audit Log
    await writeAuditLog({
      actorId: adminUser?.id || 'admin-system',
      action: `lawyer.verification.${decision}`,
      targetType: 'lawyer_profile',
      targetId: lawyerId,
      details: {
        lawyer_name: profile.full_name,
        roll_number: profile.roll_number,
        decision,
        reason: rejectionReason || adminNotes,
      },
    });

    // 7. Revalidate Next.js cache so changes reflect instantly
    revalidatePath('/admin/lawyers/verification-queue');
    revalidatePath('/admin/lawyers');
    revalidatePath(`/admin/lawyers/${lawyerId}`);
    revalidatePath('/admin/dashboard');
    revalidatePath('/lawyer/verification');
    revalidatePath('/lawyer/dashboard');

    return {
      success: true,
      message: decision === 'approved'
        ? `Atty. ${profile.full_name} has been approved and granted full portal access.`
        : decision === 'needs_resubmission'
        ? `Request for additional info sent to Atty. ${profile.full_name}.`
        : `Application for Atty. ${profile.full_name} has been rejected.`,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'An error occurred during review';
    return { error: msg };
  }
}
