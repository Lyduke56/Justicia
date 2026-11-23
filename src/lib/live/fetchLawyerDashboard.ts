/**
 * Client loader for GET /api/live/lawyer-dashboard (see that route for the contract).
 * Resolves null when there is no session (signed-out demo preview); throws on other errors.
 * Identical in-flight requests are shared, like fetchLive.
 */
import type { DateRange, LawyerDashboardStats, LawyerScheduleData } from '@/lib/lawyer/dashboardSchedule';

const inflight = new Map<string, Promise<unknown>>();

function request<T>(params: Record<string, string>): Promise<T | null> {
  const query = new URLSearchParams(params).toString();
  const existing = inflight.get(query);
  if (existing) return existing as Promise<T | null>;

  const pending = fetch(`/api/live/lawyer-dashboard?${query}`, {
    cache: 'no-store',
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
  })
    .then(async (res) => {
      const body = (await res.json().catch(() => null)) as { data?: T; error?: string } | null;
      if (res.status === 401) return null;
      if (!res.ok || !body || !('data' in body)) throw new Error(body?.error || `Request failed (${res.status})`);
      return body.data as T;
    })
    .finally(() => inflight.delete(query));

  inflight.set(query, pending);
  return pending;
}

export function fetchLawyerSchedule(range: DateRange): Promise<LawyerScheduleData | null> {
  return request<LawyerScheduleData>({ view: 'schedule', from: range.from, to: range.to });
}

export function fetchLawyerDashboardStats(): Promise<LawyerDashboardStats | null> {
  return request<LawyerDashboardStats>({ view: 'stats' });
}
