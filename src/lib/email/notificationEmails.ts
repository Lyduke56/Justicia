/**
 * What each in-app notification looks like as an email. Pure (no I/O), so it can be tested.
 *
 * Every email uses the shared Justicia layout (lib/email/layout.ts). The in-app notification text
 * is the main paragraph; this file adds the subject, a callout where the reader has to act, and a
 * button into the right screen for the reader's role.
 *
 * Two rules on content:
 *  - Message contents are never put in an email (attorney-client confidentiality); the email only
 *    says that a message arrived.
 *  - Google Meet links are not put in emails. Joining from Messages in Justicia is what records
 *    attendance (see the missed-consultation rule), so emails always point there.
 */
import type { EmailContent, EmailTone } from '@/lib/email/layout';
import { isMandatoryEmail } from '@/lib/account/preferences';
import { attorneyNameOr } from '@/lib/utils/attorneyName';

export type EmailRole = 'client' | 'lawyer' | 'admin';

export interface NotificationEmailInput {
  type: string;
  title: string;
  body: string;
  payload: Record<string, unknown>;
  role: EmailRole;
  /** Stored full name of the recipient (may be empty). */
  recipientName: string | null | undefined;
  /** Site origin without a trailing slash, e.g. https://justicia.ph */
  appUrl: string;
}

export interface NotificationEmail {
  subject: string;
  content: EmailContent;
}

interface Spec {
  subject?: string;
  heading?: string;
  /** Replaces the notification body as the main paragraph(s). */
  paragraphs?: string[];
  callout?: { tone: EmailTone; title: string; body: string };
  steps?: string[];
  action?: { label: string; path: string };
  closing?: string[];
}

const PREPARE_STEPS = [
  'Find a quiet, private place for the call.',
  'Check your internet connection, camera and microphone.',
  'Keep the documents you want to discuss close at hand.',
  'Join from **Messages** in Justicia, so your attendance is recorded.',
];

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/** Drops leading symbols/emoji from titles like "✓ Application Approved". */
function cleanTitle(title: string): string {
  return title.replace(/^[^\p{L}\p{N}]+/u, '').trim() || 'Justicia update';
}

