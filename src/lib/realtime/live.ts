/**
 * Live updates (server side).
 *
 * After a mutation, the server sends a tiny "refresh" signal over Supabase
 * Realtime Broadcast to every affected user. Open tabs listen on their own
 * topic and silently re-fetch the scopes that changed — no polling.
 *
 * - The signal carries only scope names, never data. Views re-fetch through
 *   the authenticated /api/live endpoint, so RLS / session checks still apply.
 * - Each user's topic is an HMAC of their id with a server secret, so other
 *   users cannot guess it to listen in or send fake refreshes.
 * - Sending never throws and never blocks the caller for long; if Realtime is
 *   unreachable, the client's focus / reconnect refresh keeps data current.
 *
 * Server-only: imports node:crypto and reads the service-role key.
 */
import { createHmac } from 'node:crypto';

export type LiveScope =
  | 'consultations'
  | 'payments'
  | 'messages'
  | 'documents'
  | 'notifications'
  | 'reviews'
  /** The account's sessions changed (signed out everywhere, suspended): open tabs re-check. */
  | 'session';

const SEND_TIMEOUT_MS = 2500;

function topicSecret(): string {
  return process.env.REALTIME_TOPIC_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
}

/** The private Realtime topic for a user (only the server can compute it). */
export function liveTopicFor(userId: string): string | null {
  const secret = topicSecret();
  if (!secret || !userId) return null;
  return `live-${createHmac('sha256', secret).update(`justicia-live:${userId}`).digest('hex').slice(0, 40)}`;
}

/** Broadcasts a refresh signal for `scopes` to each user. Best effort; never throws. */
export async function emitLive(userIds: Array<string | null | undefined>, scopes: LiveScope[]): Promise<void> {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key || scopes.length === 0) return;

    const topics = [...new Set(userIds.filter((id): id is string => !!id))]
      .map(liveTopicFor)
      .filter((t): t is string => !!t);
    if (topics.length === 0) return;

    const payload = { scopes: [...new Set(scopes)], at: Date.now() };
    const res = await fetch(`${url}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: topics.map((topic) => ({ topic, event: 'refresh', payload, private: false })),
      }),
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    });
    if (!res.ok) console.warn('[emitLive] broadcast failed', res.status);
  } catch (err) {
    console.warn('[emitLive] broadcast error', err instanceof Error ? err.message : err);
  }
}
