/**
 * Email service — wraps Resend.
 * SERVER-SIDE ONLY. Never import from client code.
 * If RESEND_API_KEY is missing, logs a warning and skips sending gracefully.
 */

import { Resend } from 'resend';
import { createServiceClient } from '@/lib/supabase/server';
import { renderEmailHtml } from '@/lib/email/layout';

let _resend: Resend | null = null;

function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

export interface DirectEmailPayload {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface SendResult {
  sent: boolean;
  id?: string;
  error?: string;
}

/**
 * Sends an email via Resend and writes to email_outbox_dev.
 * Gracefully skips if RESEND_API_KEY is not set.
 */
export async function sendEmail(payload: DirectEmailPayload): Promise<SendResult> {
  // Always write to dev outbox first
  let outboxId: string | undefined;
  try {
    const supabase = await createServiceClient();
    const { data } = await supabase.from('email_outbox_dev').insert({
      to: payload.to,
      subject: payload.subject,
      body: payload.html,
      status: 'pending',
    }).select('id').single();
    outboxId = data?.id;
  } catch {
    // Non-fatal
  }

  const client = getResend();

  if (!client) {
    console.warn('[Email] RESEND_API_KEY not set — skipping email send. In-app notification still created.');
    if (outboxId) {
      try {
        const supabase = await createServiceClient();
        await supabase
          .from('email_outbox_dev')
          .update({ status: 'failed', error: 'RESEND_API_KEY not configured' })
          .eq('id', outboxId);
      } catch { /* ignore */ }
    }
    return { sent: false, error: 'RESEND_API_KEY not configured' };
  }

  try {
    const fromEmail = process.env.RESEND_FROM_EMAIL ?? 'Justicia <noreply@justicia.ph>';
    const result = await client.emails.send({
      from: fromEmail,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
    });

    if (outboxId) {
      try {
        const supabase = await createServiceClient();
        await supabase
          .from('email_outbox_dev')
          .update({ status: 'sent' })
          .eq('id', outboxId);
      } catch { /* ignore */ }
    }

    return { sent: true, id: result.data?.id };
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    console.error('[Email] Send failed:', error);
    if (outboxId) {
      try {
        const supabase = await createServiceClient();
        await supabase
          .from('email_outbox_dev')
          .update({ status: 'failed', error })
          .eq('id', outboxId);
      } catch { /* ignore */ }
    }
    return { sent: false, error };
  }
}

// ─── Legacy stub compat (other parts of the app may import the old signature) ──
export type EmailTemplate =
  | 'welcome'
  | 'verify-email'
  | 'password-reset'
  | 'consultation-confirmed'
  | 'consultation-reminder'
  | 'consultation-cancelled'
  | 'lawyer-verified'
  | 'payment-receipt';

export interface EmailPayload {
  to: string;
  template: EmailTemplate;
  data: Record<string, unknown>;
}

export async function sendBulkEmail(
  recipients: string[],
  template: EmailTemplate,
  data: Record<string, unknown>
): Promise<void> {
  console.log('[Email] sendBulkEmail', template, 'to', recipients.length, 'recipients', data);
}

// ─── Email Templates ──────────────────────────────────────────────────────────
// All in the shared Justicia layout (lib/email/layout.ts); names and reasons are escaped.

export function emailTemplateApproved(lawyerName: string): string {
  return renderEmailHtml({
    preheader: 'Your Justicia lawyer profile is approved and now listed on Find a Lawyer.',
    heading: `Congratulations, ${lawyerName}!`,
    paragraphs: [
      'Your Justicia lawyer profile has been **approved**. You are now listed on the Find a Lawyer directory and clients can book consultations with you.',
    ],
    steps: ['Sign in to your Justicia account.', 'Review your profile details and consultation fees.', 'Set your availability so clients can book you.'],
    action: { label: 'Open My Dashboard', url: `${appUrl()}/lawyer/dashboard` },
  });
}

export function emailTemplateRejected(lawyerName: string, reason: string): string {
  return renderEmailHtml({
    preheader: 'An update on your Justicia lawyer application.',
    heading: `Application update — ${lawyerName}`,
    paragraphs: ['We have reviewed your Justicia lawyer profile application and are unable to approve it at this time.'],
    callout: { tone: 'error', title: 'Reason', body: reason },
    closing: ['You may resubmit your application after addressing the issues noted above.'],
    action: { label: 'View Application Status', url: `${appUrl()}/lawyer/verification` },
  });
}

export function emailTemplateNeedsResubmission(lawyerName: string, message: string): string {
  return renderEmailHtml({
    preheader: 'The Justicia review team needs a little more information.',
    heading: `Additional information required — ${lawyerName}`,
    paragraphs: ['Our review team needs additional information before we can complete your profile verification.'],
    callout: { tone: 'warning', title: 'Message from reviewer', body: message },
    closing: ['Please sign in to your Justicia account to update your application.'],
    action: { label: 'Update My Application', url: `${appUrl()}/lawyer/register` },
  });
}

function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://justicia.ph').replace(/\/$/, '');
}
