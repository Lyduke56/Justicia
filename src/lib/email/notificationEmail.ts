/**
 * Emails a copy of an in-app notification. SERVER-SIDE ONLY.
 *
 * The notification helpers (notifyUser, notify, notifyAccount, createNotification and the
 * consultation reminders) call queueNotificationEmail right after a bell row is written, so every
 * notification a client or lawyer gets can also reach their inbox. Sending runs after the
 * response (next/server `after`), so a slow mail server never delays the action.
 *
 * Who gets an email:
 *  - only confirmed email addresses (from Supabase Auth, not editable profile data);
 *  - only when the user's "Email updates" switch and that notification's category are on
 *    (account standing and lawyer verification notices are always sent: see wantsEmailFor);
 *  - not to suspended, terminated or leaving accounts, except for those account notices.
 */
import { after } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServiceClient } from '@/lib/supabase/server';
import { emailTransport, sendEmail } from '@/lib/integrations/email';
import { renderEmailHtml, renderEmailText } from '@/lib/email/layout';
import { accountPreferences, isMandatoryEmail, wantsEmailFor } from '@/lib/account/preferences';
import { buildNotificationEmail, type EmailRole } from '@/lib/email/notificationEmails';
import { attorneyNameOr } from '@/lib/utils/attorneyName';

export interface NotificationEmailParams {
  userId: string;
  type: string;
  title: string;
  body: string;
  payload?: Record<string, unknown> | null;
}

/** Types whose code path already sends its own email (lib/moderation/accountStatus.ts). */
const EMAILED_ELSEWHERE = new Set(['account_suspended', 'account_reinstated', 'account_terminated']);

export function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://justicia-chi.vercel.app').replace(/\/$/, '');
}

function manilaWhen(iso: string | null | undefined): string {
  if (!iso) return 'the requested time';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'the requested time';
  return d.toLocaleString('en-PH', {
    timeZone: 'Asia/Manila',
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** Sends the email now. Never throws; answers whether an email was handed to the mail server. */
export async function sendNotificationEmail(params: NotificationEmailParams, dbIn?: SupabaseClient): Promise<boolean> {
  try {
    if (EMAILED_ELSEWHERE.has(params.type)) return false;
    if (emailTransport() === 'none') return false;
    const db = dbIn ?? ((await createServiceClient()) as unknown as SupabaseClient);

    const { data: auth } = await db.auth.admin.getUserById(params.userId);
    const user = auth?.user;
    if (!user?.email || !user.email_confirmed_at) return false;
    if (!wantsEmailFor(accountPreferences(user.user_metadata), params.type)) return false;

    const { data: profile } = await db
      .from('profiles')
      .select('full_name, role, account_status')
      .eq('user_id', params.userId)
      .maybeSingle();
    const status = (profile?.account_status as string | null) ?? 'active';
    if (status !== 'active' && !isMandatoryEmail(params.type)) return false;
    const role = ((profile?.role as string | null) ?? (user.app_metadata?.role as string | undefined) ?? 'client') as EmailRole;
    if (role === 'admin') return false;

    const email = buildNotificationEmail({
      type: params.type,
      title: params.title,
      body: params.body,
      payload: params.payload ?? {},
      role,
      recipientName: (profile?.full_name as string | null) ?? (user.user_metadata?.full_name as string | undefined),
      appUrl: appUrl(),
    });
    const result = await sendEmail({
      to: user.email,
      subject: email.subject,
      html: renderEmailHtml(email.content),
      text: renderEmailText(email.content),
    });
    return result.sent;
  } catch (err) {
    console.warn('[notificationEmail]', params.type, err instanceof Error ? err.message : err);
    return false;
  }
}

/**
 * The client's "request sent" receipt. It has no bell row of its own: it goes out when the
 * lawyer's consultation_request notification is written.
 */
async function sendRequestReceipt(lawyerId: string, payload: Record<string, unknown>): Promise<void> {
  const clientId = typeof payload.clientId === 'string' ? payload.clientId : '';
  const consultationId = typeof payload.consultationId === 'string' ? payload.consultationId : '';
  if (!clientId || !consultationId || emailTransport() === 'none') return;
  const db = (await createServiceClient()) as unknown as SupabaseClient;
  const [{ data: row }, { data: lawyer }] = await Promise.all([
    db.from('consultations').select('scheduled_start, method').eq('id', consultationId).maybeSingle(),
    db.from('lawyer_profiles').select('full_name').eq('user_id', lawyerId).maybeSingle(),
  ]);
  const kind = row?.method === 'audio' ? 'audio call' : 'video consultation';
  const who = attorneyNameOr(lawyer?.full_name as string | null | undefined, 'the attorney');
  await sendNotificationEmail(
    {
      userId: clientId,
      type: 'consultation_request_receipt',
      title: 'Consultation request sent',
      body: `Your ${kind} request with ${who} for **${manilaWhen(row?.scheduled_start as string | null)}** (Philippine time) was sent and is waiting for the attorney's approval.`,
      payload: { consultationId },
    },
    db
  );
}

/** Sends the email after the current response (or right away outside a request). Never throws. */
export function queueNotificationEmail(params: NotificationEmailParams): void {
  const run = async () => {
    await sendNotificationEmail(params);
    if (params.type === 'consultation_request') await sendRequestReceipt(params.userId, params.payload ?? {});
  };
  const safe = () => run().catch((err) => console.warn('[notificationEmail] queue', err));
  try {
    after(safe);
  } catch {
    void safe();
  }
}
