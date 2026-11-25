import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/security/rateLimit';

/** Largest AI request body accepted (chat history plus an attached document's text). */
const MAX_BODY_BYTES = 200_000;

/**
 * Shared guard for the public AI endpoints: refuses oversized bodies (413) and callers over the
 * `ai_chat` rate limit (429), counted per IP and, when signed in, per user. Returns null when the
 * request may proceed.
 */
export async function aiRequestGuard(request: NextRequest): Promise<NextResponse | null> {
  const length = Number(request.headers.get('content-length') ?? 0);
  if (length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'This request is too large.' }, { status: 413 });
  }
  let userId: string | null = null;
  try {
    const supabase = await createClient();
    userId = (await supabase.auth.getUser()).data.user?.id ?? null;
  } catch {
    userId = null;
  }
  const limited = await checkRateLimit('ai_chat', userId);
  if (limited) {
    return NextResponse.json({ error: limited }, { status: 429, headers: { 'Retry-After': '60' } });
  }
  return null;
}
