'use server';

/**
 * The admin bell (new code). Admins' notifications are created from recent audit_log events
 * when the bell loads (see src/lib/admin/notificationsFeed.ts); reading them works like the
 * client / lawyer bell (markNotificationsReadAction).
 */
import { guardMessage, requireRole } from '@/lib/auth/guards';
import { ensureAdminNotifications } from '@/lib/admin/notificationsFeed';

export interface AdminNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  created_at: string;
  is_read: boolean;
  metadata: { eventKey?: string; href?: string } | null;
}

export async function getAdminNotificationsAction(): Promise<
  { success: true; notifications: AdminNotification[] } | { success?: false; error: string }
> {
  try {
    const { user, db } = await requireRole('admin');
    await ensureAdminNotifications(db, user.id);
    const { data, error } = await db
      .from('notifications')
      .select('id, type, title, body, created_at, is_read, metadata')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);
    if (error) {
      console.error('[getAdminNotificationsAction]', error.message);
      return { error: 'Notifications could not be loaded.' };
    }
    return { success: true, notifications: (data ?? []) as AdminNotification[] };
  } catch (err) {
    return { error: guardMessage(err, 'Notifications could not be loaded.') };
  }
}
