/**
 * Email service — wraps Resend.
 * SERVER-SIDE ONLY. Never import from client code.
 * If RESEND_API_KEY is missing, logs a warning and skips sending gracefully.
 */

import { Resend } from 'resend';
import { createServiceClient } from '@/lib/supabase/server';

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

export function emailTemplateApproved(lawyerName: string): string {
  return `
    <div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;background:#fdf8f2;padding:40px;border-radius:8px;">
      <h1 style="color:#34150F;font-size:24px;margin-bottom:8px;">Congratulations, ${lawyerName}!</h1>
      <p style="color:#5C4535;line-height:1.6;">
        Your Justicia lawyer profile has been <strong style="color:#2d7a2d;">approved</strong>. 
        You are now listed on the Find a Lawyer directory and clients can book consultations with you.
      </p>
      <p style="color:#5C4535;line-height:1.6;">Log in to your Justicia account to update your availability and profile details.</p>
      <hr style="border:1px solid #E8DCCB;margin:24px 0;" />
      <p style="color:#A69584;font-size:12px;">Justicia — AI-Powered Philippine Legal Assistance</p>
    </div>
  `;
}

export function emailTemplateRejected(lawyerName: string, reason: string): string {
  return `
    <div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;background:#fdf8f2;padding:40px;border-radius:8px;">
      <h1 style="color:#34150F;font-size:24px;margin-bottom:8px;">Application Update — ${lawyerName}</h1>
      <p style="color:#5C4535;line-height:1.6;">We have reviewed your Justicia lawyer profile application and are unable to approve it at this time.</p>
      <div style="background:#fff5f5;border-left:4px solid #c0392b;padding:16px;margin:20px 0;border-radius:4px;">
        <strong style="color:#c0392b;">Reason:</strong>
        <p style="color:#5C4535;margin:8px 0 0;">${reason}</p>
      </div>
      <p style="color:#5C4535;line-height:1.6;">You may resubmit your application after addressing the issues noted above.</p>
      <hr style="border:1px solid #E8DCCB;margin:24px 0;" />
      <p style="color:#A69584;font-size:12px;">Justicia — AI-Powered Philippine Legal Assistance</p>
    </div>
  `;
}

export function emailTemplateNeedsResubmission(lawyerName: string, message: string): string {
  return `
    <div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;background:#fdf8f2;padding:40px;border-radius:8px;">
      <h1 style="color:#34150F;font-size:24px;margin-bottom:8px;">Additional Information Required — ${lawyerName}</h1>
      <p style="color:#5C4535;line-height:1.6;">Our review team needs additional information before we can complete your profile verification.</p>
      <div style="background:#fffbf0;border-left:4px solid #C58B3C;padding:16px;margin:20px 0;border-radius:4px;">
        <strong style="color:#C58B3C;">Message from reviewer:</strong>
        <p style="color:#5C4535;margin:8px 0 0;">${message}</p>
      </div>
      <p style="color:#5C4535;line-height:1.6;">Please log in to your Justicia account to update your application.</p>
      <hr style="border:1px solid #E8DCCB;margin:24px 0;" />
      <p style="color:#A69584;font-size:12px;">Justicia — AI-Powered Philippine Legal Assistance</p>
    </div>
  `;
}
