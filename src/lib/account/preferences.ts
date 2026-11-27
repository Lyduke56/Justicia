/**
 * Personal preferences, stored in Auth user_metadata.justicia_preferences.
 * Never use user-editable metadata for authorization; these only shape what the user sees.
 */

export type NotificationCategory = 'consultations' | 'payments' | 'messages' | 'reminders';

export const NOTIFICATION_CATEGORIES: readonly NotificationCategory[] = ['consultations', 'payments', 'messages', 'reminders'];

export type NotificationChoices = Record<NotificationCategory, boolean>;

export interface MessagingPrivacy {
  /** Don't send "typing…" (and don't see the other person's). */
  hideTyping: boolean;
  /** Don't send "Seen" receipts (and don't see the other person's). */
  hideReadReceipts: boolean;
}

export interface AccountPreferences {
  /** Kept for older callers: true when consultation updates are on. */
  consultationNotifications: boolean;
  notifications: NotificationChoices;
  messaging: MessagingPrivacy;
  /**
   * Also email the notifications whose category is on (and the consultation reminders).
   * Account standing and lawyer verification decisions are emailed whatever this says.
   */
  emailUpdates: boolean;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export function accountPreferences(metadata: Record<string, unknown> | undefined): AccountPreferences {
  const prefs = record(metadata?.justicia_preferences);
  const stored = record(prefs.notifications);
  // Before categories existed, one switch covered consultation, payment and meeting alerts.
  const legacyOn = prefs.consultationNotifications !== false;
  const pick = (key: NotificationCategory, fallback: boolean) =>
    typeof stored[key] === 'boolean' ? (stored[key] as boolean) : fallback;
  const notifications: NotificationChoices = {
    consultations: pick('consultations', legacyOn),
    payments: pick('payments', legacyOn),
    messages: pick('messages', true),
    reminders: pick('reminders', legacyOn),
  };
  const messaging = record(prefs.messaging);
  return {
    consultationNotifications: notifications.consultations,
    notifications,
    messaging: {
      hideTyping: messaging.hideTyping === true,
      hideReadReceipts: messaging.hideReadReceipts === true,
    },
    emailUpdates: prefs.emailUpdates !== false,
  };
}

/** Which category a notification type belongs to; null = always delivered (account, security, moderation). */
export function notificationCategory(type: string): NotificationCategory | null {
  if (type.startsWith('consultation_')) return 'consultations';
  if (type.startsWith('payment_')) return 'payments';
  if (type === 'new_message') return 'messages';
  if (type === 'meeting_starting' || type.startsWith('reminder_')) return 'reminders';
  return null;
}

/** Notices that are emailed even when email updates are off (account standing, lawyer verification). */
export function isMandatoryEmail(type: string): boolean {
  return type.startsWith('account_') || type.startsWith('lawyer_verification_');
}

/** Whether a notification of `type` should also be emailed to someone with these preferences. */
export function wantsEmailFor(prefs: AccountPreferences, type: string): boolean {
  if (isMandatoryEmail(type)) return true;
  if (!prefs.emailUpdates) return false;
  const category = notificationCategory(type);
  return category === null || prefs.notifications[category];
}

/** The value to store back into user_metadata.justicia_preferences. */
export function preferencesToMetadata(prefs: Omit<AccountPreferences, 'consultationNotifications'>) {
  return {
    consultationNotifications: prefs.notifications.consultations,
    notifications: { ...prefs.notifications },
    messaging: { ...prefs.messaging },
    emailUpdates: prefs.emailUpdates,
  };
}