/** Removes a raw meeting link sentence ("Join via Google Meet: https://…") from a body. */
function withoutMeetLink(body: string): string {
  return body
    .replace(/\s*(Join via )?Google Meet( link)?:\s*\S+/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** When the reason is shown in its own callout, drop the "Reason: …" tail from the body. */
function withoutReason(body: string, reason: string): string {
  if (!reason) return body;
  const at = body.indexOf('Reason:');
  return at > 0 ? body.slice(0, at).trim() : body;
}

function messagesPath(role: EmailRole, payload: Record<string, unknown>): string {
  const thread = str(payload.threadId) || str(payload.consultationId);
  const base = `/${role === 'lawyer' ? 'lawyer' : 'client'}/messages`;
  return thread ? `${base}?thread=${encodeURIComponent(thread)}` : base;
}

function specFor(input: NotificationEmailInput): Spec {
  const { type, title, body, payload, role } = input;
  const portal = role === 'lawyer' ? '/lawyer' : '/client';
  const consultations = `${portal}/consultations`;
  const reason = str(payload.reason);

  switch (type) {
    // ── Lawyer: requests and payments to act on ─────────────────────────────
    case 'consultation_request':
      return {
        subject: 'New consultation request',
        heading: 'You have a new consultation request',
        callout: {
          tone: 'info',
          title: 'Waiting for your reply',
          body: 'Approve or decline the request in Consultations. The client can only pay after you approve it.',
        },
        action: { label: 'Review the request', path: '/lawyer/consultations' },
      };
    case 'consultation_request_reminder':
      return {
        subject: 'A consultation request is still pending',
        heading: 'A client is waiting for your reply',
        action: { label: 'Review the request', path: '/lawyer/consultations' },
      };
    case 'consultation_cancellation_requested':
      return {
        subject: 'Cancellation requested',
        callout: { tone: 'warning', title: 'Your decision is needed', body: 'Accept the request to cancel and refund, or decline it to keep the booking.' },
        action: { label: 'Review the request', path: '/lawyer/consultations' },
      };
    case 'payment_submitted':
      return {
        subject: 'Proof of payment submitted',
        heading: 'A client submitted a proof of payment',
        callout: { tone: 'info', title: 'Next step', body: 'Check the proof against your payment account, then confirm or decline it. Confirming books the consultation.' },
        action: { label: 'Review the payment', path: '/lawyer/consultations' },
      };

    // ── Client: request progress ─────────────────────────────────────────────
    case 'consultation_request_receipt':
      return {
        subject: 'Your consultation request was sent',
        heading: 'Your request was sent',
        callout: {
          tone: 'info',
          title: 'Pending approval',
          body: "The attorney will approve or decline your request. We'll email you as soon as they reply. Nothing is charged until then.",
        },
        action: { label: 'View my consultations', path: '/client/consultations' },
      };
    case 'consultation_approved':
      return {
        subject: 'Consultation approved: complete your payment',
        heading: 'Your consultation was approved',
        callout: {
          tone: 'warning',
          title: 'Payment needed to confirm',
          body: 'Your slot is confirmed only after you pay and the attorney verifies your proof of payment.',
        },
        action: { label: 'Complete payment', path: '/client/consultations' },
      };
    case 'consultation_declined':
      return {
        subject: 'Consultation request declined',
        paragraphs: [withoutReason(body, reason)],
        callout: reason ? { tone: 'error', title: 'Reason', body: reason } : undefined,
        closing: ['You can book another verified attorney from Find a Lawyer.'],
        action: { label: 'Find a lawyer', path: '/client/lawyers' },
      };
    case 'payment_confirmed':
      return {
        subject: 'Your consultation is confirmed',
        heading: 'Your consultation is confirmed',
        paragraphs: [withoutMeetLink(body)],
        callout: {
          tone: 'success',
          title: 'How to join',
          body: "When it's time, open **Messages** in Justicia and press Join. We'll remind you 24 hours, 1 hour and 15 minutes before it starts.",
        },
        action: { label: 'View consultation', path: '/client/consultations' },
      };
    case 'payment_declined':
      return {
        subject: 'Proof of payment declined',
        paragraphs: [withoutReason(body, reason)],
        callout: reason ? { tone: 'error', title: 'Reason', body: reason } : undefined,
        closing: ['Please upload a new proof of payment to keep your booking.'],
        action: { label: 'Upload new proof', path: '/client/consultations' },
      };
    case 'consultation_cancellation_declined':
      return { subject: 'Cancellation request declined', action: { label: 'View consultation', path: consultations } };

    // ── Either side ──────────────────────────────────────────────────────────
    case 'consultation_cancelled':
      return { subject: cleanTitle(title), action: { label: 'View consultations', path: consultations } };
    case 'consultation_cancellation_withdrawn':
    case 'consultation_reschedule_requested':
    case 'consultation_rescheduled':
    case 'consultation_reschedule_declined':
    case 'consultation_reschedule_withdrawn':
      return {
        callout: type === 'consultation_reschedule_requested'
          ? { tone: 'info', title: 'Your decision is needed', body: 'Accept the new time or decline it to keep the original schedule.' }
          : undefined,
        action: { label: 'View consultation', path: consultations },
      };
    case 'new_message':
      return {
        subject: cleanTitle(title),
        paragraphs: [`${cleanTitle(title)} on Justicia. For your privacy, message contents are never included in emails.`],
        action: { label: 'Open Messages', path: messagesPath(role, payload) },
      };

    // ── Reminders ────────────────────────────────────────────────────────────
    case 'reminder_24h':
      return {
        subject: 'Reminder: your consultation is tomorrow',
        heading: 'Your consultation is coming up',
        steps: PREPARE_STEPS,
        action: { label: 'View consultation', path: consultations },
      };
    case 'reminder_1h':
      return {
        subject: 'Your consultation starts in 1 hour',
        heading: 'Your consultation starts in 1 hour',
        steps: PREPARE_STEPS,
        action: { label: 'Open Messages', path: messagesPath(role, payload) },
      };
    case 'meeting_starting':
      return {
        subject: 'Your consultation is starting soon. Please prepare',
        heading: 'Your consultation is starting soon',
        paragraphs: [body.replace(/\s*Open Messages to join the meeting\.?$/, '')],
        callout: { tone: 'warning', title: 'Please get ready', body: 'Open Messages in Justicia and press **Join** when the meeting opens. Joining there is what records your attendance.' },
        action: { label: 'Open Messages to join', path: messagesPath(role, payload) },
      };

    // ── Lawyer verification ──────────────────────────────────────────────────
    case 'lawyer_verification_approved':
      return {
        subject: 'Your Justicia lawyer profile is approved',
        steps: ['Review your profile details and consultation fees.', 'Set your weekly consultation hours.', 'Upload your payment QR so you can approve requests.'],
        action: { label: 'Open my dashboard', path: '/lawyer/dashboard' },
      };
    case 'lawyer_verification_needs_resubmission':
    case 'lawyer_verification_reverify':
      return { subject: 'Action needed on your lawyer verification', action: { label: 'Update my application', path: '/lawyer/verification' } };
    case 'lawyer_verification_rejected':
    case 'lawyer_verification_revoked':
      return { subject: cleanTitle(title), action: { label: 'View verification status', path: '/lawyer/verification' } };

    default:
      return { action: { label: 'Open Justicia', path: `${portal}/dashboard` } };
  }
}

export function buildNotificationEmail(input: NotificationEmailInput): NotificationEmail {
  const spec = specFor(input);
  const heading = spec.heading ?? cleanTitle(input.title);
  const subject = spec.subject ?? heading;
  const trimmed = input.recipientName?.trim();
  const name = trimmed ? (input.role === 'lawyer' ? attorneyNameOr(trimmed, trimmed) : trimmed) : '';
  const paragraphs = (spec.paragraphs ?? [input.body]).filter(Boolean);
  const settings = `${input.appUrl}/${input.role === 'lawyer' ? 'lawyer' : 'client'}/settings`;

  return {
    subject,
    content: {
      preheader: paragraphs[0]?.replace(/\*\*/g, '').slice(0, 140) || heading,
      heading,
      greeting: name ? `Dear ${name},` : 'Hello,',
      paragraphs,
      callout: spec.callout,
      steps: spec.steps,
      action: spec.action ? { label: spec.action.label, url: `${input.appUrl}${spec.action.path}` } : undefined,
      closing: spec.closing,
      footerNote: isMandatoryEmail(input.type)
        ? 'This is an account notice, so it is sent even when email updates are turned off.'
        : `You're getting this because email updates are on for your Justicia account. You can turn them off in Settings → Notifications: ${settings}`,
    },
  };
}
