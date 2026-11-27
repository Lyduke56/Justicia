'use server';

/**
 * Bell notifications: marking them read (new code; the bell still loads through
 * getUserNotificationsAction). Sets notifications.is_read on the signed-in user's own rows, so a
 * clicked notification stays read on every device and after reloading.
 */
import { after } from 'next/server';
import { guardMessage, requireActiveAccount } from '@/lib/auth/guards';
import { emitLive } from '@/lib/realtime/live';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_IDS = 100;

/** Marks the given notifications (or all of them, with 'all') as read. */
export async function markNotificationsReadAction(
  ids: string[] | 'all'
): Promise<{ success: true; updated: number } | { success?: false; error: string }> {
  try {
    const list = ids === 'all' ? null : Array.isArray(ids) ? [...new Set(ids.filter((id) => UUID_RE.test(id ?? '')))].slice(0, MAX_IDS) : [];
    if (list && list.length === 0) return { success: true, updated: 0 };

    const { user, db } = await requireActiveAccount();
    let query = db.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false);
    if (list) query = query.in('id', list);
    const { data, error } = await query.select('id');
    if (error) {
      console.error('[markNotificationsReadAction]', error.message);
      return { error: 'Could not update your notifications.' };
    }
    const updated = data?.length ?? 0;
    // The user's other open tabs and devices refresh their bell.
    if (updated > 0) {
      try {
        after(() => emitLive([user.id], ['notifications']));
      } catch {
        void emitLive([user.id], ['notifications']);
      }
    }
    return { success: true, updated };
  } catch (err) {
    return { error: guardMessage(err, 'Could not update your notifications.') };
  }
}
