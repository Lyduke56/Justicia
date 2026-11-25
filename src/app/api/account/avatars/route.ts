import { NextResponse, type NextRequest } from 'next/server';
import { guardStatus, requireUser } from '@/lib/auth/guards';
import { counterpartIds, readAvatars } from '@/lib/account/avatar';

/**
 * GET /api/account/avatars?ids=<uuid>,<uuid>
 *
 * Profile photos by user id, for the signed-in user and the people they have a consultation
 * with (Messages, consultation cards). Ids outside that circle are ignored. Without `ids`, only
 * the signed-in user's own photo is returned (top bar, account pages). Responds 401 signed out.
 */
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'private, no-store' };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { user, db } = await requireUser();
    const requested = (request.nextUrl.searchParams.get('ids') ?? '')
      .split(',')
      .map((id) => id.trim())
      .filter((id) => UUID.test(id))
      .slice(0, 200);
    let allowed = [user.id];
    if (requested.some((id) => id !== user.id)) {
      const circle = new Set(await counterpartIds(db, user.id));
      allowed = [user.id, ...requested.filter((id) => circle.has(id))];
    }
    const photos = await readAvatars(db, allowed);
    return NextResponse.json({ data: { me: photos[user.id] ?? null, photos } }, { headers: NO_STORE });
  } catch (err) {
    const status = guardStatus(err);
    if (status !== 500) return NextResponse.json({ error: 'Unauthorized' }, { status, headers: NO_STORE });
    console.error('[api/account/avatars]', err);
    return NextResponse.json({ error: 'Could not load profile photos.' }, { status: 500, headers: NO_STORE });
  }
}
