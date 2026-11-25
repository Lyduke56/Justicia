'use server';

/**
 * Sign out from the confirmation modal (client, lawyer and admin portals). The browser shows the
 * landing page afterwards, so this action only ends the session and does not redirect.
 * "Sign out everywhere" stays in accountPrivacyActions.ts (signOutEverywhereAction).
 */
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { DEMO_COOKIE } from '@/lib/auth/demo';

/** Ends this browser's session only; other devices stay signed in. */
export async function signOutThisDeviceAction(): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    (await cookies()).delete(DEMO_COOKIE);
    // A session that was already gone still counts as signed out.
    if (error && error.status !== 401 && error.status !== 403) {
      return { success: false, error: 'We could not sign you out. Please try again.' };
    }
    return { success: true };
  } catch {
    return { success: false, error: 'We could not sign you out. Please try again.' };
  }
}
