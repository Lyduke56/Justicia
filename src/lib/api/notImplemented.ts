import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth/guards';

/**
 * Response for API routes that are reserved but not built. It never reports success (so no
 * caller can treat an unbuilt operation as done), requires a session, and never reads or logs the
 * request body.
 */
export async function notImplementedResponse(feature: string): Promise<NextResponse> {
  const headers = { 'Cache-Control': 'no-store' };
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers });
  return NextResponse.json(
    { error: `${feature} is not available through this API.` },
    { status: 501, headers }
  );
}
