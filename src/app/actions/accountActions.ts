'use server';

import { revalidatePath } from 'next/cache';
import { createClient as createAuthClient, type SupabaseClient } from '@supabase/supabase-js';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { checkAccountAccess, signalUsers } from '@/lib/moderation/accountStatus';
import {
  accountPreferences,
  NOTIFICATION_CATEGORIES,
  preferencesToMetadata,
  type MessagingPrivacy,
  type NotificationChoices,
} from '@/lib/account/preferences';
import type { UserRole } from '@/types/database';

export type AccountResult = { success: true; message: string } | { success: false; error: string };
export interface PersonalAccount {
  fullName: string;
  email: string;
  phone: string;
  role: UserRole;
  emailVerified: boolean;
  consultationNotifications: boolean;
  notifications: NotificationChoices;
  messaging: MessagingPrivacy;
}

async function accountSession() {
  const auth = await createClient();
  const { data: { user }, error } = await auth.auth.getUser();
  if (error || !user) throw new Error('Please sign in to manage your account.');
  // The deployed profiles schema is newer than the hand-authored Database type.
  const db = await createServiceClient() as unknown as SupabaseClient;
  const { data: account, error: accountError } = await db.from('user_accounts')
    .select('full_name,phone,role').eq('id', user.id).maybeSingle();
  const { data: profile, error: profileError } = await db.from('profiles')
    .select('full_name,phone,role').eq('user_id', user.id).maybeSingle();
  if (accountError || profileError) throw new Error('Unable to load your account. Please try again.');
  const role = account?.role ?? profile?.role;
  if (!['client', 'lawyer', 'admin'].includes(role)) throw new Error('Your account role could not be verified.');
  const blocked = await checkAccountAccess(db, user.id);
  if (blocked) throw new Error(blocked);
  return { auth, db, user, account, profile, role: role as UserRole };
}

function refreshAccount(userId: string) {
  revalidatePath('/client', 'layout');
  revalidatePath('/lawyer', 'layout');
  revalidatePath('/admin', 'layout');
  revalidatePath(`/lawyers/${userId}`);
  revalidatePath(`/client/lawyers/${userId}`);
}

export async function getPersonalAccountAction(): Promise<
  { success: true; account: PersonalAccount } | { success: false; error: string }
> {
  try {
    const { user, account, profile, role } = await accountSession();
    return { success: true, account: {
      fullName: account?.full_name ?? profile?.full_name ?? user.user_metadata?.full_name ?? '',
      phone: profile?.phone ?? account?.phone ?? '',
      email: user.email ?? '', role, emailVerified: Boolean(user.email_confirmed_at),
      ...accountPreferences(user.user_metadata),
    } };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unable to load your account.' };
  }
}

export async function updatePersonalAccountAction(input: { fullName: string; phone: string }): Promise<AccountResult> {
  let changed = false;
  let userId: string | undefined;
  try {
    const { db, auth, user, account, profile, role } = await accountSession();
    userId = user.id;
    const fullName = typeof input?.fullName === 'string' ? input.fullName.trim() : '';
    const phone = typeof input?.phone === 'string' ? input.phone.trim() : '';
    if (!fullName || fullName.length > 120 || /[\u0000-\u001f]/.test(fullName)) {
      return { success: false, error: 'Enter your full name (up to 120 characters).' };
    }
    if (phone && (!/^[+\d()\s-]{7,30}$/.test(phone) || phone.replace(/\D/g, '').length < 7 || phone.replace(/\D/g, '').length > 15)) {
      return { success: false, error: 'Enter a valid contact number, or leave it blank.' };
    }
    if (role === 'lawyer' && fullName !== (account?.full_name ?? profile?.full_name ?? user.user_metadata?.full_name ?? '')) {
      return { success: false, error: 'Lawyer legal-name changes require credential verification. Please contact support.' };
    }
    // Only whitelisted personal fields; IDs, role, email, verification and moderation cannot be edited.
    // Update all existing identity records. Never invent a role or create privileged account rows.
    for (const [table, key, exists, values] of [
      ['user_accounts', 'id', Boolean(account), { full_name: fullName, phone: phone || null }],
      ['profiles', 'user_id', Boolean(profile), { full_name: fullName, phone: phone || null }],
    ] as const) {
      if (!exists) continue;
      const { data, error } = await db.from(table).update(values).eq(key, user.id).select(key).maybeSingle();
      if (error || !data) throw new Error('Unable to update your profile. Please try again.');
      changed = true;
    }
    const { error } = await auth.auth.updateUser({ data: { full_name: fullName } });
    if (error) throw new Error('Unable to update your account name. Please try again.');
    refreshAccount(user.id);
    return { success: true, message: 'Your profile has been saved.' };
  } catch (error) {
    if (changed && userId) refreshAccount(userId);
    return { success: false, error: changed
      ? 'Some profile details were saved, but we could not synchronize your account. Please retry Save changes.'
      : error instanceof Error ? error.message : 'Unable to save your profile. Please try again.' };
  }
}

