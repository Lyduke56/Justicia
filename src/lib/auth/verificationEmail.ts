/**
 * The sign-up verification email (SERVER-SIDE ONLY). Replaces Supabase's own confirmation email:
 * same content as supabase/templates/confirm-signup.html, sent through the app's email transport
 * (Gmail SMTP), with a signed link to /auth/verify instead of Supabase's {{ .ConfirmationURL }}.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { sendEmail } from '@/lib/integrations/email';
import { renderEmailHtml, renderEmailText, type EmailContent } from '@/lib/email/layout';
import { createVerifyToken } from '@/lib/auth/verifyToken';

function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || 'https://justicia-chi.vercel.app').replace(/\/$/, '');
}

export function verificationLink(userId: string, email: string): string {
  return `${siteUrl()}/auth/verify?token=${encodeURIComponent(createVerifyToken(userId, email))}`;
}

function verificationContent(email: string, link: string): EmailContent {
  return {
    preheader: 'One click to activate your Justicia account.',
    heading: 'Confirm your email address',
    paragraphs: [
      `Welcome to Justicia! Please confirm that **${email}** is your email address to activate your account.`,
    ],
    steps: [
      'Click **Verify Email Address** below.',
      'Sign in to Justicia with your email and password.',
      'Clients can book a verified lawyer or ask the AI legal assistant. Lawyers can finish their application for review.',
    ],
    action: { label: 'Verify Email Address', url: link },
    closing: ['This link expires in **24 hours**. You can ask for a new one from the sign-in page.'],
    footerNote: "If you didn't create a Justicia account, you can safely ignore this email.",
  };
}

/** Sends the verification email for a new (unconfirmed) account. Never throws. */
export async function sendSignupVerificationEmail(userId: string, email: string): Promise<boolean> {
  try {
    const content = verificationContent(email, verificationLink(userId, email));
    const result = await sendEmail({
      to: email,
      subject: 'Confirm your Justicia account',
      html: renderEmailHtml(content),
      text: renderEmailText(content),
    });
    if (!result.sent) console.warn('[verificationEmail] not sent:', result.error);
    return result.sent;
  } catch (err) {
    console.warn('[verificationEmail] failed:', err);
    return false;
  }
}

/**
 * Sends a new link to `email` only if it belongs to an account that is still unconfirmed.
 * Says nothing either way, so callers can answer the same for every address.
 */
export async function resendSignupVerificationEmail(db: SupabaseClient, email: string): Promise<void> {
  const { data: account } = await db.from('user_accounts').select('id').eq('email', email).maybeSingle();
  const userId = (account as { id?: string } | null)?.id;
  if (!userId) return;
  const { data, error } = await db.auth.admin.getUserById(userId);
  const user = data?.user;
  if (error || !user || user.email_confirmed_at) return;
  if (user.email?.toLowerCase() !== email) return;
  await sendSignupVerificationEmail(user.id, email);
}
