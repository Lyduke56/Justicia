/**
 * Server-only parts of in-app consultation calls: the private signalling topic and the
 * STUN/TURN servers handed to the two participants.
 *
 * TURN relay (needed when a network blocks direct connections, common on mobile data). Set ONE
 * of these in the environment (Vercel → Project → Settings → Environment Variables):
 *   - Cloudflare Realtime TURN: CLOUDFLARE_TURN_KEY_ID + CLOUDFLARE_TURN_API_TOKEN
 *   - Metered (Open Relay):     METERED_TURN_DOMAIN (e.g. justicia.metered.live) + METERED_TURN_API_KEY
 *   - Any TURN server:          TURN_URLS (comma-separated) + TURN_USERNAME + TURN_CREDENTIAL
 * Without one, calls use public STUN only: they still connect on most home and office Wi-Fi.
 */
import { createHmac } from 'node:crypto';
import type { CallIceServer } from './call';

const FETCH_TIMEOUT_MS = 4000;
/** Relay credentials stay valid this long (a session plus a generous overrun). */
const TURN_TTL_SECONDS = 6 * 60 * 60;

const PUBLIC_STUN: CallIceServer[] = [
  { urls: ['stun:stun.cloudflare.com:3478', 'stun:stun.l.google.com:19302'] },
];

function topicSecret(): string {
  return process.env.REALTIME_TOPIC_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
}

/**
 * The Realtime topic of one consultation's call. Only the server can compute it (HMAC with a
 * server secret), and it changes when the session is rescheduled.
 */
export function callTopicFor(consultationId: string, scheduledStart: string | null): string | null {
  const secret = topicSecret();
  if (!secret || !consultationId) return null;
  const start = scheduledStart ? Date.parse(scheduledStart) : NaN;
  const digest = createHmac('sha256', secret)
    .update(`justicia-call:${consultationId}:${Number.isFinite(start) ? start : 'unscheduled'}`)
    .digest('hex')
    .slice(0, 40);
  return `call-${digest}`;
}

const ICE_URL_RE = /^(stun|stuns|turn|turns):[^\s]+$/i;

/** Keeps well-formed entries; drops port-53 URLs, which browsers block or time out on. */
function cleanIceServers(raw: unknown): CallIceServer[] {
  const list = Array.isArray(raw) ? raw : raw && typeof raw === 'object' ? [raw] : [];
  const out: CallIceServer[] = [];
  for (const entry of list) {
    if (!entry || typeof entry !== 'object') continue;
    const e = entry as { urls?: unknown; url?: unknown; username?: unknown; credential?: unknown };
    const urlsRaw = e.urls ?? e.url;
    const urls = (Array.isArray(urlsRaw) ? urlsRaw : [urlsRaw])
      .filter((u): u is string => typeof u === 'string' && ICE_URL_RE.test(u.trim()))
      .map((u) => u.trim())
      .filter((u) => !/:53(\?|$)/.test(u));
    if (urls.length === 0) continue;
    const isTurn = urls.some((u) => /^turns?:/i.test(u));
    if (isTurn && (typeof e.username !== 'string' || typeof e.credential !== 'string')) continue;
    out.push(isTurn ? { urls, username: e.username as string, credential: e.credential as string } : { urls });
  }
  return out;
}

async function cloudflareTurn(keyId: string, token: string): Promise<CallIceServer[]> {
  const res = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(keyId)}/credentials/generate-ice-servers`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ttl: TURN_TTL_SECONDS }),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Cloudflare TURN responded ${res.status}`);
  const body = (await res.json()) as { iceServers?: unknown };
  return cleanIceServers(body.iceServers);
}

async function meteredTurn(domain: string, apiKey: string): Promise<CallIceServer[]> {
  const host = domain.replace(/^https?:\/\//, '').replace(/\/+$/, '');
  const res = await fetch(`https://${host}/api/v1/turn/credentials?apiKey=${encodeURIComponent(apiKey)}`, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Metered TURN responded ${res.status}`);
  return cleanIceServers(await res.json());
}

function staticTurn(): CallIceServer[] {
  const urls = (process.env.TURN_URLS || '').split(',').map((u) => u.trim()).filter(Boolean);
  if (urls.length === 0) return [];
  return cleanIceServers({ urls, username: process.env.TURN_USERNAME, credential: process.env.TURN_CREDENTIAL });
}

/** Which TURN provider is configured, if any (for the health check and logs). */
export function turnProvider(): 'cloudflare' | 'metered' | 'static' | null {
  if (process.env.CLOUDFLARE_TURN_KEY_ID && process.env.CLOUDFLARE_TURN_API_TOKEN) return 'cloudflare';
  if (process.env.METERED_TURN_DOMAIN && process.env.METERED_TURN_API_KEY) return 'metered';
  if (process.env.TURN_URLS) return 'static';
  return null;
}

/**
 * STUN plus short-lived TURN credentials from the configured provider. Never throws: when the
 * provider can't be reached, the call falls back to STUN only (relay: false).
 */
export async function iceServersForCall(): Promise<{ iceServers: CallIceServer[]; relay: boolean }> {
  const provider = turnProvider();
  let turn: CallIceServer[] = [];
  try {
    if (provider === 'cloudflare') {
      turn = await cloudflareTurn(process.env.CLOUDFLARE_TURN_KEY_ID!, process.env.CLOUDFLARE_TURN_API_TOKEN!);
    } else if (provider === 'metered') {
      turn = await meteredTurn(process.env.METERED_TURN_DOMAIN!, process.env.METERED_TURN_API_KEY!);
    } else if (provider === 'static') {
      turn = staticTurn();
    }
  } catch (err) {
    console.warn('[call] TURN credentials unavailable, using STUN only:', err instanceof Error ? err.message : err);
    turn = [];
  }
  const relay = turn.some((s) => (Array.isArray(s.urls) ? s.urls : [s.urls]).some((u) => /^turns?:/i.test(u)));
  return { iceServers: [...PUBLIC_STUN, ...turn], relay };
}
