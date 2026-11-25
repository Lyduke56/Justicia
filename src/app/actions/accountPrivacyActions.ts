'use server';

/**
 * Privacy and session controls for the signed-in user:
 *  - sign out everywhere (every device and browser),
 *  - legal consent (Terms, Privacy Policy, AI disclaimer),
 *  - delete my account (7-day undo window) and restore it.
 * Data export is a Route Handler (GET /api/account/export) so the browser can download a file.
 */
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { guardMessage, requireActiveAccount, requireUser, verifyPassword } from '@/lib/auth/guards';
import { readDatabaseRole } from '@/lib/auth/roles';
import { DEMO_COOKIE } from '@/lib/auth/demo';
import { checkRateLimit, clientIp } from '@/lib/security/rateLimit';
import { emitLive } from '@/lib/realtime/live';
import { ensureProfileRow } from '@/lib/moderation/accountStatus';
import { readConsent, recordConsent, LEGAL_VERSION, type ConsentStatus } from '@/lib/legal';
import { deletionDueAt, restoreAccount, scheduleDeletion, upcomingConsultationCount } from '@/lib/account/deletion';
import { sendEmail } from '@/lib/integrations/email';
import { renderEmailHtml } from '@/lib/email/layout';
import { DELETION_GRACE_DAYS, SUPPORT_EMAIL } from '@/lib/support';
import { getDashboardForRole } from '@/lib/utils/rbac';

type Result<T = object> = ({ success: true } & T) | { success: false; error: string };

function manilaDate(iso: string): string {
  return new Date(iso).toLocaleString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'long', timeStyle: 'short' });
}

// ─── Sign out everywhere ─────────────────────────────────────────────────────

/**
 * Ends every session of this account (laptop, phone, other browsers). Their next request is
 * refused by Supabase Auth, and open Justicia tabs are told to leave right away.
 */
export async function signOutEverywhereAction(): Promise<Result> {
  try {
    const { user } = await requireUser();
    const supabase = await createClient();
    const { error } = await supabase.auth.signOut({ scope: 'global' });
    if (error) return { success: false, error: 'We could not sign you out everywhere. Please try again.' };
    (await cookies()).delete(DEMO_COOKIE);
    await emitLive([user.id], ['session']);
    return { success: true };
  } catch (err) {
    return { success: false, error: guardMessage(err, 'We could not sign you out everywhere. Please try again.') };
  }
}

// ─── Legal consent ───────────────────────────────────────────────────────────

export async function getConsentStatusAction(): Promise<Result<{ consent: ConsentStatus; version: string }>> {
  try {
    const { user, db } = await requireUser();
    return { success: true, consent: await readConsent(db, user.id), version: LEGAL_VERSION };
  } catch (err) {
    return { success: false, error: guardMessage(err, 'Consent details could not be loaded.') };
  }
}

/** Records acceptance of the current Terms, Privacy Policy and AI disclaimer. */
export async function acceptLegalTermsAction(): Promise<Result<{ consent: ConsentStatus }>> {
  try {
    const { user, db } = await requireActiveAccount();
    if (!(await ensureProfileRow(db, user.id))) return { success: false, error: 'Your account profile could not be found.' };
    if (!(await recordConsent(db, user.id, await clientIp()))) {
      return { success: false, error: 'Your acceptance could not be saved. Please try again.' };
    }
    return { success: true, consent: await readConsent(db, user.id) };
  } catch (err) {
    return { success: false, error: guardMessage(err, 'Your acceptance could not be saved.') };
  }
}

// ─── Delete my account ───────────────────────────────────────────────────────

/**
 * Schedules the account for deletion. Requires the current password and typing DELETE, and is
 * refused while the user has upcoming consultations. Signs the account out everywhere.
 */
