import { NextResponse } from 'next/server';
import { guardStatus, requireActiveAccount } from '@/lib/auth/guards';
import { EXTRAS_COLUMNS, buildExtras, type ExtrasRow } from '@/lib/consultations/extrasServer';
import type { ConsultationExtrasMap } from '@/lib/consultations/extras';

/**
 * GET /api/live/consultation-extras
 *
 * Attendance (Join presses, the client's join window, missed consultations) and cancellation
 * requests for every consultation the signed-in user is the client or the lawyer of, keyed by
 * consultation id. Read-only; the views merge it into the consultations they already load.
 * "Missed" is worked out with the server's clock. Responds 401 with no session.
 */
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'private, no-store' };

export async function GET(): Promise<NextResponse> {
  try {
    const { user, db } = await requireActiveAccount();
    const { data, error } = await db
      .from('consultations')
      .select(EXTRAS_COLUMNS)
      .or(`client_id.eq.${user.id},lawyer_id.eq.${user.id}`)
      .in('status', ['confirmed', 'completed', 'cancelled']);
    if (error) throw new Error(error.message);

    const now = Date.now();
    const map: ConsultationExtrasMap = {};
    for (const row of (data ?? []) as ExtrasRow[]) map[row.id] = buildExtras(row, user.id, now);
    return NextResponse.json({ data: map, now }, { headers: NO_STORE });
  } catch (err) {
    const status = guardStatus(err);
    if (status === 401) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
    if (status !== 500) return NextResponse.json({ error: 'Your account cannot load consultations right now.' }, { status, headers: NO_STORE });
    console.error('[api/live/consultation-extras]', err);
    return NextResponse.json({ error: 'Could not load consultation details.' }, { status: 500, headers: NO_STORE });
  }
}
