import { NextResponse, type NextRequest } from 'next/server';
import { getMessagingSession, loadThreadExtras, resolvePair } from '@/lib/messaging/server';

/**
 * GET /api/messages/extras?threadId=…
 *
 * Replies, pins, read receipts and attachments for one conversation. A Route Handler (like
 * /api/live) so it loads in parallel with the messages instead of queueing behind Server Actions.
 */
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const session = await getMessagingSession();
  if ('error' in session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const threadId = request.nextUrl.searchParams.get('threadId') ?? '';
  const pair = await resolvePair(session.db, threadId, session.user.id);
  if (!pair) return NextResponse.json({ data: { messages: {} } });

  try {
    const data = await loadThreadExtras(session.db, pair, session.user.id);
    return NextResponse.json({ data }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('[api/messages/extras]', err);
    return NextResponse.json({ error: 'Could not load conversation details.' }, { status: 500 });
  }
}
