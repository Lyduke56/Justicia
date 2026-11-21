/**
 * Client-side loader for the portal tabs (GET /api/live).
 *
 * Use this instead of calling the read-only server actions from useEffect:
 * Next.js runs Server Actions one at a time per client, so several tabs (plus
 * background polling) loading at once would queue behind each other. Plain
 * GET requests run in parallel. Identical in-flight requests are shared.
 */
import type {
  ClientConsultation,
  DocumentFolderItem,
  LawyerConsultation,
  LawyerEarningsData,
  MessageThreadItem,
  PaymentChannel,
  ThreadContext,
  ThreadMessage,
  getUserNotificationsAction,
} from '@/app/actions/consultationActions';

export interface LiveResources {
  'lawyer-consultations': LawyerConsultation[];
  'lawyer-earnings': { success: true; data: LawyerEarningsData } | { success?: false; error: string };
  'client-consultations': ClientConsultation[];
  threads: MessageThreadItem[];
  'thread-messages': ThreadMessage[];
  'thread-context': ThreadContext;
  documents: DocumentFolderItem[];
  notifications: Awaited<ReturnType<typeof getUserNotificationsAction>>;
  'payment-channel': PaymentChannel;
}

const inflight = new Map<string, Promise<unknown>>();

export function fetchLive<K extends keyof LiveResources>(
  resource: K,
  params: Record<string, string> = {}
): Promise<LiveResources[K]> {
  const query = new URLSearchParams({ resource, ...params }).toString();
  const existing = inflight.get(query);
  if (existing) return existing as Promise<LiveResources[K]>;

  const request = fetch(`/api/live?${query}`, {
    cache: 'no-store',
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
  })
    .then(async (res) => {
      const body = (await res.json().catch(() => null)) as { data?: unknown; error?: string } | null;
      if (!res.ok || !body || !('data' in body)) {
        throw new Error(body?.error || `Request failed (${res.status})`);
      }
      return body.data as LiveResources[K];
    })
    .finally(() => inflight.delete(query));

  inflight.set(query, request);
  return request;
}
