import { NextResponse, type NextRequest } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServiceClient } from '@/lib/supabase/server';
import { purgeDueAccounts } from '@/lib/account/deletion';

/**
 * Daily Vercel Cron job (vercel.json): erases accounts whose 7-day deletion window has passed.
 * Vercel sends `Authorization: Bearer $CRON_SECRET`; anything else is refused, so the route is
 * safe to leave public in the proxy.
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(request.headers.get('authorization') ?? '');
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const db = (await createServiceClient()) as unknown as SupabaseClient;
  const result = await purgeDueAccounts(db);
  return NextResponse.json({ ok: result.failed === 0, ...result }, { headers: { 'Cache-Control': 'no-store' } });
}
