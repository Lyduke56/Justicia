'use server';

/**
 * Admin Lawyer Review Actions
 * All actions verify caller is admin server-side before executing.
 * NEVER called from client code directly — only via Server Actions.
 */

import { createClient, createServiceClient } from '@/lib/supabase/server';
import { sendEmail, emailTemplateApproved, emailTemplateRejected, emailTemplateNeedsResubmission } from '@/lib/integrations/email';
import { createNotification, writeAuditLog } from '@/lib/notifications';
import { revalidatePath } from 'next/cache';

export type AdminActionState = { error?: string; success?: string } | null;

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: account } = await supabase
    .from('user_accounts')
    .select('role')
    .eq('id', user.id)
    .single();

  if (account?.role !== 'admin') {
    throw new Error('Forbidden: admin role required');
  }
  return user;
}

// ─── Approve Lawyer ───────────────────────────────────────────────────────────

export async function approveLawyerAction(
  _prevState: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  try {
    const adminUser = await requireAdmin();
    const lawyerId = formData.get('lawyer_id') as string;
    if (!lawyerId) return { error: 'Lawyer ID is required' };

    const supabase = await createServiceClient();

    // Fetch lawyer info
    const { data: lawyer } = await supabase
      .from('lawyer_profiles')
      .select('user_id, full_name')
      .eq('user_id', lawyerId)
      .single();

    if (!lawyer) return { error: 'Lawyer not found' };

    // Fetch lawyer email
    const { data: account } = await supabase
      .from('user_accounts')
      .select('email')
      .eq('id', lawyerId)
      .single();

    // Update status
    const { error } = await supabase
      .from('lawyer_profiles')
      .update({
        verification_status: 'approved',
        reviewed_by: adminUser.id,
        reviewed_at: new Date().toISOString(),
        admin_notes: null,
        rejection_reason: null,
      })
      .eq('user_id', lawyerId);

    if (error) return { error: error.message };

    // In-app notification
    await createNotification({
      userId: lawyerId,
      type: 'lawyer_approved',
      title: 'Your application has been approved!',
      body: 'Congratulations! Your Justicia lawyer profile is now live on Find a Lawyer.',
      metadata: { lawyer_id: lawyerId },
    });

    // Email
    if (account?.email) {
      await sendEmail({
        to: account.email,
        subject: 'Your Justicia Lawyer Profile is Approved!',
        html: emailTemplateApproved(lawyer.full_name),
      });
    }

    // Audit log
    await writeAuditLog({
      actorId: adminUser.id,
      action: 'lawyer.approved',
      targetType: 'lawyer_profile',
      targetId: lawyerId,
      details: { lawyer_name: lawyer.full_name },
    });

    revalidatePath('/admin/lawyers');
    revalidatePath('/client/lawyers');
    return { success: 'Lawyer approved successfully.' };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'An error occurred';
    return { error: msg };
  }
}

// ─── Reject Lawyer ────────────────────────────────────────────────────────────

export async function rejectLawyerAction(
  _prevState: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  try {
    const adminUser = await requireAdmin();
    const lawyerId = formData.get('lawyer_id') as string;
    const reason = (formData.get('reason') as string)?.trim();

    if (!lawyerId) return { error: 'Lawyer ID is required' };
    if (!reason || reason.length < 10) return { error: 'A rejection reason of at least 10 characters is required' };

    const supabase = await createServiceClient();

    const { data: lawyer } = await supabase
      .from('lawyer_profiles')
      .select('user_id, full_name')
      .eq('user_id', lawyerId)
      .single();
    if (!lawyer) return { error: 'Lawyer not found' };

    const { data: account } = await supabase
      .from('user_accounts')
      .select('email')
      .eq('id', lawyerId)
      .single();

    const { error } = await supabase
      .from('lawyer_profiles')
      .update({
        verification_status: 'rejected',
        rejection_reason: reason,
        reviewed_by: adminUser.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq('user_id', lawyerId);

    if (error) return { error: error.message };

    await createNotification({
      userId: lawyerId,
      type: 'lawyer_rejected',
      title: 'Application Update',
      body: `Your application has been reviewed. Reason: ${reason}`,
      metadata: { lawyer_id: lawyerId, reason },
    });

    if (account?.email) {
      await sendEmail({
        to: account.email,
        subject: 'Update on Your Justicia Application',
        html: emailTemplateRejected(lawyer.full_name, reason),
      });
    }

    await writeAuditLog({
      actorId: adminUser.id,
      action: 'lawyer.rejected',
      targetType: 'lawyer_profile',
      targetId: lawyerId,
      details: { lawyer_name: lawyer.full_name, reason },
    });

    revalidatePath('/admin/lawyers');
    return { success: 'Lawyer rejected.' };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'An error occurred';
    return { error: msg };
  }
}

// ─── Request More Info ────────────────────────────────────────────────────────

export async function requestResubmissionAction(
  _prevState: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  try {
    const adminUser = await requireAdmin();
    const lawyerId = formData.get('lawyer_id') as string;
    const message = (formData.get('message') as string)?.trim();

    if (!lawyerId) return { error: 'Lawyer ID is required' };
    if (!message || message.length < 10) return { error: 'A message of at least 10 characters is required' };

    const supabase = await createServiceClient();

    const { data: lawyer } = await supabase
      .from('lawyer_profiles')
      .select('user_id, full_name')
      .eq('user_id', lawyerId)
      .single();
    if (!lawyer) return { error: 'Lawyer not found' };

    const { data: account } = await supabase
      .from('user_accounts')
      .select('email')
      .eq('id', lawyerId)
      .single();

    const { error } = await supabase
      .from('lawyer_profiles')
      .update({
        verification_status: 'needs_resubmission',
        admin_notes: message,
        reviewed_by: adminUser.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq('user_id', lawyerId);

    if (error) return { error: error.message };

    await createNotification({
      userId: lawyerId,
      type: 'lawyer_needs_resubmission',
      title: 'Additional Information Required',
      body: message,
      metadata: { lawyer_id: lawyerId, message },
    });

    if (account?.email) {
      await sendEmail({
        to: account.email,
        subject: 'Action Required: Update Your Justicia Application',
        html: emailTemplateNeedsResubmission(lawyer.full_name, message),
      });
    }

    await writeAuditLog({
      actorId: adminUser.id,
      action: 'lawyer.needs_resubmission',
      targetType: 'lawyer_profile',
      targetId: lawyerId,
      details: { lawyer_name: lawyer.full_name, message },
    });

    revalidatePath('/admin/lawyers');
    return { success: 'Resubmission request sent.' };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'An error occurred';
    return { error: msg };
  }
}
