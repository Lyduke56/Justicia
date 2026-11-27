import { NextResponse, type NextRequest } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServiceClient } from '@/lib/supabase/server';
import { runReminderSweep } from '@/lib/email/reminderSweep';

/**
 * Consultation reminders and "request still pending" nudges, in-app and by email
 * (lib/email/reminderSweep.ts). Call it every 5 minutes with `Authorization: Bearer $CRON_SECRET`
 * from an external scheduler (see OPERATIONS.md). Vercel's Hobby plan only runs its own cron jobs
 * once a day, so this one is not in vercel.json. Anything without the secret is refused, so the
 * route is safe to leave public in the proxy.
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

async function handle(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const db = (await createServiceClient()) as unknown as SupabaseClient;
    const result = await runReminderSweep(db);
    return NextResponse.json({ ok: true, ...result }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('[cron consultation-reminders]', err);
    return NextResponse.json({ ok: false, error: 'Sweep failed' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}

export const GET = handle;
export const POST = handle;
