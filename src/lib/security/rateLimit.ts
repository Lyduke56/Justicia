/**
 * Per-user and per-IP rate limits. SERVER-SIDE ONLY.
 *
 * Counters live in Postgres (`hit_rate_limit` function and `rate_limit_hits` table, see
 * supabase/manual/002_rate_limits.sql) so every Vercel instance shares them. Until that script
 * has been run, an in-memory counter per server instance is used instead (weaker, but never
 * blocks the app). Keys are hashed, so neither IP addresses nor emails are stored.
 */
import { createHash } from 'node:crypto';
import { headers } from 'next/headers';
import { createServiceClient } from '@/lib/supabase/server';

export interface RateRule {
  /** Maximum hits in one window. */
  limit: number;
  /** Window length in seconds. */
  windowSec: number;
}

/** Limits by action. `ip` applies per client IP, `subject` per user id or email. */
export const RATE_LIMITS = {
  sign_in: { ip: { limit: 20, windowSec: 600 }, subject: { limit: 8, windowSec: 600 } },
  sign_up: { ip: { limit: 6, windowSec: 3600 }, subject: { limit: 3, windowSec: 3600 } },
  password_reset: { ip: { limit: 6, windowSec: 3600 }, subject: { limit: 3, windowSec: 3600 } },
  resend_verification: { ip: { limit: 6, windowSec: 3600 }, subject: { limit: 3, windowSec: 3600 } },
  ai_chat: { ip: { limit: 40, windowSec: 600 }, subject: { limit: 30, windowSec: 600 } },
  message_send: { ip: { limit: 120, windowSec: 600 }, subject: { limit: 60, windowSec: 600 } },
  upload: { ip: { limit: 60, windowSec: 600 }, subject: { limit: 40, windowSec: 600 } },
  report: { ip: { limit: 10, windowSec: 3600 }, subject: { limit: 10, windowSec: 3600 } },
  booking: { ip: { limit: 20, windowSec: 3600 }, subject: { limit: 10, windowSec: 3600 } },
  reschedule: { ip: { limit: 20, windowSec: 3600 }, subject: { limit: 10, windowSec: 3600 } },
  account_sensitive: { ip: { limit: 10, windowSec: 3600 }, subject: { limit: 5, windowSec: 3600 } },
} satisfies Record<string, { ip: RateRule; subject: RateRule }>;

export type RateAction = keyof typeof RATE_LIMITS;

export interface RateResult {
  ok: boolean;
  retryAfterSec: number;
}

const memory = new Map<string, { windowStart: number; hits: number }>();
let rpcMissing = false;

function hashKey(raw: string): string {
  return createHash('sha256').update(`justicia-rate:${raw}`).digest('hex').slice(0, 48);
}

function hitMemory(key: string, rule: RateRule): RateResult {
  const now = Date.now();
  const windowMs = rule.windowSec * 1000;
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const entry = memory.get(key);
  const hits = entry && entry.windowStart === windowStart ? entry.hits + 1 : 1;
  memory.set(key, { windowStart, hits });
  if (memory.size > 5000) {
    for (const [k, v] of memory) if (v.windowStart < windowStart) memory.delete(k);
  }
  return { ok: hits <= rule.limit, retryAfterSec: Math.max(1, Math.ceil((windowStart + windowMs - now) / 1000)) };
}

/** Counts one hit for `key` and says whether it is still within `rule`. Never throws. */
export async function hitRateLimit(key: string, rule: RateRule): Promise<RateResult> {
  const hashed = hashKey(key);
  if (!rpcMissing) {
    try {
      const db = await createServiceClient();
      const { data, error } = await db.rpc('hit_rate_limit' as never, {
        p_key: hashed,
        p_limit: rule.limit,
        p_window_seconds: rule.windowSec,
      } as never);
      if (!error && data && typeof data === 'object') {
        const result = data as { allowed?: boolean; retry_after?: number };
        return { ok: result.allowed !== false, retryAfterSec: Number(result.retry_after) || rule.windowSec };
      }
      if (error && (error.code === 'PGRST202' || /could not find the function/i.test(error.message))) {
        rpcMissing = true;
      } else if (error) {
        console.warn('[rateLimit] rpc error, using memory counter:', error.message);
      }
    } catch (err) {
      console.warn('[rateLimit] rpc unavailable, using memory counter:', err instanceof Error ? err.message : err);
    }
  }
  return hitMemory(hashed, rule);
}

/** The caller's IP address (first hop of x-forwarded-for on Vercel), or 'unknown'. */
export async function clientIp(): Promise<string> {
  try {
    const h = await headers();
    const forwarded = h.get('x-forwarded-for')?.split(',')[0]?.trim();
    return forwarded || h.get('x-real-ip')?.trim() || 'unknown';
  } catch {
    return 'unknown';
  }
}

function waitText(seconds: number): string {
  if (seconds < 90) return 'a minute';
  const minutes = Math.ceil(seconds / 60);
  return minutes < 90 ? `${minutes} minutes` : `${Math.ceil(minutes / 60)} hours`;
}

/**
 * Applies the IP limit and, when given, the per-subject limit (user id or normalized email) for
 * an action. Returns an error message to show, or null when the request may go ahead.
 */
export async function checkRateLimit(action: RateAction, subject?: string | null): Promise<string | null> {
  const rules = RATE_LIMITS[action];
  const ip = await clientIp();
  const checks: Array<Promise<RateResult>> = [hitRateLimit(`${action}:ip:${ip}`, rules.ip)];
  if (subject) checks.push(hitRateLimit(`${action}:subject:${subject}`, rules.subject));
  const results = await Promise.all(checks);
  const blocked = results.find((r) => !r.ok);
  return blocked ? `Too many attempts. Please wait ${waitText(blocked.retryAfterSec)} and try again.` : null;
}