export async function requestAccountDeletionAction(input: { password: string; confirmation: string }): Promise<Result<{ dueAt: string }>> {
  try {
    const { user, db } = await requireActiveAccount();
    if (input?.confirmation !== 'DELETE') return { success: false, error: 'Type DELETE in capital letters to confirm.' };
    const limited = await checkRateLimit('account_sensitive', user.id);
    if (limited) return { success: false, error: limited };
    if (!(await verifyPassword(user, input?.password))) return { success: false, error: 'Your password is incorrect.' };

    const role = await readDatabaseRole(db, user.id);
    if (role === 'admin') {
      return { success: false, error: 'Administrator accounts can’t be deleted here. Ask another administrator to change your role first.' };
    }
    const upcoming = await upcomingConsultationCount(db, user.id);
    if (upcoming > 0) {
      return {
        success: false,
        error: `You have ${upcoming} upcoming consultation${upcoming === 1 ? '' : 's'}. Cancel ${upcoming === 1 ? 'it' : 'them'}, or wait until ${upcoming === 1 ? 'it is' : 'they are'} finished, before deleting your account.`,
      };
    }
    if (!(await ensureProfileRow(db, user.id))) return { success: false, error: 'Your account profile could not be found.' };

    const { dueAt } = await scheduleDeletion(db, user.id);

    if (user.email) {
      const when = manilaDate(dueAt);
      const deletionEmail = {
        preheader: `Your Justicia account will be erased on ${when} (PHT) unless you restore it.`,
        heading: 'Account scheduled for deletion',
        paragraphs: [
          `You asked us to delete your Justicia account. Your personal data will be erased on **${when} (PHT)**.`,
          'Changed your mind? Sign in before then and choose **Restore my account**.',
        ],
        footerNote: `If you did not ask for this, sign in and restore your account, then change your password, or write to ${SUPPORT_EMAIL}.`,
      };
      await sendEmail({
        to: user.email,
        subject: 'Your Justicia account is scheduled for deletion',
        html: renderEmailHtml(deletionEmail),
        text: `You asked us to delete your Justicia account. Your personal data will be erased on ${when} (PHT). Sign in before then and choose "Restore my account" to keep it.`,
      }).catch(() => undefined);
    }

    const supabase = await createClient();
    await supabase.auth.signOut({ scope: 'global' });
    await emitLive([user.id], ['session']);
    return { success: true, dueAt };
  } catch (err) {
    return { success: false, error: guardMessage(err, err instanceof Error ? err.message : 'Your account could not be scheduled for deletion.') };
  }
}

export async function getDeletionStatusAction(): Promise<Result<{ pending: boolean; dueAt: string | null; graceDays: number }>> {
  try {
    const { user, db } = await requireUser();
    const { data } = await db.from('profiles').select('account_status, deletion_requested_at').eq('user_id', user.id).maybeSingle();
    const pending = data?.account_status === 'pending_deletion' && !!data.deletion_requested_at;
    return {
      success: true,
      pending,
      dueAt: pending ? deletionDueAt(data!.deletion_requested_at!).toISOString() : null,
      graceDays: DELETION_GRACE_DAYS,
    };
  } catch (err) {
    return { success: false, error: guardMessage(err, 'Could not load your account.') };
  }
}

/** Cancels a pending deletion during the undo window and returns where to go next. */
export async function restoreAccountAction(): Promise<Result<{ redirectTo: string }>> {
  try {
    const { user, db } = await requireUser();
    const restored = await restoreAccount(db, user.id);
    if (!restored) {
      return { success: false, error: 'This account can no longer be restored. Contact support if you need help.' };
    }
    // Pick up the cleared account_status claim in this browser's session.
    const supabase = await createClient();
    await supabase.auth.refreshSession().catch(() => undefined);
    const role = (await readDatabaseRole(db, user.id)) ?? 'client';
    return { success: true, redirectTo: getDashboardForRole(role) };
  } catch (err) {
    return { success: false, error: guardMessage(err, 'Your account could not be restored.') };
  }
}
