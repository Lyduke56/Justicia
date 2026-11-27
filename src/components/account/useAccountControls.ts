'use client';

/**
 * Shared logic for the account settings screens (client neumorphic page and the lawyer page):
 * notification categories, messaging privacy, sign out everywhere, legal consent, data export
 * and account deletion. Each screen keeps its own look; only the behaviour lives here.
 */
import { useCallback, useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { updateAccountPreferencesAction, type PersonalAccount } from '@/app/actions/accountActions';
import {
  acceptLegalTermsAction,
  getConsentStatusAction,
  requestAccountDeletionAction,
  signOutEverywhereAction,
} from '@/app/actions/accountPrivacyActions';
import type { MessagingPrivacy, NotificationCategory, NotificationChoices } from '@/lib/account/preferences';
import type { ConsentStatus } from '@/lib/legal';
import { leaveToLanding } from '@/lib/auth/leaving';
import { useScreenLoading } from '@/components/shared/loading/ScreenReadiness';

export const NOTIFICATION_ROWS: Array<{ key: NotificationCategory; title: string; description: string }> = [
  { key: 'consultations', title: 'Consultation updates', description: 'Requests, approvals, reschedules and cancellations.' },
  { key: 'payments', title: 'Payments', description: 'Proof of payment received, confirmed or declined.' },
  { key: 'messages', title: 'New messages', description: 'A bell alert when someone messages you.' },
  { key: 'reminders', title: 'Reminders', description: '24 hours, 1 hour and 15 minutes before a confirmed consultation.' },
];

export const PRIVACY_ROWS: Array<{ key: keyof MessagingPrivacy; title: string; description: string }> = [
  {
    key: 'hideTyping',
    title: 'Hide when I’m typing',
    description: 'The other person won’t see “typing…”. You also won’t see theirs.',
  },
  {
    key: 'hideReadReceipts',
    title: 'Hide read receipts',
    description: 'The other person won’t see “Seen” on their messages. You also won’t see it on yours.',
  },
];

/** Notification categories and messaging privacy, saved immediately and reverted on failure. */
export function usePreferenceToggles(account: PersonalAccount) {
  const router = useRouter();
  const [notifications, setNotifications] = useState<NotificationChoices>(account.notifications);
  const [messaging, setMessaging] = useState<MessagingPrivacy>(account.messaging);
  const [saving, startSaving] = useTransition();
  const [error, setError] = useState('');
  const [savedTick, setSavedTick] = useState(0);

  useEffect(() => {
    if (!savedTick) return;
    const t = window.setTimeout(() => setSavedTick(0), 2400);
    return () => window.clearTimeout(t);
  }, [savedTick]);

  const save = (
    patch: { notifications?: Partial<NotificationChoices>; messaging?: Partial<MessagingPrivacy> },
    revert: () => void
  ) => {
    setError('');
    setSavedTick(0);
    startSaving(async () => {
      try {
        const result = await updateAccountPreferencesAction(patch);
        if (!result.success) {
          revert();
          setError(result.error);
          return;
        }
        setSavedTick(Date.now());
        router.refresh();
      } catch {
        revert();
        setError('Unable to save preferences. Please try again.');
      }
    });
  };

  const toggleNotification = (key: NotificationCategory, next: boolean) => {
    const previous = notifications[key];
    setNotifications((n) => ({ ...n, [key]: next }));
    save({ notifications: { [key]: next } }, () => setNotifications((n) => ({ ...n, [key]: previous })));
  };

  const toggleMessaging = (key: keyof MessagingPrivacy, next: boolean) => {
    const previous = messaging[key];
    setMessaging((m) => ({ ...m, [key]: next }));
    save({ messaging: { [key]: next } }, () => setMessaging((m) => ({ ...m, [key]: previous })));
  };

  return { notifications, messaging, saving, error, setError, savedTick, toggleNotification, toggleMessaging };
}

export function useSignOutEverywhere() {
  const [pending, start] = useTransition();
  const [error, setError] = useState('');
  const run = () =>
    start(async () => {
      setError('');
      const res = await signOutEverywhereAction();
      if (!res.success) setError(res.error);
      // Full reload to the landing page: no signed-in state may survive.
      else leaveToLanding();
    });
  return { pending, error, run };
}

export function useConsent() {
  const [consent, setConsent] = useState<ConsentStatus | null>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState('');
  // The Settings screen's loading screen waits for the consent status.
  const [checked, setChecked] = useState(false);
  useScreenLoading(!checked);
  useEffect(() => {
    let cancelled = false;
    getConsentStatusAction()
      .then((res) => {
        if (!cancelled && res.success) setConsent(res.consent);
      })
      .catch(() => undefined)
      .finally(() => !cancelled && setChecked(true));
    return () => {
      cancelled = true;
    };
  }, []);
  const accept = () =>
    start(async () => {
      setError('');
      const res = await acceptLegalTermsAction();
      if (!res.success) setError(res.error);
      else setConsent(res.consent);
    });
  /** Same as accept, but answers with the result (for the submission card). */
  const acceptAndReport = async (): Promise<{ ok: true } | { ok: false; error: string }> => {
    try {
      const res = await acceptLegalTermsAction();
      if (!res.success) return { ok: false, error: res.error };
      setConsent(res.consent);
      return { ok: true };
    } catch {
      return { ok: false, error: 'Your acceptance could not be saved. Please try again.' };
    }
  };
  return { consent, pending, error, accept, acceptAndReport };
}

export function formatConsentDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });
}

/** Fetches /api/account/export and saves it as a file; answers with what happened. */
export async function downloadMyData(): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await fetch('/api/account/export', { cache: 'no-store' });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      return { ok: false, error: body?.error ?? 'Your data could not be exported. Please try again.' };
    }
    const blob = await res.blob();
    const name = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') ?? '')?.[1] ?? 'justicia-my-data.json';
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return { ok: true };
  } catch {
    return { ok: false, error: 'Your data could not be exported. Check your connection and try again.' };
  }
}

/** Downloads /api/account/export as a file. */
export function useDataExport() {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const run = useCallback(async () => {
    setPending(true);
    setMessage(null);
    const result = await downloadMyData();
    setMessage(result.ok ? { ok: true, text: 'Your data was downloaded as a JSON file.' } : { ok: false, text: result.error });
    setPending(false);
  }, []);
  return { pending, message, run, clear: () => setMessage(null) };
}

export function useDeleteAccount() {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [pending, start] = useTransition();
  const [error, setError] = useState('');
  const ready = password.length > 0 && confirmation === 'DELETE';
  const reset = () => {
    setOpen(false);
    setPassword('');
    setConfirmation('');
    setError('');
  };
  const submit = () =>
    start(async () => {
      setError('');
      const res = await requestAccountDeletionAction({ password, confirmation });
      if (!res.success) {
        setError(res.error);
        return;
      }
      leave();
    });
  /** Same as submit, but answers with the result and does not leave yet (for the submission card). */
  const request = async (): Promise<{ ok: true } | { ok: false; error: string }> => {
    try {
      const res = await requestAccountDeletionAction({ password, confirmation });
      return res.success ? { ok: true } : { ok: false, error: res.error };
    } catch {
      return { ok: false, error: 'Your request could not be sent. Please try again.' };
    }
  };
  return { open, setOpen, password, setPassword, confirmation, setConfirmation, pending, error, ready, reset, submit, request, leave };
}

/** After a deletion request: full reload to sign-in, so no signed-in state survives. */
function leave() {
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- full reload: no signed-in state may survive
  window.location.assign('/login');
}
