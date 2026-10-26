/**
 * Notification service — creates in-app notifications.
 * SERVER-SIDE ONLY.
 */

import { createServiceClient } from '@/lib/supabase/server';

interface CreateNotificationParams {
  userId: string;
  type: string;
  title: string;
  body: string;
  metadata?: Record<string, unknown>;
}

export async function createNotification(params: CreateNotificationParams): Promise<void> {
  try {
    const supabase = await createServiceClient();
    await supabase.from('notifications').insert({
      user_id: params.userId,
      type: params.type,
      title: params.title,
      body: params.body,
      metadata: params.metadata ?? null,
      is_read: false,
    });
  } catch (err) {
    console.error('[Notifications] Failed to create notification:', err);
  }
}

export async function writeAuditLog(params: {
  actorId: string;
  action: string;
  targetType: string;
  targetId: string;
  details?: Record<string, unknown>;
}): Promise<void> {
  try {
    const supabase = await createServiceClient();
    await supabase.from('audit_log').insert({
      actor_id: params.actorId,
      action: params.action,
      target_type: params.targetType,
      target_id: params.targetId,
      details: params.details ?? null,
    });
  } catch (err) {
    console.error('[AuditLog] Failed to write audit log:', err);
  }
}
