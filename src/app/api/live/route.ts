import { NextResponse, type NextRequest } from 'next/server';
import {
  getClientConsultationsAction,
  getLawyerConsultationsAction,
  getLawyerEarningsAction,
  getMessageThreadsAction,
  getMessagesForThreadAction,
  getPaymentChannelAction,
  getThreadContextAction,
  getUserDocumentsDataAction,
  getUserNotificationsAction,
} from '@/app/actions/consultationActions';

/**
 * GET /api/live?resource=<name>[&threadId=…][&role=client|lawyer]
 *
 * Read-only loaders for the portal tabs. They reuse the same functions as the
 * server actions (each resolves and checks the signed-in user itself), but a
 * Route Handler lets the browser load several tabs IN PARALLEL — Next.js runs
 * Server Actions one at a time per client, which made every tab wait behind
 * the others and behind background polling.
 */
export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Loader = (params: URLSearchParams) => Promise<unknown> | null;

const role = (params: URLSearchParams) => (params.get('role') === 'lawyer' ? 'lawyer' : 'client');
const threadId = (params: URLSearchParams) => {
  const id = params.get('threadId') ?? '';
  return UUID.test(id) ? id : null;
};

// A Map, not an object literal, so names like "constructor" / "__proto__"
// can never resolve to inherited properties.
const LOADERS = new Map<string, Loader>(Object.entries({
  'lawyer-consultations': () => getLawyerConsultationsAction(),
  'lawyer-earnings': () => getLawyerEarningsAction(),
  'client-consultations': () => getClientConsultationsAction(),
  threads: () => getMessageThreadsAction(),
  'thread-messages': (p) => {
    const id = threadId(p);
    return id ? getMessagesForThreadAction(id) : null;
  },
  'thread-context': (p) => {
    const id = threadId(p);
    return id ? getThreadContextAction(id) : null;
  },
  documents: (p) => getUserDocumentsDataAction(role(p)),
  notifications: (p) => getUserNotificationsAction(role(p)),
  'payment-channel': () => getPaymentChannelAction(),
} satisfies Record<string, Loader>));

export async function GET(request: NextRequest): Promise<NextResponse> {
  const params = request.nextUrl.searchParams;
  const loader = LOADERS.get(params.get('resource') ?? '');
  const pending = loader?.(params);
  if (!pending) {
    return NextResponse.json({ error: 'Unknown or invalid resource.' }, { status: 400 });
  }
  try {
    const data = await pending;
    return NextResponse.json({ data }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (err) {
    console.error('[api/live]', params.get('resource'), err);
    return NextResponse.json({ error: 'Could not load data.' }, { status: 500 });
  }
}