export interface AccountPreferencesInput {
  /** Older single switch: consultation, payment and reminder alerts together. */
  consultationNotifications?: boolean;
  notifications?: Partial<NotificationChoices>;
  messaging?: Partial<MessagingPrivacy>;
}

export async function updateAccountPreferencesAction(input: AccountPreferencesInput): Promise<AccountResult> {
  try {
    const { auth, user } = await accountSession();
    const isBool = (v: unknown) => typeof v === 'boolean';
    const legacy = input?.consultationNotifications;
    const notifications = input?.notifications && typeof input.notifications === 'object' ? input.notifications : undefined;
    const messaging = input?.messaging && typeof input.messaging === 'object' ? input.messaging : undefined;
    if (legacy === undefined && !notifications && !messaging) return { success: false, error: 'Invalid notification preference.' };
    if (legacy !== undefined && !isBool(legacy)) return { success: false, error: 'Invalid notification preference.' };
    if (notifications && Object.entries(notifications).some(([k, v]) => !(NOTIFICATION_CATEGORIES as readonly string[]).includes(k) || !isBool(v))) {
      return { success: false, error: 'Invalid notification preference.' };
    }
    if (messaging && Object.entries(messaging).some(([k, v]) => !['hideTyping', 'hideReadReceipts'].includes(k) || !isBool(v))) {
      return { success: false, error: 'Invalid messaging preference.' };
    }

    const current = accountPreferences(user.user_metadata);
    const nextNotifications = { ...current.notifications, ...(notifications ?? {}) };
    if (isBool(legacy)) {
      nextNotifications.consultations = legacy as boolean;
      nextNotifications.payments = legacy as boolean;
      nextNotifications.reminders = legacy as boolean;
    }
    const nextMessaging = { ...current.messaging, ...(messaging ?? {}) };
    const { error } = await auth.auth.updateUser({ data: {
      justicia_preferences: preferencesToMetadata({ notifications: nextNotifications, messaging: nextMessaging }),
    } });
    if (error) return { success: false, error: 'Unable to save preferences. Please try again.' };
    signalUsers([user.id], ['notifications']);
    refreshAccount(user.id);
    return { success: true, message: 'Your preferences have been saved.' };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unable to save preferences.' };
  }
}

export async function changeAccountPasswordAction(input: { currentPassword: string; password: string; confirmPassword: string }): Promise<AccountResult> {
  try {
    const { auth, user } = await accountSession();
    if (typeof input?.currentPassword !== 'string' || !input.currentPassword || input.currentPassword.length > 256) {
      return { success: false, error: 'Enter your current password.' };
    }
    if (typeof input.password !== 'string' || input.password.length < 8 || input.password.length > 256) {
      return { success: false, error: 'Your new password must contain 8 to 256 characters.' };
    }
    if (input.password !== input.confirmPassword) return { success: false, error: 'The new passwords do not match.' };
    if (input.password === input.currentPassword) return { success: false, error: 'Choose a different new password.' };
    // Verify the current password even when the project's optional Supabase password check is off.
    // Use a separate client so a failed check never replaces the browser's session cookies.
    const verifier = createAuthClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const verified = await verifier.auth.signInWithPassword({ email: user.email ?? '', password: input.currentPassword });
    if (verified.error || verified.data.user?.id !== user.id) {
      return { success: false, error: 'Your current password is incorrect, or sign-in is temporarily unavailable.' };
    }
    try {
      const { error } = await auth.auth.updateUser({ password: input.password, current_password: input.currentPassword });
      if (error) return { success: false, error: 'Password could not be changed. Try again, or use Forgot password.' };
    } finally {
      await verifier.auth.signOut({ scope: 'local' }).catch(() => undefined);
    }
    return { success: true, message: 'Your password has been changed.' };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unable to change your password.' };
  }
}
