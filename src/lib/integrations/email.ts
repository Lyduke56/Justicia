/**
 * Email service. SERVER-SIDE ONLY. Never import from client code.
 *
 * Transport, in order of preference:
 *  1. Gmail SMTP with an App Password (GMAIL_USER + GMAIL_APP_PASSWORD). Create the password at
 *     https://myaccount.google.com/apppasswords (the Google account needs 2-Step Verification).
 *  2. Resend (RESEND_API_KEY + RESEND_FROM_EMAIL).
 * With neither configured, sending is skipped with a warning; in-app notifications still work.
 */

import { Resend } from 'resend';
import nodemailer, { type Transporter } from 'nodemailer';
import { createServiceClient } from '@/lib/supabase/server';
import { renderEmailHtml } from '@/lib/email/layout';

let _resend: Resend | null = null;
let _gmail: Transporter | null = null;

function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

function gmailCredentials(): { user: string; pass: string } | null {
  const user = process.env.GMAIL_USER?.trim();
  // Google shows App Passwords as four groups of four letters; the spaces are not part of it.
  const pass = process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, '');
  return user && pass ? { user, pass } : null;
}

function getGmail(): { transport: Transporter; from: string } | null {
  const creds = gmailCredentials();
  if (!creds) return null;
  if (!_gmail) {
    _gmail = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: creds,
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    });
  }
  // Gmail only sends as the signed-in address (or a verified alias), so only the name is configurable.
  const name = (process.env.EMAIL_FROM_NAME || 'Justicia').replace(/["\r\n]/g, '');
  return { transport: _gmail, from: `"${name}" <${creds.user}>` };
}

/** Which transport sendEmail will use (for the health check). */
export function emailTransport(): 'gmail' | 'resend' | 'none' {
  if (gmailCredentials()) return 'gmail';
  if (process.env.RESEND_API_KEY) return 'resend';
  return 'none';
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

async function markOutbox(outboxId: string | undefined, fields: { status: string; error?: string }) {
  if (!outboxId) return;
  try {
    const supabase = await createServiceClient();
    await supabase.from('email_outbox_dev').update(fields).eq('id', outboxId);
  } catch { /* ignore */ }
}

/**
 * Sends an email (Gmail SMTP, else Resend) and logs it in email_outbox_dev.
 * Never throws; skips gracefully when no transport is configured.
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

  const gmail = getGmail();
  if (gmail) {
    try {
      const info = await gmail.transport.sendMail({
        from: gmail.from,
        to: payload.to,
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
      });
      await markOutbox(outboxId, { status: 'sent' });
      return { sent: true, id: info.messageId };
    } catch (err: unknown) {
      const error = err instanceof Error ? err.message : String(err);
      console.error('[Email] Gmail send failed:', error);
      await markOutbox(outboxId, { status: 'failed', error });
      return { sent: false, error };
    }
  }

  const client = getResend();

  if (!client) {
    console.warn('[Email] No email transport configured (GMAIL_USER/GMAIL_APP_PASSWORD or RESEND_API_KEY) — skipping. In-app notification still created.');
    await markOutbox(outboxId, { status: 'failed', error: 'No email transport configured' });
    return { sent: false, error: 'No email transport configured' };
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
