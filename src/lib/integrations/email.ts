/**
 * Email Notification Client Stub
 *
 * All email operations MUST be called server-side only.
 * Target integration: Resend, SendGrid, or AWS SES.
 *
 * TODO: Integrate email provider once EMAIL_SERVICE_API_KEY is configured
 */

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

/**
 * Sends a transactional email using the configured email service.
 * TODO: Implement with real email provider (e.g. Resend)
 */
export async function sendEmail(payload: EmailPayload): Promise<void> {
  console.log('[Email Stub] sendEmail', payload.template, '->', payload.to);
  // TODO: POST to email service API
  // await resend.emails.send({
  //   from: 'Justicia <noreply@justicia.ph>',
  //   to: payload.to,
  //   subject: templates[payload.template].subject(payload.data),
  //   html: templates[payload.template].render(payload.data),
  // });
}

/**
 * Sends a bulk notification email (e.g. platform announcements).
 * TODO: Implement batch send
 */
export async function sendBulkEmail(
  recipients: string[],
  template: EmailTemplate,
  data: Record<string, unknown>
): Promise<void> {
  console.log('[Email Stub] sendBulkEmail', template, 'to', recipients.length, 'recipients');
  // TODO: Implement batch email sending
}
