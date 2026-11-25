import { NextResponse } from 'next/server';
import { headers } from 'next/headers';

/**
 * GET /api/health — liveness for uptime monitors. Reports only whether each dependency is
 * reachable or configured (never values, keys or counts), so it is safe to leave public.
 */
export const dynamic = 'force-dynamic';

async function databaseCheck(): Promise<'ok' | 'error'> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return 'error';
  try {
    const res = await fetch(`${url}/auth/v1/health`, { headers: { apikey: key }, signal: AbortSignal.timeout(3000), cache: 'no-store' });
    return res.ok ? 'ok' : 'error';
  } catch {
    return 'error';
  }
}

export async function GET() {
  const database = await databaseCheck();
  const checks = {
    database,
    email: process.env.RESEND_API_KEY ? 'configured' : 'missing',
    ai: process.env.GEMINI_API_KEY ? 'configured' : 'missing',
    cron: process.env.CRON_SECRET ? 'configured' : 'missing',
  };
  const status = database === 'ok' ? (Object.values(checks).includes('missing') ? 'degraded' : 'ok') : 'down';
  const requestId = (await headers()).get('x-request-id');
  return NextResponse.json(
    { status, checks, requestId, at: new Date().toISOString() },
    { status: status === 'down' ? 503 : 200, headers: { 'Cache-Control': 'no-store' } }
  );
}
